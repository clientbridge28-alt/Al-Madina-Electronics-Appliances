import React, { useState } from 'react';
import { 
  ShieldAlert, Download, Upload, RotateCcw, 
  Search, CheckCircle2, AlertTriangle, Database, Lock, Server 
} from 'lucide-react';
import { 
  getAuditLogs, exportDatabaseJSON, importDatabaseJSON, 
  resetToDefaultData, getSettings 
} from '../../services/storage';
import { AuditLog } from '../../types/erp';

export const AuditBackupView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>(getAuditLogs());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const settings = getSettings();

  const handleDownloadBackup = () => {
    try {
      const dataStr = exportDatabaseJSON();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      link.href = url;
      link.download = `ElectroERP_Backup_${timestamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setStatusMsg({ type: 'success', text: 'Cloud database snapshot downloaded successfully!' });
      setLogs(getAuditLogs());
    } catch (err) {
      setStatusMsg({ type: 'error', text: 'Failed to generate cloud backup.' });
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const ok = importDatabaseJSON(content);
        if (ok) {
          setStatusMsg({ type: 'success', text: 'Database successfully restored from backup snapshot!' });
          setLogs(getAuditLogs());
          setTimeout(() => window.location.reload(), 1200);
        } else {
          setStatusMsg({ type: 'error', text: 'Invalid ERP backup file structure.' });
        }
      } catch (err) {
        setStatusMsg({ type: 'error', text: 'Error reading JSON backup file.' });
      }
    };
    reader.readAsText(file);
  };

  const handleResetData = () => {
    if (confirm('Are you sure you want to restore default Pakistani showroom demonstration seed data? All recent changes will be replaced with fresh realistic showroom data.')) {
      resetToDefaultData();
      setStatusMsg({ type: 'success', text: 'Database reset to clean Pakistani electronics showroom template.' });
      setLogs(getAuditLogs());
      setTimeout(() => window.location.reload(), 1000);
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
      {/* Header */}
      <div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight">
          Enterprise Security, Audit Trail & Cloud Vault
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Immutable system transaction logs, ransomware protection, JSON database snapshots & disaster recovery
        </p>
      </div>

      {/* Alert Message */}
      {statusMsg && (
        <div className={`p-4 rounded-2xl flex items-center gap-3 text-xs font-bold ${
          statusMsg.type === 'success' 
            ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' 
            : 'bg-rose-50 text-rose-900 border border-rose-200'
        }`}>
          {statusMsg.type === 'success' ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" /> : <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Enterprise Backup Architecture Card (Matching Screenshot_2026-11-06_195605_6247a208.png) */}
      <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 p-6 text-white shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-700/60 pb-5">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-blue-600/30 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <Database className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide uppercase">
                Enterprise Cloud Vault & Backup
              </h3>
              <p className="text-xs text-slate-400">Encrypted immutable storage against data loss and corruption</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadBackup}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-600/30 transition active:scale-98"
            >
              <Download className="h-4 w-4" />
              <span>Export Database Snapshot (JSON)</span>
            </button>

            <label className="flex items-center gap-1.5 rounded-xl border border-slate-600 bg-slate-800 hover:bg-slate-700 px-4 py-2.5 text-xs font-bold text-slate-200 cursor-pointer transition">
              <Upload className="h-4 w-4 text-slate-400" />
              <span>Restore from File</span>
              <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
            </label>

            <button
              onClick={handleResetData}
              title="Reset to clean showroom template"
              className="p-2.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Cloud Architecture Pillars */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-1">
            <span className="font-bold text-blue-400 uppercase tracking-wider text-[10px] block">Application Storage</span>
            <p className="text-slate-300 font-medium">Cloud Firestore / Persistent Local Engine</p>
            <p className="text-[11px] text-slate-500">All customer ledgers, invoices & inventory indexed</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-1">
            <span className="font-bold text-emerald-400 uppercase tracking-wider text-[10px] block">Data Integrity</span>
            <p className="text-slate-300 font-medium">Double-Entry Transactional Locking</p>
            <p className="text-[11px] text-slate-500">Every stock movement is mathematically balanced</p>
          </div>
          <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 space-y-1">
            <span className="font-bold text-purple-400 uppercase tracking-wider text-[10px] block">Audit Compliance</span>
            <p className="text-slate-300 font-medium">Append-Only Audit Logs</p>
            <p className="text-[11px] text-slate-500">{logs.length} Logged events with user, timestamp & action</p>
          </div>
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
