import React, { useState, useEffect } from 'react';
import { 
  FileInput, Plus, Search, Truck, Calendar, 
  CheckCircle, ArrowUpRight, DollarSign, X, Trash2, Printer, RotateCcw, AlertCircle 
} from 'lucide-react';
import { 
  getPurchases, getPurchaseReturns, getSuppliers, getProducts, 
  createPurchaseInvoice, createPurchaseReturn, getSettings, getActiveUser, subscribeToDatabase 
} from '../../services/storage';
import { PurchaseInvoice, PurchaseItem, PurchaseReturnItem } from '../../types/erp';
import { Badge } from '../common/Badge';

export const PurchasesView: React.FC = () => {
  const [, setDbTick] = useState(0);
  useEffect(() => subscribeToDatabase(() => setDbTick(t => t + 1)), []);

  const purchases = getPurchases();
  const purchaseReturns = getPurchaseReturns();
  const suppliers = getSuppliers();
  const products = getProducts();
  const settings = getSettings();

  const [activeTab, setActiveTab] = useState<'purchases' | 'returns'>('purchases');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [notice, setNotice] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  // Purchase Return state
  const [returnPurchaseId, setReturnPurchaseId] = useState('');
  const [returnMethod, setReturnMethod] = useState<'Deduct Payable' | 'Cash Refund' | 'Bank Refund'>('Deduct Payable');
  const [returnRemarks, setReturnRemarks] = useState('');
  const [returnItems, setReturnItems] = useState<PurchaseReturnItem[]>([]);

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

  useEffect(() => {
    if (!supplierId && suppliers.length > 0) {
      setSupplierId(suppliers[0].id);
    }
  }, [suppliers.length, supplierId]);

  useEffect(() => {
    if (products.length > 0 && items.length === 1 && !items[0].productId) {
      const p = products[0];
      setItems([
        {
          productId: p.id,
          productName: p.name,
          brand: p.brand,
          modelNumber: p.modelNumber,
          quantity: items[0].quantity || 5,
          purchasePrice: p.purchasePrice,
          total: p.purchasePrice * (items[0].quantity || 5),
          serialNumbers: [],
        },
      ]);
    }
  }, [products.length, items]);

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
      setNotice({ type: 'error', text: 'Please select or create a supplier before saving a purchase invoice.' });
      return;
    }

    const invNum = `${settings.purchasePrefix}${Date.now().toString().slice(-4)}`;

    try {
      createPurchaseInvoice({
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

      setShowCreateModal(false);
      setNotice({ type: 'success', text: `Purchase Invoice #${invNum} posted to inventory & accounts.` });
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Could not post purchase invoice.' });
    }
  };

  const handleOpenReturnModal = (preset?: PurchaseInvoice) => {
    const target = preset || purchases.find(p => p.status !== 'Returned');
    if (target) {
      setReturnPurchaseId(target.id);
      setReturnItems(
        target.items.map(i => ({
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          purchasePrice: i.purchasePrice,
          total: i.quantity * i.purchasePrice,
          serialNumber: i.serialNumbers?.[0],
          reason: 'Defective / Vendor return',
        }))
      );
      setReturnMethod(target.remainingBalance > 0 ? 'Deduct Payable' : 'Bank Refund');
    } else {
      setReturnPurchaseId('');
      setReturnItems([]);
    }
    setReturnRemarks('');
    setShowReturnModal(true);
  };

  const handleSelectReturnPurchase = (id: string) => {
    setReturnPurchaseId(id);
    const pur = purchases.find(p => p.id === id);
    if (pur) {
      setReturnItems(
        pur.items.map(i => ({
          productId: i.productId,
          productName: i.productName,
          quantity: i.quantity,
          purchasePrice: i.purchasePrice,
          total: i.quantity * i.purchasePrice,
          serialNumber: i.serialNumbers?.[0],
          reason: 'Defective / Vendor return',
        }))
      );
    }
  };

  const handleSubmitPurchaseReturn = (e: React.FormEvent) => {
    e.preventDefault();
    const orig = purchases.find(p => p.id === returnPurchaseId);
    const validItems = returnItems.filter(i => i.quantity > 0);
    if (!orig || validItems.length === 0) {
      setNotice({ type: 'error', text: 'Select a valid purchase invoice and at least one item to return.' });
      return;
    }
    const total = validItems.reduce((sum, i) => sum + i.total, 0);
    try {
      const created = createPurchaseReturn({
        returnNumber: `PRTN-${Date.now().toString().slice(-5)}`,
        originalPurchaseNo: orig.invoiceNumber,
        supplierId: orig.supplierId,
        supplierName: orig.supplierName,
        date: new Date().toISOString().split('T')[0],
        items: validItems,
        grandTotal: total,
        refundMethod: returnMethod,
        remarks: returnRemarks,
      });
      setShowReturnModal(false);
      setActiveTab('returns');
      setNotice({ type: 'success', text: `Purchase Return #${created.returnNumber} recorded (PKR ${created.grandTotal.toLocaleString()}). Stock & payable updated.` });
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Could not record purchase return.' });
    }
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
            Record supplier orders, stock intake, landed freight, purchase returns & payable balances
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => handleOpenReturnModal()}
            className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 px-3.5 py-2.5 text-xs font-bold text-amber-900 transition"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Purchase Return</span>
          </button>

          <button
            onClick={() => {
              if (!supplierId && suppliers.length > 0) {
                setSupplierId(suppliers[0].id);
              }
              if (products.length > 0 && items.length === 1 && !items[0].productId) {
                const p = products[0];
                setItems([
                  {
                    productId: p.id,
                    productName: p.name,
                    brand: p.brand,
                    modelNumber: p.modelNumber,
                    quantity: 5,
                    purchasePrice: p.purchasePrice,
                    total: p.purchasePrice * 5,
                    serialNumbers: [],
                  },
                ]);
              }
              setShowCreateModal(true);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-98"
          >
            <Plus className="h-4 w-4" />
            <span>Create Purchase Invoice</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
          notice.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-emerald-50 border-emerald-200 text-emerald-900'
        }`}>
          <div className="flex items-center gap-2">
            {notice.type === 'error' ? <AlertCircle className="h-4 w-4 text-rose-600" /> : <CheckCircle className="h-4 w-4 text-emerald-600" />}
            <span>{notice.text}</span>
          </div>
          <button onClick={() => setNotice(null)} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('purchases')}
          className={`px-4 py-2 rounded-xl text-xs font-bold ${
            activeTab === 'purchases' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
          }`}
        >
          Purchase Consignments ({purchases.length})
        </button>
        <button
          onClick={() => setActiveTab('returns')}
          className={`px-4 py-2 rounded-xl text-xs font-bold ${
            activeTab === 'returns' ? 'bg-amber-600 text-white' : 'bg-white border border-slate-200 text-slate-700'
          }`}
        >
          Purchase Returns / Debit Notes ({purchaseReturns.length})
        </button>
      </div>

      {activeTab === 'returns' ? (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Return #</th>
                  <th className="py-3 px-4">Original Purchase</th>
                  <th className="py-3 px-4">Supplier</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Settlement</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchaseReturns.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-mono font-bold text-amber-700">{r.returnNumber}</td>
                    <td className="py-3 px-4 font-mono text-blue-700">{r.originalPurchaseNo}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{r.supplierName}</td>
                    <td className="py-3 px-4 text-slate-500">{r.date}</td>
                    <td className="py-3 px-4 text-slate-600">{r.items.map(i => `${i.productName} (x${i.quantity})`).join(', ')}</td>
                    <td className="py-3 px-4"><span className="px-2 py-0.5 rounded bg-slate-100 font-semibold">{r.refundMethod}</span></td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-amber-800">₨ {r.grandTotal.toLocaleString()}</td>
                  </tr>
                ))}
                {purchaseReturns.length === 0 && (
                  <tr><td colSpan={7} className="p-8 text-center text-slate-400">No purchase returns recorded yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>

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
      </>
      )}

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
                    <option value="">{suppliers.length === 0 ? 'No suppliers found' : 'Select Supplier...'}</option>
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
                            <option value="">{products.length === 0 ? 'No products found' : 'Select Product...'}</option>
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

      {/* Purchase Return Modal */}
      {showReturnModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Create Purchase Return (Debit Note)</h3>
              <button onClick={() => setShowReturnModal(false)} className="text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmitPurchaseReturn} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Original Purchase Invoice *</label>
                  <select
                    required
                    value={returnPurchaseId}
                    onChange={e => handleSelectReturnPurchase(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5"
                  >
                    <option value="">Select Purchase Invoice...</option>
                    {purchases.filter(p => p.status !== 'Returned').map(p => (
                      <option key={p.id} value={p.id}>
                        #{p.invoiceNumber} — {p.supplierName} (₨ {p.grandTotal.toLocaleString()})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Settlement Method *</label>
                  <select
                    value={returnMethod}
                    onChange={e => setReturnMethod(e.target.value as any)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5"
                  >
                    <option value="Deduct Payable">Deduct from Supplier Payable</option>
                    <option value="Cash Refund">Cash Refund Received</option>
                    <option value="Bank Refund">Bank Refund Received</option>
                  </select>
                </div>
              </div>

              {returnItems.length > 0 && (
                <div className="border border-slate-200 rounded-xl divide-y divide-slate-100">
                  {returnItems.map((it, idx) => (
                    <div key={idx} className="p-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-bold text-slate-900">{it.productName}</p>
                        <p className="text-[11px] text-slate-500">Cost: ₨ {it.purchasePrice.toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={it.reason}
                          onChange={e => {
                            const copy = [...returnItems];
                            copy[idx] = { ...copy[idx], reason: e.target.value };
                            setReturnItems(copy);
                          }}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs w-36"
                        />
                        <input
                          type="number"
                          min={0}
                          value={it.quantity}
                          onChange={e => {
                            const q = Math.max(0, Number(e.target.value) || 0);
                            const copy = [...returnItems];
                            copy[idx] = { ...copy[idx], quantity: q, total: q * copy[idx].purchasePrice };
                            setReturnItems(copy);
                          }}
                          className="w-16 rounded-lg border border-slate-200 px-2 py-1 text-center font-mono font-bold"
                        />
                        <span className="font-mono font-bold text-slate-900 w-24 text-right">
                          ₨ {it.total.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Remarks</label>
                <input
                  type="text"
                  value={returnRemarks}
                  onChange={e => setReturnRemarks(e.target.value)}
                  placeholder="Optional supplier RMA or damage note..."
                  className="w-full rounded-xl border border-slate-200 p-2.5"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowReturnModal(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 font-semibold text-slate-600">Cancel</button>
                <button type="submit" className="flex-1 rounded-xl bg-amber-600 hover:bg-amber-700 py-2.5 font-bold text-white">Post Purchase Return</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
