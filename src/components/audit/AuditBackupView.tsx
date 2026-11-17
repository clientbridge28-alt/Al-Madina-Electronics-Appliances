import React, { useState, useEffect } from 'react';
import {
  Download, Search, CheckCircle2, AlertTriangle, Database,
  FileSpreadsheet, Globe, ShieldCheck
} from 'lucide-react';
import {
  getAuditLogs, exportDatabaseJSON, getDatabaseSnapshot,
  getBackupRecords, addBackupRecord, logAuditAction, subscribeToDatabase
} from '../../services/storage';
import {
  computeSha256Hex,
  exportCollectionToCSV,
  exportFullWorkbookBackup,
} from '../../services/excelService';
import { pushBackupToWordPress } from '../../services/wordpressService';
import { ORG_ID, type BackupRecord } from '../../types/rbac';
import { useAuth } from '../../context/AuthContext';

export const AuditBackupView: React.FC = () => {
  const { staffUser, isOwner } = useAuth();
  const [, setDbTick] = useState(0);
  useEffect(() => subscribeToDatabase(() => setDbTick(t => t + 1)), []);

  const logs = getAuditLogs();
  const backups = getBackupRecords();

  const [searchQuery, setSearchQuery] = useState('');
  const [scheduleType, setScheduleType] = useState<BackupRecord['type']>('Manual');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFullExcelBackup = async () => {
    setBusy(true);
    try {
      const snapshot = getDatabaseSnapshot();
      const result = await exportFullWorkbookBackup(snapshot, 'AlMadina_ERP_FullBackup');
      const rec: BackupRecord = {
        id: `BKP-XLSX-${Date.now()}`,
        orgId: ORG_ID,
        type: scheduleType,
        format: 'XLSX',
        recordCount: result.recordCount,
        checksum: result.checksum,
        status: 'Success',
        createdAt: new Date().toISOString(),
        createdBy: staffUser?.email || staffUser?.name || 'Owner',
        notes: `${scheduleType} multi-sheet workbook (${result.fileName})`,
      };
      addBackupRecord(rec);
      logAuditAction('Backup', 'Full Excel Workbook Export', `Exported ${result.recordCount} records (${result.fileName}), SHA-256: ${result.checksum.slice(0, 12)}...`);
      setStatusMsg({
        type: 'success',
        text: `Full multi-sheet Excel backup exported (${result.recordCount} records, SHA-256: ${result.checksum.slice(0, 16)}...).`,
      });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err?.message || 'Excel backup export failed.' });
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadJsonSnapshot = async () => {
    try {
      const dataStr = exportDatabaseJSON();
      const checksum = await computeSha256Hex(dataStr);
      const snapshot = getDatabaseSnapshot();
      const recordCount = Object.values(snapshot).reduce<number>(
        (s, v) => s + (Array.isArray(v) ? v.length : 0),
        0
      );
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      link.href = url;
      link.download = `AlMadina_ERP_Backup_${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addBackupRecord({
        id: `BKP-JSON-${Date.now()}`,
        orgId: ORG_ID,
        type: scheduleType,
        format: 'JSON',
        recordCount,
        checksum,
        status: 'Success',
        createdAt: new Date().toISOString(),
        createdBy: staffUser?.email || staffUser?.name || 'Owner',
        notes: `${scheduleType} JSON snapshot`,
      });
      logAuditAction('Backup', 'JSON Snapshot Export', `Exported JSON snapshot (${recordCount} records)`);
      setStatusMsg({ type: 'success', text: `JSON snapshot exported (${recordCount} records, SHA-256: ${checksum.slice(0, 16)}...).` });
    } catch {
      setStatusMsg({ type: 'error', text: 'Failed to generate JSON snapshot.' });
    }
  };

  const handleCsvArchive = () => {
    const snap = getDatabaseSnapshot();
    exportCollectionToCSV(snap.sales || [], 'Archive_Sales');
    exportCollectionToCSV(snap.products || [], 'Archive_Inventory');
    exportCollectionToCSV(snap.vouchers || [], 'Archive_Vouchers');
    setStatusMsg({ type: 'success', text: 'CSV archives exported for Sales, Inventory, and Vouchers.' });
  };

  const handleWordPressSecondaryBackup = async () => {
    setBusy(true);
    try {
      const snapshot = getDatabaseSnapshot();
      const checksum = await computeSha256Hex(JSON.stringify(snapshot));
      const recordCount = Object.values(snapshot).reduce<number>(
        (s, v) => s + (Array.isArray(v) ? v.length : 0),
        0
      );
      const backupId = `BKP-WP-${Date.now()}`;
      const res = await pushBackupToWordPress({
        backupId,
        checksum,
        recordCount,
        summary: {
          showroomName: snapshot.settings?.showroomName,
          customers: snapshot.customers?.length || 0,
          products: snapshot.products?.length || 0,
          sales: snapshot.sales?.length || 0,
          installments: snapshot.installments?.length || 0,
          vouchers: snapshot.vouchers?.length || 0,
        },
      });
      addBackupRecord({
        id: backupId,
        orgId: ORG_ID,
        type: scheduleType,
        format: 'WordPressMirror',
        recordCount,
        checksum,
        wpStatus: res.success ? 'Archived' : 'Failed',
        wpRef: res.wpRef,
        status: res.success ? 'Success' : 'Failed',
        createdAt: new Date().toISOString(),
        createdBy: staffUser?.email || 'Owner',
        notes: res.message || (res.success ? `Mirrored to WordPress (${res.wpRef})` : 'WordPress mirror failed'),
      });
      if (res.success) {
        setStatusMsg({ type: 'success', text: `Secondary backup mirrored to WordPress (${res.wpRef}).` });
      } else {
        setStatusMsg({ type: 'error', text: `WordPress backup failed: ${res.message || 'Configure WP_SITE_URL and WP credentials in Settings / Server Env.'}` });
      }
    } finally {
      setBusy(false);
    }
  };

  const filteredLogs = logs.filter(l =>
    l.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.module.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    l.details.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight">
          Enterprise Security, Audit Trail & Cloud Vault
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Multi-sheet Excel backups (.xlsx), CSV archives, SHA-256 verification, WordPress mirror & immutable audit trail
        </p>
      </div>

      {statusMsg && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-bold ${
          statusMsg.type === 'success'
            ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
            : statusMsg.type === 'error'
            ? 'bg-rose-50 text-rose-900 border border-rose-200'
            : 'bg-blue-50 text-blue-900 border border-blue-200'
        }`}>
          {statusMsg.type === 'success' ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" /> : <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Enterprise Backup Vault */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-6 text-white shadow-xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-700/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-blue-600/30 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide uppercase">
                Enterprise Cloud Vault & Backup
              </h3>
              <p className="text-xs text-slate-400">SHA-256 integrity-verified exports across all showroom ledgers</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={scheduleType}
              onChange={e => setScheduleType(e.target.value as any)}
              className="rounded-xl border border-slate-600 bg-slate-800 px-3 py-2 text-xs font-semibold text-white"
            >
              <option value="Manual">Manual Backup</option>
              <option value="ScheduledDaily">Daily Schedule Tag</option>
              <option value="ScheduledWeekly">Weekly Schedule Tag</option>
              <option value="ScheduledMonthly">Monthly Schedule Tag</option>
            </select>

            <button
              disabled={busy}
              onClick={handleFullExcelBackup}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-4 py-2.5 text-xs font-bold text-white shadow-md transition disabled:opacity-50"
            >
              <FileSpreadsheet className="h-4 w-4" />
              <span>Full Excel Workbook (.xlsx)</span>
            </button>

            <button
              disabled={busy}
              onClick={handleDownloadJsonSnapshot}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs font-bold text-white transition disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              <span>JSON Snapshot</span>
            </button>

            <button
              onClick={handleCsvArchive}
              className="flex items-center gap-1.5 rounded-xl border border-slate-600 bg-slate-800 hover:bg-slate-700 px-3.5 py-2.5 text-xs font-bold text-slate-200 transition"
            >
              <span>CSV Archive</span>
            </button>

            <button
              disabled={busy}
              onClick={handleWordPressSecondaryBackup}
              className="flex items-center gap-1.5 rounded-xl border border-purple-500/50 bg-purple-900/40 hover:bg-purple-800/60 px-3.5 py-2.5 text-xs font-bold text-purple-200 transition disabled:opacity-50"
            >
              <Globe className="h-4 w-4" />
              <span>Mirror to WordPress</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-1">
            <span className="font-bold text-blue-400 uppercase tracking-wider text-[10px] block">Cloud Persistence</span>
            <p className="text-slate-300 font-medium">Google Cloud Firestore Database</p>
            <p className="text-[11px] text-slate-500">All customer ledgers, invoices & inventory synchronized</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-1">
            <span className="font-bold text-emerald-400 uppercase tracking-wider text-[10px] block">Disaster Recovery</span>
            <p className="text-slate-300 font-medium">
              {isOwner ? 'Available in Owner Super Admin -> Disaster Recovery' : 'Restricted to Showroom Owner'}
            </p>
            <p className="text-[11px] text-slate-500">Requires Owner re-authentication & SHA-256 verification</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-1">
            <span className="font-bold text-purple-400 uppercase tracking-wider text-[10px] block">Backup Ledger</span>
            <p className="text-slate-300 font-medium">{backups.length} Recorded Snapshots</p>
            <p className="text-[11px] text-slate-500">{logs.length} Immutable Audit Trail entries</p>
          </div>
        </div>
      </div>

      {/* Backup History Table */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900">Backup Integrity History</h3>
          </div>
          <span className="text-xs text-slate-400">{backups.length} backups logged</span>
        </div>
        <div className="overflow-x-auto max-h-64">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Type & Format</th>
                <th className="p-3 text-center">Records</th>
                <th className="p-3 font-mono">SHA-256 Checksum</th>
                <th className="p-3">Status</th>
                <th className="p-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {backups.map(b => (
                <tr key={b.id} className="hover:bg-slate-50/70">
                  <td className="p-3 font-mono text-[11px] text-slate-500">{b.createdAt?.slice(0, 19).replace('T', ' ')}</td>
                  <td className="p-3 font-semibold text-slate-900">{b.type} ({b.format})</td>
                  <td className="p-3 text-center font-mono">{b.recordCount}</td>
                  <td className="p-3 font-mono text-[11px] text-slate-600">{b.checksum?.slice(0, 18)}...</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                      b.status === 'Failed' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                    }`}>{b.status}</span>
                  </td>
                  <td className="p-3 text-slate-600">{b.notes}</td>
                </tr>
              ))}
              {backups.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-slate-400">No backup exports recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Trail Log Table */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search audit trail by action or user..."
              className="w-full rounded-xl border border-slate-200 pl-10 pr-3.5 py-1.5 text-xs focus:outline-none focus:border-blue-600"
            />
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Showing {filteredLogs.length} activity records
          </span>
        </div>

        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px] sticky top-0">
              <tr>
                <th className="py-3 px-4 font-mono">Timestamp</th>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Module</th>
                <th className="py-3 px-4">Action</th>
                <th className="py-3 px-4">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-slate-50/60 transition text-slate-700">
                  <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap">{log.timestamp}</td>
                  <td className="py-3 px-4 font-sans font-bold text-slate-900 whitespace-nowrap">{log.userName}</td>
                  <td className="py-3 px-4 font-sans whitespace-nowrap">
                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {log.userRole}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-sans font-semibold text-slate-800 whitespace-nowrap">{log.module}</td>
                  <td className="py-3 px-4 font-sans font-semibold text-emerald-800 whitespace-nowrap">{log.action}</td>
                  <td className="py-3 px-4 font-sans text-slate-600 text-[11px] truncate max-w-md">{log.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
