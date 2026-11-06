import React, { useState, useMemo } from 'react';
import { 
  UserCheck, Plus, Search, Calendar, Clock, 
  CheckCircle, AlertCircle, X, Check, ArrowRight 
} from 'lucide-react';
import { 
  getAttendance, getEmployees, markStaffCheckIn, 
  markStaffCheckOut, saveEmployee 
} from '../../services/storage';
import { AttendanceRecord, Employee } from '../../types/erp';
import { Badge } from '../common/Badge';

export const AttendanceView: React.FC = () => {
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(getAttendance());
  const [employees, setEmployees] = useState<Employee[]>(getEmployees());

  const [activeTab, setActiveTab] = useState<'Attendance' | 'Employees'>('Attendance');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCheckInModal, setShowCheckInModal] = useState(false);
  const [showNewEmpModal, setShowNewEmpModal] = useState(false);

  // Check In form
  const [selectedEmpId, setSelectedEmpId] = useState(employees[0]?.id || '');
  const [checkInNotes, setCheckInNotes] = useState('');

  // New Employee form
  const [empName, setEmpName] = useState('');
  const [empPhone, setEmpPhone] = useState('');
  const [empCnic, setEmpCnic] = useState('');
  const [empDesignation, setEmpDesignation] = useState('Sales Officer');
  const [empSalary, setEmpSalary] = useState(45000);

  const todayStr = new Date().toISOString().split('T')[0];

  // Today's stats
  const todayRecords = attendance.filter(a => a.date === todayStr);
  const presentCount = todayRecords.filter(a => a.status === 'Present' || a.status === 'Late').length;
  const lateCount = todayRecords.filter(a => a.status === 'Late').length;
  const totalEmployees = employees.length;

  const handleCheckIn = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmpId) return;
    markStaffCheckIn(selectedEmpId, checkInNotes);
    setAttendance(getAttendance());
    setShowCheckInModal(false);
    setCheckInNotes('');
  };

  const handleCheckOut = (attId: string) => {
    markStaffCheckOut(attId);
    setAttendance(getAttendance());
  };

  const handleAddEmployee = (e: React.FormEvent) => {
    e.preventDefault();
    const newEmp: Employee = {
      id: `EMP-${Date.now().toString().slice(-4)}`,
      name: empName,
      phone: empPhone,
      cnic: empCnic || '35202-0000000-0',
      designation: empDesignation,
      department: 'Showroom Floor',
      joiningDate: todayStr,
      salary: Number(empSalary),
      status: 'Active',
      shift: 'General (09:00 AM - 08:00 PM)'
    };
    saveEmployee(newEmp);
    setEmployees(getEmployees());
    setShowNewEmpModal(false);
  };

  const filteredAttendance = attendance.filter(a =>
    a.employeeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.date.includes(searchQuery)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Staff & Attendance Management
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Daftar-compliant showroom staff shifts, check-in timestamps, working hours & directory
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCheckInModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-98"
          >
            <UserCheck className="h-4 w-4" />
            <span>Mark Staff Check-In</span>
          </button>
          <button
            onClick={() => setShowNewEmpModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 transition"
          >
            <Plus className="h-4 w-4" />
            <span>New Employee</span>
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Staff</span>
          <p className="text-2xl font-black text-slate-900 font-mono mt-1">{totalEmployees}</p>
          <p className="text-xs text-slate-400 mt-0.5">Registered showroom personnel</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Present Today</span>
          <p className="text-2xl font-black text-emerald-700 font-mono mt-1">{presentCount}</p>
          <p className="text-xs text-emerald-600 mt-0.5">Checked in on shift</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Late Arrivals</span>
          <p className={`text-2xl font-black font-mono mt-1 ${lateCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
            {lateCount}
          </p>
          <p className="text-xs text-amber-700 mt-0.5">Arrived after 09:15 AM</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Date</span>
          <p className="text-base font-bold text-slate-900 mt-1 font-mono">{todayStr}</p>
          <p className="text-xs text-slate-400 mt-0.5">Automated timestamp server</p>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('Attendance')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'Attendance' ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Daily Attendance Log
          </button>
          <button
            onClick={() => setActiveTab('Employees')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition ${
              activeTab === 'Employees' ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Employee Directory ({employees.length})
          </button>
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search employee or date..."
            className="w-full rounded-xl border border-slate-200 pl-10 pr-3.5 py-1.5 text-xs focus:outline-none focus:border-blue-600"
          />
        </div>
      </div>

      {/* Daftar Style Attendance Table (Matching Screenshot_2026-11-06_195110_e06a790c.png) */}
      {activeTab === 'Attendance' ? (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Attendance Management Register</h3>
            <span className="text-xs text-slate-400 font-mono">{todayStr}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Employee Name</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Check-in Time</th>
                  <th className="py-3 px-4">Check-out Time</th>
                  <th className="py-3 px-4">Working Hours</th>
                  <th className="py-3 px-4">Notes</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAttendance.map(record => (
                  <tr key={record.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-slate-900">{record.employeeName}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{record.employeeId}</p>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      <Badge variant={record.status === 'Present' ? 'success' : record.status === 'Late' ? 'warning' : 'danger'} size="sm">
                        {record.status}
                      </Badge>
                    </td>

                    <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                      {record.checkInTime || 'N/A'}
                    </td>

                    <td className="py-3.5 px-4 font-mono font-medium text-slate-700">
                      {record.checkOutTime || 'N/A'}
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {record.workingHours ? `${record.workingHours} hrs` : 'In Progress'}
                    </td>

                    <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                      {record.notes || '—'}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {!record.checkOutTime ? (
                        <button
                          onClick={() => handleCheckOut(record.id)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-[11px]"
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
      ) : (
        /* Employee Directory Table */
        <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-4">Employee ID</th>
                  <th className="py-3 px-4">Full Name</th>
                  <th className="py-3 px-4">Designation & Dept</th>
                  <th className="py-3 px-4">Phone</th>
                  <th className="py-3 px-4">CNIC</th>
                  <th className="py-3 px-4 text-right">Monthly Salary</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {employees.map(emp => (
                  <tr key={emp.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-700">{emp.id}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{emp.name}</td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-800">{emp.designation}</p>
                      <p className="text-[10px] text-slate-400">{emp.department}</p>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono">{emp.phone}</td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono">{emp.cnic}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      ₨ {emp.salary.toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <Badge variant="success" size="sm">{emp.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Mark Check-In Modal */}
      {showCheckInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Mark Staff Daily Check-In</h3>
            <form onSubmit={handleCheckIn} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 mb-1">Select Employee *</label>
                <select
                  value={selectedEmpId}
                  onChange={e => setSelectedEmpId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 focus:outline-none focus:border-blue-600"
                >
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.designation})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Shift Notes (Optional)</label>
                <input
                  type="text"
                  value={checkInNotes}
                  onChange={e => setCheckInNotes(e.target.value)}
                  placeholder="e.g. Morning floor opening"
                  className="w-full rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:border-blue-600"
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
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 font-bold text-white hover:bg-blue-700"
                >
                  Record Check-In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      {showNewEmpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Register New Showroom Employee</h3>
            <form onSubmit={handleAddEmployee} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={empName}
                  onChange={e => setEmpName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Mobile Phone *</label>
                  <input
                    type="text"
                    required
                    value={empPhone}
                    onChange={e => setEmpPhone(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">CNIC</label>
                  <input
                    type="text"
                    value={empCnic}
                    onChange={e => setEmpCnic(e.target.value)}
                    placeholder="35202-0000000-0"
                    className="w-full rounded-xl border border-slate-200 p-2.5"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Designation</label>
                  <input
                    type="text"
                    value={empDesignation}
                    onChange={e => setEmpDesignation(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Monthly Salary (₨)</label>
                  <input
                    type="number"
                    value={empSalary}
                    onChange={e => setEmpSalary(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewEmpModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 font-bold text-white hover:bg-blue-700"
                >
                  Save Employee
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
