export type PermissionAction =
  | 'VIEW'
  | 'CREATE'
  | 'EDIT'
  | 'DELETE'
  | 'EXPORT'
  | 'APPROVE'
  | 'MANAGE';

export const ALL_PERMISSION_ACTIONS: PermissionAction[] = [
  'VIEW',
  'CREATE',
  'EDIT',
  'DELETE',
  'EXPORT',
  'APPROVE',
  'MANAGE',
];

export type ModulePermissionKey =
  | 'dashboard'
  | 'pos'
  | 'salesReturns'
  | 'inventory'
  | 'purchases'
  | 'purchaseReturns'
  | 'installments'
  | 'customers'
  | 'suppliers'
  | 'attendance'
  | 'tasks'
  | 'visitors'
  | 'accounting'
  | 'ledgers'
  | 'cheques'
  | 'reports'
  | 'targets'
  | 'audit'
  | 'settings'
  | 'wordpress'
  | 'admin';

export interface ModuleDefinition {
  key: ModulePermissionKey;
  label: string;
  group: string;
  description: string;
}

export const ERP_MODULE_DEFINITIONS: ModuleDefinition[] = [
  { key: 'dashboard', label: 'Executive Dashboard', group: 'Core Operations', description: 'KPI overview, charts, alerts & trends' },
  { key: 'pos', label: 'Sales & POS Billing', group: 'Core Operations', description: 'Retail/credit invoicing & barcode POS' },
  { key: 'salesReturns', label: 'Sales Returns', group: 'Core Operations', description: 'Customer returns, refunds & credit notes' },
  { key: 'inventory', label: 'Products & Serials', group: 'Core Operations', description: 'Catalog, stock levels, stock ledger & serials' },
  { key: 'purchases', label: 'Purchase Invoices', group: 'Core Operations', description: 'Supplier consignments & landed costs' },
  { key: 'purchaseReturns', label: 'Purchase Returns', group: 'Core Operations', description: 'Vendor return debit notes & stock out' },
  { key: 'installments', label: 'Installments & Recovery', group: 'Core Operations', description: 'Hire-purchase plans, dues & closing' },
  { key: 'customers', label: 'Customers Directory', group: 'People & CRM', description: 'Customer profiles, CNICs & credit limits' },
  { key: 'suppliers', label: 'Suppliers & Vendors', group: 'People & CRM', description: 'Vendor accounts & payable balances' },
  { key: 'attendance', label: 'Staff Attendance', group: 'People & CRM', description: 'Employee roster & daily check-in/out' },
  { key: 'tasks', label: 'Daily Staff Tasks', group: 'People & CRM', description: 'Showroom task assignment & completion' },
  { key: 'visitors', label: 'Visitors Register', group: 'People & CRM', description: 'Walk-in visitor log & departure tracking' },
  { key: 'accounting', label: 'Vouchers & Journals', group: 'Finance & Accounts', description: 'Double-entry vouchers & Chart of Accounts' },
  { key: 'ledgers', label: 'Ledgers & Trial Balance', group: 'Finance & Accounts', description: 'Trial balance, party ledgers & Cash Book' },
  { key: 'cheques', label: 'Cheque Management', group: 'Finance & Accounts', description: 'PDC tracking, clearing & bounce entries' },
  { key: 'reports', label: 'Reports & Analytics', group: 'Analytics & Admin', description: 'Profit reports, brand stock & exports' },
  { key: 'targets', label: 'Targets & Goals', group: 'Analytics & Admin', description: 'Monthly sales & recovery targets' },
  { key: 'audit', label: 'Audit Trail & Backups', group: 'Analytics & Admin', description: 'Immutable audit logs & Excel backups' },
  { key: 'settings', label: 'Showroom Settings', group: 'Analytics & Admin', description: 'Business identity, tax & invoice setup' },
  { key: 'wordpress', label: 'WordPress Backup & Sync', group: 'Analytics & Admin', description: 'Server-side WooCommerce & WP backup' },
  { key: 'admin', label: 'Owner Super Admin & DR', group: 'Security & Governance', description: 'User RBAC, sessions, alerts & recovery' },
];

export type PermissionsMatrix = Partial<Record<ModulePermissionKey, PermissionAction[]>>;

export type ExtendedUserRole =
  | 'Owner'
  | 'Manager'
  | 'Accountant'
  | 'Cashier'
  | 'StockManager'
  | 'RecoveryOfficer'
  | 'Receptionist'
  | 'Custom';

export interface RoleTemplate {
  id: string;
  orgId: string;
  name: string;
  description?: string;
  permissions: PermissionsMatrix;
  isSystem: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export interface UserSession {
  id: string;
  orgId: string;
  uid: string;
  email: string;
  userName: string;
  role: string;
  deviceInfo?: string;
  revoked: boolean;
  createdAt: string;
  lastActiveAt: string;
}

export interface SecurityEvent {
  id: string;
  orgId: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  actorUid: string;
  actorEmail?: string;
  title: string;
  details: string;
  notifiedOwner?: boolean;
  emailStatus?: string;
  createdAt: string;
}

export interface BackupRecord {
  id: string;
  orgId: string;
  type: 'Manual' | 'ScheduledDaily' | 'ScheduledWeekly' | 'ScheduledMonthly' | 'PreRestore';
  format: 'XLSX' | 'CSV' | 'JSON' | 'WordPressMirror';
  recordCount: number;
  checksum: string;
  wpStatus?: string;
  wpRef?: string;
  status: 'Success' | 'Failed' | 'Verified';
  createdAt: string;
  createdBy: string;
  notes?: string;
}

export interface StaffInvite {
  id: string;
  orgId: string;
  email: string;
  name: string;
  role: Exclude<ExtendedUserRole, 'Owner'>;
  customRoleName?: string;
  phone?: string;
  permissions: PermissionsMatrix;
  active: boolean;
  mfaEnabled: boolean;
  invitedBy: string;
  createdAt: string;
}

export interface AdminLoginAudit {
  id: string;
  orgId: string;
  uid: string;
  email: string;
  userName: string;
  role: string;
  eventType: 'ADMIN_LOGIN_SUCCESS' | 'ADMIN_SESSION_RESUME' | 'ADMIN_2FA_PASSED' | 'ADMIN_2FA_FAILED' | 'ADMIN_LOGIN_BLOCKED';
  authMethod: 'Google' | 'Email/Password' | '2FA Email OTP' | '2FA Re-Auth' | 'Session Restore';
  ipAddress: string;
  userAgent?: string;
  status: 'Success' | 'Verified' | 'Failed' | 'Blocked';
  details: string;
  timestamp: string;
}

export const OWNER_EMAIL = 'clientbridge28@gmail.com';
export const SECONDARY_ADMIN_EMAIL = 'wrelectronicsofficial@gmail.com';
export const ADMIN_OWNER_EMAILS: readonly string[] = [
  OWNER_EMAIL,
  SECONDARY_ADMIN_EMAIL,
];
export const MANDATORY_SUPERADMIN_2FA_EMAILS: readonly string[] = [
  SECONDARY_ADMIN_EMAIL,
];

export function isOwnerEmail(email?: string | null): boolean {
  const normalized = String(email || '').trim().toLowerCase();
  return Boolean(normalized && ADMIN_OWNER_EMAILS.includes(normalized));
}

export function requiresMandatorySuperAdmin2FA(email?: string | null): boolean {
  const normalized = String(email || '').trim().toLowerCase();
  return Boolean(normalized && MANDATORY_SUPERADMIN_2FA_EMAILS.includes(normalized));
}

export const ORG_ID = 'al-madina-main';

export function buildFullOwnerPermissions(): PermissionsMatrix {
  const matrix: PermissionsMatrix = {};
  for (const mod of ERP_MODULE_DEFINITIONS) {
    matrix[mod.key] = [...ALL_PERMISSION_ACTIONS];
  }
  return matrix;
}

export function getDefaultPermissionsForRole(role: ExtendedUserRole): PermissionsMatrix {
  if (role === 'Owner') {
    return buildFullOwnerPermissions();
  }
  if (role === 'Manager') {
    return {
      dashboard: ['VIEW', 'EXPORT'],
      pos: ['VIEW', 'CREATE', 'EDIT', 'EXPORT'],
      salesReturns: ['VIEW', 'CREATE', 'APPROVE', 'EXPORT'],
      inventory: ['VIEW', 'CREATE', 'EDIT', 'EXPORT'],
      purchases: ['VIEW', 'CREATE', 'EDIT', 'EXPORT'],
      purchaseReturns: ['VIEW', 'CREATE', 'APPROVE', 'EXPORT'],
      installments: ['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'EXPORT'],
      customers: ['VIEW', 'CREATE', 'EDIT', 'EXPORT'],
      suppliers: ['VIEW', 'CREATE', 'EDIT', 'EXPORT'],
      attendance: ['VIEW', 'CREATE', 'EDIT', 'MANAGE'],
      tasks: ['VIEW', 'CREATE', 'EDIT', 'DELETE'],
      visitors: ['VIEW', 'CREATE', 'EDIT'],
      accounting: ['VIEW', 'CREATE', 'EXPORT'],
      ledgers: ['VIEW', 'EXPORT'],
      cheques: ['VIEW', 'CREATE', 'EDIT'],
      reports: ['VIEW', 'EXPORT'],
      targets: ['VIEW', 'CREATE', 'EDIT'],
      audit: ['VIEW'],
      settings: ['VIEW'],
    };
  }
  if (role === 'Accountant') {
    return {
      dashboard: ['VIEW'],
      pos: ['VIEW'],
      salesReturns: ['VIEW', 'APPROVE'],
      inventory: ['VIEW'],
      purchases: ['VIEW', 'CREATE', 'EDIT'],
      purchaseReturns: ['VIEW', 'CREATE', 'APPROVE'],
      installments: ['VIEW', 'EDIT'],
      customers: ['VIEW', 'EDIT'],
      suppliers: ['VIEW', 'EDIT'],
      attendance: ['VIEW'],
      tasks: ['VIEW', 'CREATE', 'EDIT'],
      accounting: ['VIEW', 'CREATE', 'EDIT', 'APPROVE', 'EXPORT'],
      ledgers: ['VIEW', 'EXPORT'],
      cheques: ['VIEW', 'CREATE', 'EDIT', 'APPROVE'],
      reports: ['VIEW', 'EXPORT'],
      targets: ['VIEW'],
      audit: ['VIEW', 'EXPORT'],
    };
  }
  if (role === 'Cashier') {
    return {
      dashboard: ['VIEW'],
      pos: ['VIEW', 'CREATE', 'EXPORT'],
      salesReturns: ['VIEW', 'CREATE'],
      inventory: ['VIEW'],
      installments: ['VIEW', 'EDIT'],
      customers: ['VIEW', 'CREATE'],
      visitors: ['VIEW', 'CREATE', 'EDIT'],
      tasks: ['VIEW', 'EDIT'],
      cheques: ['VIEW', 'CREATE'],
    };
  }
  if (role === 'StockManager') {
    return {
      dashboard: ['VIEW'],
      inventory: ['VIEW', 'CREATE', 'EDIT', 'EXPORT'],
      purchases: ['VIEW', 'CREATE', 'EDIT'],
      purchaseReturns: ['VIEW', 'CREATE'],
      suppliers: ['VIEW', 'CREATE'],
      tasks: ['VIEW', 'EDIT'],
      reports: ['VIEW'],
    };
  }
  if (role === 'RecoveryOfficer') {
    return {
      dashboard: ['VIEW'],
      installments: ['VIEW', 'CREATE', 'EDIT', 'EXPORT'],
      customers: ['VIEW', 'CREATE', 'EDIT'],
      tasks: ['VIEW', 'EDIT'],
      targets: ['VIEW'],
      reports: ['VIEW'],
    };
  }
  if (role === 'Receptionist') {
    return {
      dashboard: ['VIEW'],
      visitors: ['VIEW', 'CREATE', 'EDIT'],
      attendance: ['VIEW', 'CREATE', 'EDIT'],
      tasks: ['VIEW', 'CREATE', 'EDIT'],
      customers: ['VIEW', 'CREATE'],
    };
  }
  return { dashboard: ['VIEW'] };
}
