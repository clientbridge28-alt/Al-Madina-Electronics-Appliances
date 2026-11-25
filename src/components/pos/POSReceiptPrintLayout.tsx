import React from 'react';
import { Tv } from 'lucide-react';
import { SalesInvoice, ShowroomSettings } from '../../types/erp';

interface POSReceiptPrintLayoutProps {
  invoice: SalesInvoice;
  settings: ShowroomSettings;
  format?: 'A4' | 'Thermal';
  copyLabel?: string;
}

export const POSReceiptPrintLayout: React.FC<POSReceiptPrintLayoutProps> = ({
  invoice,
  settings,
  format,
  copyLabel = 'Customer Copy',
}) => {
  const activeFormat: 'A4' | 'Thermal' = format || settings.printFormat || 'A4';
  const currency = settings.currencySymbol || '₨';
  const hasTax = (invoice.tax || 0) > 0;
  const hasChange = (invoice.changeAmount || 0) > 0;

  if (activeFormat === 'Thermal') {
    return (
      <div className="thermal-receipt-sheet max-w-xs mx-auto text-xs font-mono space-y-3 p-4 bg-white text-slate-900 border border-slate-300 rounded-xl print:border-0 print:rounded-none">
        {/* Showroom Header */}
        <div className="text-center border-b border-dashed border-slate-400 pb-3 space-y-0.5">
          <h2 className="font-black text-sm uppercase tracking-tight">{settings.showroomName}</h2>
          <p className="text-[10px] text-slate-700">{settings.address}{settings.city ? `, ${settings.city}` : ''}</p>
          <p className="text-[10px] text-slate-700">
            Tel: {settings.phone}{settings.whatsapp ? ` • WA: ${settings.whatsapp}` : ''}
          </p>
          {(settings.ntn || settings.strn) && (
            <p className="text-[9px] text-slate-500">
              {settings.ntn ? `NTN: ${settings.ntn}` : ''}
              {settings.ntn && settings.strn ? ' • ' : ''}
              {settings.strn ? `STRN: ${settings.strn}` : ''}
            </p>
          )}
          <div className="pt-1">
            <span className="inline-block px-2 py-0.5 border border-slate-800 text-[10px] font-bold uppercase tracking-wider">
              {invoice.saleType.toUpperCase()} SALE RECEIPT
            </span>
          </div>
        </div>

        {/* Receipt Metadata */}
        <div className="text-[11px] space-y-0.5 border-b border-dashed border-slate-400 pb-2">
          <div className="flex justify-between">
            <span className="font-bold">Inv #: {invoice.invoiceNumber}</span>
            <span>{invoice.date}</span>
          </div>
          <div className="flex justify-between">
            <span>Status: {invoice.status}</span>
            <span>{copyLabel}</span>
          </div>
          <p>Customer: {invoice.customerName}</p>
          {invoice.customerPhone && <p>Phone: {invoice.customerPhone}</p>}
          <p>Cashier: {invoice.salesPerson}</p>
          {invoice.installmentAccountId && (
            <p className="font-bold">Plan #: {invoice.installmentAccountId}</p>
          )}
        </div>

        {/* Itemized Lines */}
        <table className="w-full text-left text-[11px]">
          <thead>
            <tr className="border-b border-slate-400 font-bold">
              <th className="py-1">Item</th>
              <th className="py-1 text-center">Qty</th>
              <th className="py-1 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dashed divide-slate-200">
            {invoice.items.map((item, idx) => (
              <tr key={`${item.productId}-${idx}`}>
                <td className="py-1.5 pr-1 align-top">
                  <div className="font-semibold text-slate-900">{item.productName}</div>
                  <div className="text-[9px] text-slate-600">
                    {item.brand} {item.modelNumber} @ {currency} {item.unitPrice.toLocaleString()}
                  </div>
                  {item.selectedSerial && (
                    <div className="text-[9px] font-semibold text-slate-700">SN: {item.selectedSerial}</div>
                  )}
                </td>
                <td className="text-center py-1.5 align-top">{item.quantity}</td>
                <td className="text-right py-1.5 align-top font-semibold">
                  {currency} {item.total.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="border-t border-dashed border-slate-400 pt-2 space-y-1 text-[11px]">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span>{currency} {invoice.subTotal.toLocaleString()}</span>
          </div>
          {invoice.discount > 0 && (
            <div className="flex justify-between">
              <span>Discount:</span>
              <span>- {currency} {invoice.discount.toLocaleString()}</span>
            </div>
          )}
          {hasTax && (
            <div className="flex justify-between">
              <span>Tax:</span>
              <span>{currency} {invoice.tax.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between font-black text-sm border-y border-slate-400 py-1 my-1">
            <span>GRAND TOTAL:</span>
            <span>{currency} {invoice.grandTotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span>Paid ({invoice.paymentMethod}):</span>
            <span className="font-semibold">{currency} {invoice.paidAmount.toLocaleString()}</span>
          </div>
          {hasChange && (
            <div className="flex justify-between">
              <span>Change Returned:</span>
              <span>{currency} {invoice.changeAmount.toLocaleString()}</span>
            </div>
          )}
          {invoice.remainingBalance > 0 && (
            <div className="flex justify-between font-bold text-rose-700 print:text-black">
              <span>BALANCE DUE:</span>
              <span>{currency} {invoice.remainingBalance.toLocaleString()}</span>
            </div>
          )}
        </div>

        {invoice.notes && (
          <div className="border-t border-dashed border-slate-300 pt-2 text-[10px] text-slate-600">
            <span className="font-bold">Note:</span> {invoice.notes}
          </div>
        )}

        {/* Footer */}
        <div className="text-center border-t border-dashed border-slate-400 pt-3 text-[10px] text-slate-600 space-y-1">
          <p className="font-semibold text-slate-800">Thank you for your business!</p>
          <p>{settings.invoiceFooterNote || 'Official Warranty as per manufacturer terms.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-slate-800 font-sans bg-white">
      {/* Header */}
      <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-700 text-white shadow-md print:border print:border-slate-900 print:bg-slate-900">
            <Tv className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">
              {settings.showroomName}
            </h1>
            <p className="text-xs text-slate-600 font-medium">
              {settings.address}{settings.city ? `, ${settings.city}` : ''}
            </p>
            <p className="text-xs text-slate-500">
              Phone: {settings.phone}{settings.whatsapp ? ` • WhatsApp: ${settings.whatsapp}` : ''}
              {settings.email ? ` • ${settings.email}` : ''}
            </p>
            {(settings.ntn || settings.strn) && (
              <p className="text-[11px] text-slate-500 font-mono">
                {settings.ntn ? `NTN: ${settings.ntn}` : ''}
                {settings.ntn && settings.strn ? ' • ' : ''}
                {settings.strn ? `STRN: ${settings.strn}` : ''}
              </p>
            )}
          </div>
        </div>

        <div className="text-right">
          <div className="flex items-center justify-end gap-2">
            <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-600 font-semibold text-[10px] uppercase rounded border border-slate-200">
              {copyLabel}
            </span>
            <span className="inline-block px-3 py-1 bg-blue-50 text-blue-800 font-black text-sm tracking-widest uppercase rounded border border-blue-200">
              SALES INVOICE
            </span>
          </div>
          <p className="text-sm font-bold text-slate-900 mt-2 font-mono">{invoice.invoiceNumber}</p>
          <p className="text-xs text-slate-500">Date: {invoice.date}</p>
          <p className="text-xs font-semibold text-blue-700 mt-0.5">Type: {invoice.saleType} Sale</p>
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
          <p className="font-bold text-slate-500 uppercase tracking-wider text-[10px] mb-1">Payment Details</p>
          <p className="text-sm font-bold text-emerald-700">{invoice.paymentMethod}</p>
          <p className="text-slate-600">Status: {invoice.status}</p>
          {invoice.installmentAccountId && (
            <p className="text-blue-700 font-semibold">Installment Plan #{invoice.installmentAccountId}</p>
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
            <th className="py-2.5 px-3 text-right">Rate ({currency})</th>
            <th className="py-2.5 px-3 text-right">Amount ({currency})</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {invoice.items.map((item, idx) => (
            <tr key={`${item.productId}-${idx}`} className="hover:bg-slate-50/50">
              <td className="py-3 px-3 text-center text-slate-500 font-mono">{idx + 1}</td>
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
      <div className="flex justify-between items-start gap-6 pt-2 break-inside-avoid">
        <div className="w-1/2 text-xs text-slate-500 space-y-2">
          {invoice.notes && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-[11px] text-slate-700">
              <span className="font-bold text-slate-800">Invoice Notes:</span> {invoice.notes}
            </div>
          )}
          <div>
            <p className="font-bold text-slate-700">Terms & Company Warranty:</p>
            <p className="text-[11px] leading-relaxed mt-0.5">
              1. Brand new electronics carry official manufacturer warranty. Retain this invoice for claims.<br />
              2. Physical damage, electric fluctuation, or liquid ingress is not covered.<br />
              3. All accounts settled are subject to audit verification.
            </p>
          </div>
        </div>

        <div className="w-64 space-y-2 text-xs font-mono">
          <div className="flex justify-between py-1 border-b border-slate-100">
            <span className="text-slate-500 font-sans">Subtotal:</span>
            <span className="font-semibold">{currency} {invoice.subTotal.toLocaleString()}</span>
          </div>
          {invoice.discount > 0 && (
            <div className="flex justify-between py-1 border-b border-slate-100 text-rose-600">
              <span className="font-sans">Discount:</span>
              <span>- {currency} {invoice.discount.toLocaleString()}</span>
            </div>
          )}
          {hasTax && (
            <div className="flex justify-between py-1 border-b border-slate-100 text-slate-700">
              <span className="font-sans">Tax:</span>
              <span>{currency} {invoice.tax.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between py-1.5 border-b-2 border-slate-900 text-sm font-bold text-slate-900">
            <span className="font-sans">Grand Total:</span>
            <span>{currency} {invoice.grandTotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between py-1 text-emerald-700 font-semibold">
            <span className="font-sans">Amount Paid:</span>
            <span>{currency} {invoice.paidAmount.toLocaleString()}</span>
          </div>
          {hasChange && (
            <div className="flex justify-between py-1 text-slate-600">
              <span className="font-sans">Change Returned:</span>
              <span>{currency} {invoice.changeAmount.toLocaleString()}</span>
            </div>
          )}
          {invoice.remainingBalance > 0 && (
            <div className="flex justify-between py-1 text-rose-700 font-bold border-t border-slate-200">
              <span className="font-sans">Balance Due:</span>
              <span>{currency} {invoice.remainingBalance.toLocaleString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-12 pt-10 border-t border-slate-200 text-xs text-slate-600 break-inside-avoid">
        <div className="border-t border-slate-400 pt-2 text-center">
          <p className="font-semibold">Customer Signature</p>
        </div>
        <div className="border-t border-slate-400 pt-2 text-center">
          <p className="font-semibold">For {settings.showroomName}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">(Authorized Signatory & Stamp)</p>
        </div>
      </div>

      {/* Footer Note */}
      <p className="text-center text-[11px] text-slate-400 italic pt-2">
        {settings.invoiceFooterNote}
      </p>
    </div>
  );
};
