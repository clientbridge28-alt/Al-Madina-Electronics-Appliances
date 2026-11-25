import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus, Search, X, ArrowDown, ArrowUp,
  FileSpreadsheet, Upload, Globe, RefreshCw, History,
  ArrowLeftRight, Warehouse as WarehouseIcon, Edit3, AlertTriangle
} from 'lucide-react';
import {
  getProducts,
  saveProduct,
  adjustProductStock,
  getItemStockLedger,
  getWarehouses,
  saveWarehouse,
  getStockTransfers,
  createStockTransfer,
  getStockAdjustments,
  subscribeToDatabase,
} from '../../services/storage';
import { Product, SerialUnit, StockAdjustmentRecord, Warehouse } from '../../types/erp';
import { Badge } from '../common/Badge';
import {
  exportProductsToExcel,
  downloadProductImportTemplate,
  processProductExcelBuffer,
} from '../../services/excelService';
import { ExcelImportModal } from '../common/ExcelImportModal';
import { syncProductToWooCommerce } from '../../services/wordpressService';
import { useAuth } from '../../context/AuthContext';

export const InventoryView: React.FC = () => {
  const { isOwner } = useAuth();
  const [, setDbTick] = useState(0);
  useEffect(() => subscribeToDatabase(() => setDbTick(t => t + 1)), []);

  const products = getProducts();
  const warehouses = getWarehouses();
  const stockTransfers = getStockTransfers();
  const stockAdjustments = getStockAdjustments();

  const [activeTab, setActiveTab] = useState<'Catalog' | 'Transfers' | 'Adjustments'>('Catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedBrand, setSelectedBrand] = useState('All');
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showSerialModal, setShowSerialModal] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [syncingWoo, setSyncingWoo] = useState(false);

  // Product form fields (Add / Edit)
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('Air Conditioners');
  const [newProdBrand, setNewProdBrand] = useState('Dawlance');
  const [newProdModel, setNewProdModel] = useState('');
  const [newProdSku, setNewProdSku] = useState('');
  const [newProdBarcode, setNewProdBarcode] = useState('');
  const [newProdCost, setNewProdCost] = useState<number>(0);
  const [newProdWholesale, setNewProdWholesale] = useState<number>(0);
  const [newProdRetail, setNewProdRetail] = useState<number>(0);
  const [newProdOpeningStock, setNewProdOpeningStock] = useState<number>(0);
  const [newProdStock, setNewProdStock] = useState<number>(10);
  const [newProdMinStock, setNewProdMinStock] = useState<number>(3);
  const [newProdReorderLevel, setNewProdReorderLevel] = useState<number>(5);
  const [newProdWarranty, setNewProdWarranty] = useState<number>(12);
  const [newProdWarehouseId, setNewProdWarehouseId] = useState<string>(warehouses[0]?.id || 'WH-MAIN');
  const [newProdEngineNo, setNewProdEngineNo] = useState('');
  const [newProdChassisNo, setNewProdChassisNo] = useState('');
  const [newProdHasSerial, setNewProdHasSerial] = useState(true);

  // Stock Adjustment form
  const [adjustQty, setAdjustQty] = useState<number>(1);
  const [adjustType, setAdjustType] = useState<'In' | 'Out'>('In');
  const [adjustmentCategory, setAdjustmentCategory] = useState<StockAdjustmentRecord['adjustmentType']>('Adjustment');
  const [adjustReason, setAdjustReason] = useState('Physical stock count audit');
  const [allowNegativeOverride, setAllowNegativeOverride] = useState(false);

  // Stock Transfer form
  const [transferProductId, setTransferProductId] = useState('');
  const [transferFromWh, setTransferFromWh] = useState(warehouses[0]?.id || 'WH-MAIN');
  const [transferToWh, setTransferToWh] = useState(warehouses[1]?.id || warehouses[0]?.id || '');
  const [transferQty, setTransferQty] = useState<number>(1);
  const [transferNotes, setTransferNotes] = useState('');

  // Warehouse form
  const [whName, setWhName] = useState('');
  const [whCode, setWhCode] = useState('');
  const [whLocation, setWhLocation] = useState('');

  // Serial Unit Add form
  const [newSerialNo, setNewSerialNo] = useState('');
  const [newSerialCondition, setNewSerialCondition] = useState<'Brand New' | 'Display Unit' | 'Open Box'>('Brand New');

  const categories = useMemo(() => ['All', ...Array.from(new Set(products.map(p => p.category)))], [products]);
  const brands = useMemo(() => ['All', ...Array.from(new Set(products.map(p => p.brand)))], [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
      const matchBrand = selectedBrand === 'All' || p.brand === selectedBrand;
      const matchLow = !onlyLowStock || p.stockQuantity <= (p.reorderLevel ?? p.minStockLevel);
      const q = searchQuery.toLowerCase();
      const matchQuery =
        !q ||
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.modelNumber.toLowerCase().includes(q) ||
        p.barcode.includes(q) ||
        (p.engineNumber || '').toLowerCase().includes(q) ||
        (p.chassisNumber || '').toLowerCase().includes(q);
      return matchCat && matchBrand && matchLow && matchQuery;
    });
  }, [products, selectedCategory, selectedBrand, onlyLowStock, searchQuery]);

  const totalValuation = useMemo(
    () => products.reduce((sum, p) => sum + p.purchasePrice * p.stockQuantity, 0),
    [products]
  );
  const lowStockCount = useMemo(
    () => products.filter(p => p.stockQuantity <= (p.reorderLevel ?? p.minStockLevel)).length,
    [products]
  );

  const openAddProductModal = () => {
    setEditingProduct(null);
    setModalError(null);
    setNewProdName('');
    setNewProdCategory('Air Conditioners');
    setNewProdBrand('Dawlance');
    setNewProdModel('');
    setNewProdSku('');
    setNewProdBarcode('');
    setNewProdCost(0);
    setNewProdWholesale(0);
    setNewProdRetail(0);
    setNewProdOpeningStock(0);
    setNewProdStock(10);
    setNewProdMinStock(3);
    setNewProdReorderLevel(5);
    setNewProdWarranty(12);
    setNewProdWarehouseId(warehouses[0]?.id || 'WH-MAIN');
    setNewProdEngineNo('');
    setNewProdChassisNo('');
    setNewProdHasSerial(true);
    setShowAddModal(true);
  };

  const openEditProductModal = (prod: Product) => {
    setEditingProduct(prod);
    setModalError(null);
    setNewProdName(prod.name);
    setNewProdCategory(prod.category);
    setNewProdBrand(prod.brand);
    setNewProdModel(prod.modelNumber);
    setNewProdSku(prod.sku);
    setNewProdBarcode(prod.barcode);
    setNewProdCost(prod.purchasePrice);
    setNewProdWholesale(prod.wholesalePrice || 0);
    setNewProdRetail(prod.retailPrice);
    setNewProdOpeningStock(prod.openingStock || 0);
    setNewProdStock(prod.stockQuantity);
    setNewProdMinStock(prod.minStockLevel);
    setNewProdReorderLevel(prod.reorderLevel ?? prod.minStockLevel);
    setNewProdWarranty(prod.warrantyMonths);
    setNewProdWarehouseId(prod.warehouseId || warehouses[0]?.id || 'WH-MAIN');
    setNewProdEngineNo(prod.engineNumber || '');
    setNewProdChassisNo(prod.chassisNumber || '');
    setNewProdHasSerial(prod.hasSerialTracking);
    setShowAddModal(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    const chosenWh = warehouses.find(w => w.id === newProdWarehouseId);
    const payload: Product = {
      ...(editingProduct || {}),
      id: editingProduct ? editingProduct.id : `PROD-${Date.now().toString().slice(-4)}`,
      name: newProdName.trim(),
      category: newProdCategory,
      brand: newProdBrand.trim(),
      modelNumber: newProdModel.trim(),
      sku: newProdSku.trim() || `SKU-${Date.now().toString().slice(-4)}`,
      barcode: newProdBarcode.trim() || `${Math.floor(100000000000 + Math.random() * 900000000000)}`,
      unit: editingProduct?.unit || 'Unit',
      purchasePrice: newProdCost,
      wholesalePrice: newProdWholesale > 0 ? newProdWholesale : undefined,
      retailPrice: newProdRetail,
      minSalePrice: editingProduct?.minSalePrice || Math.round(newProdCost * 1.05),
      openingStock: newProdOpeningStock,
      stockQuantity: newProdStock,
      minStockLevel: newProdMinStock,
      reorderLevel: newProdReorderLevel,
      warrantyMonths: newProdWarranty,
      warehouseId: chosenWh?.id || newProdWarehouseId || undefined,
      warehouseName: chosenWh?.name || editingProduct?.warehouseName || 'Main Showroom',
      engineNumber: newProdEngineNo.trim() || undefined,
      chassisNumber: newProdChassisNo.trim() || undefined,
      hasSerialTracking: newProdHasSerial,
      serials: editingProduct?.serials || [],
    };

    try {
      saveProduct(payload);
      setShowAddModal(false);
      setSyncNotice(`${editingProduct ? 'Updated' : 'Added'} product "${payload.name}" cleanly.`);
    } catch (err: any) {
      setModalError(err?.message || 'Could not save product.');
    }
  };

  const handleSaveAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setModalError(null);
    const finalDelta = adjustType === 'In' ? adjustQty : -adjustQty;
    try {
      adjustProductStock(selectedProduct.id, finalDelta, adjustReason, {
        adjustmentType: adjustmentCategory,
        allowNegativeStock: isOwner && allowNegativeOverride,
      });
      setShowAdjustModal(false);
      setAllowNegativeOverride(false);
      setSyncNotice(`Stock adjusted for ${selectedProduct.name} (${adjustmentCategory}).`);
    } catch (err: any) {
      setModalError(err?.message || 'Stock adjustment failed.');
    }
  };

  const handleSaveTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);
    const fromWh = warehouses.find(w => w.id === transferFromWh);
    const toWh = warehouses.find(w => w.id === transferToWh);
    const prod = products.find(p => p.id === transferProductId);
    if (!prod || !fromWh || !toWh) {
      setModalError('Select a product, source warehouse, and destination warehouse.');
      return;
    }

    try {
      const trf = createStockTransfer({
        transferNumber: `STRF-${Date.now().toString().slice(-5)}`,
        date: new Date().toISOString().split('T')[0],
        productId: prod.id,
        productName: prod.name,
        fromWarehouseId: fromWh.id,
        fromWarehouseName: fromWh.name,
        toWarehouseId: toWh.id,
        toWarehouseName: toWh.name,
        quantity: transferQty,
        notes: transferNotes,
      });
      setShowTransferModal(false);
      setTransferNotes('');
      setActiveTab('Transfers');
      setSyncNotice(`Transfer #${trf.transferNumber} completed (${trf.quantity} units moved).`);
    } catch (err: any) {
      setModalError(err?.message || 'Stock transfer failed.');
    }
  };

  const handleSaveWarehouse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!whName.trim() || !whCode.trim()) return;
    const saved: Warehouse = saveWarehouse({
      id: `WH-${whCode.trim().toUpperCase()}`,
      name: whName.trim(),
      code: whCode.trim().toUpperCase(),
      city: whLocation.trim() || 'Lahore',
      address: whLocation.trim() || 'Showroom Branch',
      isDefault: warehouses.length === 0,
      active: true,
    });
    setWhName('');
    setWhCode('');
    setWhLocation('');
    setSyncNotice(`Warehouse "${saved.name}" saved.`);
  };

  const handleAddSerial = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newSerialNo.trim();
    if (!selectedProduct || !trimmed) return;

    const existingSerial = (selectedProduct.serials || []).some(
      s => s.serialNumber.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (existingSerial) {
      setSyncNotice(`Duplicate serial number "${trimmed}" already registered for ${selectedProduct.name}.`);
      return;
    }

    const unit: SerialUnit = {
      serialNumber: trimmed,
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      condition: newSerialCondition,
      purchaseCost: selectedProduct.purchasePrice,
      purchaseDate: new Date().toISOString().split('T')[0],
      status: 'In Stock',
      warrantyMonths: selectedProduct.warrantyMonths,
    };

    const updatedSerials = [...(selectedProduct.serials || []), unit];
    const updatedProduct: Product = {
      ...selectedProduct,
      serials: updatedSerials,
      stockQuantity: updatedSerials.filter(s => s.status === 'In Stock').length,
    };

    saveProduct(updatedProduct);
    setSelectedProduct(updatedProduct);
    setNewSerialNo('');
  };

  const handleSyncToWooCommerce = async () => {
    setSyncingWoo(true);
    setSyncNotice('Syncing showroom catalog via secure server-side WooCommerce proxy...');
    try {
      let synced = 0;
      let lastError = '';
      for (const p of filteredProducts.slice(0, 10)) {
        const res = await syncProductToWooCommerce(p);
        if (res.success) synced++;
        else lastError = res.message;
      }
      if (synced > 0) {
        setSyncNotice(`Successfully synchronized ${synced} products with online WooCommerce store.`);
      } else {
        setSyncNotice(
          `WooCommerce Sync skipped/failed: ${lastError || 'Configure WordPress / WooCommerce in Settings first.'}`
        );
      }
    } catch (err: any) {
      setSyncNotice(`WooCommerce Sync: ${err.message}`);
    } finally {
      setSyncingWoo(false);
      setTimeout(() => setSyncNotice(null), 6000);
    }
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
            Showroom appliances, warehouses, stock transfers, damaged stock & serial tracking
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2 shrink-0">
          <button
            onClick={() => {
              setModalError(null);
              setShowWarehouseModal(true);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 shadow-2xs transition whitespace-nowrap shrink-0"
          >
            <WarehouseIcon className="h-4 w-4 text-slate-600" />
            <span>Warehouses ({warehouses.length})</span>
          </button>

          <button
            onClick={() => {
              setModalError(null);
              setTransferProductId(products[0]?.id || '');
              setTransferFromWh(warehouses[0]?.id || '');
              setTransferToWh(warehouses[1]?.id || warehouses[0]?.id || '');
              setShowTransferModal(true);
            }}
            className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 px-3 py-2.5 text-xs font-bold text-indigo-800 shadow-2xs transition whitespace-nowrap shrink-0"
          >
            <ArrowLeftRight className="h-4 w-4 text-indigo-600" />
            <span>Transfer Stock</span>
          </button>

          <button
            onClick={() => exportProductsToExcel(filteredProducts)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 shadow-2xs transition whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100/80 px-3 py-2.5 text-xs font-bold text-emerald-800 shadow-2xs transition whitespace-nowrap shrink-0"
          >
            <Upload className="h-4 w-4 text-emerald-700" />
            <span>Import Excel</span>
          </button>

          <button
            onClick={handleSyncToWooCommerce}
            disabled={syncingWoo}
            className="flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100/80 px-3 py-2.5 text-xs font-bold text-purple-700 shadow-2xs transition disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Globe className="h-4 w-4 text-purple-600" />
            <span>{syncingWoo ? 'Syncing...' : 'Sync WooCommerce'}</span>
          </button>

          <button
            onClick={openAddProductModal}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Product</span>
          </button>
        </div>
      </div>

      {syncNotice && (
        <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs font-semibold flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            {syncingWoo ? <RefreshCw className="h-4 w-4 animate-spin text-blue-600" /> : <Globe className="h-4 w-4 text-blue-600" />}
            <span>{syncNotice}</span>
          </div>
          <button onClick={() => setSyncNotice(null)} className="text-blue-400 hover:text-blue-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Catalog Products</span>
          <p className="text-2xl font-black text-slate-900 font-mono mt-1">{products.length}</p>
          <p className="text-xs text-slate-400 mt-0.5">Active models across {warehouses.length} warehouse(s)</p>
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

      {/* Sub-view Tabs */}
      <div className="flex items-center gap-2">
        {(['Catalog', 'Transfers', 'Adjustments'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 ${
              activeTab === tab
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            {tab === 'Catalog'
              ? `Product Catalog (${products.length})`
              : tab === 'Transfers'
              ? `Warehouse Transfers (${stockTransfers.length})`
              : `Adjustments & Damaged (${stockAdjustments.length})`}
          </button>
        ))}
      </div>

      {activeTab === 'Catalog' && (
        <>
          {/* Filter & Search Bar */}
          <div className="rounded-2xl bg-white p-4 border border-slate-200 shadow-2xs space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="relative sm:col-span-2">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by name, SKU, model, barcode, engine/chassis..."
                  className="w-full rounded-xl border border-slate-200 pl-10 pr-3.5 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-blue-600"
                >
                  <option value="All">All Categories</option>
                  {categories.filter(c => c !== 'All').map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={selectedBrand}
                  onChange={e => setSelectedBrand(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-blue-600"
                >
                  <option value="All">All Brands</option>
                  {brands.filter(b => b !== 'All').map(b => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            </div>

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

          {/* Products Table */}
          <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Product Details</th>
                    <th className="py-3 px-4">Brand & Warehouse</th>
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
                    const threshold = p.reorderLevel ?? p.minStockLevel;
                    const isLowStock = p.stockQuantity <= threshold && !isOutOfStock;

                    return (
                      <tr key={p.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0 font-bold">
                              {p.category.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{p.name}</p>
                              <p className="text-[11px] text-slate-400">
                                {p.category}
                                {p.damagedQuantity ? ` • ${p.damagedQuantity} Damaged` : ''}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          <span className="font-semibold text-slate-800">{p.brand}</span>
                          <p className="text-[11px] text-slate-500 font-mono">
                            {p.modelNumber} • {p.warehouseName || 'Main Showroom'}
                          </p>
                        </td>

                        <td className="py-3.5 px-4 font-mono text-slate-600">
                          <span>{p.sku}</span>
                          <p className="text-[10px] text-slate-400">{p.barcode}</p>
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono tabular-nums font-medium text-slate-600">
                          ₨ {p.purchasePrice.toLocaleString()}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                          ₨ {p.retailPrice.toLocaleString()}
                        </td>

                        <td className="py-3.5 px-4 text-center font-mono tabular-nums font-bold">
                          <span className={isOutOfStock ? 'text-rose-600' : isLowStock ? 'text-amber-600' : 'text-slate-800'}>
                            {p.stockQuantity}
                          </span>
                          <span className="text-[10px] text-slate-400 block font-normal">Reorder: {threshold}</span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          {isOutOfStock ? (
                            <Badge variant="danger" size="sm">
                              Out of Stock
                            </Badge>
                          ) : isLowStock ? (
                            <Badge variant="warning" size="sm">
                              Low Stock
                            </Badge>
                          ) : (
                            <Badge variant="success" size="sm">
                              In Stock
                            </Badge>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openEditProductModal(p)}
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 transition"
                              title="Edit Product Details"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedProduct(p);
                                setShowLedgerModal(true);
                              }}
                              className="px-2.5 py-1 rounded-lg border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 font-semibold text-[11px] inline-flex items-center gap-1 transition"
                              title="View Item Stock Movement Ledger"
                            >
                              <History className="h-3 w-3" />
                              <span>Ledger</span>
                            </button>
                            {p.hasSerialTracking && (
                              <button
                                onClick={() => {
                                  setSelectedProduct(p);
                                  setShowSerialModal(true);
                                }}
                                className="px-2.5 py-1 rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 font-semibold text-[11px] transition"
                              >
                                Serials ({p.serials?.length || 0})
                              </button>
                            )}
                            <button
                              onClick={() => {
                                setSelectedProduct(p);
                                setModalError(null);
                                setAdjustmentCategory('Adjustment');
                                setAdjustType('In');
                                setAllowNegativeOverride(false);
                                setShowAdjustModal(true);
                              }}
                              className="px-2 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 font-medium text-[11px] transition"
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
        </>
      )}

      {activeTab === 'Transfers' && (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Transfer #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">From Warehouse</th>
                  <th className="py-3 px-4">To Warehouse</th>
                  <th className="py-3 px-4 text-right">Qty</th>
                  <th className="py-3 px-4">Transferred By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stockTransfers.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-mono font-bold text-indigo-700">{t.transferNumber}</td>
                    <td className="py-3 px-4 font-mono text-slate-500">{t.date}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{t.productName}</td>
                    <td className="py-3 px-4 text-slate-600">{t.fromWarehouseName}</td>
                    <td className="py-3 px-4 text-slate-800 font-medium">{t.toWarehouseName}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{t.quantity}</td>
                    <td className="py-3 px-4 text-slate-500">{t.transferredBy}</td>
                  </tr>
                ))}
                {stockTransfers.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No warehouse stock transfers recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'Adjustments' && (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Previous</th>
                  <th className="py-3 px-4 text-right">Delta</th>
                  <th className="py-3 px-4 text-right">New Qty</th>
                  <th className="py-3 px-4">Reason & Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stockAdjustments.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-mono text-slate-500">{a.date}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{a.productName}</td>
                    <td className="py-3 px-4">
                      <Badge variant={a.adjustmentType === 'Damaged' ? 'danger' : 'neutral'} size="sm">
                        {a.adjustmentType}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-500">{a.previousQty}</td>
                    <td
                      className={`py-3 px-4 text-right font-mono font-bold ${
                        a.adjustmentQty >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {a.adjustmentQty >= 0 ? `+${a.adjustmentQty}` : a.adjustmentQty}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">{a.newQty}</td>
                    <td className="py-3 px-4 text-slate-600">
                      {a.reason} <span className="text-slate-400">({a.adjustedBy})</span>
                    </td>
                  </tr>
                ))}
                {stockAdjustments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400">
                      No stock adjustments or damaged-stock entries recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">
                {editingProduct ? `Edit Product — ${editingProduct.name}` : 'Add New Electronics Product'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Category *</label>
                  <select
                    value={newProdCategory}
                    onChange={e => setNewProdCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5"
                  >
                    <option value="Air Conditioners">Air Conditioners</option>
                    <option value="Refrigerators">Refrigerators</option>
                    <option value="LED TVs">LED TVs</option>
                    <option value="Deep Freezers">Deep Freezers</option>
                    <option value="Washing Machines">Washing Machines</option>
                    <option value="Mobiles">Mobiles & Tablets</option>
                    <option value="Laptops">Laptops & Computers</option>
                    <option value="Motorcycles">Motorcycles</option>
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
                    placeholder="Haier, Dawlance, Samsung..."
                    className="w-full rounded-xl border border-slate-200 p-2.5"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-medium mb-1">Warehouse / Branch</label>
                  <select
                    value={newProdWarehouseId}
                    onChange={e => setNewProdWarehouseId(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5"
                  >
                    <option value="">{warehouses.length === 0 ? 'Default Showroom' : 'Select Warehouse...'}</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Model Number *</label>
                  <input
                    type="text"
                    required
                    value={newProdModel}
                    onChange={e => setNewProdModel(e.target.value)}
                    placeholder="e.g. HSU-18HFT"
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">SKU / Code</label>
                  <input
                    type="text"
                    value={newProdSku}
                    onChange={e => setNewProdSku(e.target.value)}
                    placeholder="e.g. HAE-AC-18"
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Barcode</label>
                  <input
                    type="text"
                    value={newProdBarcode}
                    onChange={e => setNewProdBarcode(e.target.value)}
                    placeholder="Auto-generated if blank"
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Purchase Cost (₨) *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newProdCost || ''}
                    onChange={e => setNewProdCost(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Wholesale Price (₨)</label>
                  <input
                    type="number"
                    min={0}
                    value={newProdWholesale || ''}
                    onChange={e => setNewProdWholesale(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono font-semibold"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Retail Price (₨) *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newProdRetail || ''}
                    onChange={e => setNewProdRetail(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono font-semibold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Opening Stock</label>
                  <input
                    type="number"
                    min={0}
                    value={newProdOpeningStock}
                    onChange={e => setNewProdOpeningStock(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Current Stock</label>
                  <input
                    type="number"
                    min={0}
                    value={newProdStock}
                    onChange={e => setNewProdStock(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Reorder Level</label>
                  <input
                    type="number"
                    min={0}
                    value={newProdReorderLevel}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setNewProdReorderLevel(val);
                      setNewProdMinStock(val);
                    }}
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Warranty (Mo)</label>
                  <input
                    type="number"
                    min={0}
                    value={newProdWarranty}
                    onChange={e => setNewProdWarranty(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Engine Number (Optional)</label>
                  <input
                    type="text"
                    value={newProdEngineNo}
                    onChange={e => setNewProdEngineNo(e.target.value)}
                    placeholder="For vehicles/generators"
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Chassis Number (Optional)</label>
                  <input
                    type="text"
                    value={newProdChassisNo}
                    onChange={e => setNewProdChassisNo(e.target.value)}
                    placeholder="For vehicles/generators"
                    className="w-full rounded-xl border border-slate-200 p-2.5 font-mono"
                  />
                </div>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={newProdHasSerial}
                    onChange={e => setNewProdHasSerial(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span>Track Individual Serial Numbers / IMEIs</span>
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
                <button type="submit" className="flex-1 rounded-xl bg-blue-600 py-2.5 font-bold text-white hover:bg-blue-700">
                  {editingProduct ? 'Save Product Updates' : 'Save Product to Catalog'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Adjustment & Damaged Stock Modal */}
      {showAdjustModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Stock Adjustment: {selectedProduct.name}</h3>
              <button onClick={() => setShowAdjustModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              Current Stock: <strong>{selectedProduct.stockQuantity} units</strong>
            </p>

            {modalError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveAdjustment} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Adjustment Classification</label>
                <select
                  value={adjustmentCategory}
                  onChange={e => {
                    const val = e.target.value as StockAdjustmentRecord['adjustmentType'];
                    setAdjustmentCategory(val);
                    if (val === 'Damaged') setAdjustType('Out');
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 font-medium"
                >
                  <option value="Adjustment">Manual Adjustment</option>
                  <option value="Damaged">Damaged / Defective Stock</option>
                  <option value="CountCorrection">Physical Count Audit Correction</option>
                  <option value="Opening">Opening Stock Entry</option>
                </select>
              </div>

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
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-sm font-bold"
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
                  className="w-full rounded-xl border border-slate-200 p-2.5"
                />
              </div>

              {isOwner && adjustType === 'Out' && (
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 cursor-pointer font-semibold">
                  <input
                    type="checkbox"
                    checked={allowNegativeOverride}
                    onChange={e => setAllowNegativeOverride(e.target.checked)}
                    className="rounded text-amber-600"
                  />
                  <span>Owner Override: Allow Negative Stock Balance</span>
                </label>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 rounded-xl bg-blue-600 py-2.5 font-bold text-white hover:bg-blue-700">
                  Commit Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Warehouse Stock Transfer</h3>
              <button onClick={() => setShowTransferModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            {modalError && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}
            <form onSubmit={handleSaveTransfer} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Product *</label>
                <select
                  required
                  value={transferProductId}
                  onChange={e => setTransferProductId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5"
                >
                  <option value="">Select Product...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Avail: {p.stockQuantity})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">From Warehouse *</label>
                  <select
                    required
                    value={transferFromWh}
                    onChange={e => setTransferFromWh(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5"
                  >
                    <option value="">{warehouses.length === 0 ? 'No warehouses found' : 'Select Source...'}</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">To Warehouse *</label>
                  <select
                    required
                    value={transferToWh}
                    onChange={e => setTransferToWh(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5"
                  >
                    <option value="">{warehouses.length === 0 ? 'No warehouses found' : 'Select Destination...'}</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Quantity *</label>
                <input
                  type="number"
                  min={1}
                  required
                  value={transferQty}
                  onChange={e => setTransferQty(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={transferNotes}
                  onChange={e => setTransferNotes(e.target.value)}
                  placeholder="Challan or vehicle reference"
                  className="w-full rounded-xl border border-slate-200 p-2.5"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTransferModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 font-medium text-slate-600"
                >
                  Cancel
                </button>
                <button type="submit" className="flex-1 rounded-xl bg-blue-600 py-2.5 font-bold text-white hover:bg-blue-700">
                  Complete Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Warehouses Manager Modal */}
      {showWarehouseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900">Showroom Warehouses & Branches</h3>
              <button onClick={() => setShowWarehouseModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl max-h-48 overflow-y-auto text-xs">
              {warehouses.map(w => (
                <div key={w.id} className="p-3 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{w.name}</p>
                    <p className="text-[11px] text-slate-500">
                      Code: <span className="font-mono">{w.code}</span> • {w.address || w.city || 'Main Branch'}
                    </p>
                  </div>
                  {w.isDefault && <Badge variant="success" size="sm">Default</Badge>}
                </div>
              ))}
            </div>

            <form onSubmit={handleSaveWarehouse} className="space-y-3 text-xs pt-2 border-t border-slate-100">
              <p className="font-bold text-slate-700">Add New Warehouse / Godown</p>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  required
                  placeholder="Code (e.g. GDN1)"
                  value={whCode}
                  onChange={e => setWhCode(e.target.value)}
                  className="rounded-xl border border-slate-200 p-2 font-mono"
                />
                <input
                  type="text"
                  required
                  placeholder="Warehouse Name"
                  value={whName}
                  onChange={e => setWhName(e.target.value)}
                  className="col-span-2 rounded-xl border border-slate-200 p-2"
                />
              </div>
              <input
                type="text"
                placeholder="City / Address Location"
                value={whLocation}
                onChange={e => setWhLocation(e.target.value)}
                className="w-full rounded-xl border border-slate-200 p-2"
              />
              <button type="submit" className="w-full rounded-xl bg-blue-600 py-2 font-bold text-white hover:bg-blue-700">
                Save Warehouse
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Serialized Inventory Modal */}
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

            <form onSubmit={handleAddSerial} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex gap-2 items-center text-xs">
              <input
                type="text"
                required
                value={newSerialNo}
                onChange={e => setNewSerialNo(e.target.value)}
                placeholder="Enter Serial Number or IMEI..."
                className="flex-1 rounded-lg border border-slate-200 bg-white p-2 font-mono text-xs"
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
              <button type="submit" className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 shrink-0">
                Add Unit
              </button>
            </form>

            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Tracked Units ({selectedProduct.serials?.length || 0})
              </p>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden text-xs">
                {!selectedProduct.serials || selectedProduct.serials.length === 0 ? (
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
                        <span
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                            s.status === 'In Stock'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : s.status === 'Reserved'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
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

      {/* Item Stock Ledger Modal */}
      {showLedgerModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Item Stock Ledger — {selectedProduct.name}</h3>
                <p className="text-xs text-slate-500 font-mono">
                  SKU: {selectedProduct.sku} • Current Physical Stock: {selectedProduct.stockQuantity} units
                </p>
              </div>
              <button onClick={() => setShowLedgerModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            {(() => {
              const rows = getItemStockLedger(selectedProduct.id);
              return (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Ref #</th>
                        <th className="p-3">Movement</th>
                        <th className="p-3">Party</th>
                        <th className="p-3 text-right">In</th>
                        <th className="p-3 text-right">Out</th>
                        <th className="p-3 text-right">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-mono">
                      {rows.map(r => (
                        <tr key={r.id} className="hover:bg-slate-50/70">
                          <td className="p-3 font-sans text-slate-600">{r.date}</td>
                          <td className="p-3 font-bold text-blue-700">{r.refNo}</td>
                          <td className="p-3 font-sans font-semibold">{r.type}</td>
                          <td className="p-3 font-sans text-slate-700">{r.party}</td>
                          <td className="p-3 text-right text-emerald-700">{r.qtyIn > 0 ? `+${r.qtyIn}` : '—'}</td>
                          <td className="p-3 text-right text-rose-700">{r.qtyOut > 0 ? `-${r.qtyOut}` : '—'}</td>
                          <td className="p-3 text-right font-bold text-slate-900">{r.runningQty}</td>
                        </tr>
                      ))}
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-6 text-center font-sans text-slate-400">
                            No stock movements recorded for this item yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Excel Import Modal */}
      <ExcelImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        entityName="Products & Appliances"
        onDownloadTemplate={downloadProductImportTemplate}
        onProcessFile={processProductExcelBuffer}
        onCommitImport={(validRows: Product[]) => {
          validRows.forEach(p => saveProduct(p));
        }}
      />
    </div>
  );
};
