import React, { useState, useEffect } from 'react';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import { GlobalSearchModal } from './components/layout/GlobalSearchModal';
import { LoginModal } from './components/auth/LoginModal';

import { DashboardView } from './components/dashboard/DashboardView';
import { POSBillingView } from './components/pos/POSBillingView';
import { InventoryView } from './components/inventory/InventoryView';
import { PurchasesView } from './components/purchases/PurchasesView';
import { InstallmentsView } from './components/installments/InstallmentsView';
import { CustomersView } from './components/customers/CustomersView';
import { SuppliersView } from './components/suppliers/SuppliersView';
import { AttendanceView } from './components/attendance/AttendanceView';
import { TasksView } from './components/tasks/TasksView';
import { VisitorsView } from './components/visitors/VisitorsView';
import { AccountingView } from './components/accounting/AccountingView';
import { LedgersView } from './components/ledgers/LedgersView';
import { ChequesView } from './components/cheques/ChequesView';
import { ReportsView } from './components/reports/ReportsView';
import { TargetsView } from './components/targets/TargetsView';
import { AuditBackupView } from './components/audit/AuditBackupView';
import { SettingsView } from './components/settings/SettingsView';

import { subscribeToDatabase, checkInVisitor, markStaffCheckIn, getEmployees } from './services/storage';

export default function App() {
  const [currentModule, setCurrentModule] = useState<string>('dashboard');
  const [showSearchModal, setShowSearchModal] = useState<boolean>(false);
  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [dbVersion, setDbVersion] = useState<number>(0);

  // Quick Action Modals
  const [showQuickVisitor, setShowQuickVisitor] = useState(false);
  const [showQuickAttendance, setShowQuickAttendance] = useState(false);
  const [visName, setVisName] = useState('');
  const [visPhone, setVisPhone] = useState('');
  const [visPurpose, setVisPurpose] = useState('Product Inquiry');
  const [selectedEmpId, setSelectedEmpId] = useState('');

  // Subscribe to persistent storage updates
  useEffect(() => {
    const unsubscribe = subscribeToDatabase(() => {
      setDbVersion(v => v + 1);
    });
    return unsubscribe;
  }, []);

  // Keyboard shortcut listener for Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearchModal(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNavigate = (module: string) => {
    setCurrentModule(module);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const employees = getEmployees();

  const handleQuickVisitorSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!visName || !visPhone) return;
    checkInVisitor({
      name: visName,
      phone: visPhone,
      purpose: visPurpose as any,
      personToMeet: employees[1]?.name || 'Showroom Sales Staff',
      remarks: 'Fast check-in from top bar'
    });
    setShowQuickVisitor(false);
    setVisName('');
    setVisPhone('');
  };

  const handleQuickAttendanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const empId = selectedEmpId || employees[0]?.id;
    if (empId) {
      markStaffCheckIn(empId, 'Floor Check-in');
    }
    setShowQuickAttendance(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 flex flex-col antialiased">
      {/* Top Application Header */}
      <Header
        onOpenSearch={() => setShowSearchModal(true)}
        onNavigate={handleNavigate}
        onOpenQuickSale={() => setCurrentModule('pos')}
        onOpenQuickVisitor={() => setShowQuickVisitor(true)}
        onOpenQuickAttendance={() => setShowQuickAttendance(true)}
        onOpenLoginModal={() => setShowLoginModal(true)}
      />

      {/* Main Body with Sidebar & Dynamic Workspace */}
      <div className="flex flex-1">
        <Sidebar
          currentModule={currentModule}
          onNavigate={handleNavigate}
          onOpenLoginModal={() => setShowLoginModal(true)}
        />

        {/* Viewport Workspace */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full overflow-x-hidden">
          {currentModule === 'dashboard' && (
            <DashboardView
              onNavigate={handleNavigate}
              onOpenQuickSale={() => setCurrentModule('pos')}
              onOpenQuickVisitor={() => setShowQuickVisitor(true)}
            />
          )}

          {currentModule === 'pos' && <POSBillingView />}
          {currentModule === 'inventory' && <InventoryView />}
          {currentModule === 'purchases' && <PurchasesView />}
          {currentModule === 'installments' && <InstallmentsView />}
          {currentModule === 'customers' && <CustomersView />}
          {currentModule === 'suppliers' && <SuppliersView />}
          {currentModule === 'attendance' && <AttendanceView />}
          {currentModule === 'tasks' && <TasksView />}
          {currentModule === 'visitors' && <VisitorsView />}
          {currentModule === 'accounting' && <AccountingView />}
          {currentModule === 'ledgers' && <LedgersView />}
          {currentModule === 'cheques' && <ChequesView />}
          {currentModule === 'reports' && <ReportsView />}
          {currentModule === 'targets' && <TargetsView />}
          {currentModule === 'audit' && <AuditBackupView />}
          {currentModule === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Global Omnibar Search Modal */}
      <GlobalSearchModal
        isOpen={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        onNavigate={handleNavigate}
      />

      {/* Secure Access Portal / Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />

      {/* Quick Visitor Modal */}
      {showQuickVisitor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Fast Visitor Check-In</h3>
            <form onSubmit={handleQuickVisitorSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 mb-1">Visitor Name *</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={visName}
                  onChange={e => setVisName(e.target.value)}
                  placeholder="e.g. Asim Munir"
                  className="w-full rounded-xl border border-slate-200 p-2 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Mobile Number *</label>
                <input
                  type="text"
                  required
                  value={visPhone}
                  onChange={e => setVisPhone(e.target.value)}
                  placeholder="0300-1234567"
                  className="w-full rounded-xl border border-slate-200 p-2 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Visit Purpose</label>
                <select
                  value={visPurpose}
                  onChange={e => setVisPurpose(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2"
                >
                  <option value="Product Inquiry">Product Inquiry</option>
                  <option value="Product Purchase">Product Purchase</option>
                  <option value="Installment Inquiry">Installment Inquiry</option>
                  <option value="Installment Payment">Installment Payment</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickVisitor(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2 font-medium text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-blue-600 py-2 font-bold text-white hover:bg-blue-700"
                >
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Attendance Modal */}
      {showQuickAttendance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs no-print">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Mark Staff Daily Check-In</h3>
            <form onSubmit={handleQuickAttendanceSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 mb-1">Select Employee *</label>
                <select
                  value={selectedEmpId}
                  onChange={e => setSelectedEmpId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5"
                >
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.name} ({e.designation})</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowQuickAttendance(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2 font-medium text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-indigo-600 py-2 font-bold text-white hover:bg-indigo-700"
                >
                  Mark Check-In
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
