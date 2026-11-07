import React, { useState, useEffect, useRef } from 'react';
import { 
  Package, AlertTriangle, ArrowRight, PlusCircle, 
  CheckCircle2, X, RefreshCw, ShoppingCart, ShieldCheck
} from 'lucide-react';
import { getProducts, subscribeToDatabase } from '../../services/storage';
import { Product } from '../../types/erp';

interface InventoryAlertNotificationProps {
  onNavigate: (module: string) => void;
}

export const InventoryAlertNotification: React.FC<InventoryAlertNotificationProps> = ({ onNavigate }) => {
  const [products, setProducts] = useState<Product[]>(getProducts());
  const [isOpen, setIsOpen] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'out_of_stock' | 'low_stock'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Subscribe to live database updates (e.g. sales, stock adjustments, purchase intakes)
  useEffect(() => {
    const unsubscribe = subscribeToDatabase(() => {
      setProducts(getProducts());
    });
    return unsubscribe;
  }, []);

  // Handle outside click to close dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Items fallen below their reorder threshold (stockQuantity <= minStockLevel)
  const lowStockItems = products.filter(p => p.stockQuantity <= p.minStockLevel);
  const outOfStockCount = lowStockItems.filter(p => p.stockQuantity <= 0).length;
  const criticalCount = lowStockItems.length;

  // Filtered list based on popover tabs
  const displayedItems = lowStockItems.filter(p => {
    if (filterType === 'out_of_stock') return p.stockQuantity <= 0;
    if (filterType === 'low_stock') return p.stockQuantity > 0;
    return true;
  });

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button with Red Badge Count */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`relative flex items-center justify-center p-2 rounded-xl transition cursor-pointer ${
          criticalCount > 0
            ? 'bg-rose-50/80 hover:bg-rose-100/80 text-rose-700 border border-rose-200/80'
            : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 border border-transparent'
        }`}
        title={`Inventory Alert Monitor: ${criticalCount} item(s) below reorder threshold`}
        aria-label="Inventory Reorder Threshold Alerts"
      >
        <Package className="h-5 w-5" />

        {/* Prominent Red Badge Count for items below threshold */}
        {criticalCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 min-w-5 px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white ring-2 ring-white shadow-xs animate-in zoom-in-50 duration-200">
            {criticalCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] rounded-2xl bg-white shadow-2xl ring-1 ring-slate-900/10 border border-slate-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-rose-50/90 via-slate-50 to-white border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-700 font-bold shadow-2xs">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Inventory Reorder Monitor
                  </h3>
                  {criticalCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-600 text-white">
                      {criticalCount} Low
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Items at or below showroom safety reorder threshold
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Sub-header Filter Tabs */}
          {criticalCount > 0 && (
            <div className="flex items-center gap-1.5 p-2.5 bg-slate-50/70 border-b border-slate-100 text-[11px] font-semibold">
              <button
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  filterType === 'all'
                    ? 'bg-white text-slate-900 shadow-2xs font-bold border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                All Threshold Alerts ({criticalCount})
              </button>
              {outOfStockCount > 0 && (
                <button
                  onClick={() => setFilterType('out_of_stock')}
                  className={`px-2.5 py-1 rounded-lg transition ${
                    filterType === 'out_of_stock'
                      ? 'bg-rose-600 text-white shadow-2xs font-bold'
                      : 'text-rose-700 hover:bg-rose-100/50'
                  }`}
                >
                  Out of Stock ({outOfStockCount})
                </button>
              )}
              <button
                onClick={() => setFilterType('low_stock')}
                className={`px-2.5 py-1 rounded-lg transition ${
                  filterType === 'low_stock'
                    ? 'bg-amber-500 text-white shadow-2xs font-bold'
                    : 'text-amber-800 hover:bg-amber-100/50'
                }`}
              >
                Low Units ({criticalCount - outOfStockCount})
              </button>
            </div>
          )}

          {/* List of items */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 text-xs">
            {displayedItems.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <p className="font-bold text-slate-800 text-xs">All Inventory Levels Healthy</p>
                <p className="text-[11px] text-slate-500">
                  No stock items currently fall below their configured minimum threshold.
                </p>
              </div>
            ) : (
              displayedItems.map(item => {
                const isZero = item.stockQuantity <= 0;
                const deficit = Math.max(0, item.minStockLevel - item.stockQuantity);

                return (
                  <div
                    key={item.id}
                    className="p-3.5 hover:bg-slate-50 transition flex items-start justify-between gap-3 group"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 truncate">
                          {item.name}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {item.sku}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span>{item.brand}</span>
                        <span>•</span>
                        <span>{item.category}</span>
                      </div>

                      <div className="flex items-center gap-2 pt-0.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          isZero
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {isZero ? 'Out of Stock (0 pcs)' : `Only ${item.stockQuantity} ${item.unit || 'pcs'} left`}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          Min Level: {item.minStockLevel} (Deficit: {deficit})
                        </span>
                      </div>
                    </div>

                    {/* Quick Restock Action */}
                    <div className="shrink-0 flex flex-col items-end gap-1.5">
                      <span className="text-[10px] font-mono text-slate-500 font-medium">
                        ₨ {item.retailPrice.toLocaleString()}
                      </span>
                      <button
                        onClick={() => {
                          onNavigate('purchases');
                          setIsOpen(false);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white font-bold text-[10px] transition active:scale-95 shadow-2xs"
                        title="Order new stock from supplier"
                      >
                        <PlusCircle className="h-3 w-3" />
                        <span>Order</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Actions */}
          <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs">
            <button
              onClick={() => {
                onNavigate('inventory');
                setIsOpen(false);
              }}
              className="text-blue-600 font-bold hover:underline flex items-center gap-1 text-[11px]"
            >
              <span>Manage Inventory & Serials</span>
              <ArrowRight className="h-3 w-3" />
            </button>
            <button
              onClick={() => {
                onNavigate('purchases');
                setIsOpen(false);
              }}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] shadow-2xs transition"
            >
              Create Purchase Invoice
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
