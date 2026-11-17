import React, { useState, useEffect } from 'react';
import {
  Save, Store, CheckCircle2,
  Globe, Database, RefreshCw, AlertCircle, Sparkles,
  Check, Key, Link2, Lock
} from 'lucide-react';
import {
  getSettings, saveSettings, subscribeToDatabase
} from '../../services/storage';
import { ShowroomSettings } from '../../types/erp';
import {
  fetchWordPressServerStatus,
  configureWordPressServer,
  testWordPressConnection,
  getSyncLogs,
  type WordPressStatus
} from '../../services/wordpressService';
import { useAuth } from '../../context/AuthContext';

export const SettingsView: React.FC = () => {
  const { isOwner, isDemoSession, enterDemoMode, exitDemoMode } = useAuth();
  const [activeTab, setActiveTab] = useState<'General' | 'WooCommerce' | 'Database'>('General');
  const [settings, setSettingsState] = useState<ShowroomSettings>(getSettings());

  // Server-side WordPress configuration state (never persisted in localStorage)
  const [wpStatus, setWpStatus] = useState<WordPressStatus | null>(null);
  const [wpSiteUrl, setWpSiteUrl] = useState('');
  const [wpRestUser, setWpRestUser] = useState('');
  const [wpAppPassword, setWpAppPassword] = useState('');
  const [wpWcKey, setWpWcKey] = useState('');
  const [wpWcSecret, setWpWcSecret] = useState('');
  const [syncProductsAuto, setSyncProductsAuto] = useState(false);
  const [syncStockAuto, setSyncStockAuto] = useState(true);
  const [syncOrdersAuto, setSyncOrdersAuto] = useState(false);

  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; isWooCommerce?: boolean } | null>(null);
  const [syncLogs, setSyncLogs] = useState(getSyncLogs());

  useEffect(() => {
    const unsub = subscribeToDatabase(() => {
      setSettingsState(getSettings());
    });
    return unsub;
  }, []);

  useEffect(() => {
    fetchWordPressServerStatus().then(st => {
      if (st) {
        setWpStatus(st);
        setWpSiteUrl(st.siteUrl || '');
        setSyncProductsAuto(st.syncProductsAuto);
        setSyncStockAuto(st.syncStockAuto);
        setSyncOrdersAuto(st.syncOrdersAuto);
      }
    });
  }, []);

  const handleSaveShowroom = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings(settings);
    setNotice({ type: 'success', text: 'Showroom configuration saved to Cloud Firestore!' });
    setTimeout(() => setNotice(null), 3000);
  };

  const handleSaveWooCommerce = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);
    const res = await configureWordPressServer({
      siteUrl: wpSiteUrl.trim(),
      restUsername: wpRestUser.trim() || undefined,
      appPassword: wpAppPassword.trim() || undefined,
      wcKey: wpWcKey.trim() || undefined,
      wcSecret: wpWcSecret.trim() || undefined,
      syncProductsAuto,
      syncStockAuto,
      syncOrdersAuto,
    });
    if (res.saved) {
      setWpAppPassword('');
      setWpWcKey('');
      setWpWcSecret('');
      const refreshed = await fetchWordPressServerStatus();
      setWpStatus(refreshed);
      setNotice({ type: 'success', text: 'WordPress/WooCommerce credentials stored securely in server memory (never in browser storage).' });
    } else {
      setNotice({ type: 'error', text: res.message || 'Could not save server WordPress configuration.' });
    }
  };

  const handleTestWooConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await testWordPressConnection(wpSiteUrl.trim() || wpStatus?.siteUrl);
      setTestResult(res);
      setSyncLogs(getSyncLogs());
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTestingConnection(false);
    }
  };

  const update = (field: keyof ShowroomSettings, val: any) => {
    setSettingsState(prev => ({ ...prev, [field]: val }));
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            ERP System & Integrations Hub
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Showroom identity, server-side WordPress/WooCommerce proxy & isolated Demo Showcase switch
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold text-slate-600">
          <button
            onClick={() => setActiveTab('General')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition ${
              activeTab === 'General' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            <Store className="h-4 w-4" />
            <span>Showroom & Tax</span>
          </button>

          <button
            onClick={() => setActiveTab('WooCommerce')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition ${
              activeTab === 'WooCommerce' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            <Globe className="h-4 w-4 text-purple-600" />
            <span>WordPress / WooCommerce</span>
          </button>

          <button
            onClick={() => setActiveTab('Database')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg transition ${
              activeTab === 'Database' ? 'bg-white text-slate-900 shadow-2xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            <Database className="h-4 w-4 text-blue-600" />
            <span>Workspace Mode</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className={`p-4 rounded-2xl border text-xs font-bold flex items-center gap-2 ${
          notice.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-rose-50 border-rose-200 text-rose-900'
        }`}>
          {notice.type === 'success' ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" /> : <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      )}

      {activeTab === 'General' && (
        <form onSubmit={handleSaveShowroom} className="space-y-6 text-xs">
          <div className="rounded-2xl bg-white p-6 border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              1. Showroom Business Profile
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Showroom Commercial Name *</label>
                <input
                  type="text"
                  required
                  value={settings.showroomName}
                  onChange={e => update('showroomName', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-semibold focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Proprietor / Owner Name *</label>
                <input
                  type="text"
                  required
                  value={settings.ownerName}
                  onChange={e => update('ownerName', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Official Contact Phone</label>
                <input type="text" value={settings.phone} onChange={e => update('phone', e.target.value)} className="w-full rounded-xl border border-slate-200 p-2.5 text-xs" />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">WhatsApp Customer Service</label>
                <input type="text" value={settings.whatsapp} onChange={e => update('whatsapp', e.target.value)} className="w-full rounded-xl border border-slate-200 p-2.5 text-xs" />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Official Email</label>
                <input type="email" value={settings.email} onChange={e => update('email', e.target.value)} className="w-full rounded-xl border border-slate-200 p-2.5 text-xs" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-semibold mb-1">Physical Address</label>
                <input type="text" value={settings.address} onChange={e => update('address', e.target.value)} className="w-full rounded-xl border border-slate-200 p-2.5 text-xs" />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">City, Country</label>
                <input type="text" value={settings.city} onChange={e => update('city', e.target.value)} className="w-full rounded-xl border border-slate-200 p-2.5 text-xs" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">NTN Tax Number</label>
                <input type="text" value={settings.ntn} onChange={e => update('ntn', e.target.value)} className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-xs" />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">STRN Sales Tax Number</label>
                <input type="text" value={settings.strn} onChange={e => update('strn', e.target.value)} className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-xs" />
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              2. Invoicing, Print & Financial Settings
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Sales Invoice Prefix</label>
                <input type="text" value={settings.invoicePrefix} onChange={e => update('invoicePrefix', e.target.value)} className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-xs" />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Purchase Prefix</label>
                <input type="text" value={settings.purchasePrefix} onChange={e => update('purchasePrefix', e.target.value)} className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-xs" />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Installment Receipt Prefix</label>
                <input type="text" value={settings.receiptPrefix} onChange={e => update('receiptPrefix', e.target.value)} className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-xs" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Default Installment Markup (%)</label>
                <input type="number" min={0} value={settings.defaultMarkupRate} onChange={e => update('defaultMarkupRate', Number(e.target.value))} className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-xs" />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Default Print Layout</label>
                <select value={settings.printFormat} onChange={e => update('printFormat', e.target.value as any)} className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold">
                  <option value="A4">A4 Full Page Invoice</option>
                  <option value="Thermal">80mm Thermal POS Slip</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Base Currency</label>
                <input type="text" disabled value={`${settings.currency} (₨)`} className="w-full rounded-xl border border-slate-200 bg-slate-100 p-2.5 text-xs font-mono text-slate-600" />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Invoice Footer Warranty & Policy Disclaimer</label>
              <textarea rows={3} value={settings.invoiceFooterNote} onChange={e => update('invoiceFooterNote', e.target.value)} className="w-full rounded-xl border border-slate-200 p-2.5 text-xs" />
            </div>
          </div>

          <div className="flex justify-end">
            <button type="submit" className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 text-xs shadow-md transition">
              <Save className="h-4 w-4" />
              <span>Save Showroom Configuration</span>
            </button>
          </div>
        </form>
      )}

      {activeTab === 'WooCommerce' && (
        <div className="space-y-6 text-xs">
          <form onSubmit={handleSaveWooCommerce} className="space-y-6">
            <div className="rounded-2xl bg-white p-6 border border-slate-200 shadow-2xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
                    <Globe className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">WordPress & WooCommerce Server Proxy</h3>
                    <p className="text-xs text-slate-500">
                      Credentials are kept server-side via environment variables or Owner session configuration — never stored in browser storage.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                    wpStatus?.hasWooCredentials ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    WooCommerce: {wpStatus?.hasWooCredentials ? 'Configured' : 'Not Set'}
                  </span>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                    wpStatus?.hasRestCredentials ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    WP Backup Auth: {wpStatus?.hasRestCredentials ? 'Configured' : 'Not Set'}
                  </span>
                </div>
              </div>

              {testResult && (
                <div className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between ${
                  testResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  <span>{testResult.message}</span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">WordPress / WooCommerce Site URL *</label>
                  <div className="relative">
                    <Link2 className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="url"
                      required
                      placeholder="https://myshowroom.com"
                      value={wpSiteUrl}
                      onChange={e => setWpSiteUrl(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 pl-10 pr-3 py-2.5 font-mono text-xs"
                    />
                  </div>
                </div>

                {isOwner ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">WordPress REST Username (for Secondary Backups)</label>
                        <input
                          type="text"
                          placeholder="wp-erp-bot"
                          value={wpRestUser}
                          onChange={e => setWpRestUser(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">WordPress Application Password</label>
                        <input
                          type="password"
                          placeholder="Leave blank to keep existing server env value"
                          value={wpAppPassword}
                          onChange={e => setWpAppPassword(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">WooCommerce Consumer Key</label>
                        <div className="relative">
                          <Key className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                          <input
                            type="password"
                            placeholder="ck_... (sent only to server proxy)"
                            value={wpWcKey}
                            onChange={e => setWpWcKey(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 pl-10 pr-3 py-2.5 font-mono text-xs"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-slate-700 font-semibold mb-1">WooCommerce Consumer Secret</label>
                        <div className="relative">
                          <Key className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                          <input
                            type="password"
                            placeholder="cs_... (sent only to server proxy)"
                            value={wpWcSecret}
                            onChange={e => setWpWcSecret(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 pl-10 pr-3 py-2.5 font-mono text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center gap-2">
                    <Lock className="h-4 w-4 shrink-0" />
                    <span>Only the Showroom Owner can update WordPress/WooCommerce server credentials.</span>
                  </div>
                )}

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={syncProductsAuto} onChange={e => setSyncProductsAuto(e.target.checked)} className="rounded text-purple-600" />
                    <span>Auto-sync product pricing</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={syncStockAuto} onChange={e => setSyncStockAuto(e.target.checked)} className="rounded text-purple-600" />
                    <span>Sync showroom stock updates</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={syncOrdersAuto} onChange={e => setSyncOrdersAuto(e.target.checked)} className="rounded text-purple-600" />
                    <span>Sync web orders</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  disabled={testingConnection}
                  onClick={handleTestWooConnection}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-purple-300 bg-purple-50 hover:bg-purple-100/80 text-purple-800 font-bold disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${testingConnection ? 'animate-spin' : ''}`} />
                  <span>{testingConnection ? 'Testing via Server...' : 'Test Server Connection'}</span>
                </button>

                {isOwner && (
                  <button type="submit" className="flex items-center gap-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold px-6 py-2.5 shadow-sm">
                    <Save className="h-4 w-4" />
                    <span>Apply Server Configuration</span>
                  </button>
                )}
              </div>
            </div>
          </form>

          <div className="rounded-2xl bg-white p-6 border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">Synchronization Activity Log</h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 uppercase text-[10px] text-slate-500 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Ref</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {syncLogs.length === 0 ? (
                    <tr><td colSpan={5} className="py-6 text-center text-slate-400 font-sans">No sync actions recorded yet.</td></tr>
                  ) : (
                    syncLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 text-slate-500">{log.timestamp}</td>
                        <td className="py-2 px-3 font-bold text-slate-800">{log.type}</td>
                        <td className="py-2 px-3 text-blue-700">{log.recordRef || '—'}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.status === 'Success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>{log.status}</span>
                        </td>
                        <td className="py-2 px-3 font-sans text-slate-600 truncate max-w-xs">{log.details}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Database' && (
        <div className="rounded-2xl bg-white p-6 border border-slate-200 shadow-2xs space-y-4 text-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Strict Cloud vs Demo Partitioning</h3>
              <p className="text-xs text-slate-500">Live Firestore production data is strictly isolated from the Read-Only Client Demo Showcase.</p>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
              isDemoSession ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}>
              {isDemoSession ? 'Isolated Demo Showcase' : 'Live Cloud Firestore'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`p-5 rounded-2xl border ${!isDemoSession ? 'border-emerald-400 bg-emerald-50/40' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-slate-900 text-sm">Live Cloud Firestore ERP</h4>
                {!isDemoSession && <Check className="h-5 w-5 text-emerald-600" />}
              </div>
              <p className="text-slate-600 mb-4">Connected to your authenticated Firebase workspace. Real transactions, zero fake data.</p>
              <button
                disabled={!isDemoSession}
                onClick={() => exitDemoMode()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50"
              >
                Exit Demo & Return to Live Cloud Login
              </button>
            </div>

            <div className={`p-5 rounded-2xl border ${isDemoSession ? 'border-amber-400 bg-amber-50/40' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-slate-900 text-sm">Isolated Client Demo Showcase</h4>
                {isDemoSession && <Check className="h-5 w-5 text-amber-600" />}
              </div>
              <p className="text-slate-600 mb-4">Loads sample showroom data in local sandbox memory for client demonstrations without affecting Firestore.</p>
              <button
                disabled={isDemoSession}
                onClick={() => enterDemoMode()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                <span>Switch to Client Demo Showcase</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
