import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus, Search, CheckCircle2,
  AlertTriangle, X, Trash2, Layers, RotateCcw
} from 'lucide-react';
import {
  getChartOfAccounts,
  getVouchers,
  createVoucher,
  reverseVoucher,
  saveAccountHead,
  getCustomers,
  getSuppliers,
  subscribeToDatabase,
} from '../../services/storage';
import { AccountHead, Voucher, VoucherEntry } from '../../types/erp';
import { Badge } from '../common/Badge';

export const AccountingView: React.FC = () => {
  const [accounts, setAccounts] = useState<AccountHead[]>(getChartOfAccounts());
  const [vouchers, setVouchers] = useState<Voucher[]>(getVouchers());
  const [customers, setCustomers] = useState(getCustomers());
  const [suppliers, setSuppliers] = useState(getSuppliers());
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    return subscribeToDatabase(() => {
      setAccounts([...getChartOfAccounts()]);
      setVouchers([...getVouchers()]);
      setCustomers([...getCustomers()]);
      setSuppliers([...getSuppliers()]);
    });
  }, []);

  const [activeTab, setActiveTab] = useState<'Vouchers' | 'COA'>('Vouchers');
  const [searchQuery, setSearchQuery] = useState('');
  const [voucherTypeFilter, setVoucherTypeFilter] = useState<string>('All');
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);

  // Reversal modal
  const [reversingVoucher, setReversingVoucher] = useState<Voucher | null>(null);
  const [reversalReason, setReversalReason] = useState('');

  // New Voucher Form
  const [voucherType, setVoucherType] = useState<Voucher['voucherType']>('Journal Voucher');
  const [voucherDate, setVoucherDate] = useState(new Date().toISOString().split('T')[0]);
  const [narration, setNarration] = useState('');
  const [partyType, setPartyType] = useState<'General' | 'Customer' | 'Supplier'>('General');
  const [partyId, setPartyId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank' | 'Cheque' | 'Journal'>('Journal');
  const [entries, setEntries] = useState<VoucherEntry[]>([
    { accountId: accounts[0]?.id || '', accountName: accounts[0]?.name || '', debit: 50000, credit: 0 },
    { accountId: accounts[1]?.id || '', accountName: accounts[1]?.name || '', debit: 0, credit: 50000 },
  ]);

  // New Account Form
  const [accCode, setAccCode] = useState('');
  const [accName, setAccName] = useState('');
  const [accCategory, setAccCategory] = useState<AccountHead['category']>('Expense');
  const [accSubCategory, setAccSubCategory] = useState('Operating Expense');

  const filteredVouchers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return vouchers.filter(v => {
      const matchType = voucherTypeFilter === 'All' || v.voucherType === voucherTypeFilter;
      const matchQuery =
        !q ||
        v.voucherNumber.toLowerCase().includes(q) ||
        v.voucherType.toLowerCase().includes(q) ||
        (v.narration || '').toLowerCase().includes(q) ||
        (v.partyName || '').toLowerCase().includes(q) ||
        (v.status || '').toLowerCase().includes(q);
      return matchType && matchQuery;
    });
  }, [vouchers, searchQuery, voucherTypeFilter]);

  const filteredAccounts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      acc =>
        acc.code.toLowerCase().includes(q) ||
        acc.name.toLowerCase().includes(q) ||
        acc.category.toLowerCase().includes(q) ||
        acc.subCategory.toLowerCase().includes(q)
    );
  }, [accounts, searchQuery]);

  // Balancing totals
  const totalDebit = entries.reduce((sum, e) => sum + (Number(e.debit) || 0), 0);
  const totalCredit = entries.reduce((sum, e) => sum + (Number(e.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const handleAddEntryRow = () => {
    const firstAcc = accounts[0];
    if (!firstAcc) return;
    setEntries([
      ...entries,
      { accountId: firstAcc.id, accountName: firstAcc.name, debit: 0, credit: 0 },
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
    setVoucherError(null);
    if (!isBalanced) {
      setVoucherError(
        `Voucher is unbalanced! Debit (₨ ${totalDebit.toLocaleString()}) must equal Credit (₨ ${totalCredit.toLocaleString()})`
      );
      return;
    }

    let resolvedPartyName: string | undefined;
    let resolvedPartyType: Voucher['partyType'] | undefined;
    let resolvedPartyId: string | undefined;

    if (partyType === 'Customer' && partyId) {
      const c = customers.find(x => x.id === partyId);
      if (c) {
        resolvedPartyType = 'Customer';
        resolvedPartyId = c.id;
        resolvedPartyName = c.name;
      }
    } else if (partyType === 'Supplier' && partyId) {
      const s = suppliers.find(x => x.id === partyId);
      if (s) {
        resolvedPartyType = 'Supplier';
        resolvedPartyId = s.id;
        resolvedPartyName = s.companyName;
      }
    }

    const prefix =
      voucherType === 'Payment Voucher'
        ? 'PV'
        : voucherType === 'Receive Voucher'
        ? 'RV'
        : voucherType === 'Contra Voucher'
        ? 'CV'
        : 'JV';
    const vNum = `${prefix}-${Date.now().toString().slice(-4)}`;

    try {
      const created = createVoucher({
        voucherNumber: vNum,
        voucherType,
        date: voucherDate,
        partyId: resolvedPartyId,
        partyName: resolvedPartyName,
        partyType: resolvedPartyType,
        paymentMethod: paymentMethod === 'Journal' ? undefined : paymentMethod,
        amount: totalDebit,
        narration,
        entries,
      });

      setVouchers(getVouchers());
      setAccounts(getChartOfAccounts());
      setShowVoucherModal(false);
      setNarration('');
      setPartyType('General');
      setPartyId('');
      setVoucherError(null);
      setNotice({ type: 'success', text: `Voucher #${created.voucherNumber} posted cleanly to General Ledger.` });
    } catch (err: any) {
      setVoucherError(err?.message || 'Failed to post voucher.');
    }
  };

  const handleConfirmReverseVoucher = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversingVoucher) return;
    try {
      const rev = reverseVoucher(reversingVoucher.id, reversalReason.trim() || 'Correction / reversal');
      setVouchers(getVouchers());
      setAccounts(getChartOfAccounts());
      setReversingVoucher(null);
      setReversalReason('');
      setNotice({
        type: 'success',
        text: `Voucher #${reversingVoucher.voucherNumber} reversed via #${rev.voucherNumber}.`,
      });
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Could not reverse voucher.' });
      setReversingVoucher(null);
    }
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
      currentBalance: 0,
    };

    saveAccountHead(newAcc);
    setAccounts(getChartOfAccounts());
    setShowAddAccountModal(false);
    setAccCode('');
    setAccName('');
    setNotice({ type: 'success', text: `Account head ${newAcc.code} - ${newAcc.name} added.` });
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
            Strict debit/credit validation, party-linked vouchers, reversals & chart of accounts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowVoucherModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-98 whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Create Balanced Voucher</span>
          </button>
          <button
            onClick={() => setShowAddAccountModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 transition whitespace-nowrap shrink-0"
          >
            <Layers className="h-4 w-4" />
            <span>New Account Head</span>
          </button>
        </div>
      </div>

      {notice && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            notice.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === 'error' ? (
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            )}
            <span>{notice.text}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs font-bold">
          <button
            onClick={() => setActiveTab('Vouchers')}
            className={`px-4 py-1.5 rounded-xl transition whitespace-nowrap shrink-0 ${
              activeTab === 'Vouchers'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Voucher Register ({vouchers.length})
          </button>
          <button
            onClick={() => setActiveTab('COA')}
            className={`px-4 py-1.5 rounded-xl transition whitespace-nowrap shrink-0 ${
              activeTab === 'COA'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Chart of Accounts ({accounts.length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'Vouchers' && (
            <select
              value={voucherTypeFilter}
              onChange={e => setVoucherTypeFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-blue-600"
            >
              <option value="All">All Types</option>
              <option value="Journal Voucher">Journal Voucher</option>
              <option value="Payment Voucher">Payment Voucher</option>
              <option value="Receive Voucher">Receive Voucher</option>
              <option value="Contra Voucher">Contra Voucher</option>
            </select>
          )}
          <div className="relative max-w-xs">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={activeTab === 'Vouchers' ? 'Search vouchers, parties...' : 'Search account code or name...'}
              className="w-full rounded-xl border border-slate-200 pl-10 pr-3.5 py-1.5 text-xs focus:outline-none focus:border-blue-600"
            />
          </div>
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
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVouchers.map(v => {
                  const isCancelled = v.status === 'Cancelled' || Boolean(v.reversedByVoucherId);
                  const isReversalVoucher = Boolean(v.sourceRef?.startsWith('REV-'));
                  return (
                    <tr key={v.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-700">{v.voucherNumber}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-800">{v.voucherType}</td>
                      <td className="py-3.5 px-4 text-slate-500 font-mono tabular-nums">{v.date}</td>
                      <td className="py-3.5 px-4 text-slate-800">
                        <span>{v.partyName || 'General Journal'}</span>
                        {v.partyType && (
                          <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {v.partyType}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate" title={v.narration}>
                        {v.narration}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                        ₨ {v.amount.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Badge variant={isCancelled ? 'danger' : 'success'} size="sm">
                          {v.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {!isCancelled && !isReversalVoucher ? (
                          <button
                            onClick={() => {
                              setReversingVoucher(v);
                              setReversalReason('');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-semibold"
                            title="Post Reversal Voucher"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>Reverse</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {v.reversedByVoucherId ? `Rev: ${v.reversedByVoucherId}` : isReversalVoucher ? 'Reversal' : '—'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredVouchers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                      No matching vouchers found.
                    </td>
                  </tr>
                )}
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
                {filteredAccounts.map(acc => (
                  <tr key={acc.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-700">{acc.code}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{acc.name}</td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          acc.category === 'Asset'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : acc.category === 'Liability'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : acc.category === 'Income'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {acc.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">{acc.subCategory}</td>
                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                      ₨ {acc.currentBalance.toLocaleString()}
                    </td>
                  </tr>
                ))}
                {filteredAccounts.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">
                      No matching account heads found.
                    </td>
                  </tr>
                )}
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
                <p className="text-xs text-slate-400">Enforces Total Debits = Total Credits & party ledger sync</p>
              </div>
              <button onClick={() => setShowVoucherModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handlePostVoucher} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Settlement Method</label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-medium"
                  >
                    <option value="Journal">Journal / Adjustment</option>
                    <option value="Cash">Cash</option>
                    <option value="Bank">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Party Link (Optional)</label>
                  <select
                    value={partyType}
                    onChange={e => {
                      setPartyType(e.target.value as any);
                      setPartyId('');
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-medium"
                  >
                    <option value="General">General Account Entry</option>
                    <option value="Customer">Customer (Syncs Receivable Ledger)</option>
                    <option value="Supplier">Supplier (Syncs Payable Ledger)</option>
                  </select>
                </div>

                {partyType !== 'General' && (
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Select {partyType} *
                    </label>
                    <select
                      required
                      value={partyId}
                      onChange={e => setPartyId(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-medium"
                    >
                      <option value="">Choose {partyType}...</option>
                      {partyType === 'Customer'
                        ? customers.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.name} (Bal: ₨ {c.currentBalance.toLocaleString()})
                            </option>
                          ))
                        : suppliers.map(s => (
                            <option key={s.id} value={s.id}>
                              {s.companyName} (Bal: ₨ {s.currentBalance.toLocaleString()})
                            </option>
                          ))}
                    </select>
                  </div>
                )}
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
                            <option key={a.id} value={a.id}>
                              {a.code} - {a.name}
                            </option>
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

              {voucherError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{voucherError}</span>
                </div>
              )}

              {/* Balancing Indicator */}
              <div
                className={`p-4 rounded-xl border flex items-center justify-between font-mono text-xs ${
                  isBalanced
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  {isBalanced ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-rose-600" />
                  )}
                  <span className="font-sans font-bold">
                    {isBalanced
                      ? 'Journal is Balanced! (Debits = Credits)'
                      : 'Journal Unbalanced! Adjust entries to balance.'}
                  </span>
                </div>

                <div className="text-right space-x-4">
                  <span>
                    Debits: <strong>₨ {totalDebit.toLocaleString()}</strong>
                  </span>
                  <span>
                    Credits: <strong>₨ {totalCredit.toLocaleString()}</strong>
                  </span>
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

      {/* Voucher Reversal Confirmation Modal */}
      {reversingVoucher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Reverse Voucher #{reversingVoucher.voucherNumber}
              </h3>
              <button onClick={() => setReversingVoucher(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              This will mark voucher <strong>{reversingVoucher.voucherNumber}</strong> (₨{' '}
              {reversingVoucher.amount.toLocaleString()}) as Cancelled and post an equal opposite reversal voucher to the
              General Ledger.
            </p>
            <form onSubmit={handleConfirmReverseVoucher} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Reversal Reason *</label>
                <input
                  type="text"
                  required
                  value={reversalReason}
                  onChange={e => setReversalReason(e.target.value)}
                  placeholder="e.g. Posted against incorrect expense head"
                  className="w-full rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReversingVoucher(null)}
                  className="flex-1 rounded-xl border border-slate-200 py-2 font-medium text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 py-2 font-bold text-white"
                >
                  Confirm & Post Reversal
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

              <div className="grid grid-cols-2 gap-3">
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
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Sub-Category</label>
                  <input
                    type="text"
                    value={accSubCategory}
                    onChange={e => setAccSubCategory(e.target.value)}
                    placeholder="Operating Expense"
                    className="w-full rounded-xl border border-slate-200 p-2.5"
                  />
                </div>
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
