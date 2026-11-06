import { Product, SalesInvoice } from '../types/erp';

export interface WordPressSettings {
  siteUrl: string;
  consumerKey: string;
  consumerSecret: string;
  isConnected: boolean;
  isWooCommerceActive: boolean;
  syncProductsAuto: boolean;
  syncOrdersAuto: boolean;
  syncStockAuto: boolean;
  defaultOrderStatus: 'Pending' | 'Completed';
  lastSyncTimestamp?: string;
  lastSyncStatus?: 'Success' | 'Failed' | 'Never';
  lastErrorMessage?: string;
}

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  type: 'Product Push' | 'Stock Update' | 'Order Pull' | 'Connection Test';
  status: 'Success' | 'Failed' | 'Warning';
  details: string;
  recordRef?: string;
}

const WP_SETTINGS_KEY = 'electro_erp_wordpress_config_v1';
const WP_LOGS_KEY = 'electro_erp_wordpress_logs_v1';

export function getWordPressSettings(): WordPressSettings {
  try {
    const raw = localStorage.getItem(WP_SETTINGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read WordPress settings', e);
  }
  return {
    siteUrl: '',
    consumerKey: '',
    consumerSecret: '',
    isConnected: false,
    isWooCommerceActive: false,
    syncProductsAuto: false,
    syncOrdersAuto: false,
    syncStockAuto: true,
    defaultOrderStatus: 'Pending',
    lastSyncStatus: 'Never'
  };
}

export function saveWordPressSettings(settings: WordPressSettings): void {
  try {
    localStorage.setItem(WP_SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save WordPress settings', e);
  }
}

export function getSyncLogs(): SyncLogEntry[] {
  try {
    const raw = localStorage.getItem(WP_LOGS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to read sync logs', e);
  }
  return [];
}

export function addSyncLog(entry: Omit<SyncLogEntry, 'id' | 'timestamp'>): void {
  const current = getSyncLogs();
  const newLog: SyncLogEntry = {
    ...entry,
    id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
  };
  current.unshift(newLog);
  if (current.length > 200) current.pop();
  try {
    localStorage.setItem(WP_LOGS_KEY, JSON.stringify(current));
  } catch (e) {
    console.error('Failed to save sync log', e);
  }
}

// ---------------- WORDPRESS & WOOCOMMERCE REST API CLIENT ----------------

export async function testWordPressConnection(siteUrl: string, key: string, secret: string): Promise<{ success: boolean; message: string; isWooCommerce: boolean }> {
  const cleanUrl = siteUrl.trim().replace(/\/+$/, '');
  if (!cleanUrl) {
    return { success: false, message: 'Please provide a valid WordPress site URL (e.g. https://my-electronics-store.pk)', isWooCommerce: false };
  }

  try {
    // 1. First probe standard WordPress REST API index
    const wpRes = await fetch(`${cleanUrl}/wp-json/`);
    if (!wpRes.ok) {
      return { success: false, message: `WordPress REST API probe returned status HTTP ${wpRes.status}. Check if site URL is reachable.`, isWooCommerce: false };
    }

    const wpData = await wpRes.json();
    const namespaces: string[] = wpData.namespaces || [];
    const hasWoo = namespaces.includes('wc/v3') || namespaces.includes('wc/v2');

    // 2. If credentials provided, probe WooCommerce authentication
    if (key && secret) {
      const authHeader = 'Basic ' + btoa(`${key}:${secret}`);
      const wcRes = await fetch(`${cleanUrl}/wp-json/wc/v3/system_status`, {
        headers: { Authorization: authHeader }
      });

      if (wcRes.ok) {
        return {
          success: true,
          message: `Successfully connected to WooCommerce REST API on ${cleanUrl}! System status OK.`,
          isWooCommerce: true
        };
      } else if (wcRes.status === 401) {
        return {
          success: false,
          message: `Authentication failed (HTTP 401). Verify that WooCommerce Consumer Key and Consumer Secret are correct and have Read/Write permissions.`,
          isWooCommerce: hasWoo
        };
      }
    }

    return {
      success: true,
      message: `Connected to WordPress site "${wpData.name || cleanUrl}". ${hasWoo ? 'WooCommerce detected! Add API keys to enable full product/order sync.' : 'WooCommerce plugin not detected in REST API namespaces.'}`,
      isWooCommerce: hasWoo
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Connection failed: ${err.message || 'Network error or CORS restriction. Ensure HTTPS and CORS headers are enabled on the WordPress server.'}`,
      isWooCommerce: false
    };
  }
}

// Transform ERP Product to WooCommerce REST API payload
export function buildWooCommerceProductPayload(product: Product) {
  return {
    sku: product.sku,
    name: product.name,
    type: 'simple',
    regular_price: String(product.retailPrice),
    description: product.description || `${product.brand} ${product.modelNumber} with official company warranty.`,
    short_description: `${product.brand} ${product.category}`,
    categories: [{ name: product.category }],
    manage_stock: true,
    stock_quantity: product.stockQuantity,
    stock_status: product.stockQuantity > 0 ? 'instock' : 'outofstock',
    attributes: [
      { name: 'Brand', visible: true, options: [product.brand] },
      { name: 'Model', visible: true, options: [product.modelNumber] },
      { name: 'Warranty', visible: true, options: [`${product.warrantyMonths} Months Official`] }
    ]
  };
}

// Queue / Trigger Product Sync
export async function syncProductToWooCommerce(product: Product): Promise<{ success: boolean; message: string }> {
  const config = getWordPressSettings();
  if (!config.isConnected || !config.siteUrl || !config.consumerKey) {
    addSyncLog({
      type: 'Product Push',
      status: 'Warning',
      details: `Cannot sync "${product.name}": WooCommerce API credentials not configured.`,
      recordRef: product.sku
    });
    return { success: false, message: 'WooCommerce credentials not configured.' };
  }

  const payload = buildWooCommerceProductPayload(product);
  const cleanUrl = config.siteUrl.trim().replace(/\/+$/, '');
  const authHeader = 'Basic ' + btoa(`${config.consumerKey}:${config.consumerSecret}`);

  try {
    const res = await fetch(`${cleanUrl}/wp-json/wc/v3/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      addSyncLog({
        type: 'Product Push',
        status: 'Success',
        details: `Synchronized product "${product.name}" to WooCommerce (WP ID: ${data.id}, SKU: ${product.sku})`,
        recordRef: product.sku
      });
      return { success: true, message: `Product synced to WooCommerce (ID: ${data.id})` };
    } else {
      const errData = await res.json().catch(() => ({}));
      const msg = errData.message || `HTTP ${res.status}`;
      addSyncLog({
        type: 'Product Push',
        status: 'Failed',
        details: `Failed to sync "${product.name}": ${msg}`,
        recordRef: product.sku
      });
      return { success: false, message: msg };
    }
  } catch (err: any) {
    addSyncLog({
      type: 'Product Push',
      status: 'Failed',
      details: `Network/CORS error while syncing "${product.name}": ${err.message}`,
      recordRef: product.sku
    });
    return { success: false, message: err.message };
  }
}
