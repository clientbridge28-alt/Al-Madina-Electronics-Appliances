import type { Product } from '../types/erp';
import { authorizedApiFetch } from './firebase';

export interface WordPressStatus {
  siteUrl: string;
  hasRestCredentials: boolean;
  hasWooCredentials: boolean;
  syncProductsAuto: boolean;
  syncStockAuto: boolean;
  syncOrdersAuto: boolean;
  lastBackupAt: string | null;
  lastBackupStatus: string;
  lastBackupRef: string | null;
  lastError: string | null;
  secretStoragePolicy: string;
}

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  type: 'Product Push' | 'Stock Update' | 'Secondary Backup' | 'Connection Test';
  status: 'Success' | 'Failed' | 'Warning';
  details: string;
  recordRef?: string;
}

const WP_LOGS_KEY = 'electro_erp_wordpress_logs_v2';
let inMemorySyncLogs: SyncLogEntry[] = [];

// Ensure any legacy plaintext credentials or logs stored in localStorage from older builds are purged
try {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('electro_erp_wordpress_config_v1');
    localStorage.removeItem(WP_LOGS_KEY);
  }
} catch {
  // Ignore storage access errors
}

export function getSyncLogs(): SyncLogEntry[] {
  try {
    if (typeof sessionStorage !== 'undefined') {
      const raw = sessionStorage.getItem(WP_LOGS_KEY);
      if (raw) return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to read sync logs', e);
  }
  return inMemorySyncLogs;
}

export function addSyncLog(entry: Omit<SyncLogEntry, 'id' | 'timestamp'>): void {
  const current = [...getSyncLogs()];
  const newLog: SyncLogEntry = {
    ...entry,
    id: `WPLOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
  };
  current.unshift(newLog);
  if (current.length > 200) current.pop();
  inMemorySyncLogs = current;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(WP_LOGS_KEY, JSON.stringify(current));
    }
  } catch {
    // Ignore
  }
}

export async function fetchWordPressServerStatus(): Promise<WordPressStatus | null> {
  try {
    const res = await authorizedApiFetch('/api/wordpress/status');
    if (!res.ok) return null;
    return (await res.json()) as WordPressStatus;
  } catch {
    return null;
  }
}

export async function configureWordPressServer(payload: {
  siteUrl: string;
  restUsername?: string;
  appPassword?: string;
  wcKey?: string;
  wcSecret?: string;
  syncProductsAuto?: boolean;
  syncStockAuto?: boolean;
  syncOrdersAuto?: boolean;
}): Promise<{ saved: boolean; message?: string }> {
  try {
    const res = await authorizedApiFetch('/api/wordpress/configure', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { saved: false, message: data.error || `HTTP ${res.status}` };
    }
    return { saved: true };
  } catch (err: any) {
    return { saved: false, message: err?.message || 'Backend API unavailable.' };
  }
}

export async function testWordPressConnection(siteUrl?: string): Promise<{
  success: boolean;
  message: string;
  isWooCommerce: boolean;
}> {
  try {
    const res = await authorizedApiFetch('/api/wordpress/test', {
      method: 'POST',
      body: JSON.stringify({ siteUrl }),
    });
    const data = await res.json();
    addSyncLog({
      type: 'Connection Test',
      status: data.success ? 'Success' : 'Failed',
      details: data.message || 'WordPress test executed',
      recordRef: siteUrl || 'Server Config',
    });
    return {
      success: Boolean(data.success),
      message: data.message || 'Unknown response',
      isWooCommerce: Boolean(data.isWooCommerce),
    };
  } catch (err: any) {
    const msg = `Server proxy error: ${err?.message || 'Unable to reach /api/wordpress/test'}`;
    addSyncLog({
      type: 'Connection Test',
      status: 'Failed',
      details: msg,
    });
    return { success: false, message: msg, isWooCommerce: false };
  }
}

export async function syncProductToWooCommerce(product: Product): Promise<{ success: boolean; message: string }> {
  try {
    const res = await authorizedApiFetch('/api/wordpress/sync-product', {
      method: 'POST',
      body: JSON.stringify({ product }),
    });
    const data = await res.json().catch(() => ({}));
    addSyncLog({
      type: 'Product Push',
      status: data.success ? 'Success' : 'Failed',
      details: data.message || `HTTP ${res.status}`,
      recordRef: product.sku,
    });
    return {
      success: Boolean(data.success),
      message: data.message || `HTTP ${res.status}`,
    };
  } catch (err: any) {
    const msg = err?.message || 'WooCommerce sync request failed';
    addSyncLog({
      type: 'Product Push',
      status: 'Failed',
      details: msg,
      recordRef: product.sku,
    });
    return { success: false, message: msg };
  }
}

export async function pushBackupToWordPress(params: {
  backupId: string;
  checksum: string;
  recordCount: number;
  summary: Record<string, any>;
}): Promise<{ success: boolean; wpRef?: string; timestamp?: string; message?: string }> {
  try {
    const res = await authorizedApiFetch('/api/wordpress/backup', {
      method: 'POST',
      body: JSON.stringify(params),
    });
    const data = await res.json().catch(() => ({}));
    addSyncLog({
      type: 'Secondary Backup',
      status: data.success ? 'Success' : 'Failed',
      details: data.success
        ? `Archived snapshot ${params.backupId} (${params.recordCount} records) -> ${data.wpRef}`
        : data.message || `HTTP ${res.status}`,
      recordRef: params.backupId,
    });
    return {
      success: Boolean(data.success),
      wpRef: data.wpRef,
      timestamp: data.timestamp,
      message: data.message,
    };
  } catch (err: any) {
    const msg = err?.message || 'WordPress backup endpoint unreachable';
    addSyncLog({
      type: 'Secondary Backup',
      status: 'Failed',
      details: msg,
      recordRef: params.backupId,
    });
    return { success: false, message: msg };
  }
}
