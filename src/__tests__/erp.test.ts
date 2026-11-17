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
import { computeSha256Hex, validateCustomerImport, validateProductImport } from '../services/excelService';
import { getFirebaseConfig, isFirebaseConfigured, resolveFirebaseConfig } from '../services/firebase';
import {
  clearChequeWithAccounting,
  clearToProductionEmpty,
  closeInstallmentAccountEarly,
  createInstallmentAccount,
  createPurchaseInvoice,
  createPurchaseReturn,
  createSalesInvoice,
  createSalesReturn,
  getChartOfAccounts,
  getCustomerById,
  getCustomerLedgerEntries,
  getDatabaseSnapshot,
  getItemStockLedger,
  getProductById,
  getSupplierById,
  getSupplierLedgerEntries,
  getVouchers,
  receiveInstallmentPayment,
  saveCheque,
  saveCustomer,
  saveProduct,
  saveSupplier,
} from '../services/storage';
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

    // Seed real records and ensure snapshot captures exact real records
    const { customer, product } = seedCleanFixtures();
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
});
