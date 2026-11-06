import React, { useState, useMemo } from 'react';
import { 
  Package, Plus, Search, Filter, AlertTriangle, 
  CheckCircle, SlidersHorizontal, ShieldCheck, 
  Barcode, Layers, X, Edit, ArrowDown, ArrowUp
} from 'lucide-react';
import { getProducts, saveProduct, adjustProductStock, getSuppliers } from '../../services/storage';
import { Product, SerialUnit } from '../../types/erp';
import { Badge } from '../common/Badge';

export const InventoryView: React.FC = () => {
  const [products, setProducts] = useState<Product[]>(getProducts());
  const suppliers = getSuppliers();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showSerialModal, setShowSerialModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // New Product form fields
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('Air Conditioners');
  const [newProdBrand, setNewProdBrand] = useState('Dawlance');
  const [newProdModel, setNewProdModel] = useState('');
  const [newProdSku, setNewProdSku] = useState('');
  const [newProdBarcode, setNewProdBarcode] = useState('');
  const [newProdCost, setNewProdCost] = useState<number>(0);
  const [newProdRetail, setNewProdRetail] = useState<number>(0);
  const [newProdStock, setNewProdStock] = useState<number>(10);
  const [newProdMinStock, setNewProdMinStock] = useState<number>(3);
  const [newProdWarranty, setNewProdWarranty] = useState<number>(12);
  const [newProdHasSerial, setNewProdHasSerial] = useState(true);

  // Stock Adjustment form
  const [adjustQty, setAdjustQty] = useState<number>(1);
  const [adjustType, setAdjustType] = useState<'In' | 'Out'>('In');
  const [adjustReason, setAdjustReason] = useState('Physical stock count audit');

  // Serial Unit Add form
  const [newSerialNo, setNewSerialNo] = useState('');
  const [newSerialCondition, setNewSerialCondition] = useState<'Brand New' | 'Display Unit' | 'Open Box'>('Brand New');

  // Categories & Brands
  const categories = useMemo(() => ['All', ...Array.from(new Set(products.map(p => p.category)))], [products]);
  const brands = useMemo(() => ['All', ...Array.from(new Set(products.map(p => p.brand)))], [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
      const matchBrand = selectedBrand === 'All' || p.brand === selectedBrand;
      const matchLow = !onlyLowStock || p.stockQuantity <= p.minStockLevel;
      const q = searchQuery.toLowerCase();
      const matchQuery = !q || 
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.modelNumber.toLowerCase().includes(q) ||
        p.barcode.includes(q);
      return matchCat && matchBrand && matchLow && matchQuery;
    });
  }, [products, selectedCategory, selectedBrand, onlyLowStock, searchQuery]);

  // Statistics
  const totalValuation = useMemo(() => products.reduce((sum, p) => sum + (p.purchasePrice * p.stockQuantity), 0), [products]);
  const lowStockCount = useMemo(() => products.filter(p => p.stockQuantity <= p.minStockLevel).length, [products]);

  // Save new product
  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    const newProd: Product = {
      id: `PROD-${Date.now().toString().slice(-4)}`,
      name: newProdName,
      category: newProdCategory,
      brand: newProdBrand,
      modelNumber: newProdModel,
      sku: newProdSku || `SKU-${Date.now().toString().slice(-4)}`,
      barcode: newProdBarcode || `${Math.floor(100000000000 + Math.random() * 900000000000)}`,
      unit: 'Unit',
      purchasePrice: newProdCost,
      retailPrice: newProdRetail,
      minSalePrice: newProdCost * 1.05,
      stockQuantity: newProdStock,
      minStockLevel: newProdMinStock,
      warrantyMonths: newProdWarranty,
      hasSerialTracking: newProdHasSerial,
      serials: []
    };

    saveProduct(newProd);
    setProducts(getProducts());
    setShowAddModal(false);
  };

  // Handle stock adjustment
  const handleSaveAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    const finalDelta = adjustType === 'In' ? adjustQty : -adjustQty;
    adjustProductStock(selectedProduct.id, finalDelta, adjustReason);
    setProducts(getProducts());
    setShowAdjustModal(false);
  };

  // Add individual serial number to product
  const handleAddSerial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || !newSerialNo.trim()) return;

    const unit: SerialUnit = {
      serialNumber: newSerialNo.trim(),
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      condition: newSerialCondition,
      purchaseCost: selectedProduct.purchasePrice,
      purchaseDate: new Date().toISOString().split('T')[0],
      status: 'In Stock',
      warrantyMonths: selectedProduct.warrantyMonths
    };

    if (!selectedProduct.serials) selectedProduct.serials = [];
    selectedProduct.serials.push(unit);
    selectedProduct.stockQuantity = selectedProduct.serials.filter(s => s.status === 'In Stock').length;

    saveProduct(selectedProduct);
    setProducts(getProducts());
    setNewSerialNo('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Products & Serialized Inventory
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage showroom appliances, warehouse stock, unit serial numbers & warranties
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-98 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Product</span>
        </button>
      </div>

      {/* KPI Stats Bar (Inventario Screenshot style) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Catalog Products</span>
          <p className="text-2xl font-black text-slate-900 font-mono mt-1">{products.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">Active electronics models</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Low Stock Warning</span>
          <p className={`text-2xl font-black font-mono mt-1 ${lowStockCount > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
            {lowStockCount}
          </p>
          <p className="text-xs text-amber-700 mt-0.5">Items at or below reorder threshold</p>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Inventory Value</span>
          <p className="text-2xl font-black text-slate-900 font-mono mt-1">
            ₨ {(totalValuation / 1000000).toFixed(2)}M
          </p>
          <p className="text-xs text-slate-400 mt-0.5">At landed cost valuation</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by name, SKU, model, barcode..."
              className="w-full rounded-xl border border-slate-200 pl-10 pr-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600"
            />
          </div>

          {/* Category */}
          <div>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-blue-600"
            >
              <option value="All">All Categories</option>
              {categories.filter(c => c !== 'All').map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Brand */}
          <div>
            <select
              value={selectedBrand}
              onChange={e => setSelectedBrand(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-blue-600"
            >
              <option value="All">All Brands</option>
              {brands.filter(b => b !== 'All').map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Low Stock checkbox toggle */}
        <div className="flex items-center justify-between text-xs pt-1">
          <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
            <input
              type="checkbox"
              checked={onlyLowStock}
              onChange={e => setOnlyLowStock(e.target.checked)}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span>Show Only Low / Out of Stock Items</span>
          </label>
          <span className="text-slate-400 text-[11px]">
            Showing {filteredProducts.length} of {products.length} products
          </span>
        </div>
      </div>

      {/* Products Table (Inventario & SalesX style) */}
      <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="py-3 px-4">Product Details</th>
                <th className="py-3 px-4">Brand & Model</th>
                <th className="py-3 px-4 font-mono">Barcode / SKU</th>
                <th className="py-3 px-4 text-right">Cost Price</th>
                <th className="py-3 px-4 text-right">Retail Price</th>
                <th className="py-3 px-4 text-center">Stock</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map(p => {
                const isOutOfStock = p.stockQuantity <= 0;
                const isLowStock = p.stockQuantity <= p.minStockLevel && !isOutOfStock;

                return (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 font-bold">
                          {p.category.charAt(0)}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{p.name}</p>
                          <p className="text-[11px] text-slate-400">{p.category}</p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800">{p.brand}</span>
                      <p className="text-[11px] text-slate-500 font-mono">{p.modelNumber}</p>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      <span>{p.sku}</span>
                      <p className="text-[10px] text-slate-400">{p.barcode}</p>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-600">
                      ₨ {p.purchasePrice.toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      ₨ {p.retailPrice.toLocaleString()}
                    </td>

                    <td className="py-3.5 px-4 text-center font-mono font-bold">
                      <span className={isOutOfStock ? 'text-rose-600' : isLowStock ? 'text-amber-600' : 'text-slate-800'}>
                        {p.stockQuantity}
                      </span>
                      <span className="text-[10px] text-slate-400 block font-normal">Min: {p.minStockLevel}</span>
                    </td>

                    <td className="py-3.5 px-4 text-center">
                      {isOutOfStock ? (
                        <Badge variant="danger" size="sm">Out of Stock</Badge>
                      ) : isLowStock ? (
                        <Badge variant="warning" size="sm">Bajo mínimo</Badge>
                      ) : (
                        <Badge variant="success" size="sm">OK In Stock</Badge>
                      )}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {p.hasSerialTracking && (
                          <button
                            onClick={() => { setSelectedProduct(p); setShowSerialModal(true); }}
                            className="px-2.5 py-1 rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 font-semibold text-[11px] transition"
                            title="View individual Serial / IMEI units"
                          >
                            Serials ({p.serials?.length || 0})
                          </button>
                        )}
                        <button
                          onClick={() => { setSelectedProduct(p); setShowAdjustModal(true); }}
                          className="px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 font-medium text-[11px] transition"
                          title="Stock Adjustment"
                        >
                          Adjust
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Add New Electronics Product</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Product Commercial Title *</label>
                <input
                  type="text"
                  required
                  value={newProdName}
                  onChange={e => setNewProdName(e.target.value)}
                  placeholder="e.g. Dawlance Chrome 91996 Inverter Refrigerator"
                  className="w-full rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Category *</label>
                  <select
                    value={newProdCategory}
                    onChange={e => setNewProdCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5 focus:outline-none focus:border-blue-600"
                  >
                    <option value="Air Conditioners">Air Conditioners</option>
                    <option value="Refrigerators">Refrigerators</option>
                    <option value="LED TVs">LED TVs</option>
                    <option value="Deep Freezers">Deep Freezers</option>
                    <option value="Washing Machines">Washing Machines</option>
                    <option value="Mobiles">Mobiles & Tablets</option>
                    <option value="Laptops">Laptops & Computers</option>
                    <option value="Home Appliances">Home Appliances</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Brand *</label>
                  <input
                    type="text"
                    required
                    value={newProdBrand}
                    onChange={e => setNewProdBrand(e.target.value)}
                    placeholder="Haier, Dawlance, Samsung, Gree..."
                    className="w-full rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Model Number *</label>
                  <input
                    type="text"
                    required
                    value={newProdModel}
                    onChange={e => setNewProdModel(e.target.value)}
                    placeholder="e.g. HSU-18HFT"
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">SKU / Code</label>
                  <input
                    type="text"
                    value={newProdSku}
                    onChange={e => setNewProdSku(e.target.value)}
                    placeholder="e.g. HAE-AC-18"
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Purchase Cost (₨) *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newProdCost || ''}
                    onChange={e => setNewProdCost(Number(e.target.value))}
                    placeholder="120000"
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono font-semibold focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Retail Selling Price (₨) *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newProdRetail || ''}
                    onChange={e => setNewProdRetail(Number(e.target.value))}
                    placeholder="145000"
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono font-semibold focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Opening Stock</label>
                  <input
                    type="number"
                    min={0}
                    value={newProdStock}
                    onChange={e => setNewProdStock(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Min Alert Stock</label>
                  <input
                    type="number"
                    min={1}
                    value={newProdMinStock}
                    onChange={e => setNewProdMinStock(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Warranty (Months)</label>
                  <input
                    type="number"
                    value={newProdWarranty}
                    onChange={e => setNewProdWarranty(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono focus:outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={newProdHasSerial}
                    onChange={e => setNewProdHasSerial(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Track Individual Serial Numbers / IMEIs (Recommended for high-value appliances)</span>
                </label>
              </div>

              <div className="flex gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 font-bold text-white hover:bg-blue-700"
                >
                  Save Product to Catalog
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {showAdjustModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Stock Adjustment: {selectedProduct.name}
            </h3>
            <p className="text-xs text-slate-500">Current Stock: <strong>{selectedProduct.stockQuantity} units</strong></p>

            <form onSubmit={handleSaveAdjustment} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustType('In')}
                  className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition ${
                    adjustType === 'In' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  <ArrowUp className="h-4 w-4" /> Stock In (+)
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType('Out')}
                  className={`py-2 rounded-xl font-bold flex items-center justify-center gap-1.5 transition ${
                    adjustType === 'Out' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  <ArrowDown className="h-4 w-4" /> Stock Out (-)
                </button>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Quantity</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={adjustQty}
                  onChange={e => setAdjustQty(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-sm font-bold focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Reason for Adjustment</label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  placeholder="e.g. Damaged in transit, Display rack movement"
                  className="w-full rounded-xl border border-slate-200 p-2.5 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 font-bold text-white hover:bg-blue-700"
                >
                  Commit Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Serialized Inventory Modal (RainPOS Screenshot style) */}
      {showSerialModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Serialized Inventory — {selectedProduct.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono">Model: {selectedProduct.modelNumber}</p>
              </div>
              <button onClick={() => setShowSerialModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Add new serial unit */}
            <form onSubmit={handleAddSerial} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex gap-2 items-center text-xs">
              <input
                type="text"
                required
                value={newSerialNo}
                onChange={e => setNewSerialNo(e.target.value)}
                placeholder="Enter Serial Number or IMEI..."
                className="flex-1 rounded-lg border border-slate-200 bg-white p-2 font-mono text-xs focus:outline-none focus:border-blue-600"
              />
              <select
                value={newSerialCondition}
                onChange={e => setNewSerialCondition(e.target.value as any)}
                className="rounded-lg border border-slate-200 bg-white p-2 text-xs"
              >
                <option value="Brand New">Brand New</option>
                <option value="Display Unit">Display Unit</option>
                <option value="Open Box">Open Box</option>
              </select>
              <button
                type="submit"
                className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 shrink-0"
              >
                Add Unit
              </button>
            </form>

            {/* Serials List */}
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Tracked Units ({selectedProduct.serials?.length || 0})
              </p>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
                {(!selectedProduct.serials || selectedProduct.serials.length === 0) ? (
                  <p className="p-6 text-center text-slate-400">No individual serials registered yet for this model.</p>
                ) : (
                  selectedProduct.serials.map(s => (
                    <div key={s.serialNumber} className="p-3 flex items-center justify-between hover:bg-slate-50/50">
                      <div>
                        <span className="font-mono font-bold text-blue-700 text-sm">{s.serialNumber}</span>
                        <p className="text-[11px] text-slate-400">
                          Condition: {s.condition} • Cost: ₨ {s.purchaseCost?.toLocaleString()} • Warranty: {s.warrantyMonths}m
                        </p>
                      </div>

                      <div className="text-right">
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                          s.status === 'In Stock'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : s.status === 'Reserved'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {s.status}
                        </span>
                        {s.saleInvoiceNo && (
                          <p className="text-[10px] text-slate-400 mt-1 font-mono">Sold on #{s.saleInvoiceNo}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
