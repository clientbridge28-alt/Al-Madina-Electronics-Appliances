import React, { useState, useMemo } from 'react';
import { Search, Package, Users, FileText, Calendar, X, ArrowRight, UserCheck } from 'lucide-react';
import { getProducts, getCustomers, getSales, getInstallmentAccounts, getVisitors } from '../../services/storage';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (module: string, itemId?: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  onNavigate
}) => {
  const [query, setQuery] = useState('');

  const products = useMemo(() => getProducts(), [isOpen]);
  const customers = useMemo(() => getCustomers(), [isOpen]);
  const sales = useMemo(() => getSales(), [isOpen]);
  const installments = useMemo(() => getInstallmentAccounts(), [isOpen]);
  const visitors = useMemo(() => getVisitors(), [isOpen]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { products: [], customers: [], sales: [], installments: [], visitors: [] };

    return {
      products: products.filter(p => 
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.modelNumber.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        (p.serials && p.serials.some(s => s.serialNumber.toLowerCase().includes(q)))
      ).slice(0, 4),

      customers: customers.filter(c => 
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        c.cnic.includes(q) ||
        c.id.toLowerCase().includes(q)
      ).slice(0, 4),

      sales: sales.filter(s => 
        s.invoiceNumber.toLowerCase().includes(q) ||
        s.customerName.toLowerCase().includes(q)
      ).slice(0, 4),

      installments: installments.filter(inst => 
        inst.accountNumber.toLowerCase().includes(q) ||
        inst.customerName.toLowerCase().includes(q) ||
        inst.customerCnic.includes(q)
      ).slice(0, 4),

      visitors: visitors.filter(v =>
        v.name.toLowerCase().includes(q) ||
        v.phone.includes(q) ||
        v.purpose.toLowerCase().includes(q)
      ).slice(0, 3)
    };
  }, [query, products, customers, sales, installments, visitors]);

  if (!isOpen) return null;

  const totalResults = results.products.length + results.customers.length + results.sales.length + results.installments.length + results.visitors.length;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto no-print">
      <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />
      <div className="flex min-h-full items-start justify-center p-4 pt-16">
        <div 
          className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150"
          onClick={e => e.stopPropagation()}
        >
          {/* Search Input Bar */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 bg-slate-50/50">
            <Search className="h-5 w-5 text-blue-600 shrink-0" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search products, serial numbers, customers, CNIC, invoices, installments, visitors..."
              className="w-full bg-transparent text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
            />
            {query && (
              <button onClick={() => setQuery('')} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            )}
            <kbd className="hidden sm:inline-block px-2 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-200/60 rounded border border-slate-300">
              ESC
            </kbd>
          </div>

          {/* Results list */}
          <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
            {!query ? (
              <div className="py-8 text-center">
                <p className="text-sm font-medium text-slate-600">Global Search Engine</p>
                <p className="text-xs text-slate-400 mt-1">
                  Type an IMEI/Serial (e.g. "HR-AC"), Customer Name, CNIC, Invoice # or Product Model
                </p>
              </div>
            ) : totalResults === 0 ? (
              <div className="py-8 text-center text-slate-500">
                <p className="text-sm font-medium">No records found matching "{query}"</p>
                <p className="text-xs text-slate-400 mt-1">Try searching by partial name, phone or product model</p>
              </div>
            ) : (
              <>
                {/* Products */}
                {results.products.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      <Package className="h-3.5 w-3.5 text-blue-500" /> Products & Serials
                    </div>
                    <div className="space-y-1.5">
                      {results.products.map(p => (
                        <div
                          key={p.id}
                          onClick={() => { onNavigate('inventory', p.id); onClose(); }}
                          className="flex items-center justify-between p-2.5 rounded-xl hover:bg-blue-50/70 border border-transparent hover:border-blue-100 cursor-pointer group transition"
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-800 group-hover:text-blue-700">{p.name}</p>
                            <p className="text-xs text-slate-400 font-mono">
                              SKU: {p.sku} • Stock: <span className={p.stockQuantity <= p.minStockLevel ? 'text-amber-600 font-bold' : 'text-slate-600'}>{p.stockQuantity}</span> • ₨ {p.retailPrice.toLocaleString()}
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-600 transition" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Customers */}
                {results.customers.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      <Users className="h-3.5 w-3.5 text-emerald-500" /> Customers
                    </div>
                    <div className="space-y-1.5">
                      {results.customers.map(c => (
                        <div
                          key={c.id}
                          onClick={() => { onNavigate('customers', c.id); onClose(); }}
                          className="flex items-center justify-between p-2.5 rounded-xl hover:bg-emerald-50/70 border border-transparent hover:border-emerald-100 cursor-pointer group transition"
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-800 group-hover:text-emerald-700">{c.name}</p>
                            <p className="text-xs text-slate-400">
                              Phone: {c.phone} • CNIC: {c.cnic} • Balance: ₨ {c.currentBalance.toLocaleString()}
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-600 transition" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Invoices */}
                {results.sales.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      <FileText className="h-3.5 w-3.5 text-indigo-500" /> Sales Invoices
                    </div>
                    <div className="space-y-1.5">
                      {results.sales.map(s => (
                        <div
                          key={s.id}
                          onClick={() => { onNavigate('pos', s.id); onClose(); }}
                          className="flex items-center justify-between p-2.5 rounded-xl hover:bg-indigo-50/70 border border-transparent hover:border-indigo-100 cursor-pointer group transition"
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-800 group-hover:text-indigo-700">
                              Invoice #{s.invoiceNumber} — {s.customerName}
                            </p>
                            <p className="text-xs text-slate-400">
                              Date: {s.date} • Total: ₨ {s.grandTotal.toLocaleString()} ({s.saleType})
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-indigo-600 transition" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Installments */}
                {results.installments.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      <Calendar className="h-3.5 w-3.5 text-purple-500" /> Installment Accounts
                    </div>
                    <div className="space-y-1.5">
                      {results.installments.map(inst => (
                        <div
                          key={inst.id}
                          onClick={() => { onNavigate('installments', inst.id); onClose(); }}
                          className="flex items-center justify-between p-2.5 rounded-xl hover:bg-purple-50/70 border border-transparent hover:border-purple-100 cursor-pointer group transition"
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-800 group-hover:text-purple-700">
                              A/C #{inst.accountNumber} — {inst.customerName}
                            </p>
                            <p className="text-xs text-slate-400">
                              Item: {inst.productName} • Monthly: ₨ {inst.monthlyInstallment.toLocaleString()} • Bal: ₨ {inst.remainingBalance.toLocaleString()}
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-purple-600 transition" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Visitors */}
                {results.visitors.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                      <UserCheck className="h-3.5 w-3.5 text-amber-500" /> Visitors Log
                    </div>
                    <div className="space-y-1.5">
                      {results.visitors.map(v => (
                        <div
                          key={v.id}
                          onClick={() => { onNavigate('visitors', v.id); onClose(); }}
                          className="flex items-center justify-between p-2.5 rounded-xl hover:bg-amber-50/70 border border-transparent hover:border-amber-100 cursor-pointer group transition"
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-800 group-hover:text-amber-700">
                              {v.name} ({v.purpose})
                            </p>
                            <p className="text-xs text-slate-400">
                              Status: {v.status} • Entry: {v.entryTime} • Host: {v.personToMeet}
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-amber-600 transition" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
