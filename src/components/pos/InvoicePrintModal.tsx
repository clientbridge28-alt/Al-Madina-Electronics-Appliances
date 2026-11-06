import React, { useState } from 'react';
import { Printer, Download, X, Tv, CheckCircle2 } from 'lucide-react';
import { SalesInvoice, ShowroomSettings } from '../../types/erp';
import { getSettings } from '../../services/storage';

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
  const [settings] = useState<ShowroomSettings>(getSettings());
  const [printFormat, setPrintFormat] = useState<'A4' | 'Thermal'>('A4');

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
                  onClick={() => setPrintFormat('A4')}
                  className={`px-3 py-1 rounded-md font-medium transition ${
                    printFormat === 'A4' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Standard A4 Invoice
                </button>
                <button
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
                onClick={handlePrint}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition active:scale-98"
              >
                <Printer className="h-4 w-4" />
                <span>Print Document</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Printable Invoice Container */}
          <div className="p-8 max-h-[80vh] overflow-y-auto printable-area bg-white">
            {printFormat === 'A4' ? (
              /* A4 INVOICE TEMPLATE (Gadget Technologies / ERPNext Style) */
              <div className="space-y-6 text-slate-800 font-sans">
                {/* Header */}
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-700 text-white shadow-md">
                      <Tv className="h-8 w-8" />
                    </div>
                    <div>
                      <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">
                        {settings.showroomName}
                      </h1>
                      <p className="text-xs text-slate-600 font-medium">{settings.address}, {settings.city}</p>
                      <p className="text-xs text-slate-500">Phone: {settings.phone} • WhatsApp: {settings.whatsapp}</p>
                      <p className="text-[11px] text-slate-400 font-mono">NTN: {settings.ntn} • STRN: {settings.strn}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="inline-block px-3 py-1 bg-blue-50 text-blue-800 font-black text-sm tracking-widest uppercase rounded border border-blue-200">
                      SALES INVOICE
                    </span>
                    <p className="text-sm font-bold text-slate-800 mt-2 font-mono">{invoice.invoiceNumber}</p>
                    <p className="text-xs text-slate-500">Date: {invoice.date}</p>
                    <p className="text-xs font-semibold text-blue-600 mt-0.5">Type: {invoice.saleType} Sale</p>
                  </div>
                </div>

                {/* Customer Details & Billing Info */}
                <div className="grid grid-cols-2 gap-4 rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs">
                  <div>
                    <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px] mb-1">Customer Details</p>
                    <p className="text-sm font-bold text-slate-900">{invoice.customerName}</p>
                    <p className="text-slate-600">Contact: {invoice.customerPhone || 'Walk-in Customer'}</p>
                    <p className="text-slate-500">Sales Person: {invoice.salesPerson}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px] mb-1">Payment Method</p>
                    <p className="text-sm font-bold text-emerald-700">{invoice.paymentMethod}</p>
                    <p className="text-slate-600">Status: {invoice.status}</p>
                    {invoice.installmentAccountId && (
                      <p className="text-blue-600 font-semibold">Installment Plan #{invoice.installmentAccountId}</p>
                    )}
                  </div>
                </div>

                {/* Items Table */}
                <table className="w-full text-left text-xs border border-slate-200 rounded-xl overflow-hidden">
                  <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 w-10 text-center">Sr</th>
                      <th className="py-2.5 px-3">Item Description</th>
                      <th className="py-2.5 px-3">Brand / Model</th>
                      <th className="py-2.5 px-3">Serial / IMEI</th>
                      <th className="py-2.5 px-3 text-center w-14">Qty</th>
                      <th className="py-2.5 px-3 text-right">Rate (₨)</th>
                      <th className="py-2.5 px-3 text-right">Amount (₨)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {invoice.items.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                        <td className="py-3 px-3 font-semibold text-slate-900">{item.productName}</td>
                        <td className="py-3 px-3 text-slate-600">{item.brand} ({item.modelNumber})</td>
                        <td className="py-3 px-3 font-mono text-[11px] text-blue-700 font-medium">
                          {item.selectedSerial || '—'}
                        </td>
                        <td className="py-3 px-3 text-center font-bold">{item.quantity}</td>
                        <td className="py-3 px-3 text-right font-mono">{item.unitPrice.toLocaleString()}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">{item.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals & Financial Breakdown */}
                <div className="flex justify-between items-start pt-2">
                  <div className="w-1/2 text-xs text-slate-500 space-y-1">
                    <p className="font-bold text-slate-700">Terms & Company Warranty:</p>
                    <p className="text-[11px] leading-relaxed">
                      1. Brand new electronics carry official manufacturer warranty. Retain this invoice for claims.<br/>
                      2. Physical damage, electric fluctuation, or liquid ingress is not covered.<br/>
                      3. All accounts settled are subject to audit verification.
                    </p>
                  </div>

                  <div className="w-64 space-y-2 text-xs font-mono">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500 font-sans">Subtotal:</span>
                      <span className="font-semibold">₨ {invoice.subTotal.toLocaleString()}</span>
                    </div>
                    {invoice.discount > 0 && (
                      <div className="flex justify-between py-1 border-b border-slate-100 text-rose-600">
                        <span className="font-sans">Discount:</span>
                        <span>- ₨ {invoice.discount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-1.5 border-b-2 border-slate-900 text-sm font-bold text-slate-900">
                      <span className="font-sans">Grand Total:</span>
                      <span>₨ {invoice.grandTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-1 text-emerald-700 font-semibold">
                      <span className="font-sans">Amount Paid:</span>
                      <span>₨ {invoice.paidAmount.toLocaleString()}</span>
                    </div>
                    {invoice.remainingBalance > 0 && (
                      <div className="flex justify-between py-1 text-rose-700 font-bold border-t border-slate-200">
                        <span className="font-sans">Balance Due:</span>
                        <span>₨ {invoice.remainingBalance.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Signatures */}
                <div className="grid grid-cols-2 gap-12 pt-12 border-t border-slate-200 text-xs text-slate-600">
                  <div className="border-t border-slate-400 pt-2 text-center">
                    <p className="font-semibold">Customer Signature</p>
                  </div>
                  <div className="border-t border-slate-400 pt-2 text-center">
                    <p className="font-semibold">For {settings.showroomName}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">(Authorized Signatory & Stamp)</p>
                  </div>
                </div>

                {/* Footer Note */}
                <p className="text-center text-[11px] text-slate-400 italic pt-4">
                  {settings.invoiceFooterNote}
                </p>
              </div>
            ) : (
              /* THERMAL RECEIPT TEMPLATE (80mm POS Slip) */
              <div className="max-w-xs mx-auto text-xs font-mono space-y-3 p-4 bg-slate-50 border border-slate-300 rounded-xl">
                <div className="text-center border-b border-dashed border-slate-400 pb-3">
                  <h2 className="font-bold text-sm uppercase">{settings.showroomName}</h2>
                  <p className="text-[10px]">{settings.address}</p>
                  <p className="text-[10px]">Tel: {settings.phone}</p>
                  <p className="text-[10px] font-bold mt-1">CASH SALE RECEIPT</p>
                </div>

                <div className="text-[11px] space-y-0.5 border-b border-dashed border-slate-400 pb-2">
                  <div className="flex justify-between">
                    <span>Inv #: {invoice.invoiceNumber}</span>
                    <span>{invoice.date}</span>
                  </div>
                  <p>Customer: {invoice.customerName}</p>
                  <p>Sales: {invoice.salesPerson}</p>
                </div>

                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-300 font-bold">
                      <th>Item</th>
                      <th className="text-center">Qty</th>
                      <th className="text-right">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.items.map((i, idx) => (
                      <tr key={idx}>
                        <td className="py-1">
                          {i.productName}
                          {i.selectedSerial && <div className="text-[9px] text-slate-500">SN: {i.selectedSerial}</div>}
                        </td>
                        <td className="text-center py-1">{i.quantity}</td>
                        <td className="text-right py-1">₨ {i.total.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="border-t border-dashed border-slate-400 pt-2 space-y-1">
                  <div className="flex justify-between font-bold text-sm">
                    <span>TOTAL:</span>
                    <span>₨ {invoice.grandTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>PAID ({invoice.paymentMethod}):</span>
                    <span>₨ {invoice.paidAmount.toLocaleString()}</span>
                  </div>
                  {invoice.remainingBalance > 0 && (
                    <div className="flex justify-between text-rose-600 font-bold">
                      <span>BALANCE:</span>
                      <span>₨ {invoice.remainingBalance.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                <div className="text-center border-t border-dashed border-slate-400 pt-3 text-[10px] text-slate-500">
                  <p>Thank you for your visit!</p>
                  <p>Official Warranty as per manufacturer terms.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
