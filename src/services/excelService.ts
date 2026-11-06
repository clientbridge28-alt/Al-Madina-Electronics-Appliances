import * as XLSX from 'xlsx';
import { Customer, Supplier, Product, SalesInvoice, PurchaseInvoice, InstallmentAccount } from '../types/erp';

// ---------------- EXPORT UTILITIES ----------------

export function exportToXLSX<T>(data: T[], fileName: string, sheetName: string = 'Sheet1') {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

// Pre-formatted exporters for ERP modules
export function exportCustomersToExcel(customers: Customer[]) {
  const formatted = customers.map(c => ({
    'Customer ID': c.id,
    'Full Name': c.name,
    'Father Name': c.fatherName || '',
    'Mobile Phone': c.phone,
    'WhatsApp': c.whatsapp || '',
    'CNIC Number': c.cnic,
    'Address': c.address,
    'City': c.city,
    'Customer Type': c.customerType,
    'Current Balance (PKR)': c.currentBalance,
    'Credit Limit (PKR)': c.creditLimit,
    'Registration Date': c.createdAt
  }));
  exportToXLSX(formatted, 'Customers_Directory', 'Customers');
}

export function exportProductsToExcel(products: Product[]) {
  const formatted = products.map(p => ({
    'SKU': p.sku,
    'Product Name': p.name,
    'Category': p.category,
    'Brand': p.brand,
    'Model Number': p.modelNumber,
    'Barcode': p.barcode,
    'Unit': p.unit,
    'Cost Price (PKR)': p.purchasePrice,
    'Retail Price (PKR)': p.retailPrice,
    'Current Stock': p.stockQuantity,
    'Min Stock Level': p.minStockLevel,
    'Total Valuation (PKR)': p.purchasePrice * p.stockQuantity,
    'Warranty (Months)': p.warrantyMonths,
    'Serial Tracking': p.hasSerialTracking ? 'YES' : 'NO'
  }));
  exportToXLSX(formatted, 'Products_Inventory', 'Products');
}

export function exportSuppliersToExcel(suppliers: Supplier[]) {
  const formatted = suppliers.map(s => ({
    'Supplier ID': s.id,
    'Company Name': s.companyName,
    'Contact Person': s.contactPerson,
    'Phone': s.phone,
    'Email': s.email || '',
    'Address': s.address,
    'NTN Number': s.ntn || '',
    'Current Payable (PKR)': s.currentBalance,
    'Payment Terms': s.paymentTerms
  }));
  exportToXLSX(formatted, 'Suppliers_Directory', 'Suppliers');
}

export function exportSalesToExcel(sales: SalesInvoice[]) {
  const formatted = sales.map(s => ({
    'Invoice #': s.invoiceNumber,
    'Date': s.date,
    'Customer Name': s.customerName,
    'Customer Phone': s.customerPhone,
    'Sale Type': s.saleType,
    'Payment Method': s.paymentMethod,
    'Subtotal (PKR)': s.subTotal,
    'Discount (PKR)': s.discount,
    'Grand Total (PKR)': s.grandTotal,
    'Paid Amount (PKR)': s.paidAmount,
    'Remaining Due (PKR)': s.remainingBalance,
    'Salesperson': s.salesPerson,
    'Status': s.status
  }));
  exportToXLSX(formatted, 'Sales_Invoices', 'Sales');
}

export function exportInstallmentsToExcel(installments: InstallmentAccount[]) {
  const formatted = installments.map(i => ({
    'Account #': i.accountNumber,
    'Customer Name': i.customerName,
    'Phone': i.customerPhone,
    'CNIC': i.customerCnic,
    'Product Financed': i.productName,
    'Cash Price (PKR)': i.cashPrice,
    'Down Payment (PKR)': i.downPayment,
    'Markup (%)': i.markupPercentage,
    'Monthly Installment (PKR)': i.monthlyInstallment,
    'Total Financed (PKR)': i.totalFinancedPayable,
    'Total Received (PKR)': i.totalReceived,
    'Remaining Balance (PKR)': i.remainingBalance,
    'Tenure (Months)': i.durationMonths,
    'Recovery Officer': i.recoveryOfficerName,
    'Status': i.status
  }));
  exportToXLSX(formatted, 'Installment_Portfolio', 'Installments');
}

// ---------------- TEMPLATE GENERATORS FOR IMPORT ----------------

export function downloadCustomerImportTemplate() {
  const sample = [
    {
      'Full Name': 'Muhammad Ahmad',
      'Father Name': 'Bashir Ahmad',
      'Mobile Phone': '0300-1234567',
      'WhatsApp': '0300-1234567',
      'CNIC Number': '35202-1234567-1',
      'Address': 'House # 12, Street 4, Gulberg',
      'City': 'Lahore',
      'Customer Type': 'Retail',
      'Opening Balance': 0,
      'Credit Limit': 200000
    }
  ];
  exportToXLSX(sample, 'Customer_Import_Template', 'Template');
}

export function downloadProductImportTemplate() {
  const sample = [
    {
      'Product Name': 'Haier 1.5 Ton DC Inverter',
      'Category': 'Air Conditioners',
      'Brand': 'Haier',
      'Model Number': 'HSU-18HFT',
      'SKU': 'HAE-AC-18',
      'Barcode': '8964001122334',
      'Cost Price': 135000,
      'Retail Price': 160000,
      'Stock Quantity': 10,
      'Min Stock Level': 3,
      'Warranty Months': 120,
      'Has Serial Tracking': 'YES'
    }
  ];
  exportToXLSX(sample, 'Product_Import_Template', 'Template');
}

export function downloadSupplierImportTemplate() {
  const sample = [
    {
      'Company Name': 'Dawlance Electronics Hub',
      'Contact Person': 'Tariq Butt',
      'Phone': '0321-4455667',
      'Email': 'info@dawlance.com',
      'Address': 'Multan Road Hub, Lahore',
      'NTN Number': '1234567-8',
      'Opening Balance': 0,
      'Payment Terms': '30 Days Credit'
    }
  ];
  exportToXLSX(sample, 'Supplier_Import_Template', 'Template');
}

// ---------------- IMPORT PARSERS & VALIDATORS ----------------

export interface ParsedImportRow<T> {
  rowNumber: number;
  data: T;
  isValid: boolean;
  errors: string[];
}

export interface ImportValidationResult<T> {
  validRows: ParsedImportRow<T>[];
  invalidRows: ParsedImportRow<T>[];
  totalRows: number;
}

export async function parseExcelFile(file: File): Promise<any[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(worksheet);
}

export function validateCustomerImport(rawRows: any[]): ImportValidationResult<Partial<Customer>> {
  const validRows: ParsedImportRow<Partial<Customer>>[] = [];
  const invalidRows: ParsedImportRow<Partial<Customer>>[] = [];

  rawRows.forEach((row, idx) => {
    const errors: string[] = [];
    const name = String(row['Full Name'] || row['name'] || '').trim();
    const phone = String(row['Mobile Phone'] || row['phone'] || '').trim();
    const cnic = String(row['CNIC Number'] || row['cnic'] || '').trim();

    if (!name) errors.push('Customer Full Name is required');
    if (!phone) errors.push('Mobile Phone is required');

    const customerData: Partial<Customer> = {
      name,
      fatherName: String(row['Father Name'] || '').trim(),
      phone,
      whatsapp: String(row['WhatsApp'] || phone).trim(),
      cnic: cnic || '35202-0000000-0',
      address: String(row['Address'] || 'Lahore').trim(),
      city: String(row['City'] || 'Lahore').trim(),
      customerType: (row['Customer Type'] === 'Installment' || row['Customer Type'] === 'Credit') ? row['Customer Type'] : 'Retail',
      openingBalance: Number(row['Opening Balance']) || 0,
      currentBalance: Number(row['Opening Balance']) || 0,
      creditLimit: Number(row['Credit Limit']) || 200000,
      createdAt: new Date().toISOString().split('T')[0]
    };

    const rowObj: ParsedImportRow<Partial<Customer>> = {
      rowNumber: idx + 2, // 1-based, skipping header
      data: customerData,
      isValid: errors.length === 0,
      errors
    };

    if (errors.length === 0) validRows.push(rowObj);
    else invalidRows.push(rowObj);
  });

  return { validRows, invalidRows, totalRows: rawRows.length };
}

export function validateProductImport(rawRows: any[]): ImportValidationResult<Partial<Product>> {
  const validRows: ParsedImportRow<Partial<Product>>[] = [];
  const invalidRows: ParsedImportRow<Partial<Product>>[] = [];

  rawRows.forEach((row, idx) => {
    const errors: string[] = [];
    const name = String(row['Product Name'] || row['name'] || '').trim();
    const category = String(row['Category'] || 'Electronics').trim();
    const brand = String(row['Brand'] || 'General').trim();
    const cost = Number(row['Cost Price'] || row['purchasePrice']) || 0;
    const retail = Number(row['Retail Price'] || row['retailPrice']) || 0;

    if (!name) errors.push('Product Name is required');
    if (cost <= 0) errors.push('Cost Price must be greater than 0');
    if (retail <= 0) errors.push('Retail Price must be greater than 0');

    const productData: Partial<Product> = {
      name,
      category,
      brand,
      modelNumber: String(row['Model Number'] || 'STD').trim(),
      sku: String(row['SKU'] || `SKU-${Date.now().toString().slice(-4)}-${idx}`).trim(),
      barcode: String(row['Barcode'] || `${Math.floor(100000000000 + Math.random() * 900000000000)}`).trim(),
      unit: 'Unit',
      purchasePrice: cost,
      retailPrice: retail,
      minSalePrice: cost * 1.05,
      stockQuantity: Number(row['Stock Quantity']) || 0,
      minStockLevel: Number(row['Min Stock Level']) || 3,
      warrantyMonths: Number(row['Warranty Months']) || 12,
      hasSerialTracking: String(row['Has Serial Tracking']).toUpperCase() === 'YES',
      serials: []
    };

    const rowObj: ParsedImportRow<Partial<Product>> = {
      rowNumber: idx + 2,
      data: productData,
      isValid: errors.length === 0,
      errors
    };

    if (errors.length === 0) validRows.push(rowObj);
    else invalidRows.push(rowObj);
  });

  return { validRows, invalidRows, totalRows: rawRows.length };
}

export function processCustomerExcelBuffer(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.SheetNames[0];
  const rawRows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);
  const validation = validateCustomerImport(rawRows);

  const errors: { row: number; column: string; message: string; rawValue?: any }[] = [];
  validation.invalidRows.forEach(r => {
    r.errors.forEach(err => {
      errors.push({ row: r.rowNumber, column: 'Customer Info', message: err });
    });
  });

  const fullCustomers: Customer[] = validation.validRows.map((r, i) => ({
    id: `CUST-${Date.now().toString().slice(-4)}-${i}`,
    name: r.data.name || 'Unknown',
    fatherName: r.data.fatherName || '',
    phone: r.data.phone || '',
    whatsapp: r.data.whatsapp || r.data.phone || '',
    cnic: r.data.cnic || '35202-0000000-0',
    address: r.data.address || '',
    city: r.data.city || 'Lahore',
    openingBalance: r.data.openingBalance || 0,
    currentBalance: r.data.currentBalance || 0,
    creditLimit: r.data.creditLimit || 200000,
    customerType: r.data.customerType || 'Retail',
    createdAt: r.data.createdAt || new Date().toISOString().split('T')[0]
  }));

  return {
    success: errors.length === 0,
    validRows: fullCustomers,
    errors,
    totalRows: rawRows.length
  };
}

export function processProductExcelBuffer(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.SheetNames[0];
  const rawRows: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[firstSheet]);
  const validation = validateProductImport(rawRows);

  const errors: { row: number; column: string; message: string; rawValue?: any }[] = [];
  validation.invalidRows.forEach(r => {
    r.errors.forEach(err => {
      errors.push({ row: r.rowNumber, column: 'Product Info', message: err });
    });
  });

  const fullProducts: Product[] = validation.validRows.map((r, i) => ({
    id: `PROD-${Date.now().toString().slice(-4)}-${i}`,
    name: r.data.name || 'Unnamed Product',
    category: r.data.category || 'General',
    brand: r.data.brand || 'General',
    modelNumber: r.data.modelNumber || 'STD',
    sku: r.data.sku || `SKU-${Date.now().toString().slice(-4)}-${i}`,
    barcode: r.data.barcode || `${Math.floor(100000000000 + Math.random() * 900000000000)}`,
    unit: 'Unit',
    purchasePrice: r.data.purchasePrice || 0,
    retailPrice: r.data.retailPrice || 0,
    minSalePrice: r.data.minSalePrice || (r.data.purchasePrice || 0) * 1.05,
    stockQuantity: r.data.stockQuantity || 0,
    minStockLevel: r.data.minStockLevel || 3,
    warrantyMonths: r.data.warrantyMonths || 12,
    hasSerialTracking: r.data.hasSerialTracking ?? false,
    serials: []
  }));

  return {
    success: errors.length === 0,
    validRows: fullProducts,
    errors,
    totalRows: rawRows.length
  };
}
