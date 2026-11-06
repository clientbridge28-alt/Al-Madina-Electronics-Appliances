import React, { useState, useMemo } from 'react';
import { 
  BookOpen, Plus, Search, CheckCircle2, 
  AlertTriangle, DollarSign, ArrowLeftRight, X, Trash2, Layers 
} from 'lucide-react';
import { getChartOfAccounts, getVouchers, createVoucher, saveAccountHead } from '../../services/storage';
import { AccountHead, Voucher, VoucherEntry } from '../../types/erp';
import { Badge } from '../common/Badge';

export const AccountingView: React.FC = () => {
  const [accounts, setAccounts] = useState<AccountHead[]>(getChartOfAccounts());
  const [vouchers, setVouchers] = useState<Voucher[]>(getVouchers());

  const [activeTab, setActiveTab] = useState<'Vouchers' | 'COA'>('Vouchers');
  const [searchQuery, setSearchQuery] = useState('');
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);

  // New Voucher Form
  const [voucherType, setVoucherType] = useState<Voucher['voucherType']>('Journal Voucher');
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split('T')[0]);
  const [narration, setNarration] = useState('');
  const [entries, setEntries] = useState<VoucherEntry[]>([
    { accountId: accounts[0]?.id || '', accountName: accounts[0]?.name || '', debit: 50000, credit: 0 },
    { accountId: accounts[1]?.id || '', accountName: accounts[1]?.name || '', debit: 0, credit: 50000 }
  ]);

  // New Account Form
  const [accCode, setAccCode] = useState('');
  const [accName, setAccName] = useState('');
  const [accCategory, setAccCategory] = useState<AccountHead['category']>('Expense');
  const [accSubCategory, setAccSubCategory] = useState('Operating Expense');

  // Balancing totals
  const totalDebit = entries.reduce((sum, e) => sum + (Number(e.debit) || 0), 0);
  const totalCredit = entries.reduce((sum, e) => sum + (Number(e.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const handleAddEntryRow = () => {
    const firstAcc = accounts[0];
    setEntries([
      ...entries,
      { accountId: firstAcc.id, accountName: firstAcc.name, debit: 0, credit: 0 }
    ]);
  };

  const handleUpdateEntry = (index: number, field: string, val: any) => {
    setEntries(prev => {
      const copy = [...prev];
      const target = { ...copy[index] };
      if (field === 'accountId') {
        const acc = accounts.find(a => a.id === val);
        if (acc) {
          target.accountId = acc.id;
          target.accountName = acc.name;
        }
      } else if (field === 'debit') {
        target.debit = Number(val) || 0;
        if (target.debit > 0) target.credit = 0;
      } else if (field === 'credit') {
        target.credit = Number(val) || 0;
        if (target.credit > 0) target.debit = 0;
      }
      copy[index] = target;
      return copy;
    });
  };

  const handleRemoveEntryRow = (index: number) => {
    if (entries.length <= 2) return;
    setEntries(entries.filter((_, i) => i !== index));
  };

  const handlePostVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBalanced) {
      alert(`Voucher is unbalanced! Debit (₨ ${totalDebit}) must equal Credit (₨ ${totalCredit})`);
      return;
    }

    const prefix = voucherType === 'Payment Voucher' ? 'PV' : voucherType === 'Receive Voucher' ? 'RV' : voucherType === 'Contra Voucher' ? 'CV' : 'JV';
    const vNum = `${prefix}-${Date.now().toString().slice(-4)}`;

    createVoucher({
      voucherNumber: vNum,
      voucherType,
      date: voucherDate,
      amount: totalDebit,
      narration,
      entries
    });

    setVouchers(getVouchers());
    setAccounts(getChartOfAccounts());
    setShowVoucherModal(false);
    setNarration('');
  };

  const handleSaveAccountHead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accCode || !accName) return;

    const newAcc: AccountHead = {
      id: `ACC-${Date.now().toString().slice(-4)}`,
      code: accCode,
      name: accName,
      category: accCategory,
      subCategory: accSubCategory,
      currentBalance: 0
    };

    saveAccountHead(newAcc);
    setAccounts(getChartOfAccounts());
    setShowAddAccountModal(false);
    setAccCode('');
    setAccName('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Accounts, Vouchers & Double-Entry Engine
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Strict debit/credit validation, payment vouchers, receive vouchers & chart of accounts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowVoucherModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-98 shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Create Balanced Voucher</span>
          </button>
          <button
            onClick={() => setShowAddAccountModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 transition"
          >
            <Layers className="h-4 w-4" />
            <span>New Account Head</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-2xs flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold">
          <button
            onClick={() => setActiveTab('Vouchers')}
            className={`px-4 py-1.5 rounded-xl transition ${
              activeTab === 'Vouchers' ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Voucher Register ({vouchers.length})
          </button>
          <button
            onClick={() => setActiveTab('COA')}
            className={`px-4 py-1.5 rounded-xl transition ${
              activeTab === 'COA' ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Chart of Accounts ({accounts.length})
          </button>
        </div>

        <div className="relative max-w-xs">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search vouchers or account names..."
            className="w-full rounded-xl border border-slate-200 pl-10 pr-3.5 py-1.5 text-xs focus:outline-none focus:border-blue-600"
          />
        </div>
      </div>

      {/* Vouchers Register Tab */}
      {activeTab === 'Vouchers' ? (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Voucher #</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Party / Head</th>
                  <th className="py-3 px-4">Narration / Description</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {vouchers.map(v => (
                  <tr key={v.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-700">{v.voucherNumber}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">{v.voucherType}</td>
                    <td className="py-3.5 px-4 text-slate-500">{v.date}</td>
                    <td className="py-3.5 px-4 text-slate-800">{v.partyName || 'General Journal'}</td>
                    <td className="py-3.5 px-4 text-slate-600 truncate max-w-xs">{v.narration}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      ₨ {v.amount.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <Badge variant="success" size="sm">{v.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Chart of Accounts Tree */
        <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4 font-mono">Code</th>
                  <th className="py-3 px-4">Account Title</th>
                  <th className="py-3 px-4">Main Category</th>
                  <th className="py-3 px-4">Sub Category</th>
                  <th className="py-3 px-4 text-right">Current Ledger Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accounts.map(acc => (
                  <tr key={acc.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-700">{acc.code}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{acc.name}</td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        acc.category === 'Asset' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        acc.category === 'Liability' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        acc.category === 'Income' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {acc.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">{acc.subCategory}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      ₨ {acc.currentBalance.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Balanced Voucher Modal */}
      {showVoucherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Create Double-Entry Financial Voucher</h3>
                <p className="text-xs text-slate-400">Enforces Total Debits = Total Credits balancing rule</p>
              </div>
              <button onClick={() => setShowVoucherModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePostVoucher} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Voucher Type *</label>
                  <select
                    value={voucherType}
                    onChange={e => setVoucherType(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-medium"
                  >
                    <option value="Journal Voucher">Journal Voucher (JV)</option>
                    <option value="Payment Voucher">Payment Voucher (PV)</option>
                    <option value="Receive Voucher">Receive Voucher (RV)</option>
                    <option value="Contra Voucher">Contra Voucher (CV - Cash/Bank)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Transaction Date *</label>
                  <input
                    type="date"
                    required
                    value={voucherDate}
                    onChange={e => setVoucherDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Narration / Transaction Description *</label>
                <input
                  type="text"
                  required
                  value={narration}
                  onChange={e => setNarration(e.target.value)}
                  placeholder="e.g. Paid showroom diesel generator maintenance"
                  className="w-full rounded-xl border border-slate-200 p-2.5"
                />
              </div>

              {/* Line Entries */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Voucher Line Items</span>
                  <button
                    type="button"
                    onClick={handleAddEntryRow}
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Row
                  </button>
                </div>

                <div className="p-3 space-y-2.5">
                  {entries.map((entry, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200">
                      <div className="flex-1">
                        <select
                          value={entry.accountId}
                          onChange={e => handleUpdateEntry(idx, 'accountId', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs"
                        >
                          {accounts.map(a => (
                            <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="w-32">
                        <input
                          type="number"
                          min={0}
                          placeholder="Debit (₨)"
                          value={entry.debit || ''}
                          onChange={e => handleUpdateEntry(idx, 'debit', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white p-2 font-mono text-xs text-right font-bold"
                        />
                      </div>

                      <div className="w-32">
                        <input
                          type="number"
                          min={0}
                          placeholder="Credit (₨)"
                          value={entry.credit || ''}
                          onChange={e => handleUpdateEntry(idx, 'credit', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white p-2 font-mono text-xs text-right font-bold"
                        />
                      </div>

                      {entries.length > 2 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveEntryRow(idx)}
                          className="p-1 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Balancing Indicator */}
              <div className={`p-4 rounded-xl border flex items-center justify-between font-mono text-xs ${
                isBalanced ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}>
                <div className="flex items-center gap-2">
                  {isBalanced ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-rose-600" />
                  )}
                  <span className="font-sans font-bold">
                    {isBalanced ? 'Journal is Balanced! (Debits = Credits)' : 'Journal Unbalanced! Adjust entries to balance.'}
                  </span>
                </div>

                <div className="text-right space-x-4">
                  <span>Debits: <strong>₨ {totalDebit.toLocaleString()}</strong></span>
                  <span>Credits: <strong>₨ {totalCredit.toLocaleString()}</strong></span>
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowVoucherModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!isBalanced}
                  className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-2.5 shadow-sm"
                >
                  Post Voucher to General Ledger
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Account Head Modal */}
      {showAddAccountModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Create New Chart of Accounts Head</h3>
            <form onSubmit={handleSaveAccountHead} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Account Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 5006"
                  value={accCode}
                  onChange={e => setAccCode(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Account Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Generator Fuel & Lubricants"
                  value={accName}
                  onChange={e => setAccName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Category</label>
                <select
                  value={accCategory}
                  onChange={e => setAccCategory(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5"
                >
                  <option value="Expense">Expense</option>
                  <option value="Income">Income</option>
                  <option value="Asset">Asset</option>
                  <option value="Liability">Liability</option>
                  <option value="Equity">Equity</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAccountModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 font-bold text-white hover:bg-blue-700 shadow-sm"
                >
                  Save Account Head
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
