import React, { useState } from 'react';
import { Settings, Save, Store, Phone, FileText, CheckCircle2 } from 'lucide-react';
import { getSettings, saveSettings } from '../../services/storage';
import { ShowroomSettings } from '../../types/erp';

export const SettingsView: React.FC = () => {
  const [settings, setSettingsState] = useState<ShowroomSettings>(getSettings());
  const [isSaved, setIsSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings(settings);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const update = (field: keyof ShowroomSettings, val: any) => {
    setSettingsState(prev => ({ ...prev, [field]: val }));
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-black text-slate-900 tracking-tight">
          Showroom & System Configuration
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Commercial showroom details, NTN tax certificates, invoice formatting & print templates
        </p>
      </div>

      {isSaved && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <span>Showroom preferences saved successfully!</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 text-xs">
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
    </div>
  );
};
