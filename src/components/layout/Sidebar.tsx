import React from 'react';
import { 
  LayoutDashboard, ShoppingBag, Package, FileInput, 
  Calendar, Users, Truck, UserCheck, 
  UserPlus, BookOpen, Layers, CreditCard, 
  Target, BarChart3, ShieldAlert, Settings,
  LogOut, Tv, ChevronRight
} from 'lucide-react';
import { getActiveUser, getProducts, getInstallmentAccounts, getVisitors } from '../../services/storage';

interface SidebarProps {
  currentModule: string;
  onNavigate: (module: string) => void;
  onOpenLoginModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentModule,
  onNavigate,
  onOpenLoginModal
}) => {
  const user = getActiveUser();

  // Badges
  const lowStockCount = getProducts().filter(p => p.stockQuantity <= p.minStockLevel).length;
  const overdueCount = getInstallmentAccounts().filter(a => a.status === 'Overdue').length;
  const insideVisitors = getVisitors().filter(v => v.status === 'Inside').length;

  const navGroups = [
    {
      group: 'MAIN OPERATIONS',
      items: [
        { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
        { id: 'pos', label: 'Sales & POS Billing', icon: ShoppingBag, highlight: true },
        { id: 'inventory', label: 'Products & Serials', icon: Package, badge: lowStockCount > 0 ? `${lowStockCount} Low` : undefined, badgeColor: 'amber' },
        { id: 'purchases', label: 'Purchase Invoices', icon: FileInput },
        { id: 'installments', label: 'Installments & Recovery', icon: Calendar, badge: overdueCount > 0 ? `${overdueCount} Due` : undefined, badgeColor: 'rose' }
      ]
    },
    {
      group: 'PEOPLE & ENTITIES',
      items: [
        { id: 'customers', label: 'Customers Directory', icon: Users },
        { id: 'suppliers', label: 'Suppliers & Vendors', icon: Truck },
        { id: 'attendance', label: 'Staff Attendance', icon: UserCheck },
        { id: 'visitors', label: 'Visitors Register', icon: UserPlus, badge: insideVisitors > 0 ? `${insideVisitors} In` : undefined, badgeColor: 'emerald' }
      ]
    },
    {
      group: 'FINANCE & ACCOUNTS',
      items: [
        { id: 'accounting', label: 'Vouchers & Journals', icon: BookOpen },
        { id: 'ledgers', label: 'Ledgers & Trial Balance', icon: Layers },
        { id: 'cheques', label: 'Cheque Management', icon: CreditCard }
      ]
    },
    {
      group: 'ADMIN & ANALYTICS',
      items: [
        { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
        { id: 'targets', label: 'Targets & Goals', icon: Target },
        { id: 'audit', label: 'Audit Trail & Backup', icon: ShieldAlert },
        { id: 'settings', label: 'Showroom Settings', icon: Settings }
      ]
    }
  ];

  return (
    <aside className="w-64 shrink-0 border-r border-slate-200 bg-white flex flex-col h-[calc(100vh-4rem)] sticky top-16 no-print overflow-hidden select-none">
      {/* Brand Sub-header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
            <Tv className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Showroom Suite
          </span>
        </div>
        <span className="text-[10px] bg-blue-100 text-blue-800 font-mono px-1.5 py-0.5 rounded font-semibold">
          v2.6 Enterprise
        </span>
      </div>

      {/* Nav List */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {navGroups.map((grp, idx) => (
          <div key={idx}>
            <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              {grp.group}
            </p>
            <div className="space-y-0.5">
              {grp.items.map(item => {
                const Icon = item.icon;
                const isActive = currentModule === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => onNavigate(item.id)}
                    className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-xs font-medium transition group ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-xs font-semibold'
                        : item.highlight
                        ? 'text-blue-700 hover:bg-blue-50/80'
                        : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className={`h-4 w-4 shrink-0 transition ${
                        isActive ? 'text-white' : item.highlight ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'
                      }`} />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge ? (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-white/20 text-white'
                          : item.badgeColor === 'rose'
                          ? 'bg-rose-100 text-rose-700'
                          : item.badgeColor === 'amber'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {item.badge}
                      </span>
                    ) : isActive ? (
                      <ChevronRight className="h-3.5 w-3.5 text-white/70 shrink-0" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* User Footer Profile & Login link */}
      <div className="p-3 border-t border-slate-200 bg-slate-50/70">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white font-bold text-xs shadow-xs">
              {user.name.charAt(0)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate leading-tight">{user.name}</p>
              <p className="text-[10px] text-blue-600 font-medium truncate">{user.role}</p>
            </div>
          </div>

          <button
            onClick={onOpenLoginModal}
            title="Lock session / Open Login Portal"
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
