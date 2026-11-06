import React, { useState, useMemo } from 'react';
import { 
  UserPlus, Search, Calendar, Clock, 
  CheckCircle, UserCheck, X, LogOut, ArrowRight 
} from 'lucide-react';
import { getVisitors, checkInVisitor, checkOutVisitor, getEmployees } from '../../services/storage';
import { VisitorRecord } from '../../types/erp';
import { Badge } from '../common/Badge';

export const VisitorsView: React.FC = () => {
  const [visitors, setVisitors] = useState<VisitorRecord[]>(getVisitors());
  const employees = getEmployees();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Inside' | 'Checked Out'>('All');
  const [showCheckInModal, setShowCheckInModal] = useState(false);

  // Form
  const [visName, setVisName] = useState('');
  const [visPhone, setVisPhone] = useState('');
  const [visCnic, setVisCnic] = useState('');
  const [visPurpose, setVisPurpose] = useState<VisitorRecord['purpose']>('Product Inquiry');
  const [visHost, setVisHost] = useState(employees[1]?.name || 'Showroom Sales Staff');
  const [visRemarks, setVisRemarks] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  // Stats
  const insideCount = visitors.filter(v => v.status === 'Inside').length;
  const todayTotal = visitors.filter(v => v.entryDate === todayStr).length;

  const handleSaveCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!visName || !visPhone) return;

    checkInVisitor({
      name: visName,
      phone: visPhone,
      cnic: visCnic || undefined,
      purpose: visPurpose,
      personToMeet: visHost,
      remarks: visRemarks
    });

    setVisitors(getVisitors());
    setShowCheckInModal(false);
    setVisName('');
    setVisPhone('');
    setVisCnic('');
    setVisRemarks('');
  };

  const handleCheckOut = (id: string) => {
    checkOutVisitor(id);
    setVisitors(getVisitors());
  };

  const filteredVisitors = visitors.filter(v => {
    const matchStatus = statusFilter === 'All' || v.status === statusFilter;
    const q = searchQuery.toLowerCase();
    const matchQuery = !q ||
      v.name.toLowerCase().includes(q) ||
      v.phone.includes(q) ||
      v.purpose.toLowerCase().includes(q) ||
      v.personToMeet.toLowerCase().includes(q);
    return matchStatus && matchQuery;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Showroom Visitors Register
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time tracking of customer walk-ins, inquiries, staff appointments & departure times
          </p>
        </div>

        <button
          onClick={() => setShowCheckInModal(true)}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-98 shrink-0"
        >
          <UserPlus className="h-4 w-4" />
          <span>New Visitor Check-In</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Currently Inside</span>
          <p className={`text-2xl font-black font-mono mt-1 ${insideCount > 0 ? 'text-emerald-700' : 'text-slate-900'}`}>
            {insideCount}
          </p>
          <p className="text-xs text-emerald-600 mt-0.5">Active showroom visitors</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Footfall</span>
          <p className="text-2xl font-black text-slate-900 font-mono mt-1">{todayTotal}</p>
          <p className="text-xs text-slate-400 mt-0.5">Total walk-ins recorded today</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">All-Time Visitors</span>
          <p className="text-2xl font-black text-slate-900 font-mono mt-1">{visitors.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">Historical CRM prospect log</p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
          {(['All', 'Inside', 'Checked Out'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-xl transition ${
                statusFilter === tab ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 hover:bg-slate-200'
              }`}
            >
              {tab} ({tab === 'All' ? visitors.length : visitors.filter(v => v.status === tab).length})
            </button>
          ))}
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search visitor name, phone, host..."
            className="w-full rounded-xl border border-slate-200 pl-10 pr-3.5 py-1.5 text-xs focus:outline-none focus:border-blue-600"
          />
        </div>
      </div>

      {/* Visitors Table */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Visitor Name</th>
                <th className="py-3 px-4">Contact & CNIC</th>
                <th className="py-3 px-4">Purpose of Visit</th>
                <th className="py-3 px-4">Person to Meet</th>
                <th className="py-3 px-4">Entry Time</th>
                <th className="py-3 px-4">Exit Time</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredVisitors.map(v => (
                <tr key={v.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3.5 px-4 font-bold text-slate-900">{v.name}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-600">
                    <p>{v.phone}</p>
                    {v.cnic && <p className="text-[10px] text-slate-400">{v.cnic}</p>}
                  </td>
                  <td className="py-3.5 px-4 font-medium text-slate-800">
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                      {v.purpose}
                    </span>
                    {v.remarks && <p className="text-[10px] text-slate-400 mt-1 italic">{v.remarks}</p>}
                  </td>
                  <td className="py-3.5 px-4 text-slate-700">{v.personToMeet}</td>
                  <td className="py-3.5 px-4 font-mono font-medium text-emerald-700">{v.entryTime}</td>
                  <td className="py-3.5 px-4 font-mono text-slate-500">{v.exitTime || '—'}</td>
                  <td className="py-3.5 px-4 text-center">
                    <Badge variant={v.status === 'Inside' ? 'success' : 'neutral'} size="sm">
                      {v.status}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    {v.status === 'Inside' ? (
                      <button
                        onClick={() => handleCheckOut(v.id)}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] transition"
                      >
                        Check Out
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400">Completed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Check-In Modal */}
      {showCheckInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Showroom Visitor Entry Form</h3>
            <form onSubmit={handleSaveCheckIn} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Visitor Name *</label>
                <input
                  type="text"
                  required
                  value={visName}
                  onChange={e => setVisName(e.target.value)}
                  placeholder="e.g. Muhammad Kashif"
                  className="w-full rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={visPhone}
                    onChange={e => setVisPhone(e.target.value)}
                    placeholder="0300-1234567"
                    className="w-full rounded-xl border border-slate-200 p-2.5"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">CNIC (Optional)</label>
                  <input
                    type="text"
                    value={visCnic}
                    onChange={e => setVisCnic(e.target.value)}
                    placeholder="35202-0000000-0"
                    className="w-full rounded-xl border border-slate-200 p-2.5"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Purpose of Visit *</label>
                <select
                  value={visPurpose}
                  onChange={e => setVisPurpose(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5"
                >
                  <option value="Product Inquiry">Product Inquiry (Rates / Specs)</option>
                  <option value="Product Purchase">Product Purchase</option>
                  <option value="Installment Inquiry">Installment Inquiry & Plan</option>
                  <option value="Installment Payment">Installment Payment</option>
                  <option value="Warranty Claim">Warranty Claim / After Sales</option>
                  <option value="Vendor Meeting">Vendor / Supplier Meeting</option>
                  <option value="Other">Other Business</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Staff Member to Meet</label>
                <select
                  value={visHost}
                  onChange={e => setVisHost(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5"
                >
                  {employees.map(e => (
                    <option key={e.id} value={`${e.name} (${e.designation})`}>
                      {e.name} ({e.designation})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Remarks / Items Inquired</label>
                <input
                  type="text"
                  value={visRemarks}
                  onChange={e => setVisRemarks(e.target.value)}
                  placeholder="e.g. Inquired about Dawlance Inverter AC"
                  className="w-full rounded-xl border border-slate-200 p-2.5"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCheckInModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 font-bold text-white hover:bg-blue-700 shadow-sm"
                >
                  Check In Visitor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
