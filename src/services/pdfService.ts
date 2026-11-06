import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { ShowroomSettings, SalesInvoice, Product, InstallmentAccount, AccountHead } from '../types/erp';

/**
 * Adds an official showroom header and styling to a PDF document
 */
function addDocHeader(
  doc: jsPDF, 
  title: string, 
  subtitle: string, 
  settings?: ShowroomSettings
) {
  const showroomName = settings?.showroomName || 'Al-Madina Electronics & Appliances';
  const address = settings?.address || 'Main Commercial Avenue, Lahore';
  const phone = settings?.phone || '+92 300 8472910';
  const ntn = settings?.ntn ? `NTN: ${settings.ntn}` : '';

  // Top header banner
  doc.setFillColor(30, 58, 138); // Blue 900
  doc.rect(0, 0, 210, 24, 'F');

  // Showroom Name & Title
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(showroomName, 14, 11);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`${address} | Ph: ${phone} ${ntn ? `| ${ntn}` : ''}`, 14, 18);

  // Sub-header title
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 33);

  doc.setTextColor(100, 116, 139); // Slate 500
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`${subtitle} • Generated: ${new Date().toLocaleString()}`, 14, 38);

  // Divider line
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setLineWidth(0.5);
  doc.line(14, 41, 196, 41);
}

/**
 * Adds an official footer with page numbers and stamp note
 */
function addDocFooter(doc: jsPDF) {
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // Slate 400
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 283, 196, 283);
    doc.text(
      'Official Electronics Showroom Computer Generated Statement • Confidential Financial Document',
      14,
      287
    );
    doc.text(`Page ${i} of ${pageCount}`, 196, 287, { align: 'right' });
  }
}

// ---------------- FINANCIAL REPORTS PDF EXPORTERS ----------------

export function exportSalesReportPDF(sales: SalesInvoice[], settings?: ShowroomSettings) {
  const doc = new jsPDF();
  addDocHeader(
    doc, 
    'SALES INVOICE & REVENUE REGISTER', 
    `Detailed audit ledger of ${sales.length} invoiced showroom sales`, 
    settings
  );

  const totalRevenue = sales.reduce((sum, s) => sum + s.grandTotal, 0);
  const totalPaid = sales.reduce((sum, s) => sum + s.paidAmount, 0);
  const totalRemaining = sales.reduce((sum, s) => sum + s.remainingBalance, 0);

  const tableBody = sales.map(s => [
    s.invoiceNumber,
    s.date,
    s.customerName,
    s.saleType,
    `PKR ${s.grandTotal.toLocaleString()}`,
    `PKR ${s.paidAmount.toLocaleString()}`,
    `PKR ${s.remainingBalance.toLocaleString()}`,
    s.paymentMethod
  ]);

  autoTable(doc, {
    startY: 44,
    head: [['Invoice #', 'Date', 'Customer', 'Type', 'Total Amount', 'Received', 'Balance', 'Method']],
    body: tableBody,
    foot: [[
      'TOTALS',
      '',
      `${sales.length} Invoices`,
      '',
      `PKR ${totalRevenue.toLocaleString()}`,
      `PKR ${totalPaid.toLocaleString()}`,
      `PKR ${totalRemaining.toLocaleString()}`,
      ''
    ]],
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235], fontSize: 8, fontStyle: 'bold' },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontSize: 8, fontStyle: 'bold' },
    styles: { fontSize: 7.5, cellPadding: 2 },
    columnStyles: {
      4: { halign: 'right', fontStyle: 'bold' },
      5: { halign: 'right' },
      6: { halign: 'right', textColor: [185, 28, 28] }
    }
  });

  addDocFooter(doc);
  doc.save(`SalesReport_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportProfitLossPDF(
  revenue: number, 
  cogs: number, 
  grossProfit: number, 
  expenses: number, 
  netProfit: number, 
  settings?: ShowroomSettings
) {
  const doc = new jsPDF();
  addDocHeader(
    doc, 
    'INCOME & PROFIT/LOSS (P&L) STATEMENT', 
    'Official executive financial performance and net margin summary', 
    settings
  );

  const tableBody = [
    ['Gross Invoiced Sales Revenue', `PKR ${revenue.toLocaleString()}`, '100.0%'],
    ['Cost of Goods Sold (COGS - Landed Inventory Cost)', `(PKR ${cogs.toLocaleString()})`, `${revenue > 0 ? ((cogs / revenue) * 100).toFixed(1) : 0}%`],
    ['GROSS OPERATING PROFIT', `PKR ${grossProfit.toLocaleString()}`, `${revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : 0}%`],
    ['Operating Showroom Expenses (Salaries, Rent, Bills)', `(PKR ${expenses.toLocaleString()})`, `${revenue > 0 ? ((expenses / revenue) * 100).toFixed(1) : 0}%`],
    ['NET OPERATING PROFIT / (LOSS)', `PKR ${netProfit.toLocaleString()}`, `${revenue > 0 ? ((netProfit / revenue) * 100).toFixed(1) : 0}%`]
  ];

  autoTable(doc, {
    startY: 46,
    head: [['Financial Metric / Account Head', 'Amount (PKR)', '% of Revenue']],
    body: tableBody,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], fontSize: 8.5, fontStyle: 'bold' },
    styles: { fontSize: 8.5, cellPadding: 3.5 },
    columnStyles: {
      1: { halign: 'right', fontStyle: 'bold' },
      2: { halign: 'right' }
    },
    didParseCell: (data) => {
      if (data.row.index === 2) {
        data.cell.styles.fillColor = [239, 246, 255]; // Blue 50
        data.cell.styles.fontStyle = 'bold';
      }
      if (data.row.index === 4) {
        data.cell.styles.fillColor = [236, 253, 245]; // Emerald 50
        data.cell.styles.textColor = [4, 120, 87]; // Emerald 700
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });

  addDocFooter(doc);
  doc.save(`ProfitLoss_Statement_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportInventorySummaryPDF(products: Product[], settings?: ShowroomSettings) {
  const doc = new jsPDF();
  addDocHeader(
    doc, 
    'STOCK VALUATION & INVENTORY SUMMARY', 
    `Active showroom appliances, warehouse balances and cost valuation`, 
    settings
  );

  const totalQty = products.reduce((sum, p) => sum + p.stockQuantity, 0);
  const totalCostVal = products.reduce((sum, p) => sum + (p.purchasePrice * p.stockQuantity), 0);
  const totalRetailVal = products.reduce((sum, p) => sum + (p.retailPrice * p.stockQuantity), 0);

  const tableBody = products.map(p => {
    const valuation = p.purchasePrice * p.stockQuantity;
    const status = p.stockQuantity <= p.minStockLevel ? 'Low Stock' : 'In Stock';
    return [
      p.sku,
      p.name,
      p.brand,
      p.category,
      p.stockQuantity,
      `PKR ${p.purchasePrice.toLocaleString()}`,
      `PKR ${p.retailPrice.toLocaleString()}`,
      `PKR ${valuation.toLocaleString()}`,
      status
    ];
  });

  autoTable(doc, {
    startY: 44,
    head: [['SKU', 'Product Name', 'Brand', 'Category', 'Qty', 'Cost Price', 'Retail Price', 'Valuation', 'Status']],
    body: tableBody,
    foot: [[
      'TOTALS',
      `${products.length} Models`,
      '',
      '',
      totalQty,
      '',
      `PKR ${totalRetailVal.toLocaleString()}`,
      `PKR ${totalCostVal.toLocaleString()}`,
      ''
    ]],
    theme: 'striped',
    headStyles: { fillColor: [15, 118, 110], fontSize: 8, fontStyle: 'bold' },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontSize: 8, fontStyle: 'bold' },
    styles: { fontSize: 7, cellPadding: 2 },
    columnStyles: {
      4: { halign: 'center', fontStyle: 'bold' },
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right', fontStyle: 'bold' }
    }
  });

  addDocFooter(doc);
  doc.save(`InventorySummary_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportInstallmentsPDF(accounts: InstallmentAccount[], settings?: ShowroomSettings) {
  const doc = new jsPDF();
  addDocHeader(
    doc, 
    'INSTALLMENT PORTFOLIO & RECOVERY LEDGER', 
    `Active hire-purchase financing accounts, dues and arrears`, 
    settings
  );

  const totalDues = accounts.reduce((sum, a) => sum + a.remainingBalance, 0);
  const totalReceived = accounts.reduce((sum, a) => sum + a.totalReceived, 0);

  const tableBody = accounts.map(a => [
    a.accountNumber,
    a.customerName,
    a.customerPhone,
    a.productName,
    `PKR ${a.monthlyInstallment.toLocaleString()}`,
    `PKR ${a.totalReceived.toLocaleString()}`,
    `PKR ${a.remainingBalance.toLocaleString()}`,
    a.status
  ]);

  autoTable(doc, {
    startY: 44,
    head: [['A/C #', 'Customer Name', 'Phone', 'Appliance', 'Monthly Due', 'Total Received', 'Remaining Bal', 'Status']],
    body: tableBody,
    foot: [[
      'TOTALS',
      `${accounts.length} Accounts`,
      '',
      '',
      '',
      `PKR ${totalReceived.toLocaleString()}`,
      `PKR ${totalDues.toLocaleString()}`,
      ''
    ]],
    theme: 'striped',
    headStyles: { fillColor: [124, 58, 237], fontSize: 8, fontStyle: 'bold' },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontSize: 8, fontStyle: 'bold' },
    styles: { fontSize: 7.5, cellPadding: 2 },
    columnStyles: {
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right', fontStyle: 'bold', textColor: [185, 28, 28] }
    }
  });

  addDocFooter(doc);
  doc.save(`InstallmentRecovery_${new Date().toISOString().split('T')[0]}.pdf`);
}

// ---------------- LEDGERS PDF EXPORTERS ----------------

export function exportTrialBalancePDF(
  rows: { code: string; name: string; category: string; debit: number; credit: number }[],
  settings?: ShowroomSettings
) {
  const doc = new jsPDF();
  addDocHeader(
    doc, 
    'SHOWROOM TRIAL BALANCE STATEMENT', 
    'Double-entry closing account balances across Chart of Accounts', 
    settings
  );

  const totalDebit = rows.reduce((sum, r) => sum + r.debit, 0);
  const totalCredit = rows.reduce((sum, r) => sum + r.credit, 0);

  const tableBody = rows.map(r => [
    r.code,
    r.name,
    r.category,
    r.debit > 0 ? `PKR ${r.debit.toLocaleString()}` : '—',
    r.credit > 0 ? `PKR ${r.credit.toLocaleString()}` : '—'
  ]);

  autoTable(doc, {
    startY: 44,
    head: [['Account Code', 'Account Head Name', 'Category', 'Debit (PKR)', 'Credit (PKR)']],
    body: tableBody,
    foot: [[
      'TRIAL BALANCE TOTALS',
      '',
      '',
      `PKR ${totalDebit.toLocaleString()}`,
      `PKR ${totalCredit.toLocaleString()}`
    ]],
    theme: 'striped',
    headStyles: { fillColor: [37, 99, 235], fontSize: 8.5, fontStyle: 'bold' },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontSize: 8.5, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2.5 },
    columnStyles: {
      3: { halign: 'right', fontStyle: 'bold' },
      4: { halign: 'right', fontStyle: 'bold' }
    }
  });

  addDocFooter(doc);
  doc.save(`TrialBalance_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportAccountStatementPDF(
  title: string,
  entityName: string,
  entityId: string,
  contact: string,
  ledgerRows: { date: string; voucherNo: string; description: string; debit: number; credit: number; balance: number }[],
  settings?: ShowroomSettings
) {
  const doc = new jsPDF();
  addDocHeader(
    doc, 
    title.toUpperCase(), 
    `Statement for: ${entityName} (${entityId}) • Phone: ${contact}`, 
    settings
  );

  const totalDebit = ledgerRows.reduce((sum, r) => sum + r.debit, 0);
  const totalCredit = ledgerRows.reduce((sum, r) => sum + r.credit, 0);
  const finalBalance = ledgerRows.length > 0 ? ledgerRows[ledgerRows.length - 1].balance : 0;

  const tableBody = ledgerRows.map(r => [
    r.date,
    r.voucherNo,
    r.description,
    r.debit > 0 ? `PKR ${r.debit.toLocaleString()}` : '—',
    r.credit > 0 ? `PKR ${r.credit.toLocaleString()}` : '—',
    `PKR ${r.balance.toLocaleString()}`
  ]);

  autoTable(doc, {
    startY: 44,
    head: [['Date', 'Voucher #', 'Description / Narration', 'Debit (PKR)', 'Credit (PKR)', 'Balance (PKR)']],
    body: tableBody,
    foot: [[
      'STATEMENT TOTALS',
      '',
      '',
      `PKR ${totalDebit.toLocaleString()}`,
      `PKR ${totalCredit.toLocaleString()}`,
      `Closing: PKR ${finalBalance.toLocaleString()}`
    ]],
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59], fontSize: 8, fontStyle: 'bold' },
    footStyles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontSize: 8, fontStyle: 'bold' },
    styles: { fontSize: 7.5, cellPadding: 2 },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right', fontStyle: 'bold' }
    }
  });

  addDocFooter(doc);
  doc.save(`${entityName.replace(/\s+/g, '_')}_Statement_${new Date().toISOString().split('T')[0]}.pdf`);
}
