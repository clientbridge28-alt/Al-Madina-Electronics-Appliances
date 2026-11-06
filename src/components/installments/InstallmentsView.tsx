import React, { useState, useMemo } from 'react';
import { 
  Calendar, Plus, Search, DollarSign, CheckCircle, 
  AlertTriangle, Clock, UserCheck, Shield, ChevronRight, 
  Printer, X, ArrowUpRight, FileText
} from 'lucide-react';
import { 
  getInstallmentAccounts, createInstallmentAccount, 
  receiveInstallmentPayment, getCustomers, getProducts, 
  getEmployees, getSettings 
} from '../../services/storage';
import { InstallmentAccount, InstallmentScheduleItem } from '../../types/erp';
import { Badge } from '../common/Badge';

export const InstallmentsView: React.FC = () => {
  const [installments, setInstallments] = useState<InstallmentAccount[]>(getInstallmentAccounts());
  const customers = getCustomers();
  const products = getProducts();
  const employees = getEmployees();
  const settings = getSettings();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Overdue' | 'Completed'>('All');

  // Modals
  const [showNewModal, setShowNewModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<InstallmentAccount | null>(null);

  // New Installment form
  const [customerId, setCustomerId] = useState(customers[0]?.id || '');
  const [productId, setProductId] = useState(products[0]?.id || '');
  const [selectedSerial, setSelectedSerial] = useState('');
  const [cashPrice, setCashPrice] = useState(products[0]?.retailPrice || 135000);
  const [downPayment, setDownPayment] = useState(35000);
  const [markupPercent, setMarkupPercent] = useState(settings.defaultMarkupRate || 20);
  const [durationMonths, setDurationMonths] = useState(12);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [guarantor1Name, setGuarantor1Name] = useState('');
  const [guarantor1Phone, setGuarantor1Phone] = useState('');
  const [guarantor1Cnic, setGuarantor1Cnic] = useState('');
  const [guarantor1Rel, setGuarantor1Rel] = useState('');
  const [recoveryOfficerId, setRecoveryOfficerId] = useState(employees[3]?.id || employees[0]?.id || '');

  // Payment form
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank' | 'Cheque'>('Cash');
  const [paymentRemarks, setPaymentRemarks] = useState('');
  const [lastReceiptNo, setLastReceiptNo] = useState<string | null>(null);

  // Auto-calculated financing details
  const financedAmount = Math.max(0, cashPrice - downPayment);
  const markupAmount = Math.round((financedAmount * markupPercent) / 100);
  const totalFinancedPayable = financedAmount + markupAmount;
  const totalPayableWithDown = totalFinancedPayable + downPayment;
  const monthlyInstallment = Math.round(totalFinancedPayable / durationMonths);

  // Update cash price when product changes
  const handleProductChange = (pId: string) => {
    setProductId(pId);
    const prod = products.find(p => p.id === pId);
    if (prod) {
      setCashPrice(prod.retailPrice);
      setDownPayment(Math.round(prod.retailPrice * 0.25)); // 25% default down
      const firstSerial = prod.serials?.find(s => s.status === 'In Stock')?.serialNumber || '';
      setSelectedSerial(firstSerial);
    }
  };

  // Filtered accounts
  const filteredAccounts = useMemo(() => {
    return installments.filter(a => {
      const matchStatus = statusFilter === 'All' || a.status === statusFilter;
      const q = searchQuery.toLowerCase();
      const matchQuery = !q || 
        a.accountNumber.toLowerCase().includes(q) ||
        a.customerName.toLowerCase().includes(q) ||
        a.customerPhone.includes(q) ||
        a.customerCnic.includes(q) ||
        a.productName.toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });
  }, [installments, statusFilter, searchQuery]);

  // Summary Metrics
  const totalFinancedPortfolio = useMemo(() => 
    installments.reduce((sum, a) => sum + a.totalPayableWithDown, 0), [installments]);
  const totalRecovered = useMemo(() => 
    installments.reduce((sum, a) => sum + a.totalReceived, 0), [installments]);
  const totalPendingRecovery = useMemo(() => 
    installments.reduce((sum, a) => sum + a.remainingBalance, 0), [installments]);
  const overdueCount = useMemo(() => 
    installments.filter(a => a.status === 'Overdue').length, [installments]);

  // Create installment account
  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find(c => c.id === customerId);
    const prod = products.find(p => p.id === productId);
    const recOfficer = employees.find(e => e.id === recoveryOfficerId);

    if (!cust || !prod) {
      alert('Please select valid customer and product');
      return;
    }

    const accountNo = `INST-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;

    // Generate monthly schedule
    const scheduleItems: InstallmentScheduleItem[] = [];
    const monthlyPrincipal = Math.round(financedAmount / durationMonths);
    const monthlyMarkup = Math.round(markupAmount / durationMonths);

    for (let i = 1; i <= durationMonths; i++) {
      const due = new Date(startDate);
      due.setMonth(due.getMonth() + i);
      const dueStr = due.toISOString().split('T')[0];

      scheduleItems.push({
        installmentNumber: i,
        dueDate: dueStr,
        principalAmount: monthlyPrincipal,
        markupAmount: monthlyMarkup,
        totalDue: monthlyInstallment,
        paidAmount: 0,
        remainingAmount: monthlyInstallment,
        status: i === 1 ? 'Due' : 'Upcoming'
      });
    }

    createInstallmentAccount({
      accountNumber: accountNo,
      customerId: cust.id,
      customerName: cust.name,
      customerPhone: cust.phone,
      customerCnic: cust.cnic,
      customerAddress: cust.address,
      productId: prod.id,
      productName: prod.name,
      productModel: prod.modelNumber,
      productSerial: selectedSerial || undefined,
      salesInvoiceNo: `INV-${Date.now().toString().slice(-4)}`,
      cashPrice,
      downPayment,
      financedAmount,
      markupPercentage: markupPercent,
      markupAmount,
      totalFinancedPayable,
      totalPayableWithDown,
      durationMonths,
      monthlyInstallment,
      startDate,
      firstDueDate: scheduleItems[0]?.dueDate || startDate,
      guarantor1Name,
      guarantor1Phone,
      guarantor1Cnic,
      guarantor1Relation: guarantor1Rel,
      recoveryOfficerId: recOfficer?.id || 'EMP-04',
      recoveryOfficerName: recOfficer?.name || 'Shahid Mehmood',
      schedule: scheduleItems
    });

    setInstallments(getInstallmentAccounts());
    setShowNewModal(false);
  };

  // Submit installment receipt payment
  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount || paymentAmount <= 0) return;

    const result = receiveInstallmentPayment(
      selectedAccount.id,
      paymentAmount,
      paymentMethod,
      paymentRemarks
    );

    setLastReceiptNo(result.receiptNo);
    setInstallments(getInstallmentAccounts());
    setSelectedAccount(result.updatedAccount);
    setPaymentAmount(0);
    setPaymentRemarks('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Installments & Recovery Portfolio
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Appliance financing, automated monthly schedules, recovery receipts & guarantor files
          </p>
        </div>

        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-98 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>New Installment Plan</span>
        </button>
      </div>

      {/* KPI Cards (Payment Schedules style) */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Financed</span>
          <p className="text-2xl font-black text-slate-900 font-mono mt-1">
            ₨ {(totalFinancedPortfolio / 1000).toFixed(0)}k
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{installments.length} Active Accounts</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Recovered</span>
          <p className="text-2xl font-black text-emerald-700 font-mono mt-1">
            ₨ {(totalRecovered / 1000).toFixed(0)}k
          </p>
          <p className="text-xs text-emerald-600 mt-0.5 font-medium">
            {((totalRecovered / (totalFinancedPortfolio || 1)) * 100).toFixed(1)}% recovery rate
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Dues</span>
          <p className="text-2xl font-black text-slate-900 font-mono mt-1">
            ₨ {(totalPendingRecovery / 1000).toFixed(0)}k
          </p>
          <p className="text-xs text-slate-400 mt-0.5">Scheduled monthly recovery</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Overdue Accounts</span>
          <p className={`text-2xl font-black font-mono mt-1 ${overdueCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {overdueCount}
          </p>
          <p className="text-xs text-rose-700 mt-0.5 font-medium">Require field follow-up</p>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold text-slate-600">
          {(['All', 'Active', 'Overdue', 'Completed'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-xl transition ${
                statusFilter === tab ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 hover:bg-slate-200'
              }`}
            >
              {tab} ({tab === 'All' ? installments.length : installments.filter(a => a.status === tab).length})
            </button>
          ))}
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search account #, customer, CNIC..."
            className="w-full rounded-xl border border-slate-200 pl-10 pr-3.5 py-1.5 text-xs focus:outline-none focus:border-blue-600"
          />
        </div>
      </div>

      {/* Installment Accounts Table */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Account #</th>
                <th className="py-3 px-4">Customer & CNIC</th>
                <th className="py-3 px-4">Financed Product</th>
                <th className="py-3 px-4 text-right">Monthly Due</th>
                <th className="py-3 px-4 text-right">Received</th>
                <th className="py-3 px-4 text-right">Balance</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAccounts.map(a => (
                <tr key={a.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3.5 px-4 font-mono font-bold text-blue-700">{a.accountNumber}</td>
                  <td className="py-3.5 px-4">
                    <p className="font-bold text-slate-900">{a.customerName}</p>
                    <p className="text-[11px] text-slate-400">{a.customerPhone} • {a.customerCnic}</p>
                  </td>
                  <td className="py-3.5 px-4">
                    <p className="font-semibold text-slate-800">{a.productName}</p>
                    <p className="text-[11px] text-slate-400 font-mono">SN: {a.productSerial || 'N/A'}</p>
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                    ₨ {a.monthlyInstallment.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-emerald-700 font-semibold">
                    ₨ {a.totalReceived.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-700">
                    ₨ {a.remainingBalance.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <Badge variant={a.status === 'Completed' ? 'success' : a.status === 'Overdue' ? 'danger' : 'info'} size="sm">
                      {a.status}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => { setSelectedAccount(a); setPaymentAmount(a.monthlyInstallment); setShowPaymentModal(true); }}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] transition shadow-2xs"
                      >
                        Receive
                      </button>
                      <button
                        onClick={() => setSelectedAccount(a)}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium text-[11px]"
                      >
                        Schedule
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Installment Plan Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">New Electronics Installment Plan</h3>
                <p className="text-xs text-slate-400">Automated markup, tenure schedule & guarantor verification</p>
              </div>
              <button onClick={() => setShowNewModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4 text-xs">
              {/* Customer & Product Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Customer Profile *</label>
                  <select
                    value={customerId}
                    onChange={e => setCustomerId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 focus:outline-none focus:border-blue-600"
                  >
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.phone} - CNIC: {c.cnic})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Financed Appliance *</label>
                  <select
                    value={productId}
                    onChange={e => handleProductChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 focus:outline-none focus:border-blue-600"
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.brand} - {p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Price, Down Payment & Markup */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 font-mono">
                <div>
                  <label className="block text-[10px] font-sans text-slate-500 font-bold uppercase mb-1">Cash Price (₨)</label>
                  <input
                    type="number"
                    min={0}
                    value={cashPrice}
                    onChange={e => setCashPrice(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-sans text-slate-500 font-bold uppercase mb-1">Down Payment (₨)</label>
                  <input
                    type="number"
                    min={0}
                    value={downPayment}
                    onChange={e => setDownPayment(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-bold text-emerald-800"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-sans text-slate-500 font-bold uppercase mb-1">Markup (%)</label>
                  <input
                    type="number"
                    min={0}
                    value={markupPercent}
                    onChange={e => setMarkupPercent(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-sans text-slate-500 font-bold uppercase mb-1">Duration (Months)</label>
                  <select
                    value={durationMonths}
                    onChange={e => setDurationMonths(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-bold font-sans"
                  >
                    <option value={3}>3 Months</option>
                    <option value={6}>6 Months</option>
                    <option value={10}>10 Months</option>
                    <option value={12}>12 Months (1 Year)</option>
                    <option value={18}>18 Months</option>
                    <option value={24}>24 Months (2 Years)</option>
                  </select>
                </div>
              </div>

              {/* Live Calculation Preview Banner */}
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-blue-900">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">Calculated Monthly Due</span>
                  <span className="text-xl font-black font-mono">₨ {monthlyInstallment.toLocaleString()} / Month</span>
                </div>
                <div className="text-right text-xs font-mono space-y-0.5">
                  <p>Financed Principal: ₨ {financedAmount.toLocaleString()}</p>
                  <p>Markup Profit: ₨ {markupAmount.toLocaleString()} ({markupPercent}%)</p>
                  <p className="font-bold text-slate-900 font-sans">Total Financed: ₨ {totalFinancedPayable.toLocaleString()}</p>
                </div>
              </div>

              {/* Guarantor Details */}
              <div className="border border-slate-200 rounded-xl p-3.5 space-y-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Guarantor / Zamin Information</span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Guarantor Full Name *"
                    value={guarantor1Name}
                    onChange={e => setGuarantor1Name(e.target.value)}
                    className="rounded-lg border border-slate-200 p-2 text-xs"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Guarantor Phone *"
                    value={guarantor1Phone}
                    onChange={e => setGuarantor1Phone(e.target.value)}
                    className="rounded-lg border border-slate-200 p-2 text-xs"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Guarantor CNIC *"
                    value={guarantor1Cnic}
                    onChange={e => setGuarantor1Cnic(e.target.value)}
                    className="rounded-lg border border-slate-200 p-2 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Relation (Brother, Friend...)"
                    value={guarantor1Rel}
                    onChange={e => setGuarantor1Rel(e.target.value)}
                    className="rounded-lg border border-slate-200 p-2 text-xs"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowNewModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 font-bold text-white hover:bg-blue-700 shadow-sm"
                >
                  Confirm & Generate Installment Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive Installment Payment Modal */}
      {showPaymentModal && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Receive Installment Payment</h3>
                <p className="text-xs text-slate-400 font-mono">A/C #{selectedAccount.accountNumber}</p>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {lastReceiptNo ? (
              <div className="py-4 text-center space-y-2 bg-emerald-50 rounded-xl p-4 border border-emerald-200 text-emerald-900">
                <CheckCircle className="h-10 w-10 text-emerald-600 mx-auto" />
                <h4 className="font-bold text-sm">Payment Recorded Successfully</h4>
                <p className="text-xs font-mono font-bold">Receipt #: {lastReceiptNo}</p>
                <p className="text-xs">Customer balance & cash drawer updated.</p>
                <button
                  onClick={() => { setLastReceiptNo(null); setShowPaymentModal(false); }}
                  className="mt-2 px-4 py-1.5 rounded-lg bg-emerald-700 text-white font-bold text-xs"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handlePaymentSubmit} className="space-y-3.5 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <p className="font-bold text-slate-900">{selectedAccount.customerName}</p>
                  <p className="text-slate-500">{selectedAccount.productName}</p>
                  <div className="flex justify-between pt-1 border-t border-slate-200 font-mono">
                    <span>Monthly Due: <strong>₨ {selectedAccount.monthlyInstallment.toLocaleString()}</strong></span>
                    <span className="text-rose-700">Remaining: ₨ {selectedAccount.remainingBalance.toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Amount Received (₨) *</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={paymentAmount || ''}
                    onChange={e => setPaymentAmount(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-sm font-extrabold text-slate-900 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Payment Method</label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs"
                  >
                    <option value="Cash">Cash Drawer</option>
                    <option value="Bank">Meezan Bank Online</option>
                    <option value="Cheque">Cross Cheque</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Remarks / Receipt Note</label>
                  <input
                    type="text"
                    value={paymentRemarks}
                    onChange={e => setPaymentRemarks(e.target.value)}
                    placeholder="e.g. Received by recovery officer Shahid"
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="flex-1 rounded-xl border border-slate-200 py-2.5 font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-xl bg-emerald-600 py-2.5 font-bold text-white hover:bg-emerald-700 shadow-sm"
                  >
                    Confirm & Print Receipt
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Account Schedule Inspector Drawer/Modal */}
      {selectedAccount && !showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Installment Schedule — A/C #{selectedAccount.accountNumber}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {selectedAccount.customerName} • {selectedAccount.productName}
                </p>
              </div>
              <button onClick={() => setSelectedAccount(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Schedule Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="py-2.5 px-3">Inst #</th>
                    <th className="py-2.5 px-3">Due Date</th>
                    <th className="py-2.5 px-3 text-right">Due Amount</th>
                    <th className="py-2.5 px-3 text-right">Paid</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    <th className="py-2.5 px-3 font-mono">Receipt #</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedAccount.schedule.map(item => (
                    <tr key={item.installmentNumber} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-bold text-slate-700">#{item.installmentNumber}</td>
                      <td className="py-2.5 px-3 text-slate-600">{item.dueDate}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-semibold">₨ {item.totalDue.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-700">₨ {item.paidAmount.toLocaleString()}</td>
                      <td className="py-2.5 px-3 text-center">
                        <Badge variant={item.status === 'Paid' ? 'success' : item.status === 'Overdue' ? 'danger' : 'neutral'} size="sm">
                          {item.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{item.receiptNo || '—'}</td>
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
