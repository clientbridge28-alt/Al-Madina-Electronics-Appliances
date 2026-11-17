import React, { useState, useEffect } from 'react';
import {
  Printer, FileSpreadsheet, FileDown
} from 'lucide-react';
import {
  getSales, getSalesReturns, getPurchaseReturns, getProducts, getInstallmentAccounts,
  getChartOfAccounts, getSettings, getAuditLogs,
  getDateWiseProfitReport, getBrandWiseStockReport, getMonthlyReceivedReport,
  subscribeToDatabase
} from '../../services/storage';
import {
  exportToXLSX, exportSalesToExcel, exportCollectionToCSV,
  exportProductsToExcel, exportInstallmentsToExcel
} from '../../services/excelService';
import {
  exportSalesReportPDF, exportProfitLossPDF,
  exportInventorySummaryPDF, exportInstallmentsPDF
} from '../../services/pdfService';

type ReportTab =
  | 'Sales'
  | 'ProfitLoss'
  | 'DateProfit'
  | 'Stock'
  | 'BrandStock'
  | 'Recovery'
  | 'MonthlyReceived'
  | 'Returns'
  | 'ActivityLog';

export const ReportsView: React.FC = () => {
  const [, setDbTick] = useState(0);
  useEffect(() => subscribeToDatabase(() => setDbTick(t => t + 1)), []);

  const sales = getSales();
  const salesReturns = getSalesReturns();
  const purchaseReturns = getPurchaseReturns();
  const products = getProducts();
  const installments = getInstallmentAccounts();
  const accounts = getChartOfAccounts();
  const settings = getSettings();
  const auditLogs = getAuditLogs();

  const [reportType, setReportType] = useState<ReportTab>('Sales');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [monthYear, setMonthYear] = useState(new Date().toISOString().slice(0, 7));

  const totalSalesRevenue = sales.filter(s => s.status !== 'Returned').reduce((sum, s) => sum + s.grandTotal, 0);
  const totalCostOfGoodsSold = sales
    .filter(s => s.status !== 'Returned')
    .reduce((sum, s) => sum + s.items.reduce((itemSum, item) => itemSum + ((item.costPrice || 0) * item.quantity), 0), 0);
  const grossProfit = totalSalesRevenue - totalCostOfGoodsSold;
  const totalOperatingExpenses = accounts
    .filter(a => a.category === 'Expense' && a.id !== 'ACC-501')
    .reduce((sum, a) => sum + a.currentBalance, 0);
  const netProfit = grossProfit - totalOperatingExpenses;

  const totalStockValuation = products.reduce((sum, p) => sum + (p.purchasePrice * p.stockQuantity), 0);
  const totalRetailValuation = products.reduce((sum, p) => sum + (p.retailPrice * p.stockQuantity), 0);
  const expectedGrossMargin = totalRetailValuation - totalStockValuation;

  const dateProfitRows = getDateWiseProfitReport(startDate || undefined, endDate || undefined);
  const brandStockRows = getBrandWiseStockReport();
  const monthlyReceivedRows = getMonthlyReceivedReport(monthYear);

  const handleExportExcel = () => {
    if (reportType === 'Sales') exportSalesToExcel(sales);
    else if (reportType === 'Stock') exportProductsToExcel(products);
    else if (reportType === 'Recovery') exportInstallmentsToExcel(installments);
    else if (reportType === 'DateProfit') exportToXLSX(dateProfitRows, 'DateWise_Profit_Report', 'DateProfit');
    else if (reportType === 'BrandStock') exportToXLSX(brandStockRows, 'BrandWise_Stock_Report', 'BrandStock');
    else if (reportType === 'MonthlyReceived') exportToXLSX(monthlyReceivedRows, `Monthly_Received_${monthYear}`, 'Receipts');
    else if (reportType === 'Returns') exportToXLSX([...salesReturns, ...purchaseReturns], 'Sales_Purchase_Returns', 'Returns');
    else if (reportType === 'ActivityLog') exportToXLSX(auditLogs, 'Daily_Activity_Log', 'Activity');
    else if (reportType === 'ProfitLoss') {
      exportToXLSX([
        { Metric: 'Total Gross Sales Revenue', Amount_PKR: totalSalesRevenue },
        { Metric: 'Cost of Goods Sold (COGS)', Amount_PKR: totalCostOfGoodsSold },
        { Metric: 'Gross Profit', Amount_PKR: grossProfit },
        { Metric: 'Operating Showroom Expenses', Amount_PKR: totalOperatingExpenses },
        { Metric: 'Net Operating Profit', Amount_PKR: netProfit }
      ], `ElectroERP_ProfitAndLoss_${new Date().toISOString().split('T')[0]}`);
    }
  };

  const handleExportCSV = () => {
    if (reportType === 'DateProfit') exportCollectionToCSV(dateProfitRows, 'DateWise_Profit');
    else if (reportType === 'BrandStock') exportCollectionToCSV(brandStockRows, 'BrandWise_Stock');
    else if (reportType === 'MonthlyReceived') exportCollectionToCSV(monthlyReceivedRows, `Monthly_Received_${monthYear}`);
    else if (reportType === 'Returns') exportCollectionToCSV([...salesReturns, ...purchaseReturns], 'Returns_Register');
    else if (reportType === 'ActivityLog') exportCollectionToCSV(auditLogs, 'Activity_Log');
    else if (reportType === 'Sales') exportCollectionToCSV(sales, 'Sales_Report');
    else if (reportType === 'Stock') exportCollectionToCSV(products, 'Stock_Report');
    else exportCollectionToCSV(installments, 'Installments_Report');
  };

  const handleDownloadPDF = () => {
    if (reportType === 'Sales') exportSalesReportPDF(sales, settings);
    else if (reportType === 'ProfitLoss') exportProfitLossPDF(totalSalesRevenue, totalCostOfGoodsSold, grossProfit, totalOperatingExpenses, netProfit, settings);
    else if (reportType === 'Stock' || reportType === 'BrandStock') exportInventorySummaryPDF(products, settings);
    else if (reportType === 'Recovery') exportInstallmentsPDF(installments, settings);
    else window.print();
  };

  const tabs: { id: ReportTab; label: string }[] = [
    { id: 'Sales', label: 'Sales & Revenue' },
    { id: 'ProfitLoss', label: 'Profit & Loss (P&L)' },
    { id: 'DateProfit', label: 'Date-Wise Profit' },
    { id: 'Stock', label: 'Stock Valuation' },
    { id: 'BrandStock', label: 'Brand-Wise Stock' },
    { id: 'Recovery', label: 'Installments & Recovery' },
    { id: 'MonthlyReceived', label: 'Monthly Received' },
    { id: 'Returns', label: 'Sales & Purchase Returns' },
    { id: 'ActivityLog', label: 'Daily Activity Log' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Executive Reports & Financial Intelligence
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Live profit & loss, date-wise margins, brand stock, monthly cash inflows, returns & activity logs
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100/80 px-3.5 py-2 text-xs font-bold text-rose-800 shadow-2xs transition"
          >
            <FileDown className="h-4 w-4 text-rose-600" />
            <span>PDF</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100/80 px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-2xs transition"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
            <span>Excel (.xlsx)</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition"
          >
            <span>CSV</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-3.5 py-2 text-xs font-bold text-white shadow-2xs transition"
          >
            <Printer className="h-4 w-4" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-2xl bg-white p-3 border border-slate-200 shadow-2xs flex items-center gap-1.5 overflow-x-auto text-xs font-bold">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setReportType(t.id)}
            className={`px-3.5 py-2 rounded-xl shrink-0 transition ${
              reportType === t.id ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {reportType === 'Sales' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Sales Turnover</span>
              <p className="text-2xl font-black text-slate-900 font-mono mt-1">₨ {totalSalesRevenue.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-0.5">{sales.length} Invoices posted</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cash POS Invoices</span>
              <p className="text-2xl font-black text-emerald-700 font-mono mt-1">
                ₨ {sales.filter(s => s.saleType === 'Cash').reduce((sum, s) => sum + s.grandTotal, 0).toLocaleString()}
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">Spot payment receipts</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Installment Sales</span>
              <p className="text-2xl font-black text-purple-700 font-mono mt-1">
                ₨ {sales.filter(s => s.saleType === 'Installment').reduce((sum, s) => sum + s.grandTotal, 0).toLocaleString()}
              </p>
              <p className="text-xs text-purple-600 mt-0.5">Financed sales book</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Sale Type</th>
                  <th className="py-3 px-4 text-right">Grand Total</th>
                  <th className="py-3 px-4 text-right">Paid Amount</th>
                  <th className="py-3 px-4 text-right">Balance</th>
                  <th className="py-3 px-4 text-center">Payment Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {sales.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-bold text-blue-700">{s.invoiceNumber}</td>
                    <td className="py-3 px-4 font-sans text-slate-600">{s.date}</td>
                    <td className="py-3 px-4 font-sans font-semibold text-slate-900">{s.customerName}</td>
                    <td className="py-3 px-4 font-sans">{s.saleType}</td>
                    <td className="py-3 px-4 text-right font-bold text-slate-900">₨ {s.grandTotal.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-emerald-700">₨ {s.paidAmount.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-bold text-rose-700">₨ {s.remainingBalance.toLocaleString()}</td>
                    <td className="py-3 px-4 text-center font-sans">{s.paymentMethod}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reportType === 'ProfitLoss' && (
        <div className="rounded-2xl bg-white p-6 border border-slate-200 shadow-2xs space-y-6 max-w-2xl mx-auto">
          <div className="text-center border-b border-slate-200 pb-4">
            <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">{settings.showroomName}</h3>
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mt-0.5">Profit & Loss Statement</p>
            <p className="text-xs text-slate-400">Financial Year 2026-27 (Pakistani Rupees)</p>
          </div>
          <div className="space-y-4 text-xs font-mono">
            <div className="flex justify-between font-sans font-bold text-sm text-slate-900 border-b border-slate-200 pb-1">
              <span>1. Operating Revenue & Income</span>
              <span>₨ {totalSalesRevenue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-sans font-bold text-sm text-slate-900 border-b border-slate-200 pb-1">
              <span>2. Cost of Goods Sold (COGS)</span>
              <span>- ₨ {totalCostOfGoodsSold.toLocaleString()}</span>
            </div>
            <div className="flex justify-between font-sans font-extrabold text-base bg-blue-50 text-blue-900 p-3 rounded-xl border border-blue-200">
              <span>GROSS PROFIT</span>
              <span className="font-mono">₨ {grossProfit.toLocaleString()}</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between font-sans font-bold text-sm text-slate-900 border-b border-slate-200 pb-1">
                <span>3. Operating & Administrative Expenses</span>
                <span>- ₨ {totalOperatingExpenses.toLocaleString()}</span>
              </div>
              {accounts.filter(a => a.category === 'Expense' && a.id !== 'ACC-501').map(exp => (
                <div key={exp.id} className="flex justify-between pl-4 text-slate-600">
                  <span className="font-sans">{exp.name}</span>
                  <span>₨ {exp.currentBalance.toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-sans font-black text-lg bg-emerald-50 text-emerald-950 p-4 rounded-xl border-2 border-emerald-300">
              <span>NET OPERATING PROFIT</span>
              <span className="font-mono text-emerald-800">₨ {netProfit.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {reportType === 'DateProfit' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-wrap items-center gap-3 text-xs">
            <label className="font-bold text-slate-700">From:</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="rounded-xl border border-slate-200 p-2" />
            <label className="font-bold text-slate-700">To:</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="rounded-xl border border-slate-200 p-2" />
            {(startDate || endDate) && (
              <button onClick={() => { setStartDate(''); setEndDate(''); }} className="text-blue-600 font-bold underline">Clear</button>
            )}
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5 text-center">Invoices</th>
                  <th className="p-3.5 text-right">Revenue</th>
                  <th className="p-3.5 text-right">COGS</th>
                  <th className="p-3.5 text-right">Gross Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {dateProfitRows.map(r => (
                  <tr key={r.date} className="hover:bg-slate-50/70">
                    <td className="p-3.5 font-sans font-bold text-slate-900">{r.date}</td>
                    <td className="p-3.5 text-center">{r.invoices}</td>
                    <td className="p-3.5 text-right">₨ {r.revenue.toLocaleString()}</td>
                    <td className="p-3.5 text-right text-slate-600">₨ {r.cogs.toLocaleString()}</td>
                    <td className="p-3.5 text-right font-bold text-emerald-700">₨ {r.grossProfit.toLocaleString()}</td>
                  </tr>
                ))}
                {dateProfitRows.length === 0 && (
                  <tr><td colSpan={5} className="p-8 text-center font-sans text-slate-400">No sales in selected date range.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reportType === 'Stock' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Landed Cost Value</span>
              <p className="text-2xl font-black text-slate-900 font-mono mt-1">₨ {(totalStockValuation / 1000000).toFixed(2)}M</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Retail Market Value</span>
              <p className="text-2xl font-black text-blue-700 font-mono mt-1">₨ {(totalRetailValuation / 1000000).toFixed(2)}M</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Unrealized Gross Margin</span>
              <p className="text-2xl font-black text-emerald-700 font-mono mt-1">₨ {(expectedGrossMargin / 1000000).toFixed(2)}M</p>
            </div>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Brand</th>
                  <th className="py-3 px-4 text-center">Stock Qty</th>
                  <th className="py-3 px-4 text-right">Cost Price</th>
                  <th className="py-3 px-4 text-right">Retail Price</th>
                  <th className="py-3 px-4 text-right">Total Cost Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {products.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-sans font-bold text-slate-900">{p.name}</td>
                    <td className="py-3 px-4 font-sans text-slate-700">{p.brand}</td>
                    <td className="py-3 px-4 text-center font-bold text-slate-900">{p.stockQuantity}</td>
                    <td className="py-3 px-4 text-right text-slate-600">₨ {p.purchasePrice.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-slate-600">₨ {p.retailPrice.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-bold text-blue-700">₨ {(p.purchasePrice * p.stockQuantity).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reportType === 'BrandStock' && (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3.5">Brand</th>
                <th className="p-3.5 text-center">Models (SKUs)</th>
                <th className="p-3.5 text-center">Total Units</th>
                <th className="p-3.5 text-right">Cost Valuation</th>
                <th className="p-3.5 text-right">Retail Valuation</th>
                <th className="p-3.5 text-right">Potential Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {brandStockRows.map(b => (
                <tr key={b.brand} className="hover:bg-slate-50/70">
                  <td className="p-3.5 font-sans font-bold text-slate-900">{b.brand}</td>
                  <td className="p-3.5 text-center">{b.skuCount}</td>
                  <td className="p-3.5 text-center font-bold">{b.totalUnits}</td>
                  <td className="p-3.5 text-right">₨ {b.costValue.toLocaleString()}</td>
                  <td className="p-3.5 text-right text-blue-700">₨ {b.retailValue.toLocaleString()}</td>
                  <td className="p-3.5 text-right font-bold text-emerald-700">₨ {b.potentialMargin.toLocaleString()}</td>
                </tr>
              ))}
              {brandStockRows.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center font-sans text-slate-400">No inventory products recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {reportType === 'Recovery' && (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">A/C Number</th>
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Financed Appliance</th>
                <th className="py-3 px-4 text-right">Monthly Installment</th>
                <th className="py-3 px-4 text-right">Total Recovered</th>
                <th className="py-3 px-4 text-right">Remaining Balance</th>
                <th className="py-3 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {installments.map(a => (
                <tr key={a.id} className="hover:bg-slate-50/60">
                  <td className="py-3 px-4 font-bold text-blue-700">{a.accountNumber}</td>
                  <td className="py-3 px-4 font-sans font-bold text-slate-900">{a.customerName}</td>
                  <td className="py-3 px-4 font-sans text-slate-700">{a.productName}</td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900">₨ {a.monthlyInstallment.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-emerald-700">₨ {a.totalReceived.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-bold text-rose-700">₨ {a.remainingBalance.toLocaleString()}</td>
                  <td className="py-3 px-4 text-center font-sans font-bold">{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reportType === 'MonthlyReceived' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <label className="font-bold text-slate-700">Select Month:</label>
              <input type="month" value={monthYear} onChange={e => setMonthYear(e.target.value)} className="rounded-xl border border-slate-200 p-2" />
            </div>
            <span className="font-mono font-bold text-emerald-700">
              Total Received ({monthYear}): ₨ {monthlyReceivedRows.reduce((s, r) => s + r.amount, 0).toLocaleString()}
            </span>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3.5">Date</th>
                  <th className="p-3.5">Ref #</th>
                  <th className="p-3.5">Source</th>
                  <th className="p-3.5">Customer / Party</th>
                  <th className="p-3.5">Method</th>
                  <th className="p-3.5 text-right">Amount Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {monthlyReceivedRows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    <td className="p-3.5 font-sans text-slate-600">{r.date}</td>
                    <td className="p-3.5 font-bold text-blue-700">{r.ref}</td>
                    <td className="p-3.5 font-sans">{r.source}</td>
                    <td className="p-3.5 font-sans font-semibold text-slate-900">{r.party}</td>
                    <td className="p-3.5 font-sans">{r.method}</td>
                    <td className="p-3.5 text-right font-bold text-emerald-700">₨ {r.amount.toLocaleString()}</td>
                  </tr>
                ))}
                {monthlyReceivedRows.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center font-sans text-slate-400">No cash/bank collections recorded for {monthYear}.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {reportType === 'Returns' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
            <h3 className="text-sm font-bold text-rose-800">Sales Returns ({salesReturns.length})</h3>
            <div className="divide-y divide-slate-100 text-xs">
              {salesReturns.map(r => (
                <div key={r.id} className="py-2 flex justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{r.returnNumber} • {r.customerName}</p>
                    <p className="text-[11px] text-slate-500">Orig #{r.originalInvoiceNo} • {r.refundMethod}</p>
                  </div>
                  <span className="font-mono font-bold text-rose-700">₨ {r.grandTotal.toLocaleString()}</span>
                </div>
              ))}
              {salesReturns.length === 0 && <p className="text-slate-400 py-4 text-center">No sales returns recorded.</p>}
            </div>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
            <h3 className="text-sm font-bold text-amber-800">Purchase Returns ({purchaseReturns.length})</h3>
            <div className="divide-y divide-slate-100 text-xs">
              {purchaseReturns.map(r => (
                <div key={r.id} className="py-2 flex justify-between">
                  <div>
                    <p className="font-bold text-slate-900">{r.returnNumber} • {r.supplierName}</p>
                    <p className="text-[11px] text-slate-500">Orig #{r.originalPurchaseNo} • {r.refundMethod}</p>
                  </div>
                  <span className="font-mono font-bold text-amber-800">₨ {r.grandTotal.toLocaleString()}</span>
                </div>
              ))}
              {purchaseReturns.length === 0 && <p className="text-slate-400 py-4 text-center">No purchase returns recorded.</p>}
            </div>
          </div>
        </div>
      )}

      {reportType === 'ActivityLog' && (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
              <tr>
                <th className="p-3">Timestamp</th>
                <th className="p-3">Staff</th>
                <th className="p-3">Module</th>
                <th className="p-3">Action</th>
                <th className="p-3">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {auditLogs.slice(0, 100).map(l => (
                <tr key={l.id} className="hover:bg-slate-50/70">
                  <td className="p-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">{l.timestamp}</td>
                  <td className="p-3 font-bold text-slate-900">{l.userName}</td>
                  <td className="p-3 font-semibold text-blue-700">{l.module}</td>
                  <td className="p-3 font-semibold text-emerald-700">{l.action}</td>
                  <td className="p-3 text-slate-600">{l.details}</td>
                </tr>
              ))}
              {auditLogs.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-slate-400">No activity logs recorded yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
