import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus, Search, CheckCircle, Clock, X, Edit3, AlertCircle,
  CalendarClock, MessageSquare, Handshake, Send, Loader2
} from 'lucide-react';
import {
  getInstallmentAccounts,
  createInstallmentAccount,
  receiveInstallmentPayment,
  closeInstallmentAccountEarly,
  updateInstallmentAccountDetails,
  rescheduleInstallmentPlan,
  getInstallmentCommitments,
  saveInstallmentCommitment,
  updateCommitmentStatus,
  getCustomers,
  getProducts,
  getEmployees,
  getSettings,
  subscribeToDatabase,
} from '../../services/storage';
import { InstallmentAccount, InstallmentCommitment, InstallmentScheduleItem } from '../../types/erp';
import { Badge } from '../common/Badge';
import { authorizedApiFetch } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';

export const InstallmentsView: React.FC = () => {
  const { can } = useAuth();
  const [, setDbTick] = useState(0);
  useEffect(() => subscribeToDatabase(() => setDbTick(t => t + 1)), []);

  const installments = getInstallmentAccounts();
  const commitments = getInstallmentCommitments();
  const customers = getCustomers();
  const products = getProducts();
  const employees = getEmployees();
  const settings = getSettings();

  const [viewMode, setViewMode] = useState<'accounts' | 'dueSchedule' | 'commitments'>('accounts');
  const [dueFilter, setDueFilter] = useState<'all' | 'overdue' | 'today' | 'week'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Overdue' | 'Completed' | 'Closed Early'>('All');
  const [notice, setNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Modals
  const [showNewModal, setShowNewModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [showCommitmentModal, setShowCommitmentModal] = useState(false);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<InstallmentAccount | null>(null);

  // Early Closure & Edit state
  const [settlementAmount, setSettlementAmount] = useState<number>(0);
  const [settlementMethod, setSettlementMethod] = useState<'Cash' | 'Bank' | 'Cheque'>('Cash');
  const [settlementNotes, setSettlementNotes] = useState('');
  const [editGuarantorName, setEditGuarantorName] = useState('');
  const [editGuarantorPhone, setEditGuarantorPhone] = useState('');
  const [editGuarantorCnic, setEditGuarantorCnic] = useState('');
  const [editGuarantorRel, setEditGuarantorRel] = useState('');
  const [editGuarantor2Name, setEditGuarantor2Name] = useState('');
  const [editGuarantor2Phone, setEditGuarantor2Phone] = useState('');
  const [editGuarantor2Cnic, setEditGuarantor2Cnic] = useState('');
  const [editGuarantor2Rel, setEditGuarantor2Rel] = useState('');
  const [editLocationSector, setEditLocationSector] = useState('');
  const [editMobile2, setEditMobile2] = useState('');
  const [editProfession, setEditProfession] = useState('');
  const [editReferenceName, setEditReferenceName] = useState('');
  const [editOfficerName, setEditOfficerName] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Reschedule state
  const [rescheduleTenure, setRescheduleTenure] = useState<number>(6);
  const [rescheduleStartDate, setRescheduleStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [rescheduleReason, setRescheduleReason] = useState('');

  // Commitment state
  const [commitDate, setCommitDate] = useState(new Date().toISOString().split('T')[0]);
  const [commitAmount, setCommitAmount] = useState<number>(0);
  const [commitNotes, setCommitNotes] = useState('');

  // SMS state
  const [smsRecipients, setSmsRecipients] = useState<{ name: string; phone: string }[]>([]);
  const [smsMessage, setSmsMessage] = useState('');
  const [smsSending, setSmsSending] = useState(false);
  const [smsError, setSmsError] = useState('');

  // New Installment form
  const [customerId, setCustomerId] = useState(customers[0]?.id || '');
  const [productId, setProductId] = useState(products[0]?.id || '');
  const [selectedSerial, setSelectedSerial] = useState('');
  const [slipNo, setSlipNo] = useState('');
  const [locationSector, setLocationSector] = useState('');
  const [mobile2, setMobile2] = useState('');
  const [profession, setProfession] = useState('');
  const [referenceName, setReferenceName] = useState('');
  const [cashPrice, setCashPrice] = useState(products[0]?.retailPrice || 135000);
  const [downPayment, setDownPayment] = useState(35000);
  const [markupPercent, setMarkupPercent] = useState(settings.defaultMarkupRate || 20);
  const [durationMonths, setDurationMonths] = useState(12);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [guarantor1Name, setGuarantor1Name] = useState('');
  const [guarantor1Phone, setGuarantor1Phone] = useState('');
  const [guarantor1Cnic, setGuarantor1Cnic] = useState('');
  const [guarantor1Rel, setGuarantor1Rel] = useState('');
  const [guarantor2Name, setGuarantor2Name] = useState('');
  const [guarantor2Phone, setGuarantor2Phone] = useState('');
  const [guarantor2Cnic, setGuarantor2Cnic] = useState('');
  const [guarantor2Rel, setGuarantor2Rel] = useState('');
  const [recoveryOfficerId, setRecoveryOfficerId] = useState(employees[3]?.id || employees[0]?.id || '');

  useEffect(() => {
    if (!customerId && customers.length > 0) {
      setCustomerId(customers[0].id);
    }
  }, [customers.length, customerId]);

  useEffect(() => {
    if (!productId && products.length > 0) {
      const first = products[0];
      setProductId(first.id);
      setCashPrice(first.retailPrice);
      setDownPayment(Math.round(first.retailPrice * 0.25));
      const firstSerial = first.serials?.find(s => s.status === 'In Stock')?.serialNumber || '';
      setSelectedSerial(firstSerial);
    }
  }, [products.length, productId]);

  useEffect(() => {
    if (!recoveryOfficerId && employees.length > 0) {
      setRecoveryOfficerId(employees[3]?.id || employees[0].id);
    }
  }, [employees.length, recoveryOfficerId]);

  // Payment form
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank' | 'Cheque'>('Cash');
  const [paymentRemarks, setPaymentRemarks] = useState('');
  const [lastReceiptNo, setLastReceiptNo] = useState<string | null>(null);

  const financedAmount = Math.max(0, cashPrice - downPayment);
  const markupAmount = Math.round((financedAmount * markupPercent) / 100);
  const totalFinancedPayable = financedAmount + markupAmount;
  const monthlyInstallment = Math.round(totalFinancedPayable / durationMonths);
  const totalPayableWithDown = totalFinancedPayable + downPayment;

  const handleProductChange = (pId: string) => {
    setProductId(pId);
    const prod = products.find(p => p.id === pId);
    if (prod) {
      setCashPrice(prod.retailPrice);
      setDownPayment(Math.round(prod.retailPrice * 0.25));
      const firstSerial = prod.serials?.find(s => s.status === 'In Stock')?.serialNumber || '';
      setSelectedSerial(firstSerial);
    }
  };

  const filteredAccounts = useMemo(() => {
    return installments.filter(a => {
      const matchStatus = statusFilter === 'All' || a.status === statusFilter;
      const q = searchQuery.toLowerCase();
      const matchQuery =
        !q ||
        a.accountNumber.toLowerCase().includes(q) ||
        a.customerName.toLowerCase().includes(q) ||
        a.customerPhone.includes(q) ||
        a.customerCnic.includes(q) ||
        a.productName.toLowerCase().includes(q) ||
        (a.locationSector || '').toLowerCase().includes(q) ||
        (a.slipNo || '').toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });
  }, [installments, statusFilter, searchQuery]);

  const totalFinancedPortfolio = useMemo(
    () => installments.reduce((sum, a) => sum + a.totalPayableWithDown, 0),
    [installments]
  );
  const totalRecovered = useMemo(
    () => installments.reduce((sum, a) => sum + a.totalReceived, 0),
    [installments]
  );
  const totalPendingRecovery = useMemo(
    () => installments.reduce((sum, a) => sum + a.remainingBalance, 0),
    [installments]
  );
  const overdueCount = useMemo(
    () => installments.filter(a => a.status === 'Overdue').length,
    [installments]
  );

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find(c => c.id === customerId);
    const prod = products.find(p => p.id === productId);
    const recOfficer = employees.find(e => e.id === recoveryOfficerId);

    if (!cust || !prod) {
      setNotice({ type: 'error', text: 'Please select or create a valid customer and product first.' });
      return;
    }

    const accountNo = `INST-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`;
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
        status: i === 1 ? 'Due' : 'Upcoming',
      });
    }

    createInstallmentAccount({
      accountNumber: accountNo,
      slipNo: slipNo.trim() || undefined,
      customerId: cust.id,
      customerName: cust.name,
      customerPhone: cust.phone,
      mobile2: mobile2.trim() || undefined,
      customerCnic: cust.cnic,
      customerAddress: cust.address,
      locationSector: locationSector.trim() || undefined,
      profession: profession.trim() || undefined,
      referenceName: referenceName.trim() || undefined,
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
      guarantor2Name: guarantor2Name.trim() || undefined,
      guarantor2Phone: guarantor2Phone.trim() || undefined,
      guarantor2Cnic: guarantor2Cnic.trim() || undefined,
      guarantor2Relation: guarantor2Rel.trim() || undefined,
      recoveryOfficerId: recOfficer?.id || 'EMP-04',
      recoveryOfficerName: recOfficer?.name || 'Shahid Mehmood',
      schedule: scheduleItems,
    });

    setShowNewModal(false);
    setNotice({
      type: 'success',
      text: `Installment Account #${accountNo} created with ${durationMonths}-month schedule.`,
    });
  };

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
    setSelectedAccount(result.updatedAccount);
    setPaymentAmount(0);
    setPaymentRemarks('');
  };

  const handleCloseEarlySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    const res = closeInstallmentAccountEarly(
      selectedAccount.id,
      settlementAmount,
      settlementMethod,
      settlementNotes
    );
    setShowCloseModal(false);
    setSelectedAccount(null);
    setNotice({
      type: 'success',
      text: `Account #${res.updatedAccount.accountNumber} closed early (Receipt: ${res.receiptNo}). Remaining balance is now PKR 0.`,
    });
  };

  const handleEditPlanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    updateInstallmentAccountDetails(selectedAccount.id, {
      guarantor1Name: editGuarantorName,
      guarantor1Phone: editGuarantorPhone,
      guarantor1Cnic: editGuarantorCnic,
      guarantor1Relation: editGuarantorRel,
      guarantor2Name: editGuarantor2Name.trim() || undefined,
      guarantor2Phone: editGuarantor2Phone.trim() || undefined,
      guarantor2Cnic: editGuarantor2Cnic.trim() || undefined,
      guarantor2Relation: editGuarantor2Rel.trim() || undefined,
      locationSector: editLocationSector.trim() || undefined,
      mobile2: editMobile2.trim() || undefined,
      profession: editProfession.trim() || undefined,
      referenceName: editReferenceName.trim() || undefined,
      recoveryOfficerName: editOfficerName,
      notes: editNotes,
    });
    setShowEditModal(false);
    setSelectedAccount(null);
    setNotice({
      type: 'success',
      text: `Updated guarantor, sector & recovery details for #${selectedAccount.accountNumber}.`,
    });
  };

  const handleRescheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    try {
      const updated = rescheduleInstallmentPlan(
        selectedAccount.id,
        rescheduleTenure,
        rescheduleStartDate,
        rescheduleReason.trim() || 'Customer payment plan rescheduling'
      );
      setShowRescheduleModal(false);
      setSelectedAccount(null);
      setRescheduleReason('');
      setNotice({
        type: 'success',
        text: `Plan #${updated.accountNumber} rescheduled cleanly to ₨ ${updated.monthlyInstallment.toLocaleString()}/month.`,
      });
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Could not reschedule plan.' });
      setShowRescheduleModal(false);
    }
  };

  const handleSaveCommitmentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    const saved = saveInstallmentCommitment({
      installmentAccountId: selectedAccount.id,
      accountNumber: selectedAccount.accountNumber,
      customerId: selectedAccount.customerId,
      customerName: selectedAccount.customerName,
      customerPhone: selectedAccount.customerPhone,
      commitmentDate: commitDate,
      promisedAmount: commitAmount,
      officerName: selectedAccount.recoveryOfficerName,
      status: 'Pending',
      remarks: commitNotes.trim() || undefined,
    });
    setShowCommitmentModal(false);
    setSelectedAccount(null);
    setCommitNotes('');
    setNotice({
      type: 'success',
      text: `Payment commitment (₨ ${saved.promisedAmount.toLocaleString()} on ${saved.commitmentDate}) logged.`,
    });
  };

  const openSmsForAccount = (acc: InstallmentAccount) => {
    setSmsError('');
    setSmsRecipients([{ name: acc.customerName, phone: acc.customerPhone }]);
    setSmsMessage(
      `Dear ${acc.customerName}, reminder for your Al-Madina Electronics A/C ${acc.accountNumber}: monthly installment PKR ${acc.monthlyInstallment.toLocaleString()} is due. Remaining balance: PKR ${acc.remainingBalance.toLocaleString()}.`
    );
    setShowSmsModal(true);
  };

  const openBulkOverdueSms = () => {
    setSmsError('');
    const targets = installments
      .filter(a => (a.status === 'Overdue' || a.status === 'Active') && a.remainingBalance > 0 && a.customerPhone)
      .slice(0, 50)
      .map(a => ({ name: a.customerName, phone: a.customerPhone }));
    setSmsRecipients(targets);
    setSmsMessage(
      `Dear Customer, kindly clear your due monthly installment at Al-Madina Electronics & Appliances at your earliest convenience. Thank you.`
    );
    setShowSmsModal(true);
  };

  const handleSendSmsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (smsRecipients.length === 0 || !smsMessage.trim()) return;
    setSmsError('');
    setSmsSending(true);
    try {
      const res = await authorizedApiFetch('/api/notifications/sms', {
        method: 'POST',
        body: JSON.stringify({
          recipients: smsRecipients,
          message: smsMessage.trim(),
          campaignType: 'InstallmentReminder',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `SMS dispatch failed (HTTP ${res.status}).`);
      }
      setShowSmsModal(false);
      setNotice({
        type: 'success',
        text: `SMS reminders dispatched to ${data.sentCount}/${smsRecipients.length} recipient(s).`,
      });
    } catch (err: any) {
      setSmsError(err?.message || 'Unable to dispatch SMS reminders.');
    } finally {
      setSmsSending(false);
    }
  };

  const dueScheduleRows = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0];
    const weekLater = new Date();
    weekLater.setDate(weekLater.getDate() + 7);
    const weekStr = weekLater.toISOString().split('T')[0];

    const rows: {
      account: InstallmentAccount;
      item: InstallmentScheduleItem;
      isOverdue: boolean;
      isToday: boolean;
      isWeek: boolean;
    }[] = [];

    for (const acc of installments) {
      if (acc.status === 'Completed' || acc.status === 'Closed Early') continue;
      for (const item of acc.schedule) {
        if (item.status === 'Paid' || item.remainingAmount <= 0) continue;
        const isOverdue = item.status === 'Overdue' || item.dueDate < todayStr;
        const isToday = item.dueDate === todayStr;
        const isWeek = item.dueDate >= todayStr && item.dueDate <= weekStr;
        if (
          dueFilter === 'all' ||
          (dueFilter === 'overdue' && isOverdue) ||
          (dueFilter === 'today' && isToday) ||
          (dueFilter === 'week' && isWeek)
        ) {
          rows.push({ account: acc, item, isOverdue, isToday, isWeek });
        }
      }
    }
    return rows.sort((a, b) => a.item.dueDate.localeCompare(b.item.dueDate));
  }, [installments, dueFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Installments & Recovery Portfolio
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Financing plans, rescheduling, payment commitments, dual guarantors & SMS reminders
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setViewMode('accounts')}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition whitespace-nowrap shrink-0 ${
              viewMode === 'accounts'
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span>Accounts ({installments.length})</span>
          </button>

          <button
            onClick={() => setViewMode('dueSchedule')}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition whitespace-nowrap shrink-0 ${
              viewMode === 'dueSchedule'
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Clock className="h-3.5 w-3.5" />
            <span>Due Schedule</span>
          </button>

          <button
            onClick={() => setViewMode('commitments')}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition whitespace-nowrap shrink-0 ${
              viewMode === 'commitments'
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Handshake className="h-3.5 w-3.5" />
            <span>Commitments ({commitments.length})</span>
          </button>

          {can('installments', 'EDIT') && (
            <button
              onClick={openBulkOverdueSms}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 px-3 py-2 text-xs font-bold text-emerald-800 transition whitespace-nowrap shrink-0"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Bulk SMS Reminder</span>
            </button>
          )}

          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>New Installment Plan</span>
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
              <AlertCircle className="h-4 w-4 text-rose-600" />
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

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Financed</span>
          <p className="text-2xl font-black text-slate-900 font-mono mt-1">
            ₨ {(totalFinancedPortfolio / 1000).toFixed(0)}k
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{installments.length} Accounts</p>
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

      {viewMode === 'commitments' ? (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Customer Payment Commitments Register</h3>
              <p className="text-xs text-slate-500">Track promised recovery dates and mark kept or broken promises</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-3.5">Promise Date</th>
                  <th className="p-3.5">Account #</th>
                  <th className="p-3.5">Customer</th>
                  <th className="p-3.5">Officer</th>
                  <th className="p-3.5 text-right">Promised Amount</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right">Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {commitments.map((c: InstallmentCommitment) => (
                  <tr key={c.id} className="hover:bg-slate-50/70">
                    <td className="p-3.5 font-mono font-bold text-slate-800">{c.commitmentDate}</td>
                    <td className="p-3.5 font-mono font-bold text-blue-700">{c.accountNumber}</td>
                    <td className="p-3.5">
                      <p className="font-bold text-slate-900">{c.customerName}</p>
                      <p className="text-[11px] text-slate-500">{c.customerPhone}</p>
                    </td>
                    <td className="p-3.5 text-slate-600">{c.officerName}</td>
                    <td className="p-3.5 text-right font-mono font-bold text-slate-900">
                      ₨ {c.promisedAmount.toLocaleString()}
                    </td>
                    <td className="p-3.5 text-center">
                      <Badge
                        variant={c.status === 'Fulfilled' ? 'success' : c.status === 'Broken' ? 'danger' : 'warning'}
                        size="sm"
                      >
                        {c.status}
                      </Badge>
                    </td>
                    <td className="p-3.5 text-right space-x-1.5">
                      <button
                        onClick={() => updateCommitmentStatus(c.id, 'Fulfilled')}
                        className="px-2 py-1 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold"
                      >
                        Fulfilled
                      </button>
                      <button
                        onClick={() => updateCommitmentStatus(c.id, 'Broken')}
                        className="px-2 py-1 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-semibold"
                      >
                        Broken
                      </button>
                    </td>
                  </tr>
                ))}
                {commitments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No payment commitments logged yet. Click &ldquo;Commit&rdquo; on any active account row.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : viewMode === 'dueSchedule' ? (
        <div className="space-y-4">
          <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 text-xs font-bold">
              {[
                { id: 'all', label: 'All Pending Dues' },
                { id: 'overdue', label: 'Overdue' },
                { id: 'today', label: 'Due Today' },
                { id: 'week', label: 'Due Next 7 Days' },
              ].map(f => (
                <button
                  key={f.id}
                  onClick={() => setDueFilter(f.id as any)}
                  className={`px-3 py-1.5 rounded-xl ${
                    dueFilter === f.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-slate-500 font-semibold">
              {dueScheduleRows.length} Upcoming / Due Installments
            </span>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Due Date</th>
                    <th className="p-3.5">Account #</th>
                    <th className="p-3.5">Customer & Phone</th>
                    <th className="p-3.5">Inst #</th>
                    <th className="p-3.5">Officer</th>
                    <th className="p-3.5 text-right">Remaining Due</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dueScheduleRows.map(({ account, item, isOverdue }) => (
                    <tr key={`${account.id}-${item.installmentNumber}`} className="hover:bg-slate-50/70">
                      <td className={`p-3.5 font-mono font-bold ${isOverdue ? 'text-rose-600' : 'text-slate-800'}`}>
                        {item.dueDate}{' '}
                        {isOverdue && (
                          <span className="ml-1 text-[10px] bg-rose-100 text-rose-800 px-1.5 py-0.5 rounded">
                            OVERDUE
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 font-mono font-bold text-blue-700">{account.accountNumber}</td>
                      <td className="p-3.5">
                        <p className="font-bold text-slate-900">{account.customerName}</p>
                        <p className="text-[11px] text-slate-500">{account.customerPhone}</p>
                      </td>
                      <td className="p-3.5 font-mono">#{item.installmentNumber}</td>
                      <td className="p-3.5 text-slate-600">{account.recoveryOfficerName}</td>
                      <td className="p-3.5 text-right font-mono tabular-nums font-bold text-rose-700">
                        ₨ {item.remainingAmount.toLocaleString()}
                      </td>
                      <td className="p-3.5 text-right">
                        <button
                          onClick={() => {
                            setSelectedAccount(account);
                            setPaymentAmount(item.remainingAmount);
                            setShowPaymentModal(true);
                          }}
                          className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] hover:bg-emerald-700"
                        >
                          Collect Now
                        </button>
                      </td>
                    </tr>
                  ))}
                  {dueScheduleRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        No installments match this due-date filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Filter Tabs & Search */}
          <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto text-xs font-semibold text-slate-600">
              {(['All', 'Active', 'Overdue', 'Completed', 'Closed Early'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3 py-1.5 rounded-xl transition whitespace-nowrap shrink-0 ${
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
                placeholder="Search account #, slip, sector, CNIC..."
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
                    <th className="py-3 px-4">Account # / Slip</th>
                    <th className="py-3 px-4">Customer & Sector</th>
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
                      <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                        <div>{a.accountNumber}</div>
                        {a.slipNo && <div className="text-[10px] text-slate-400">Slip: {a.slipNo}</div>}
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-slate-900">{a.customerName}</p>
                        <p className="text-[11px] text-slate-400">
                          {a.customerPhone} • {a.locationSector || a.customerCnic}
                        </p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-slate-800">{a.productName}</p>
                        <p className="text-[11px] text-slate-400 font-mono">
                          G1: {a.guarantor1Name}
                          {a.guarantor2Name ? ` • G2: ${a.guarantor2Name}` : ''}
                        </p>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                        ₨ {a.monthlyInstallment.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums text-emerald-700 font-semibold">
                        ₨ {a.totalReceived.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-rose-700">
                        ₨ {a.remainingBalance.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Badge
                          variant={a.status === 'Completed' ? 'success' : a.status === 'Overdue' ? 'danger' : 'info'}
                          size="sm"
                        >
                          {a.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1 flex-wrap">
                          {a.remainingBalance > 0 && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedAccount(a);
                                  setPaymentAmount(a.monthlyInstallment);
                                  setShowPaymentModal(true);
                                }}
                                className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]"
                              >
                                Receive
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedAccount(a);
                                  setRescheduleTenure(6);
                                  setRescheduleStartDate(new Date().toISOString().split('T')[0]);
                                  setRescheduleReason('');
                                  setShowRescheduleModal(true);
                                }}
                                className="p-1 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                                title="Reschedule Plan"
                              >
                                <CalendarClock className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedAccount(a);
                                  setCommitAmount(a.monthlyInstallment);
                                  setCommitDate(new Date().toISOString().split('T')[0]);
                                  setCommitNotes('');
                                  setShowCommitmentModal(true);
                                }}
                                className="p-1 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                                title="Log Payment Commitment"
                              >
                                <Handshake className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedAccount(a);
                                  setSettlementAmount(a.remainingBalance);
                                  setSettlementNotes('');
                                  setShowCloseModal(true);
                                }}
                                className="px-2 py-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-semibold text-[11px]"
                              >
                                Close Early
                              </button>
                            </>
                          )}
                          {can('installments', 'EDIT') && (
                            <button
                              onClick={() => openSmsForAccount(a)}
                              className="p-1 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              title="Send SMS Reminder"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedAccount(a);
                              setEditGuarantorName(a.guarantor1Name || '');
                              setEditGuarantorPhone(a.guarantor1Phone || '');
                              setEditGuarantorCnic(a.guarantor1Cnic || '');
                              setEditGuarantorRel(a.guarantor1Relation || '');
                              setEditGuarantor2Name(a.guarantor2Name || '');
                              setEditGuarantor2Phone(a.guarantor2Phone || '');
                              setEditGuarantor2Cnic(a.guarantor2Cnic || '');
                              setEditGuarantor2Rel(a.guarantor2Relation || '');
                              setEditLocationSector(a.locationSector || '');
                              setEditMobile2(a.mobile2 || '');
                              setEditProfession(a.profession || '');
                              setEditReferenceName(a.referenceName || '');
                              setEditOfficerName(a.recoveryOfficerName || '');
                              setEditNotes(a.notes || '');
                              setShowEditModal(true);
                            }}
                            className="p-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700"
                            title="Edit Guarantors & Customer Profile"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => setSelectedAccount(a)}
                            className="px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium text-[11px]"
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
        </>
      )}

      {/* New Installment Plan Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">New Electronics Installment Plan</h3>
                <p className="text-xs text-slate-400">Markup calculation, sector profile & dual-guarantor verification</p>
              </div>
              <button onClick={() => setShowNewModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Customer Profile *</label>
                  <select
                    value={customerId}
                    onChange={e => setCustomerId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5"
                  >
                    <option value="">{customers.length === 0 ? 'No customers found' : 'Select Customer...'}</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Financed Appliance *</label>
                  <select
                    value={productId}
                    onChange={e => handleProductChange(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5"
                  >
                    <option value="">{products.length === 0 ? 'No products found' : 'Select Product...'}</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.brand} - {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Recovery Officer</label>
                  <select
                    value={recoveryOfficerId}
                    onChange={e => setRecoveryOfficerId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5"
                  >
                    <option value="">{employees.length === 0 ? 'No officers found' : 'Select Officer...'}</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.designation})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <input
                  type="text"
                  placeholder="Slip / File #"
                  value={slipNo}
                  onChange={e => setSlipNo(e.target.value)}
                  className="rounded-xl border border-slate-200 p-2 font-mono"
                />
                <input
                  type="text"
                  placeholder="Area / Sector"
                  value={locationSector}
                  onChange={e => setLocationSector(e.target.value)}
                  className="rounded-xl border border-slate-200 p-2"
                />
                <input
                  type="text"
                  placeholder="Alternate Mobile"
                  value={mobile2}
                  onChange={e => setMobile2(e.target.value)}
                  className="rounded-xl border border-slate-200 p-2"
                />
                <input
                  type="text"
                  placeholder="Profession / Job"
                  value={profession}
                  onChange={e => setProfession(e.target.value)}
                  className="rounded-xl border border-slate-200 p-2"
                />
                <input
                  type="text"
                  placeholder="Reference Name"
                  value={referenceName}
                  onChange={e => setReferenceName(e.target.value)}
                  className="rounded-xl border border-slate-200 p-2"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 font-mono">
                <div>
                  <label className="block text-[10px] font-sans text-slate-500 font-bold uppercase mb-1">Cash Price</label>
                  <input
                    type="number"
                    min={0}
                    value={cashPrice}
                    onChange={e => setCashPrice(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-sans text-slate-500 font-bold uppercase mb-1">Down Payment</label>
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
                  <label className="block text-[10px] font-sans text-slate-500 font-bold uppercase mb-1">Months</label>
                  <select
                    value={durationMonths}
                    onChange={e => setDurationMonths(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-bold font-sans"
                  >
                    <option value={3}>3 Months</option>
                    <option value={6}>6 Months</option>
                    <option value={10}>10 Months</option>
                    <option value={12}>12 Months</option>
                    <option value={18}>18 Months</option>
                    <option value={24}>24 Months</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-sans text-slate-500 font-bold uppercase mb-1">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-sans"
                  />
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-blue-900">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 block">
                    Calculated Monthly Due
                  </span>
                  <span className="text-xl font-black font-mono">₨ {monthlyInstallment.toLocaleString()} / Month</span>
                </div>
                <div className="text-right text-xs font-mono space-y-0.5">
                  <p>Financed Principal: ₨ {financedAmount.toLocaleString()}</p>
                  <p>Markup Profit: ₨ {markupAmount.toLocaleString()} ({markupPercent}%)</p>
                  <p className="font-bold text-slate-900 font-sans">Total Plan: ₨ {totalPayableWithDown.toLocaleString()}</p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-3.5 space-y-2">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block">
                  1st Guarantor / Zamin (Required)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Full Name *"
                    value={guarantor1Name}
                    onChange={e => setGuarantor1Name(e.target.value)}
                    className="rounded-lg border border-slate-200 p-2 text-xs"
                  />
                  <input
                    type="text"
                    required
                    placeholder="Phone *"
                    value={guarantor1Phone}
                    onChange={e => setGuarantor1Phone(e.target.value)}
                    className="rounded-lg border border-slate-200 p-2 text-xs"
                  />
                  <input
                    type="text"
                    required
                    placeholder="CNIC *"
                    value={guarantor1Cnic}
                    onChange={e => setGuarantor1Cnic(e.target.value)}
                    className="rounded-lg border border-slate-200 p-2 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Relation"
                    value={guarantor1Rel}
                    onChange={e => setGuarantor1Rel(e.target.value)}
                    className="rounded-lg border border-slate-200 p-2 text-xs"
                  />
                </div>

                <span className="text-xs font-bold text-slate-600 uppercase tracking-wider block pt-2">
                  2nd Guarantor / Zamin (Optional)
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    placeholder="2nd Guarantor Name"
                    value={guarantor2Name}
                    onChange={e => setGuarantor2Name(e.target.value)}
                    className="rounded-lg border border-slate-200 p-2 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="2nd Guarantor Phone"
                    value={guarantor2Phone}
                    onChange={e => setGuarantor2Phone(e.target.value)}
                    className="rounded-lg border border-slate-200 p-2 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="2nd Guarantor CNIC"
                    value={guarantor2Cnic}
                    onChange={e => setGuarantor2Cnic(e.target.value)}
                    className="rounded-lg border border-slate-200 p-2 text-xs"
                  />
                  <input
                    type="text"
                    placeholder="Relation"
                    value={guarantor2Rel}
                    onChange={e => setGuarantor2Rel(e.target.value)}
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
                <button type="submit" className="flex-1 rounded-xl bg-blue-600 py-2.5 font-bold text-white hover:bg-blue-700">
                  Confirm & Generate Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive Payment Modal */}
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
                <button
                  onClick={() => {
                    setLastReceiptNo(null);
                    setShowPaymentModal(false);
                  }}
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
                    <span>Monthly Due: ₨ {selectedAccount.monthlyInstallment.toLocaleString()}</span>
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
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-sm font-extrabold"
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
                  <label className="block text-slate-700 font-semibold mb-1">Remarks</label>
                  <input
                    type="text"
                    value={paymentRemarks}
                    onChange={e => setPaymentRemarks(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="flex-1 rounded-xl border border-slate-200 py-2.5 font-medium text-slate-600"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 rounded-xl bg-emerald-600 py-2.5 font-bold text-white hover:bg-emerald-700">
                    Confirm Receipt
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Schedule Inspector Modal */}
      {selectedAccount &&
        !showPaymentModal &&
        !showCloseModal &&
        !showEditModal &&
        !showRescheduleModal &&
        !showCommitmentModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Installment Schedule — A/C #{selectedAccount.accountNumber}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {selectedAccount.customerName} • {selectedAccount.productName}
                    {selectedAccount.locationSector ? ` • Sector: ${selectedAccount.locationSector}` : ''}
                  </p>
                </div>
                <button onClick={() => setSelectedAccount(null)} className="text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

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
                          <Badge
                            variant={item.status === 'Paid' ? 'success' : item.status === 'Overdue' ? 'danger' : 'neutral'}
                            size="sm"
                          >
                            {item.status}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">{item.receiptNo || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {selectedAccount.rescheduleHistory && selectedAccount.rescheduleHistory.length > 0 && (
                <div className="p-3 rounded-xl bg-indigo-50 border border-indigo-200 space-y-1.5 text-xs">
                  <p className="font-bold text-indigo-900">Plan Reschedule History</p>
                  {selectedAccount.rescheduleHistory.map((h, i) => (
                    <p key={i} className="text-indigo-800">
                      {h.date}: ₨ {h.previousMonthly.toLocaleString()} → ₨ {h.newMonthly.toLocaleString()}/mo ({h.newTenure} total months) — {h.reason}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

      {/* Reschedule Plan Modal */}
      {showRescheduleModal && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Reschedule Installment Plan (#{selectedAccount.accountNumber})
              </h3>
              <button onClick={() => setShowRescheduleModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-xs text-slate-600">
              Remaining balance <strong>₨ {selectedAccount.remainingBalance.toLocaleString()}</strong> will be re-spread
              across your chosen remaining months while preserving paid installments.
            </p>
            <form onSubmit={handleRescheduleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Remaining Tenure (Months) *</label>
                <input
                  type="number"
                  min={1}
                  max={48}
                  required
                  value={rescheduleTenure}
                  onChange={e => setRescheduleTenure(Number(e.target.value) || 1)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">First Rescheduled Due Date *</label>
                <input
                  type="date"
                  required
                  value={rescheduleStartDate}
                  onChange={e => setRescheduleStartDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason *</label>
                <input
                  type="text"
                  required
                  value={rescheduleReason}
                  onChange={e => setRescheduleReason(e.target.value)}
                  placeholder="e.g. Customer seasonal income adjustment"
                  className="w-full rounded-xl border border-slate-200 p-2.5"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRescheduleModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2 font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-700 py-2 font-bold text-white">
                  Apply Reschedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Commitment Modal */}
      {showCommitmentModal && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Log Payment Commitment (#{selectedAccount.accountNumber})
              </h3>
              <button onClick={() => setShowCommitmentModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSaveCommitmentSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Promised Payment Date *</label>
                <input
                  type="date"
                  required
                  value={commitDate}
                  onChange={e => setCommitDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Promised Amount (₨) *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={commitAmount}
                  onChange={e => setCommitAmount(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Follow-up Notes</label>
                <input
                  type="text"
                  value={commitNotes}
                  onChange={e => setCommitNotes(e.target.value)}
                  placeholder="Customer promised payment after salary..."
                  className="w-full rounded-xl border border-slate-200 p-2.5"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCommitmentModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2 font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-700 py-2 font-bold text-white">
                  Save Commitment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send SMS Reminder Modal */}
      {showSmsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                Dispatch SMS Payment Reminder ({smsRecipients.length} recipient{smsRecipients.length === 1 ? '' : 's'})
              </h3>
              <button onClick={() => setShowSmsModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSendSmsSubmit} className="space-y-3 text-xs">
              <div className="max-h-24 overflow-y-auto p-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                {smsRecipients.length > 0
                  ? smsRecipients.map(r => `${r.name} (${r.phone})`).join(', ')
                  : 'No eligible recipients with phone numbers found.'}
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">SMS Message *</label>
                <textarea
                  rows={4}
                  required
                  maxLength={600}
                  value={smsMessage}
                  onChange={e => setSmsMessage(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs"
                />
              </div>
              {smsError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">{smsError}</div>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSmsModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2 font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={smsSending || smsRecipients.length === 0}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 py-2 font-bold text-white"
                >
                  {smsSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  <span>{smsSending ? 'Sending...' : 'Send SMS'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Early Account Closure Modal */}
      {showCloseModal && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Early Settlement & Account Closure</h3>
              <button onClick={() => setShowCloseModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCloseEarlySubmit} className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950">
                <p className="font-bold">
                  {selectedAccount.customerName} (#{selectedAccount.accountNumber})
                </p>
                <p>
                  Remaining Balance: <strong>₨ {selectedAccount.remainingBalance.toLocaleString()}</strong>
                </p>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Final Settlement Amount (₨) *</label>
                <input
                  type="number"
                  min={0}
                  required
                  value={settlementAmount}
                  onChange={e => setSettlementAmount(Number(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Method</label>
                <select
                  value={settlementMethod}
                  onChange={e => setSettlementMethod(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5"
                >
                  <option value="Cash">Cash Drawer</option>
                  <option value="Bank">Meezan Bank Online</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Closure Remarks</label>
                <input
                  type="text"
                  value={settlementNotes}
                  onChange={e => setSettlementNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCloseModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-700 py-2.5 font-bold text-white">
                  Close Account
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Plan / Dual Guarantors / Sector Modal */}
      {showEditModal && selectedAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Edit Guarantors, Sector & Recovery Details</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleEditPlanSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Sector / Area</label>
                  <input
                    type="text"
                    value={editLocationSector}
                    onChange={e => setEditLocationSector(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alternate Mobile</label>
                  <input
                    type="text"
                    value={editMobile2}
                    onChange={e => setEditMobile2(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Profession</label>
                  <input
                    type="text"
                    value={editProfession}
                    onChange={e => setEditProfession(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Reference</label>
                  <input
                    type="text"
                    value={editReferenceName}
                    onChange={e => setEditReferenceName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2"
                  />
                </div>
              </div>

              <p className="font-bold text-slate-700 pt-1">1st Guarantor</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Guarantor 1 Name"
                  value={editGuarantorName}
                  onChange={e => setEditGuarantorName(e.target.value)}
                  className="rounded-xl border border-slate-200 p-2"
                />
                <input
                  type="text"
                  required
                  placeholder="Guarantor 1 Phone"
                  value={editGuarantorPhone}
                  onChange={e => setEditGuarantorPhone(e.target.value)}
                  className="rounded-xl border border-slate-200 p-2"
                />
                <input
                  type="text"
                  required
                  placeholder="Guarantor 1 CNIC"
                  value={editGuarantorCnic}
                  onChange={e => setEditGuarantorCnic(e.target.value)}
                  className="rounded-xl border border-slate-200 p-2"
                />
                <input
                  type="text"
                  placeholder="Relation"
                  value={editGuarantorRel}
                  onChange={e => setEditGuarantorRel(e.target.value)}
                  className="rounded-xl border border-slate-200 p-2"
                />
              </div>

              <p className="font-bold text-slate-700 pt-1">2nd Guarantor (Optional)</p>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Guarantor 2 Name"
                  value={editGuarantor2Name}
                  onChange={e => setEditGuarantor2Name(e.target.value)}
                  className="rounded-xl border border-slate-200 p-2"
                />
                <input
                  type="text"
                  placeholder="Guarantor 2 Phone"
                  value={editGuarantor2Phone}
                  onChange={e => setEditGuarantor2Phone(e.target.value)}
                  className="rounded-xl border border-slate-200 p-2"
                />
                <input
                  type="text"
                  placeholder="Guarantor 2 CNIC"
                  value={editGuarantor2Cnic}
                  onChange={e => setEditGuarantor2Cnic(e.target.value)}
                  className="rounded-xl border border-slate-200 p-2"
                />
                <input
                  type="text"
                  placeholder="Relation"
                  value={editGuarantor2Rel}
                  onChange={e => setEditGuarantor2Rel(e.target.value)}
                  className="rounded-xl border border-slate-200 p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Recovery Officer</label>
                  <input
                    type="text"
                    value={editOfficerName}
                    onChange={e => setEditOfficerName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Account Notes</label>
                  <input
                    type="text"
                    value={editNotes}
                    onChange={e => setEditNotes(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 py-2.5 font-bold text-white">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
