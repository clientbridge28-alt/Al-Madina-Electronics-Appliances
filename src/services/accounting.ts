import type {
  AccountHead,
  ChequeRecord,
  InstallmentAccount,
  PurchaseInvoice,
  PurchaseReturn,
  SalesInvoice,
  SalesReturn,
  Voucher,
  VoucherEntry,
} from '../types/erp';

export const ACCOUNT_IDS = {
  CASH: 'ACC-101',
  MEEZAN_BANK: 'ACC-102',
  ALFALAH_BANK: 'ACC-103',
  ACCOUNTS_RECEIVABLE: 'ACC-104',
  INSTALLMENT_RECEIVABLE: 'ACC-105',
  INVENTORY: 'ACC-106',
  FIXED_ASSETS: 'ACC-107',
  ACCOUNTS_PAYABLE: 'ACC-201',
  SALES_TAX_PAYABLE: 'ACC-202',
  OWNER_CAPITAL: 'ACC-301',
  RETAINED_EARNINGS: 'ACC-302',
  SALES_REVENUE: 'ACC-401',
  MARKUP_INCOME: 'ACC-402',
  COGS: 'ACC-501',
  FREIGHT_EXPENSE: 'ACC-505',
} as const;

export function roundMoney(value: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function sumVoucherSides(entries: VoucherEntry[]): { debit: number; credit: number; isBalanced: boolean } {
  const debit = roundMoney(entries.reduce((s, e) => s + roundMoney(e.debit || 0), 0));
  const credit = roundMoney(entries.reduce((s, e) => s + roundMoney(e.credit || 0), 0));
  return {
    debit,
    credit,
    isBalanced: Math.abs(debit - credit) < 0.01 && debit > 0,
  };
}

export function applyVoucherToAccounts(accounts: AccountHead[], entries: VoucherEntry[]): AccountHead[] {
  const map = new Map<string, AccountHead>(accounts.map(a => [a.id, { ...a }]));
  for (const entry of entries) {
    const acc = map.get(entry.accountId);
    if (!acc) continue;
    const dr = roundMoney(entry.debit || 0);
    const cr = roundMoney(entry.credit || 0);
    if (acc.category === 'Asset' || acc.category === 'Expense') {
      acc.currentBalance = roundMoney(acc.currentBalance + (dr - cr));
    } else {
      acc.currentBalance = roundMoney(acc.currentBalance + (cr - dr));
    }
    map.set(acc.id, acc);
  }
  return Array.from(map.values());
}

function resolveCashOrBankAccount(method?: string): { id: string; name: string } {
  if (method === 'Bank Transfer' || method === 'Bank' || method === 'Card' || method === 'Bank Refund') {
    return { id: ACCOUNT_IDS.MEEZAN_BANK, name: 'Meezan Bank - Current A/C # 0201010049281' };
  }
  return { id: ACCOUNT_IDS.CASH, name: 'Cash in Hand (Showroom Drawer)' };
}

export function buildSalesVoucher(sale: SalesInvoice, createdBy: string, uid: string): Omit<Voucher, 'id'> & { id: string; sourceRef: string; createdByUid: string } {
  const entries: VoucherEntry[] = [];
  const total = roundMoney(sale.grandTotal);
  const paid = roundMoney(Math.min(sale.paidAmount || 0, total));
  const balance = roundMoney(Math.max(0, total - paid));

  if (paid > 0) {
    const target = resolveCashOrBankAccount(sale.paymentMethod);
    entries.push({
      accountId: target.id,
      accountName: target.name,
      debit: paid,
      credit: 0,
      narration: `Payment received (${sale.paymentMethod})`,
    });
  }

  if (balance > 0) {
    entries.push({
      accountId: sale.saleType === 'Installment' ? ACCOUNT_IDS.INSTALLMENT_RECEIVABLE : ACCOUNT_IDS.ACCOUNTS_RECEIVABLE,
      accountName: sale.saleType === 'Installment' ? 'Installment Receivables Portfolio' : 'Accounts Receivable (Customers)',
      debit: balance,
      credit: 0,
      narration: `Receivable for ${sale.invoiceNumber}`,
    });
  }

  if (total > 0) {
    entries.push({
      accountId: ACCOUNT_IDS.SALES_REVENUE,
      accountName: 'Sales Revenue - Electronics Cash & Credit',
      debit: 0,
      credit: total,
      narration: `Sales Revenue for ${sale.invoiceNumber}`,
    });
  }

  // Inventory COGS recognition
  const cogs = roundMoney(
    sale.items.reduce((sum, item) => sum + roundMoney((item.costPrice || 0) * item.quantity), 0)
  );
  if (cogs > 0) {
    entries.push({
      accountId: ACCOUNT_IDS.COGS,
      accountName: 'Cost of Goods Sold (COGS)',
      debit: cogs,
      credit: 0,
      narration: `COGS for ${sale.invoiceNumber}`,
    });
    entries.push({
      accountId: ACCOUNT_IDS.INVENTORY,
      accountName: 'Finished Electronics Merchandise Inventory',
      debit: 0,
      credit: cogs,
      narration: `Inventory out for ${sale.invoiceNumber}`,
    });
  }

  // Fallback if 0 total
  if (entries.length < 2) {
    entries.push(
      { accountId: ACCOUNT_IDS.CASH, accountName: 'Cash in Hand (Showroom Drawer)', debit: 0, credit: 0 },
      { accountId: ACCOUNT_IDS.SALES_REVENUE, accountName: 'Sales Revenue - Electronics Cash & Credit', debit: 0, credit: 0 }
    );
  }

  return {
    id: `VCH-SALE-${sale.invoiceNumber}`,
    voucherNumber: `JV-${sale.invoiceNumber}`,
    voucherType: paid === total ? 'Receive Voucher' : 'Journal Voucher',
    date: sale.date,
    partyType: 'Customer',
    partyId: sale.customerId,
    partyName: sale.customerName,
    amount: total,
    paymentMethod: sale.paymentMethod === 'Bank Transfer' || sale.paymentMethod === 'Card' ? 'Bank' : sale.paymentMethod === 'Cheque' ? 'Cheque' : 'Cash',
    entries,
    narration: `Auto double-entry for Sales Invoice #${sale.invoiceNumber} (${sale.customerName})`,
    createdBy,
    createdByUid: uid,
    status: 'Posted',
    sourceRef: sale.id,
  };
}

export function buildSalesReturnVoucher(ret: SalesReturn, cogsRestoreAmount: number, createdBy: string, uid: string): Omit<Voucher, 'id'> & { id: string; sourceRef: string; createdByUid: string } {
  const total = roundMoney(ret.grandTotal);
  const entries: VoucherEntry[] = [
    {
      accountId: ACCOUNT_IDS.SALES_REVENUE,
      accountName: 'Sales Revenue - Electronics Cash & Credit',
      debit: total,
      credit: 0,
      narration: `Sales Return #${ret.returnNumber} against #${ret.originalInvoiceNo}`,
    },
  ];

  if (ret.refundMethod === 'Credit Note') {
    entries.push({
      accountId: ACCOUNT_IDS.ACCOUNTS_RECEIVABLE,
      accountName: 'Accounts Receivable (Customers)',
      debit: 0,
      credit: total,
      narration: `Credit note adjusted to customer receivable`,
    });
  } else {
    const target = resolveCashOrBankAccount(ret.refundMethod);
    entries.push({
      accountId: target.id,
      accountName: target.name,
      debit: 0,
      credit: total,
      narration: `Refund issued via ${ret.refundMethod}`,
    });
  }

  const cogs = roundMoney(cogsRestoreAmount);
  if (cogs > 0) {
    entries.push({
      accountId: ACCOUNT_IDS.INVENTORY,
      accountName: 'Finished Electronics Merchandise Inventory',
      debit: cogs,
      credit: 0,
      narration: `Inventory restored from Sales Return #${ret.returnNumber}`,
    });
    entries.push({
      accountId: ACCOUNT_IDS.COGS,
      accountName: 'Cost of Goods Sold (COGS)',
      debit: 0,
      credit: cogs,
      narration: `COGS reversal for Sales Return #${ret.returnNumber}`,
    });
  }

  return {
    id: `VCH-SRTN-${ret.returnNumber}`,
    voucherNumber: `JV-${ret.returnNumber}`,
    voucherType: ret.refundMethod === 'Credit Note' ? 'Journal Voucher' : 'Payment Voucher',
    date: ret.date,
    partyType: 'Customer',
    partyId: ret.customerId,
    partyName: ret.customerName,
    amount: total,
    paymentMethod: ret.refundMethod === 'Bank' ? 'Bank' : 'Cash',
    entries,
    narration: `Sales Return #${ret.returnNumber} for Invoice #${ret.originalInvoiceNo}`,
    createdBy,
    createdByUid: uid,
    status: 'Posted',
    sourceRef: ret.id,
  };
}

export function buildPurchaseVoucher(purchase: PurchaseInvoice, createdBy: string, uid: string): Omit<Voucher, 'id'> & { id: string; sourceRef: string; createdByUid: string } {
  const merchandiseTotal = roundMoney(purchase.subTotal || purchase.grandTotal - (purchase.freightCharges || 0));
  const freight = roundMoney(purchase.freightCharges || 0);
  const grandTotal = roundMoney(purchase.grandTotal);
  const paid = roundMoney(Math.min(purchase.paidAmount || 0, grandTotal));
  const balance = roundMoney(Math.max(0, grandTotal - paid));

  const entries: VoucherEntry[] = [];
  if (merchandiseTotal > 0) {
    entries.push({
      accountId: ACCOUNT_IDS.INVENTORY,
      accountName: 'Finished Electronics Merchandise Inventory',
      debit: merchandiseTotal,
      credit: 0,
      narration: `Merchandise intake for #${purchase.invoiceNumber}`,
    });
  }
  if (freight > 0) {
    entries.push({
      accountId: ACCOUNT_IDS.FREIGHT_EXPENSE,
      accountName: 'Delivery, Carriage & Transport Freight',
      debit: freight,
      credit: 0,
      narration: `Inbound freight for #${purchase.invoiceNumber}`,
    });
  }
  if (paid > 0) {
    const target = resolveCashOrBankAccount(purchase.paymentMethod);
    entries.push({
      accountId: target.id,
      accountName: target.name,
      debit: 0,
      credit: paid,
      narration: `Paid via ${purchase.paymentMethod}`,
    });
  }
  if (balance > 0) {
    entries.push({
      accountId: ACCOUNT_IDS.ACCOUNTS_PAYABLE,
      accountName: 'Accounts Payable (Distributors & Suppliers)',
      debit: 0,
      credit: balance,
      narration: `Payable to ${purchase.supplierName}`,
    });
  }

  return {
    id: `VCH-PUR-${purchase.invoiceNumber}`,
    voucherNumber: `PV-${purchase.invoiceNumber}`,
    voucherType: paid > 0 ? 'Payment Voucher' : 'Journal Voucher',
    date: purchase.date,
    partyType: 'Supplier',
    partyId: purchase.supplierId,
    partyName: purchase.supplierName,
    amount: grandTotal,
    paymentMethod: purchase.paymentMethod === 'Bank Transfer' ? 'Bank' : purchase.paymentMethod === 'Cheque' ? 'Cheque' : 'Cash',
    entries,
    narration: `Auto double-entry for Purchase Invoice #${purchase.invoiceNumber} (${purchase.supplierName})`,
    createdBy,
    createdByUid: uid,
    status: 'Posted',
    sourceRef: purchase.id,
  };
}

export function buildPurchaseReturnVoucher(ret: PurchaseReturn, createdBy: string, uid: string): Omit<Voucher, 'id'> & { id: string; sourceRef: string; createdByUid: string } {
  const total = roundMoney(ret.grandTotal);
  const entries: VoucherEntry[] = [];

  if (ret.refundMethod === 'Deduct Payable') {
    entries.push({
      accountId: ACCOUNT_IDS.ACCOUNTS_PAYABLE,
      accountName: 'Accounts Payable (Distributors & Suppliers)',
      debit: total,
      credit: 0,
      narration: `Debit note reducing payable to ${ret.supplierName}`,
    });
  } else {
    const target = resolveCashOrBankAccount(ret.refundMethod);
    entries.push({
      accountId: target.id,
      accountName: target.name,
      debit: total,
      credit: 0,
      narration: `Vendor refund received (${ret.refundMethod})`,
    });
  }

  entries.push({
    accountId: ACCOUNT_IDS.INVENTORY,
    accountName: 'Finished Electronics Merchandise Inventory',
    debit: 0,
    credit: total,
    narration: `Inventory returned on Purchase Return #${ret.returnNumber}`,
  });

  return {
    id: `VCH-PRTN-${ret.returnNumber}`,
    voucherNumber: `JV-${ret.returnNumber}`,
    voucherType: ret.refundMethod === 'Deduct Payable' ? 'Journal Voucher' : 'Receive Voucher',
    date: ret.date,
    partyType: 'Supplier',
    partyId: ret.supplierId,
    partyName: ret.supplierName,
    amount: total,
    paymentMethod: ret.refundMethod === 'Bank Refund' ? 'Bank' : 'Cash',
    entries,
    narration: `Purchase Return #${ret.returnNumber} against #${ret.originalPurchaseNo}`,
    createdBy,
    createdByUid: uid,
    status: 'Posted',
    sourceRef: ret.id,
  };
}

export function buildInstallmentCreationVoucher(account: InstallmentAccount, createdBy: string, uid: string): Omit<Voucher, 'id'> & { id: string; sourceRef: string; createdByUid: string } {
  const down = roundMoney(account.downPayment);
  const financed = roundMoney(account.totalFinancedPayable);
  const cashPrice = roundMoney(account.cashPrice);
  const markup = roundMoney(account.markupAmount);
  const totalWithDown = roundMoney(account.totalPayableWithDown);

  const entries: VoucherEntry[] = [];
  if (down > 0) {
    entries.push({
      accountId: ACCOUNT_IDS.CASH,
      accountName: 'Cash in Hand (Showroom Drawer)',
      debit: down,
      credit: 0,
      narration: `Down payment for ${account.accountNumber}`,
    });
  }
  if (financed > 0) {
    entries.push({
      accountId: ACCOUNT_IDS.INSTALLMENT_RECEIVABLE,
      accountName: 'Installment Receivables Portfolio',
      debit: financed,
      credit: 0,
      narration: `Installment receivable for ${account.accountNumber}`,
    });
  }
  if (cashPrice > 0) {
    entries.push({
      accountId: ACCOUNT_IDS.SALES_REVENUE,
      accountName: 'Sales Revenue - Electronics Cash & Credit',
      debit: 0,
      credit: cashPrice,
      narration: `Appliance principal revenue for ${account.accountNumber}`,
    });
  }
  if (markup > 0) {
    entries.push({
      accountId: ACCOUNT_IDS.MARKUP_INCOME,
      accountName: 'Installment Markup Income',
      debit: 0,
      credit: markup,
      narration: `Markup income on ${account.accountNumber}`,
    });
  }

  return {
    id: `VCH-INST-${account.accountNumber}`,
    voucherNumber: `JV-${account.accountNumber}`,
    voucherType: 'Journal Voucher',
    date: account.startDate,
    partyType: 'Customer',
    partyId: account.customerId,
    partyName: account.customerName,
    amount: totalWithDown,
    paymentMethod: 'Cash',
    entries,
    narration: `Installment financing plan #${account.accountNumber} (${account.productName})`,
    createdBy,
    createdByUid: uid,
    status: 'Posted',
    sourceRef: account.id,
  };
}

export function buildInstallmentReceiptVoucher(
  account: InstallmentAccount,
  receiptNo: string,
  amount: number,
  paymentMethod: 'Cash' | 'Bank' | 'Cheque',
  createdBy: string,
  uid: string
): Omit<Voucher, 'id'> & { id: string; sourceRef: string; createdByUid: string } {
  const amt = roundMoney(amount);
  const target = resolveCashOrBankAccount(paymentMethod);
  return {
    id: `VCH-${receiptNo}`,
    voucherNumber: receiptNo,
    voucherType: 'Receive Voucher',
    date: new Date().toISOString().split('T')[0],
    partyType: 'Customer',
    partyId: account.customerId,
    partyName: account.customerName,
    amount: amt,
    paymentMethod,
    entries: [
      {
        accountId: target.id,
        accountName: target.name,
        debit: amt,
        credit: 0,
        narration: `Installment collection via ${paymentMethod}`,
      },
      {
        accountId: ACCOUNT_IDS.INSTALLMENT_RECEIVABLE,
        accountName: 'Installment Receivables Portfolio',
        debit: 0,
        credit: amt,
        narration: `Installment receipt ${receiptNo} for ${account.accountNumber}`,
      },
    ],
    narration: `Installment Receipt ${receiptNo} from ${account.customerName} (A/C #${account.accountNumber})`,
    createdBy,
    createdByUid: uid,
    status: 'Posted',
    sourceRef: account.id,
  };
}

export function buildChequeClearanceVoucher(
  cheque: ChequeRecord,
  clearanceDate: string,
  createdBy: string,
  uid: string,
  bankAccount?: { id: string; name: string }
): Omit<Voucher, 'id'> & { id: string; sourceRef: string; createdByUid: string } {
  const amt = roundMoney(cheque.amount);
  const targetBankId = bankAccount?.id || cheque.bankAccountId || ACCOUNT_IDS.MEEZAN_BANK;
  const targetBankName =
    bankAccount?.name ||
    (targetBankId === ACCOUNT_IDS.ALFALAH_BANK
      ? 'Bank Alfalah - Current A/C # 55109849201'
      : 'Meezan Bank - Current A/C # 0201010049281');

  const entries: VoucherEntry[] =
    cheque.type === 'Received'
      ? [
          { accountId: targetBankId, accountName: targetBankName, debit: amt, credit: 0, narration: `Cheque #${cheque.chequeNumber} cleared` },
          { accountId: ACCOUNT_IDS.ACCOUNTS_RECEIVABLE, accountName: 'Accounts Receivable (Customers)', debit: 0, credit: amt, narration: `Received from ${cheque.partyName}` },
        ]
      : [
          { accountId: ACCOUNT_IDS.ACCOUNTS_PAYABLE, accountName: 'Accounts Payable (Distributors & Suppliers)', debit: amt, credit: 0, narration: `Paid to ${cheque.partyName}` },
          { accountId: targetBankId, accountName: targetBankName, debit: 0, credit: amt, narration: `Cheque #${cheque.chequeNumber} cleared` },
        ];

  return {
    id: `VCH-CHQ-${cheque.id}`,
    voucherNumber: `CHQ-${cheque.chequeNumber}`,
    voucherType: cheque.type === 'Received' ? 'Receive Voucher' : 'Payment Voucher',
    date: clearanceDate,
    partyType: cheque.type === 'Received' ? 'Customer' : 'Supplier',
    partyId: cheque.partyId,
    partyName: cheque.partyName,
    amount: amt,
    paymentMethod: 'Cheque',
    entries,
    narration: `${cheque.type} Cheque #${cheque.chequeNumber} cleared (${cheque.bankName})`,
    createdBy,
    createdByUid: uid,
    status: 'Posted',
    sourceRef: cheque.id,
  };
}

export function buildChequeBounceVoucher(
  cheque: ChequeRecord,
  bounceDate: string,
  createdBy: string,
  uid: string,
  bankAccount?: { id: string; name: string }
): Omit<Voucher, 'id'> & { id: string; sourceRef: string; createdByUid: string } {
  const amt = roundMoney(cheque.amount);
  const targetBankId = bankAccount?.id || cheque.bankAccountId || ACCOUNT_IDS.MEEZAN_BANK;
  const targetBankName =
    bankAccount?.name ||
    (targetBankId === ACCOUNT_IDS.ALFALAH_BANK
      ? 'Bank Alfalah - Current A/C # 55109849201'
      : 'Meezan Bank - Current A/C # 0201010049281');

  const entries: VoucherEntry[] =
    cheque.type === 'Received'
      ? [
          { accountId: ACCOUNT_IDS.ACCOUNTS_RECEIVABLE, accountName: 'Accounts Receivable (Customers)', debit: amt, credit: 0, narration: `Bounced cheque #${cheque.chequeNumber} reinstated receivable` },
          { accountId: targetBankId, accountName: targetBankName, debit: 0, credit: amt, narration: `Dishonored cheque #${cheque.chequeNumber} reversed` },
        ]
      : [
          { accountId: targetBankId, accountName: targetBankName, debit: amt, credit: 0, narration: `Dishonored issued cheque #${cheque.chequeNumber} restored` },
          { accountId: ACCOUNT_IDS.ACCOUNTS_PAYABLE, accountName: 'Accounts Payable (Distributors & Suppliers)', debit: 0, credit: amt, narration: `Payable reinstated to ${cheque.partyName}` },
        ];

  return {
    id: `VCH-BNC-${cheque.id}-${Date.now().toString().slice(-4)}`,
    voucherNumber: `BNC-${cheque.chequeNumber}`,
    voucherType: 'Journal Voucher',
    date: bounceDate,
    partyType: cheque.type === 'Received' ? 'Customer' : 'Supplier',
    partyId: cheque.partyId,
    partyName: cheque.partyName,
    amount: amt,
    paymentMethod: 'Cheque',
    entries,
    narration: `Dishonored/Bounced ${cheque.type} Cheque #${cheque.chequeNumber} (${cheque.bankName})`,
    createdBy,
    createdByUid: uid,
    status: 'Posted',
    sourceRef: `BOUNCE-${cheque.id}`,
  };
}

export function buildReversalVoucher(
  original: Voucher,
  reason: string,
  createdBy: string,
  uid: string
): Omit<Voucher, 'id'> & { id: string; createdByUid: string } {
  const reversedEntries: VoucherEntry[] = original.entries.map(e => ({
    accountId: e.accountId,
    accountName: e.accountName,
    debit: roundMoney(e.credit || 0),
    credit: roundMoney(e.debit || 0),
    narration: `Reversal of ${original.voucherNumber}: ${e.narration || original.narration}`,
  }));

  return {
    id: `REV-${original.id}-${Date.now().toString().slice(-4)}`.slice(0, 128),
    voucherNumber: `REV-${original.voucherNumber}`.slice(0, 64),
    voucherType: 'Journal Voucher',
    date: new Date().toISOString().split('T')[0],
    partyType: original.partyType,
    partyId: original.partyId,
    partyName: original.partyName,
    amount: roundMoney(original.amount),
    paymentMethod: original.paymentMethod,
    entries: reversedEntries,
    narration: `Reversal of ${original.voucherNumber}: ${reason || 'Accounting correction'}`.slice(0, 495),
    createdBy,
    createdByUid: uid,
    status: 'Posted',
    sourceRef: `REV-${original.id}`,
  };
}

