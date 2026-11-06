import React, { useState, useMemo } from 'react';
import { 
  Users, Plus, Search, Phone, FileText, 
  Calendar, CreditCard, X, Printer, ArrowRight 
} from 'lucide-react';
import { 
  getCustomers, saveCustomer, getSales, 
  getInstallmentAccounts, getCustomerLedgerEntries, getSettings 
} from '../../services/storage';
import { Customer } from '../../types/erp';
import { Badge } from '../common/Badge';

export const CustomersView: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>(getCustomers());
  const sales = getSales();
  const installments = getInstallmentAccounts();
  const settings = getSettings();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Retail' | 'Installment' | 'Credit'>('All');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [profileTab, setProfileTab] = useState<'Overview' | 'Sales' | 'Installments' | 'Ledger'>('Overview');

  // New Customer Form
  const [name, setName] = useState('');
  const [fatherName, setFatherName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [cnic, setCnic] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('Lahore');
  const [creditLimit, setCreditLimit] = useState(200000);
  const [customerType, setCustomerType] = useState<'Retail' | 'Installment' | 'Credit'>('Retail');

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => {
      const matchType = typeFilter === 'All' || c.customerType === typeFilter;
      const q = searchQuery.toLowerCase();
      const matchQuery = !q ||
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.cnic.includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q);
      return matchType && matchQuery;
    });
  }, [customers, typeFilter, searchQuery]);

  const totalReceivables = useMemo(() => 
    customers.reduce((sum, c) => sum + c.currentBalance, 0), [customers]);

  const handleSaveCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return;

    const newCust: Customer = {
      id: `CUST-${Date.now().toString().slice(-4)}`,
      name,
      fatherName,
      phone,
      whatsapp: whatsapp || phone,
      cnic: cnic || '35202-0000000-0',
      address,
      city,
      openingBalance: 0,
      currentBalance: 0,
      creditLimit: Number(creditLimit),
      customerType,
      createdAt: new Date().toISOString().split('T')[0]
    };

    saveCustomer(newCust);
    setCustomers(getCustomers());
    setShowAddModal(false);
    setName('');
    setFatherName('');
    setPhone('');
    setWhatsapp('');
    setCnic('');
    setAddress('');
  };

  // Profile data for selected customer
  const customerSales = selectedCustomer ? sales.filter(s => s.customerId === selectedCustomer.id) : [];
  const customerInstallments = selectedCustomer ? installments.filter(i => i.customerId === selectedCustomer.id) : [];
  const customerLedger = selectedCustomer ? getCustomerLedgerEntries(selectedCustomer.id) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Customer Directory & Ledgers
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Profiles, credit limits, CNIC verification, purchase history & account statements
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-98 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Customer</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Customers</span>
          <p className="text-2xl font-black text-slate-900 font-mono mt-1">{customers.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">Retail, Credit & Installment accounts</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Outstanding Due</span>
          <p className="text-2xl font-black text-slate-900 font-mono mt-1">
            ₨ {totalReceivables.toLocaleString()}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Receivable balances across showroom</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Installment Accounts</span>
          <p className="text-2xl font-black text-blue-700 font-mono mt-1">
            {installments.length}
          </p>
          <p className="text-xs text-blue-600 mt-0.5 font-medium">Financed customer portfolios</p>
        </div>
      </div>

      {/* Filter & Search */}
      <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold text-slate-600">
          {(['All', 'Retail', 'Installment', 'Credit'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setTypeFilter(tab)}
              className={`px-3 py-1.5 rounded-xl transition ${
                typeFilter === tab ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 hover:bg-slate-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, CNIC, phone, address..."
            className="w-full rounded-xl border border-slate-200 pl-10 pr-3.5 py-1.5 text-xs focus:outline-none focus:border-blue-600"
          />
        </div>
      </div>

      {/* Customers Table */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Customer ID</th>
                <th className="py-3 px-4">Full Name & Father Name</th>
                <th className="py-3 px-4">Phone / WhatsApp</th>
                <th className="py-3 px-4 font-mono">CNIC Number</th>
                <th className="py-3 px-4">Address</th>
                <th className="py-3 px-4 text-right">Balance Due</th>
                <th className="py-3 px-4 text-center">Type</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.map(c => (
                <tr key={c.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3.5 px-4 font-mono font-bold text-blue-700">{c.id}</td>
                  <td className="py-3.5 px-4">
                    <p className="font-bold text-slate-900">{c.name}</p>
                    {c.fatherName && <p className="text-[10px] text-slate-400">S/O {c.fatherName}</p>}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-600">
                    <p>{c.phone}</p>
                    {c.whatsapp && <p className="text-[10px] text-emerald-600">WA: {c.whatsapp}</p>}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-slate-600">{c.cnic}</td>
                  <td className="py-3.5 px-4 text-slate-500 truncate max-w-xs">{c.address}, {c.city}</td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold">
                    <span className={c.currentBalance > 0 ? 'text-rose-700' : 'text-slate-700'}>
                      ₨ {c.currentBalance.toLocaleString()}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <Badge variant={c.customerType === 'Installment' ? 'purple' : c.customerType === 'Credit' ? 'warning' : 'neutral'} size="sm">
                      {c.customerType}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => { setSelectedCustomer(c); setProfileTab('Overview'); }}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-[11px]"
                    >
                      View Profile
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Register New Customer</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Chaudhry Tariq"
                    className="w-full rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Father / Husband Name</label>
                  <input
                    type="text"
                    value={fatherName}
                    onChange={e => setFatherName(e.target.value)}
                    placeholder="e.g. Mian Bashir Ahmad"
                    className="w-full rounded-xl border border-slate-200 p-2.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                  <label className="block text-slate-700 font-semibold mb-1">WhatsApp Number</label>
                  <input
                    type="text"
                    value={whatsapp}
                    onChange={e => setWhatsapp(e.target.value)}
                    placeholder="0300-1234567"
                    className="w-full rounded-xl border border-slate-200 p-2.5"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">CNIC Number *</label>
                  <input
                    type="text"
                    required
                    value={cnic}
                    onChange={e => setCnic(e.target.value)}
                    placeholder="35202-1234567-1"
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Customer Type</label>
                  <select
                    value={customerType}
                    onChange={e => setCustomerType(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5"
                  >
                    <option value="Retail">Retail Walk-in</option>
                    <option value="Installment">Installment Buyer</option>
                    <option value="Credit">Wholesale / Credit</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Complete Address *</label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Street, House #, Sector / Area"
                  className="w-full rounded-xl border border-slate-200 p-2.5"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Approved Credit Limit (₨)</label>
                  <input
                    type="number"
                    value={creditLimit}
                    onChange={e => setCreditLimit(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
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
                  Save Customer Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer 360° Profile Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg">
                  {selectedCustomer.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{selectedCustomer.name}</h3>
                  <p className="text-xs text-slate-500">
                    ID: {selectedCustomer.id} • CNIC: {selectedCustomer.cnic} • Type: {selectedCustomer.customerType}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedCustomer(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Profile Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-slate-100 pb-2 text-xs font-semibold">
              {(['Overview', 'Sales', 'Installments', 'Ledger'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setProfileTab(tab)}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    profileTab === tab ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            {profileTab === 'Overview' && (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Phone & WhatsApp</span>
                    <p className="font-semibold text-slate-900 text-sm mt-0.5">{selectedCustomer.phone}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Current Ledger Balance</span>
                    <p className="font-mono font-bold text-rose-700 text-sm mt-0.5">₨ {selectedCustomer.currentBalance.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Residential Address</span>
                    <p className="font-medium text-slate-800 mt-0.5">{selectedCustomer.address}, {selectedCustomer.city}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Approved Credit Limit</span>
                    <p className="font-mono font-semibold text-slate-800 mt-0.5">₨ {selectedCustomer.creditLimit.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            )}

            {profileTab === 'Sales' && (
              <div className="space-y-2 text-xs">
                {customerSales.length === 0 ? (
                  <p className="text-center py-8 text-slate-400">No purchase invoices found for this customer.</p>
                ) : (
                  customerSales.map(s => (
                    <div key={s.id} className="p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-900">Invoice #{s.invoiceNumber} ({s.date})</p>
                        <p className="text-[11px] text-slate-500">
                          {s.items.map(i => `${i.productName} (x${i.quantity})`).join(', ')}
                        </p>
                      </div>
                      <div className="text-right font-mono">
                        <span className="font-bold text-slate-900 text-sm">₨ {s.grandTotal.toLocaleString()}</span>
                        <p className="text-[10px] text-slate-400">{s.paymentMethod} • {s.saleType}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {profileTab === 'Installments' && (
              <div className="space-y-2 text-xs">
                {customerInstallments.length === 0 ? (
                  <p className="text-center py-8 text-slate-400">No active installment accounts for this customer.</p>
                ) : (
                  customerInstallments.map(inst => (
                    <div key={inst.id} className="p-3 rounded-xl border border-slate-200 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-900">A/C #{inst.accountNumber} — {inst.productName}</p>
                        <p className="text-[11px] text-slate-500">Monthly: ₨ {inst.monthlyInstallment.toLocaleString()} • Status: {inst.status}</p>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-rose-700 font-bold">Bal: ₨ {inst.remainingBalance.toLocaleString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {profileTab === 'Ledger' && (
              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Customer Account Statement</span>
                  <button onClick={() => window.print()} className="flex items-center gap-1 text-blue-600 hover:underline">
                    <Printer className="h-3.5 w-3.5" /> Print Statement
                  </button>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 border-b border-slate-200 font-bold uppercase text-[10px] text-slate-500">
                      <tr>
                        <th className="py-2 px-3">Date</th>
                        <th className="py-2 px-3">Voucher #</th>
                        <th className="py-2 px-3">Description</th>
                        <th className="py-2 px-3 text-right">Debit</th>
                        <th className="py-2 px-3 text-right">Credit</th>
                        <th className="py-2 px-3 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {customerLedger.map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-sans text-slate-600">{row.date}</td>
                          <td className="py-2 px-3 font-bold text-blue-700">{row.voucherNo}</td>
                          <td className="py-2 px-3 font-sans text-slate-800 truncate max-w-xs">{row.description}</td>
                          <td className="py-2 px-3 text-right text-slate-900">{row.debit > 0 ? row.debit.toLocaleString() : '—'}</td>
                          <td className="py-2 px-3 text-right text-emerald-700">{row.credit > 0 ? row.credit.toLocaleString() : '—'}</td>
                          <td className="py-2 px-3 text-right font-bold text-slate-900">₨ {row.balance.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
