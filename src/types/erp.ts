export type UserRole = 
  | 'Owner' 
  | 'Manager' 
  | 'Accountant' 
  | 'Cashier' 
  | 'StockManager' 
  | 'RecoveryOfficer' 
  | 'Receptionist';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  avatar?: string;
  active: boolean;
  lastLogin: string;
}

export interface Customer {
  id: string;
  name: string;
  fatherName?: string;
  phone: string;
  whatsapp?: string;
  cnic: string;
  email?: string;
  address: string;
  city: string;
  openingBalance: number;
  currentBalance: number; // Positive = Receivable from customer
  creditLimit: number;
  customerType: 'Retail' | 'Wholesale' | 'Installment' | 'Credit';
  createdAt: string;
  notes?: string;
}

export interface Supplier {
  id: string;
  companyName: string;
  contactPerson: string;
  phone: string;
  whatsapp?: string;
  email?: string;
  address: string;
  city: string;
  ntn?: string;
  openingBalance: number;
  currentBalance: number; // Positive = Payable to supplier
  paymentTerms: string;
  createdAt: string;
}

export interface Employee {
  id: string;
  name: string;
  fatherName?: string;
  phone: string;
  cnic: string;
  designation: string;
  department: string;
  joiningDate: string;
  salary: number;
  status: 'Active' | 'On Leave' | 'Terminated';
  shift: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string; // YYYY-MM-DD
  checkInTime: string;
  checkOutTime?: string;
  status: 'Present' | 'Late' | 'Half Day' | 'Absent' | 'On Leave';
  workingHours?: number;
  notes?: string;
}

export interface VisitorRecord {
  id: string;
  name: string;
  phone: string;
  cnic?: string;
  purpose: 'Product Inquiry' | 'Product Purchase' | 'Installment Inquiry' | 'Installment Payment' | 'Warranty Claim' | 'Vendor Meeting' | 'Other';
  personToMeet: string;
  entryDate: string;
  entryTime: string;
  exitTime?: string;
  status: 'Inside' | 'Checked Out';
  remarks?: string;
  createdBy: string;
}

export interface SerialUnit {
  serialNumber: string;
  productId: string;
  productName: string;
  condition: 'Brand New' | 'Display Unit' | 'Open Box' | 'Refurbished';
  purchaseCost: number;
  supplierId?: string;
  supplierName?: string;
  purchaseInvoiceNo?: string;
  purchaseDate: string;
  saleInvoiceNo?: string;
  saleDate?: string;
  customerId?: string;
  customerName?: string;
  status: 'In Stock' | 'Reserved' | 'Sold' | 'Returned' | 'Damaged';
  warrantyMonths: number;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  subCategory?: string;
  brand: string;
  modelNumber: string;
  sku: string;
  barcode: string;
  unit: string;
  purchasePrice: number;
  retailPrice: number;
  minSalePrice: number;
  stockQuantity: number;
  minStockLevel: number;
  warrantyMonths: number;
  hasSerialTracking: boolean;
  image?: string;
  description?: string;
  serials?: SerialUnit[];
}

export interface PurchaseItem {
  productId: string;
  productName: string;
  brand: string;
  modelNumber: string;
  quantity: number;
  purchasePrice: number;
  total: number;
  serialNumbers?: string[];
}

export interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  date: string;
  items: PurchaseItem[];
  subTotal: number;
  discount: number;
  tax: number;
  freightCharges: number;
  grandTotal: number;
  paidAmount: number;
  remainingBalance: number;
  paymentMethod: 'Cash' | 'Bank Transfer' | 'Cheque' | 'Credit';
  status: 'Received' | 'Returned' | 'Draft';
  notes?: string;
  createdBy: string;
}

export interface SaleItem {
  productId: string;
  productName: string;
  brand: string;
  modelNumber: string;
  quantity: number;
  unitPrice: number;
  costPrice: number;
  discount: number;
  total: number;
  selectedSerial?: string;
}

export interface SalesInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  saleType: 'Cash' | 'Credit' | 'Installment';
  date: string;
  items: SaleItem[];
  subTotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paidAmount: number;
  changeAmount: number;
  remainingBalance: number;
  paymentMethod: 'Cash' | 'Bank Transfer' | 'Card' | 'Cheque' | 'Split';
  status: 'Completed' | 'Returned' | 'Cancelled';
  salesPerson: string;
  notes?: string;
  installmentAccountId?: string;
}

export interface InstallmentScheduleItem {
  installmentNumber: number;
  dueDate: string;
  principalAmount: number;
  markupAmount: number;
  totalDue: number;
  paidAmount: number;
  remainingAmount: number;
  paidDate?: string;
  status: 'Paid' | 'Partially Paid' | 'Due' | 'Overdue' | 'Upcoming';
  receiptNo?: string;
}

export interface InstallmentAccount {
  id: string;
  accountNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerCnic: string;
  customerAddress: string;
  productId: string;
  productName: string;
  productModel: string;
  productSerial?: string;
  salesInvoiceNo: string;
  cashPrice: number;
  downPayment: number;
  financedAmount: number;
  markupPercentage: number;
  markupAmount: number;
  totalFinancedPayable: number;
  totalPayableWithDown: number;
  durationMonths: number;
  monthlyInstallment: number;
  startDate: string;
  firstDueDate: string;
  guarantor1Name: string;
  guarantor1Phone: string;
  guarantor1Cnic: string;
  guarantor1Relation: string;
  guarantor2Name?: string;
  guarantor2Phone?: string;
  guarantor2Cnic?: string;
  recoveryOfficerId: string;
  recoveryOfficerName: string;
  totalReceived: number;
  remainingBalance: number;
  status: 'Active' | 'Completed' | 'Overdue' | 'Defaulted' | 'Closed Early';
  schedule: InstallmentScheduleItem[];
  notes?: string;
}

export interface InstallmentReceipt {
  id: string;
  receiptNumber: string;
  installmentAccountId: string;
  customerName: string;
  date: string;
  amountReceived: number;
  paymentMethod: 'Cash' | 'Bank' | 'Cheque';
  receivedBy: string;
  remarks?: string;
  allocatedToInstallments: number[];
}

export interface VoucherEntry {
  accountId: string;
  accountName: string;
  debit: number;
  credit: number;
  narration?: string;
}

export interface Voucher {
  id: string;
  voucherNumber: string;
  voucherType: 'Payment Voucher' | 'Receive Voucher' | 'Journal Voucher' | 'Contra Voucher';
  date: string;
  partyType?: 'Customer' | 'Supplier' | 'Employee' | 'Expense' | 'Other';
  partyId?: string;
  partyName?: string;
  amount: number;
  paymentMethod?: 'Cash' | 'Bank' | 'Cheque';
  entries: VoucherEntry[]; // Double entry rows
  narration: string;
  createdBy: string;
  status: 'Posted' | 'Cancelled';
}

export interface LedgerEntry {
  id: string;
  date: string;
  voucherNo: string;
  voucherType: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
  partyId?: string;
  partyType?: 'Customer' | 'Supplier' | 'Account';
}

export interface AccountHead {
  id: string;
  code: string;
  name: string;
  category: 'Asset' | 'Liability' | 'Equity' | 'Income' | 'Expense';
  subCategory: string;
  currentBalance: number;
}

export interface ChequeRecord {
  id: string;
  chequeNumber: string;
  type: 'Received' | 'Issued';
  bankName: string;
  partyName: string;
  amount: number;
  issueDate: string;
  chequeDate: string;
  clearanceDate?: string;
  status: 'Pending' | 'Deposited' | 'Cleared' | 'Bounced' | 'Cancelled';
  remarks?: string;
}

export interface Target {
  id: string;
  targetType: 'Sales' | 'Recovery';
  period: 'Daily' | 'Monthly';
  monthYear: string; // e.g. 2026-11
  targetAmount: number;
  achievedAmount: number;
  assignedTo: string; // Employee or 'Showroom'
  status: 'In Progress' | 'Achieved' | 'Missed';
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  module: string;
  action: string;
  details: string;
  recordId?: string;
}

export interface ShowroomSettings {
  showroomName: string;
  ownerName: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
  currency: string;
  currencySymbol: string;
  ntn: string;
  strn: string;
  invoicePrefix: string;
  purchasePrefix: string;
  receiptPrefix: string;
  defaultTaxRate: number;
  defaultMarkupRate: number;
  printFormat: 'A4' | 'Thermal';
  invoiceFooterNote: string;
}

export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Urgent';
export type TaskStatus = 'Pending' | 'In Progress' | 'Completed' | 'Deferred';

export interface StaffTask {
  id: string;
  title: string;
  description?: string;
  assignedTo: string; // Employee name or ID
  assignedBy: string;
  priority: TaskPriority;
  status: TaskStatus;
  category: 'Showroom Floor' | 'Stock & Warehouse' | 'Recovery & Calls' | 'Accounts & Banking' | 'Customer Support' | 'General';
  dueDate: string;
  completedAt?: string;
  createdAt: string;
  progressPercent: number; // 0 to 100
  notes?: string;
}

