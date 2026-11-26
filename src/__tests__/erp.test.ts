import { beforeEach, describe, expect, it } from 'vitest';

// Provide an isolated in-memory localStorage shim for Vitest Node execution
const memoryStorage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => (memoryStorage.has(key) ? memoryStorage.get(key)! : null),
    setItem: (key: string, val: string) => {
      memoryStorage.set(key, String(val));
    },
    removeItem: (key: string) => {
      memoryStorage.delete(key);
    },
    clear: () => {
      memoryStorage.clear();
    },
  },
  configurable: true,
});

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as XLSX from 'xlsx';
import { POSReceiptPrintLayout } from '../components/pos/POSReceiptPrintLayout';
import {
  ACCOUNT_IDS,
  buildChequeClearanceVoucher,
  buildInstallmentCreationVoucher,
  buildInstallmentReceiptVoucher,
  buildPurchaseReturnVoucher,
  buildPurchaseVoucher,
  buildSalesReturnVoucher,
  buildSalesVoucher,
  sumVoucherSides,
} from '../services/accounting';
import {
  buildBackupWorkbook,
  computeCanonicalSnapshotChecksum,
  computeSha256Hex,
  parseBackupWorkbookBuffer,
  validateCustomerImport,
  validateProductImport,
} from '../services/excelService';
import {
  getFirebaseConfig,
  getFirebaseMissingFields,
  getPublicFirebaseSummary,
  isFirebaseConfigured,
  resolveFirebaseConfig,
} from '../services/firebase';
import {
  buildCloudDocPayload,
} from '../services/firestoreSync';
import {
  adjustProductStock,
  applyCloudCollectionSnapshot,
  bounceChequeWithAccounting,
  clearChequeWithAccounting,
  clearCloudSession,
  clearToProductionEmpty,
  closeInstallmentAccountEarly,
  createInstallmentAccount,
  createPurchaseInvoice,
  createPurchaseReturn,
  createSalesInvoice,
  createSalesReturn,
  createStockTransfer,
  createVoucher,
  deleteCustomer,
  deleteProduct,
  deleteSupplier,
  deleteTask,
  getAuditLogs,
  getSettings,
  logAuditAction,
  saveSettings,
  getBalanceSheetStatement,
  getBankBookEntries,
  getCashBookEntries,
  getCashFlowStatement,
  getChartOfAccounts,
  getCustomerById,
  getCustomerLedgerEntries,
  getDatabaseSnapshot,
  getGeneralLedgerEntries,
  getHeadWiseBalanceReport,
  getInstallmentCommitments,
  getInstallmentReportsData,
  getInventoryReportsData,
  getItemStockLedger,
  getProductById,
  getSupplierById,
  getSupplierLedgerEntries,
  getTasks,
  getVouchers,
  importDatabaseJSON,
  isDemoMode,
  receiveInstallmentPayment,
  reconcileCheque,
  rescheduleInstallmentPlan,
  reverseVoucher,
  saveCheque,
  saveCustomer,
  saveInstallmentCommitment,
  saveProduct,
  saveSupplier,
  saveTask,
  saveWarehouse,
  setActiveUser,
  updateCommitmentStatus,
} from '../services/storage';
import { mapFirebaseAuthError, resolveAuthenticatedProfile, withTimeout } from '../context/AuthContext';
import { buildFullOwnerPermissions, getDefaultPermissionsForRole } from '../types/rbac';
import type { ChequeRecord, Customer, InstallmentAccount, Product, Supplier } from '../types/erp';

function seedCleanFixtures(): { customer: Customer; supplier: Supplier; product: Product } {
  clearToProductionEmpty();

  const supplier: Supplier = {
    id: 'SUPP-TEST-1',
    companyName: 'Haier Pakistan Distributors',
    contactPerson: 'Tariq Mahmood',
    phone: '0300-1112233',
    address: 'Multan Road',
    city: 'Lahore',
    openingBalance: 0,
    currentBalance: 0,
    paymentTerms: '30 Days Credit',
    createdAt: '2026-11-01',
  };

  const customer: Customer = {
    id: 'CUST-TEST-1',
    name: 'Bilal Ahmed',
    phone: '0321-9988776',
    cnic: '35202-1234567-1',
    address: 'Model Town',
    city: 'Lahore',
    openingBalance: 0,
    currentBalance: 0,
    creditLimit: 500000,
    customerType: 'Credit',
    createdAt: '2026-11-01',
  };

  const product: Product = {
    id: 'PROD-TEST-1',
    name: 'Haier 1.5 Ton DC Inverter AC',
    category: 'Air Conditioners',
    brand: 'Haier',
    modelNumber: 'HSU-18HFT',
    sku: 'HAE-18HFT',
    barcode: '8964001122334',
    unit: 'Unit',
    purchasePrice: 50000,
    retailPrice: 70000,
    minSalePrice: 60000,
    stockQuantity: 0,
    minStockLevel: 2,
    warrantyMonths: 120,
    hasSerialTracking: false,
    serials: [],
  };

  saveSupplier(supplier);
  saveCustomer(customer);
  saveProduct(product);

  return { customer, supplier, product };
}

describe('Al-Madina Electronics ERP — Core Accounting, Inventory & RBAC Suite', () => {
  beforeEach(() => {
    memoryStorage.clear();
    clearCloudSession();
    clearToProductionEmpty();
  });

  it('1. Enforces balanced double-entry vouchers (Debits === Credits) across every transaction builder and posted store voucher', () => {
    const { customer, supplier, product } = seedCleanFixtures();

    // Builder-level checks
    const cashSaleVoucher = buildSalesVoucher(
      {
        id: 'INV-1001',
        invoiceNumber: 'INV-1001',
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        saleType: 'Cash',
        date: '2026-11-10',
        items: [
          {
            productId: product.id,
            productName: product.name,
            brand: product.brand,
            modelNumber: product.modelNumber,
            quantity: 1,
            unitPrice: 70000,
            costPrice: 50000,
            discount: 0,
            total: 70000,
          },
        ],
        subTotal: 70000,
        discount: 0,
        tax: 0,
        grandTotal: 70000,
        paidAmount: 70000,
        changeAmount: 0,
        remainingBalance: 0,
        paymentMethod: 'Cash',
        status: 'Completed',
        salesPerson: 'Admin',
      },
      'Admin',
      'uid-1'
    );
    expect(sumVoucherSides(cashSaleVoucher.entries).isBalanced).toBe(true);

    const creditSaleVoucher = buildSalesVoucher(
      {
        id: 'INV-1002',
        invoiceNumber: 'INV-1002',
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        saleType: 'Credit',
        date: '2026-11-10',
        items: [
          {
            productId: product.id,
            productName: product.name,
            brand: product.brand,
            modelNumber: product.modelNumber,
            quantity: 2,
            unitPrice: 70000,
            costPrice: 50000,
            discount: 0,
            total: 140000,
          },
        ],
        subTotal: 140000,
        discount: 0,
        tax: 0,
        grandTotal: 140000,
        paidAmount: 40000,
        changeAmount: 0,
        remainingBalance: 100000,
        paymentMethod: 'Bank Transfer',
        status: 'Completed',
        salesPerson: 'Admin',
      },
      'Admin',
      'uid-1'
    );
    expect(sumVoucherSides(creditSaleVoucher.entries).isBalanced).toBe(true);

    const salesReturnCash = buildSalesReturnVoucher(
      {
        id: 'SRTN-1001',
        returnNumber: 'SRTN-1001',
        originalInvoiceNo: 'INV-1001',
        customerId: customer.id,
        customerName: customer.name,
        date: '2026-11-11',
        items: [{ productId: product.id, productName: product.name, quantity: 1, unitPrice: 70000, total: 70000, reason: 'Defective' }],
        grandTotal: 70000,
        refundMethod: 'Cash',
        processedBy: 'Admin',
      },
      50000,
      'Admin',
      'uid-1'
    );
    expect(sumVoucherSides(salesReturnCash.entries).isBalanced).toBe(true);

    const salesReturnCreditNote = buildSalesReturnVoucher(
      {
        id: 'SRTN-1002',
        returnNumber: 'SRTN-1002',
        originalInvoiceNo: 'INV-1002',
        customerId: customer.id,
        customerName: customer.name,
        date: '2026-11-11',
        items: [{ productId: product.id, productName: product.name, quantity: 1, unitPrice: 70000, total: 70000, reason: 'Customer exchange' }],
        grandTotal: 70000,
        refundMethod: 'Credit Note',
        processedBy: 'Admin',
      },
      50000,
      'Admin',
      'uid-1'
    );
    expect(sumVoucherSides(salesReturnCreditNote.entries).isBalanced).toBe(true);

    const purchaseWithFreight = buildPurchaseVoucher(
      {
        id: 'PINV-2001',
        invoiceNumber: 'PINV-2001',
        supplierId: supplier.id,
        supplierName: supplier.companyName,
        date: '2026-11-05',
        items: [
          {
            productId: product.id,
            productName: product.name,
            brand: product.brand,
            modelNumber: product.modelNumber,
            quantity: 10,
            purchasePrice: 50000,
            total: 500000,
          },
        ],
        subTotal: 500000,
        discount: 0,
        tax: 0,
        freightCharges: 15000,
        grandTotal: 515000,
        paidAmount: 215000,
        remainingBalance: 300000,
        paymentMethod: 'Bank Transfer',
        status: 'Received',
        createdBy: 'Admin',
      },
      'Admin',
      'uid-1'
    );
    expect(sumVoucherSides(purchaseWithFreight.entries).isBalanced).toBe(true);

    const prtnDeductPayable = buildPurchaseReturnVoucher(
      {
        id: 'PRTN-2001',
        returnNumber: 'PRTN-2001',
        originalPurchaseNo: 'PINV-2001',
        supplierId: supplier.id,
        supplierName: supplier.companyName,
        date: '2026-11-06',
        items: [{ productId: product.id, productName: product.name, quantity: 2, purchasePrice: 50000, total: 100000, reason: 'Damaged' }],
        grandTotal: 100000,
        refundMethod: 'Deduct Payable',
        processedBy: 'Admin',
      },
      'Admin',
      'uid-1'
    );
    expect(sumVoucherSides(prtnDeductPayable.entries).isBalanced).toBe(true);

    const prtnBankRefund = buildPurchaseReturnVoucher(
      {
        id: 'PRTN-2002',
        returnNumber: 'PRTN-2002',
        originalPurchaseNo: 'PINV-2001',
        supplierId: supplier.id,
        supplierName: supplier.companyName,
        date: '2026-11-06',
        items: [{ productId: product.id, productName: product.name, quantity: 1, purchasePrice: 50000, total: 50000, reason: 'Excess' }],
        grandTotal: 50000,
        refundMethod: 'Bank Refund',
        processedBy: 'Admin',
      },
      'Admin',
      'uid-1'
    );
    expect(sumVoucherSides(prtnBankRefund.entries).isBalanced).toBe(true);

    // End-to-end store postings including installment creation, receipt, early closure & cheque clearing
    createPurchaseInvoice({
      invoiceNumber: 'PINV-STORE-1',
      supplierId: supplier.id,
      supplierName: supplier.companyName,
      date: '2026-11-02',
      items: [
        {
          productId: product.id,
          productName: product.name,
          brand: product.brand,
          modelNumber: product.modelNumber,
          quantity: 10,
          purchasePrice: 50000,
          total: 500000,
        },
      ],
      subTotal: 500000,
      discount: 0,
      tax: 0,
      freightCharges: 10000,
      grandTotal: 510000,
      paidAmount: 110000,
      remainingBalance: 400000,
      paymentMethod: 'Cash',
      status: 'Received',
    });

    const instAccount: Omit<InstallmentAccount, 'id' | 'totalReceived' | 'status' | 'remainingBalance'> = {
      accountNumber: 'INST-TEST-1',
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerCnic: customer.cnic,
      customerAddress: customer.address,
      productId: product.id,
      productName: product.name,
      productModel: product.modelNumber,
      salesInvoiceNo: 'INV-INST-1',
      cashPrice: 70000,
      downPayment: 20000,
      financedAmount: 50000,
      markupPercentage: 20,
      markupAmount: 10000,
      totalFinancedPayable: 60000,
      totalPayableWithDown: 80000,
      durationMonths: 6,
      monthlyInstallment: 10000,
      startDate: '2026-11-03',
      firstDueDate: '2026-12-03',
      guarantor1Name: 'Imran Khan',
      guarantor1Phone: '0301-7778889',
      guarantor1Cnic: '35202-7654321-1',
      guarantor1Relation: 'Brother',
      recoveryOfficerId: 'EMP-1',
      recoveryOfficerName: 'Kamran',
      schedule: Array.from({ length: 6 }, (_, i) => ({
        installmentNumber: i + 1,
        dueDate: `2027-0${i + 1}-03`,
        principalAmount: Math.round(50000 / 6),
        markupAmount: Math.round(10000 / 6),
        totalDue: 10000,
        paidAmount: 0,
        remainingAmount: 10000,
        status: 'Upcoming',
      })),
    };

    const instCreationVoucher = buildInstallmentCreationVoucher(
      { ...instAccount, id: 'INST-TEST-1', totalReceived: 20000, remainingBalance: 60000, status: 'Active' },
      'Admin',
      'uid-1'
    );
    expect(sumVoucherSides(instCreationVoucher.entries).isBalanced).toBe(true);

    const createdInst = createInstallmentAccount(instAccount);
    const instReceiptVoucher = buildInstallmentReceiptVoucher(createdInst, 'RCT-101', 5000, 'Cash', 'Admin', 'uid-1');
    expect(sumVoucherSides(instReceiptVoucher.entries).isBalanced).toBe(true);
    receiveInstallmentPayment(createdInst.id, 5000, 'Cash', 'First partial payment');
    closeInstallmentAccountEarly(createdInst.id, 50000, 'Bank', 'Early payoff');

    const cheque: ChequeRecord = {
      id: 'CHQ-TEST-1',
      chequeNumber: '998877',
      type: 'Received',
      bankName: 'Meezan Bank',
      partyName: customer.name,
      amount: 25000,
      issueDate: '2026-11-05',
      chequeDate: '2026-11-10',
      status: 'Deposited',
    };
    expect(sumVoucherSides(buildChequeClearanceVoucher(cheque, '2026-11-11', 'Admin', 'uid-1').entries).isBalanced).toBe(true);
    saveCheque(cheque);
    expect(clearChequeWithAccounting(cheque.id, '2026-11-11')).toBe(true);

    // Every posted voucher stored in the ledger must strictly balance
    const allVouchers = getVouchers();
    expect(allVouchers.length).toBeGreaterThanOrEqual(5);
    for (const v of allVouchers) {
      const totals = sumVoucherSides(v.entries);
      expect(totals.isBalanced).toBe(true);
      expect(totals.debit).toBe(totals.credit);
    }

    // Verify COA reflects net postings without NaN
    const accounts = getChartOfAccounts();
    const freightAcc = accounts.find(a => a.id === ACCOUNT_IDS.FREIGHT_EXPENSE);
    expect(freightAcc?.currentBalance).toBe(10000);
  });

  it('2. Tracks complete inventory lifecycle math (Purchase +10 -> Sale -3 -> Sales Return +1 -> Purchase Return -2 = 6 units & running stock ledger)', () => {
    const { customer, supplier, product } = seedCleanFixtures();

    createPurchaseInvoice({
      invoiceNumber: 'PINV-INV-1',
      supplierId: supplier.id,
      supplierName: supplier.companyName,
      date: '2026-11-01',
      items: [
        {
          productId: product.id,
          productName: product.name,
          brand: product.brand,
          modelNumber: product.modelNumber,
          quantity: 10,
          purchasePrice: 50000,
          total: 500000,
        },
      ],
      subTotal: 500000,
      discount: 0,
      tax: 0,
      freightCharges: 0,
      grandTotal: 500000,
      paidAmount: 500000,
      remainingBalance: 0,
      paymentMethod: 'Cash',
      status: 'Received',
    });
    expect(getProductById(product.id)?.stockQuantity).toBe(10);

    createSalesInvoice({
      invoiceNumber: 'INV-LIFE-1',
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      saleType: 'Cash',
      date: '2026-11-02',
      items: [
        {
          productId: product.id,
          productName: product.name,
          brand: product.brand,
          modelNumber: product.modelNumber,
          quantity: 3,
          unitPrice: 70000,
          costPrice: 50000,
          discount: 0,
          total: 210000,
        },
      ],
      subTotal: 210000,
      discount: 0,
      tax: 0,
      grandTotal: 210000,
      paidAmount: 210000,
      changeAmount: 0,
      remainingBalance: 0,
      paymentMethod: 'Cash',
      salesPerson: 'Cashier',
    });
    expect(getProductById(product.id)?.stockQuantity).toBe(7);

    createSalesReturn({
      returnNumber: 'SRTN-LIFE-1',
      originalInvoiceNo: 'INV-LIFE-1',
      customerId: customer.id,
      customerName: customer.name,
      date: '2026-11-03',
      items: [{ productId: product.id, productName: product.name, quantity: 1, unitPrice: 70000, total: 70000, reason: 'Box damaged' }],
      grandTotal: 70000,
      refundMethod: 'Cash',
    });
    expect(getProductById(product.id)?.stockQuantity).toBe(8);

    createPurchaseReturn({
      returnNumber: 'PRTN-LIFE-1',
      originalPurchaseNo: 'PINV-INV-1',
      supplierId: supplier.id,
      supplierName: supplier.companyName,
      date: '2026-11-04',
      items: [{ productId: product.id, productName: product.name, quantity: 2, purchasePrice: 50000, total: 100000, reason: 'Factory defect' }],
      grandTotal: 100000,
      refundMethod: 'Deduct Payable',
    });

    expect(getProductById(product.id)?.stockQuantity).toBe(6);

    const stockLedger = getItemStockLedger(product.id);
    expect(stockLedger).toHaveLength(4);
    expect(stockLedger.map(r => r.qtyIn - r.qtyOut)).toEqual([10, -3, 1, -2]);
    expect(stockLedger[stockLedger.length - 1].runningQty).toBe(6);
  });

  it('3. Updates customer and supplier balances & party ledger entries accurately across Credit Sales, Credit Notes & Debit Notes', () => {
    const { customer, supplier, product } = seedCleanFixtures();

    // Purchase 4 units @ 50,000 = 200,000; pay 50,000 -> Payable = 150,000
    createPurchaseInvoice({
      invoiceNumber: 'PINV-PARTY-1',
      supplierId: supplier.id,
      supplierName: supplier.companyName,
      date: '2026-11-02',
      items: [
        {
          productId: product.id,
          productName: product.name,
          brand: product.brand,
          modelNumber: product.modelNumber,
          quantity: 4,
          purchasePrice: 50000,
          total: 200000,
        },
      ],
      subTotal: 200000,
      discount: 0,
      tax: 0,
      freightCharges: 0,
      grandTotal: 200000,
      paidAmount: 50000,
      remainingBalance: 150000,
      paymentMethod: 'Cash',
      status: 'Received',
    });
    expect(getSupplierById(supplier.id)?.currentBalance).toBe(150000);

    // Purchase Return of 1 unit @ 50,000 with 'Deduct Payable' -> Payable = 100,000
    createPurchaseReturn({
      returnNumber: 'PRTN-PARTY-1',
      originalPurchaseNo: 'PINV-PARTY-1',
      supplierId: supplier.id,
      supplierName: supplier.companyName,
      date: '2026-11-03',
      items: [{ productId: product.id, productName: product.name, quantity: 1, purchasePrice: 50000, total: 50000, reason: 'Shortage' }],
      grandTotal: 50000,
      refundMethod: 'Deduct Payable',
    });
    expect(getSupplierById(supplier.id)?.currentBalance).toBe(100000);

    const supplierLedger = getSupplierLedgerEntries(supplier.id);
    expect(supplierLedger.some(e => e.voucherType === 'Purchase Return' && e.voucherNo === 'PRTN-PARTY-1' && e.debit === 50000)).toBe(true);

    // Credit Sale of 2 units @ 70,000 = 140,000; paid 40,000 -> Customer Receivable = 100,000
    createSalesInvoice({
      invoiceNumber: 'INV-PARTY-1',
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      saleType: 'Credit',
      date: '2026-11-04',
      items: [
        {
          productId: product.id,
          productName: product.name,
          brand: product.brand,
          modelNumber: product.modelNumber,
          quantity: 2,
          unitPrice: 70000,
          costPrice: 50000,
          discount: 0,
          total: 140000,
        },
      ],
      subTotal: 140000,
      discount: 0,
      tax: 0,
      grandTotal: 140000,
      paidAmount: 40000,
      changeAmount: 0,
      remainingBalance: 100000,
      paymentMethod: 'Cash',
      salesPerson: 'Manager',
    });
    expect(getCustomerById(customer.id)?.currentBalance).toBe(100000);

    // Sales Return of 1 unit @ 70,000 via 'Credit Note' -> Receivable = 30,000
    createSalesReturn({
      returnNumber: 'SRTN-PARTY-1',
      originalInvoiceNo: 'INV-PARTY-1',
      customerId: customer.id,
      customerName: customer.name,
      date: '2026-11-05',
      items: [{ productId: product.id, productName: product.name, quantity: 1, unitPrice: 70000, total: 70000, reason: 'Exchange' }],
      grandTotal: 70000,
      refundMethod: 'Credit Note',
    });
    expect(getCustomerById(customer.id)?.currentBalance).toBe(30000);

    const customerLedger = getCustomerLedgerEntries(customer.id);
    expect(customerLedger.some(e => e.voucherType === 'Sales Return' && e.voucherNo === 'SRTN-PARTY-1' && e.credit === 70000)).toBe(true);
  });

  it('4. Handles Installment schedule generation, partial installment payments, and early account closure', () => {
    const { customer, product } = seedCleanFixtures();

    const account = createInstallmentAccount({
      accountNumber: 'INST-SCH-1',
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerCnic: customer.cnic,
      customerAddress: customer.address,
      productId: product.id,
      productName: product.name,
      productModel: product.modelNumber,
      salesInvoiceNo: 'INV-INST-SCH',
      cashPrice: 70000,
      downPayment: 10000,
      financedAmount: 60000,
      markupPercentage: 20,
      markupAmount: 12000,
      totalFinancedPayable: 72000,
      totalPayableWithDown: 82000,
      durationMonths: 6,
      monthlyInstallment: 12000,
      startDate: '2026-11-01',
      firstDueDate: '2026-12-01',
      guarantor1Name: 'Zain Ali',
      guarantor1Phone: '0300-5554443',
      guarantor1Cnic: '35202-2223334-1',
      guarantor1Relation: 'Uncle',
      recoveryOfficerId: 'EMP-2',
      recoveryOfficerName: 'Salman',
      schedule: Array.from({ length: 6 }, (_, idx) => ({
        installmentNumber: idx + 1,
        dueDate: `2027-0${idx + 1}-01`,
        principalAmount: 10000,
        markupAmount: 2000,
        totalDue: 12000,
        paidAmount: 0,
        remainingAmount: 12000,
        status: 'Upcoming',
      })),
    });

    expect(account.remainingBalance).toBe(72000);
    expect(account.status).toBe('Active');
    expect(account.schedule).toHaveLength(6);

    // Pay partial PKR 5,000 toward 12,000 first installment
    const partialRes = receiveInstallmentPayment(account.id, 5000, 'Cash', 'Partial installment');
    expect(partialRes.updatedAccount.schedule[0].status).toBe('Partially Paid');
    expect(partialRes.updatedAccount.schedule[0].paidAmount).toBe(5000);
    expect(partialRes.updatedAccount.schedule[0].remainingAmount).toBe(7000);
    expect(partialRes.updatedAccount.remainingBalance).toBe(67000);

    // Close account early with negotiated settlement
    const closedRes = closeInstallmentAccountEarly(account.id, 60000, 'Bank', 'Settled early with markup waiver');
    expect(closedRes.updatedAccount.remainingBalance).toBe(0);
    expect(closedRes.updatedAccount.status).toBe('Closed Early');
    expect(closedRes.updatedAccount.schedule.every(s => s.status === 'Paid')).toBe(true);
    expect(getCustomerById(customer.id)?.currentBalance).toBe(0);
  });

  it('5. Enforces RBAC permission boundaries across roles and produces deterministic SHA-256 backup checksums', async () => {
    const cashierPerms = getDefaultPermissionsForRole('Cashier');
    const managerPerms = getDefaultPermissionsForRole('Manager');
    const ownerPerms = buildFullOwnerPermissions();

    // Cashier cannot view/manage Owner Admin, Settings, Audit, or Purchase Returns
    expect(cashierPerms.admin).toBeUndefined();
    expect(cashierPerms.settings).toBeUndefined();
    expect(cashierPerms.audit).toBeUndefined();
    expect(cashierPerms.pos).toContain('CREATE');
    expect(cashierPerms.pos).not.toContain('DELETE');

    // Manager can view/approve returns & inventory but cannot access Owner Super Admin DR
    expect(managerPerms.admin).toBeUndefined();
    expect(managerPerms.salesReturns).toContain('APPROVE');
    expect(managerPerms.purchaseReturns).toContain('APPROVE');

    // Owner has full matrix across all 21 modules & all 7 actions
    expect(ownerPerms.admin).toEqual(['VIEW', 'CREATE', 'EDIT', 'DELETE', 'EXPORT', 'APPROVE', 'MANAGE']);
    expect(Object.keys(ownerPerms)).toHaveLength(21);

    // Deterministic SHA-256 checksum
    const hashA = await computeSha256Hex('{"org":"al-madina-main","v":1}');
    const hashB = await computeSha256Hex('{"org":"al-madina-main","v":1}');
    const hashC = await computeSha256Hex('{"org":"al-madina-main","v":2}');
    expect(hashA).toBe(hashB);
    expect(hashA).not.toBe(hashC);
    expect(hashA.length).toBeGreaterThanOrEqual(8);
  });

  it('6. Validates Firebase project/database configuration and preserves real ERP records in Excel validators & snapshots', () => {
    const fbCfg = getFirebaseConfig();
    expect(isFirebaseConfigured()).toBe(true);
    expect(fbCfg.projectId).toBe('gen-lang-client-0548186480');
    expect(fbCfg.firestoreDatabaseId).toBe('ai-studio-perfectcodestudi-ce3ea4e0-4acf-4f2d-b4f8-2bf81e5e637b');
    expect(fbCfg.apiKey).not.toContain('"');
    expect(fbCfg.apiKey).not.toContain(',');

    // Clean production VITE_FIREBASE_* override for al-madina-electronics works WITHOUT VITE_FIREBASE_DATABASE_ID
    // and never inherits gen-lang-client-0548186480's custom firestoreDatabaseId
    const prodCfg = resolveFirebaseConfig({
      VITE_FIREBASE_API_KEY: 'AIzaTestProdKey123',
      VITE_FIREBASE_AUTH_DOMAIN: 'al-madina-electronics.firebaseapp.com',
      VITE_FIREBASE_PROJECT_ID: 'al-madina-electronics',
      VITE_FIREBASE_STORAGE_BUCKET: 'al-madina-electronics.firebasestorage.app',
      VITE_FIREBASE_MESSAGING_SENDER_ID: '1056981234846',
      VITE_FIREBASE_APP_ID: '1:1056981234846:web:test',
    });
    expect(prodCfg.projectId).toBe('al-madina-electronics');
    expect(prodCfg.authDomain).toBe('al-madina-electronics.firebaseapp.com');
    expect(prodCfg.apiKey).toBe('AIzaTestProdKey123');
    expect(prodCfg.storageBucket).toBe('al-madina-electronics.firebasestorage.app');
    expect(prodCfg.messagingSenderId).toBe('1056981234846');
    expect(prodCfg.appId).toBe('1:1056981234846:web:test');
    expect(prodCfg.firestoreDatabaseId).toBeUndefined();
    expect(prodCfg.oAuthClientId).toBeUndefined();

    // Bundled config containing projectId "al-madina-electronics" with empty Web SDK fields
    // merges cleanly with VITE_FIREBASE_* env vars even if VITE_FIREBASE_PROJECT_ID is omitted
    const emptyBundledMergedCfg = resolveFirebaseConfig(
      {
        VITE_FIREBASE_API_KEY: 'AIzaExternalKey999',
        VITE_FIREBASE_APP_ID: '1:1056981234846:web:merged',
        VITE_FIREBASE_MESSAGING_SENDER_ID: '1056981234846',
      },
      {
        projectId: 'al-madina-electronics',
        apiKey: '',
        authDomain: '',
        storageBucket: '',
        messagingSenderId: '',
        appId: '',
      }
    );
    expect(emptyBundledMergedCfg.projectId).toBe('al-madina-electronics');
    expect(emptyBundledMergedCfg.apiKey).toBe('AIzaExternalKey999');
    expect(emptyBundledMergedCfg.authDomain).toBe('al-madina-electronics.firebaseapp.com');
    expect(emptyBundledMergedCfg.storageBucket).toBe('al-madina-electronics.firebasestorage.app');
    expect(emptyBundledMergedCfg.appId).toBe('1:1056981234846:web:merged');
    expect(getFirebaseMissingFields(emptyBundledMergedCfg)).toEqual([]);

    // Empty bundled config + empty env explicitly reports all missing VITE_FIREBASE_* fields
    const unconfiguredCfg = resolveFirebaseConfig({}, { projectId: 'al-madina-electronics', apiKey: '', authDomain: '', appId: '' });
    expect(getFirebaseMissingFields(unconfiguredCfg)).toEqual(['VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_APP_ID']);

    // Malformed shell-style quoted/comma env vars fall back cleanly to firebase-applet-config.json
    const malformedFallbackCfg = resolveFirebaseConfig({
      VITE_FIREBASE_PROJECT_ID: '"al-madina-electronics",',
      VITE_FIREBASE_API_KEY: '"AIzaBroken",',
    });
    expect(malformedFallbackCfg.projectId).toBe('gen-lang-client-0548186480');

    // Clean production snapshot should have 0 fabricated records
    clearToProductionEmpty();
    const emptySnap = getDatabaseSnapshot();
    expect(emptySnap.customers).toHaveLength(0);
    expect(emptySnap.products).toHaveLength(0);
    expect(emptySnap.sales).toHaveLength(0);

    // Seed real records in production mode: verify memory snapshot has records and localStorage has ZERO production data
    const { customer, product } = seedCleanFixtures();
    expect(memoryStorage.size).toBe(0);
    const populatedSnap = getDatabaseSnapshot();
    expect(populatedSnap.customers).toHaveLength(1);
    expect(populatedSnap.customers[0].id).toBe(customer.id);
    expect(populatedSnap.products).toHaveLength(1);
    expect(populatedSnap.products[0].sku).toBe(product.sku);

    // Validate Excel row validation rejects invalid rows and preserves valid rows
    const custValidation = validateCustomerImport([
      { 'Full Name': 'Usman Raza', 'Mobile Phone': '0300-4455667', 'CNIC Number': '35202-9999999-1', 'Credit Limit': 150000 },
      { 'Full Name': '', 'Mobile Phone': '' },
    ]);
    expect(custValidation.validRows).toHaveLength(1);
    expect(custValidation.invalidRows).toHaveLength(1);
    expect(custValidation.validRows[0].data.name).toBe('Usman Raza');

    const prodValidation = validateProductImport([
      { 'Product Name': 'Dawlance Refrigerator', Category: 'Refrigerators', Brand: 'Dawlance', 'Cost Price': 95000, 'Retail Price': 115000, 'Stock Quantity': 5 },
      { 'Product Name': 'Broken Item', 'Cost Price': 0, 'Retail Price': 0 },
    ]);
    expect(prodValidation.validRows).toHaveLength(1);
    expect(prodValidation.invalidRows).toHaveLength(1);
    expect(prodValidation.validRows[0].data.retailPrice).toBe(115000);
  });

  it('7. Prevents duplicate invoices, SKUs, and Excel import rows while supporting full CRUD deletes', () => {
    const { customer, supplier, product } = seedCleanFixtures();

    // Duplicate SKU on new product ID is rejected
    expect(() =>
      saveProduct({
        ...product,
        id: 'PROD-DUPE-SKU',
        sku: 'hae-18hft',
      })
    ).toThrow(/Duplicate SKU/i);

    // Purchase invoice created once; duplicate invoiceNumber rejected cleanly without double-stocking
    createPurchaseInvoice({
      invoiceNumber: 'PINV-UNIQ-1',
      supplierId: supplier.id,
      supplierName: supplier.companyName,
      date: '2026-11-12',
      items: [
        {
          productId: product.id,
          productName: product.name,
          brand: product.brand,
          modelNumber: product.modelNumber,
          quantity: 5,
          purchasePrice: 50000,
          total: 250000,
        },
      ],
      subTotal: 250000,
      discount: 0,
      tax: 0,
      freightCharges: 0,
      grandTotal: 250000,
      paidAmount: 250000,
      remainingBalance: 0,
      paymentMethod: 'Cash',
      status: 'Received',
    });

    expect(() =>
      createPurchaseInvoice({
        invoiceNumber: 'PINV-UNIQ-1',
        supplierId: supplier.id,
        supplierName: supplier.companyName,
        date: '2026-11-12',
        items: [
          {
            productId: product.id,
            productName: product.name,
            brand: product.brand,
            modelNumber: product.modelNumber,
            quantity: 5,
            purchasePrice: 50000,
            total: 250000,
          },
        ],
        subTotal: 250000,
        discount: 0,
        tax: 0,
        freightCharges: 0,
        grandTotal: 250000,
        paidAmount: 250000,
        remainingBalance: 0,
        paymentMethod: 'Cash',
        status: 'Received',
      })
    ).toThrow(/Duplicate Purchase Invoice/i);
    expect(getProductById(product.id)?.stockQuantity).toBe(5);

    // Sales invoice created once; duplicate invoiceNumber rejected cleanly
    createSalesInvoice({
      invoiceNumber: 'INV-UNIQ-1',
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      saleType: 'Cash',
      date: '2026-11-12',
      items: [
        {
          productId: product.id,
          productName: product.name,
          brand: product.brand,
          modelNumber: product.modelNumber,
          quantity: 2,
          unitPrice: 70000,
          costPrice: 50000,
          discount: 0,
          total: 140000,
        },
      ],
      subTotal: 140000,
      discount: 0,
      tax: 0,
      grandTotal: 140000,
      paidAmount: 140000,
      changeAmount: 0,
      remainingBalance: 0,
      paymentMethod: 'Cash',
      salesPerson: 'Cashier',
    });

    expect(() =>
      createSalesInvoice({
        invoiceNumber: 'INV-UNIQ-1',
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        saleType: 'Cash',
        date: '2026-11-12',
        items: [
          {
            productId: product.id,
            productName: product.name,
            brand: product.brand,
            modelNumber: product.modelNumber,
            quantity: 2,
            unitPrice: 70000,
            costPrice: 50000,
            discount: 0,
            total: 140000,
          },
        ],
        subTotal: 140000,
        discount: 0,
        tax: 0,
        grandTotal: 140000,
        paidAmount: 140000,
        changeAmount: 0,
        remainingBalance: 0,
        paymentMethod: 'Cash',
        salesPerson: 'Cashier',
      })
    ).toThrow(/Duplicate Sales Invoice/i);
    expect(getProductById(product.id)?.stockQuantity).toBe(3);

    // Excel duplicate row checks
    const dupCustCheck = validateCustomerImport([
      { 'Full Name': 'Ali One', 'Mobile Phone': '0300-8889990', 'CNIC Number': '35202-1111111-1' },
      { 'Full Name': 'Ali Duplicate', 'Mobile Phone': '0300-8889990', 'CNIC Number': '35202-2222222-2' },
    ]);
    expect(dupCustCheck.validRows).toHaveLength(1);
    expect(dupCustCheck.invalidRows).toHaveLength(1);
    expect(dupCustCheck.invalidRows[0].errors[0]).toMatch(/Duplicate Mobile Phone/i);

    const dupProdCheck = validateProductImport([
      { 'Product Name': 'Item A', SKU: 'SKU-DUP-1', 'Cost Price': 1000, 'Retail Price': 1500 },
      { 'Product Name': 'Item B', SKU: 'sku-dup-1', 'Cost Price': 2000, 'Retail Price': 2500 },
    ]);
    expect(dupProdCheck.validRows).toHaveLength(1);
    expect(dupProdCheck.invalidRows).toHaveLength(1);
    expect(dupProdCheck.invalidRows[0].errors[0]).toMatch(/Duplicate SKU/i);

    // Full CRUD deletes remove records cleanly
    saveTask({
      id: 'TSK-TEST-1',
      title: 'Check AC Inventory',
      description: 'Verify compressor tags',
      assignedTo: 'Floor Manager',
      assignedBy: 'Owner',
      category: 'Stock & Warehouse',
      priority: 'High',
      dueDate: '2026-11-20',
      progressPercent: 10,
      status: 'Pending',
      createdAt: '2026-11-12',
    });
    expect(getTasks().some(t => t.id === 'TSK-TEST-1')).toBe(true);
    deleteTask('TSK-TEST-1');
    expect(getTasks().some(t => t.id === 'TSK-TEST-1')).toBe(false);

    deleteCustomer(customer.id);
    expect(getCustomerById(customer.id)).toBeUndefined();
    deleteProduct(product.id);
    expect(getProductById(product.id)).toBeUndefined();
    deleteSupplier(supplier.id);
    expect(getSupplierById(supplier.id)).toBeUndefined();
  });

  it('8. Matches canonical SHA-256 checksums across .xlsx export/import round-trip and preserves newer records on recovery', async () => {
    const { customer, product } = seedCleanFixtures();
    const snapshot = getDatabaseSnapshot();
    const { wb, normalizedSnapshot, recordCount } = buildBackupWorkbook(snapshot);
    const exportedChecksum = await computeCanonicalSnapshotChecksum(normalizedSnapshot);

    const metaSheet = XLSX.utils.json_to_sheet([
      {
        exportedAt: '2026-11-15T10:00:00.000Z',
        recordCount,
        checksum: exportedChecksum,
        version: '2.6-enterprise',
        settingsJson: JSON.stringify(normalizedSnapshot.settings || {}),
      },
    ]);
    XLSX.utils.book_append_sheet(wb, metaSheet, '_BackupMeta');

    const xlsxArray = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const parsed = await parseBackupWorkbookBuffer(xlsxArray);

    expect(parsed.expectedChecksum).toBe(exportedChecksum);
    expect(parsed.checksum).toBe(exportedChecksum);
    expect(parsed.recordCount).toBe(recordCount);

    // Simulate newer edits occurring after backup snapshot was taken
    saveCustomer({
      ...customer,
      name: 'Bilal Ahmed (Newer Cloud Edit)',
      creditLimit: 900000,
    });
    const newerUpdatedAt = new Date(Date.now() + 60_000).toISOString();
    saveCustomer({
      ...getCustomerById(customer.id)!,
      updatedAt: newerUpdatedAt,
    } as Customer);

    // Delete product locally to verify recovery brings back missing record WITHOUT overwriting newer customer
    deleteProduct(product.id);
    expect(getProductById(product.id)).toBeUndefined();

    const restoredOk = importDatabaseJSON(JSON.stringify(parsed.snapshot));
    expect(restoredOk).toBe(true);
    expect(getProductById(product.id)?.sku).toBe(product.sku);
    expect(getCustomerById(customer.id)?.name).toBe('Bilal Ahmed (Newer Cloud Edit)');
    expect(getCustomerById(customer.id)?.creditLimit).toBe(900000);
  });

  it('9. Maps Firebase login errors clearly and disables demo mode fallback', () => {
    expect(isDemoMode()).toBe(false);
    expect(mapFirebaseAuthError({ code: 'auth/invalid-email' }, 'email')).toContain('Invalid Email');
    expect(mapFirebaseAuthError({ code: 'auth/wrong-password' }, 'email')).toContain('Wrong Password');
    expect(mapFirebaseAuthError({ code: 'auth/invalid-credential' }, 'email')).toContain('Wrong Password');
    expect(mapFirebaseAuthError({ code: 'auth/popup-closed-by-user' }, 'google')).toContain('Google Sign-In Failed');
    expect(mapFirebaseAuthError({ code: 'auth/network-request-failed' }, 'email')).toContain('Network Error');
    expect(mapFirebaseAuthError({ code: 'auth/configuration-missing' }, 'email')).toContain('Firebase Configuration Missing');

    // Stripped bundled config ({}) + stale gen-lang-client authDomain still locks to al-madina-electronics.firebaseapp.com
    const strippedProdCfg = resolveFirebaseConfig(
      {
        VITE_FIREBASE_PROJECT_ID: 'al-madina-electronics',
        VITE_FIREBASE_AUTH_DOMAIN: 'gen-lang-client-0548186480.firebaseapp.com',
        VITE_FIREBASE_API_KEY: 'AIzaProdOnlyKey',
        VITE_FIREBASE_APP_ID: '1:999:web:prod',
      },
      {}
    );
    expect(strippedProdCfg.projectId).toBe('al-madina-electronics');
    expect(strippedProdCfg.authDomain).toBe('al-madina-electronics.firebaseapp.com');
    expect(strippedProdCfg.storageBucket).toBe('al-madina-electronics.firebasestorage.app');
    expect(strippedProdCfg.firestoreDatabaseId).toBeUndefined();

    // Summary never exposes raw apiKey secret
    const summary = getPublicFirebaseSummary();
    expect(summary).not.toHaveProperty('apiKey');
    expect(typeof summary.apiKeyConfigured).toBe('boolean');
  });

  it('10. Rejects negative stock for non-Owners and allows explicit Owner negative stock override with audit note', () => {
    const { customer, product } = seedCleanFixtures();
    saveProduct({ ...product, stockQuantity: 2 });

    // Non-Owner cannot adjust or sell below 0 even if allowNegativeStock is passed
    setActiveUser({
      id: 'cashier-1',
      uid: 'cashier-1',
      name: 'Cashier Ali',
      email: 'cashier@almadina.pk',
      role: 'Cashier',
      phone: '0300-0000001',
      active: true,
      lastLogin: '2026-11-15',
    });

    expect(() => adjustProductStock(product.id, -5, 'Unauthorized reduction')).toThrow(/Insufficient stock/i);
    expect(() =>
      adjustProductStock(product.id, -5, 'Unauthorized override attempt', { allowNegativeStock: true })
    ).toThrow(/Insufficient stock/i);

    expect(() =>
      createSalesInvoice(
        {
          invoiceNumber: 'INV-NEG-FAIL',
          customerId: customer.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          saleType: 'Cash',
          date: '2026-11-15',
          items: [
            {
              productId: product.id,
              productName: product.name,
              brand: product.brand,
              modelNumber: product.modelNumber,
              quantity: 5,
              unitPrice: 70000,
              costPrice: 50000,
              discount: 0,
              total: 350000,
            },
          ],
          subTotal: 350000,
          discount: 0,
          tax: 0,
          grandTotal: 350000,
          paidAmount: 350000,
          changeAmount: 0,
          remainingBalance: 0,
          paymentMethod: 'Cash',
          salesPerson: 'Cashier Ali',
        },
        { allowNegativeStock: true }
      )
    ).toThrow(/Insufficient stock/i);
    expect(getProductById(product.id)?.stockQuantity).toBe(2);

    // Owner override succeeds cleanly and records [Owner Negative Stock Override]
    setActiveUser({
      id: 'owner-1',
      uid: 'owner-1',
      name: 'Owner Al-Madina',
      email: 'clientbridge28@gmail.com',
      role: 'Owner',
      phone: '0300-0000000',
      active: true,
      lastLogin: '2026-11-15',
    });

    const adj = adjustProductStock(product.id, -5, 'Owner count override', { allowNegativeStock: true });
    expect(adj?.newQty).toBe(-3);
    expect(getProductById(product.id)?.stockQuantity).toBe(-3);

    const sale = createSalesInvoice(
      {
        invoiceNumber: 'INV-NEG-OK',
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        saleType: 'Cash',
        date: '2026-11-15',
        items: [
          {
            productId: product.id,
            productName: product.name,
            brand: product.brand,
            modelNumber: product.modelNumber,
            quantity: 2,
            unitPrice: 70000,
            costPrice: 50000,
            discount: 0,
            total: 140000,
          },
        ],
        subTotal: 140000,
        discount: 0,
        tax: 0,
        grandTotal: 140000,
        paidAmount: 140000,
        changeAmount: 0,
        remainingBalance: 0,
        paymentMethod: 'Cash',
        salesPerson: 'Owner Al-Madina',
      },
      { allowNegativeStock: true }
    );
    expect(sale.notes).toContain('[Owner Negative Stock Override]');
    expect(getProductById(product.id)?.stockQuantity).toBe(-5);
  });

  it('11. Supports double-entry voucher reversal and restores standalone customer/supplier balances', () => {
    const { customer, supplier, product } = seedCleanFixtures();
    saveProduct({ ...product, stockQuantity: 10 });

    // Credit sale leaves 100,000 customer receivable
    createSalesInvoice({
      invoiceNumber: 'INV-REV-1',
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      saleType: 'Credit',
      date: '2026-11-10',
      items: [
        {
          productId: product.id,
          productName: product.name,
          brand: product.brand,
          modelNumber: product.modelNumber,
          quantity: 2,
          unitPrice: 70000,
          costPrice: 50000,
          discount: 0,
          total: 140000,
        },
      ],
      subTotal: 140000,
      discount: 0,
      tax: 0,
      grandTotal: 140000,
      paidAmount: 40000,
      changeAmount: 0,
      remainingBalance: 100000,
      paymentMethod: 'Cash',
      salesPerson: 'Admin',
    });
    expect(getCustomerById(customer.id)?.currentBalance).toBe(100000);

    const cashBeforeReceipt = getChartOfAccounts().find(a => a.id === ACCOUNT_IDS.CASH)?.currentBalance || 0;

    // Standalone Receive Voucher for 25,000 reduces customer receivable to 75,000
    const rv = createVoucher({
      voucherNumber: 'RV-TEST-1',
      date: '2026-11-11',
      voucherType: 'Receive Voucher',
      partyId: customer.id,
      partyType: 'Customer',
      partyName: customer.name,
      paymentMethod: 'Cash',
      amount: 25000,
      narration: 'Cash recovery from customer',
      entries: [
        { accountId: ACCOUNT_IDS.CASH, accountName: 'Cash in Hand', debit: 25000, credit: 0 },
        { accountId: ACCOUNT_IDS.ACCOUNTS_RECEIVABLE, accountName: 'Accounts Receivable', debit: 0, credit: 25000 },
      ],
    });
    expect(getCustomerById(customer.id)?.currentBalance).toBe(75000);
    expect(getChartOfAccounts().find(a => a.id === ACCOUNT_IDS.CASH)?.currentBalance).toBe(cashBeforeReceipt + 25000);

    // Reverse the Receive Voucher: cancels original, restores Cash & Customer Balance back to 100,000
    const reversal = reverseVoucher(rv.id, 'Wrong customer selected');
    expect(sumVoucherSides(reversal.entries).isBalanced).toBe(true);
    expect(getVouchers().find(v => v.id === rv.id)?.status).toBe('Cancelled');
    expect(getVouchers().find(v => v.id === rv.id)?.reversedByVoucherId).toBe(reversal.id);
    expect(getCustomerById(customer.id)?.currentBalance).toBe(100000);
    expect(getChartOfAccounts().find(a => a.id === ACCOUNT_IDS.CASH)?.currentBalance).toBe(cashBeforeReceipt);
    expect(() => reverseVoucher(rv.id, 'Duplicate reversal')).toThrow(/already been reversed/i);

    // Standalone Supplier Payment Voucher + reversal
    createPurchaseInvoice({
      invoiceNumber: 'PINV-REV-1',
      supplierId: supplier.id,
      supplierName: supplier.companyName,
      date: '2026-11-10',
      items: [
        {
          productId: product.id,
          productName: product.name,
          brand: product.brand,
          modelNumber: product.modelNumber,
          quantity: 2,
          purchasePrice: 50000,
          total: 100000,
        },
      ],
      subTotal: 100000,
      discount: 0,
      tax: 0,
      freightCharges: 0,
      grandTotal: 100000,
      paidAmount: 0,
      remainingBalance: 100000,
      paymentMethod: 'Cash',
      status: 'Received',
    });
    expect(getSupplierById(supplier.id)?.currentBalance).toBe(100000);

    const pv = createVoucher({
      voucherNumber: 'PV-TEST-1',
      date: '2026-11-12',
      voucherType: 'Payment Voucher',
      partyId: supplier.id,
      partyType: 'Supplier',
      partyName: supplier.companyName,
      paymentMethod: 'Cash',
      amount: 40000,
      narration: 'Supplier installment payment',
      entries: [
        { accountId: ACCOUNT_IDS.ACCOUNTS_PAYABLE, accountName: 'Accounts Payable', debit: 40000, credit: 0 },
        { accountId: ACCOUNT_IDS.CASH, accountName: 'Cash in Hand', debit: 0, credit: 40000 },
      ],
    });
    expect(getSupplierById(supplier.id)?.currentBalance).toBe(60000);
    reverseVoucher(pv.id, 'Cheque issued instead');
    expect(getSupplierById(supplier.id)?.currentBalance).toBe(100000);
  });

  it('12. Builds chronological Customer & Supplier ledgers with standalone vouchers and bounced cheques matching balances', () => {
    const { customer, supplier, product } = seedCleanFixtures();
    saveProduct({ ...product, stockQuantity: 10 });

    createPurchaseInvoice({
      invoiceNumber: 'PINV-LED-1',
      supplierId: supplier.id,
      supplierName: supplier.companyName,
      date: '2026-11-02',
      items: [
        {
          productId: product.id,
          productName: product.name,
          brand: product.brand,
          modelNumber: product.modelNumber,
          quantity: 2,
          purchasePrice: 50000,
          total: 100000,
        },
      ],
      subTotal: 100000,
      discount: 0,
      tax: 0,
      freightCharges: 0,
      grandTotal: 100000,
      paidAmount: 20000,
      remainingBalance: 80000,
      paymentMethod: 'Bank Transfer',
      status: 'Received',
    });

    createVoucher({
      voucherNumber: 'PV-LED-1',
      date: '2026-11-05',
      voucherType: 'Payment Voucher',
      partyId: supplier.id,
      partyType: 'Supplier',
      partyName: supplier.companyName,
      paymentMethod: 'Bank',
      amount: 30000,
      narration: 'Mid-month supplier settlement',
      entries: [
        { accountId: ACCOUNT_IDS.ACCOUNTS_PAYABLE, accountName: 'Accounts Payable', debit: 30000, credit: 0 },
        { accountId: ACCOUNT_IDS.MEEZAN_BANK, accountName: 'Meezan Bank', debit: 0, credit: 30000 },
      ],
    });

    const suppLedger = getSupplierLedgerEntries(supplier.id);
    expect(suppLedger[suppLedger.length - 1].balance).toBe(getSupplierById(supplier.id)?.currentBalance);
    expect(suppLedger[suppLedger.length - 1].balance).toBe(50000);

    createSalesInvoice({
      invoiceNumber: 'INV-LED-1',
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      saleType: 'Credit',
      date: '2026-11-03',
      items: [
        {
          productId: product.id,
          productName: product.name,
          brand: product.brand,
          modelNumber: product.modelNumber,
          quantity: 1,
          unitPrice: 70000,
          costPrice: 50000,
          discount: 0,
          total: 70000,
        },
      ],
      subTotal: 70000,
      discount: 0,
      tax: 0,
      grandTotal: 70000,
      paidAmount: 10000,
      changeAmount: 0,
      remainingBalance: 60000,
      paymentMethod: 'Cash',
      salesPerson: 'Admin',
    });

    createVoucher({
      voucherNumber: 'RV-LED-1',
      date: '2026-11-06',
      voucherType: 'Receive Voucher',
      partyId: customer.id,
      partyType: 'Customer',
      partyName: customer.name,
      paymentMethod: 'Cash',
      amount: 15000,
      narration: 'Standalone cash recovery',
      entries: [
        { accountId: ACCOUNT_IDS.CASH, accountName: 'Cash in Hand', debit: 15000, credit: 0 },
        { accountId: ACCOUNT_IDS.ACCOUNTS_RECEIVABLE, accountName: 'Accounts Receivable', debit: 0, credit: 15000 },
      ],
    });

    const custLedger = getCustomerLedgerEntries(customer.id);
    expect(custLedger.map(r => r.date)).toEqual([...custLedger.map(r => r.date)].sort());
    expect(custLedger[custLedger.length - 1].balance).toBe(getCustomerById(customer.id)?.currentBalance);
    expect(custLedger[custLedger.length - 1].balance).toBe(45000);
  });

  it('13. Clears cheques to specific bank, supports reconciliation, and reverses cleared cheques on bounce', () => {
    const { customer } = seedCleanFixtures();
    saveCustomer({ ...customer, currentBalance: 50000 });

    const cheque: ChequeRecord = {
      id: 'CHQ-LIFE-1',
      chequeNumber: '445566',
      type: 'Received',
      bankName: 'Bank Alfalah',
      bankAccountId: ACCOUNT_IDS.ALFALAH_BANK,
      partyId: customer.id,
      partyType: 'Customer',
      partyName: customer.name,
      amount: 30000,
      issueDate: '2026-11-10',
      chequeDate: '2026-11-11',
      status: 'Deposited',
    };
    saveCheque(cheque);

    expect(clearChequeWithAccounting(cheque.id, '2026-11-12', ACCOUNT_IDS.ALFALAH_BANK)).toBe(true);
    expect(getCustomerById(customer.id)?.currentBalance).toBe(20000);
    expect(getChartOfAccounts().find(a => a.id === ACCOUNT_IDS.ALFALAH_BANK)?.currentBalance).toBe(30000);

    expect(reconcileCheque(cheque.id, '2026-11-13', true)).toBe(true);

    // Bounce after clearance reverses bank credit & restores customer receivable
    expect(bounceChequeWithAccounting(cheque.id, '2026-11-15', 'Insufficient funds')).toBe(true);
    expect(getCustomerById(customer.id)?.currentBalance).toBe(50000);
    expect(getChartOfAccounts().find(a => a.id === ACCOUNT_IDS.ALFALAH_BANK)?.currentBalance).toBe(0);
    expect(bounceChequeWithAccounting(cheque.id, '2026-11-16', 'Already bounced')).toBe(false);
  });

  it('14. Manages warehouses, stock transfers, damaged stock entries, and chronological item stock ledger', () => {
    const { supplier, product } = seedCleanFixtures();
    const whMain = saveWarehouse({ id: 'WH-MAIN', name: 'Main Showroom', code: 'MAIN', city: 'Lahore', address: 'Hall Road', isDefault: true, active: true });
    const whGodown = saveWarehouse({ id: 'WH-GODOWN', name: 'Godown #2', code: 'GDN2', city: 'Lahore', address: 'Peco Road', active: true });

    saveProduct({
      ...product,
      openingStock: 4,
      stockQuantity: 4,
      warehouseId: whMain.id,
      warehouseName: whMain.name,
    });

    createPurchaseInvoice({
      invoiceNumber: 'PINV-WH-1',
      supplierId: supplier.id,
      supplierName: supplier.companyName,
      date: '2026-11-05',
      items: [
        {
          productId: product.id,
          productName: product.name,
          brand: product.brand,
          modelNumber: product.modelNumber,
          quantity: 6,
          purchasePrice: 50000,
          total: 300000,
        },
      ],
      subTotal: 300000,
      discount: 0,
      tax: 0,
      freightCharges: 0,
      grandTotal: 300000,
      paidAmount: 300000,
      remainingBalance: 0,
      paymentMethod: 'Cash',
      status: 'Received',
    });

    expect(() =>
      createStockTransfer({
        transferNumber: 'STRF-BAD',
        date: '2026-11-06',
        productId: product.id,
        productName: product.name,
        quantity: 2,
        fromWarehouseId: whMain.id,
        fromWarehouseName: whMain.name,
        toWarehouseId: whMain.id,
        toWarehouseName: whMain.name,
      })
    ).toThrow(/must be different/i);

    const tr = createStockTransfer({
      transferNumber: 'STRF-1',
      date: '2026-11-06',
      productId: product.id,
      productName: product.name,
      quantity: 4,
      fromWarehouseId: whMain.id,
      fromWarehouseName: whMain.name,
      toWarehouseId: whGodown.id,
      toWarehouseName: whGodown.name,
    });
    expect(tr.quantity).toBe(4);
    expect(getProductById(product.id)?.warehouseId).toBe(whGodown.id);

    adjustProductStock(product.id, -2, 'Transit casing dent', { adjustmentType: 'Damaged' });
    expect(getProductById(product.id)?.stockQuantity).toBe(8);
    expect(getProductById(product.id)?.damagedQuantity).toBe(2);

    const ledger = getItemStockLedger(product.id);
    expect(ledger.map(r => r.type)).toEqual(['Opening Balance', 'Purchase In', 'Transfer Out', 'Damaged Out']);
    expect(ledger[ledger.length - 1].runningQty).toBe(8);
  });

  it('15. Reschedules installment plans while preserving paid installments and tracks customer commitments', () => {
    const { customer, product } = seedCleanFixtures();
    const account = createInstallmentAccount({
      accountNumber: 'INST-RES-1',
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerCnic: customer.cnic,
      customerAddress: customer.address,
      locationSector: 'Johar Town',
      mobile2: '0333-1122334',
      profession: 'Government Employee',
      referenceName: 'Haji Akram',
      slipNo: 'SLP-901',
      productId: product.id,
      productName: product.name,
      productModel: product.modelNumber,
      salesInvoiceNo: 'INV-RES-1',
      cashPrice: 70000,
      downPayment: 10000,
      financedAmount: 60000,
      markupPercentage: 20,
      markupAmount: 12000,
      totalFinancedPayable: 72000,
      totalPayableWithDown: 82000,
      durationMonths: 6,
      monthlyInstallment: 12000,
      startDate: '2026-11-01',
      firstDueDate: '2026-12-01',
      guarantor1Name: 'Zain Ali',
      guarantor1Phone: '0300-5554443',
      guarantor1Cnic: '35202-2223334-1',
      guarantor1Relation: 'Brother',
      guarantor2Name: 'Nadeem Tariq',
      guarantor2Phone: '0322-7776665',
      guarantor2Cnic: '35202-8889990-1',
      guarantor2Relation: 'Colleague',
      recoveryOfficerId: 'EMP-2',
      recoveryOfficerName: 'Salman',
      schedule: Array.from({ length: 6 }, (_, idx) => ({
        installmentNumber: idx + 1,
        dueDate: `2027-0${idx + 1}-01`,
        principalAmount: 10000,
        markupAmount: 2000,
        totalDue: 12000,
        paidAmount: 0,
        remainingAmount: 12000,
        status: 'Upcoming',
      })),
    });

    receiveInstallmentPayment(account.id, 12000, 'Cash', 'Paid installment #1');
    const rescheduled = rescheduleInstallmentPlan(account.id, 5, '2027-03-01', 'Salary cycle changed');
    expect(rescheduled.schedule).toHaveLength(6);
    expect(rescheduled.schedule[0].status).toBe('Paid');
    expect(rescheduled.schedule[1].dueDate).toBe('2027-03-01');
    expect(rescheduled.rescheduleHistory).toHaveLength(1);
    const pendingSum = rescheduled.schedule
      .filter(s => s.status !== 'Paid')
      .reduce((sum, s) => sum + s.remainingAmount, 0);
    expect(pendingSum).toBe(60000);

    const cmt = saveInstallmentCommitment({
      installmentAccountId: account.id,
      accountNumber: account.accountNumber,
      customerId: customer.id,
      customerName: account.customerName,
      customerPhone: account.customerPhone,
      commitmentDate: '2027-02-28',
      promisedAmount: 12000,
      officerName: 'Salman',
      remarks: 'Promised transfer before month end',
      status: 'Pending',
    });
    expect(getInstallmentCommitments()).toHaveLength(1);
    updateCommitmentStatus(cmt.id, 'Fulfilled');
    expect(getInstallmentCommitments()[0].status).toBe('Fulfilled');
  });

  it('16. Produces balanced Head-Wise Trial Balance, Balance Sheet, Cash Flow, Cash/Bank Books, and General Ledger', () => {
    const { customer, supplier, product } = seedCleanFixtures();
    saveProduct({ ...product, stockQuantity: 0 });

    createPurchaseInvoice({
      invoiceNumber: 'PINV-FS-1',
      supplierId: supplier.id,
      supplierName: supplier.companyName,
      date: '2026-11-01',
      items: [
        {
          productId: product.id,
          productName: product.name,
          brand: product.brand,
          modelNumber: product.modelNumber,
          quantity: 5,
          purchasePrice: 50000,
          total: 250000,
        },
      ],
      subTotal: 250000,
      discount: 0,
      tax: 0,
      freightCharges: 0,
      grandTotal: 250000,
      paidAmount: 100000,
      remainingBalance: 150000,
      paymentMethod: 'Bank Transfer',
      status: 'Received',
    });

    createSalesInvoice({
      invoiceNumber: 'INV-FS-1',
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      saleType: 'Cash',
      date: '2026-11-05',
      items: [
        {
          productId: product.id,
          productName: product.name,
          brand: product.brand,
          modelNumber: product.modelNumber,
          quantity: 2,
          unitPrice: 70000,
          costPrice: 50000,
          discount: 0,
          total: 140000,
        },
      ],
      subTotal: 140000,
      discount: 0,
      tax: 0,
      grandTotal: 140000,
      paidAmount: 140000,
      changeAmount: 0,
      remainingBalance: 0,
      paymentMethod: 'Cash',
      salesPerson: 'Admin',
    });

    const trial = getHeadWiseBalanceReport();
    expect(trial.isBalanced).toBe(true);
    expect(trial.totalDebit).toBe(trial.totalCredit);

    const bs = getBalanceSheetStatement();
    expect(bs.isBalanced).toBe(true);
    expect(bs.assetsTotal).toBe(bs.liabilitiesAndEquityTotal);
    expect(bs.netIncome).toBe(40000); // 140k revenue - 100k COGS

    const cf = getCashFlowStatement();
    expect(cf.operatingInflows).toBe(140000);
    expect(cf.operatingOutflows).toBe(100000);
    expect(cf.netOperatingCashFlow).toBe(40000);

    const cashBook = getCashBookEntries();
    expect(cashBook).toHaveLength(1);
    expect(cashBook[0].runningBalance).toBe(140000);

    const bankBook = getBankBookEntries(ACCOUNT_IDS.MEEZAN_BANK);
    expect(bankBook).toHaveLength(1);
    expect(bankBook[0].runningBalance).toBe(-100000);

    const gl = getGeneralLedgerEntries();
    expect(gl.length).toBeGreaterThanOrEqual(4);
  });

  it('17. Populates all 10 Inventory report datasets and all 20 Installment report datasets accurately', () => {
    const { customer, product } = seedCleanFixtures();
    saveWarehouse({ id: 'WH-1', name: 'Main Showroom', code: 'MAIN', city: 'Lahore', address: 'Hall Road', isDefault: true, active: true });

    saveProduct({
      ...product,
      openingStock: 2,
      stockQuantity: 1,
      reorderLevel: 3,
      wholesalePrice: 63000,
      warehouseId: 'WH-1',
      warehouseName: 'Main Showroom',
      damagedQuantity: 1,
      serials: [
        {
          serialNumber: 'SN-1001',
          productId: product.id,
          productName: product.name,
          condition: 'Brand New',
          purchaseCost: 50000,
          purchaseDate: '2026-11-01',
          status: 'In Stock',
          warrantyMonths: 120,
        },
      ],
    });

    saveProduct({
      ...product,
      id: 'PROD-OOS-1',
      name: 'Orient 18 Cu.Ft Fridge',
      sku: 'ORI-FR-18',
      stockQuantity: 0,
      minStockLevel: 2,
      reorderLevel: 2,
      serials: [],
    });

    const invReports = getInventoryReportsData();
    expect(invReports.stockValuation).toHaveLength(2);
    expect(invReports.brandWise).toHaveLength(1);
    expect(invReports.categoryWise).toHaveLength(1);
    expect(invReports.lowStockReorder).toHaveLength(2);
    expect(invReports.outOfStock).toHaveLength(1);
    expect(invReports.serializedUnits).toHaveLength(1);
    expect(invReports.damagedAndReturned).toHaveLength(1);
    expect(invReports.stockMovementSummary).toHaveLength(2);
    expect(invReports.warehouseWiseStock.length).toBeGreaterThanOrEqual(1);
    expect(invReports.marginAndPricingAnalysis).toHaveLength(2);

    const inst = createInstallmentAccount({
      accountNumber: 'INST-RPT-1',
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerCnic: customer.cnic,
      customerAddress: customer.address,
      locationSector: 'DHA Phase 5',
      productId: product.id,
      productName: product.name,
      productModel: product.modelNumber,
      salesInvoiceNo: 'INV-RPT-1',
      cashPrice: 70000,
      downPayment: 10000,
      financedAmount: 60000,
      markupPercentage: 20,
      markupAmount: 12000,
      totalFinancedPayable: 72000,
      totalPayableWithDown: 82000,
      durationMonths: 3,
      monthlyInstallment: 24000,
      startDate: '2026-11-01',
      firstDueDate: '2026-12-01',
      guarantor1Name: 'Zain Ali',
      guarantor1Phone: '0300-5554443',
      guarantor1Cnic: '35202-2223334-1',
      guarantor1Relation: 'Brother',
      guarantor2Name: 'Tariq Aziz',
      guarantor2Phone: '0321-4445556',
      guarantor2Cnic: '35202-3334445-1',
      guarantor2Relation: 'Neighbor',
      recoveryOfficerId: 'EMP-2',
      recoveryOfficerName: 'Salman',
      schedule: [
        { installmentNumber: 1, dueDate: '2026-12-01', principalAmount: 20000, markupAmount: 4000, totalDue: 24000, paidAmount: 0, remainingAmount: 24000, status: 'Overdue' },
        { installmentNumber: 2, dueDate: '2027-01-15', principalAmount: 20000, markupAmount: 4000, totalDue: 24000, paidAmount: 0, remainingAmount: 24000, status: 'Upcoming' },
        { installmentNumber: 3, dueDate: '2027-02-01', principalAmount: 20000, markupAmount: 4000, totalDue: 24000, paidAmount: 0, remainingAmount: 24000, status: 'Upcoming' },
      ],
    });
    expect(inst.accountNumber).toBe('INST-RPT-1');

    const instReports = getInstallmentReportsData('2027-01-15');
    expect(Object.keys(instReports)).toHaveLength(20);
    expect(instReports.activeAccounts).toHaveLength(1);
    expect(instReports.dueToday).toHaveLength(1);
    expect(instReports.upcomingDues).toHaveLength(2);
    expect(instReports.guarantorDirectory[0].guarantor2Name).toBe('Tariq Aziz');
    expect(instReports.sectorWiseDistribution[0].sector).toBe('DHA Phase 5');
    expect(instReports.agingBuckets.some(b => b.count > 0)).toBe(true);
    expect(instReports.riskExposureReport[0].riskTier).toBe('MEDIUM');
  });

  it('18. Strips disallowed id fields on settings and users_public Firestore payloads while keeping id on normal collections', () => {
    const settingsPayload = buildCloudDocPayload('settings', 'main', {
      id: 'main',
      showroomName: 'Al-Madina Electronics',
      ownerName: 'Owner',
      currency: 'PKR',
      printFormat: 'A4',
      notes: undefined,
    });
    expect('id' in settingsPayload).toBe(false);
    expect('notes' in settingsPayload).toBe(false);
    expect(settingsPayload.orgId).toBe('al-madina-main');

    const userPublicPayload = buildCloudDocPayload('users_public', 'uid-123', {
      id: 'uid-123',
      uid: 'uid-123',
      name: 'Salman',
      role: 'Cashier',
      active: true,
    });
    expect('id' in userPublicPayload).toBe(false);
    expect(userPublicPayload.uid).toBe('uid-123');
    expect(userPublicPayload.orgId).toBe('al-madina-main');

    const productPayload = buildCloudDocPayload('products', 'PROD 1', {
      name: 'Inverter AC',
    });
    expect(productPayload.id).toBe('PROD-1');
    expect(productPayload.orgId).toBe('al-madina-main');

    applyCloudCollectionSnapshot('settings', [{ id: 'main', showroomName: 'Al-Madina Showroom', ownerName: 'Owner', currency: 'PKR', printFormat: 'A4' }]);
    const hydratedSettings = getSettings() as unknown as Record<string, unknown>;
    expect('id' in hydratedSettings).toBe(false);
    expect(hydratedSettings.showroomName).toBe('Al-Madina Showroom');

    saveSettings({ ...getSettings(), showroomName: 'Al-Madina Updated' });
    const savedSettings = getSettings() as unknown as Record<string, unknown>;
    expect('id' in savedSettings).toBe(false);
    expect(savedSettings.showroomName).toBe('Al-Madina Updated');
  });

  it('19. Keeps settings intact regardless of snapshot arrival order and preserves integer stock quantities', () => {
    const accountsInput = [
      { id: 'ACC-201', orgId: 'al-madina-main', code: '2001', name: 'Accounts Payable', category: 'Liability' as const, subCategory: 'Current Liability', currentBalance: 0 },
      { id: 'ACC-101', orgId: 'al-madina-main', code: '1001', name: 'Cash in Hand', category: 'Asset' as const, subCategory: 'Cash', currentBalance: 5000 },
    ];
    const snapshotCopy = [...accountsInput];
    applyCloudCollectionSnapshot('accounts', snapshotCopy);
    expect(snapshotCopy[0].code).toBe('2001'); // caller array not mutated
    expect(getChartOfAccounts()[0].code).toBe('1001');

    applyCloudCollectionSnapshot('settings', [{
      showroomName: 'Al-Madina Flagship Showroom',
      ownerName: 'Tariq Khan',
      currency: 'PKR',
      printFormat: 'Thermal',
    }]);
    expect(getSettings().showroomName).toBe('Al-Madina Flagship Showroom');
    expect(getSettings().printFormat).toBe('Thermal');

    const { supplier, customer, product } = seedCleanFixtures();
    const pur = createPurchaseInvoice({
      invoiceNumber: 'PUR-INT-1',
      supplierId: supplier.id,
      supplierName: supplier.companyName,
      date: '2026-11-20',
      items: [{
        productId: product.id,
        productName: product.name,
        brand: product.brand,
        modelNumber: product.modelNumber,
        quantity: 4,
        purchasePrice: 50000,
        total: 200000,
      }],
      subTotal: 200000,
      discount: 0,
      tax: 0,
      freightCharges: 0,
      grandTotal: 200000,
      paidAmount: 200000,
      remainingBalance: 0,
      paymentMethod: 'Cash',
      status: 'Received',
    });
    expect(pur.invoiceNumber).toBe('PUR-INT-1');
    expect(Number.isInteger(getProductById(product.id)?.stockQuantity)).toBe(true);

    const sale = createSalesInvoice({
      invoiceNumber: 'INV-INT-1',
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      saleType: 'Cash',
      date: '2026-11-21',
      items: [{ productId: product.id, productName: product.name, brand: product.brand, modelNumber: product.modelNumber, quantity: 2, unitPrice: 70000, costPrice: 50000, discount: 0, total: 140000 }],
      subTotal: 140000,
      discount: 0,
      tax: 0,
      grandTotal: 140000,
      paidAmount: 140000,
      changeAmount: 0,
      remainingBalance: 0,
      paymentMethod: 'Cash',
      salesPerson: 'Admin',
    });
    createSalesReturn({
      returnNumber: 'SRTN-INT-1',
      originalInvoiceNo: sale.invoiceNumber,
      customerId: customer.id,
      customerName: customer.name,
      date: '2026-11-22',
      items: [{ productId: product.id, productName: product.name, quantity: 1, unitPrice: 70000, total: 70000, reason: 'Defective fan blade' }],
      grandTotal: 70000,
      refundMethod: 'Cash',
      remarks: 'Defective fan blade',
    });
    expect(getProductById(product.id)?.stockQuantity).toBe(3);
    expect(Number.isInteger(getProductById(product.id)?.stockQuantity)).toBe(true);
  });

  it('20. Renders POSReceiptPrintLayout cleanly for both A4 and Thermal formats and tracks user activity logs in descending order', () => {
    const { customer, supplier, product } = seedCleanFixtures();

    createPurchaseInvoice({
      invoiceNumber: 'PINV-PRT-1',
      supplierId: supplier.id,
      supplierName: supplier.companyName,
      date: '2026-11-24',
      items: [{
        productId: product.id,
        productName: product.name,
        brand: product.brand,
        modelNumber: product.modelNumber,
        quantity: 2,
        purchasePrice: 50000,
        total: 100000,
      }],
      subTotal: 100000,
      discount: 0,
      tax: 0,
      freightCharges: 0,
      grandTotal: 100000,
      paidAmount: 100000,
      remainingBalance: 0,
      paymentMethod: 'Cash',
      status: 'Received',
    });

    const invoice = createSalesInvoice({
      invoiceNumber: 'INV-PRT-99',
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      saleType: 'Cash',
      date: '2026-11-25',
      items: [{
        productId: product.id,
        productName: product.name,
        brand: product.brand,
        modelNumber: product.modelNumber,
        quantity: 1,
        unitPrice: 70000,
        costPrice: 50000,
        discount: 0,
        total: 70000,
        selectedSerial: 'SN-AC-9901',
      }],
      subTotal: 70000,
      discount: 2000,
      tax: 0,
      grandTotal: 68000,
      paidAmount: 68000,
      changeAmount: 0,
      remainingBalance: 0,
      paymentMethod: 'Cash',
      salesPerson: 'Cashier',
      notes: '1 Year Compressor Warranty Card Issued',
    });

    const settings = getSettings();
    const a4Html = renderToStaticMarkup(
      React.createElement(POSReceiptPrintLayout, {
        invoice,
        settings,
        format: 'A4',
      })
    );
    expect(a4Html).toContain('SALES INVOICE');
    expect(a4Html).toContain('INV-PRT-99');
    expect(a4Html).toContain('SN-AC-9901');
    expect(a4Html).toContain('68,000');
    expect(a4Html).toContain('1 Year Compressor Warranty Card Issued');

    const thermalHtml = renderToStaticMarkup(
      React.createElement(POSReceiptPrintLayout, {
        invoice,
        settings,
        format: 'Thermal',
      })
    );
    expect(thermalHtml).toContain('thermal-receipt-sheet');
    expect(thermalHtml).toContain('CASH SALE RECEIPT');
    expect(thermalHtml).toContain('INV-PRT-99');
    expect(thermalHtml).toContain('SN-AC-9901');
    expect(thermalHtml).toContain('68,000');

    logAuditAction('Settings', 'Update WooCommerce Configuration', 'Configured live store sync', 'WC-1');
    const logs = getAuditLogs();
    expect(logs.length).toBeGreaterThanOrEqual(3);
    expect(logs[0].action).toBe('Update WooCommerce Configuration');
    expect(logs[0].recordId).toBe('WC-1');
    expect(logs.some(l => l.module === 'Sales & POS' && l.action === 'Post Sales Invoice')).toBe(true);
  });

  it('21. Production startup resilience: strips ai-studio named DB for al-madina-electronics, enforces bounded withTimeout, and resolves canonical Owner immediately when Firestore doc fetch falls back', async () => {
    const prodConfig = resolveFirebaseConfig(
      {
        VITE_FIREBASE_PROJECT_ID: 'al-madina-electronics',
        VITE_FIREBASE_API_KEY: 'AIzaTestProdKey123456',
        VITE_FIREBASE_AUTH_DOMAIN: 'al-madina-electronics.firebaseapp.com',
        VITE_FIREBASE_STORAGE_BUCKET: 'al-madina-electronics.firebasestorage.app',
        VITE_FIREBASE_MESSAGING_SENDER_ID: '1056981234846',
        VITE_FIREBASE_APP_ID: '1:1056981234846:web:2b679f5ce8be8db980778f',
        VITE_FIREBASE_DATABASE_ID: 'ai-studio-06024cb3-013f-4fa5-ab6e-9173e6f63150',
      },
      {
        projectId: 'gen-lang-client-0907755479',
        firestoreDatabaseId: 'ai-studio-06024cb3-013f-4fa5-ab6e-9173e6f63150',
      }
    );
    expect(prodConfig.projectId).toBe('al-madina-electronics');
    expect(prodConfig.firestoreDatabaseId).toBeUndefined();

    const sameProjectWithBundledAiStudioDb = resolveFirebaseConfig(
      {
        VITE_FIREBASE_PROJECT_ID: 'al-madina-electronics',
        VITE_FIREBASE_API_KEY: 'AIzaTestProdKey123456',
      },
      {
        projectId: 'al-madina-electronics',
        firestoreDatabaseId: 'ai-studio-06024cb3-013f-4fa5-ab6e-9173e6f63150',
      }
    );
    expect(sameProjectWithBundledAiStudioDb.firestoreDatabaseId).toBeUndefined();

    await expect(withTimeout(Promise.resolve('fast-ok'), 500, 'timed out')).resolves.toBe('fast-ok');
    await expect(
      withTimeout(new Promise<string>(() => {}), 25, 'Firestore request timed out')
    ).rejects.toThrow('Firestore request timed out');

    const ownerFallback = resolveAuthenticatedProfile(
      {
        uid: 'owner-uid-1',
        email: 'clientbridge28@gmail.com',
        displayName: 'Showroom Owner',
        phoneNumber: null,
        emailVerified: true,
      },
      null
    );
    expect(ownerFallback.allowed).toBe(true);
    if (ownerFallback.allowed) {
      expect(ownerFallback.profile.role).toBe('Owner');
      expect(ownerFallback.needsOwnerBootstrap).toBe(true);
    }

    const unprovisionedStaff = resolveAuthenticatedProfile(
      {
        uid: 'staff-uid-2',
        email: 'cashier@almadina.pk',
        displayName: 'Cashier',
        phoneNumber: null,
        emailVerified: true,
      },
      null
    );
    expect(unprovisionedStaff.allowed).toBe(false);
  });
});
