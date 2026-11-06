import React, { useState } from 'react';
import { 
  FileInput, Plus, Search, Truck, Calendar, 
  CheckCircle, ArrowUpRight, DollarSign, X, Trash2, Printer 
} from 'lucide-react';
import { 
  getPurchases, getSuppliers, getProducts, 
  createPurchaseInvoice, getSettings, getActiveUser 
} from '../../services/storage';
import { PurchaseInvoice, PurchaseItem } from '../../types/erp';
import { Badge } from '../common/Badge';

export const PurchasesView: React.FC = () => {
  const [purchases, setPurchases] = useState<PurchaseInvoice[]>(getPurchases());
  const suppliers = getSuppliers();
  const products = getProducts();
  const settings = getSettings();
  const currentUser = getActiveUser();

  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);

  // Form state (NextERP Screenshot style)
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [warehouse, setWarehouse] = useState('Main Showroom Floor');
  const [freightCharges, setFreightCharges] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank Transfer' | 'Cheque' | 'Credit'>('Bank Transfer');
  const [notes, setNotes] = useState('');

  // Items
  const [items, setItems] = useState<PurchaseItem[]>([
    {
      productId: products[0]?.id || '',
      productName: products[0]?.name || '',
      brand: products[0]?.brand || '',
      modelNumber: products[0]?.modelNumber || '',
      quantity: 5,
      purchasePrice: products[0]?.purchasePrice || 0,
      total: (products[0]?.purchasePrice || 0) * 5,
      serialNumbers: []
    }
  ]);

  // Calculations
  const subTotal = items.reduce((sum, i) => sum + i.total, 0);
  const grandTotal = subTotal + Number(freightCharges || 0);
  const remainingBalance = Math.max(0, grandTotal - Number(paidAmount || 0));

  const handleAddItemRow = () => {
    if (products.length === 0) return;
    const p = products[0];
    setItems([
      ...items,
      {
        productId: p.id,
        productName: p.name,
        brand: p.brand,
        modelNumber: p.modelNumber,
        quantity: 1,
        purchasePrice: p.purchasePrice,
        total: p.purchasePrice,
        serialNumbers: []
      }
    ]);
  };

  const handleUpdateItem = (index: number, field: string, val: any) => {
    setItems(prev => {
      const copy = [...prev];
      const target = { ...copy[index] };

      if (field === 'productId') {
        const prod = products.find(p => p.id === val);
        if (prod) {
          target.productId = prod.id;
          target.productName = prod.name;
          target.brand = prod.brand;
          target.modelNumber = prod.modelNumber;
          target.purchasePrice = prod.purchasePrice;
          target.total = prod.purchasePrice * target.quantity;
        }
      } else if (field === 'quantity') {
        const q = Math.max(1, Number(val) || 1);
        target.quantity = q;
        target.total = q * target.purchasePrice;
      } else if (field === 'purchasePrice') {
        const p = Math.max(0, Number(val) || 0);
        target.purchasePrice = p;
        target.total = p * target.quantity;
      } else if (field === 'serialsRaw') {
        target.serialNumbers = (val as string).split(',').map(s => s.trim()).filter(Boolean);
      }

      copy[index] = target;
      return copy;
    });
  };

  const handleRemoveRow = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSavePurchase = (e: React.FormEvent) => {
    e.preventDefault();
    const supp = suppliers.find(s => s.id === supplierId);
    if (!supp) {
      alert('Please select a valid supplier');
      return;
    }

    const invNum = `${settings.purchasePrefix}${Date.now().toString().slice(-4)}`;

    const newInv = createPurchaseInvoice({
      invoiceNumber: invNum,
      supplierId: supp.id,
      supplierName: supp.companyName,
      date: invoiceDate,
      items,
      subTotal,
      discount: 0,
      tax: 0,
      freightCharges: Number(freightCharges || 0),
      grandTotal,
      paidAmount: Number(paidAmount || 0),
      remainingBalance,
      paymentMethod,
      status: 'Received',
      notes
    });

    setPurchases(getPurchases());
    setShowCreateModal(false);
  };

  const filteredPurchases = purchases.filter(p => 
    p.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.supplierName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Purchase Invoices & Consignments
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Record supplier orders, stock intake, landed freight & payable balances
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-98 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Create Purchase Invoice</span>
        </button>
      </div>

      {/* Purchases List */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by invoice # or supplier..."
              className="w-full rounded-xl border border-slate-200 pl-10 pr-3.5 py-2 text-xs focus:outline-none focus:border-blue-600"
            />
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Total Invoices: {filteredPurchases.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Invoice #</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Items Summary</th>
                <th className="py-3 px-4 text-right">Grand Total</th>
                <th className="py-3 px-4 text-right">Paid Amount</th>
                <th className="py-3 px-4 text-right">Balance Due</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPurchases.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3.5 px-4 font-mono font-bold text-blue-700">{p.invoiceNumber}</td>
                  <td className="py-3.5 px-4 font-semibold text-slate-900">{p.supplierName}</td>
                  <td className="py-3.5 px-4 text-slate-500">{p.date}</td>
                  <td className="py-3.5 px-4 text-slate-600">
                    {p.items.map(i => `${i.productName} (x${i.quantity})`).join(', ')}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                    ₨ {p.grandTotal.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-emerald-700 font-semibold">
                    ₨ {p.paidAmount.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-700">
                    ₨ {p.remainingBalance.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <Badge variant={p.status === 'Received' ? 'success' : 'neutral'} size="sm">
                      {p.status}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => setSelectedInvoice(p)}
                      className="px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-medium text-[11px]"
                    >
                      View Slip
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Purchase Invoice Modal (NextERP Screenshot style) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-4xl rounded-2xl bg-white p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Create Purchase Invoice</h3>
                <p className="text-xs text-slate-400">NextERP Standard Consignment Intake Workflow</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSavePurchase} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Supplier *</label>
                  <select
                    value={supplierId}
                    onChange={e => setSupplierId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 focus:outline-none focus:border-blue-600"
                  >
                    {suppliers.map(s => (
                      <option key={s.id} value={s.id}>{s.companyName}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Invoice Date *</label>
                  <input
                    type="date"
                    required
                    value={invoiceDate}
                    onChange={e => setInvoiceDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Target Warehouse</label>
                  <input
                    type="text"
                    value={warehouse}
                    onChange={e => setWarehouse(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              {/* Items Line Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">Consignment Items</span>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-bold text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Item Line
                  </button>
                </div>

                <div className="p-3 space-y-3">
                  {items.map((item, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-50/60 border border-slate-200 space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <div className="sm:col-span-2">
                          <label className="block text-[10px] text-slate-500 font-bold uppercase mb-0.5">Product</label>
                          <select
                            value={item.productId}
                            onChange={e => handleUpdateItem(idx, 'productId', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs"
                          >
                            {products.map(p => (
                              <option key={p.id} value={p.id}>{p.brand} - {p.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-500 font-bold uppercase mb-0.5">Quantity</label>
                          <input
                            type="number"
                            min={1}
                            value={item.quantity}
                            onChange={e => handleUpdateItem(idx, 'quantity', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-mono font-bold"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-500 font-bold uppercase mb-0.5">Cost/Unit (₨)</label>
                          <input
                            type="number"
                            min={0}
                            value={item.purchasePrice}
                            onChange={e => handleUpdateItem(idx, 'purchasePrice', e.target.value)}
                            className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs font-mono font-bold"
                          />
                        </div>
                      </div>

                      {/* Serials input */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/50">
                        <input
                          type="text"
                          placeholder="Serial Numbers (comma-separated, e.g. HR-01, HR-02...)"
                          onChange={e => handleUpdateItem(idx, 'serialsRaw', e.target.value)}
                          className="flex-1 rounded-lg border border-slate-200 bg-white p-1.5 text-xs font-mono"
                        />
                        <span className="font-mono font-bold text-slate-900 text-xs shrink-0">
                          Total: ₨ {item.total.toLocaleString()}
                        </span>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom calculations */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <label className="block text-slate-700 font-medium">Notes & Supplier Delivery Challan #</label>
                  <textarea
                    rows={3}
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Enter goods receiving notes, freight voucher or transport info..."
                    className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 font-mono text-xs">
                  <div className="flex justify-between font-sans text-slate-600">
                    <span>Subtotal:</span>
                    <span>₨ {subTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center font-sans text-slate-600">
                    <span>Freight / Transport (₨):</span>
                    <input
                      type="number"
                      min={0}
                      value={freightCharges || ''}
                      onChange={e => setFreightCharges(Number(e.target.value) || 0)}
                      placeholder="0"
                      className="w-24 rounded border border-slate-200 bg-white p-1 text-right font-mono"
                    />
                  </div>
                  <div className="flex justify-between font-sans text-sm font-extrabold text-slate-900 py-1 border-t border-slate-200">
                    <span>Grand Total:</span>
                    <span className="text-blue-700">₨ {grandTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center font-sans text-emerald-700">
                    <span>Amount Paid (₨):</span>
                    <input
                      type="number"
                      min={0}
                      value={paidAmount || ''}
                      onChange={e => setPaidAmount(Number(e.target.value) || 0)}
                      placeholder="0"
                      className="w-28 rounded border border-slate-200 bg-white p-1 text-right font-mono font-bold text-emerald-800"
                    />
                  </div>
                  <div className="flex justify-between font-sans text-rose-700 font-bold border-t border-slate-200 pt-1">
                    <span>Remaining Payable:</span>
                    <span>₨ {remainingBalance.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 font-bold text-white hover:bg-blue-700 shadow-sm"
                >
                  Save & Post Purchase Consignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Slip Viewer Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Purchase Invoice #{selectedInvoice.invoiceNumber}</h3>
              <button onClick={() => setSelectedInvoice(null)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50">
                <div>
                  <p className="text-slate-400 text-[10px] uppercase">Supplier</p>
                  <p className="font-bold text-slate-900">{selectedInvoice.supplierName}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-400 text-[10px] uppercase">Date</p>
                  <p className="font-bold text-slate-900">{selectedInvoice.date}</p>
                </div>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl p-2">
                {selectedInvoice.items.map((i, idx) => (
                  <div key={idx} className="py-2 flex justify-between">
                    <div>
                      <p className="font-semibold text-slate-800">{i.productName}</p>
                      <p className="text-[10px] text-slate-400">Qty: {i.quantity} @ ₨ {i.purchasePrice.toLocaleString()}</p>
                    </div>
                    <span className="font-mono font-bold text-slate-900">₨ {i.total.toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1 font-mono text-right pt-2 border-t border-slate-200">
                <p>Grand Total: <strong>₨ {selectedInvoice.grandTotal.toLocaleString()}</strong></p>
                <p className="text-emerald-700">Paid: ₨ {selectedInvoice.paidAmount.toLocaleString()}</p>
                <p className="text-rose-700 font-bold">Balance: ₨ {selectedInvoice.remainingBalance.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
