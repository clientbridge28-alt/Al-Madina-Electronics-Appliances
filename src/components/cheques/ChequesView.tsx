import React, { useState } from 'react';
import { CreditCard, Plus, Search, CheckCircle, Clock, AlertTriangle, X } from 'lucide-react';
import { getCheques, saveCheque, clearChequeWithAccounting } from '../../services/storage';
import { ChequeRecord } from '../../types/erp';
import { Badge } from '../common/Badge';

export const ChequesView: React.FC = () => {
  const [cheques, setCheques] = useState<ChequeRecord[]>(getCheques());
  const [activeTab, setActiveTab] = useState<'Received' | 'Issued'>('Received');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form
  const [chqNumber, setChqNumber] = useState('');
  const [bankName, setBankName] = useState('Meezan Bank Ltd');
  const [partyName, setPartyName] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [chequeDate, setChequeDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

  const filteredCheques = cheques.filter(c => c.type === activeTab);

  const handleSaveCheque = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chqNumber || !partyName || amount <= 0) return;

    const newChq: ChequeRecord = {
      id: `CHQ-${Date.now().toString().slice(-4)}`,
      chequeNumber: chqNumber,
      type: activeTab,
      bankName,
      partyName,
      amount,
      issueDate: new Date().toISOString().split('T')[0],
      chequeDate,
      status: 'Pending',
      remarks
    };

    saveCheque(newChq);
    setCheques(getCheques());
    setShowAddModal(false);
    setChqNumber('');
    setPartyName('');
    setAmount(0);
    setRemarks('');
  };

  const handleUpdateStatus = (chq: ChequeRecord, newStatus: ChequeRecord['status']) => {
    if (newStatus === 'Cleared') {
      const today = new Date().toISOString().split('T')[0];
      clearChequeWithAccounting(chq.id, today);
    } else {
      chq.status = newStatus;
      saveCheque(chq);
    }
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
            Post-dated cheques (PDC), customer security cheques, issued vendor payments & clearance tracking
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-98 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Record New Cheque</span>
        </button>
      </div>

      {/* Tabs */}
      <div className="rounded-2xl bg-white p-3 border border-slate-200 shadow-2xs flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold">
          <button
            onClick={() => setActiveTab('Received')}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === 'Received' ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Customer Cheques Received ({cheques.filter(c => c.type === 'Received').length})
          </button>
          <button
            onClick={() => setActiveTab('Issued')}
            className={`px-4 py-2 rounded-xl transition ${
              activeTab === 'Issued' ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Vendor Cheques Issued ({cheques.filter(c => c.type === 'Issued').length})
          </button>
        </div>
      </div>

      {/* Cheques Table */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4 font-mono">Cheque Number</th>
                <th className="py-3 px-4">Bank Name</th>
                <th className="py-3 px-4">{activeTab === 'Received' ? 'Received From (Customer)' : 'Issued To (Supplier)'}</th>
                <th className="py-3 px-4">Cheque Date</th>
                <th className="py-3 px-4 text-right">Amount (₨)</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredCheques.map(c => (
                <tr key={c.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3.5 px-4 font-bold text-blue-700">{c.chequeNumber}</td>
                  <td className="py-3.5 px-4 font-sans font-semibold text-slate-800">{c.bankName}</td>
                  <td className="py-3.5 px-4 font-sans font-medium text-slate-900">{c.partyName}</td>
                  <td className="py-3.5 px-4 text-slate-600 font-sans">{c.chequeDate}</td>
                  <td className="py-3.5 px-4 text-right font-bold text-slate-900">
                    ₨ {c.amount.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-center font-sans">
                    <Badge variant={c.status === 'Cleared' ? 'success' : c.status === 'Bounced' ? 'danger' : 'warning'} size="sm">
                      {c.status}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 text-right font-sans">
                    {c.status === 'Pending' && (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleUpdateStatus(c, 'Cleared')}
                          className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-[11px] font-semibold"
                        >
                          Clear
                        </button>
                        <button
                          onClick={() => handleUpdateStatus(c, 'Bounced')}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 text-[11px] font-semibold"
                        >
                          Bounce
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Cheque Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Record New {activeTab === 'Received' ? 'Received Customer' : 'Issued Supplier'} Cheque
            </h3>

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
                <label className="block text-slate-700 font-semibold mb-1">Bank Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Meezan Bank, HBL, Bank Alfalah"
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  {activeTab === 'Received' ? 'Customer Name *' : 'Payee / Supplier Name *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sheikh Abdul Rehman"
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
    </div>
  );
};
