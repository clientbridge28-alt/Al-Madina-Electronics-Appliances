import React, { useState, useMemo } from 'react';
import { 
  BarChart3, Download, Printer, Calendar, 
  TrendingUp, DollarSign, Package, CreditCard, ArrowRight,
  FileSpreadsheet, FileDown
} from 'lucide-react';
import { 
  getSales, getPurchases, getProducts, getInstallmentAccounts, 
  getChartOfAccounts, getSettings 
} from '../../services/storage';
import { 
  exportToXLSX, exportSalesToExcel, 
  exportProductsToExcel, exportInstallmentsToExcel 
} from '../../services/excelService';
import { 
  exportSalesReportPDF, exportProfitLossPDF, 
  exportInventorySummaryPDF, exportInstallmentsPDF 
} from '../../services/pdfService';

export const ReportsView: React.FC = () => {
  const sales = getSales();
  const purchases = getPurchases();
  const products = getProducts();
  const installments = getInstallmentAccounts();
  const accounts = getChartOfAccounts();
  const settings = getSettings();

  const [reportType, setReportType] = useState<'Sales' | 'ProfitLoss' | 'Stock' | 'Recovery'>('Sales');
  const [dateRange, setDateRange] = useState<'Month' | 'All'>('All');

  // Calculations
  const totalSalesRevenue = sales.reduce((sum, s) => sum + s.grandTotal, 0);
  const totalCostOfGoodsSold = sales.reduce((sum, s) => {
    return sum + s.items.reduce((itemSum, item) => itemSum + ((item.costPrice || 0) * item.quantity), 0);
  }, 0);
  const grossProfit = Math.max(0, totalSalesRevenue - totalCostOfGoodsSold);

  // Operating Expenses from COA Expense accounts
  const totalOperatingExpenses = accounts
    .filter(a => a.category === 'Expense' && a.id !== 'ACC-501') // exclude COGS
    .reduce((sum, a) => sum + a.currentBalance, 0);

  const netProfit = grossProfit - totalOperatingExpenses;

  // Stock valuation
  const totalStockValuation = products.reduce((sum, p) => sum + (p.purchasePrice * p.stockQuantity), 0);
  const totalRetailValuation = products.reduce((sum, p) => sum + (p.retailPrice * p.stockQuantity), 0);
  const expectedGrossMargin = totalRetailValuation - totalStockValuation;

  // Excel (.xlsx) Native Workbook Export
  const handleExportExcel = () => {
    if (reportType === 'Sales') {
      exportSalesToExcel(sales);
    } else if (reportType === 'Stock') {
      exportProductsToExcel(products);
    } else if (reportType === 'Recovery') {
      exportInstallmentsToExcel(installments);
    } else if (reportType === 'ProfitLoss') {
      exportToXLSX([
        { Metric: 'Total Gross Sales Revenue', Amount_PKR: totalSalesRevenue },
        { Metric: 'Cost of Goods Sold (COGS)', Amount_PKR: totalCostOfGoodsSold },
        { Metric: 'Gross Profit', Amount_PKR: grossProfit },
        { Metric: 'Operating Showroom Expenses', Amount_PKR: totalOperatingExpenses },
        { Metric: 'Net Operating Profit', Amount_PKR: netProfit }
      ], `ElectroERP_ProfitAndLoss_${new Date().toISOString().split('T')[0]}`);
    }
  };

  // PDF Download handler
  const handleDownloadPDF = () => {
    if (reportType === 'Sales') {
      exportSalesReportPDF(sales, settings);
    } else if (reportType === 'ProfitLoss') {
      exportProfitLossPDF(totalSalesRevenue, totalCostOfGoodsSold, grossProfit, totalOperatingExpenses, netProfit, settings);
    } else if (reportType === 'Stock') {
      exportInventorySummaryPDF(products, settings);
    } else if (reportType === 'Recovery') {
      exportInstallmentsPDF(installments, settings);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Executive Reports & Financial Intelligence
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit-ready profit & loss, cash/credit turnover, inventory valuation & recovery analytics
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100/80 px-3.5 py-2 text-xs font-bold text-rose-800 shadow-2xs transition active:scale-98"
            title="Download audit-grade formatted PDF report"
          >
            <FileDown className="h-4 w-4 text-rose-600" />
            <span>Download as PDF</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100/80 px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-2xs transition active:scale-98"
            title="Download formatted Microsoft Excel (.xlsx) financial workbook"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
            <span>Export to Excel (.xlsx)</span>
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-3.5 py-2 text-xs font-bold text-white shadow-2xs transition active:scale-98"
          >
            <Printer className="h-4 w-4" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="rounded-2xl bg-white p-3 border border-slate-200 shadow-2xs flex items-center justify-between overflow-x-auto">
        <div className="flex items-center gap-1.5 text-xs font-bold">
          <button
            onClick={() => setReportType('Sales')}
            className={`px-4 py-2 rounded-xl transition ${
              reportType === 'Sales' ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Sales & Revenue Analysis
          </button>
          <button
            onClick={() => setReportType('ProfitLoss')}
            className={`px-4 py-2 rounded-xl transition ${
              reportType === 'ProfitLoss' ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Income & Net Profit (P&L)
          </button>
          <button
            onClick={() => setReportType('Stock')}
            className={`px-4 py-2 rounded-xl transition ${
              reportType === 'Stock' ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Stock Valuation & Costing
          </button>
          <button
            onClick={() => setReportType('Recovery')}
            className={`px-4 py-2 rounded-xl transition ${
              reportType === 'Recovery' ? 'bg-blue-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Installments & Recovery
          </button>
        </div>
      </div>

      {/* 1. SALES REPORT */}
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

      {/* 2. PROFIT & LOSS STATEMENT */}
      {reportType === 'ProfitLoss' && (
        <div className="rounded-2xl bg-white p-6 border border-slate-200 shadow-2xs space-y-6 max-w-2xl mx-auto">
          <div className="text-center border-b border-slate-200 pb-4">
            <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">{settings.showroomName}</h3>
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mt-0.5">Profit & Loss Statement</p>
            <p className="text-xs text-slate-400">Financial Year 2026-27 (Pakistani Rupees)</p>
          </div>

          <div className="space-y-4 text-xs font-mono">
            {/* Revenue */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-sans font-bold text-sm text-slate-900 border-b border-slate-200 pb-1">
                <span>1. Operating Revenue & Income</span>
                <span>₨ {totalSalesRevenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pl-4 text-slate-600">
                <span className="font-sans">Gross Electronics Sales</span>
                <span>₨ {totalSalesRevenue.toLocaleString()}</span>
              </div>
            </div>

            {/* Cost of Goods Sold */}
            <div className="space-y-1.5">
              <div className="flex justify-between font-sans font-bold text-sm text-slate-900 border-b border-slate-200 pb-1">
                <span>2. Cost of Goods Sold (COGS)</span>
                <span>- ₨ {totalCostOfGoodsSold.toLocaleString()}</span>
              </div>
              <div className="flex justify-between pl-4 text-slate-600">
                <span className="font-sans">Merchandise Landed Acquisition Cost</span>
                <span>₨ {totalCostOfGoodsSold.toLocaleString()}</span>
              </div>
            </div>

            {/* Gross Profit */}
            <div className="flex justify-between font-sans font-extrabold text-base bg-blue-50 text-blue-900 p-3 rounded-xl border border-blue-200">
              <span>GROSS PROFIT</span>
              <span className="font-mono">₨ {grossProfit.toLocaleString()}</span>
            </div>

            {/* Operating Expenses */}
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

            {/* Net Operating Profit */}
            <div className="flex justify-between font-sans font-black text-lg bg-emerald-50 text-emerald-950 p-4 rounded-xl border-2 border-emerald-300">
              <span>NET OPERATING PROFIT</span>
              <span className="font-mono text-emerald-800">₨ {netProfit.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. STOCK VALUATION REPORT */}
      {reportType === 'Stock' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Landed Cost Value</span>
              <p className="text-2xl font-black text-slate-900 font-mono mt-1">₨ {(totalStockValuation / 1000000).toFixed(2)}M</p>
              <p className="text-xs text-slate-400 mt-0.5">Asset value on books</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Retail Market Value</span>
              <p className="text-2xl font-black text-blue-700 font-mono mt-1">₨ {(totalRetailValuation / 1000000).toFixed(2)}M</p>
              <p className="text-xs text-blue-600 mt-0.5 font-medium">At current showroom retail tags</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Unrealized Gross Margin</span>
              <p className="text-2xl font-black text-emerald-700 font-mono mt-1">₨ {(expectedGrossMargin / 1000000).toFixed(2)}M</p>
              <p className="text-xs text-emerald-600 mt-0.5 font-medium">Estimated inventory profit potential</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                <tr>
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Brand</th>
                  <th className="py-3 px-4">Category</th>
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
                    <td className="py-3 px-4 font-sans text-slate-500">{p.category}</td>
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

      {/* 4. RECOVERY REPORT */}
      {reportType === 'Recovery' && (
        <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
              <tr>
                <th className="py-3 px-4">A/C Number</th>
                <th className="py-3 px-4">Customer Name</th>
                <th className="py-3 px-4">Phone</th>
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
                  <td className="py-3 px-4 font-sans text-slate-600">{a.customerPhone}</td>
                  <td className="py-3 px-4 font-sans text-slate-700">{a.productName}</td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900">₨ {a.monthlyInstallment.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right text-emerald-700">₨ {a.totalReceived.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-bold text-rose-700">₨ {a.remainingBalance.toLocaleString()}</td>
                  <td className="py-3 px-4 text-center font-sans font-bold">
                    <span className={a.status === 'Overdue' ? 'text-rose-600' : 'text-emerald-700'}>{a.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
