import React, { useState, useMemo, useEffect } from 'react';
import { Printer, FileDown, FileSpreadsheet } from 'lucide-react';
import {
  getCustomers,
  getSuppliers,
  getChartOfAccounts,
  getCustomerLedgerEntries,
  getSupplierLedgerEntries,
  getCashBookEntries,
  getBankBookEntries,
  getGeneralLedgerEntries,
  getHeadWiseBalanceReport,
  getVouchers,
  getSettings,
  subscribeToDatabase,
} from '../../services/storage';
import {
  exportTrialBalancePDF,
  exportAccountStatementPDF,
  exportCashBankBookPDF,
  exportGeneralLedgerPDF,
} from '../../services/pdfService';
import { exportToXLSX, exportCollectionToCSV } from '../../services/excelService';

type LedgerTab =
  | 'TrialBalance'
  | 'HeadWiseBalance'
  | 'CustomerLedger'
  | 'SupplierLedger'
  | 'CashBook'
  | 'BankBook'
  | 'GeneralLedger';

export const LedgersView: React.FC = () => {
  const [, setVersion] = useState(0);
  useEffect(() => subscribeToDatabase(() => setVersion(v => v + 1)), []);

  const customers = getCustomers();
  const suppliers = getSuppliers();
  const accounts = getChartOfAccounts();
  const vouchers = getVouchers();
  const settings = getSettings();

  const [activeLedgerType, setActiveLedgerType] = useState<LedgerTab>('TrialBalance');
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || '');
  const [selectedSupplierId, setSelectedSupplierId] = useState(suppliers[0]?.id || '');
  const [selectedBankId, setSelectedBankId] = useState('ACC-102');
  const [selectedGlAccountId, setSelectedGlAccountId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (!selectedCustomerId && customers.length > 0) setSelectedCustomerId(customers[0].id);
  }, [customers.length]);

  useEffect(() => {
    if (!selectedSupplierId && suppliers.length > 0) setSelectedSupplierId(suppliers[0].id);
  }, [suppliers.length]);

  const bankAccounts = useMemo(
    () =>
      accounts.filter(
        a =>
          a.category === 'Asset' &&
          (a.subCategory.toLowerCase().includes('bank') ||
            a.name.toLowerCase().includes('bank') ||
            a.id === 'ACC-102' ||
            a.id === 'ACC-103')
      ),
    [accounts]
  );

  const customerLedger = useMemo(
    () => getCustomerLedgerEntries(selectedCustomerId),
    [selectedCustomerId, customers.length, vouchers.length]
  );

  const supplierLedger = useMemo(
    () => getSupplierLedgerEntries(selectedSupplierId),
    [selectedSupplierId, suppliers.length, vouchers.length]
  );

  const cashBookRows = useMemo(
    () => getCashBookEntries(startDate || undefined, endDate || undefined),
    [startDate, endDate, vouchers.length]
  );

  const bankBookRows = useMemo(
    () => getBankBookEntries(selectedBankId || 'ACC-102', startDate || undefined, endDate || undefined),
    [selectedBankId, startDate, endDate, vouchers.length]
  );

  const glRows = useMemo(
    () => getGeneralLedgerEntries(selectedGlAccountId || undefined, startDate || undefined, endDate || undefined),
    [selectedGlAccountId, startDate, endDate, vouchers.length]
  );

  const headWiseReport = useMemo(() => getHeadWiseBalanceReport(), [accounts, vouchers.length]);

  const trialBalanceRows = useMemo(() => {
    return accounts.map(acc => {
      const isDebitNature = acc.category === 'Asset' || acc.category === 'Expense';
      return {
        code: acc.code,
        name: acc.name,
        category: acc.category,
        debit: isDebitNature ? acc.currentBalance : 0,
        credit: !isDebitNature ? acc.currentBalance : 0,
      };
    });
  }, [accounts]);

  const totalTBDebit = trialBalanceRows.reduce((sum, r) => sum + r.debit, 0);
  const totalTBCredit = trialBalanceRows.reduce((sum, r) => sum + r.credit, 0);

  const handleDownloadPDF = () => {
    if (activeLedgerType === 'TrialBalance') {
      exportTrialBalancePDF(trialBalanceRows, settings);
    } else if (activeLedgerType === 'HeadWiseBalance') {
      exportTrialBalancePDF(headWiseReport.rows, settings);
    } else if (activeLedgerType === 'CustomerLedger') {
      const cust = customers.find(c => c.id === selectedCustomerId);
      exportAccountStatementPDF(
        'Customer Ledger Account Statement',
        cust ? cust.name : 'Customer',
        cust ? cust.id : '',
        cust ? cust.phone : '',
        customerLedger,
        settings
      );
    } else if (activeLedgerType === 'SupplierLedger') {
      const supp = suppliers.find(s => s.id === selectedSupplierId);
      exportAccountStatementPDF(
        'Supplier / Vendor Ledger Statement',
        supp ? supp.companyName : 'Supplier',
        supp ? supp.id : '',
        supp ? supp.phone : '',
        supplierLedger,
        settings
      );
    } else if (activeLedgerType === 'CashBook') {
      exportCashBankBookPDF('Showroom Cash Book (ACC-101)', cashBookRows, settings);
    } else if (activeLedgerType === 'BankBook') {
      const bankAcc = bankAccounts.find(b => b.id === selectedBankId);
      exportCashBankBookPDF(`Bank Book — ${bankAcc?.name || selectedBankId}`, bankBookRows, settings);
    } else if (activeLedgerType === 'GeneralLedger') {
      exportGeneralLedgerPDF(glRows, settings);
    }
  };

  const handleExportExcel = () => {
    if (activeLedgerType === 'TrialBalance') exportToXLSX(trialBalanceRows, 'Trial_Balance', 'TrialBalance');
    else if (activeLedgerType === 'HeadWiseBalance') exportToXLSX(headWiseReport.rows, 'Head_Wise_Balance', 'HeadWise');
    else if (activeLedgerType === 'CustomerLedger') exportToXLSX(customerLedger, 'Customer_Ledger', 'CustomerLedger');
    else if (activeLedgerType === 'SupplierLedger') exportToXLSX(supplierLedger, 'Supplier_Ledger', 'SupplierLedger');
    else if (activeLedgerType === 'CashBook') exportToXLSX(cashBookRows, 'Cash_Book', 'CashBook');
    else if (activeLedgerType === 'BankBook') exportToXLSX(bankBookRows, 'Bank_Book', 'BankBook');
    else exportToXLSX(glRows, 'General_Ledger', 'GeneralLedger');
  };

  const handleExportCSV = () => {
    if (activeLedgerType === 'TrialBalance') exportCollectionToCSV(trialBalanceRows, 'Trial_Balance');
    else if (activeLedgerType === 'HeadWiseBalance') exportCollectionToCSV(headWiseReport.rows, 'Head_Wise_Balance');
    else if (activeLedgerType === 'CustomerLedger') exportCollectionToCSV(customerLedger, 'Customer_Ledger');
    else if (activeLedgerType === 'SupplierLedger') exportCollectionToCSV(supplierLedger, 'Supplier_Ledger');
    else if (activeLedgerType === 'CashBook') exportCollectionToCSV(cashBookRows, 'Cash_Book');
    else if (activeLedgerType === 'BankBook') exportCollectionToCSV(bankBookRows, 'Bank_Book');
    else exportCollectionToCSV(glRows, 'General_Ledger');
  };

  const tabs: { id: LedgerTab; label: string }[] = [
    { id: 'TrialBalance', label: 'Trial Balance' },
    { id: 'HeadWiseBalance', label: 'Head-Wise Balance' },
    { id: 'CustomerLedger', label: 'Customer Ledgers' },
    { id: 'SupplierLedger', label: 'Supplier Ledgers' },
    { id: 'CashBook', label: 'Cash Book' },
    { id: 'BankBook', label: 'Bank Book' },
    { id: 'GeneralLedger', label: 'General Ledger (GL)' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Ledger Management, Books & Trial Balance
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Double-entry Trial Balance, Head-Wise balances, Cash/Bank Books, General Ledger & party reconciliations
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100/80 px-3.5 py-2 text-xs font-bold text-rose-800 shadow-2xs transition whitespace-nowrap shrink-0"
          >
            <FileDown className="h-4 w-4 text-rose-600" />
            <span>PDF</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100/80 px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-2xs transition whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
            <span>Excel</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 shadow-2xs transition whitespace-nowrap shrink-0"
          >
            CSV
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 transition whitespace-nowrap shrink-0"
          >
            <Printer className="h-4 w-4" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-2xl bg-white p-3 border border-slate-200 shadow-2xs flex items-center gap-1.5 overflow-x-auto text-xs font-bold">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveLedgerType(t.id)}
            className={`px-3.5 py-2 rounded-xl transition whitespace-nowrap shrink-0 ${
              activeLedgerType === t.id ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Date Filter Bar for CashBook / BankBook / GeneralLedger */}
      {(activeLedgerType === 'CashBook' || activeLedgerType === 'BankBook' || activeLedgerType === 'GeneralLedger') && (
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-wrap items-center gap-3 text-xs">
          {activeLedgerType === 'BankBook' && (
            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-700">Bank Account:</label>
              <select
                value={selectedBankId}
                onChange={e => setSelectedBankId(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white p-2 font-semibold text-slate-800"
              >
                <option value="">{bankAccounts.length === 0 ? 'No bank accounts found' : 'Select Bank Account...'}</option>
                {bankAccounts.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.code} - {b.name} (Bal: ₨ {b.currentBalance.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
          )}

          {activeLedgerType === 'GeneralLedger' && (
            <div className="flex items-center gap-2">
              <label className="font-bold text-slate-700">Account Head:</label>
              <select
                value={selectedGlAccountId}
                onChange={e => setSelectedGlAccountId(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white p-2 font-semibold text-slate-800"
              >
                <option value="">All Chart of Accounts Heads</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.code} - {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            <label className="font-bold text-slate-700">From:</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="rounded-xl border border-slate-200 p-2"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="font-bold text-slate-700">To:</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="rounded-xl border border-slate-200 p-2"
            />
          </div>
          {(startDate || endDate || selectedGlAccountId) && (
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setSelectedGlAccountId('');
              }}
              className="text-blue-600 font-bold underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      )}

      {/* 1. TRIAL BALANCE */}
      {activeLedgerType === 'TrialBalance' && (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Showroom Trial Balance Statement</h3>
              <p className="text-xs text-slate-400">As of today • Financial Year 2026-27</p>
            </div>
            <span
              className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${
                Math.abs(totalTBDebit - totalTBCredit) < 0.5
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : 'text-amber-700 bg-amber-50 border-amber-200'
              }`}
            >
              {Math.abs(totalTBDebit - totalTBCredit) < 0.5 ? 'Balanced Statement ✓' : 'Check Imbalance'}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4 font-mono">Account Code</th>
                  <th className="py-3 px-4">Account Title / Classification</th>
                  <th className="py-3 px-4">Group</th>
                  <th className="py-3 px-4 text-right">Debit Balance (₨)</th>
                  <th className="py-3 px-4 text-right">Credit Balance (₨)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {trialBalanceRows.map(row => (
                  <tr key={row.code} className="hover:bg-slate-50/60 transition">
                    <td className="py-3 px-4 font-bold text-blue-700">{row.code}</td>
                    <td className="py-3 px-4 font-sans font-semibold text-slate-900">{row.name}</td>
                    <td className="py-3 px-4 font-sans text-slate-500">{row.category}</td>
                    <td className="py-3 px-4 text-right text-slate-900">
                      {row.debit > 0 ? `₨ ${row.debit.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900">
                      {row.credit > 0 ? `₨ ${row.credit.toLocaleString()}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100/80 border-t-2 border-slate-900 font-mono tabular-nums font-extrabold text-sm text-slate-900">
                <tr>
                  <td colSpan={3} className="py-3.5 px-4 font-sans uppercase">
                    Total Trial Balance
                  </td>
                  <td className="py-3.5 px-4 text-right text-blue-800">₨ {totalTBDebit.toLocaleString()}</td>
                  <td className="py-3.5 px-4 text-right text-blue-800">₨ {totalTBCredit.toLocaleString()}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 2. HEAD-WISE BALANCE */}
      {activeLedgerType === 'HeadWiseBalance' && (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Head-Wise Account Balances</h3>
              <p className="text-xs text-slate-400">Account-by-account debit/credit summary across all COA categories</p>
            </div>
            <span
              className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${
                headWiseReport.isBalanced
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                  : 'text-amber-700 bg-amber-50 border-amber-200'
              }`}
            >
              {headWiseReport.isBalanced ? 'Balanced ✓' : 'Variance Detected'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4 font-mono">Code</th>
                  <th className="py-3 px-4">Account Name</th>
                  <th className="py-3 px-4">Category / Sub-Category</th>
                  <th className="py-3 px-4 text-right">Debit (₨)</th>
                  <th className="py-3 px-4 text-right">Credit (₨)</th>
                  <th className="py-3 px-4 text-right">Ledger Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {headWiseReport.rows.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-bold text-blue-700">{r.code}</td>
                    <td className="py-3 px-4 font-sans font-semibold text-slate-900">{r.name}</td>
                    <td className="py-3 px-4 font-sans text-slate-500">
                      {r.category} • {r.subCategory}
                    </td>
                    <td className="py-3 px-4 text-right">{r.debit > 0 ? `₨ ${r.debit.toLocaleString()}` : '—'}</td>
                    <td className="py-3 px-4 text-right">{r.credit > 0 ? `₨ ${r.credit.toLocaleString()}` : '—'}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">₨ {r.balance.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-100/80 border-t-2 border-slate-900 font-mono tabular-nums font-extrabold text-sm">
                <tr>
                  <td colSpan={3} className="py-3 px-4 font-sans uppercase">
                    Head-Wise Totals
                  </td>
                  <td className="py-3 px-4 text-right text-blue-800">₨ {headWiseReport.totalDebit.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-blue-800">₨ {headWiseReport.totalCredit.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-slate-600">—</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* 3. CUSTOMER LEDGER */}
      {activeLedgerType === 'CustomerLedger' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-700">Select Customer:</label>
              <select
                value={selectedCustomerId}
                onChange={e => setSelectedCustomerId(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-800"
              >
                <option value="">{customers.length === 0 ? 'No customers found' : 'Select Customer...'}</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.phone} - Bal: ₨ {c.currentBalance.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
            <span className="text-xs font-mono font-bold text-rose-700">
              Outstanding: ₨ {(customers.find(c => c.id === selectedCustomerId)?.currentBalance || 0).toLocaleString()}
            </span>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Voucher / Invoice #</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Debit (Sales/Bounced)</th>
                  <th className="py-3 px-4 text-right">Credit (Receipts)</th>
                  <th className="py-3 px-4 text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {customerLedger.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-sans text-slate-600">{row.date}</td>
                    <td className="py-3 px-4 font-bold text-blue-700">{row.voucherNo}</td>
                    <td className="py-3 px-4 font-sans text-slate-800">{row.description}</td>
                    <td className="py-3 px-4 text-right text-slate-900">
                      {row.debit > 0 ? `₨ ${row.debit.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-700">
                      {row.credit > 0 ? `₨ ${row.credit.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">₨ {row.balance.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. SUPPLIER LEDGER */}
      {activeLedgerType === 'SupplierLedger' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-700">Select Supplier:</label>
              <select
                value={selectedSupplierId}
                onChange={e => setSelectedSupplierId(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white p-2 text-xs font-semibold text-slate-800"
              >
                <option value="">{suppliers.length === 0 ? 'No suppliers found' : 'Select Supplier...'}</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.companyName} (Payable: ₨ {s.currentBalance.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
            <span className="text-xs font-mono font-bold text-rose-700">
              Payable: ₨ {(suppliers.find(s => s.id === selectedSupplierId)?.currentBalance || 0).toLocaleString()}
            </span>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Voucher / Invoice #</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 text-right">Debit (Paid)</th>
                  <th className="py-3 px-4 text-right">Credit (Purchases)</th>
                  <th className="py-3 px-4 text-right">Running Balance Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {supplierLedger.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-sans text-slate-600">{row.date}</td>
                    <td className="py-3 px-4 font-bold text-blue-700">{row.voucherNo}</td>
                    <td className="py-3 px-4 font-sans text-slate-800">{row.description}</td>
                    <td className="py-3 px-4 text-right text-emerald-700">
                      {row.debit > 0 ? `₨ ${row.debit.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900">
                      {row.credit > 0 ? `₨ ${row.credit.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-rose-700">₨ {row.balance.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 5. CASH BOOK */}
      {activeLedgerType === 'CashBook' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Cash Receipts (Dr)</span>
              <p className="text-xl font-black text-emerald-700 font-mono tabular-nums mt-1">
                ₨ {cashBookRows.reduce((s, r) => s + r.receiptDebit, 0).toLocaleString()}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Cash Payments (Cr)</span>
              <p className="text-xl font-black text-rose-700 font-mono tabular-nums mt-1">
                ₨ {cashBookRows.reduce((s, r) => s + r.paymentCredit, 0).toLocaleString()}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Cash in Hand Balance</span>
              <p className="text-xl font-black text-slate-900 font-mono tabular-nums mt-1">
                ₨ {(accounts.find(a => a.id === 'ACC-101')?.currentBalance || 0).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Voucher #</th>
                  <th className="py-3 px-4">Party / Narration</th>
                  <th className="py-3 px-4 text-right">Receipts (Dr)</th>
                  <th className="py-3 px-4 text-right">Payments (Cr)</th>
                  <th className="py-3 px-4 text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {cashBookRows.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-sans text-slate-600">{row.date}</td>
                    <td className="py-3 px-4 font-bold text-blue-700">{row.voucherNo}</td>
                    <td className="py-3 px-4 font-sans text-slate-800">
                      <span className="font-semibold">{row.partyName}</span> — {row.narration}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-700">
                      {row.receiptDebit > 0 ? `₨ ${row.receiptDebit.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-rose-700">
                      {row.paymentCredit > 0 ? `₨ ${row.paymentCredit.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      ₨ {row.runningBalance.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {cashBookRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center font-sans text-slate-400">
                      No cash drawer transactions found in selected range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. BANK BOOK */}
      {activeLedgerType === 'BankBook' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Bank Deposits (Dr)</span>
              <p className="text-xl font-black text-emerald-700 font-mono tabular-nums mt-1">
                ₨ {bankBookRows.reduce((s, r) => s + r.receiptDebit, 0).toLocaleString()}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Bank Withdrawals (Cr)</span>
              <p className="text-xl font-black text-rose-700 font-mono tabular-nums mt-1">
                ₨ {bankBookRows.reduce((s, r) => s + r.paymentCredit, 0).toLocaleString()}
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Ledger Bank Balance</span>
              <p className="text-xl font-black text-blue-800 font-mono tabular-nums mt-1">
                ₨ {(accounts.find(a => a.id === selectedBankId)?.currentBalance || 0).toLocaleString()}
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Voucher #</th>
                  <th className="py-3 px-4">Party / Narration</th>
                  <th className="py-3 px-4 text-right">Deposits (Dr)</th>
                  <th className="py-3 px-4 text-right">Withdrawals (Cr)</th>
                  <th className="py-3 px-4 text-right">Running Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {bankBookRows.map(row => (
                  <tr key={row.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-sans text-slate-600">{row.date}</td>
                    <td className="py-3 px-4 font-bold text-blue-700">{row.voucherNo}</td>
                    <td className="py-3 px-4 font-sans text-slate-800">
                      <span className="font-semibold">{row.partyName}</span> — {row.narration}
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-700">
                      {row.receiptDebit > 0 ? `₨ ${row.receiptDebit.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-rose-700">
                      {row.paymentCredit > 0 ? `₨ ${row.paymentCredit.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      ₨ {row.runningBalance.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {bankBookRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center font-sans text-slate-400">
                      No bank transactions found for this account and period.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. GENERAL LEDGER (GL) */}
      {activeLedgerType === 'GeneralLedger' && (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Voucher #</th>
                  <th className="py-3 px-4">Account Head</th>
                  <th className="py-3 px-4">Narration</th>
                  <th className="py-3 px-4 text-right">Debit (₨)</th>
                  <th className="py-3 px-4 text-right">Credit (₨)</th>
                  <th className="py-3 px-4 text-right">Acct Running Bal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {glRows.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-sans text-slate-600">{r.date}</td>
                    <td className="py-3 px-4 font-bold text-blue-700">{r.voucherNo}</td>
                    <td className="py-3 px-4 font-sans font-semibold text-slate-900">
                      {r.accountCode} - {r.accountName}
                    </td>
                    <td className="py-3 px-4 font-sans text-slate-600 max-w-xs truncate">{r.narration}</td>
                    <td className="py-3 px-4 text-right text-slate-900">
                      {r.debit > 0 ? `₨ ${r.debit.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right text-slate-900">
                      {r.credit > 0 ? `₨ ${r.credit.toLocaleString()}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">
                      ₨ {r.runningBalance.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {glRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center font-sans text-slate-400">
                      No General Ledger postings match your current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
