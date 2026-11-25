import React, { useState, useEffect, useMemo } from 'react';
import {
  Activity, Search, Filter, Download, RotateCcw,
  Clock, User, Layers, ShieldCheck, ChevronLeft, ChevronRight
} from 'lucide-react';
import { getAuditLogs, subscribeToDatabase } from '../../services/storage';
import { exportCollectionToCSV } from '../../services/excelService';
import { useAuth } from '../../context/AuthContext';
import type { AuditLog } from '../../types/erp';

type DateRangeFilter = 'all' | 'today' | '7d' | '30d';

const MODULE_BADGE_COLORS: Record<string, string> = {
  'Sales & POS': 'bg-blue-50 text-blue-700 border-blue-200',
  'Sales Return': 'bg-rose-50 text-rose-700 border-rose-200',
  Purchases: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'Purchase Return': 'bg-amber-50 text-amber-800 border-amber-200',
  Inventory: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Installments: 'bg-purple-50 text-purple-700 border-purple-200',
  Recovery: 'bg-teal-50 text-teal-700 border-teal-200',
  Accounting: 'bg-cyan-50 text-cyan-800 border-cyan-200',
  Cheques: 'bg-orange-50 text-orange-800 border-orange-200',
  Customers: 'bg-sky-50 text-sky-700 border-sky-200',
  Suppliers: 'bg-violet-50 text-violet-700 border-violet-200',
  Settings: 'bg-slate-100 text-slate-800 border-slate-300',
  SuperAdmin: 'bg-rose-100 text-rose-800 border-rose-300',
  Backup: 'bg-amber-50 text-amber-900 border-amber-200',
};

function getModuleBadgeClass(moduleName: string): string {
  return MODULE_BADGE_COLORS[moduleName] || 'bg-slate-100 text-slate-700 border-slate-200';
}

function getDateThresholdStr(range: DateRangeFilter): string | null {
  if (range === 'all') return null;
  const now = new Date();
  if (range === 'today') {
    return now.toISOString().slice(0, 10);
  }
  const days = range === '7d' ? 7 : 30;
  const d = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

export const ActivityLogs: React.FC = () => {
  const { isOwner, can, staffUser } = useAuth();
  const [, setDbTick] = useState(0);

  useEffect(() => {
    return subscribeToDatabase(() => setDbTick(t => t + 1));
  }, []);

  const canViewAllAudit = isOwner || can('audit', 'VIEW');
  const canExportAudit = isOwner || can('audit', 'EXPORT') || can('settings', 'EXPORT');

  const rawLogs = getAuditLogs();

  const scopedLogs: AuditLog[] = useMemo(() => {
    if (canViewAllAudit) return rawLogs;
    if (!staffUser?.uid) return [];
    return rawLogs.filter(log => log.userId === staffUser.uid);
  }, [rawLogs, canViewAllAudit, staffUser?.uid]);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('ALL');
  const [selectedRole, setSelectedRole] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<DateRangeFilter>('all');
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState<number>(1);

  const uniqueModules = useMemo(() => {
    const set = new Set<string>();
    scopedLogs.forEach(l => {
      if (l.module) set.add(l.module);
    });
    return Array.from(set).sort();
  }, [scopedLogs]);

  const uniqueRoles = useMemo(() => {
    const set = new Set<string>();
    scopedLogs.forEach(l => {
      if (l.userRole) set.add(l.userRole);
    });
    return Array.from(set).sort();
  }, [scopedLogs]);

  const filteredLogs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const minDate = getDateThresholdStr(dateRange);

    return scopedLogs.filter(log => {
      if (selectedModule !== 'ALL' && log.module !== selectedModule) return false;
      if (selectedRole !== 'ALL' && log.userRole !== selectedRole) return false;
      if (minDate) {
        const logDate = (log.timestamp || '').slice(0, 10);
        if (dateRange === 'today') {
          if (logDate !== minDate) return false;
        } else if (logDate < minDate) {
          return false;
        }
      }
      if (!q) return true;
      return (
        (log.userName || '').toLowerCase().includes(q) ||
        (log.userRole || '').toLowerCase().includes(q) ||
        (log.module || '').toLowerCase().includes(q) ||
        (log.action || '').toLowerCase().includes(q) ||
        (log.details || '').toLowerCase().includes(q) ||
        (log.recordId || '').toLowerCase().includes(q)
      );
    });
  }, [scopedLogs, searchQuery, selectedModule, selectedRole, dateRange]);

  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedModule, selectedRole, dateRange, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedLogs = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredLogs.slice(start, start + pageSize);
  }, [filteredLogs, safePage, pageSize]);

  // KPI Metrics
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = useMemo(
    () => scopedLogs.filter(l => (l.timestamp || '').startsWith(todayStr)).length,
    [scopedLogs, todayStr]
  );
  const activeActorsCount = useMemo(
    () => new Set(scopedLogs.map(l => l.userId || l.userName).filter(Boolean)).size,
    [scopedLogs]
  );
  const topModule = useMemo(() => {
    if (scopedLogs.length === 0) return '—';
    const counts = new Map<string, number>();
    for (const log of scopedLogs) {
      counts.set(log.module, (counts.get(log.module) || 0) + 1);
    }
    let best = '—';
    let bestCount = 0;
    for (const [mod, count] of counts.entries()) {
      if (count > bestCount) {
        best = mod;
        bestCount = count;
      }
    }
    return best;
  }, [scopedLogs]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    selectedModule !== 'ALL' ||
    selectedRole !== 'ALL' ||
    dateRange !== 'all';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedModule('ALL');
    setSelectedRole('ALL');
    setDateRange('all');
  };

  const handleExportCsv = () => {
    if (filteredLogs.length === 0) return;
    exportCollectionToCSV(
      filteredLogs.map(l => ({
        Timestamp: l.timestamp,
        User: l.userName,
        Role: l.userRole,
        Module: l.module,
        Action: l.action,
        RecordId: l.recordId || '',
        Details: l.details,
      })),
      'AlMadina_Activity_Logs'
    );
  };

  return (
    <div className="space-y-5 text-xs">
      {/* Header Card */}
      <div className="rounded-2xl bg-white p-5 border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-blue-700 border border-blue-100 shrink-0">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Showroom Activity Logs</h3>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                <ShieldCheck className="h-3 w-3" />
                Live Synced
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time chronological feed of recent staff actions across POS, Inventory, Purchases, Accounting &amp; Settings.
            </p>
          </div>
        </div>

        {canExportAudit && (
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredLogs.length === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition shrink-0"
          >
            <Download className="h-3.5 w-3.5 text-blue-600" />
            <span>Export CSV ({filteredLogs.length})</span>
          </button>
        )}
      </div>

      {!canViewAllAudit && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 font-medium">
          Showing your own recent actions. Organization-wide activity history requires the <strong>Audit Trail: VIEW</strong> permission.
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
            <span>Total Tracked Actions</span>
            <Activity className="h-4 w-4 text-blue-600" />
          </div>
          <p className="text-lg font-black text-slate-900 font-mono mt-1">{scopedLogs.length.toLocaleString()}</p>
        </div>

        <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
            <span>Today&apos;s Actions</span>
            <Clock className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="text-lg font-black text-emerald-700 font-mono mt-1">{todayCount.toLocaleString()}</p>
        </div>

        <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
            <span>Active Staff Actors</span>
            <User className="h-4 w-4 text-indigo-600" />
          </div>
          <p className="text-lg font-black text-slate-900 font-mono mt-1">{activeActorsCount}</p>
        </div>

        <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold">
            <span>Most Active Module</span>
            <Layers className="h-4 w-4 text-purple-600" />
          </div>
          <p className="text-sm font-black text-slate-900 mt-1.5 truncate" title={topModule}>{topModule}</p>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by staff name, action, module, record ID or details..."
              className="w-full rounded-xl border border-slate-200 pl-10 pr-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-slate-400 hidden sm:block" />
              <select
                value={selectedModule}
                onChange={e => setSelectedModule(e.target.value)}
                aria-label="Filter by module"
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-600"
              >
                <option value="ALL">All Modules</option>
                {uniqueModules.map(mod => (
                  <option key={mod} value={mod}>{mod}</option>
                ))}
              </select>
            </div>

            <select
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value)}
              aria-label="Filter by role"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-600"
            >
              <option value="ALL">All Roles</option>
              {uniqueRoles.map(role => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>

            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value as DateRangeFilter)}
              aria-label="Filter by timeframe"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-600"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 transition"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Activity Table */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">User &amp; Role</th>
                <th className="py-3 px-4">Module</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Details &amp; Reference</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-400">
                    {scopedLogs.length === 0
                      ? 'No activity logs have been recorded yet.'
                      : 'No activity logs match your current filters.'}
                  </td>
                </tr>
              ) : (
                paginatedLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap align-top">
                      {log.timestamp}
                    </td>
                    <td className="py-3 px-4 align-top">
                      <p className="font-bold text-slate-900">{log.userName}</p>
                      <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                        {log.userRole}
                      </span>
                    </td>
                    <td className="py-3 px-4 align-top whitespace-nowrap">
                      <span className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-bold ${getModuleBadgeClass(log.module)}`}>
                        {log.module}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800 align-top whitespace-nowrap">
                      {log.action}
                    </td>
                    <td className="py-3 px-4 text-slate-600 align-top max-w-md">
                      <p className="leading-relaxed break-words">{log.details}</p>
                      {log.recordId && (
                        <span className="inline-block mt-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-mono text-[10px] border border-blue-100">
                          Ref: {log.recordId}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50/70 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>
              Showing{' '}
              <strong className="text-slate-900">
                {filteredLogs.length === 0 ? 0 : (safePage - 1) * pageSize + 1}
              </strong>
              –
              <strong className="text-slate-900">
                {Math.min(safePage * pageSize, filteredLogs.length)}
              </strong>{' '}
              of <strong className="text-slate-900">{filteredLogs.length}</strong> actions
            </span>
            <select
              value={pageSize}
              onChange={e => setPageSize(Number(e.target.value))}
              aria-label="Rows per page"
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold"
            >
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={safePage <= 1}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Prev</span>
            </button>
            <span className="px-2 font-mono text-[11px] font-semibold text-slate-700">
              Page {safePage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage >= totalPages}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
