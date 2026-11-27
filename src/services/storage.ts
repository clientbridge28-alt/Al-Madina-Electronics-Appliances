import {
  Customer, Supplier, Employee, AttendanceRecord, VisitorRecord,
  Product, PurchaseInvoice, SalesInvoice, InstallmentAccount,
  Voucher, LedgerEntry, AccountHead, ChequeRecord, Target, AuditLog,
  ShowroomSettings, User, UserRole, SerialUnit, StaffTask, TaskStatus,
  SalesReturn, PurchaseReturn, Warehouse, StockTransfer, StockAdjustmentRecord,
  InstallmentCommitment, CashBankBookRow, GeneralLedgerRow, BalanceSheetReport,
  CashFlowReport, BalanceSheetSectionRow,
} from '../types/erp';
import {
  ORG_ID,
  getDefaultPermissionsForRole,
  type AdminLoginAudit,
  type BackupRecord,
  type RoleTemplate,
  type SecurityEvent,
  type UserSession,
} from '../types/rbac';
import {
  initialSettings, initialUsers, initialCustomers, initialSuppliers,
  initialEmployees, initialAttendance, initialVisitors, initialProducts,
  initialPurchases, initialSales, initialInstallments, initialChartOfAccounts,
  initialVouchers, initialCheques, initialTargets, initialAuditLogs, initialTasks,
} from './mockData';
import {
  ACCOUNT_IDS,
  applyVoucherToAccounts,
  buildChequeBounceVoucher,
  buildChequeClearanceVoucher,
  buildInstallmentCreationVoucher,
  buildInstallmentReceiptVoucher,
  buildPurchaseReturnVoucher,
  buildPurchaseVoucher,
  buildReversalVoucher,
  buildSalesReturnVoucher,
  buildSalesVoucher,
  roundMoney,
  sumVoucherSides,
} from './accounting';
import {
  commitCloudBatch,
  deleteCloudDoc,
  persistCloudDoc,
  sanitizeDocId,
  seedInitialCloudDefaultsIfNeeded,
  type BatchWriteOp,
  type CloudCollectionName,
} from './firestoreSync';

const LEGACY_DEMO_DB_KEY = 'electro_erp_demo_db_v2';
const LEGACY_DEMO_MODE_KEY = 'electro_erp_demo_mode_v1';
const LEGACY_BACKUP_RECORDS_KEY = 'electro_erp_backup_records_v1';

// Ensure any legacy demo or backup data cannot persist in localStorage or sessionStorage
try {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(LEGACY_DEMO_MODE_KEY);
    localStorage.removeItem(LEGACY_DEMO_DB_KEY);
    localStorage.removeItem(LEGACY_BACKUP_RECORDS_KEY);
  }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(LEGACY_DEMO_MODE_KEY);
    sessionStorage.removeItem(LEGACY_DEMO_DB_KEY);
  }
} catch {
  // Ignore storage access restrictions
}

export interface ErpDatabase {
  settings: ShowroomSettings;
  users: User[];
  customers: Customer[];
  suppliers: Supplier[];
  employees: Employee[];
  attendance: AttendanceRecord[];
  visitors: VisitorRecord[];
  products: Product[];
  warehouses: Warehouse[];
  stockTransfers: StockTransfer[];
  stockAdjustments: StockAdjustmentRecord[];
  purchases: PurchaseInvoice[];
  sales: SalesInvoice[];
  salesReturns: SalesReturn[];
  purchaseReturns: PurchaseReturn[];
  installments: InstallmentAccount[];
  installmentCommitments: InstallmentCommitment[];
  accounts: AccountHead[];
  vouchers: Voucher[];
  cheques: ChequeRecord[];
  targets: Target[];
  auditLogs: AuditLog[];
  tasks: StaffTask[];
  backups: BackupRecord[];
  roles: RoleTemplate[];
  sessions: UserSession[];
  securityEvents: SecurityEvent[];
  adminLoginAudits: AdminLoginAudit[];
}

export interface StockLedgerRow {
  id: string;
  date: string;
  refNo: string;
  type:
    | 'Opening Balance'
    | 'Purchase In'
    | 'Sale Out'
    | 'Sales Return In'
    | 'Purchase Return Out'
    | 'Adjustment'
    | 'Damaged Out'
    | 'Transfer Out'
    | 'Transfer In';
  party: string;
  qtyIn: number;
  qtyOut: number;
  runningQty: number;
  unitRate: number;
  serial?: string;
}

let dbCache: ErpDatabase | null = null;
let cloudActiveUid: string | null = null;
let cloudActiveUser: User | null = null;
let cloudInitializedFlags = {
  settings: false,
  settingsReceived: false,
  accounts: false,
  accountsReceived: false,
  seededCheckDone: false,
};
let lastCloudSyncError: string | null = null;
const listeners = new Set<() => void>();

export function getLastCloudSyncError(): string | null {
  return lastCloudSyncError;
}

export function clearLastCloudSyncError(): void {
  if (lastCloudSyncError !== null) {
    lastCloudSyncError = null;
    notifySubscribers();
  }
}

function setCloudSyncError(message: string): void {
  lastCloudSyncError = message;
  notifySubscribers();
}

function notifySubscribers() {
  listeners.forEach(cb => {
    try {
      cb();
    } catch (e) {
      console.error('Storage subscriber error:', e);
    }
  });
}

export function subscribeToDatabase(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function buildEmptyProductionDatabase(): ErpDatabase {
  return {
    settings: { ...initialSettings },
    users: [],
    customers: [],
    suppliers: [],
    employees: [],
    attendance: [],
    visitors: [],
    products: [],
    warehouses: [],
    stockTransfers: [],
    stockAdjustments: [],
    purchases: [],
    sales: [],
    salesReturns: [],
    purchaseReturns: [],
    installments: [],
    installmentCommitments: [],
    accounts: initialChartOfAccounts.map(a => ({ ...a, currentBalance: 0 })),
    vouchers: [],
    cheques: [],
    targets: [],
    auditLogs: [],
    tasks: [],
    backups: [],
    roles: [],
    sessions: [],
    securityEvents: [],
    adminLoginAudits: [],
  };
}

export function isDemoMode(): boolean {
  return false;
}

export function isCloudConnected(): boolean {
  return Boolean(cloudActiveUid);
}

export function clearToProductionEmpty(): void {
  dbCache = buildEmptyProductionDatabase();
  notifySubscribers();
}

export function setCloudSessionUser(user: User | null): void {
  cloudActiveUser = user;
  cloudActiveUid = user ? (user.uid || user.id) : null;
  lastCloudSyncError = null;
  if (user) {
    dbCache = buildEmptyProductionDatabase();
  }
  notifySubscribers();
}

export function clearCloudSession(): void {
  cloudActiveUser = null;
  cloudActiveUid = null;
  lastCloudSyncError = null;
  cloudInitializedFlags = {
    settings: false,
    settingsReceived: false,
    accounts: false,
    accountsReceived: false,
    seededCheckDone: false,
  };
  dbCache = buildEmptyProductionDatabase();
  notifySubscribers();
}

export function applyCloudCollectionSnapshot(colName: CloudCollectionName, docs: any[]): void {
  const db = getDatabase();
  if (colName === 'settings') {
    cloudInitializedFlags.settingsReceived = true;
    const main = docs.find(d => d.id === 'main') || docs[0];
    if (main) {
      const { id: _omitSettingsId, ...cleanMain } = main as Record<string, any>;
      db.settings = { ...initialSettings, ...cleanMain };
      cloudInitializedFlags.settings = true;
    } else {
      cloudInitializedFlags.settings = false;
    }
  } else if (colName === 'accounts') {
    cloudInitializedFlags.accountsReceived = true;
    if (docs.length > 0) {
      db.accounts = [...docs].sort((a, b) => String(a.code).localeCompare(String(b.code)));
      cloudInitializedFlags.accounts = true;
    } else {
      cloudInitializedFlags.accounts = false;
    }
  } else if (colName in db) {
    (db as any)[colName] = docs;
  }

  // Bootstrap initial empty chart of accounts & showroom settings in Firestore only after BOTH snapshots arrive
  if (
    !cloudInitializedFlags.seededCheckDone &&
    cloudActiveUser?.role === 'Owner' &&
    cloudInitializedFlags.settingsReceived &&
    cloudInitializedFlags.accountsReceived
  ) {
    cloudInitializedFlags.seededCheckDone = true;
    if (!cloudInitializedFlags.settings || !cloudInitializedFlags.accounts) {
      seedInitialCloudDefaultsIfNeeded(
        db.settings,
        initialChartOfAccounts.map(a => ({ ...a, currentBalance: 0 })),
        cloudInitializedFlags.settings ? 1 : 0,
        cloudInitializedFlags.accounts ? db.accounts.length : 0
      ).catch(err => console.warn('Initial cloud defaults seed deferred:', err));
    }
  }

  notifySubscribers();
}

function getDatabase(): ErpDatabase {
  if (dbCache) return dbCache;
  dbCache = buildEmptyProductionDatabase();
  return dbCache;
}

function saveDatabase(db: ErpDatabase): void {
  dbCache = db;
  notifySubscribers();
}

function getActorUid(): string {
  return cloudActiveUid || getActiveUser().uid || getActiveUser().id || 'system';
}

function persistBatchIfLive(ops: BatchWriteOp[]): void {
  if (!isCloudConnected()) return;
  commitCloudBatch(ops)
    .then(() => {
      if (lastCloudSyncError !== null) {
        clearLastCloudSyncError();
      }
    })
    .catch(err => {
      console.error('Cloud batch persistence error:', err);
      setCloudSyncError(err?.message || 'Cloud Firestore write rejected or offline. Changes were not confirmed in cloud.');
    });
}

// ---------------- AUTHENTICATION & USERS ----------------

const GUEST_USER: User = {
  id: 'guest',
  uid: 'guest',
  name: 'Guest Viewer',
  email: 'guest@preview.local',
  role: 'Cashier',
  phone: '',
  active: false,
  lastLogin: '',
};

export function getActiveUser(): User {
  return cloudActiveUser || GUEST_USER;
}

export function setActiveUser(user: User): void {
  cloudActiveUser = user;
  cloudActiveUid = user.uid || user.id;
  notifySubscribers();
}

export function getUsers(): User[] {
  return getDatabase().users;
}

export function getRoleTemplates(): RoleTemplate[] {
  return getDatabase().roles;
}

export function getUserSessions(): UserSession[] {
  return getDatabase().sessions;
}

export function getSecurityEvents(): SecurityEvent[] {
  return [...getDatabase().securityEvents].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getAdminLoginAudits(): AdminLoginAudit[] {
  return [...getDatabase().adminLoginAudits].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// Legacy switchRole disabled — authentication is strictly handled by Firebase Auth
export function switchRole(_role: UserRole): User {
  throw new Error('Direct role switching is disabled. Sign in with Firebase Authentication.');
}

// ---------------- SETTINGS ----------------

export function getSettings(): ShowroomSettings {
  return getDatabase().settings;
}

export function saveSettings(settings: ShowroomSettings): void {
  const db = getDatabase();
  const { id: _omitSettingsId, ...cleanSettings } = (settings as ShowroomSettings & { id?: string });
  db.settings = cleanSettings;
  saveDatabase(db);
  if (isCloudConnected()) {
    persistCloudDoc('settings', 'main', {
      ...cleanSettings,
      orgId: ORG_ID,
      updatedAt: new Date().toISOString(),
    })
      .then(() => {
        if (lastCloudSyncError !== null) clearLastCloudSyncError();
      })
      .catch(err => {
        console.error(err);
        setCloudSyncError(err?.message || 'Could not save showroom settings to Cloud Firestore.');
      });
  }
  logAuditAction('Settings', 'Update Showroom Profile', `Updated showroom profile for ${cleanSettings.showroomName}`);
}

// ---------------- AUDIT LOGS ----------------

export function getAuditLogs(): AuditLog[] {
  return [...getDatabase().auditLogs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function logAuditAction(module: string, action: string, details: string, recordId?: string): void {
  const user = getActiveUser();
  const db = getDatabase();
  const uid = getActorUid();
  const safeDetails = (details || action || 'Audit event').trim().slice(0, 990) || 'Audit event';
  const newLog: AuditLog & { orgId?: string } = {
    id: sanitizeDocId(`AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`),
    orgId: ORG_ID,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    userId: uid,
    userName: user.name || 'System User',
    userRole: user.role,
    module,
    action,
    details: safeDetails,
    recordId,
  };
  db.auditLogs.unshift(newLog);
  if (db.auditLogs.length > 500) {
    db.auditLogs.pop();
  }
  saveDatabase(db);
  if (isCloudConnected()) {
    persistCloudDoc('auditLogs', newLog.id, newLog).catch(err => console.warn('Audit log cloud write skipped:', err));
  }
}

// ---------------- CUSTOMERS ----------------

export function getCustomers(): Customer[] {
  return getDatabase().customers;
}

export function getCustomerById(id: string): Customer | undefined {
  return getDatabase().customers.find(c => c.id === id);
}

export function saveCustomer(customer: Customer): void {
  const db = getDatabase();
  const uid = getActorUid();
  const payload = {
    ...customer,
    id: sanitizeDocId(customer.id),
    orgId: ORG_ID,
    createdByUid: (customer as any).createdByUid || uid,
    updatedAt: new Date().toISOString(),
  };
  const idx = db.customers.findIndex(c => c.id === payload.id);
  if (idx >= 0) {
    db.customers[idx] = payload;
    logAuditAction('Customers', 'Edit Customer', `Updated profile of customer: ${payload.name}`, payload.id);
  } else {
    db.customers.unshift(payload);
    logAuditAction('Customers', 'New Customer Registered', `Added new customer: ${payload.name} (CNIC: ${payload.cnic})`, payload.id);
  }
  saveDatabase(db);
  persistBatchIfLive([{ collection: 'customers', id: payload.id, data: payload }]);
}

export function deleteCustomer(customerId: string): void {
  const db = getDatabase();
  const safeId = sanitizeDocId(customerId);
  const target = db.customers.find(c => c.id === safeId);
  db.customers = db.customers.filter(c => c.id !== safeId);
  saveDatabase(db);
  if (isCloudConnected()) {
    deleteCloudDoc('customers', safeId).catch(err => {
      console.error('Cloud customer deletion error:', err);
      setCloudSyncError(err?.message || 'Could not delete customer in Cloud Firestore.');
    });
  }
  logAuditAction('Customers', 'Delete Customer', `Deleted customer record: ${target?.name || safeId}`, safeId);
}

// ---------------- SUPPLIERS ----------------

export function getSuppliers(): Supplier[] {
  return getDatabase().suppliers;
}

export function getSupplierById(id: string): Supplier | undefined {
  return getDatabase().suppliers.find(s => s.id === id);
}

export function saveSupplier(supplier: Supplier): void {
  const db = getDatabase();
  const uid = getActorUid();
  const payload = {
    ...supplier,
    id: sanitizeDocId(supplier.id),
    orgId: ORG_ID,
    createdByUid: (supplier as any).createdByUid || uid,
    updatedAt: new Date().toISOString(),
  };
  const idx = db.suppliers.findIndex(s => s.id === payload.id);
  if (idx >= 0) {
    db.suppliers[idx] = payload;
    logAuditAction('Suppliers', 'Edit Supplier', `Updated supplier profile: ${payload.companyName}`, payload.id);
  } else {
    db.suppliers.unshift(payload);
    logAuditAction('Suppliers', 'New Supplier Registered', `Added supplier: ${payload.companyName}`, payload.id);
  }
  saveDatabase(db);
  persistBatchIfLive([{ collection: 'suppliers', id: payload.id, data: payload }]);
}

export function deleteSupplier(supplierId: string): void {
  const db = getDatabase();
  const safeId = sanitizeDocId(supplierId);
  const target = db.suppliers.find(s => s.id === safeId);
  db.suppliers = db.suppliers.filter(s => s.id !== safeId);
  saveDatabase(db);
  if (isCloudConnected()) {
    deleteCloudDoc('suppliers', safeId).catch(err => {
      console.error('Cloud supplier deletion error:', err);
      setCloudSyncError(err?.message || 'Could not delete supplier in Cloud Firestore.');
    });
  }
  logAuditAction('Suppliers', 'Delete Supplier', `Deleted supplier record: ${target?.companyName || safeId}`, safeId);
}

// ---------------- EMPLOYEES & ATTENDANCE ----------------

export function getEmployees(): Employee[] {
  return getDatabase().employees;
}

export function saveEmployee(employee: Employee): void {
  const db = getDatabase();
  const payload = { ...employee, id: sanitizeDocId(employee.id), orgId: ORG_ID };
  const idx = db.employees.findIndex(e => e.id === payload.id);
  if (idx >= 0) {
    db.employees[idx] = payload;
    logAuditAction('Employees', 'Edit Employee', `Updated employee: ${payload.name}`, payload.id);
  } else {
    db.employees.unshift(payload);
    logAuditAction('Employees', 'New Employee', `Registered employee: ${payload.name} as ${payload.designation}`, payload.id);
  }
  saveDatabase(db);
  persistBatchIfLive([{ collection: 'employees', id: payload.id, data: payload }]);
}

export function getAttendance(): AttendanceRecord[] {
  return getDatabase().attendance;
}

export function markStaffCheckIn(employeeId: string, notes?: string): AttendanceRecord {
  const db = getDatabase();
  const emp = db.employees.find(e => e.id === employeeId);
  if (!emp) throw new Error('Employee not found');

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  const isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 15);

  const newRecord: AttendanceRecord & { orgId?: string } = {
    id: sanitizeDocId(`ATT-${Date.now()}`),
    orgId: ORG_ID,
    employeeId: emp.id,
    employeeName: emp.name,
    date: todayStr,
    checkInTime: timeStr,
    status: isLate ? 'Late' : 'Present',
    workingHours: 0,
    notes: notes || (isLate ? 'Late arrival' : 'On time'),
  };

  db.attendance.unshift(newRecord);
  saveDatabase(db);
  persistBatchIfLive([{ collection: 'attendance', id: newRecord.id, data: newRecord }]);
  logAuditAction('Attendance', 'Staff Check-In', `Staff check-in for ${emp.name} at ${timeStr} (${newRecord.status})`, newRecord.id);
  return newRecord;
}

export function markStaffCheckOut(attendanceId: string): void {
  const db = getDatabase();
  const record = db.attendance.find(a => a.id === attendanceId);
  if (!record) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  record.checkOutTime = timeStr;
  record.workingHours = 8.5;
  saveDatabase(db);
  persistBatchIfLive([{ collection: 'attendance', id: record.id, data: { ...record, orgId: ORG_ID } }]);
  logAuditAction('Attendance', 'Staff Check-Out', `Staff checked out: ${record.employeeName} at ${timeStr}`, record.id);
}

// ---------------- VISITORS ----------------

export function getVisitors(): VisitorRecord[] {
  return getDatabase().visitors;
}

export function checkInVisitor(visitor: Omit<VisitorRecord, 'id' | 'entryTime' | 'entryDate' | 'status' | 'createdBy'>): VisitorRecord {
  const db = getDatabase();
  const user = getActiveUser();
  const now = new Date();
  const entryDate = now.toISOString().split('T')[0];
  const entryTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

  const newVisitor: VisitorRecord & { orgId?: string } = {
    ...visitor,
    id: sanitizeDocId(`VIS-${Date.now().toString().slice(-6)}`),
    orgId: ORG_ID,
    entryDate,
    entryTime,
    status: 'Inside',
    createdBy: user.name,
  };

  db.visitors.unshift(newVisitor);
  saveDatabase(db);
  persistBatchIfLive([{ collection: 'visitors', id: newVisitor.id, data: newVisitor }]);
  logAuditAction('Visitors', 'Visitor Check-In', `Visitor entry: ${visitor.name} (${visitor.purpose}) to meet ${visitor.personToMeet}`, newVisitor.id);
  return newVisitor;
}

export function checkOutVisitor(visitorId: string): void {
  const db = getDatabase();
  const v = db.visitors.find(x => x.id === visitorId);
  if (!v) return;

  const now = new Date();
  v.exitTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  v.status = 'Checked Out';
  saveDatabase(db);
  persistBatchIfLive([{ collection: 'visitors', id: v.id, data: { ...v, orgId: ORG_ID } }]);
  logAuditAction('Visitors', 'Visitor Check-Out', `Visitor departed: ${v.name} at ${v.exitTime}`, v.id);
}

// ---------------- PRODUCTS, SERIALS & ITEM STOCK LEDGER ----------------

export function getProducts(): Product[] {
  return getDatabase().products;
}

export function getProductById(id: string): Product | undefined {
  return getDatabase().products.find(p => p.id === id);
}

export function saveProduct(product: Product): void {
  const db = getDatabase();
  const safeId = sanitizeDocId(product.id);
  const idx = db.products.findIndex(p => p.id === safeId);
  const normalizedSku = String(product.sku || '').trim().toLowerCase();
  if (
    idx < 0 &&
    normalizedSku &&
    db.products.some(p => String(p.sku || '').trim().toLowerCase() === normalizedSku)
  ) {
    throw new Error(`Duplicate SKU "${product.sku}" already exists in inventory.`);
  }

  const payload: Product & { orgId?: string; updatedAt?: string } = {
    ...product,
    id: safeId,
    orgId: ORG_ID,
    purchasePrice: Math.max(0, Number(product.purchasePrice) || 0),
    retailPrice: Math.max(0, Number(product.retailPrice) || 0),
    stockQuantity: Math.max(0, Math.round(Number(product.stockQuantity) || 0)),
    minStockLevel: Math.max(0, Math.round(Number(product.minStockLevel) || 0)),
    warrantyMonths: Math.max(0, Math.round(Number(product.warrantyMonths) || 0)),
    updatedAt: new Date().toISOString(),
  };
  if (idx >= 0) {
    db.products[idx] = payload;
    logAuditAction('Inventory', 'Update Product', `Updated product: ${payload.name} (SKU: ${payload.sku})`, payload.id);
  } else {
    db.products.unshift(payload);
    logAuditAction('Inventory', 'Add Product', `Added new product: ${payload.name} (Qty: ${payload.stockQuantity})`, payload.id);
  }
  saveDatabase(db);
  persistBatchIfLive([{ collection: 'products', id: payload.id, data: payload }]);
}

export function deleteProduct(productId: string): void {
  const db = getDatabase();
  const safeId = sanitizeDocId(productId);
  const target = db.products.find(p => p.id === safeId);
  db.products = db.products.filter(p => p.id !== safeId);
  saveDatabase(db);
  if (isCloudConnected()) {
    deleteCloudDoc('products', safeId).catch(err => {
      console.error('Cloud product deletion error:', err);
      setCloudSyncError(err?.message || 'Could not delete product in Cloud Firestore.');
    });
  }
  logAuditAction('Inventory', 'Delete Product', `Deleted product: ${target?.name || safeId}`, safeId);
}

export function adjustProductStock(
  productId: string,
  adjustmentQty: number,
  reason: string,
  options?: {
    allowNegativeStock?: boolean;
    adjustmentType?: StockAdjustmentRecord['adjustmentType'];
  }
): StockAdjustmentRecord | null {
  const db = getDatabase();
  const user = getActiveUser();
  const uid = getActorUid();
  const p = db.products.find(x => x.id === productId);
  if (!p) return null;

  const delta = Math.round(Number(adjustmentQty) || 0);
  const oldQty = Math.round(Number(p.stockQuantity) || 0);
  const nextQty = oldQty + delta;

  if (nextQty < 0 && !(options?.allowNegativeStock && user.role === 'Owner')) {
    throw new Error(`Insufficient stock for ${p.name}: available ${oldQty}, requested reduction ${Math.abs(delta)}.`);
  }

  p.stockQuantity = nextQty;
  const adjustmentType = options?.adjustmentType || 'Adjustment';
  if (adjustmentType === 'Damaged' && delta < 0) {
    p.damagedQuantity = Math.max(0, Math.round(Number(p.damagedQuantity || 0) + Math.abs(delta)));
  }
  (p as any).updatedAt = new Date().toISOString();

  const record: StockAdjustmentRecord = {
    id: sanitizeDocId(`ADJ-${Date.now()}-${Math.floor(Math.random() * 1000)}`),
    orgId: ORG_ID,
    createdByUid: uid,
    date: new Date().toISOString().split('T')[0],
    productId: p.id,
    productName: p.name,
    adjustmentQty: delta,
    previousQty: oldQty,
    newQty: nextQty,
    adjustmentType,
    reason: reason || 'Manual stock adjustment',
    adjustedBy: user.name,
  };

  if (!db.stockAdjustments) db.stockAdjustments = [];
  db.stockAdjustments.unshift(record);
  saveDatabase(db);
  persistBatchIfLive([
    { collection: 'products', id: p.id, data: { ...p, orgId: ORG_ID } },
    { collection: 'stockAdjustments', id: record.id, data: record },
  ]);
  logAuditAction('Inventory', adjustmentType === 'Damaged' ? 'Damaged Stock Entry' : 'Stock Adjustment', `Adjusted stock for ${p.name} from ${oldQty} to ${nextQty}. Reason: ${record.reason}`, p.id);
  return record;
}

export function getWarehouses(): Warehouse[] {
  return getDatabase().warehouses || [];
}

export function saveWarehouse(warehouse: Warehouse): Warehouse {
  const db = getDatabase();
  if (!db.warehouses) db.warehouses = [];
  const payload: Warehouse = {
    ...warehouse,
    id: sanitizeDocId(warehouse.id || `WH-${Date.now().toString().slice(-4)}`),
    orgId: ORG_ID,
  };
  const idx = db.warehouses.findIndex(w => w.id === payload.id);
  if (idx >= 0) {
    db.warehouses[idx] = payload;
  } else {
    db.warehouses.unshift(payload);
  }
  saveDatabase(db);
  persistBatchIfLive([{ collection: 'warehouses', id: payload.id, data: payload }]);
  logAuditAction('Inventory', 'Save Warehouse', `Saved warehouse ${payload.name} (${payload.code})`, payload.id);
  return payload;
}

export function getStockTransfers(): StockTransfer[] {
  return getDatabase().stockTransfers || [];
}

export function getStockAdjustments(): StockAdjustmentRecord[] {
  return getDatabase().stockAdjustments || [];
}

export function createStockTransfer(transfer: Omit<StockTransfer, 'id' | 'transferredBy' | 'orgId' | 'createdByUid'>): StockTransfer {
  const db = getDatabase();
  const user = getActiveUser();
  const uid = getActorUid();
  if (!db.stockTransfers) db.stockTransfers = [];

  const qty = Math.round(Number(transfer.quantity) || 0);
  if (qty <= 0) {
    throw new Error('Transfer quantity must be greater than zero.');
  }
  if (transfer.fromWarehouseId === transfer.toWarehouseId) {
    throw new Error('Source and destination warehouses must be different.');
  }

  const product = db.products.find(p => p.id === transfer.productId);
  if (!product) {
    throw new Error('Selected product not found.');
  }
  if (product.stockQuantity < qty) {
    throw new Error(`Insufficient stock for transfer of ${product.name}: available ${product.stockQuantity}, requested ${qty}.`);
  }

  const record: StockTransfer = {
    ...transfer,
    id: sanitizeDocId(transfer.transferNumber || `STRF-${Date.now().toString().slice(-5)}`),
    orgId: ORG_ID,
    createdByUid: uid,
    quantity: qty,
    transferredBy: user.name,
  };

  product.warehouseId = transfer.toWarehouseId;
  product.warehouseName = transfer.toWarehouseName;
  (product as any).updatedAt = new Date().toISOString();

  db.stockTransfers.unshift(record);
  saveDatabase(db);
  persistBatchIfLive([
    { collection: 'stockTransfers', id: record.id, data: record },
    { collection: 'products', id: product.id, data: { ...product, orgId: ORG_ID } },
  ]);
  logAuditAction('Inventory', 'Stock Transfer', `Transferred ${qty} x ${product.name} from ${transfer.fromWarehouseName} to ${transfer.toWarehouseName}`, record.id);
  return record;
}

export function getItemStockLedger(productId: string): StockLedgerRow[] {
  const db = getDatabase();
  const product = db.products.find(p => p.id === productId);
  const rows: (Omit<StockLedgerRow, 'runningQty'> & { sortOrder: number })[] = [];

  if (product && (product.openingStock || 0) > 0) {
    rows.push({
      id: `STK-OP-${product.id}`,
      date: '0000-01-01',
      refNo: 'OPENING',
      type: 'Opening Balance',
      party: product.warehouseName || 'Main Showroom',
      qtyIn: product.openingStock || 0,
      qtyOut: 0,
      unitRate: product.purchasePrice,
      sortOrder: 0,
    });
  }

  db.purchases
    .filter(pur => pur.status !== 'Draft')
    .forEach(pur => {
      pur.items.filter(i => i.productId === productId).forEach((item, idx) => {
        rows.push({
          id: `STK-PUR-${pur.id}-${idx}`,
          date: pur.date,
          refNo: pur.invoiceNumber,
          type: 'Purchase In',
          party: pur.supplierName,
          qtyIn: item.quantity,
          qtyOut: 0,
          unitRate: item.purchasePrice,
          serial: item.serialNumbers?.join(', '),
          sortOrder: 1,
        });
      });
    });

  db.sales
    .filter(sale => sale.status !== 'Cancelled')
    .forEach(sale => {
      sale.items.filter(i => i.productId === productId).forEach((item, idx) => {
        rows.push({
          id: `STK-SAL-${sale.id}-${idx}`,
          date: sale.date,
          refNo: sale.invoiceNumber,
          type: 'Sale Out',
          party: sale.customerName,
          qtyIn: 0,
          qtyOut: item.quantity,
          unitRate: item.unitPrice,
          serial: item.selectedSerial,
          sortOrder: 2,
        });
      });
    });

  (db.salesReturns || []).forEach(ret => {
    ret.items.filter(i => i.productId === productId).forEach((item, idx) => {
      rows.push({
        id: `STK-SRTN-${ret.id}-${idx}`,
        date: ret.date,
        refNo: ret.returnNumber,
        type: 'Sales Return In',
        party: ret.customerName,
        qtyIn: item.quantity,
        qtyOut: 0,
        unitRate: item.unitPrice,
        serial: item.serialNumber,
        sortOrder: 3,
      });
    });
  });

  (db.purchaseReturns || []).forEach(ret => {
    ret.items.filter(i => i.productId === productId).forEach((item, idx) => {
      rows.push({
        id: `STK-PRTN-${ret.id}-${idx}`,
        date: ret.date,
        refNo: ret.returnNumber,
        type: 'Purchase Return Out',
        party: ret.supplierName,
        qtyIn: 0,
        qtyOut: item.quantity,
        unitRate: item.purchasePrice,
        serial: item.serialNumber,
        sortOrder: 4,
      });
    });
  });

  (db.stockAdjustments || [])
    .filter(a => a.productId === productId)
    .forEach(adj => {
      rows.push({
        id: `STK-ADJ-${adj.id}`,
        date: adj.date,
        refNo: adj.id,
        type: adj.adjustmentType === 'Damaged' ? 'Damaged Out' : 'Adjustment',
        party: adj.reason,
        qtyIn: adj.adjustmentQty > 0 ? adj.adjustmentQty : 0,
        qtyOut: adj.adjustmentQty < 0 ? Math.abs(adj.adjustmentQty) : 0,
        unitRate: product?.purchasePrice || 0,
        sortOrder: 5,
      });
    });

  (db.stockTransfers || [])
    .filter(tr => tr.productId === productId)
    .forEach(tr => {
      rows.push({
        id: `STK-TRF-${tr.id}`,
        date: tr.date,
        refNo: tr.transferNumber,
        type: 'Transfer Out',
        party: `${tr.fromWarehouseName} -> ${tr.toWarehouseName}`,
        qtyIn: 0,
        qtyOut: 0,
        unitRate: product?.purchasePrice || 0,
        serial: `${tr.quantity} unit(s) moved`,
        sortOrder: 6,
      });
    });

  rows.sort((a, b) => a.date.localeCompare(b.date) || a.sortOrder - b.sortOrder);
  let running = 0;
  return rows.map(({ sortOrder: _s, ...r }) => {
    running += r.qtyIn - r.qtyOut;
    return { ...r, runningQty: running };
  });
}

// ---------------- PURCHASES & PURCHASE RETURNS ----------------

export function getPurchases(): PurchaseInvoice[] {
  return getDatabase().purchases;
}

export function createPurchaseInvoice(invoice: Omit<PurchaseInvoice, 'id' | 'createdBy'>): PurchaseInvoice {
  const db = getDatabase();
  const user = getActiveUser();
  const uid = getActorUid();
  const safeId = sanitizeDocId(invoice.invoiceNumber || `PINV-${Date.now().toString().slice(-5)}`);
  const normalizedNo = String(invoice.invoiceNumber || safeId).trim().toLowerCase();

  if (db.purchases.some(p => p.id === safeId || String(p.invoiceNumber || '').trim().toLowerCase() === normalizedNo)) {
    throw new Error(`Duplicate Purchase Invoice #${invoice.invoiceNumber || safeId} already exists.`);
  }

  const nowIso = new Date().toISOString();
  const newInvoice: PurchaseInvoice & { orgId?: string; createdByUid?: string; updatedAt?: string } = {
    ...invoice,
    id: safeId,
    orgId: ORG_ID,
    createdByUid: uid,
    createdBy: user.name,
    updatedAt: nowIso,
  };

  const batchOps: BatchWriteOp[] = [{ collection: 'purchases', id: newInvoice.id, data: newInvoice }];

  newInvoice.items.forEach(item => {
    const prod = db.products.find(p => p.id === item.productId);
    if (prod) {
      prod.stockQuantity = Math.round(prod.stockQuantity + Number(item.quantity || 0));
      prod.purchasePrice = item.purchasePrice || prod.purchasePrice;
      (prod as any).updatedAt = nowIso;
      if (item.serialNumbers && item.serialNumbers.length > 0) {
        if (!prod.serials) prod.serials = [];
        item.serialNumbers.forEach(sn => {
          const newUnit: SerialUnit = {
            serialNumber: sn,
            productId: prod.id,
            productName: prod.name,
            condition: 'Brand New',
            purchaseCost: item.purchasePrice,
            supplierId: newInvoice.supplierId,
            supplierName: newInvoice.supplierName,
            purchaseInvoiceNo: newInvoice.invoiceNumber,
            purchaseDate: newInvoice.date,
            status: 'In Stock',
            warrantyMonths: prod.warrantyMonths,
          };
          prod.serials!.push(newUnit);
        });
      }
      batchOps.push({ collection: 'products', id: prod.id, data: { ...prod, orgId: ORG_ID } });
    }
  });

  const supp = db.suppliers.find(s => s.id === newInvoice.supplierId);
  if (supp && newInvoice.remainingBalance > 0) {
    supp.currentBalance = roundMoney(supp.currentBalance + newInvoice.remainingBalance);
    batchOps.push({ collection: 'suppliers', id: supp.id, data: { ...supp, orgId: ORG_ID } });
  }

  // Balanced double-entry accounting voucher
  const voucher = buildPurchaseVoucher(newInvoice, user.name, uid);
  db.accounts = applyVoucherToAccounts(db.accounts, voucher.entries);
  db.vouchers.unshift(voucher);
  batchOps.push({ collection: 'vouchers', id: voucher.id, data: { ...voucher, orgId: ORG_ID } });
  for (const entry of voucher.entries) {
    const acc = db.accounts.find(a => a.id === entry.accountId);
    if (acc) batchOps.push({ collection: 'accounts', id: acc.id, data: { ...acc, orgId: ORG_ID } });
  }

  db.purchases.unshift(newInvoice);
  saveDatabase(db);
  persistBatchIfLive(batchOps);
  logAuditAction('Purchases', 'Create Purchase Invoice', `Created invoice #${newInvoice.invoiceNumber} from ${newInvoice.supplierName} total: PKR ${newInvoice.grandTotal.toLocaleString()}`, newInvoice.id);
  return newInvoice;
}

export function getPurchaseReturns(): PurchaseReturn[] {
  return getDatabase().purchaseReturns || [];
}

export function createPurchaseReturn(returnData: Omit<PurchaseReturn, 'id' | 'processedBy'>): PurchaseReturn {
  const db = getDatabase();
  const user = getActiveUser();
  const uid = getActorUid();

  const newReturn: PurchaseReturn & { orgId?: string; createdByUid?: string } = {
    ...returnData,
    id: sanitizeDocId(returnData.returnNumber || `PRTN-${Date.now().toString().slice(-5)}`),
    orgId: ORG_ID,
    createdByUid: uid,
    processedBy: user.name,
  };

  const batchOps: BatchWriteOp[] = [{ collection: 'purchaseReturns', id: newReturn.id, data: newReturn }];

  newReturn.items.forEach(item => {
    const prod = db.products.find(p => p.id === item.productId);
    if (prod && prod.stockQuantity < item.quantity) {
      throw new Error(`Insufficient stock for purchase return of ${prod.name}: available ${prod.stockQuantity}, requested ${item.quantity}.`);
    }
  });

  newReturn.items.forEach(item => {
    const prod = db.products.find(p => p.id === item.productId);
    if (prod) {
      prod.stockQuantity = Math.round(prod.stockQuantity - item.quantity);
      if (item.serialNumber && prod.serials) {
        const serialUnit = prod.serials.find(s => s.serialNumber === item.serialNumber);
        if (serialUnit) serialUnit.status = 'Returned';
      }
      batchOps.push({ collection: 'products', id: prod.id, data: { ...prod, orgId: ORG_ID } });
    }
  });

  if (newReturn.refundMethod === 'Deduct Payable') {
    const supp = db.suppliers.find(s => s.id === newReturn.supplierId);
    if (supp) {
      supp.currentBalance = Math.max(0, roundMoney(supp.currentBalance - newReturn.grandTotal));
      batchOps.push({ collection: 'suppliers', id: supp.id, data: { ...supp, orgId: ORG_ID } });
    }
  }

  const origPurchase = db.purchases.find(p => p.invoiceNumber === newReturn.originalPurchaseNo);
  if (origPurchase) {
    origPurchase.status = 'Returned';
    batchOps.push({ collection: 'purchases', id: origPurchase.id, data: { ...origPurchase, orgId: ORG_ID } });
  }

  const voucher = buildPurchaseReturnVoucher(newReturn, user.name, uid);
  db.accounts = applyVoucherToAccounts(db.accounts, voucher.entries);
  db.vouchers.unshift(voucher);
  batchOps.push({ collection: 'vouchers', id: voucher.id, data: { ...voucher, orgId: ORG_ID } });
  for (const entry of voucher.entries) {
    const acc = db.accounts.find(a => a.id === entry.accountId);
    if (acc) batchOps.push({ collection: 'accounts', id: acc.id, data: { ...acc, orgId: ORG_ID } });
  }

  db.purchaseReturns.unshift(newReturn);
  saveDatabase(db);
  persistBatchIfLive(batchOps);
  logAuditAction('Purchase Return', 'Process Purchase Return', `Processed Purchase Return #${newReturn.returnNumber} to ${newReturn.supplierName} (PKR ${newReturn.grandTotal.toLocaleString()})`, newReturn.id);
  return newReturn;
}

// ---------------- SALES, POS & SALES RETURNS ----------------

export function getSales(): SalesInvoice[] {
  return getDatabase().sales;
}

export function createSalesInvoice(
  saleData: Omit<SalesInvoice, 'id' | 'status'>,
  options?: { allowNegativeStock?: boolean }
): SalesInvoice {
  const db = getDatabase();
  const user = getActiveUser();
  const uid = getActorUid();
  const safeId = sanitizeDocId(saleData.invoiceNumber || `INV-${Date.now().toString().slice(-5)}`);
  const normalizedNo = String(saleData.invoiceNumber || safeId).trim().toLowerCase();

  if (db.sales.some(s => s.id === safeId || String(s.invoiceNumber || '').trim().toLowerCase() === normalizedNo)) {
    throw new Error(`Duplicate Sales Invoice #${saleData.invoiceNumber || safeId} already exists.`);
  }

  let negativeOverrideUsed = false;
  for (const item of saleData.items) {
    const prod = db.products.find(p => p.id === item.productId);
    if (prod && prod.stockQuantity < item.quantity) {
      if (options?.allowNegativeStock && user.role === 'Owner') {
        negativeOverrideUsed = true;
      } else {
        throw new Error(`Insufficient stock for ${prod.name}: available ${prod.stockQuantity}, requested ${item.quantity}.`);
      }
    }
  }

  const nowIso = new Date().toISOString();
  const newSale: SalesInvoice & { orgId?: string; createdByUid?: string; updatedAt?: string } = {
    ...saleData,
    id: safeId,
    orgId: ORG_ID,
    createdByUid: uid,
    status: 'Completed',
    notes: negativeOverrideUsed
      ? `${saleData.notes ? `${saleData.notes} ` : ''}[Owner Negative Stock Override]`.trim()
      : saleData.notes,
    updatedAt: nowIso,
  };

  const batchOps: BatchWriteOp[] = [{ collection: 'sales', id: newSale.id, data: newSale }];

  newSale.items.forEach(item => {
    const prod = db.products.find(p => p.id === item.productId);
    if (prod) {
      prod.stockQuantity = Math.round(prod.stockQuantity - item.quantity);
      (prod as any).updatedAt = nowIso;
      if (item.selectedSerial && prod.serials) {
        const serialUnit = prod.serials.find(s => s.serialNumber === item.selectedSerial);
        if (serialUnit) {
          serialUnit.status = 'Sold';
          serialUnit.saleInvoiceNo = newSale.invoiceNumber;
          serialUnit.saleDate = newSale.date;
          serialUnit.customerId = newSale.customerId;
          serialUnit.customerName = newSale.customerName;
        }
      }
      batchOps.push({ collection: 'products', id: prod.id, data: { ...prod, orgId: ORG_ID } });
    }
  });

  if (newSale.saleType === 'Credit' && newSale.remainingBalance > 0) {
    const cust = db.customers.find(c => c.id === newSale.customerId);
    if (cust) {
      cust.currentBalance = roundMoney(cust.currentBalance + newSale.remainingBalance);
      batchOps.push({ collection: 'customers', id: cust.id, data: { ...cust, orgId: ORG_ID } });
    }
  }

  const voucher = buildSalesVoucher(newSale, user.name, uid);
  db.accounts = applyVoucherToAccounts(db.accounts, voucher.entries);
  db.vouchers.unshift(voucher);
  batchOps.push({ collection: 'vouchers', id: voucher.id, data: { ...voucher, orgId: ORG_ID } });
  for (const entry of voucher.entries) {
    const acc = db.accounts.find(a => a.id === entry.accountId);
    if (acc) batchOps.push({ collection: 'accounts', id: acc.id, data: { ...acc, orgId: ORG_ID } });
  }

  db.sales.unshift(newSale);
  saveDatabase(db);
  persistBatchIfLive(batchOps);
  logAuditAction('Sales & POS', 'Post Sales Invoice', `Completed ${newSale.saleType} Sale #${newSale.invoiceNumber} for ${newSale.customerName} - PKR ${newSale.grandTotal.toLocaleString()}`, newSale.id);
  return newSale;
}

export function getSalesReturns(): SalesReturn[] {
  return getDatabase().salesReturns || [];
}

export function createSalesReturn(returnData: Omit<SalesReturn, 'id' | 'processedBy'>): SalesReturn {
  const db = getDatabase();
  const user = getActiveUser();
  const uid = getActorUid();

  const newReturn: SalesReturn & { orgId?: string; createdByUid?: string } = {
    ...returnData,
    id: sanitizeDocId(returnData.returnNumber || `SRTN-${Date.now().toString().slice(-5)}`),
    orgId: ORG_ID,
    createdByUid: uid,
    processedBy: user.name,
  };

  const batchOps: BatchWriteOp[] = [{ collection: 'salesReturns', id: newReturn.id, data: newReturn }];
  let cogsRestore = 0;

  newReturn.items.forEach(item => {
    const prod = db.products.find(p => p.id === item.productId);
    if (prod) {
      prod.stockQuantity = Math.round(prod.stockQuantity + Number(item.quantity || 0));
      (prod as any).updatedAt = new Date().toISOString();
      cogsRestore += roundMoney((prod.purchasePrice || 0) * item.quantity);
      if (item.serialNumber && prod.serials) {
        const serialUnit = prod.serials.find(s => s.serialNumber === item.serialNumber);
        if (serialUnit) {
          serialUnit.status = 'In Stock';
          serialUnit.saleInvoiceNo = undefined;
          serialUnit.saleDate = undefined;
          serialUnit.customerId = undefined;
          serialUnit.customerName = undefined;
        }
      }
      batchOps.push({ collection: 'products', id: prod.id, data: { ...prod, orgId: ORG_ID } });
    }
  });

  if (newReturn.refundMethod === 'Credit Note') {
    const cust = db.customers.find(c => c.id === newReturn.customerId);
    if (cust) {
      cust.currentBalance = Math.max(0, roundMoney(cust.currentBalance - newReturn.grandTotal));
      batchOps.push({ collection: 'customers', id: cust.id, data: { ...cust, orgId: ORG_ID } });
    }
  }

  const origSale = db.sales.find(s => s.invoiceNumber === newReturn.originalInvoiceNo);
  if (origSale) {
    origSale.status = 'Returned';
    batchOps.push({ collection: 'sales', id: origSale.id, data: { ...origSale, orgId: ORG_ID } });
  }

  const voucher = buildSalesReturnVoucher(newReturn, cogsRestore, user.name, uid);
  db.accounts = applyVoucherToAccounts(db.accounts, voucher.entries);
  db.vouchers.unshift(voucher);
  batchOps.push({ collection: 'vouchers', id: voucher.id, data: { ...voucher, orgId: ORG_ID } });
  for (const entry of voucher.entries) {
    const acc = db.accounts.find(a => a.id === entry.accountId);
    if (acc) batchOps.push({ collection: 'accounts', id: acc.id, data: { ...acc, orgId: ORG_ID } });
  }

  db.salesReturns.unshift(newReturn);
  saveDatabase(db);
  persistBatchIfLive(batchOps);
  logAuditAction('Sales Return', 'Process Sales Return', `Processed Sales Return #${newReturn.returnNumber} for invoice #${newReturn.originalInvoiceNo} (PKR ${newReturn.grandTotal.toLocaleString()})`, newReturn.id);
  return newReturn;
}

// ---------------- INSTALLMENTS & RECOVERY ----------------

export function getInstallmentAccounts(): InstallmentAccount[] {
  return getDatabase().installments;
}

export function createInstallmentAccount(account: Omit<InstallmentAccount, 'id' | 'totalReceived' | 'status' | 'remainingBalance'>): InstallmentAccount {
  const db = getDatabase();
  const user = getActiveUser();
  const uid = getActorUid();

  const newAccount: InstallmentAccount & { orgId?: string; createdByUid?: string; updatedAt?: string } = {
    ...account,
    id: sanitizeDocId(account.accountNumber || `INST-${Date.now().toString().slice(-5)}`),
    orgId: ORG_ID,
    createdByUid: uid,
    durationMonths: Math.max(1, Math.round(Number(account.durationMonths) || 12)),
    totalReceived: account.downPayment,
    remainingBalance: account.totalFinancedPayable,
    status: 'Active',
    updatedAt: new Date().toISOString(),
  };

  const batchOps: BatchWriteOp[] = [{ collection: 'installments', id: newAccount.id, data: newAccount }];

  const cust = db.customers.find(c => c.id === newAccount.customerId);
  if (cust) {
    cust.currentBalance = roundMoney(cust.currentBalance + newAccount.totalFinancedPayable);
    cust.customerType = 'Installment';
    batchOps.push({ collection: 'customers', id: cust.id, data: { ...cust, orgId: ORG_ID } });
  }

  const voucher = buildInstallmentCreationVoucher(newAccount, user.name, uid);
  db.accounts = applyVoucherToAccounts(db.accounts, voucher.entries);
  db.vouchers.unshift(voucher);
  batchOps.push({ collection: 'vouchers', id: voucher.id, data: { ...voucher, orgId: ORG_ID } });
  for (const entry of voucher.entries) {
    const acc = db.accounts.find(a => a.id === entry.accountId);
    if (acc) batchOps.push({ collection: 'accounts', id: acc.id, data: { ...acc, orgId: ORG_ID } });
  }

  db.installments.unshift(newAccount);
  saveDatabase(db);
  persistBatchIfLive(batchOps);
  logAuditAction('Installments', 'New Installment Account', `Opened installment account #${newAccount.accountNumber} for ${newAccount.customerName} - Total: PKR ${newAccount.totalPayableWithDown.toLocaleString()}`, newAccount.id);
  return newAccount;
}

export function receiveInstallmentPayment(
  accountId: string,
  amount: number,
  paymentMethod: 'Cash' | 'Bank' | 'Cheque',
  remarks?: string
): { receiptNo: string; updatedAccount: InstallmentAccount } {
  const db = getDatabase();
  const user = getActiveUser();
  const uid = getActorUid();
  const account = db.installments.find(a => a.id === accountId);
  if (!account) throw new Error('Installment account not found');

  const receiptNo = `RCT-${Date.now().toString().slice(-5)}`;
  const today = new Date().toISOString().split('T')[0];

  let remainingToAllocate = roundMoney(amount);
  for (const item of account.schedule) {
    if (remainingToAllocate <= 0) break;
    if (item.status !== 'Paid') {
      const needed = item.remainingAmount;
      if (remainingToAllocate >= needed) {
        item.paidAmount = roundMoney(item.paidAmount + needed);
        item.remainingAmount = 0;
        item.status = 'Paid';
        item.paidDate = today;
        item.receiptNo = receiptNo;
        remainingToAllocate = roundMoney(remainingToAllocate - needed);
      } else {
        item.paidAmount = roundMoney(item.paidAmount + remainingToAllocate);
        item.remainingAmount = roundMoney(item.remainingAmount - remainingToAllocate);
        item.status = 'Partially Paid';
        item.paidDate = today;
        item.receiptNo = receiptNo;
        remainingToAllocate = 0;
      }
    }
  }

  account.totalReceived = roundMoney(account.totalReceived + amount);
  account.remainingBalance = Math.max(0, roundMoney(account.remainingBalance - amount));

  if (account.remainingBalance === 0) {
    account.status = 'Completed';
  } else {
    const hasOverdue = account.schedule.some(s => s.status === 'Overdue');
    account.status = hasOverdue ? 'Overdue' : 'Active';
  }

  const batchOps: BatchWriteOp[] = [{ collection: 'installments', id: account.id, data: { ...account, orgId: ORG_ID } }];

  const cust = db.customers.find(c => c.id === account.customerId);
  if (cust) {
    cust.currentBalance = Math.max(0, roundMoney(cust.currentBalance - amount));
    batchOps.push({ collection: 'customers', id: cust.id, data: { ...cust, orgId: ORG_ID } });
  }

  const voucher = buildInstallmentReceiptVoucher(account, receiptNo, amount, paymentMethod, user.name, uid);
  db.accounts = applyVoucherToAccounts(db.accounts, voucher.entries);
  db.vouchers.unshift(voucher);
  batchOps.push({ collection: 'vouchers', id: voucher.id, data: { ...voucher, orgId: ORG_ID } });
  for (const entry of voucher.entries) {
    const acc = db.accounts.find(a => a.id === entry.accountId);
    if (acc) batchOps.push({ collection: 'accounts', id: acc.id, data: { ...acc, orgId: ORG_ID } });
  }

  saveDatabase(db);
  persistBatchIfLive(batchOps);
  logAuditAction('Recovery', 'Receive Installment', `Received installment PKR ${amount.toLocaleString()} for account #${account.accountNumber} (${account.customerName}) Receipt: ${receiptNo}. ${remarks || ''}`, account.id);

  return { receiptNo, updatedAccount: { ...account } };
}

export function closeInstallmentAccountEarly(
  accountId: string,
  settlementAmount: number,
  paymentMethod: 'Cash' | 'Bank' | 'Cheque',
  notes?: string
): { receiptNo: string; updatedAccount: InstallmentAccount } {
  const db = getDatabase();
  const user = getActiveUser();
  const uid = getActorUid();
  const account = db.installments.find(a => a.id === accountId);
  if (!account) throw new Error('Installment account not found');

  const receiptNo = `CLOSE-${Date.now().toString().slice(-5)}`;
  const today = new Date().toISOString().split('T')[0];
  const previousBalance = roundMoney(account.remainingBalance);
  const paid = roundMoney(Math.max(0, settlementAmount));

  account.schedule.forEach(item => {
    if (item.status !== 'Paid') {
      item.paidAmount = item.totalDue;
      item.remainingAmount = 0;
      item.status = 'Paid';
      item.paidDate = today;
      item.receiptNo = receiptNo;
    }
  });

  account.totalReceived = roundMoney(account.totalReceived + paid);
  account.remainingBalance = 0;
  account.status = 'Closed Early';
  account.notes = notes || `Closed early with settlement PKR ${paid.toLocaleString()} (Prior bal: PKR ${previousBalance.toLocaleString()})`;

  const batchOps: BatchWriteOp[] = [{ collection: 'installments', id: account.id, data: { ...account, orgId: ORG_ID } }];

  const cust = db.customers.find(c => c.id === account.customerId);
  if (cust) {
    cust.currentBalance = Math.max(0, roundMoney(cust.currentBalance - previousBalance));
    batchOps.push({ collection: 'customers', id: cust.id, data: { ...cust, orgId: ORG_ID } });
  }

  if (paid > 0) {
    const voucher = buildInstallmentReceiptVoucher(account, receiptNo, paid, paymentMethod, user.name, uid);
    db.accounts = applyVoucherToAccounts(db.accounts, voucher.entries);
    db.vouchers.unshift(voucher);
    batchOps.push({ collection: 'vouchers', id: voucher.id, data: { ...voucher, orgId: ORG_ID } });
    for (const entry of voucher.entries) {
      const acc = db.accounts.find(a => a.id === entry.accountId);
      if (acc) batchOps.push({ collection: 'accounts', id: acc.id, data: { ...acc, orgId: ORG_ID } });
    }
  }

  saveDatabase(db);
  persistBatchIfLive(batchOps);
  logAuditAction('Installments', 'Early Account Closure', `Closed account #${account.accountNumber} early. Settlement: PKR ${paid.toLocaleString()}`, account.id);
  return { receiptNo, updatedAccount: { ...account } };
}

export function updateInstallmentAccountDetails(
  accountId: string,
  updates: Partial<
    Pick<
      InstallmentAccount,
      | 'guarantor1Name'
      | 'guarantor1Phone'
      | 'guarantor1Cnic'
      | 'guarantor1Relation'
      | 'guarantor2Name'
      | 'guarantor2Phone'
      | 'guarantor2Cnic'
      | 'guarantor2Relation'
      | 'guarantor2Address'
      | 'locationSector'
      | 'mobile2'
      | 'profession'
      | 'referenceName'
      | 'slipNo'
      | 'commitmentDate'
      | 'recoveryOfficerId'
      | 'recoveryOfficerName'
      | 'status'
      | 'notes'
    >
  >
): InstallmentAccount | null {
  const db = getDatabase();
  const account = db.installments.find(a => a.id === accountId);
  if (!account) return null;
  Object.assign(account, updates, { updatedAt: new Date().toISOString() });
  saveDatabase(db);
  persistBatchIfLive([{ collection: 'installments', id: account.id, data: { ...account, orgId: ORG_ID } }]);
  logAuditAction('Installments', 'Update Account Plan', `Updated plan details for #${account.accountNumber}`, account.id);
  return { ...account };
}

export function rescheduleInstallmentPlan(
  accountId: string,
  newTenureMonths: number,
  newStartDueDate: string,
  reason: string
): InstallmentAccount {
  const db = getDatabase();
  const user = getActiveUser();
  const account = db.installments.find(a => a.id === accountId);
  if (!account) throw new Error('Installment account not found');
  if (account.status === 'Completed' || account.status === 'Closed Early') {
    throw new Error('Completed or early-closed installment plans cannot be rescheduled.');
  }

  const remainingTenure = Math.max(1, Math.min(48, Math.round(Number(newTenureMonths) || 6)));
  const remainingTotal = roundMoney(account.remainingBalance);
  if (remainingTotal <= 0) {
    throw new Error('Account has zero remaining balance to reschedule.');
  }

  const paidRows = account.schedule.filter(s => s.status === 'Paid');
  const paidMarkupSum = roundMoney(paidRows.reduce((s, r) => s + r.markupAmount, 0));
  const remainingMarkupTotal = Math.max(0, roundMoney(account.markupAmount - paidMarkupSum));
  const remainingPrincipalTotal = Math.max(0, roundMoney(remainingTotal - remainingMarkupTotal));

  const perInstallmentTotal = Math.round(remainingTotal / remainingTenure);
  const perInstallmentPrincipal = Math.round(remainingPrincipalTotal / remainingTenure);
  const perInstallmentMarkup = perInstallmentTotal - perInstallmentPrincipal;

  const baseDate = new Date(newStartDueDate || new Date().toISOString().split('T')[0]);
  const startNo = paidRows.length + 1;
  const newPendingRows = Array.from({ length: remainingTenure }, (_, idx) => {
    const due = new Date(baseDate);
    due.setMonth(due.getMonth() + idx);
    const isLast = idx === remainingTenure - 1;
    const allocatedPriorTotal = perInstallmentTotal * idx;
    const totalDue = isLast ? roundMoney(remainingTotal - allocatedPriorTotal) : perInstallmentTotal;
    const markupAmt = isLast
      ? Math.max(0, roundMoney(remainingMarkupTotal - perInstallmentMarkup * idx))
      : Math.max(0, perInstallmentMarkup);
    const principalAmt = Math.max(0, roundMoney(totalDue - markupAmt));
    return {
      installmentNumber: startNo + idx,
      dueDate: due.toISOString().split('T')[0],
      principalAmount: principalAmt,
      markupAmount: markupAmt,
      totalDue,
      paidAmount: 0,
      remainingAmount: totalDue,
      status: 'Upcoming' as const,
    };
  });

  const previousMonthly = account.monthlyInstallment;
  const previousTenure = account.durationMonths;
  account.schedule = [...paidRows, ...newPendingRows];
  account.durationMonths = paidRows.length + remainingTenure;
  account.monthlyInstallment = perInstallmentTotal;
  account.status = 'Active';
  account.rescheduleHistory = [
    ...(account.rescheduleHistory || []),
    {
      date: new Date().toISOString().split('T')[0],
      reason: reason || 'Customer payment plan rescheduling',
      previousMonthly,
      newMonthly: perInstallmentTotal,
      previousTenure,
      newTenure: account.durationMonths,
      by: user.name,
    },
  ];
  (account as any).updatedAt = new Date().toISOString();

  saveDatabase(db);
  persistBatchIfLive([{ collection: 'installments', id: account.id, data: { ...account, orgId: ORG_ID } }]);
  logAuditAction(
    'Installments',
    'Reschedule Plan',
    `Rescheduled #${account.accountNumber} (${account.customerName}) to ${remainingTenure} remaining months @ PKR ${perInstallmentTotal.toLocaleString()}/mo. Reason: ${reason}`,
    account.id
  );
  return { ...account };
}

export function getInstallmentCommitments(): InstallmentCommitment[] {
  return [...(getDatabase().installmentCommitments || [])].sort((a, b) => a.commitmentDate.localeCompare(b.commitmentDate));
}

export function saveInstallmentCommitment(
  commitment: Omit<InstallmentCommitment, 'id' | 'createdAt' | 'orgId' | 'createdByUid'>
): InstallmentCommitment {
  const db = getDatabase();
  const uid = getActorUid();
  if (!db.installmentCommitments) db.installmentCommitments = [];
  const record: InstallmentCommitment = {
    ...commitment,
    id: sanitizeDocId(`CMT-${Date.now()}-${Math.floor(Math.random() * 1000)}`),
    orgId: ORG_ID,
    createdByUid: uid,
    createdAt: new Date().toISOString().split('T')[0],
  };
  db.installmentCommitments.unshift(record);

  const account = db.installments.find(i => i.id === commitment.installmentAccountId);
  const ops: BatchWriteOp[] = [{ collection: 'installmentCommitments', id: record.id, data: record }];
  if (account) {
    account.commitmentDate = commitment.commitmentDate;
    (account as any).updatedAt = new Date().toISOString();
    ops.push({ collection: 'installments', id: account.id, data: { ...account, orgId: ORG_ID } });
  }

  saveDatabase(db);
  persistBatchIfLive(ops);
  logAuditAction('Installments', 'Log Commitment', `Logged payment commitment PKR ${record.promisedAmount.toLocaleString()} due ${record.commitmentDate} for ${record.customerName}`, record.id);
  return record;
}

export function updateCommitmentStatus(commitmentId: string, status: InstallmentCommitment['status']): void {
  const db = getDatabase();
  const target = (db.installmentCommitments || []).find(c => c.id === commitmentId);
  if (!target) return;
  target.status = status;
  saveDatabase(db);
  persistBatchIfLive([{ collection: 'installmentCommitments', id: target.id, data: { ...target, orgId: ORG_ID } }]);
  logAuditAction('Installments', 'Update Commitment', `Marked commitment ${target.id} as ${status}`, target.id);
}

// ---------------- ACCOUNTS, VOUCHERS & LEDGERS ----------------

export function getChartOfAccounts(): AccountHead[] {
  return getDatabase().accounts;
}

export function saveAccountHead(account: AccountHead): void {
  const db = getDatabase();
  const payload = { ...account, id: sanitizeDocId(account.id), orgId: ORG_ID };
  const idx = db.accounts.findIndex(a => a.id === payload.id);
  if (idx >= 0) {
    db.accounts[idx] = payload;
  } else {
    db.accounts.push(payload);
  }
  saveDatabase(db);
  persistBatchIfLive([{ collection: 'accounts', id: payload.id, data: payload }]);
  logAuditAction('Accounting', 'Chart of Accounts', `Saved account head: ${payload.name} (${payload.code})`, payload.id);
}

export function getVouchers(): Voucher[] {
  return getDatabase().vouchers;
}

export function createVoucher(voucher: Omit<Voucher, 'id' | 'createdBy' | 'status'>): Voucher {
  const db = getDatabase();
  const user = getActiveUser();
  const uid = getActorUid();

  const check = sumVoucherSides(voucher.entries);
  if (!check.isBalanced) {
    throw new Error(`Double entry unbalanced! Total Debits (PKR ${check.debit}) must equal Total Credits (PKR ${check.credit})`);
  }

  const newVoucher: Voucher = {
    ...voucher,
    id: sanitizeDocId(voucher.voucherNumber || `VOUCH-${Date.now().toString().slice(-5)}`),
    orgId: ORG_ID,
    createdByUid: uid,
    createdBy: user.name,
    status: 'Posted',
  };

  db.accounts = applyVoucherToAccounts(db.accounts, newVoucher.entries);
  const batchOps: BatchWriteOp[] = [{ collection: 'vouchers', id: newVoucher.id, data: newVoucher }];
  for (const entry of newVoucher.entries) {
    const acc = db.accounts.find(a => a.id === entry.accountId);
    if (acc) batchOps.push({ collection: 'accounts', id: acc.id, data: { ...acc, orgId: ORG_ID } });
  }

  // Synchronize standalone party voucher with Customer / Supplier balances
  if (newVoucher.partyId && newVoucher.partyType === 'Customer' && !newVoucher.sourceRef) {
    const cust = db.customers.find(c => c.id === newVoucher.partyId);
    if (cust) {
      if (newVoucher.voucherType === 'Receive Voucher') {
        cust.currentBalance = roundMoney(cust.currentBalance - newVoucher.amount);
      } else if (newVoucher.voucherType === 'Payment Voucher') {
        cust.currentBalance = roundMoney(cust.currentBalance + newVoucher.amount);
      }
      batchOps.push({ collection: 'customers', id: cust.id, data: { ...cust, orgId: ORG_ID } });
    }
  } else if (newVoucher.partyId && newVoucher.partyType === 'Supplier' && !newVoucher.sourceRef) {
    const supp = db.suppliers.find(s => s.id === newVoucher.partyId);
    if (supp) {
      if (newVoucher.voucherType === 'Payment Voucher') {
        supp.currentBalance = roundMoney(supp.currentBalance - newVoucher.amount);
      } else if (newVoucher.voucherType === 'Receive Voucher') {
        supp.currentBalance = roundMoney(supp.currentBalance + newVoucher.amount);
      }
      batchOps.push({ collection: 'suppliers', id: supp.id, data: { ...supp, orgId: ORG_ID } });
    }
  }

  db.vouchers.unshift(newVoucher);
  saveDatabase(db);
  persistBatchIfLive(batchOps);
  logAuditAction('Accounting', 'Post Voucher', `Posted ${newVoucher.voucherType} #${newVoucher.voucherNumber} amount PKR ${newVoucher.amount.toLocaleString()}`, newVoucher.id);
  return newVoucher;
}

export function reverseVoucher(voucherId: string, reason: string): Voucher {
  const db = getDatabase();
  const user = getActiveUser();
  const uid = getActorUid();
  const original = db.vouchers.find(v => v.id === voucherId);
  if (!original) {
    throw new Error('Voucher not found.');
  }
  if (original.status === 'Cancelled' || original.reversedByVoucherId) {
    throw new Error(`Voucher ${original.voucherNumber} has already been reversed/cancelled.`);
  }

  const reversal = buildReversalVoucher(original, reason, user.name, uid);
  db.accounts = applyVoucherToAccounts(db.accounts, reversal.entries);
  original.status = 'Cancelled';
  original.reversedByVoucherId = reversal.id;

  const batchOps: BatchWriteOp[] = [
    { collection: 'vouchers', id: original.id, data: { ...original, orgId: ORG_ID } },
    { collection: 'vouchers', id: reversal.id, data: { ...reversal, orgId: ORG_ID } },
  ];

  for (const entry of reversal.entries) {
    const acc = db.accounts.find(a => a.id === entry.accountId);
    if (acc) batchOps.push({ collection: 'accounts', id: acc.id, data: { ...acc, orgId: ORG_ID } });
  }

  if (original.partyId && !original.sourceRef) {
    if (original.partyType === 'Customer') {
      const cust = db.customers.find(c => c.id === original.partyId);
      if (cust) {
        if (original.voucherType === 'Receive Voucher') {
          cust.currentBalance = roundMoney(cust.currentBalance + original.amount);
        } else if (original.voucherType === 'Payment Voucher') {
          cust.currentBalance = roundMoney(cust.currentBalance - original.amount);
        }
        batchOps.push({ collection: 'customers', id: cust.id, data: { ...cust, orgId: ORG_ID } });
      }
    } else if (original.partyType === 'Supplier') {
      const supp = db.suppliers.find(s => s.id === original.partyId);
      if (supp) {
        if (original.voucherType === 'Payment Voucher') {
          supp.currentBalance = roundMoney(supp.currentBalance + original.amount);
        } else if (original.voucherType === 'Receive Voucher') {
          supp.currentBalance = roundMoney(supp.currentBalance - original.amount);
        }
        batchOps.push({ collection: 'suppliers', id: supp.id, data: { ...supp, orgId: ORG_ID } });
      }
    }
  }

  db.vouchers.unshift(reversal);
  saveDatabase(db);
  persistBatchIfLive(batchOps);
  logAuditAction('Accounting', 'Reverse Voucher', `Reversed voucher #${original.voucherNumber} via #${reversal.voucherNumber}. Reason: ${reason}`, original.id);
  return reversal;
}

export function getCustomerLedgerEntries(customerId: string): LedgerEntry[] {
  const db = getDatabase();
  const cust = db.customers.find(c => c.id === customerId);
  if (!cust) return [];

  const rawRows: (Omit<LedgerEntry, 'balance'> & { sortOrder: number })[] = [];

  rawRows.push({
    id: 'op-1',
    date: cust.createdAt,
    voucherNo: 'OPENING',
    voucherType: 'Opening Balance',
    description: 'Account Opening Balance',
    debit: cust.openingBalance > 0 ? cust.openingBalance : 0,
    credit: cust.openingBalance < 0 ? Math.abs(cust.openingBalance) : 0,
    partyId: customerId,
    partyType: 'Customer',
    sortOrder: 0,
  });

  const coveredSourceRefs = new Set<string>();

  db.sales
    .filter(s => s.customerId === customerId && s.status !== 'Cancelled')
    .forEach(s => {
      coveredSourceRefs.add(s.id);
      rawRows.push({
        id: `sale-${s.id}`,
        date: s.date,
        voucherNo: s.invoiceNumber,
        voucherType: 'Sales Invoice',
        description: `Sold: ${s.items.map(i => `${i.productName} (x${i.quantity})`).join(', ')}`,
        debit: roundMoney(s.grandTotal),
        credit: 0,
        partyId: customerId,
        partyType: 'Customer',
        sortOrder: 1,
      });

      if (s.paidAmount > 0) {
        rawRows.push({
          id: `pay-${s.id}`,
          date: s.date,
          voucherNo: s.invoiceNumber,
          voucherType: 'Receipt / Payment',
          description: `Payment received via ${s.paymentMethod}`,
          debit: 0,
          credit: roundMoney(s.paidAmount),
          partyId: customerId,
          partyType: 'Customer',
          sortOrder: 2,
        });
      }
    });

  (db.salesReturns || [])
    .filter(r => r.customerId === customerId && r.refundMethod === 'Credit Note')
    .forEach(r => {
      coveredSourceRefs.add(r.id);
      rawRows.push({
        id: `srtn-${r.id}`,
        date: r.date,
        voucherNo: r.returnNumber,
        voucherType: 'Sales Return',
        description: `Credit Note for Invoice #${r.originalInvoiceNo}`,
        debit: 0,
        credit: roundMoney(r.grandTotal),
        partyId: customerId,
        partyType: 'Customer',
        sortOrder: 3,
      });
    });

  (db.installments || [])
    .filter(i => i.customerId === customerId)
    .forEach(inst => {
      coveredSourceRefs.add(inst.id);
    });

  db.vouchers
    .filter(
      v =>
        v.partyId === customerId &&
        v.status !== 'Cancelled' &&
        !coveredSourceRefs.has(v.sourceRef || '') &&
        !v.sourceRef?.startsWith('INV-') &&
        !v.sourceRef?.startsWith('REV-')
    )
    .forEach(v => {
      const isBounceOrCharge =
        v.voucherType === 'Payment Voucher' ||
        v.sourceRef?.startsWith('BOUNCE-') ||
        v.entries.some(
          e =>
            (e.accountId === ACCOUNT_IDS.ACCOUNTS_RECEIVABLE || e.accountId === ACCOUNT_IDS.INSTALLMENT_RECEIVABLE) &&
            e.debit > 0
        );
      rawRows.push({
        id: `vouch-${v.id}`,
        date: v.date,
        voucherNo: v.voucherNumber,
        voucherType: v.voucherType,
        description: v.narration,
        debit: isBounceOrCharge ? roundMoney(v.amount) : 0,
        credit: isBounceOrCharge ? 0 : roundMoney(v.amount),
        partyId: customerId,
        partyType: 'Customer',
        sortOrder: 4,
      });
    });

  rawRows.sort((a, b) => a.date.localeCompare(b.date) || a.sortOrder - b.sortOrder);

  let runningBalance = 0;
  return rawRows.map(({ sortOrder: _s, ...row }) => {
    runningBalance = roundMoney(runningBalance + row.debit - row.credit);
    return { ...row, balance: runningBalance };
  });
}

export function getSupplierLedgerEntries(supplierId: string): LedgerEntry[] {
  const db = getDatabase();
  const supp = db.suppliers.find(s => s.id === supplierId);
  if (!supp) return [];

  const rawRows: (Omit<LedgerEntry, 'balance'> & { sortOrder: number })[] = [];

  rawRows.push({
    id: 'op-supp-1',
    date: supp.createdAt,
    voucherNo: 'OPENING',
    voucherType: 'Opening Balance',
    description: 'Initial Opening Balance',
    debit: supp.openingBalance < 0 ? Math.abs(supp.openingBalance) : 0,
    credit: supp.openingBalance > 0 ? supp.openingBalance : 0,
    partyId: supplierId,
    partyType: 'Supplier',
    sortOrder: 0,
  });

  const coveredSourceRefs = new Set<string>();

  db.purchases
    .filter(p => p.supplierId === supplierId && p.status !== 'Draft')
    .forEach(p => {
      coveredSourceRefs.add(p.id);
      rawRows.push({
        id: `pur-${p.id}`,
        date: p.date,
        voucherNo: p.invoiceNumber,
        voucherType: 'Purchase Invoice',
        description: `Purchased: ${p.items.map(i => `${i.productName} (x${i.quantity})`).join(', ')}`,
        debit: 0,
        credit: roundMoney(p.grandTotal),
        partyId: supplierId,
        partyType: 'Supplier',
        sortOrder: 1,
      });

      if (p.paidAmount > 0) {
        rawRows.push({
          id: `pur-pay-${p.id}`,
          date: p.date,
          voucherNo: p.invoiceNumber,
          voucherType: 'Payment Voucher',
          description: `Paid via ${p.paymentMethod}`,
          debit: roundMoney(p.paidAmount),
          credit: 0,
          partyId: supplierId,
          partyType: 'Supplier',
          sortOrder: 2,
        });
      }
    });

  (db.purchaseReturns || [])
    .filter(r => r.supplierId === supplierId && r.refundMethod === 'Deduct Payable')
    .forEach(r => {
      coveredSourceRefs.add(r.id);
      rawRows.push({
        id: `prtn-${r.id}`,
        date: r.date,
        voucherNo: r.returnNumber,
        voucherType: 'Purchase Return',
        description: `Debit Note against Purchase #${r.originalPurchaseNo}`,
        debit: roundMoney(r.grandTotal),
        credit: 0,
        partyId: supplierId,
        partyType: 'Supplier',
        sortOrder: 3,
      });
    });

  db.vouchers
    .filter(
      v =>
        v.partyId === supplierId &&
        v.status !== 'Cancelled' &&
        !coveredSourceRefs.has(v.sourceRef || '') &&
        !v.sourceRef?.startsWith('PINV-') &&
        !v.sourceRef?.startsWith('REV-')
    )
    .forEach(v => {
      const isCreditPayableIncrease =
        v.voucherType === 'Receive Voucher' ||
        v.sourceRef?.startsWith('BOUNCE-') ||
        v.entries.some(e => e.accountId === ACCOUNT_IDS.ACCOUNTS_PAYABLE && e.credit > 0);
      rawRows.push({
        id: `vouch-supp-${v.id}`,
        date: v.date,
        voucherNo: v.voucherNumber,
        voucherType: v.voucherType,
        description: v.narration,
        debit: isCreditPayableIncrease ? 0 : roundMoney(v.amount),
        credit: isCreditPayableIncrease ? roundMoney(v.amount) : 0,
        partyId: supplierId,
        partyType: 'Supplier',
        sortOrder: 4,
      });
    });

  rawRows.sort((a, b) => a.date.localeCompare(b.date) || a.sortOrder - b.sortOrder);

  let runningBalance = 0;
  return rawRows.map(({ sortOrder: _s, ...row }) => {
    runningBalance = roundMoney(runningBalance + row.credit - row.debit);
    return { ...row, balance: runningBalance };
  });
}

// ---------------- CHEQUES ----------------

export function getCheques(): ChequeRecord[] {
  return getDatabase().cheques;
}

export function saveCheque(cheque: ChequeRecord): void {
  const db = getDatabase();
  const payload = { ...cheque, id: sanitizeDocId(cheque.id), orgId: ORG_ID };
  const idx = db.cheques.findIndex(c => c.id === payload.id);
  if (idx >= 0) {
    db.cheques[idx] = payload;
    logAuditAction('Cheques', 'Update Cheque', `Updated cheque #${payload.chequeNumber} status: ${payload.status}`, payload.id);
  } else {
    db.cheques.unshift(payload);
    logAuditAction('Cheques', 'New Cheque', `Recorded ${payload.type} cheque #${payload.chequeNumber} amount PKR ${payload.amount.toLocaleString()}`, payload.id);
  }
  saveDatabase(db);
  persistBatchIfLive([{ collection: 'cheques', id: payload.id, data: payload }]);
}

export function clearChequeWithAccounting(chequeId: string, clearanceDate: string, bankAccountId?: string): boolean {
  const db = getDatabase();
  const user = getActiveUser();
  const uid = getActorUid();
  const cheque = db.cheques.find(c => c.id === chequeId);
  if (!cheque || cheque.status === 'Cleared') return false;

  cheque.status = 'Cleared';
  cheque.clearanceDate = clearanceDate;
  if (bankAccountId) cheque.bankAccountId = bankAccountId;

  const bankAcc = db.accounts.find(a => a.id === (bankAccountId || cheque.bankAccountId || ACCOUNT_IDS.MEEZAN_BANK));
  const voucher = buildChequeClearanceVoucher(
    cheque,
    clearanceDate,
    user.name,
    uid,
    bankAcc ? { id: bankAcc.id, name: bankAcc.name } : undefined
  );
  db.accounts = applyVoucherToAccounts(db.accounts, voucher.entries);
  db.vouchers.unshift(voucher);

  const batchOps: BatchWriteOp[] = [
    { collection: 'cheques', id: cheque.id, data: { ...cheque, orgId: ORG_ID } },
    { collection: 'vouchers', id: voucher.id, data: { ...voucher, orgId: ORG_ID } },
  ];
  for (const entry of voucher.entries) {
    const acc = db.accounts.find(a => a.id === entry.accountId);
    if (acc) batchOps.push({ collection: 'accounts', id: acc.id, data: { ...acc, orgId: ORG_ID } });
  }

  if (cheque.partyId) {
    if (cheque.type === 'Received') {
      const cust = db.customers.find(c => c.id === cheque.partyId);
      if (cust) {
        cust.currentBalance = Math.max(0, roundMoney(cust.currentBalance - cheque.amount));
        batchOps.push({ collection: 'customers', id: cust.id, data: { ...cust, orgId: ORG_ID } });
      }
    } else {
      const supp = db.suppliers.find(s => s.id === cheque.partyId);
      if (supp) {
        supp.currentBalance = Math.max(0, roundMoney(supp.currentBalance - cheque.amount));
        batchOps.push({ collection: 'suppliers', id: supp.id, data: { ...supp, orgId: ORG_ID } });
      }
    }
  }

  saveDatabase(db);
  persistBatchIfLive(batchOps);
  logAuditAction('Cheques', 'Clear Cheque', `Cheque #${cheque.chequeNumber} (${cheque.type}) cleared through ${bankAcc?.name || cheque.bankName} for PKR ${cheque.amount.toLocaleString()}`, cheque.id);
  return true;
}

export function bounceChequeWithAccounting(chequeId: string, bounceDate: string, reason?: string): boolean {
  const db = getDatabase();
  const user = getActiveUser();
  const uid = getActorUid();
  const cheque = db.cheques.find(c => c.id === chequeId);
  if (!cheque || cheque.status === 'Bounced' || cheque.status === 'Cancelled') return false;

  const wasCleared = cheque.status === 'Cleared';
  cheque.status = 'Bounced';
  cheque.clearanceDate = bounceDate;
  cheque.reconciled = false;
  if (reason) {
    cheque.remarks = `${cheque.remarks ? `${cheque.remarks} | ` : ''}[Bounced: ${reason}]`;
  }

  const batchOps: BatchWriteOp[] = [
    { collection: 'cheques', id: cheque.id, data: { ...cheque, orgId: ORG_ID } },
  ];

  if (wasCleared) {
    const bankAcc = db.accounts.find(a => a.id === (cheque.bankAccountId || ACCOUNT_IDS.MEEZAN_BANK));
    const voucher = buildChequeBounceVoucher(
      cheque,
      bounceDate,
      user.name,
      uid,
      bankAcc ? { id: bankAcc.id, name: bankAcc.name } : undefined
    );
    db.accounts = applyVoucherToAccounts(db.accounts, voucher.entries);
    db.vouchers.unshift(voucher);
    batchOps.push({ collection: 'vouchers', id: voucher.id, data: { ...voucher, orgId: ORG_ID } });
    for (const entry of voucher.entries) {
      const acc = db.accounts.find(a => a.id === entry.accountId);
      if (acc) batchOps.push({ collection: 'accounts', id: acc.id, data: { ...acc, orgId: ORG_ID } });
    }

    if (cheque.partyId) {
      if (cheque.type === 'Received') {
        const cust = db.customers.find(c => c.id === cheque.partyId);
        if (cust) {
          cust.currentBalance = roundMoney(cust.currentBalance + cheque.amount);
          batchOps.push({ collection: 'customers', id: cust.id, data: { ...cust, orgId: ORG_ID } });
        }
      } else {
        const supp = db.suppliers.find(s => s.id === cheque.partyId);
        if (supp) {
          supp.currentBalance = roundMoney(supp.currentBalance + cheque.amount);
          batchOps.push({ collection: 'suppliers', id: supp.id, data: { ...supp, orgId: ORG_ID } });
        }
      }
    }
  }

  saveDatabase(db);
  persistBatchIfLive(batchOps);
  logAuditAction('Cheques', 'Bounce Cheque', `Marked ${cheque.type} cheque #${cheque.chequeNumber} as Bounced.${wasCleared ? ' Reversal entry posted.' : ''} ${reason || ''}`, cheque.id);
  return true;
}

export function reconcileCheque(chequeId: string, reconciledDate: string, reconciled: boolean = true): boolean {
  const db = getDatabase();
  const cheque = db.cheques.find(c => c.id === chequeId);
  if (!cheque) return false;
  cheque.reconciled = reconciled;
  cheque.reconciledDate = reconciled ? reconciledDate : undefined;
  saveDatabase(db);
  persistBatchIfLive([{ collection: 'cheques', id: cheque.id, data: { ...cheque, orgId: ORG_ID } }]);
  logAuditAction('Cheques', 'Reconcile Cheque', `${reconciled ? 'Reconciled' : 'Unreconciled'} cheque #${cheque.chequeNumber} on ${reconciledDate}`, cheque.id);
  return true;
}

// ---------------- TARGETS ----------------

export function getTargets(): Target[] {
  const db = getDatabase();
  return db.targets.map(t => {
    let actualAchieved = 0;
    if (t.targetType === 'Sales') {
      const monthSales = db.sales.filter(s => s.date.startsWith(t.monthYear));
      if (t.assignedTo === 'Showroom Overall' || t.assignedTo === 'Showroom') {
        actualAchieved = monthSales.reduce((sum, s) => sum + s.grandTotal, 0);
      } else {
        actualAchieved = monthSales.filter(s => s.salesPerson === t.assignedTo).reduce((sum, s) => sum + s.grandTotal, 0);
      }
    } else if (t.targetType === 'Recovery') {
      const monthInstallments = db.installments.filter(inst => {
        if (t.assignedTo === 'Showroom Overall' || t.assignedTo === 'Showroom') return true;
        return inst.recoveryOfficerName === t.assignedTo || inst.recoveryOfficerId === t.assignedTo;
      });
      actualAchieved = monthInstallments.reduce((sum, inst) => {
        const monthPaid = inst.schedule
          .filter(s => s.paidDate && s.paidDate.startsWith(t.monthYear))
          .reduce((itemSum, s) => itemSum + s.paidAmount, 0);
        return sum + monthPaid;
      }, 0);
    }

    const isAchieved = actualAchieved >= t.targetAmount && t.targetAmount > 0;
    return {
      ...t,
      achievedAmount: actualAchieved,
      status: isAchieved ? 'Achieved' : 'In Progress',
    };
  });
}

export function saveTarget(target: Target): void {
  const db = getDatabase();
  const payload = { ...target, id: sanitizeDocId(target.id), orgId: ORG_ID };
  const idx = db.targets.findIndex(t => t.id === payload.id);
  if (idx >= 0) {
    db.targets[idx] = payload;
  } else {
    db.targets.push(payload);
  }
  saveDatabase(db);
  persistBatchIfLive([{ collection: 'targets', id: payload.id, data: payload }]);
  logAuditAction('Targets', 'Target Updated', `Saved ${payload.targetType} target for ${payload.assignedTo} (PKR ${payload.targetAmount.toLocaleString()})`, payload.id);
}

// ---------------- REPORTS ANALYTICS HELPERS ----------------

export function getDateWiseProfitReport(startDate?: string, endDate?: string) {
  const db = getDatabase();
  const filteredSales = db.sales.filter(s => {
    if (s.status === 'Returned' || s.status === 'Cancelled') return false;
    if (startDate && s.date < startDate) return false;
    if (endDate && s.date > endDate) return false;
    return true;
  });

  const byDate = new Map<string, { date: string; invoices: number; revenue: number; cogs: number; grossProfit: number }>();
  for (const s of filteredSales) {
    const cogs = roundMoney(s.items.reduce((sum, i) => sum + (i.costPrice || 0) * i.quantity, 0));
    const rev = roundMoney(s.grandTotal);
    const cur = byDate.get(s.date) || { date: s.date, invoices: 0, revenue: 0, cogs: 0, grossProfit: 0 };
    cur.invoices += 1;
    cur.revenue = roundMoney(cur.revenue + rev);
    cur.cogs = roundMoney(cur.cogs + cogs);
    cur.grossProfit = roundMoney(cur.revenue - cur.cogs);
    byDate.set(s.date, cur);
  }
  return Array.from(byDate.values()).sort((a, b) => b.date.localeCompare(a.date));
}

export function getBrandWiseStockReport() {
  const db = getDatabase();
  const byBrand = new Map<string, { brand: string; skuCount: number; totalUnits: number; costValue: number; retailValue: number; potentialMargin: number }>();
  for (const p of db.products) {
    const cur = byBrand.get(p.brand) || { brand: p.brand, skuCount: 0, totalUnits: 0, costValue: 0, retailValue: 0, potentialMargin: 0 };
    cur.skuCount += 1;
    cur.totalUnits += p.stockQuantity;
    cur.costValue = roundMoney(cur.costValue + p.purchasePrice * p.stockQuantity);
    cur.retailValue = roundMoney(cur.retailValue + p.retailPrice * p.stockQuantity);
    cur.potentialMargin = roundMoney(cur.retailValue - cur.costValue);
    byBrand.set(p.brand, cur);
  }
  return Array.from(byBrand.values()).sort((a, b) => b.costValue - a.costValue);
}

export function getMonthlyReceivedReport(monthYear: string) {
  const db = getDatabase();
  const cashSalesReceived = db.sales
    .filter(s => s.date.startsWith(monthYear) && s.paidAmount > 0)
    .map(s => ({
      date: s.date,
      source: 'POS / Sales Spot Receipt',
      ref: s.invoiceNumber,
      party: s.customerName,
      method: s.paymentMethod,
      amount: s.paidAmount,
    }));

  const installmentReceived = db.vouchers
    .filter(v => v.date.startsWith(monthYear) && v.voucherType === 'Receive Voucher')
    .map(v => ({
      date: v.date,
      source: v.narration.includes('Installment') ? 'Installment Recovery' : 'Customer Receive Voucher',
      ref: v.voucherNumber,
      party: v.partyName || 'Customer',
      method: v.paymentMethod || 'Cash',
      amount: v.amount,
    }));

  return [...cashSalesReceived, ...installmentReceived].sort((a, b) => b.date.localeCompare(a.date));
}

export function getCashBookEntries(startDate?: string, endDate?: string): CashBankBookRow[] {
  return getAccountBookEntries(ACCOUNT_IDS.CASH, startDate, endDate);
}

export function getBankBookEntries(bankAccountId: string = ACCOUNT_IDS.MEEZAN_BANK, startDate?: string, endDate?: string): CashBankBookRow[] {
  return getAccountBookEntries(bankAccountId, startDate, endDate);
}

function getAccountBookEntries(accountId: string, startDate?: string, endDate?: string): CashBankBookRow[] {
  const db = getDatabase();
  const raw: Omit<CashBankBookRow, 'runningBalance'>[] = [];

  for (const v of db.vouchers) {
    if (v.status === 'Cancelled') continue;
    if (startDate && v.date < startDate) continue;
    if (endDate && v.date > endDate) continue;
    v.entries.forEach((e, idx) => {
      if (e.accountId === accountId && (e.debit > 0 || e.credit > 0)) {
        raw.push({
          id: `${v.id}-${idx}`,
          date: v.date,
          voucherNo: v.voucherNumber,
          voucherType: v.voucherType,
          accountId: e.accountId,
          accountName: e.accountName,
          partyName: v.partyName || 'Showroom / General',
          narration: e.narration || v.narration,
          receiptDebit: roundMoney(e.debit || 0),
          paymentCredit: roundMoney(e.credit || 0),
        });
      }
    });
  }

  raw.sort((a, b) => a.date.localeCompare(b.date));
  let running = 0;
  return raw.map(row => {
    running = roundMoney(running + row.receiptDebit - row.paymentCredit);
    return { ...row, runningBalance: running };
  });
}

export function getGeneralLedgerEntries(accountId?: string, startDate?: string, endDate?: string): GeneralLedgerRow[] {
  const db = getDatabase();
  const accMap = new Map(db.accounts.map(a => [a.id, a]));
  const raw: Omit<GeneralLedgerRow, 'runningBalance'>[] = [];

  for (const v of db.vouchers) {
    if (v.status === 'Cancelled') continue;
    if (startDate && v.date < startDate) continue;
    if (endDate && v.date > endDate) continue;
    v.entries.forEach((e, idx) => {
      if (accountId && e.accountId !== accountId) return;
      const acc = accMap.get(e.accountId);
      raw.push({
        id: `${v.id}-${idx}`,
        date: v.date,
        voucherNo: v.voucherNumber,
        voucherType: v.voucherType,
        accountId: e.accountId,
        accountCode: acc?.code || '-',
        accountName: acc?.name || e.accountName,
        partyName: v.partyName || 'General',
        narration: e.narration || v.narration,
        debit: roundMoney(e.debit || 0),
        credit: roundMoney(e.credit || 0),
      });
    });
  }

  raw.sort((a, b) => a.date.localeCompare(b.date));
  const runningPerAccount = new Map<string, number>();
  return raw.map(row => {
    const acc = accMap.get(row.accountId);
    const isDebitNormal = !acc || acc.category === 'Asset' || acc.category === 'Expense';
    const prev = runningPerAccount.get(row.accountId) || 0;
    const next = roundMoney(prev + (isDebitNormal ? row.debit - row.credit : row.credit - row.debit));
    runningPerAccount.set(row.accountId, next);
    return { ...row, runningBalance: next };
  });
}

export function getHeadWiseBalanceReport() {
  const accounts = getChartOfAccounts();
  const rows = accounts.map(acc => {
    const isDebitNormal = acc.category === 'Asset' || acc.category === 'Expense';
    const bal = roundMoney(acc.currentBalance);
    return {
      id: acc.id,
      code: acc.code,
      name: acc.name,
      category: acc.category,
      subCategory: acc.subCategory,
      debit: isDebitNormal ? (bal >= 0 ? bal : 0) : bal < 0 ? Math.abs(bal) : 0,
      credit: !isDebitNormal ? (bal >= 0 ? bal : 0) : bal < 0 ? Math.abs(bal) : 0,
      balance: bal,
    };
  });

  const totalDebit = roundMoney(rows.reduce((s, r) => s + r.debit, 0));
  const totalCredit = roundMoney(rows.reduce((s, r) => s + r.credit, 0));
  return {
    rows,
    totalDebit,
    totalCredit,
    isBalanced: Math.abs(totalDebit - totalCredit) < 0.5,
  };
}

export function getBalanceSheetStatement(): BalanceSheetReport {
  const accounts = getChartOfAccounts();
  const toSection = (cat: AccountHead['category']): BalanceSheetSectionRow[] =>
    accounts
      .filter(a => a.category === cat)
      .map(a => ({ id: a.id, code: a.code, name: a.name, subCategory: a.subCategory, balance: roundMoney(a.currentBalance) }));

  const assets = toSection('Asset');
  const liabilities = toSection('Liability');
  const equity = toSection('Equity');

  const incomeTotal = roundMoney(accounts.filter(a => a.category === 'Income').reduce((s, a) => s + a.currentBalance, 0));
  const expenseTotal = roundMoney(accounts.filter(a => a.category === 'Expense').reduce((s, a) => s + a.currentBalance, 0));
  const netIncome = roundMoney(incomeTotal - expenseTotal);

  const assetsTotal = roundMoney(assets.reduce((s, a) => s + a.balance, 0));
  const liabilitiesTotal = roundMoney(liabilities.reduce((s, a) => s + a.balance, 0));
  const equityTotal = roundMoney(equity.reduce((s, a) => s + a.balance, 0) + netIncome);
  const liabilitiesAndEquityTotal = roundMoney(liabilitiesTotal + equityTotal);

  return {
    assets,
    liabilities,
    equity,
    netIncome,
    assetsTotal,
    liabilitiesTotal,
    equityTotal,
    liabilitiesAndEquityTotal,
    isBalanced: Math.abs(assetsTotal - liabilitiesAndEquityTotal) < 0.5,
  };
}

export function getCashFlowStatement(): CashFlowReport {
  const db = getDatabase();
  const cashAccountIds = new Set(
    db.accounts.filter(a => a.subCategory === 'Cash & Bank' || a.id === ACCOUNT_IDS.CASH || a.id === ACCOUNT_IDS.MEEZAN_BANK || a.id === ACCOUNT_IDS.ALFALAH_BANK).map(a => a.id)
  );

  let operatingInflows = 0;
  let operatingOutflows = 0;
  let investingCashFlow = 0;
  let financingCashFlow = 0;

  for (const v of db.vouchers) {
    if (v.status === 'Cancelled') continue;
    let cashDelta = 0;
    let touchesFixedAsset = false;
    let touchesEquity = false;

    for (const e of v.entries) {
      if (cashAccountIds.has(e.accountId)) {
        cashDelta += roundMoney(e.debit - e.credit);
      } else {
        const acc = db.accounts.find(a => a.id === e.accountId);
        if (acc?.subCategory === 'Fixed Assets') touchesFixedAsset = true;
        if (acc?.category === 'Equity') touchesEquity = true;
      }
    }

    if (Math.abs(cashDelta) < 0.01) continue;
    if (touchesFixedAsset) {
      investingCashFlow = roundMoney(investingCashFlow + cashDelta);
    } else if (touchesEquity) {
      financingCashFlow = roundMoney(financingCashFlow + cashDelta);
    } else if (cashDelta > 0) {
      operatingInflows = roundMoney(operatingInflows + cashDelta);
    } else {
      operatingOutflows = roundMoney(operatingOutflows + Math.abs(cashDelta));
    }
  }

  const netOperatingCashFlow = roundMoney(operatingInflows - operatingOutflows);
  const netCashChange = roundMoney(netOperatingCashFlow + investingCashFlow + financingCashFlow);
  const endingCashAndBank = roundMoney(
    db.accounts.filter(a => cashAccountIds.has(a.id)).reduce((s, a) => s + a.currentBalance, 0)
  );

  return {
    operatingInflows,
    operatingOutflows,
    netOperatingCashFlow,
    investingCashFlow,
    financingCashFlow,
    netCashChange,
    endingCashAndBank,
  };
}

export function getInventoryReportsData() {
  const db = getDatabase();
  const products = db.products || [];
  const warehouses = db.warehouses || [];

  const stockValuation = products.map(p => {
    const costValue = roundMoney(p.purchasePrice * p.stockQuantity);
    const retailValue = roundMoney(p.retailPrice * p.stockQuantity);
    const wholesaleValue = roundMoney((p.wholesalePrice ?? p.minSalePrice ?? p.retailPrice) * p.stockQuantity);
    return {
      id: p.id,
      sku: p.sku,
      name: p.name,
      brand: p.brand,
      category: p.category,
      warehouseName: p.warehouseName || 'Main Showroom',
      stockQuantity: p.stockQuantity,
      damagedQuantity: p.damagedQuantity || 0,
      purchasePrice: p.purchasePrice,
      retailPrice: p.retailPrice,
      wholesalePrice: p.wholesalePrice ?? p.minSalePrice ?? p.retailPrice,
      costValue,
      retailValue,
      wholesaleValue,
      potentialMargin: roundMoney(retailValue - costValue),
    };
  });

  const brandWise = getBrandWiseStockReport();

  const catMap = new Map<string, { category: string; models: number; units: number; costValue: number; retailValue: number }>();
  for (const p of products) {
    const cur = catMap.get(p.category) || { category: p.category, models: 0, units: 0, costValue: 0, retailValue: 0 };
    cur.models += 1;
    cur.units += p.stockQuantity;
    cur.costValue = roundMoney(cur.costValue + p.purchasePrice * p.stockQuantity);
    cur.retailValue = roundMoney(cur.retailValue + p.retailPrice * p.stockQuantity);
    catMap.set(p.category, cur);
  }
  const categoryWise = Array.from(catMap.values()).sort((a, b) => b.costValue - a.costValue);

  const lowStockReorder = products.filter(p => p.stockQuantity <= (p.reorderLevel ?? p.minStockLevel));
  const outOfStock = products.filter(p => p.stockQuantity <= 0);
  const serializedUnits = products.flatMap(p =>
    (p.serials || []).map(s => ({
      ...s,
      sku: p.sku,
      brand: p.brand,
      category: p.category,
      engineNumber: p.engineNumber,
      chassisNumber: p.chassisNumber,
    }))
  );
  const damagedAndReturned = products.filter(
    p => (p.damagedQuantity || 0) > 0 || (p.serials || []).some(s => s.status === 'Damaged' || s.status === 'Returned')
  );

  const stockMovementSummary = products.map(p => {
    const qtyPurchased = db.purchases.reduce(
      (s, pur) => s + pur.items.filter(i => i.productId === p.id).reduce((q, i) => q + i.quantity, 0),
      0
    );
    const qtySold = db.sales
      .filter(sa => sa.status !== 'Cancelled')
      .reduce((s, sa) => s + sa.items.filter(i => i.productId === p.id).reduce((q, i) => q + i.quantity, 0), 0);
    const qtyReturned = (db.salesReturns || []).reduce(
      (s, r) => s + r.items.filter(i => i.productId === p.id).reduce((q, i) => q + i.quantity, 0),
      0
    );
    return {
      productId: p.id,
      sku: p.sku,
      name: p.name,
      openingStock: p.openingStock || 0,
      qtyPurchased,
      qtySold,
      qtyReturned,
      closingStock: p.stockQuantity,
    };
  });

  const whMap = new Map<string, { warehouseId: string; warehouseName: string; models: number; units: number; costValue: number }>();
  for (const w of warehouses) {
    whMap.set(w.id, { warehouseId: w.id, warehouseName: w.name, models: 0, units: 0, costValue: 0 });
  }
  for (const p of products) {
    const wId = p.warehouseId || 'MAIN';
    const wName = p.warehouseName || 'Main Showroom';
    const cur = whMap.get(wId) || { warehouseId: wId, warehouseName: wName, models: 0, units: 0, costValue: 0 };
    cur.models += 1;
    cur.units += p.stockQuantity;
    cur.costValue = roundMoney(cur.costValue + p.purchasePrice * p.stockQuantity);
    whMap.set(wId, cur);
  }
  const warehouseWiseStock = Array.from(whMap.values());

  const marginAndPricingAnalysis = products.map(p => {
    const margin = roundMoney(p.retailPrice - p.purchasePrice);
    const marginPct = p.retailPrice > 0 ? Math.round((margin / p.retailPrice) * 1000) / 10 : 0;
    const wholesale = p.wholesalePrice ?? p.minSalePrice ?? p.retailPrice;
    return {
      id: p.id,
      name: p.name,
      brand: p.brand,
      purchasePrice: p.purchasePrice,
      wholesalePrice: wholesale,
      retailPrice: p.retailPrice,
      unitMargin: margin,
      marginPercent: marginPct,
    };
  });

  return {
    stockValuation,
    brandWise,
    categoryWise,
    lowStockReorder,
    outOfStock,
    serializedUnits,
    damagedAndReturned,
    stockMovementSummary,
    warehouseWiseStock,
    marginAndPricingAnalysis,
  };
}

export function getInstallmentReportsData(asOfDate: string = new Date().toISOString().split('T')[0]) {
  const db = getDatabase();
  const accounts = db.installments || [];
  const commitments = db.installmentCommitments || [];

  const activeAccounts = accounts.filter(a => a.status === 'Active');
  const completedAccounts = accounts.filter(a => a.status === 'Completed');
  const closedEarlyAccounts = accounts.filter(a => a.status === 'Closed Early');
  const overdueAccounts = accounts.filter(a => a.status === 'Overdue');
  const defaultedAccounts = accounts.filter(a => a.status === 'Defaulted');

  const horizon30 = new Date(asOfDate);
  horizon30.setDate(horizon30.getDate() + 30);
  const horizonStr = horizon30.toISOString().split('T')[0];

  const upcomingDues = accounts.flatMap(a =>
    a.schedule
      .filter(s => s.status !== 'Paid' && s.dueDate >= asOfDate && s.dueDate <= horizonStr)
      .map(s => ({
        accountNumber: a.accountNumber,
        customerName: a.customerName,
        customerPhone: a.customerPhone,
        officer: a.recoveryOfficerName,
        installmentNumber: s.installmentNumber,
        dueDate: s.dueDate,
        remainingAmount: s.remainingAmount,
      }))
  );

  const dueToday = upcomingDues.filter(u => u.dueDate === asOfDate);

  const officerMap = new Map<string, { officerName: string; accountCount: number; financedTotal: number; collectedTotal: number; remainingTotal: number; overdueCount: number }>();
  for (const a of accounts) {
    const key = a.recoveryOfficerName || 'Unassigned';
    const cur = officerMap.get(key) || { officerName: key, accountCount: 0, financedTotal: 0, collectedTotal: 0, remainingTotal: 0, overdueCount: 0 };
    cur.accountCount += 1;
    cur.financedTotal = roundMoney(cur.financedTotal + a.totalPayableWithDown);
    cur.collectedTotal = roundMoney(cur.collectedTotal + a.totalReceived);
    cur.remainingTotal = roundMoney(cur.remainingTotal + a.remainingBalance);
    if (a.status === 'Overdue' || a.status === 'Defaulted') cur.overdueCount += 1;
    officerMap.set(key, cur);
  }
  const officerPerformance = Array.from(officerMap.values());

  const recoveryCollections = accounts.flatMap(a =>
    a.schedule
      .filter(s => s.paidAmount > 0 && s.paidDate)
      .map(s => ({
        accountNumber: a.accountNumber,
        customerName: a.customerName,
        receiptNo: s.receiptNo || '-',
        paidDate: s.paidDate!,
        installmentNumber: s.installmentNumber,
        paidAmount: s.paidAmount,
        officer: a.recoveryOfficerName,
      }))
  ).sort((a, b) => b.paidDate.localeCompare(a.paidDate));

  const guarantorDirectory = accounts.map(a => ({
    accountNumber: a.accountNumber,
    customerName: a.customerName,
    guarantor1Name: a.guarantor1Name,
    guarantor1Phone: a.guarantor1Phone,
    guarantor1Cnic: a.guarantor1Cnic,
    guarantor1Relation: a.guarantor1Relation,
    guarantor2Name: a.guarantor2Name || '—',
    guarantor2Phone: a.guarantor2Phone || '—',
    guarantor2Cnic: a.guarantor2Cnic || '—',
    guarantor2Relation: a.guarantor2Relation || '—',
  }));

  const sectorMap = new Map<string, { sector: string; accounts: number; totalRemaining: number; overdueAccounts: number }>();
  for (const a of accounts) {
    const sec = a.locationSector || 'General Showroom Area';
    const cur = sectorMap.get(sec) || { sector: sec, accounts: 0, totalRemaining: 0, overdueAccounts: 0 };
    cur.accounts += 1;
    cur.totalRemaining = roundMoney(cur.totalRemaining + a.remainingBalance);
    if (a.status === 'Overdue' || a.status === 'Defaulted') cur.overdueAccounts += 1;
    sectorMap.set(sec, cur);
  }
  const sectorWiseDistribution = Array.from(sectorMap.values());

  const prodMap = new Map<string, { productName: string; count: number; cashTotal: number; markupTotal: number; remaining: number }>();
  for (const a of accounts) {
    const cur = prodMap.get(a.productName) || { productName: a.productName, count: 0, cashTotal: 0, markupTotal: 0, remaining: 0 };
    cur.count += 1;
    cur.cashTotal = roundMoney(cur.cashTotal + a.cashPrice);
    cur.markupTotal = roundMoney(cur.markupTotal + a.markupAmount);
    cur.remaining = roundMoney(cur.remaining + a.remainingBalance);
    prodMap.set(a.productName, cur);
  }
  const productBrandFinanced = Array.from(prodMap.values());

  const markupVsPrincipal = accounts.map(a => {
    const principalPaid = roundMoney(a.schedule.filter(s => s.status === 'Paid').reduce((sum, s) => sum + s.principalAmount, 0) + a.downPayment);
    const markupEarned = roundMoney(a.schedule.filter(s => s.status === 'Paid').reduce((sum, s) => sum + s.markupAmount, 0));
    return {
      accountNumber: a.accountNumber,
      customerName: a.customerName,
      cashPrice: a.cashPrice,
      markupAmount: a.markupAmount,
      principalPaid,
      markupEarned,
      remainingBalance: a.remainingBalance,
    };
  });

  const asOfMs = Date.parse(asOfDate);
  const agingBuckets = [
    { bucket: '1 - 30 Days Overdue', count: 0, amount: 0 },
    { bucket: '31 - 60 Days Overdue', count: 0, amount: 0 },
    { bucket: '61 - 90 Days Overdue', count: 0, amount: 0 },
    { bucket: '90+ Days Overdue', count: 0, amount: 0 },
  ];
  for (const a of accounts) {
    for (const s of a.schedule) {
      if (s.status !== 'Paid' && s.dueDate < asOfDate && s.remainingAmount > 0) {
        const diffDays = Math.floor((asOfMs - Date.parse(s.dueDate)) / (1000 * 60 * 60 * 24));
        const idx = diffDays <= 30 ? 0 : diffDays <= 60 ? 1 : diffDays <= 90 ? 2 : 3;
        agingBuckets[idx].count += 1;
        agingBuckets[idx].amount = roundMoney(agingBuckets[idx].amount + s.remainingAmount);
      }
    }
  }

  const rescheduledPlans = accounts.filter(a => (a.rescheduleHistory?.length || 0) > 0);
  const defaulterFollowUpList = [...overdueAccounts, ...defaultedAccounts].map(a => ({
    accountNumber: a.accountNumber,
    customerName: a.customerName,
    mobile1: a.customerPhone,
    mobile2: a.mobile2 || '—',
    sector: a.locationSector || a.customerAddress,
    remainingBalance: a.remainingBalance,
    commitmentDate: a.commitmentDate || 'None',
    officer: a.recoveryOfficerName,
  }));

  const downPaymentSummary = accounts.map(a => ({
    accountNumber: a.accountNumber,
    customerName: a.customerName,
    cashPrice: a.cashPrice,
    downPayment: a.downPayment,
    downPercent: a.cashPrice > 0 ? Math.round((a.downPayment / a.cashPrice) * 1000) / 10 : 0,
    financedAmount: a.financedAmount,
  }));

  const riskExposureReport = accounts
    .filter(a => a.remainingBalance > 0)
    .map(a => {
      const overdueCount = a.schedule.filter(s => s.status === 'Overdue' || (s.status !== 'Paid' && s.dueDate < asOfDate)).length;
      return {
        accountNumber: a.accountNumber,
        customerName: a.customerName,
        status: a.status,
        overdueInstallments: overdueCount,
        remainingBalance: a.remainingBalance,
        riskTier: a.status === 'Defaulted' || overdueCount >= 2 ? 'HIGH' : overdueCount === 1 ? 'MEDIUM' : 'LOW',
      };
    })
    .sort((a, b) => b.overdueInstallments - a.overdueInstallments || b.remainingBalance - a.remainingBalance);

  const customerPortfolioSummary = accounts.map(a => ({
    accountNumber: a.accountNumber,
    slipNo: a.slipNo || '—',
    customerName: a.customerName,
    profession: a.profession || '—',
    referenceName: a.referenceName || '—',
    totalPayableWithDown: a.totalPayableWithDown,
    totalReceived: a.totalReceived,
    remainingBalance: a.remainingBalance,
    status: a.status,
  }));

  return {
    activeAccounts,
    completedAccounts,
    closedEarlyAccounts,
    overdueAccounts,
    defaultedAccounts,
    upcomingDues,
    dueToday,
    officerPerformance,
    recoveryCollections,
    guarantorDirectory,
    sectorWiseDistribution,
    productBrandFinanced,
    markupVsPrincipal,
    agingBuckets,
    commitmentsSchedule: commitments,
    rescheduledPlans,
    defaulterFollowUpList,
    downPaymentSummary,
    riskExposureReport,
    customerPortfolioSummary,
  };
}

// ---------------- BACKUP, RESTORE & EXPORT ----------------

export function getDatabaseSnapshot(): Record<string, any> {
  const db = getDatabase();
  return {
    settings: db.settings,
    customers: db.customers,
    suppliers: db.suppliers,
    employees: db.employees,
    attendance: db.attendance,
    visitors: db.visitors,
    products: db.products,
    warehouses: db.warehouses,
    stockTransfers: db.stockTransfers,
    stockAdjustments: db.stockAdjustments,
    purchases: db.purchases,
    purchaseReturns: db.purchaseReturns,
    sales: db.sales,
    salesReturns: db.salesReturns,
    installments: db.installments,
    installmentCommitments: db.installmentCommitments,
    accounts: db.accounts,
    vouchers: db.vouchers,
    cheques: db.cheques,
    targets: db.targets,
    tasks: db.tasks,
    auditLogs: db.auditLogs,
  };
}

export function getBackupRecords(): BackupRecord[] {
  const db = getDatabase();
  return [...db.backups].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function addBackupRecord(record: BackupRecord): void {
  const db = getDatabase();
  const normalized: BackupRecord = {
    ...record,
    id: sanitizeDocId(record.id),
    orgId: ORG_ID,
    recordCount: Math.max(0, Math.round(Number(record.recordCount) || 0)),
  };
  db.backups.unshift(normalized);
  saveDatabase(db);
  if (isCloudConnected()) {
    persistCloudDoc('backups', normalized.id, normalized).catch(err => {
      console.warn('Backup metadata write error:', err);
      setCloudSyncError(err?.message || 'Backup metadata could not be saved to Cloud Firestore.');
    });
  }
}

export function exportDatabaseJSON(): string {
  return JSON.stringify(getDatabaseSnapshot(), null, 2);
}

function getRecordTimestampMs(doc: any): number {
  if (!doc || typeof doc !== 'object') return 0;
  const candidate = doc.updatedAt || doc.createdAt || doc.timestamp || doc.lastLogin || doc.date || '';
  if (!candidate || typeof candidate !== 'string') return 0;
  const ms = Date.parse(candidate);
  return Number.isFinite(ms) ? ms : 0;
}

export function importDatabaseJSON(jsonStr: string, options: { overwriteNewer?: boolean } = {}): boolean {
  if (isCloudConnected()) {
    throw new Error('Live Cloud Firestore cannot be overwritten via local JSON import. Use Owner Super Admin -> Disaster Recovery.');
  }
  try {
    const parsed = JSON.parse(jsonStr) as Partial<ErpDatabase>;
    if (!parsed.products || !parsed.sales || !parsed.customers) {
      throw new Error('Invalid ERP backup file structure');
    }
    const db = getDatabase();
    const overwriteNewer = Boolean(options.overwriteNewer);
    const arrayKeys: (keyof ErpDatabase)[] = [
      'customers', 'suppliers', 'employees', 'attendance', 'visitors',
      'products', 'warehouses', 'stockTransfers', 'stockAdjustments',
      'purchases', 'purchaseReturns', 'sales', 'salesReturns',
      'installments', 'installmentCommitments', 'accounts', 'vouchers', 'cheques', 'targets', 'tasks', 'auditLogs',
    ];

    for (const key of arrayKeys) {
      const incomingList = (parsed as any)[key];
      if (!Array.isArray(incomingList)) continue;
      const existingList: any[] = Array.isArray((db as any)[key]) ? [...(db as any)[key]] : [];
      const byId = new Map<string, any>();
      for (const item of existingList) {
        if (item?.id) byId.set(String(item.id), item);
      }
      for (const item of incomingList) {
        if (!item?.id) continue;
        const id = String(item.id);
        const existingItem = byId.get(id);
        if (existingItem && !overwriteNewer) {
          const existingMs = getRecordTimestampMs(existingItem);
          const incomingMs = getRecordTimestampMs(item);
          if (existingMs > 0 && existingMs > incomingMs) {
            continue;
          }
        }
        byId.set(id, item);
      }
      (db as any)[key] = Array.from(byId.values());
    }

    if (parsed.settings && typeof parsed.settings === 'object') {
      const existingSettingsMs = getRecordTimestampMs(db.settings);
      const incomingSettingsMs = getRecordTimestampMs(parsed.settings);
      if (overwriteNewer || existingSettingsMs <= incomingSettingsMs) {
        db.settings = { ...db.settings, ...parsed.settings };
      }
    }

    saveDatabase(db);
    logAuditAction('Backup', 'Database Restored', 'Non-destructive timestamp-aware restore completed from backup JSON');
    return true;
  } catch (err) {
    console.error('Import database failed:', err);
    return false;
  }
}

export function resetToDefaultData(): void {
  clearToProductionEmpty();
  logAuditAction('Backup', 'Database Reset', 'Reset workspace database');
  notifySubscribers();
}

// ---------------- STAFF TASKS & TO-DO MANAGEMENT ----------------

export function getTasks(): StaffTask[] {
  return getDatabase().tasks || [];
}

export function saveTask(task: StaffTask): void {
  const db = getDatabase();
  const uid = getActorUid();
  if (!db.tasks) db.tasks = [];
  const payload: StaffTask & { orgId?: string; createdByUid?: string } = {
    ...task,
    id: sanitizeDocId(task.id),
    orgId: ORG_ID,
    createdByUid: (task as any).createdByUid || uid,
    progressPercent: Math.max(0, Math.min(100, Math.round(Number(task.progressPercent) || 0))),
  };
  const idx = db.tasks.findIndex(t => t.id === payload.id);
  if (idx >= 0) {
    db.tasks[idx] = payload;
  } else {
    db.tasks.unshift(payload);
  }
  saveDatabase(db);
  persistBatchIfLive([{ collection: 'tasks', id: payload.id, data: payload }]);
  logAuditAction('Tasks', 'Task Saved', `Saved task: "${payload.title}" assigned to ${payload.assignedTo}`, payload.id);
}

export function updateTaskStatus(taskId: string, status: TaskStatus, progressPercent?: number): void {
  const db = getDatabase();
  if (!db.tasks) db.tasks = [];
  const task = db.tasks.find(t => t.id === taskId);
  if (task) {
    task.status = status;
    if (progressPercent !== undefined) {
      task.progressPercent = Math.max(0, Math.min(100, Math.round(Number(progressPercent) || 0)));
    } else if (status === 'Completed') {
      task.progressPercent = 100;
      task.completedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
    } else if (status === 'Pending') {
      task.progressPercent = 0;
      task.completedAt = undefined;
    }
    saveDatabase(db);
    persistBatchIfLive([{ collection: 'tasks', id: task.id, data: { ...task, orgId: ORG_ID } }]);
    logAuditAction('Tasks', 'Task Status Updated', `Updated task ${task.id} to ${status} (${task.progressPercent}%)`, task.id);
  }
}

export function deleteTask(taskId: string): void {
  const db = getDatabase();
  if (!db.tasks) db.tasks = [];
  db.tasks = db.tasks.filter(t => t.id !== taskId);
  saveDatabase(db);
  if (isCloudConnected()) {
    deleteCloudDoc('tasks', taskId)
      .then(() => {
        if (lastCloudSyncError !== null) clearLastCloudSyncError();
      })
      .catch(err => {
        console.error('Cloud task deletion error:', err);
        setCloudSyncError(err?.message || 'Could not delete task from Cloud Firestore.');
      });
  }
  logAuditAction('Tasks', 'Task Deleted', `Removed task ${taskId}`, taskId);
}
