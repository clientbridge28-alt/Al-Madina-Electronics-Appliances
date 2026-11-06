import React, { useState, useMemo } from 'react';
import { 
  Search, Barcode, ShoppingCart, Trash2, Plus, Minus, 
  User, CheckCircle2, AlertCircle, RotateCcw, 
  Printer, CreditCard, Banknote, ShieldAlert
} from 'lucide-react';
import { 
  getProducts, getCustomers, createSalesInvoice, 
  saveCustomer, getActiveUser, getSettings 
} from '../../services/storage';
import { Product, Customer, SaleItem, SalesInvoice } from '../../types/erp';
import { InvoicePrintModal } from './InvoicePrintModal';

interface POSBillingViewProps {
  initialSearchId?: string;
}

export const POSBillingView: React.FC<POSBillingViewProps> = ({ initialSearchId }) => {
  const [products] = useState<Product[]>(getProducts());
  const [customers, setCustomers] = useState<Customer[]>(getCustomers());
  const settings = getSettings();
  const currentUser = getActiveUser();

  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Customer state
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('walk-in');
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustCnic, setNewCustCnic] = useState('');
  const [newCustAddress, setNewCustAddress] = useState('');

  // Cart state
  const [cartItems, setCartItems] = useState<SaleItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [saleType, setSaleType] = useState<'Cash' | 'Credit' | 'Installment'>('Cash');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Bank Transfer' | 'Card' | 'Cheque'>('Cash');
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [salesNotes, setSalesNotes] = useState('');

  // Invoice Print Modal State
  const [lastInvoice, setLastInvoice] = useState<SalesInvoice | null>(null);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set(products.map(p => p.category));
    return ['All', ...Array.from(set)];
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
      const matchQuery = !searchQuery || 
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.modelNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode.includes(searchQuery);
      return matchCat && matchQuery;
    });
  }, [products, selectedCategory, searchQuery]);

  // Handle Barcode Scan
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    const match = products.find(p => p.barcode === barcodeInput.trim() || p.sku.toLowerCase() === barcodeInput.trim().toLowerCase());
    if (match) {
      addToCart(match);
      setBarcodeInput('');
    } else {
      alert(`No product found with barcode / SKU: ${barcodeInput}`);
    }
  };

  // Add product to cart
  const addToCart = (product: Product) => {
    if (product.stockQuantity <= 0) {
      alert(`Cannot add ${product.name}: Out of Stock!`);
      return;
    }

    setCartItems(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stockQuantity) {
          alert(`Cannot add more than available stock (${product.stockQuantity} units)`);
          return prev;
        }
        return prev.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unitPrice }
            : item
        );
      } else {
        // Pick available serial if applicable
        const availableSerial = product.serials?.find(s => s.status === 'In Stock')?.serialNumber;
        return [
          ...prev,
          {
            productId: product.id,
            productName: product.name,
            brand: product.brand,
            modelNumber: product.modelNumber,
            quantity: 1,
            unitPrice: product.retailPrice,
            costPrice: product.purchasePrice,
            discount: 0,
            total: product.retailPrice,
            selectedSerial: availableSerial
          }
        ];
      }
    });
  };

  // Update item quantity
  const updateQuantity = (productId: string, delta: number) => {
    setCartItems(prev => {
      return prev.map(item => {
        if (item.productId === productId) {
          const prod = products.find(p => p.id === productId);
          const newQty = item.quantity + delta;
          if (newQty <= 0) return null;
          if (prod && newQty > prod.stockQuantity) {
            alert(`Stock limit reached! Max available: ${prod.stockQuantity}`);
            return item;
          }
          return { ...item, quantity: newQty, total: newQty * item.unitPrice };
        }
        return item;
      }).filter(Boolean) as SaleItem[];
    });
  };

  // Update item serial
  const updateSerial = (productId: string, serial: string) => {
    setCartItems(prev => 
      prev.map(i => i.productId === productId ? { ...i, selectedSerial: serial } : i)
    );
  };

  // Remove item
  const removeFromCart = (productId: string) => {
    setCartItems(prev => prev.filter(i => i.productId !== productId));
  };

  // Calculate bill totals
  const subTotal = useMemo(() => cartItems.reduce((sum, item) => sum + item.total, 0), [cartItems]);
  const grandTotal = useMemo(() => Math.max(0, subTotal - discountAmount), [subTotal, discountAmount]);

  // Default paid amount when subtotal changes
  React.useEffect(() => {
    if (saleType === 'Cash') {
      setAmountPaid(grandTotal);
    } else if (saleType === 'Credit') {
      setAmountPaid(0);
    }
  }, [grandTotal, saleType]);

  const changeDue = useMemo(() => {
    if (amountPaid > grandTotal) return amountPaid - grandTotal;
    return 0;
  }, [amountPaid, grandTotal]);

  const remainingBalance = useMemo(() => {
    if (grandTotal > amountPaid) return grandTotal - amountPaid;
    return 0;
  }, [grandTotal, amountPaid]);

  // Quick Customer Registration
  const handleCreateCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName || !newCustPhone) return;

    const newCustomer: Customer = {
      id: `CUST-${Date.now().toString().slice(-4)}`,
      name: newCustName,
      phone: newCustPhone,
      cnic: newCustCnic || '35202-0000000-0',
      address: newCustAddress || 'Lahore',
      city: 'Lahore',
      openingBalance: 0,
      currentBalance: 0,
      creditLimit: 250000,
      customerType: 'Retail',
      createdAt: new Date().toISOString().split('T')[0]
    };

    saveCustomer(newCustomer);
    setCustomers(getCustomers());
    setSelectedCustomerId(newCustomer.id);
    setShowNewCustomerModal(false);
    setNewCustName('');
    setNewCustPhone('');
    setNewCustCnic('');
    setNewCustAddress('');
  };

  // Complete Sale & Post Invoice
  const handleCheckout = () => {
    if (cartItems.length === 0) {
      alert('Cart is empty! Add products before checking out.');
      return;
    }

    if (saleType === 'Credit' && selectedCustomerId === 'walk-in') {
      alert('Credit sales require selecting or registering a verified customer profile.');
      return;
    }

    const selectedCust = selectedCustomerId === 'walk-in'
      ? { id: 'CUST-WALKIN', name: 'Walk-in Cash Customer', phone: '0300-0000000' }
      : customers.find(c => c.id === selectedCustomerId) || { id: 'CUST-WALKIN', name: 'Walk-in Cash Customer', phone: '' };

    const invNum = `${settings.invoicePrefix}${Date.now().toString().slice(-5)}`;
    const today = new Date().toISOString().split('T')[0];

    const newInvoice = createSalesInvoice({
      invoiceNumber: invNum,
      customerId: selectedCust.id,
      customerName: selectedCust.name,
      customerPhone: selectedCust.phone,
      saleType,
      date: today,
      items: cartItems,
      subTotal,
      discount: discountAmount,
      tax: 0,
      grandTotal,
      paidAmount: Math.min(amountPaid, grandTotal),
      changeAmount: changeDue,
      remainingBalance,
      paymentMethod,
      salesPerson: currentUser.name,
      notes: salesNotes
    });

    setLastInvoice(newInvoice);
    setShowPrintModal(true);

    // Clear cart
    setCartItems([]);
    setDiscountAmount(0);
    setSalesNotes('');
  };

  return (
    <div className="flex flex-col lg:flex-row gap-5 h-full">
      {/* LEFT COLUMN: Product Catalog & Fast Barcode Search */}
      <div className="flex-1 flex flex-col space-y-4">
        {/* Barcode & Search Controls */}
        <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-2xs space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Barcode Fast Scan */}
            <form onSubmit={handleBarcodeSubmit} className="relative flex-1">
              <Barcode className="absolute left-3.5 top-3 h-4 w-4 text-blue-600" />
              <input
                type="text"
                value={barcodeInput}
                onChange={e => setBarcodeInput(e.target.value)}
                placeholder="Scan / Type Barcode or SKU & hit Enter..."
                className="w-full rounded-xl border border-blue-200 bg-blue-50/40 pl-10 pr-24 py-2.5 text-xs text-slate-800 placeholder-blue-400 font-mono focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
              <button
                type="submit"
                className="absolute right-1.5 top-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1 text-xs font-semibold text-white transition"
              >
                Scan
              </button>
            </form>

            {/* Keyword Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Filter by name, model, brand..."
                className="w-full rounded-xl border border-slate-200 pl-10 pr-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl font-medium shrink-0 transition ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70 hover:text-slate-900'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto max-h-[calc(100vh-18rem)] grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {filteredProducts.map(p => {
            const isOutOfStock = p.stockQuantity <= 0;
            const isLowStock = p.stockQuantity <= p.minStockLevel && !isOutOfStock;

            return (
              <div
                key={p.id}
                onClick={() => !isOutOfStock && addToCart(p)}
                className={`relative flex flex-col justify-between p-3.5 rounded-2xl border transition text-left cursor-pointer ${
                  isOutOfStock
                    ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                    : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-md hover:bg-blue-50/20 active:scale-99'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                      {p.brand}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      isOutOfStock
                        ? 'bg-rose-100 text-rose-700'
                        : isLowStock
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {isOutOfStock ? 'Out of Stock' : `${p.stockQuantity} in Stock`}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold text-slate-900 leading-snug line-clamp-2">
                    {p.name}
                  </h4>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    {p.modelNumber} • SKU: {p.sku}
                  </p>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Retail Price</span>
                    <span className="text-sm font-extrabold text-slate-900 font-mono">
                      ₨ {p.retailPrice.toLocaleString()}
                    </span>
                  </div>
                  <button
                    disabled={isOutOfStock}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-300 transition shadow-2xs"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT COLUMN: POS Cart & Checkout Terminal */}
      <div className="w-full lg:w-96 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col h-[calc(100vh-6.5rem)] sticky top-20 overflow-hidden">
        {/* Cart Header */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4 text-blue-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
              Active Sale Invoice ({cartItems.length})
            </h3>
          </div>
          {cartItems.length > 0 && (
            <button
              onClick={() => setCartItems([])}
              className="text-[11px] text-rose-600 hover:text-rose-700 flex items-center gap-1 font-medium"
            >
              <Trash2 className="h-3 w-3" /> Clear
            </button>
          )}
        </div>

        {/* Customer Selector */}
        <div className="p-3 border-b border-slate-100 bg-slate-50/40 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Customer Profile</span>
            <button
              onClick={() => setShowNewCustomerModal(true)}
              className="text-blue-600 hover:underline font-medium text-[11px]"
            >
              + New Customer
            </button>
          </div>
          <select
            value={selectedCustomerId}
            onChange={e => setSelectedCustomerId(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
          >
            <option value="walk-in">Walk-in Cash Customer</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.phone}) - Bal: ₨ {c.currentBalance.toLocaleString()}
              </option>
            ))}
          </select>

          {/* Sale Type Pills */}
          <div className="grid grid-cols-3 gap-1 pt-1">
            {(['Cash', 'Credit', 'Installment'] as const).map(type => (
              <button
                key={type}
                onClick={() => setSaleType(type)}
                className={`py-1.5 rounded-lg text-xs font-semibold transition ${
                  saleType === type
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Cart Item Rows */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
          {cartItems.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <ShoppingCart className="h-8 w-8 mx-auto text-slate-300" />
              <p className="text-xs">No items in the bill.</p>
              <p className="text-[11px] text-slate-400">Scan barcode or select from catalog</p>
            </div>
          ) : (
            cartItems.map(item => {
              const product = products.find(p => p.id === item.productId);
              const availableSerials = product?.serials?.filter(s => s.status === 'In Stock') || [];

              return (
                <div key={item.productId} className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-900 leading-tight">{item.productName}</p>
                      <p className="text-[10px] text-slate-400">{item.brand} • {item.modelNumber}</p>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.productId)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Serial number selector if serialized */}
                  {availableSerials.length > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <span className="text-slate-500 font-medium">SN:</span>
                      <select
                        value={item.selectedSerial || ''}
                        onChange={e => updateSerial(item.productId, e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-blue-700 font-mono w-full focus:outline-none"
                      >
                        <option value="">Select Serial / IMEI</option>
                        {availableSerials.map(s => (
                          <option key={s.serialNumber} value={s.serialNumber}>
                            {s.serialNumber} ({s.condition})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Qty & Price */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.productId, -1)}
                        className="h-6 w-6 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="font-bold text-slate-800 text-xs w-4 text-center">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.productId, 1)}
                        className="h-6 w-6 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-[10px] text-slate-400 block">₨ {item.unitPrice.toLocaleString()} each</span>
                      <span className="font-extrabold text-slate-900 text-xs">₨ {item.total.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Calculation & Payment Controls */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/70 space-y-2 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal:</span>
            <span className="font-mono font-medium">₨ {subTotal.toLocaleString()}</span>
          </div>

          <div className="flex items-center justify-between text-slate-600">
            <span>Discount (₨):</span>
            <input
              type="number"
              min={0}
              value={discountAmount || ''}
              onChange={e => setDiscountAmount(Number(e.target.value) || 0)}
              placeholder="0"
              className="w-24 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-right font-mono text-xs focus:outline-none focus:border-blue-600"
            />
          </div>

          <div className="flex justify-between items-center py-1.5 border-t border-slate-200 text-sm font-extrabold text-slate-900">
            <span>Grand Total:</span>
            <span className="font-mono text-blue-700 text-base">₨ {grandTotal.toLocaleString()}</span>
          </div>

          {/* Payment Method Selector */}
          <div className="flex items-center gap-1.5 pt-1">
            <span className="text-slate-500 text-[11px] shrink-0">Method:</span>
            <select
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value as any)}
              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 focus:outline-none"
            >
              <option value="Cash">Cash Drawer</option>
              <option value="Bank Transfer">Meezan Bank Online</option>
              <option value="Card">Credit / Debit POS Card</option>
              <option value="Cheque">Bank Cheque</option>
            </select>
          </div>

          {/* Amount Paid & Change */}
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <span className="text-[10px] text-slate-500 block">Amount Paid (₨)</span>
              <input
                type="number"
                min={0}
                value={amountPaid || ''}
                onChange={e => setAmountPaid(Number(e.target.value) || 0)}
                placeholder="0"
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 font-mono text-xs font-semibold focus:outline-none focus:border-blue-600"
              />
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block">
                {changeDue > 0 ? 'Change Due (₨)' : 'Balance Due (₨)'}
              </span>
              <div className={`px-2 py-1 rounded-lg font-mono text-xs font-bold ${
                changeDue > 0 ? 'bg-emerald-50 text-emerald-700' : remainingBalance > 0 ? 'bg-rose-50 text-rose-700' : 'bg-slate-100 text-slate-700'
              }`}>
                ₨ {(changeDue > 0 ? changeDue : remainingBalance).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Post Sale Button */}
          <button
            onClick={handleCheckout}
            disabled={cartItems.length === 0}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-2.5 text-xs shadow-md shadow-blue-500/20 transition active:scale-98"
          >
            <Printer className="h-4 w-4" />
            <span>Post & Print Invoice (F9)</span>
          </button>
        </div>
      </div>

      {/* Quick Customer Modal */}
      {showNewCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl space-y-4">
            <h4 className="text-sm font-bold text-slate-900">Register New Customer</h4>
            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newCustName}
                  onChange={e => setNewCustName(e.target.value)}
                  placeholder="e.g. Haji Muhammad Aslam"
                  className="w-full rounded-lg border border-slate-200 p-2 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Mobile / WhatsApp *</label>
                <input
                  type="text"
                  required
                  value={newCustPhone}
                  onChange={e => setNewCustPhone(e.target.value)}
                  placeholder="0300-1234567"
                  className="w-full rounded-lg border border-slate-200 p-2 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">CNIC (Optional)</label>
                <input
                  type="text"
                  value={newCustCnic}
                  onChange={e => setNewCustCnic(e.target.value)}
                  placeholder="35202-1234567-1"
                  className="w-full rounded-lg border border-slate-200 p-2 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1">Address / Area</label>
                <input
                  type="text"
                  value={newCustAddress}
                  onChange={e => setNewCustAddress(e.target.value)}
                  placeholder="e.g. Model Town, Lahore"
                  className="w-full rounded-lg border border-slate-200 p-2 focus:outline-none focus:border-blue-600"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewCustomerModal(false)}
                  className="flex-1 rounded-lg border border-slate-200 py-2 font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-blue-600 py-2 font-bold text-white hover:bg-blue-700"
                >
                  Save & Select
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Print Preview Modal */}
      <InvoicePrintModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        invoice={lastInvoice}
      />
    </div>
  );
};
