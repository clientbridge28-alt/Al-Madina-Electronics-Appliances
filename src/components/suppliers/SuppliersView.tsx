import React, { useState, useMemo } from 'react';
import { Truck, Plus, Search, Phone, FileText, X, Printer, DollarSign } from 'lucide-react';
import { getSuppliers, saveSupplier, getSupplierLedgerEntries, createVoucher } from '../../services/storage';
import { Supplier } from '../../types/erp';
import { Badge } from '../common/Badge';

export const SuppliersView: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>(getSuppliers());

  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // New Supplier Form
  const [companyName, setCompanyName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [ntn, setNtn] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('30 Days Credit');

  // Supplier Pay Form
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payMethod, setPayMethod] = useState<'Cash' | 'Bank'>('Bank');
  const [payNarration, setPayNarration] = useState('');

  const totalPayables = useMemo(() => 
    suppliers.reduce((sum, s) => sum + s.currentBalance, 0), [suppliers]);

  const handleSaveSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName || !phone) return;

    const newSupp: Supplier = {
      id: `SUP-${Date.now().toString().slice(-4)}`,
      companyName,
      contactPerson,
      phone,
      email,
      address,
      city: 'Lahore',
      ntn,
      openingBalance: 0,
      currentBalance: 0,
      paymentTerms,
      createdAt: new Date().toISOString().split('T')[0]
    };

    saveSupplier(newSupp);
    setSuppliers(getSuppliers());
    setShowAddModal(false);
  };

  const handleRecordPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || payAmount <= 0) return;

    createVoucher({
      voucherNumber: `PV-${Date.now().toString().slice(-4)}`,
      voucherType: 'Payment Voucher',
      date: new Date().toISOString().split('T')[0],
      partyType: 'Supplier',
      partyId: selectedSupplier.id,
      partyName: selectedSupplier.companyName,
      amount: payAmount,
      paymentMethod: payMethod,
      narration: payNarration || `Payment to ${selectedSupplier.companyName} via ${payMethod}`,
      entries: [
        {
          accountId: 'ACC-201',
          accountName: 'Accounts Payable (Distributors & Suppliers)',
          debit: payAmount,
          credit: 0
        },
        {
          accountId: payMethod === 'Bank' ? 'ACC-102' : 'ACC-101',
          accountName: payMethod === 'Bank' ? 'Meezan Bank - Current A/C' : 'Cash in Hand (Showroom Drawer)',
          debit: 0,
          credit: payAmount
        }
      ]
    });

    selectedSupplier.currentBalance = Math.max(0, selectedSupplier.currentBalance - payAmount);
    saveSupplier(selectedSupplier);
    setSuppliers(getSuppliers());
    setShowPayModal(false);
    setPayAmount(0);
    setPayNarration('');
  };

  const filteredSuppliers = suppliers.filter(s =>
    s.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.contactPerson.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.phone.includes(searchQuery)
  );

  const supplierLedger = selectedCustomerLedger(selectedSupplier?.id);

  function selectedCustomerLedger(suppId?: string) {
    if (!suppId) return [];
    return getSupplierLedgerEntries(suppId);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Suppliers & Vendor Accounts
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Distributors, wholesale terms, company NTN & accounts payable statements
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-98 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Supplier</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Registered Suppliers</span>
          <p className="text-2xl font-black text-slate-900 font-mono mt-1">{suppliers.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">Official manufacturer distributors</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Outstanding Payables</span>
          <p className="text-2xl font-black text-rose-700 font-mono mt-1">
            ₨ {totalPayables.toLocaleString()}
          </p>
          <p className="text-xs text-rose-600 mt-0.5 font-medium">Creditor obligations across all brands</p>
        </div>
      </div>

      {/* Search */}
      <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-2xs flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search suppliers by name or phone..."
            className="w-full rounded-xl border border-slate-200 pl-10 pr-3.5 py-1.5 text-xs focus:outline-none focus:border-blue-600"
          />
        </div>
        <span className="text-xs text-slate-400 font-medium">
          Showing {filteredSuppliers.length} suppliers
        </span>
      </div>

      {/* Suppliers Table */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Supplier ID</th>
                <th className="py-3 px-4">Company Name</th>
                <th className="py-3 px-4">Contact Person</th>
                <th className="py-3 px-4">Phone / WhatsApp</th>
                <th className="py-3 px-4 font-mono">NTN</th>
                <th className="py-3 px-4">Payment Terms</th>
                <th className="py-3 px-4 text-right">Payable Balance</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSuppliers.map(s => (
                <tr key={s.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3.5 px-4 font-mono font-bold text-blue-700">{s.id}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">{s.companyName}</td>
                  <td className="py-3.5 px-4 text-slate-700">{s.contactPerson}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-600">{s.phone}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-500">{s.ntn || '—'}</td>
                  <td className="py-3.5 px-4 text-slate-500">{s.paymentTerms}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-700">
                    ₨ {s.currentBalance.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => { setSelectedSupplier(s); setPayAmount(Math.min(s.currentBalance, 100000)); setShowPayModal(true); }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-semibold text-[11px]"
                      >
                        Pay Vendor
                      </button>
                      <button
                        onClick={() => setSelectedSupplier(s)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-[11px]"
                      >
                        Ledger
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Supplier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Add New Supplier / Distributor</h3>
            <form onSubmit={handleSaveSupplier} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Company / Brand Name *</label>
                <input
                  type="text"
                  required
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="e.g. Kenwood Home Appliances Ltd"
                  className="w-full rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Contact Person & Title</label>
                <input
                  type="text"
                  value={contactPerson}
                  onChange={e => setContactPerson(e.target.value)}
                  placeholder="e.g. Mian Waqar (Area Sales Mgr)"
                  className="w-full rounded-xl border border-slate-200 p-2.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Mobile Phone *</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="0300-1234567"
                    className="w-full rounded-xl border border-slate-200 p-2.5"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">NTN Number</label>
                  <input
                    type="text"
                    value={ntn}
                    onChange={e => setNtn(e.target.value)}
                    placeholder="1234567-8"
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Warehouse / Depot Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="e.g. Multan Road Hub, Lahore"
                  className="w-full rounded-xl border border-slate-200 p-2.5"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Payment Terms</label>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={e => setPaymentTerms(e.target.value)}
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
                  Save Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Supplier Modal */}
      {showPayModal && selectedSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Record Vendor Payment Voucher</h3>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <p className="font-bold text-slate-900">{selectedSupplier.companyName}</p>
              <p className="text-rose-700 font-mono font-bold mt-1">
                Outstanding Balance: ₨ {selectedSupplier.currentBalance.toLocaleString()}
              </p>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Payment Amount (₨) *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={payAmount || ''}
                  onChange={e => setPayAmount(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Payment Account</label>
                <select
                  value={payMethod}
                  onChange={e => setPayMethod(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5"
                >
                  <option value="Bank">Meezan Bank - Current A/C (Online Transfer)</option>
                  <option value="Cash">Cash Drawer</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Narration / Cheque Ref</label>
                <input
                  type="text"
                  value={payNarration}
                  onChange={e => setPayNarration(e.target.value)}
                  placeholder="e.g. Paid online transfer ref # 99281"
                  className="w-full rounded-xl border border-slate-200 p-2.5"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPayModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 font-bold text-white hover:bg-emerald-700 shadow-sm"
                >
                  Post Payment Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Ledger Modal */}
      {selectedSupplier && !showPayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Supplier Ledger: {selectedSupplier.companyName}
                </h3>
                <p className="text-xs text-slate-500 font-mono">NTN: {selectedSupplier.ntn || 'N/A'}</p>
              </div>
              <button onClick={() => setSelectedSupplier(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Voucher #</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-right">Debit (Paid)</th>
                    <th className="py-2.5 px-3 text-right">Credit (Purchased)</th>
                    <th className="py-2.5 px-3 text-right">Balance Due</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {supplierLedger.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-sans text-slate-600">{row.date}</td>
                      <td className="py-2.5 px-3 font-bold text-blue-700">{row.voucherNo}</td>
                      <td className="py-2.5 px-3 font-sans text-slate-800">{row.description}</td>
                      <td className="py-2.5 px-3 text-right text-emerald-700">{row.debit > 0 ? `₨ ${row.debit.toLocaleString()}` : '—'}</td>
                      <td className="py-2.5 px-3 text-right text-slate-900">{row.credit > 0 ? `₨ ${row.credit.toLocaleString()}` : '—'}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-rose-700">₨ {row.balance.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
