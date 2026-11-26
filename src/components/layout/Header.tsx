import React, { useState, useEffect } from 'react';
import {
  Search, Bell, UserCheck, ShoppingCart,
  UserPlus, Shield, ChevronDown, LogOut,
  AlertTriangle, Store, Cloud, ShieldCheck, KeyRound, Sparkles
} from 'lucide-react';
import {
  getSettings, getProducts,
  getInstallmentAccounts, getVisitors
} from '../../services/storage';
import { InventoryAlertNotification } from './InventoryAlertNotification';
import { getCloudPersistenceStatus } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';

interface HeaderProps {
  onOpenSearch: () => void;
  onNavigate: (module: string) => void;
  onOpenQuickSale: () => void;
  onOpenQuickVisitor: () => void;
  onOpenQuickAttendance: () => void;
  onOpenLoginModal: () => void;
  onOpenAiAssistant?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSearch,
  onNavigate,
  onOpenQuickSale,
  onOpenQuickVisitor,
  onOpenQuickAttendance,
  onOpenAiAssistant,
}) => {
  const {
    staffUser,
    isOwner,
    connectionStatus,
    can,
    logout,
  } = useAuth();

  const settings = getSettings();
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const lowStockCount = getProducts().filter(p => p.stockQuantity <= p.minStockLevel).length;
  const overdueCount = getInstallmentAccounts().filter(a => a.status === 'Overdue').length;
  const insideVisitors = getVisitors().filter(v => v.status === 'Inside').length;
  const totalAlerts = lowStockCount + overdueCount;

  const displayName = staffUser?.name || staffUser?.email || 'Authenticated User';
  const displayRole = staffUser?.customRoleName || staffUser?.role || 'Staff';

  const cloudStatus = getCloudPersistenceStatus();

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 sm:px-6 backdrop-blur-md no-print [font-family:Georgia] italic">
      {/* Left: Showroom Identity */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white shadow-md shadow-blue-500/20">
          <Store className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight leading-tight">
              {settings.showroomName}
            </h1>
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300"
              title="Live Cloud Firestore Production Workspace"
            >
              <ShieldCheck className="h-3 w-3 text-emerald-600" />
              <span>Live Cloud ERP</span>
            </span>

            {cloudStatus.isConfigured && (
              <span
                className="hidden xl:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200"
                title={connectionStatus.message || cloudStatus.details}
              >
                <Cloud className="h-3 w-3 text-blue-600" />
                <span>{connectionStatus.online ? 'Firestore Synced' : 'Firestore Ready'}</span>
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500 hidden sm:block">
            {settings.city} • Fiscal Year 2026-27 • Currency: {settings.currency} (₨)
          </p>
        </div>
      </div>

      {/* Center: Global Search Bar */}
      <div className="hidden md:flex items-center flex-1 max-w-md mx-6">
        <button
          onClick={onOpenSearch}
          className="flex w-full h-[65.4537px] items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2 text-xs text-slate-400 hover:border-slate-300 hover:bg-slate-100/70 transition shadow-xs text-left"
        >
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-slate-400" />
            <span>Search serial numbers, models, customers, invoices...</span>
          </div>
          <kbd className="px-2 py-0.5 text-[10px] font-mono text-slate-500 bg-white rounded border border-slate-200 shadow-2xs">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Right: Quick Actions, Notifications & Active Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={onOpenSearch}
          className="md:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
          title="Search"
        >
          <Search className="h-5 w-5" />
        </button>

        {can('pos', 'CREATE') && (
          <button
            onClick={onOpenQuickSale}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-xs font-semibold text-white shadow-xs transition active:scale-98"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            <span>New Sale (POS)</span>
          </button>
        )}

        {can('visitors', 'CREATE') && (
          <button
            onClick={onOpenQuickVisitor}
            className="hidden lg:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition"
            title="Visitor Check-In"
          >
            <UserPlus className="h-3.5 w-3.5 text-emerald-600" />
            <span>Visitor ({insideVisitors} In)</span>
          </button>
        )}

        {can('attendance', 'CREATE') && (
          <button
            onClick={onOpenQuickAttendance}
            className="hidden xl:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition whitespace-nowrap shrink-0"
            title="Staff Attendance"
          >
            <UserCheck className="h-3.5 w-3.5 text-indigo-600" />
            <span>Attendance</span>
          </button>
        )}

        {onOpenAiAssistant && (
          <button
            onClick={onOpenAiAssistant}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-900 hover:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-white shadow-xs transition whitespace-nowrap shrink-0"
            title="ERP Business Assistant"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">AI Assistant</span>
          </button>
        )}

        <div className="hidden 2xl:flex flex-col text-right font-mono text-[11px] text-slate-500 px-2 border-l border-slate-200">
          <span className="font-semibold text-slate-700">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
          <span className="text-[10px]">
            {currentTime.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short' })}
          </span>
        </div>

        <InventoryAlertNotification onNavigate={onNavigate} />

        {/* Notifications Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
            className="relative p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <Bell className="h-5 w-5" />
            {totalAlerts > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white ring-2 ring-white">
                {totalAlerts}
              </span>
            )}
          </button>

          {showNotificationDropdown && (
            <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-white shadow-xl ring-1 ring-slate-900/10 p-3 z-50">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Business Alerts</p>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">
                  {totalAlerts} Active
                </span>
              </div>
              <div className="space-y-2 text-xs">
                {lowStockCount > 0 && (
                  <div
                    onClick={() => { onNavigate('inventory'); setShowNotificationDropdown(false); }}
                    className="flex items-start gap-2.5 p-2 rounded-xl bg-amber-50 border border-amber-100 text-amber-900 cursor-pointer hover:bg-amber-100/60 transition"
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">{lowStockCount} Products Low on Stock</p>
                      <p className="text-[11px] text-amber-700 mt-0.5">Below reorder minimum. Click to restock.</p>
                    </div>
                  </div>
                )}

                {overdueCount > 0 && (
                  <div
                    onClick={() => { onNavigate('installments'); setShowNotificationDropdown(false); }}
                    className="flex items-start gap-2.5 p-2 rounded-xl bg-rose-50 border border-rose-100 text-rose-900 cursor-pointer hover:bg-rose-100/60 transition"
                  >
                    <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">{overdueCount} Overdue Installment Accounts</p>
                      <p className="text-[11px] text-rose-700 mt-0.5">Installment payment overdue. View recovery list.</p>
                    </div>
                  </div>
                )}

                {insideVisitors > 0 && (
                  <div
                    onClick={() => { onNavigate('visitors'); setShowNotificationDropdown(false); }}
                    className="flex items-start gap-2.5 p-2 rounded-xl bg-blue-50 border border-blue-100 text-blue-900 cursor-pointer hover:bg-blue-100/60 transition"
                  >
                    <UserPlus className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">{insideVisitors} Visitors Inside Showroom</p>
                      <p className="text-[11px] text-blue-700 mt-0.5">Currently meeting staff or browsing.</p>
                    </div>
                  </div>
                )}

                {totalAlerts === 0 && insideVisitors === 0 && (
                  <p className="text-center py-4 text-slate-400">All systems normal. No active alerts.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Verified User Profile Menu (No insecure 1-click role switching in live mode) */}
        <div className="relative">
          <button
            onClick={() => setShowProfileDropdown(!showProfileDropdown)}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 p-1.5 sm:px-2.5 hover:bg-slate-100 transition shadow-2xs"
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700 font-bold text-xs">
              {displayName.charAt(0)}
            </div>
            <div className="text-left hidden md:block">
              <p className="text-xs font-semibold text-slate-800 leading-tight">{displayName}</p>
              <div className="flex items-center gap-1">
                <Shield className="h-2.5 w-2.5 text-blue-600" />
                <span className="text-[10px] font-medium text-blue-600">{displayRole}</span>
              </div>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {showProfileDropdown && (
            <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white shadow-xl ring-1 ring-slate-900/10 p-3 z-50 space-y-2">
              <div className="pb-2 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-900">{displayName}</p>
                <p className="text-[11px] text-slate-500">{staffUser?.email}</p>
                <span className="mt-1 inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold">
                  {displayRole}
                </span>
              </div>

              {isOwner && (
                <button
                  onClick={() => { setShowProfileDropdown(false); onNavigate('admin'); }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold hover:bg-slate-800"
                >
                  <KeyRound className="h-3.5 w-3.5" />
                  <span>Owner Super Admin & Security</span>
                </button>
              )}

              <button
                onClick={async () => { setShowProfileDropdown(false); await logout(); }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 text-xs font-bold hover:bg-rose-100"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
