import React, { useState } from 'react';
import { 
  Settings, Save, Store, Phone, FileText, CheckCircle2, 
  Globe, Database, RefreshCw, AlertCircle, Sparkles, 
  Trash2, ShieldCheck, Check, Key, Link2, ExternalLink
} from 'lucide-react';
import { 
  getSettings, saveSettings, isDemoMode, 
  setDemoMode, seedDemoData, clearToProductionEmpty 
} from '../../services/storage';
import { ShowroomSettings } from '../../types/erp';
import { 
  getWordPressSettings, saveWordPressSettings, 
  testWordPressConnection, getSyncLogs, WordPressSettings 
} from '../../services/wordpressService';

export const SettingsView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'General' | 'WooCommerce' | 'Database'>('General');
  const [settings, setSettingsState] = useState<ShowroomSettings>(getSettings());
  const [wpSettings, setWpSettings] = useState<WordPressSettings>(getWordPressSettings());
  
  // Statuses
  const [isSaved, setIsSaved] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; version?: string } | null>(null);
  const [syncLogs, setSyncLogs] = useState(getSyncLogs());
  const [demoState, setDemoState] = useState(isDemoMode());
  const [confirmClearModal, setConfirmClearModal] = useState(false);

  const handleSaveShowroom = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings(settings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleSaveWooCommerce = (e: React.FormEvent) => {
    e.preventDefault();
    saveWordPressSettings(wpSettings);
    setSyncLogs(getSyncLogs());
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2500);
  };

  const handleTestWooConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const res = await testWordPressConnection(wpSettings.siteUrl, wpSettings.consumerKey, wpSettings.consumerSecret);
      setTestResult(res);
      setSyncLogs(getSyncLogs());
    } catch (err: any) {
      setTestResult({ success: false, message: err.message });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleToggleDemoMode = (enabled: boolean) => {
    setDemoMode(enabled);
    setDemoState(enabled);
    window.location.reload();
  };

  const handleResetToProduction = () => {
    clearToProductionEmpty();
    setConfirmClearModal(false);
    window.location.reload();
  };

  const update = (field: keyof ShowroomSettings, val: any) => {
    setSettingsState(prev => ({ ...prev, [field]: val }));
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            ERP System & Integrations Hub
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Showroom identity, WooCommerce live sync, database environment & security
          </p>
        </div>

        {/* Tab Controls */}
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
            <span>Production vs Demo</span>
          </button>
        </div>
      </div>

      {isSaved && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <span>Configuration saved and active in showroom ERP!</span>
        </div>
      )}

      {/* TAB 1: GENERAL SHOWROOM SETTINGS */}
      {activeTab === 'General' && (
        <form onSubmit={handleSaveShowroom} className="space-y-6 text-xs">
          {/* Commercial Identity */}
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
                <input
                  type="text"
                  value={settings.phone}
                  onChange={e => update('phone', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">WhatsApp Customer Service</label>
                <input
                  type="text"
                  value={settings.whatsapp}
                  onChange={e => update('whatsapp', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Official Email</label>
                <input
                  type="email"
                  value={settings.email}
                  onChange={e => update('email', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-slate-700 font-semibold mb-1">Physical Address</label>
                <input
                  type="text"
                  value={settings.address}
                  onChange={e => update('address', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">City, Country</label>
                <input
                  type="text"
                  value={settings.city}
                  onChange={e => update('city', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">NTN Tax Number</label>
                <input
                  type="text"
                  value={settings.ntn}
                  onChange={e => update('ntn', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block text-slate-700 font-semibold mb-1">STRN Sales Tax Number</label>
                <input
                  type="text"
                  value={settings.strn}
                  onChange={e => update('strn', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-xs"
                />
              </div>
            </div>
          </div>

          {/* Invoice & Financial Defaults */}
          <div className="rounded-2xl bg-white p-6 border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-2">
              2. Invoicing, Print & Financial Settings
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Sales Invoice Prefix</label>
                <input
                  type="text"
                  value={settings.invoicePrefix}
                  onChange={e => update('invoicePrefix', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Purchase Prefix</label>
                <input
                  type="text"
                  value={settings.purchasePrefix}
                  onChange={e => update('purchasePrefix', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Installment Receipt Prefix</label>
                <input
                  type="text"
                  value={settings.receiptPrefix}
                  onChange={e => update('receiptPrefix', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Default Installment Markup (%)</label>
                <input
                  type="number"
                  min={0}
                  value={settings.defaultMarkupRate}
                  onChange={e => update('defaultMarkupRate', Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Default Print Layout</label>
                <select
                  value={settings.printFormat}
                  onChange={e => update('printFormat', e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-semibold"
                >
                  <option value="A4">A4 Full Page Invoice</option>
                  <option value="Thermal">80mm Thermal POS Slip</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Base Currency</label>
                <input
                  type="text"
                  disabled
                  value={`${settings.currency} (₨)`}
                  className="w-full rounded-xl border border-slate-200 bg-slate-100 p-2.5 text-xs font-mono text-slate-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-700 font-semibold mb-1">Invoice Footer Warranty & Policy Disclaimer</label>
              <textarea
                rows={3}
                value={settings.invoiceFooterNote}
                onChange={e => update('invoiceFooterNote', e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 text-xs shadow-md shadow-blue-500/20 transition active:scale-98"
            >
              <Save className="h-4 w-4" />
              <span>Save Showroom Configuration</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: WORDPRESS & WOOCOMMERCE REST API */}
      {activeTab === 'WooCommerce' && (
        <div className="space-y-6 text-xs">
          <form onSubmit={handleSaveWooCommerce} className="space-y-6">
            <div className="rounded-2xl bg-white p-6 border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
                    <Globe className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      WooCommerce REST API v3 Integration
                    </h3>
                    <p className="text-xs text-slate-500">
                      Sync showroom electronics catalog, prices, stock quantities & web orders
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                    wpSettings.isConnected 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}>
                    {wpSettings.isConnected ? '● Connected' : '○ Not Connected'}
                  </span>
                </div>
              </div>

              {testResult && (
                <div className={`p-4 rounded-xl border text-xs font-semibold flex items-center justify-between ${
                  testResult.success 
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}>
                  <div className="flex items-center gap-2">
                    {testResult.success ? <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" /> : <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />}
                    <span>{testResult.message}</span>
                  </div>
                  {testResult.version && (
                    <span className="font-mono text-[10px] bg-white px-2 py-0.5 rounded border border-emerald-200">
                      WooCommerce v{testResult.version}
                    </span>
                  )}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    WordPress / WooCommerce Store URL *
                  </label>
                  <div className="relative">
                    <Link2 className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="url"
                      required
                      placeholder="https://myshowroom.com"
                      value={wpSettings.siteUrl}
                      onChange={e => setWpSettings(prev => ({ ...prev, siteUrl: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 pl-10 pr-3 py-2.5 font-mono text-xs focus:outline-none focus:border-purple-600"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Your public online store domain with SSL (e.g., https://electronics-showroom.pk)
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Consumer Key (ck_...) *
                    </label>
                    <div className="relative">
                      <Key className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        required
                        placeholder="ck_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        value={wpSettings.consumerKey}
                        onChange={e => setWpSettings(prev => ({ ...prev, consumerKey: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 pl-10 pr-3 py-2.5 font-mono text-xs focus:outline-none focus:border-purple-600"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1">
                      Consumer Secret (cs_...) *
                    </label>
                    <div className="relative">
                      <Key className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                      <input
                        type="password"
                        required
                        placeholder="cs_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                        value={wpSettings.consumerSecret}
                        onChange={e => setWpSettings(prev => ({ ...prev, consumerSecret: e.target.value }))}
                        className="w-full rounded-xl border border-slate-200 pl-10 pr-3 py-2.5 font-mono text-xs focus:outline-none focus:border-purple-600"
                      />
                    </div>
                  </div>
                </div>

                {/* Sync Policies */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <h4 className="font-bold text-slate-800">Bi-Directional Sync Preferences</h4>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={wpSettings.syncProductsAuto}
                        onChange={e => setWpSettings(prev => ({ ...prev, syncProductsAuto: e.target.checked }))}
                        className="rounded text-purple-600"
                      />
                      <span>Auto-sync product title, pricing and descriptions</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={wpSettings.syncStockAuto}
                        onChange={e => setWpSettings(prev => ({ ...prev, syncStockAuto: e.target.checked }))}
                        className="rounded text-purple-600"
                      />
                      <span>Instant inventory stock deduction on showroom POS billing</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={wpSettings.syncOrdersAuto}
                        onChange={e => setWpSettings(prev => ({ ...prev, syncOrdersAuto: e.target.checked }))}
                        className="rounded text-purple-600"
                      />
                      <span>Pull new web orders into ERP Sales Ledger</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  disabled={testingConnection || !wpSettings.siteUrl}
                  onClick={handleTestWooConnection}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-purple-300 bg-purple-50 hover:bg-purple-100/80 text-purple-800 font-bold transition disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${testingConnection ? 'animate-spin' : ''}`} />
                  <span>{testingConnection ? 'Testing Endpoint...' : 'Test WooCommerce Connection'}</span>
                </button>

                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold px-6 py-2.5 shadow-sm transition active:scale-98"
                >
                  <Save className="h-4 w-4" />
                  <span>Save WooCommerce Credentials</span>
                </button>
              </div>
            </div>
          </form>

          {/* Sync History & Audit Log */}
          <div className="rounded-2xl bg-white p-6 border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Synchronization Activity Log</h3>
              <span className="text-[10px] text-slate-400 font-mono">Last 20 operations</span>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 uppercase text-[10px] text-slate-500 font-bold">
                  <tr>
                    <th className="py-2.5 px-3">Timestamp</th>
                    <th className="py-2.5 px-3">Action</th>
                    <th className="py-2.5 px-3">Entity / ID</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {syncLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400 font-sans">
                        No sync actions recorded yet. Run a connection test or sync catalog from Inventory.
                      </td>
                    </tr>
                  ) : (
                    syncLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/50">
                        <td className="py-2 px-3 text-slate-500">{new Date(log.timestamp).toLocaleTimeString()}</td>
                        <td className="py-2 px-3 font-bold text-slate-800">{log.type}</td>
                        <td className="py-2 px-3 text-blue-700">{log.recordRef || '—'}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.status === 'Success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                          }`}>
                            {log.status}
                          </span>
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

      {/* TAB 3: PRODUCTION VS DEMO MODE & DATABASE CONTROLS */}
      {activeTab === 'Database' && (
        <div className="space-y-6 text-xs">
          <div className="rounded-2xl bg-white p-6 border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Database Environment & Partitioning
                  </h3>
                  <p className="text-xs text-slate-500">
                    Strict separation between Live Production Showroom records and Sample Demo data
                  </p>
                </div>
              </div>

              <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                demoState 
                  ? 'bg-amber-50 text-amber-800 border-amber-200' 
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}>
                {demoState ? 'Demo Test Mode' : 'Live Production Mode'}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Option 1: Live Production Mode */}
              <div className={`p-5 rounded-2xl border transition ${
                !demoState ? 'border-emerald-400 bg-emerald-50/40' : 'border-slate-200 bg-slate-50'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-900 text-sm">Live Production Database</h4>
                  {!demoState && <Check className="h-5 w-5 text-emerald-600" />}
                </div>
                <p className="text-slate-600 text-xs mb-4">
                  Empty by default upon setup. Zero fake statistics, zero hardcoded turnover, and genuine ledger entries only.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    disabled={!demoState}
                    onClick={() => handleToggleDemoMode(false)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition disabled:opacity-50"
                  >
                    Switch to Production
                  </button>
                  <button
                    onClick={() => setConfirmClearModal(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-rose-300 bg-white hover:bg-rose-50 text-rose-700 font-bold transition"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>Clear All to Empty</span>
                  </button>
                </div>
              </div>

              {/* Option 2: Demo Mode */}
              <div className={`p-5 rounded-2xl border transition ${
                demoState ? 'border-amber-400 bg-amber-50/40' : 'border-slate-200 bg-slate-50'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-slate-900 text-sm">Demo / Evaluation Mode</h4>
                  {demoState && <Check className="h-5 w-5 text-amber-600" />}
                </div>
                <p className="text-slate-600 text-xs mb-4">
                  Populates realistic electronics showroom sample models (Dawlance, Haier, Orient, Gree, Samsung) with customers and installments for training.
                </p>
                <button
                  disabled={demoState}
                  onClick={() => { seedDemoData(); handleToggleDemoMode(true); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold transition disabled:opacity-50"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Load Showroom Demo Dataset</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal to Clear Database to Production Empty */}
      {confirmClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 rounded-full bg-rose-100">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Reset to Clean Production State?</h3>
                <p className="text-xs text-slate-500">This will delete all demo/sample transactions and initialize a pristine database.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
              The dashboard will show: <em>"No business data available yet. Create your first transaction."</em> until you enter real invoices and stock.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setConfirmClearModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleResetToProduction}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 font-bold text-white shadow-xs"
              >
                Yes, Empty Database for Production
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
