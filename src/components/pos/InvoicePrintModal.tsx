import React, { useState, useEffect } from 'react';
import { Printer, X } from 'lucide-react';
import { SalesInvoice, ShowroomSettings } from '../../types/erp';
import { getSettings, subscribeToDatabase } from '../../services/storage';
import { POSReceiptPrintLayout } from './POSReceiptPrintLayout';

interface InvoicePrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: SalesInvoice | null;
}

export const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({
  isOpen,
  onClose,
  invoice
}) => {
  const [settings, setSettings] = useState<ShowroomSettings>(getSettings());
  const [printFormat, setPrintFormat] = useState<'A4' | 'Thermal'>(settings.printFormat || 'A4');

  useEffect(() => {
    const unsub = subscribeToDatabase(() => {
      setSettings(getSettings());
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (isOpen) {
      const live = getSettings();
      setSettings(live);
      setPrintFormat(live.printFormat || 'A4');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs no-print" onClick={onClose} />

      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative w-full max-w-3xl rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10 overflow-hidden transform transition-all"
          onClick={e => e.stopPropagation()}
        >
          {/* Top Control Bar (Hidden when printing) */}
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/80 no-print">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-slate-800">Print Sales Invoice</span>
              <div className="flex items-center bg-slate-200/60 p-0.5 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setPrintFormat('A4')}
                  className={`px-3 py-1 rounded-md font-medium transition ${
                    printFormat === 'A4' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Standard A4 Invoice
                </button>
                <button
                  type="button"
                  onClick={() => setPrintFormat('Thermal')}
                  className={`px-3 py-1 rounded-md font-medium transition ${
                    printFormat === 'Thermal' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  POS Thermal Receipt
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrint}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition active:scale-98"
              >
                <Printer className="h-4 w-4" />
                <span>Print Document</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Printable Invoice Container */}
          <div className="p-8 max-h-[80vh] overflow-y-auto printable-area bg-white">
            <POSReceiptPrintLayout
              invoice={invoice}
              settings={settings}
              format={printFormat}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
