import {
  Customer, Supplier, Employee, AttendanceRecord, VisitorRecord,
  Product, PurchaseInvoice, SalesInvoice, InstallmentAccount, 
  Voucher, LedgerEntry, AccountHead, ChequeRecord, Target, AuditLog, 
  ShowroomSettings, User, UserRole, SerialUnit, StaffTask, TaskStatus, TaskPriority,
  SalesReturn, PurchaseReturn
} from '../types/erp';

import {
  initialSettings, initialUsers, initialCustomers, initialSuppliers,
  initialEmployees, initialAttendance, initialVisitors, initialProducts,
  initialPurchases, initialSales, initialInstallments, initialChartOfAccounts,
  initialVouchers, initialCheques, initialTargets, initialAuditLogs, initialTasks
} from './mockData';

const DB_KEY = 'electro_erp_db_v1';
const AUTH_KEY = 'electro_erp_active_user_v1';

interface ErpDatabase {
  settings: ShowroomSettings;
  users: User[];
  customers: Customer[];
  suppliers: Supplier[];
  employees: Employee[];
  attendance: AttendanceRecord[];
  visitors: VisitorRecord[];
  products: Product[];
  purchases: PurchaseInvoice[];
  sales: SalesInvoice[];
  salesReturns: SalesReturn[];
  purchaseReturns: PurchaseReturn[];
  installments: InstallmentAccount[];
  accounts: AccountHead[];
  vouchers: Voucher[];
  cheques: ChequeRecord[];
  targets: Target[];
  auditLogs: AuditLog[];
  tasks: StaffTask[];
}

// Memory cache & subscribers for reactive updates
let dbCache: ErpDatabase | null = null;
const listeners = new Set<() => void>();

function notifySubscribers() {
  listeners.forEach(cb => {
    try { cb(); } catch (e) { console.error('Storage subscriber error:', e); }
  });
}

export function subscribeToDatabase(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const DEMO_MODE_KEY = 'electro_erp_demo_mode_v1';

export function isDemoMode(): boolean {
  return localStorage.getItem(DEMO_MODE_KEY) === 'true';
}

export function setDemoMode(enabled: boolean): void {
  localStorage.setItem(DEMO_MODE_KEY, enabled ? 'true' : 'false');
  if (enabled) {
    seedDemoData();
  } else {
    clearToProductionEmpty();
  }
}

export function seedDemoData(): void {
  localStorage.setItem(DEMO_MODE_KEY, 'true');
  dbCache = {
    settings: initialSettings,
    users: initialUsers,
    customers: initialCustomers,
    suppliers: initialSuppliers,
    employees: initialEmployees,
    attendance: initialAttendance,
    visitors: initialVisitors,
    products: initialProducts,
    purchases: initialPurchases,
    sales: initialSales,
    installments: initialInstallments,
    accounts: initialChartOfAccounts,
    vouchers: initialVouchers,
    cheques: initialCheques,
    targets: initialTargets,
    auditLogs: initialAuditLogs,
    tasks: initialTasks,
    salesReturns: [],
    purchaseReturns: []
  };
  saveDatabase(dbCache);
}

export function clearToProductionEmpty(): void {
  localStorage.setItem(DEMO_MODE_KEY, 'false');
  dbCache = {
    settings: initialSettings,
    users: initialUsers,
    customers: [],
    suppliers: [],
    employees: initialEmployees.slice(0, 2),
    attendance: [],
    visitors: [],
    products: [],
    purchases: [],
    sales: [],
    salesReturns: [],
    purchaseReturns: [],
    installments: [],
    accounts: initialChartOfAccounts.map(a => ({ ...a, currentBalance: 0 })),
    vouchers: [],
    cheques: [],
    targets: [],
    tasks: [],
    auditLogs: [
      {
        id: `AUD-INIT-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
        userId: 'usr-1',
        userName: 'System Administrator',
        userRole: 'Owner',
        module: 'System',
        action: 'Production Mode Active',
        details: 'Showroom database set to clean production mode. Ready for live business transactions.'
      }
    ]
  };
  saveDatabase(dbCache);
}

function getDatabase(): ErpDatabase {
  if (dbCache) return dbCache;

  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      dbCache = JSON.parse(raw);
      if (dbCache) {
        dbCache.tasks = dbCache.tasks || [];
        dbCache.salesReturns = dbCache.salesReturns || [];
        dbCache.purchaseReturns = dbCache.purchaseReturns || [];
      }
      return dbCache!;
    }
  } catch (err) {
    console.error('Failed to parse database from localStorage:', err);
  }

  // If no DB exists yet, check if demo mode was explicitly requested
  if (isDemoMode()) {
    seedDemoData();
    return dbCache!;
  }

  // Default initial database is clean production database
  clearToProductionEmpty();
  return dbCache!;
}

function saveDatabase(db: ErpDatabase): void {
  dbCache = db;
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (err) {
    console.error('Failed to write database to localStorage:', err);
  }
  notifySubscribers();
}

// ---------------- AUTHENTICATION & USERS ----------------

export function getActiveUser(): User {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (raw) return JSON.parse(raw);
  } catch (err) {
    console.error('Active user parse error:', err);
  }
  // Default to Owner
  const defaultUser = getDatabase().users[0] || initialUsers[0];
  setActiveUser(defaultUser);
  return defaultUser;
}

export function setActiveUser(user: User): void {
  try {
    localStorage.setItem(AUTH_KEY, JSON.stringify(user));
  } catch (e) {
    console.error('Failed to set active user:', e);
  }
  notifySubscribers();
}

export function getUsers(): User[] {
  return getDatabase().users;
}

export function switchRole(role: UserRole): User {
  const db = getDatabase();
  const found = db.users.find(u => u.role === role);
  if (found) {
    setActiveUser(found);
    logAuditAction('Authentication', 'Role Switch', `Switched active profile to ${found.name} (${role})`);
    return found;
  }
  const fallback: User = {
    id: `usr-${Date.now()}`,
    name: `${role} User`,
    email: `${role.toLowerCase()}@almadinaelectronics.pk`,
    role,
    phone: '+92 300 0000000',
    active: true,
    lastLogin: new Date().toLocaleString()
  };
  db.users.push(fallback);
  saveDatabase(db);
  setActiveUser(fallback);
  return fallback;
}

// ---------------- SETTINGS ----------------

export function getSettings(): ShowroomSettings {
  return getDatabase().settings;
}

export function saveSettings(settings: ShowroomSettings): void {
  const db = getDatabase();
  db.settings = settings;
  saveDatabase(db);
  logAuditAction('Settings', 'Update Showroom Profile', `Updated showroom profile for ${settings.showroomName}`);
}

// ---------------- AUDIT LOGS ----------------

export function getAuditLogs(): AuditLog[] {
  return [...getDatabase().auditLogs].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function logAuditAction(module: string, action: string, details: string, recordId?: string): void {
  const user = getActiveUser();
  const db = getDatabase();
  const newLog: AuditLog = {
    id: `AUD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    userId: user.id,
    userName: user.name,
    userRole: user.role,
    module,
    action,
    details,
    recordId
  };
  db.auditLogs.unshift(newLog);
  if (db.auditLogs.length > 500) {
    db.auditLogs.pop(); // keep latest 500 logs
  }
  saveDatabase(db);
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
  const idx = db.customers.findIndex(c => c.id === customer.id);
  if (idx >= 0) {
    db.customers[idx] = customer;
    logAuditAction('Customers', 'Edit Customer', `Updated profile of customer: ${customer.name}`, customer.id);
  } else {
    db.customers.unshift(customer);
    logAuditAction('Customers', 'New Customer Registered', `Added new customer: ${customer.name} (CNIC: ${customer.cnic})`, customer.id);
  }
  saveDatabase(db);
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
  const idx = db.suppliers.findIndex(s => s.id === supplier.id);
  if (idx >= 0) {
    db.suppliers[idx] = supplier;
    logAuditAction('Suppliers', 'Edit Supplier', `Updated supplier profile: ${supplier.companyName}`, supplier.id);
  } else {
    db.suppliers.unshift(supplier);
    logAuditAction('Suppliers', 'New Supplier Registered', `Added supplier: ${supplier.companyName}`, supplier.id);
  }
  saveDatabase(db);
}

// ---------------- EMPLOYEES & ATTENDANCE ----------------

export function getEmployees(): Employee[] {
  return getDatabase().employees;
}

export function saveEmployee(employee: Employee): void {
  const db = getDatabase();
  const idx = db.employees.findIndex(e => e.id === employee.id);
  if (idx >= 0) {
    db.employees[idx] = employee;
    logAuditAction('Employees', 'Edit Employee', `Updated employee: ${employee.name}`, employee.id);
  } else {
    db.employees.unshift(employee);
    logAuditAction('Employees', 'New Employee', `Registered employee: ${employee.name} as ${employee.designation}`, employee.id);
  }
  saveDatabase(db);
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

  // Check if late (after 09:15 AM)
  const isLate = now.getHours() > 9 || (now.getHours() === 9 && now.getMinutes() > 15);

  const newRecord: AttendanceRecord = {
    id: `ATT-${Date.now()}`,
    employeeId: emp.id,
    employeeName: emp.name,
    date: todayStr,
    checkInTime: timeStr,
    status: isLate ? 'Late' : 'Present',
    workingHours: 0,
    notes: notes || (isLate ? 'Late arrival' : 'On time')
  };

  db.attendance.unshift(newRecord);
  saveDatabase(db);
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
  record.workingHours = 8.5; // Calculated or standard shift
  saveDatabase(db);
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

  const newVisitor: VisitorRecord = {
    ...visitor,
    id: `VIS-${Date.now().toString().slice(-4)}`,
    entryDate,
    entryTime,
    status: 'Inside',
    createdBy: user.name
  };

  db.visitors.unshift(newVisitor);
  saveDatabase(db);
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
  logAuditAction('Visitors', 'Visitor Check-Out', `Visitor departed: ${v.name} at ${v.exitTime}`, v.id);
}

// ---------------- PRODUCTS & SERIALS ----------------

export function getProducts(): Product[] {
  return getDatabase().products;
}

export function getProductById(id: string): Product | undefined {
  return getDatabase().products.find(p => p.id === id);
}

export function saveProduct(product: Product): void {
  const db = getDatabase();
  const idx = db.products.findIndex(p => p.id === product.id);
  if (idx >= 0) {
    db.products[idx] = product;
    logAuditAction('Inventory', 'Update Product', `Updated product: ${product.name} (SKU: ${product.sku})`, product.id);
  } else {
    db.products.unshift(product);
    logAuditAction('Inventory', 'Add Product', `Added new product: ${product.name} (Qty: ${product.stockQuantity})`, product.id);
  }
  saveDatabase(db);
}

export function adjustProductStock(productId: string, adjustmentQty: number, reason: string): void {
  const db = getDatabase();
  const p = db.products.find(x => x.id === productId);
  if (!p) return;

  const oldQty = p.stockQuantity;
  p.stockQuantity = Math.max(0, p.stockQuantity + adjustmentQty);
  saveDatabase(db);
  logAuditAction('Inventory', 'Stock Adjustment', `Adjusted stock for ${p.name} from ${oldQty} to ${p.stockQuantity}. Reason: ${reason}`, p.id);
}

// ---------------- PURCHASES ----------------

export function getPurchases(): PurchaseInvoice[] {
  return getDatabase().purchases;
}

export function createPurchaseInvoice(invoice: Omit<PurchaseInvoice, 'id' | 'createdBy'>): PurchaseInvoice {
  const db = getDatabase();
  const user = getActiveUser();

  const newInvoice: PurchaseInvoice = {
    ...invoice,
    id: invoice.invoiceNumber || `PINV-${Date.now().toString().slice(-4)}`,
    createdBy: user.name
  };

  // 1. Update product stock and register serial numbers
  newInvoice.items.forEach(item => {
    const prod = db.products.find(p => p.id === item.productId);
    if (prod) {
      prod.stockQuantity += item.quantity;
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
            warrantyMonths: prod.warrantyMonths
          };
          prod.serials!.push(newUnit);
        });
      }
    }
  });

  // 2. Update supplier balance if balance remains
  const supp = db.suppliers.find(s => s.id === newInvoice.supplierId);
  if (supp && newInvoice.remainingBalance > 0) {
    supp.currentBalance += newInvoice.remainingBalance;
  }

  // 3. Deduct paid amount from Cash or Bank asset account
  if (newInvoice.paidAmount > 0) {
    const cashAcc = db.accounts.find(a => a.id === 'ACC-101');
    if (cashAcc) {
      cashAcc.currentBalance = Math.max(0, cashAcc.currentBalance - newInvoice.paidAmount);
    }
  }

  db.purchases.unshift(newInvoice);
  saveDatabase(db);
  logAuditAction('Purchases', 'Create Purchase Invoice', `Created invoice #${newInvoice.invoiceNumber} from ${newInvoice.supplierName} total: PKR ${newInvoice.grandTotal.toLocaleString()}`, newInvoice.id);
  return newInvoice;
}

export function getPurchaseReturns(): PurchaseReturn[] {
  return getDatabase().purchaseReturns || [];
}

export function createPurchaseReturn(returnData: Omit<PurchaseReturn, 'id' | 'processedBy'>): PurchaseReturn {
  const db = getDatabase();
  const user = getActiveUser();

  const newReturn: PurchaseReturn = {
    ...returnData,
    id: returnData.returnNumber || `PRTN-${Date.now().toString().slice(-4)}`,
    processedBy: user.name
  };

  // 1. Deduct product stock and update serial unit status
  newReturn.items.forEach(item => {
    const prod = db.products.find(p => p.id === item.productId);
    if (prod) {
      prod.stockQuantity = Math.max(0, prod.stockQuantity - item.quantity);
      if (item.serialNumber && prod.serials) {
        const serialUnit = prod.serials.find(s => s.serialNumber === item.serialNumber);
        if (serialUnit) {
          serialUnit.status = 'Returned';
        }
      }
    }
  });

  // 2. Adjust supplier balance or record refund
  if (newReturn.refundMethod === 'Deduct Payable') {
    const supp = db.suppliers.find(s => s.id === newReturn.supplierId);
    if (supp) {
      supp.currentBalance = Math.max(0, supp.currentBalance - newReturn.grandTotal);
    }
  } else if (newReturn.refundMethod === 'Cash Refund') {
    const cashAcc = db.accounts.find(a => a.id === 'ACC-101');
    if (cashAcc) {
      cashAcc.currentBalance += newReturn.grandTotal;
    }
  } else if (newReturn.refundMethod === 'Bank Refund') {
    const bankAcc = db.accounts.find(a => a.id === 'ACC-102');
    if (bankAcc) {
      bankAcc.currentBalance += newReturn.grandTotal;
    }
  }

  // 3. Mark original purchase as Returned if applicable
  const origPurchase = db.purchases.find(p => p.invoiceNumber === newReturn.originalPurchaseNo);
  if (origPurchase) {
    origPurchase.status = 'Returned';
  }

  db.purchaseReturns.unshift(newReturn);
  saveDatabase(db);
  logAuditAction('Purchase Return', 'Process Purchase Return', `Processed Purchase Return #${newReturn.returnNumber} to ${newReturn.supplierName} (PKR ${newReturn.grandTotal.toLocaleString()})`, newReturn.id);
  return newReturn;
}

// ---------------- SALES & POS ----------------

export function getSales(): SalesInvoice[] {
  return getDatabase().sales;
}

export function createSalesInvoice(saleData: Omit<SalesInvoice, 'id' | 'status'>): SalesInvoice {
  const db = getDatabase();

  const newSale: SalesInvoice = {
    ...saleData,
    id: saleData.invoiceNumber || `INV-${Date.now().toString().slice(-4)}`,
    status: 'Completed'
  };

  // 1. Deduct Product Stock & Update Serial Unit status
  newSale.items.forEach(item => {
    const prod = db.products.find(p => p.id === item.productId);
    if (prod) {
      prod.stockQuantity = Math.max(0, prod.stockQuantity - item.quantity);
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
    }
  });

  // 2. Customer Balance update for credit sales
  if (newSale.saleType === 'Credit' && newSale.remainingBalance > 0) {
    const cust = db.customers.find(c => c.id === newSale.customerId);
    if (cust) {
      cust.currentBalance += newSale.remainingBalance;
    }
  }

  // 3. Increase Cash in Hand or Bank
  if (newSale.paidAmount > 0) {
    const targetAccId = newSale.paymentMethod === 'Bank Transfer' ? 'ACC-102' : 'ACC-101';
    const acc = db.accounts.find(a => a.id === targetAccId);
    if (acc) {
      acc.currentBalance += newSale.paidAmount;
    }
  }

  db.sales.unshift(newSale);
  saveDatabase(db);
  logAuditAction('Sales & POS', 'Post Sales Invoice', `Completed ${newSale.saleType} Sale #${newSale.invoiceNumber} for ${newSale.customerName} - PKR ${newSale.grandTotal.toLocaleString()}`, newSale.id);
  return newSale;
}

export function getSalesReturns(): SalesReturn[] {
  return getDatabase().salesReturns || [];
}

export function createSalesReturn(returnData: Omit<SalesReturn, 'id' | 'processedBy'>): SalesReturn {
  const db = getDatabase();
  const user = getActiveUser();

  const newReturn: SalesReturn = {
    ...returnData,
    id: returnData.returnNumber || `SRTN-${Date.now().toString().slice(-4)}`,
    processedBy: user.name
  };

  // 1. Restore product stock and reset serial unit status
  newReturn.items.forEach(item => {
    const prod = db.products.find(p => p.id === item.productId);
    if (prod) {
      prod.stockQuantity += item.quantity;
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
    }
  });

  // 2. Customer balance adjustment or cash refund
  if (newReturn.refundMethod === 'Credit Note') {
    const cust = db.customers.find(c => c.id === newReturn.customerId);
    if (cust) {
      cust.currentBalance = Math.max(0, cust.currentBalance - newReturn.grandTotal);
    }
  } else if (newReturn.refundMethod === 'Cash') {
    const cashAcc = db.accounts.find(a => a.id === 'ACC-101');
    if (cashAcc) {
      cashAcc.currentBalance = Math.max(0, cashAcc.currentBalance - newReturn.grandTotal);
    }
  } else if (newReturn.refundMethod === 'Bank') {
    const bankAcc = db.accounts.find(a => a.id === 'ACC-102');
    if (bankAcc) {
      bankAcc.currentBalance = Math.max(0, bankAcc.currentBalance - newReturn.grandTotal);
    }
  }

  // 3. Mark original invoice status as Returned if fully returned
  const origSale = db.sales.find(s => s.invoiceNumber === newReturn.originalInvoiceNo);
  if (origSale) {
    origSale.status = 'Returned';
  }

  db.salesReturns.unshift(newReturn);
  saveDatabase(db);
  logAuditAction('Sales Return', 'Process Sales Return', `Processed Sales Return #${newReturn.returnNumber} for invoice #${newReturn.originalInvoiceNo} (PKR ${newReturn.grandTotal.toLocaleString()})`, newReturn.id);
  return newReturn;
}

// ---------------- INSTALLMENTS & RECOVERY ----------------

export function getInstallmentAccounts(): InstallmentAccount[] {
  return getDatabase().installments;
}

export function createInstallmentAccount(account: Omit<InstallmentAccount, 'id' | 'totalReceived' | 'status' | 'remainingBalance'>): InstallmentAccount {
  const db = getDatabase();

  const newAccount: InstallmentAccount = {
    ...account,
    id: account.accountNumber || `INST-${Date.now().toString().slice(-4)}`,
    totalReceived: account.downPayment,
    remainingBalance: account.totalFinancedPayable,
    status: 'Active'
  };

  // Link to customer receivable portfolio
  const cust = db.customers.find(c => c.id === newAccount.customerId);
  if (cust) {
    cust.currentBalance += newAccount.totalFinancedPayable;
    cust.customerType = 'Installment';
  }

  db.installments.unshift(newAccount);
  saveDatabase(db);
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
  const account = db.installments.find(a => a.id === accountId);
  if (!account) throw new Error('Installment account not found');

  const receiptNo = `RCT-${Date.now().toString().slice(-4)}`;
  const today = new Date().toISOString().split('T')[0];

  // Distribute payment to schedule items
  let remainingToAllocate = amount;
  const allocatedItems: number[] = [];

  for (const item of account.schedule) {
    if (remainingToAllocate <= 0) break;
    if (item.status !== 'Paid') {
      const needed = item.remainingAmount;
      if (remainingToAllocate >= needed) {
        item.paidAmount += needed;
        item.remainingAmount = 0;
        item.status = 'Paid';
        item.paidDate = today;
        item.receiptNo = receiptNo;
        remainingToAllocate -= needed;
        allocatedItems.push(item.installmentNumber);
      } else {
        item.paidAmount += remainingToAllocate;
        item.remainingAmount -= remainingToAllocate;
        item.status = 'Partially Paid';
        item.paidDate = today;
        item.receiptNo = receiptNo;
        remainingToAllocate = 0;
        allocatedItems.push(item.installmentNumber);
      }
    }
  }

  account.totalReceived += amount;
  account.remainingBalance = Math.max(0, account.remainingBalance - amount);

  if (account.remainingBalance === 0) {
    account.status = 'Completed';
  } else {
    // Check if any overdue
    const hasOverdue = account.schedule.some(s => s.status === 'Overdue');
    account.status = hasOverdue ? 'Overdue' : 'Active';
  }

  // Update customer balance
  const cust = db.customers.find(c => c.id === account.customerId);
  if (cust) {
    cust.currentBalance = Math.max(0, cust.currentBalance - amount);
  }

  // Increase Cash drawer
  const cashAcc = db.accounts.find(a => a.id === (paymentMethod === 'Bank' ? 'ACC-102' : 'ACC-101'));
  if (cashAcc) {
    cashAcc.currentBalance += amount;
  }

  saveDatabase(db);
  logAuditAction('Recovery', 'Receive Installment', `Received installment PKR ${amount.toLocaleString()} for account #${account.accountNumber} (${account.customerName}) Receipt: ${receiptNo}`, account.id);

  return { receiptNo, updatedAccount: account };
}

// ---------------- ACCOUNTS, VOUCHERS & LEDGERS ----------------

export function getChartOfAccounts(): AccountHead[] {
  return getDatabase().accounts;
}

export function saveAccountHead(account: AccountHead): void {
  const db = getDatabase();
  const idx = db.accounts.findIndex(a => a.id === account.id);
  if (idx >= 0) {
    db.accounts[idx] = account;
  } else {
    db.accounts.push(account);
  }
  saveDatabase(db);
  logAuditAction('Accounting', 'Chart of Accounts', `Saved account head: ${account.name} (${account.code})`, account.id);
}

export function getVouchers(): Voucher[] {
  return getDatabase().vouchers;
}

export function createVoucher(voucher: Omit<Voucher, 'id' | 'createdBy' | 'status'>): Voucher {
  const db = getDatabase();
  const user = getActiveUser();

  // Validate balanced double entry: Debits = Credits
  const totalDebit = voucher.entries.reduce((sum, e) => sum + (e.debit || 0), 0);
  const totalCredit = voucher.entries.reduce((sum, e) => sum + (e.credit || 0), 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Double entry unbalanced! Total Debits (PKR ${totalDebit}) must equal Total Credits (PKR ${totalCredit})`);
  }

  const newVoucher: Voucher = {
    ...voucher,
    id: voucher.voucherNumber || `VOUCH-${Date.now().toString().slice(-4)}`,
    createdBy: user.name,
    status: 'Posted'
  };

  // Adjust account balances
  voucher.entries.forEach(entry => {
    const acc = db.accounts.find(a => a.id === entry.accountId);
    if (acc) {
      if (acc.category === 'Asset' || acc.category === 'Expense') {
        acc.currentBalance += (entry.debit - entry.credit);
      } else {
        acc.currentBalance += (entry.credit - entry.debit);
      }
    }
  });

  db.vouchers.unshift(newVoucher);
  saveDatabase(db);
  logAuditAction('Accounting', 'Post Voucher', `Posted ${newVoucher.voucherType} #${newVoucher.voucherNumber} amount PKR ${newVoucher.amount.toLocaleString()}`, newVoucher.id);
  return newVoucher;
}

export function getCustomerLedgerEntries(customerId: string): LedgerEntry[] {
  const db = getDatabase();
  const cust = db.customers.find(c => c.id === customerId);
  if (!cust) return [];

  const entries: LedgerEntry[] = [];
  let runningBalance = cust.openingBalance || 0;

  // Opening balance row
  entries.push({
    id: 'op-1',
    date: cust.createdAt,
    voucherNo: 'OPENING',
    voucherType: 'Opening Balance',
    description: 'Account Opening Balance',
    debit: cust.openingBalance > 0 ? cust.openingBalance : 0,
    credit: cust.openingBalance < 0 ? Math.abs(cust.openingBalance) : 0,
    balance: runningBalance,
    partyId: customerId,
    partyType: 'Customer'
  });

  // Sales invoices
  const customerSales = db.sales.filter(s => s.customerId === customerId);
  customerSales.forEach(s => {
    runningBalance += s.grandTotal;
    entries.push({
      id: `sale-${s.id}`,
      date: s.date,
      voucherNo: s.invoiceNumber,
      voucherType: 'Sales Invoice',
      description: `Sold: ${s.items.map(i => `${i.productName} (x${i.quantity})`).join(', ')}`,
      debit: s.grandTotal,
      credit: 0,
      balance: runningBalance,
      partyId: customerId,
      partyType: 'Customer'
    });

    if (s.paidAmount > 0) {
      runningBalance -= s.paidAmount;
      entries.push({
        id: `pay-${s.id}`,
        date: s.date,
        voucherNo: s.invoiceNumber,
        voucherType: 'Receipt / Payment',
        description: `Payment received via ${s.paymentMethod}`,
        debit: 0,
        credit: s.paidAmount,
        balance: runningBalance,
        partyId: customerId,
        partyType: 'Customer'
      });
    }
  });

  // Vouchers linked to this customer
  const customerVouchers = db.vouchers.filter(v => v.partyId === customerId);
  customerVouchers.forEach(v => {
    if (v.voucherType === 'Receive Voucher') {
      runningBalance -= v.amount;
      entries.push({
        id: `vouch-${v.id}`,
        date: v.date,
        voucherNo: v.voucherNumber,
        voucherType: v.voucherType,
        description: v.narration,
        debit: 0,
        credit: v.amount,
        balance: runningBalance,
        partyId: customerId,
        partyType: 'Customer'
      });
    }
  });

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

export function getSupplierLedgerEntries(supplierId: string): LedgerEntry[] {
  const db = getDatabase();
  const supp = db.suppliers.find(s => s.id === supplierId);
  if (!supp) return [];

  const entries: LedgerEntry[] = [];
  let runningBalance = supp.openingBalance || 0;

  entries.push({
    id: 'op-supp-1',
    date: supp.createdAt,
    voucherNo: 'OPENING',
    voucherType: 'Opening Balance',
    description: 'Initial Opening Balance',
    debit: 0,
    credit: runningBalance,
    balance: runningBalance,
    partyId: supplierId,
    partyType: 'Supplier'
  });

  const supplierPurchases = db.purchases.filter(p => p.supplierId === supplierId);
  supplierPurchases.forEach(p => {
    runningBalance += p.grandTotal;
    entries.push({
      id: `pur-${p.id}`,
      date: p.date,
      voucherNo: p.invoiceNumber,
      voucherType: 'Purchase Invoice',
      description: `Purchased: ${p.items.map(i => `${i.productName} (x${i.quantity})`).join(', ')}`,
      debit: 0,
      credit: p.grandTotal,
      balance: runningBalance,
      partyId: supplierId,
      partyType: 'Supplier'
    });

    if (p.paidAmount > 0) {
      runningBalance -= p.paidAmount;
      entries.push({
        id: `pur-pay-${p.id}`,
        date: p.date,
        voucherNo: p.invoiceNumber,
        voucherType: 'Payment Voucher',
        description: `Paid via ${p.paymentMethod}`,
        debit: p.paidAmount,
        credit: 0,
        balance: runningBalance,
        partyId: supplierId,
        partyType: 'Supplier'
      });
    }
  });

  return entries.sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------- CHEQUES ----------------

export function getCheques(): ChequeRecord[] {
  return getDatabase().cheques;
}

export function saveCheque(cheque: ChequeRecord): void {
  const db = getDatabase();
  const idx = db.cheques.findIndex(c => c.id === cheque.id);
  if (idx >= 0) {
    db.cheques[idx] = cheque;
    logAuditAction('Cheques', 'Update Cheque', `Updated cheque #${cheque.chequeNumber} status: ${cheque.status}`, cheque.id);
  } else {
    db.cheques.unshift(cheque);
    logAuditAction('Cheques', 'New Cheque', `Recorded ${cheque.type} cheque #${cheque.chequeNumber} amount PKR ${cheque.amount.toLocaleString()}`, cheque.id);
  }
  saveDatabase(db);
}

export function clearChequeWithAccounting(chequeId: string, clearanceDate: string): boolean {
  const db = getDatabase();
  const cheque = db.cheques.find(c => c.id === chequeId);
  if (!cheque) return false;

  cheque.status = 'Cleared';
  cheque.clearanceDate = clearanceDate;

  // Real double-entry accounting entry: Bank Account reconciliation
  const bankAcc = db.accounts.find(a => a.id === 'ACC-102');
  if (cheque.type === 'Received') {
    if (bankAcc) {
      bankAcc.currentBalance += cheque.amount;
    }
  } else if (cheque.type === 'Issued') {
    if (bankAcc) {
      bankAcc.currentBalance = Math.max(0, bankAcc.currentBalance - cheque.amount);
    }
  }

  saveDatabase(db);
  logAuditAction('Cheques', 'Clear Cheque', `Cheque #${cheque.chequeNumber} (${cheque.type}) cleared through ${cheque.bankName} for PKR ${cheque.amount.toLocaleString()}`, cheque.id);
  return true;
}

// ---------------- TARGETS ----------------

export function getTargets(): Target[] {
  const db = getDatabase();
  // Dynamically calculate achieved amounts based on real sales and installment collections
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
      status: isAchieved ? 'Achieved' : 'In Progress'
    };
  });
}

export function saveTarget(target: Target): void {
  const db = getDatabase();
  const idx = db.targets.findIndex(t => t.id === target.id);
  if (idx >= 0) {
    db.targets[idx] = target;
  } else {
    db.targets.push(target);
  }
  saveDatabase(db);
  logAuditAction('Targets', 'Target Updated', `Saved ${target.targetType} target for ${target.assignedTo} (PKR ${target.targetAmount.toLocaleString()})`, target.id);
}

// ---------------- BACKUP, RESTORE & EXPORT ----------------

export function exportDatabaseJSON(): string {
  const db = getDatabase();
  return JSON.stringify(db, null, 2);
}

export function importDatabaseJSON(jsonStr: string): boolean {
  try {
    const parsed = JSON.parse(jsonStr) as ErpDatabase;
    if (!parsed.products || !parsed.sales || !parsed.customers) {
      throw new Error('Invalid ERP backup file structure');
    }
    saveDatabase(parsed);
    logAuditAction('Backup', 'Database Restored', 'Database restored from uploaded backup file');
    return true;
  } catch (err) {
    console.error('Import database failed:', err);
    return false;
  }
}

export function resetToDefaultData(): void {
  localStorage.removeItem(DB_KEY);
  dbCache = null;
  getDatabase(); // reload fresh seed
  logAuditAction('Backup', 'Database Reset', 'Reset database to official Pakistani Electronics showroom template');
  notifySubscribers();
}

// ---------------- STAFF TASKS & TO-DO MANAGEMENT ----------------

export function getTasks(): StaffTask[] {
  const db = getDatabase();
  return db.tasks || [];
}

export function saveTask(task: StaffTask): void {
  const db = getDatabase();
  if (!db.tasks) db.tasks = [];
  const idx = db.tasks.findIndex(t => t.id === task.id);
  if (idx >= 0) {
    db.tasks[idx] = task;
  } else {
    db.tasks.unshift(task);
  }
  saveDatabase(db);
  logAuditAction('Tasks', 'Task Saved', `Saved task: "${task.title}" assigned to ${task.assignedTo}`, task.id);
}

export function updateTaskStatus(taskId: string, status: TaskStatus, progressPercent?: number): void {
  const db = getDatabase();
  if (!db.tasks) db.tasks = [];
  const task = db.tasks.find(t => t.id === taskId);
  if (task) {
    task.status = status;
    if (progressPercent !== undefined) {
      task.progressPercent = progressPercent;
    } else if (status === 'Completed') {
      task.progressPercent = 100;
      task.completedAt = new Date().toISOString().replace('T', ' ').substring(0, 19);
    } else if (status === 'Pending') {
      task.progressPercent = 0;
      task.completedAt = undefined;
    }
    saveDatabase(db);
    logAuditAction('Tasks', 'Task Status Updated', `Updated task ${task.id} to ${status} (${task.progressPercent}%)`, task.id);
  }
}

export function deleteTask(taskId: string): void {
  const db = getDatabase();
  if (!db.tasks) db.tasks = [];
  db.tasks = db.tasks.filter(t => t.id !== taskId);
  saveDatabase(db);
  logAuditAction('Tasks', 'Task Deleted', `Removed task ${taskId}`, taskId);
}

