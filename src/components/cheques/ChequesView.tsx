import React, { useState, useMemo, useEffect } from 'react';
import { Plus, Search, CheckCircle, AlertTriangle, X, CheckSquare } from 'lucide-react';
import {
  getCheques,
  saveCheque,
  clearChequeWithAccounting,
  bounceChequeWithAccounting,
  reconcileCheque,
  getCustomers,
  getSuppliers,
  getChartOfAccounts,
  subscribeToDatabase,
} from '../../services/storage';
import { ChequeRecord } from '../../types/erp';
import { Badge } from '../common/Badge';

export const ChequesView: React.FC = () => {
  const [cheques, setCheques] = useState<ChequeRecord[]>(getCheques());
  const [customers, setCustomers] = useState(getCustomers());
  const [suppliers, setSuppliers] = useState(getSuppliers());
  const [accounts, setAccounts] = useState(getChartOfAccounts());

  useEffect(() => {
    return subscribeToDatabase(() => {
      setCheques([...getCheques()]);
      setCustomers([...getCustomers()]);
      setSuppliers([...getSuppliers()]);
      setAccounts([...getChartOfAccounts()]);
    });
  }, []);

  const [activeTab, setActiveTab] = useState<'Received' | 'Issued'>('Received');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [bounceTarget, setBounceTarget] = useState<ChequeRecord | null>(null);
  const [bounceReason, setBounceReason] = useState('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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

  // Add Form
  const [chqNumber, setChqNumber] = useState('');
  const [bankAccountId, setBankAccountId] = useState('ACC-102');
  const [bankName, setBankName] = useState('Meezan Bank Ltd');
  const [partyId, setPartyId] = useState('');
  const [partyName, setPartyName] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [chequeDate, setChequeDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  const filteredCheques = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return cheques.filter(c => {
      const matchTab = c.type === activeTab;
      const matchStatus = statusFilter === 'All' || c.status === statusFilter;
      const matchQuery =
        !q ||
        c.chequeNumber.toLowerCase().includes(q) ||
        c.partyName.toLowerCase().includes(q) ||
        c.bankName.toLowerCase().includes(q);
      return matchTab && matchStatus && matchQuery;
    });
  }, [cheques, activeTab, statusFilter, searchQuery]);

  const handleSaveCheque = (e: React.FormEvent) => {
    e.preventDefault();
    const resolvedName = partyName.trim();
    if (!chqNumber.trim() || !resolvedName || amount <= 0) return;

    const newChq: ChequeRecord = {
      id: `CHQ-${Date.now().toString().slice(-4)}`,
      chequeNumber: chqNumber.trim(),
      type: activeTab,
      bankName: bankName.trim(),
      bankAccountId: bankAccountId || undefined,
      partyId: partyId || undefined,
      partyType: activeTab === 'Received' ? 'Customer' : 'Supplier',
      partyName: resolvedName,
      amount,
      issueDate: new Date().toISOString().split('T')[0],
      chequeDate,
      status: 'Pending',
      reconciled: false,
      remarks,
    };

    saveCheque(newChq);
    setCheques(getCheques());
    setShowAddModal(false);
    setChqNumber('');
    setPartyId('');
    setPartyName('');
    setAmount(0);
    setRemarks('');
    setNotice({ type: 'success', text: `Cheque #${newChq.chequeNumber} recorded.` });
  };

  const handleClearCheque = (chq: ChequeRecord) => {
    const today = new Date().toISOString().split('T')[0];
    const ok = clearChequeWithAccounting(chq.id, today, chq.bankAccountId || 'ACC-102');
    if (ok) {
      setCheques(getCheques());
      setNotice({
        type: 'success',
        text: `Cheque #${chq.chequeNumber} cleared and double-entry bank voucher posted.`,
      });
    }
  };

  const handleConfirmBounce = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bounceTarget) return;
    const today = new Date().toISOString().split('T')[0];
    const ok = bounceChequeWithAccounting(
      bounceTarget.id,
      today,
      bounceReason.trim() || 'Dishonored / Insufficient funds'
    );
    if (ok) {
      setCheques(getCheques());
      setNotice({
        type: 'success',
        text: `Cheque #${bounceTarget.chequeNumber} marked Bounced${
          bounceTarget.status === 'Cleared' ? ' with reversal voucher and party balance restoration' : ''
        }.`,
      });
    }
    setBounceTarget(null);
    setBounceReason('');
  };

  const handleToggleReconcile = (chq: ChequeRecord) => {
    const today = new Date().toISOString().split('T')[0];
    reconcileCheque(chq.id, today, !chq.reconciled);
    setCheques(getCheques());
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Cheque Management & Clearing Register
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Post-dated cheques (PDC), bank clearing, bounce reversals & bank statement reconciliation
          </p>
        </div>

        <button
          onClick={() => {
            setPartyId('');
            setPartyName('');
            setShowAddModal(true);
          }}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-98 whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Record New Cheque</span>
        </button>
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
              <AlertTriangle className="h-4 w-4 text-rose-600" />
            ) : (
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            )}
            <span>{notice.text}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Tabs & Filters */}
      <div className="rounded-2xl bg-white p-3 border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs font-bold">
          <button
            onClick={() => setActiveTab('Received')}
            className={`px-4 py-2 rounded-xl transition whitespace-nowrap shrink-0 ${
              activeTab === 'Received' ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Customer Cheques Received ({cheques.filter(c => c.type === 'Received').length})
          </button>
          <button
            onClick={() => setActiveTab('Issued')}
            className={`px-4 py-2 rounded-xl transition whitespace-nowrap shrink-0 ${
              activeTab === 'Issued' ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Vendor Cheques Issued ({cheques.filter(c => c.type === 'Issued').length})
          </button>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700"
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Deposited">Deposited</option>
            <option value="Cleared">Cleared</option>
            <option value="Bounced">Bounced</option>
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search cheque #, party..."
              className="rounded-xl border border-slate-200 pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:border-blue-600"
            />
          </div>
        </div>
      </div>

      {/* Cheques Table */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4 font-mono">Cheque Number</th>
                <th className="py-3 px-4">Bank Account</th>
                <th className="py-3 px-4">{activeTab === 'Received' ? 'Received From (Customer)' : 'Issued To (Supplier)'}</th>
                <th className="py-3 px-4">Maturity Date</th>
                <th className="py-3 px-4 text-right">Amount (₨)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Bank Rec.</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredCheques.map(c => (
                <tr key={c.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3.5 px-4 font-bold text-blue-700">{c.chequeNumber}</td>
                  <td className="py-3.5 px-4 font-sans font-semibold text-slate-800">{c.bankName}</td>
                  <td className="py-3.5 px-4 font-sans font-medium text-slate-900">
                    <div>{c.partyName}</div>
                    {c.remarks && <div className="text-[10px] text-slate-400 truncate max-w-xs">{c.remarks}</div>}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 font-sans">{c.chequeDate}</td>
                  <td className="py-3.5 px-4 text-right tabular-nums font-bold text-slate-900">
                    ₨ {c.amount.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-center font-sans">
                    <Badge
                      variant={c.status === 'Cleared' ? 'success' : c.status === 'Bounced' ? 'danger' : 'warning'}
                      size="sm"
                    >
                      {c.status}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 text-center font-sans">
                    {c.status === 'Cleared' ? (
                      <button
                        onClick={() => handleToggleReconcile(c)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${
                          c.reconciled
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <CheckSquare className="h-3 w-3" />
                        <span>{c.reconciled ? 'Reconciled' : 'Mark Rec.'}</span>
                      </button>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right font-sans">
                    <div className="flex items-center justify-end gap-1.5">
                      {(c.status === 'Pending' || c.status === 'Deposited') && (
                        <button
                          onClick={() => handleClearCheque(c)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-[11px] font-semibold"
                        >
                          Clear
                        </button>
                      )}
                      {(c.status === 'Pending' || c.status === 'Deposited' || c.status === 'Cleared') && (
                        <button
                          onClick={() => {
                            setBounceTarget(c);
                            setBounceReason('');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-[11px] font-semibold"
                        >
                          Bounce
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCheques.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-8 text-center font-sans text-slate-400">
                    No cheques match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Cheque Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">
                Record New {activeTab === 'Received' ? 'Received Customer' : 'Issued Supplier'} Cheque
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCheque} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Cheque Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 9482019"
                  value={chqNumber}
                  onChange={e => setChqNumber(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Clearing Bank Account *</label>
                <select
                  value={bankAccountId}
                  onChange={e => {
                    const acc = bankAccounts.find(a => a.id === e.target.value);
                    setBankAccountId(e.target.value);
                    if (acc) setBankName(acc.name);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5"
                >
                  {bankAccounts.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.code} - {b.name}
                    </option>
                  ))}
                  {bankAccounts.length === 0 && <option value="ACC-102">Meezan Bank Ltd</option>}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Link {activeTab === 'Received' ? 'Customer' : 'Supplier'} Profile
                </label>
                <select
                  value={partyId}
                  onChange={e => {
                    const id = e.target.value;
                    setPartyId(id);
                    if (activeTab === 'Received') {
                      const c = customers.find(x => x.id === id);
                      if (c) setPartyName(c.name);
                    } else {
                      const s = suppliers.find(x => x.id === id);
                      if (s) setPartyName(s.companyName);
                    }
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 mb-2"
                >
                  <option value="">-- Select from Directory (Optional) --</option>
                  {activeTab === 'Received'
                    ? customers.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.phone})
                        </option>
                      ))
                    : suppliers.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.companyName}
                        </option>
                      ))}
                </select>
                <input
                  type="text"
                  required
                  placeholder={activeTab === 'Received' ? 'Customer Name *' : 'Payee / Supplier Name *'}
                  value={partyName}
                  onChange={e => setPartyName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Cheque Amount (₨) *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={amount || ''}
                    onChange={e => setAmount(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Cheque Maturity Date</label>
                  <input
                    type="date"
                    required
                    value={chequeDate}
                    onChange={e => setChequeDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Remarks / Note</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={e => setRemarks(e.target.value)}
                  placeholder="e.g. Installment security deposit"
                  className="w-full rounded-xl border border-slate-200 p-2.5"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 font-bold text-white hover:bg-blue-700 shadow-sm"
                >
                  Save Cheque Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bounce Cheque Modal */}
      {bounceTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Mark Cheque #{bounceTarget.chequeNumber} as Bounced
              </h3>
              <button onClick={() => setBounceTarget(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              {bounceTarget.status === 'Cleared'
                ? 'This cheque was previously cleared. Marking it bounced will post a double-entry reversal voucher and restore the party balance.'
                : 'Recording bounce status for audit and recovery tracking.'}
            </p>
            <form onSubmit={handleConfirmBounce} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Bank Return Reason *</label>
                <input
                  type="text"
                  required
                  value={bounceReason}
                  onChange={e => setBounceReason(e.target.value)}
                  placeholder="e.g. Insufficient funds / Signature mismatch"
                  className="w-full rounded-xl border border-slate-200 p-2.5"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBounceTarget(null)}
                  className="flex-1 rounded-xl border border-slate-200 py-2 font-medium text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 py-2 font-bold text-white"
                >
                  Confirm Bounce
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
