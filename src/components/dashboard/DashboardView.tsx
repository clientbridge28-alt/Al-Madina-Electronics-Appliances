import React, { useState, useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, ShoppingBag, CreditCard, 
  Package, AlertTriangle, Users, Truck, UserCheck, 
  UserPlus, DollarSign, ArrowUpRight, ArrowDownRight,
  Calendar, CheckCircle, Clock, ChevronRight, Eye
} from 'lucide-react';
import { 
  getSales, getPurchases, getProducts, getCustomers, 
  getSuppliers, getInstallmentAccounts, getAttendance, 
  getVisitors, checkOutVisitor, getActiveUser, getSettings 
} from '../../services/storage';

interface DashboardViewProps {
  onNavigate: (module: string) => void;
  onOpenQuickSale: () => void;
  onOpenQuickVisitor: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onOpenQuickSale,
  onOpenQuickVisitor
}) => {
  const [dateFilter, setDateFilter] = useState<'Today' | 'Week' | 'Month' | 'Year'>('Today');

  const sales = getSales();
  const purchases = getPurchases();
  const products = getProducts();
  const customers = getCustomers();
  const suppliers = getSuppliers();
  const installments = getInstallmentAccounts();
  const attendance = getAttendance();
  const visitors = getVisitors();
  const settings = getSettings();
  const currentUser = getActiveUser();

  // Calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const todaySales = sales.filter(s => s.date === todayStr || dateFilter === 'Year');
  const todayPurchases = purchases.filter(p => p.date === todayStr || dateFilter === 'Year');

  const totalSalesRevenue = useMemo(() => 
    sales.reduce((sum, s) => sum + s.grandTotal, 0), [sales]);

  const todaySalesAmount = useMemo(() => 
    todaySales.reduce((sum, s) => sum + s.grandTotal, 0), [todaySales]);

  const todayCashReceived = useMemo(() => 
    todaySales.reduce((sum, s) => sum + s.paidAmount, 0), [todaySales]);

  const totalInventoryValuation = useMemo(() => 
    products.reduce((sum, p) => sum + (p.purchasePrice * p.stockQuantity), 0), [products]);

  const totalCustomerReceivables = useMemo(() => 
    customers.reduce((sum, c) => sum + c.currentBalance, 0), [customers]);

  const totalSupplierPayables = useMemo(() => 
    suppliers.reduce((sum, s) => sum + s.currentBalance, 0), [suppliers]);

  // Low stock products
  const lowStockItems = useMemo(() => 
    products.filter(p => p.stockQuantity <= p.minStockLevel), [products]);

  // Overdue Installments
  const overdueAccounts = useMemo(() => 
    installments.filter(a => a.status === 'Overdue'), [installments]);

  // Visitors Inside
  const insideVisitors = useMemo(() => 
    visitors.filter(v => v.status === 'Inside'), [visitors]);

  // Staff Present Today
  const presentStaffCount = useMemo(() => 
    attendance.filter(a => a.date === todayStr && (a.status === 'Present' || a.status === 'Late')).length, 
    [attendance, todayStr]
  );

  return (
    <div className="space-y-6">
      {/* Top Welcome Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-white p-5 border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Welcome back, {currentUser.name}! 👋
            </h2>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              {currentUser.role}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time live overview of showroom floor sales, inventory, recovery & visitors.
          </p>
        </div>

        {/* Date Filter Tabs */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
            {(['Today', 'Week', 'Month', 'Year'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setDateFilter(tab)}
                className={`px-3 py-1 rounded-lg transition ${
                  dateFilter === tab ? 'bg-white text-slate-900 shadow-2xs' : 'hover:text-slate-900'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <button
            onClick={onOpenQuickSale}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition active:scale-98"
          >
            <ShoppingBag className="h-4 w-4" />
            <span>POS Sale</span>
          </button>
        </div>
      </div>

      {/* Low Stock Banner (Retaillet Screenshot style) */}
      {lowStockItems.length > 0 && (
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-amber-50/90 border border-amber-200/80 text-amber-900 text-xs shadow-2xs">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>
              <strong>Stock Alert:</strong> {lowStockItems.map(i => `${i.name} (${i.stockQuantity} pcs left)`).slice(0, 2).join(', ')}
              {lowStockItems.length > 2 && ` and ${lowStockItems.length - 2} other items are running below reorder level.`}
            </span>
          </div>
          <button
            onClick={() => onNavigate('inventory')}
            className="font-bold text-amber-800 hover:text-amber-950 underline shrink-0 ml-3"
          >
            Restock Inventory →
          </button>
        </div>
      )}

      {/* Top KPI Cards (Compreo & ShopExpress Screenshot style) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Today Sales */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Today's Sales</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <ShoppingBag className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              ₨ {todaySalesAmount.toLocaleString()}
            </p>
            <div className="flex items-center gap-1.5 text-xs mt-1 text-emerald-600 font-semibold">
              <TrendingUp className="h-3.5 w-3.5" />
              <span>+18.4% vs yesterday</span>
            </div>
          </div>
        </div>

        {/* Card 2: Cash Collected */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cash Received</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              ₨ {todayCashReceived.toLocaleString()}
            </p>
            <div className="flex items-center gap-1.5 text-xs mt-1 text-slate-500">
              <span>Drawer cash & bank collection</span>
            </div>
          </div>
        </div>

        {/* Card 3: Stock Valuation */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Stock Valuation</span>
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
              <Package className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              ₨ {(totalInventoryValuation / 1000000).toFixed(2)}M
            </p>
            <div className="flex items-center gap-1.5 text-xs mt-1 text-slate-500">
              <span>{products.length} Products ({products.reduce((a,b)=>a+b.stockQuantity,0)} units)</span>
            </div>
          </div>
        </div>

        {/* Card 4: Customer Receivables */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Receivables & Recovery</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <CreditCard className="h-4 w-4" />
            </div>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-900 font-mono tracking-tight">
              ₨ {totalCustomerReceivables.toLocaleString()}
            </p>
            <div className="flex items-center gap-1.5 text-xs mt-1 text-rose-600 font-semibold">
              <span>{overdueAccounts.length} Overdue Installments</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts & Analytics Row (ShopExpress & Compreo Style) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Sales & Purchases Trend Bar Chart (2 Cols) */}
        <div className="lg:col-span-2 rounded-2xl bg-white p-5 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Sales Volume & Purchases Trend</h3>
              <p className="text-xs text-slate-400">Monthly showroom trade figures (₨ in Lakhs)</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-blue-600" />
                <span className="text-slate-600">Sales</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-amber-400" />
                <span className="text-slate-600">Purchases</span>
              </div>
            </div>
          </div>

          {/* SVG Bar Chart */}
          <div className="h-64 w-full flex items-end justify-between gap-4 pt-6 pb-2 px-2 border-b border-slate-100">
            {[
              { month: 'Jun', sale: 42, purchase: 35 },
              { month: 'Jul', sale: 58, purchase: 45 },
              { month: 'Aug', sale: 65, purchase: 50 },
              { month: 'Sep', sale: 72, purchase: 60 },
              { month: 'Oct', sale: 84, purchase: 68 },
              { month: 'Nov', sale: 95, purchase: 74 }
            ].map((bar, idx) => (
              <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                <div className="w-full flex items-end justify-center gap-1.5 h-48">
                  {/* Sale Bar */}
                  <div 
                    style={{ height: `${(bar.sale / 100) * 100}%` }}
                    className="w-1/2 max-w-[24px] rounded-t-md bg-blue-600 hover:bg-blue-700 transition relative group-hover:shadow-sm"
                  >
                    <span className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-0.5 px-1.5 rounded font-mono pointer-events-none transition">
                      ₨{bar.sale}L
                    </span>
                  </div>
                  {/* Purchase Bar */}
                  <div 
                    style={{ height: `${(bar.purchase / 100) * 100}%` }}
                    className="w-1/2 max-w-[24px] rounded-t-md bg-amber-400 hover:bg-amber-500 transition relative group-hover:shadow-sm"
                  >
                    <span className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[10px] py-0.5 px-1.5 rounded font-mono pointer-events-none transition">
                      ₨{bar.purchase}L
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-medium text-slate-500">{bar.month}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
            <span>Showroom Turnover: <strong>₨ 4.16 Crore</strong> Year to Date</span>
            <button onClick={() => onNavigate('reports')} className="text-blue-600 font-bold hover:underline">
              View Detailed Analytics →
            </button>
          </div>
        </div>

        {/* Category Distribution Donut Chart (ShopExpress Screenshot) */}
        <div className="rounded-2xl bg-white p-5 border border-slate-200 shadow-2xs space-y-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Inventory Distribution</h3>
            <p className="text-xs text-slate-400">Stock portfolio by product category</p>
          </div>

          <div className="relative flex items-center justify-center py-4">
            {/* SVG Donut */}
            <svg className="h-44 w-44 transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="38" stroke="#f1f5f9" strokeWidth="16" fill="transparent" />
              {/* Air Conditioners (35%) */}
              <circle cx="50" cy="50" r="38" stroke="#2563eb" strokeWidth="16" strokeDasharray="83.5 155.5" strokeDashoffset="0" fill="transparent" />
              {/* Refrigerators (28%) */}
              <circle cx="50" cy="50" r="38" stroke="#06b6d4" strokeWidth="16" strokeDasharray="66.8 172.2" strokeDashoffset="-83.5" fill="transparent" />
              {/* LEDs & Mobiles (22%) */}
              <circle cx="50" cy="50" r="38" stroke="#a855f7" strokeWidth="16" strokeDasharray="52.5 186.5" strokeDashoffset="-150.3" fill="transparent" />
              {/* Home Appliances (15%) */}
              <circle cx="50" cy="50" r="38" stroke="#f59e0b" strokeWidth="16" strokeDasharray="35.8 203.2" strokeDashoffset="-202.8" fill="transparent" />
            </svg>
            <div className="absolute text-center">
              <span className="text-xs font-bold text-slate-400 block uppercase">Warehouse</span>
              <span className="text-base font-extrabold text-slate-900">51 Units</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
              <span className="text-slate-600">Air Conditioners (35%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-500" />
              <span className="text-slate-600">Refrigerators (28%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-purple-500" />
              <span className="text-slate-600">LEDs & Phones (22%)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span className="text-slate-600">Appliances (15%)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Operational Highlights: Visitors Inside & Staff Attendance & Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Visitors Inside Right Now */}
        <div className="rounded-2xl bg-white p-5 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                <UserPlus className="h-4 w-4" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Visitors in Showroom ({insideVisitors.length})
              </h3>
            </div>
            <button
              onClick={onOpenQuickVisitor}
              className="text-[11px] font-semibold text-blue-600 hover:underline"
            >
              + Check In
            </button>
          </div>

          <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
            {insideVisitors.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No visitors currently inside.</p>
            ) : (
              insideVisitors.map(v => (
                <div key={v.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-800">{v.name}</p>
                    <p className="text-[11px] text-slate-400">{v.purpose} • Host: {v.personToMeet}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      In {v.entryTime}
                    </span>
                    <button
                      onClick={() => checkOutVisitor(v.id)}
                      className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-medium"
                    >
                      Exit
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Staff Attendance Summary (Daftar Screenshot) */}
        <div className="rounded-2xl bg-white p-5 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
                <UserCheck className="h-4 w-4" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Staff Present Today ({presentStaffCount})
              </h3>
            </div>
            <button
              onClick={() => onNavigate('attendance')}
              className="text-[11px] font-semibold text-blue-600 hover:underline"
            >
              Attendance Sheet →
            </button>
          </div>

          <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
            {attendance.slice(0, 4).map(a => (
              <div key={a.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-slate-800">{a.employeeName}</p>
                  <p className="text-[11px] text-slate-400">{a.notes || 'Duty shift'}</p>
                </div>
                <div className="text-right">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    a.status === 'Present' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                  }`}>
                    {a.status} ({a.checkInTime})
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Overdue Installments & Recovery Due */}
        <div className="rounded-2xl bg-white p-5 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600">
                <Clock className="h-4 w-4" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Installment Follow-Ups ({overdueAccounts.length})
              </h3>
            </div>
            <button
              onClick={() => onNavigate('installments')}
              className="text-[11px] font-semibold text-blue-600 hover:underline"
            >
              Recovery Desk →
            </button>
          </div>

          <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto">
            {overdueAccounts.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No overdue installments! 100% on track.</p>
            ) : (
              overdueAccounts.map(inst => (
                <div key={inst.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-slate-800">{inst.customerName}</p>
                    <p className="text-[11px] text-slate-400">{inst.productName}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                      ₨ {inst.monthlyInstallment.toLocaleString()} Due
                    </span>
                    <p className="text-[10px] text-slate-400 mt-0.5">{inst.customerPhone}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
