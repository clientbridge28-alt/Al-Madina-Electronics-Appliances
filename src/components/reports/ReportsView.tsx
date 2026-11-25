import React, { useState, useEffect, useMemo } from 'react';
import { Printer, FileSpreadsheet, FileDown } from 'lucide-react';
import {
  getSales,
  getSalesReturns,
  getPurchaseReturns,
  getProducts,
  getInstallmentAccounts,
  getChartOfAccounts,
  getSettings,
  getAuditLogs,
  getDateWiseProfitReport,
  getBrandWiseStockReport,
  getMonthlyReceivedReport,
  getBalanceSheetStatement,
  getCashFlowStatement,
  getInventoryReportsData,
  getInstallmentReportsData,
  subscribeToDatabase,
} from '../../services/storage';
import {
  exportToXLSX,
  exportSalesToExcel,
  exportCollectionToCSV,
  exportProductsToExcel,
  exportInstallmentsToExcel,
} from '../../services/excelService';
import {
  exportSalesReportPDF,
  exportProfitLossPDF,
  exportInventorySummaryPDF,
  exportInstallmentsPDF,
  exportBalanceSheetPDF,
} from '../../services/pdfService';

type ReportTab =
  | 'Sales'
  | 'ProfitLoss'
  | 'BalanceSheet'
  | 'CashFlow'
  | 'DateProfit'
  | 'Stock'
  | 'BrandStock'
  | 'InventoryReports'
  | 'Recovery'
  | 'InstallmentReports'
  | 'MonthlyReceived'
  | 'Returns'
  | 'ActivityLog';

type InventoryReportKey =
  | 'stockValuation'
  | 'brandWise'
  | 'categoryWise'
  | 'lowStockReorder'
  | 'outOfStock'
  | 'serializedUnits'
  | 'damagedAndReturned'
  | 'stockMovementSummary'
  | 'warehouseWiseStock'
  | 'marginAndPricingAnalysis';

type InstallmentReportKey =
  | 'activeAccounts'
  | 'completedAccounts'
  | 'closedEarlyAccounts'
  | 'overdueAccounts'
  | 'defaultedAccounts'
  | 'upcomingDues'
  | 'dueToday'
  | 'officerPerformance'
  | 'recoveryCollections'
  | 'guarantorDirectory'
  | 'sectorWiseDistribution'
  | 'productBrandFinanced'
  | 'markupVsPrincipal'
  | 'agingBuckets'
  | 'commitmentsSchedule'
  | 'rescheduledPlans'
  | 'defaulterFollowUpList'
  | 'downPaymentSummary'
  | 'riskExposureReport'
  | 'customerPortfolioSummary';

const INVENTORY_REPORT_LABELS: { key: InventoryReportKey; label: string }[] = [
  { key: 'stockValuation', label: '1. Stock Valuation Report' },
  { key: 'brandWise', label: '2. Brand-Wise Stock Summary' },
  { key: 'categoryWise', label: '3. Category-Wise Stock Summary' },
  { key: 'lowStockReorder', label: '4. Low Stock & Reorder Alert' },
  { key: 'outOfStock', label: '5. Out-of-Stock Items' },
  { key: 'serializedUnits', label: '6. Serialized / IMEI Inventory' },
  { key: 'damagedAndReturned', label: '7. Damaged & Returned Stock' },
  { key: 'stockMovementSummary', label: '8. Stock Movement Summary' },
  { key: 'warehouseWiseStock', label: '9. Warehouse-Wise Stock' },
  { key: 'marginAndPricingAnalysis', label: '10. Margin & Pricing Analysis' },
];

const INSTALLMENT_REPORT_LABELS: { key: InstallmentReportKey; label: string }[] = [
  { key: 'activeAccounts', label: '1. Active Installment Accounts' },
  { key: 'completedAccounts', label: '2. Completed Accounts' },
  { key: 'closedEarlyAccounts', label: '3. Early-Closed Settlements' },
  { key: 'overdueAccounts', label: '4. Overdue Accounts' },
  { key: 'defaultedAccounts', label: '5. Defaulted Accounts' },
  { key: 'upcomingDues', label: '6. Upcoming Dues (Next 30 Days)' },
  { key: 'dueToday', label: '7. Installments Due Today' },
  { key: 'officerPerformance', label: '8. Officer Recovery Performance' },
  { key: 'recoveryCollections', label: '9. Recovery Collections Ledger' },
  { key: 'guarantorDirectory', label: '10. Dual-Guarantor Directory' },
  { key: 'sectorWiseDistribution', label: '11. Sector / Area Distribution' },
  { key: 'productBrandFinanced', label: '12. Financed Product Breakdown' },
  { key: 'markupVsPrincipal', label: '13. Markup vs Principal Earned' },
  { key: 'agingBuckets', label: '14. Overdue Aging Buckets' },
  { key: 'commitmentsSchedule', label: '15. Customer Payment Commitments' },
  { key: 'rescheduledPlans', label: '16. Rescheduled Plans Register' },
  { key: 'defaulterFollowUpList', label: '17. Defaulter Follow-Up Sheet' },
  { key: 'downPaymentSummary', label: '18. Down Payment Analysis' },
  { key: 'riskExposureReport', label: '19. Portfolio Risk Exposure' },
  { key: 'customerPortfolioSummary', label: '20. Customer Financing Portfolio' },
];

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
  const [selectedInvReport, setSelectedInvReport] = useState<InventoryReportKey>('stockValuation');
  const [selectedInstReport, setSelectedInstReport] = useState<InstallmentReportKey>('activeAccounts');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [monthYear, setMonthYear] = useState(new Date().toISOString().slice(0, 7));
  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);

  const totalSalesRevenue = sales.filter(s => s.status !== 'Returned').reduce((sum, s) => sum + s.grandTotal, 0);
  const totalCostOfGoodsSold = sales
    .filter(s => s.status !== 'Returned')
    .reduce(
      (sum, s) => sum + s.items.reduce((itemSum, item) => itemSum + (item.costPrice || 0) * item.quantity, 0),
      0
    );
  const grossProfit = totalSalesRevenue - totalCostOfGoodsSold;
  const totalOperatingExpenses = accounts
    .filter(a => a.category === 'Expense' && a.id !== 'ACC-501')
    .reduce((sum, a) => sum + a.currentBalance, 0);
  const netProfit = grossProfit - totalOperatingExpenses;

  const totalStockValuation = products.reduce((sum, p) => sum + p.purchasePrice * p.stockQuantity, 0);
  const totalRetailValuation = products.reduce((sum, p) => sum + p.retailPrice * p.stockQuantity, 0);
  const expectedGrossMargin = totalRetailValuation - totalStockValuation;

  const dateProfitRows = getDateWiseProfitReport(startDate || undefined, endDate || undefined);
  const brandStockRows = getBrandWiseStockReport();
  const monthlyReceivedRows = getMonthlyReceivedReport(monthYear);
  const balanceSheet = useMemo(() => getBalanceSheetStatement(), [accounts]);
  const cashFlow = useMemo(() => getCashFlowStatement(), [accounts, sales.length]);
  const inventoryReportsData = useMemo(() => getInventoryReportsData(), [products, sales.length]);
  const installmentReportsData = useMemo(() => getInstallmentReportsData(asOfDate), [installments, asOfDate]);

  const activeInventoryDataset = (inventoryReportsData[selectedInvReport] || []) as Record<string, any>[];
  const activeInstallmentDataset = (installmentReportsData[selectedInstReport] || []) as Record<string, any>[];

  const handleExportExcel = () => {
    if (reportType === 'Sales') exportSalesToExcel(sales);
    else if (reportType === 'Stock') exportProductsToExcel(products);
    else if (reportType === 'Recovery') exportInstallmentsToExcel(installments);
    else if (reportType === 'DateProfit') exportToXLSX(dateProfitRows, 'DateWise_Profit_Report', 'DateProfit');
    else if (reportType === 'BrandStock') exportToXLSX(brandStockRows, 'BrandWise_Stock_Report', 'BrandStock');
    else if (reportType === 'MonthlyReceived')
      exportToXLSX(monthlyReceivedRows, `Monthly_Received_${monthYear}`, 'Receipts');
    else if (reportType === 'Returns')
      exportToXLSX([...salesReturns, ...purchaseReturns], 'Sales_Purchase_Returns', 'Returns');
    else if (reportType === 'ActivityLog') exportToXLSX(auditLogs, 'Daily_Activity_Log', 'Activity');
    else if (reportType === 'InventoryReports')
      exportToXLSX(activeInventoryDataset, `Inventory_${selectedInvReport}`, 'Inventory');
    else if (reportType === 'InstallmentReports')
      exportToXLSX(activeInstallmentDataset, `Installments_${selectedInstReport}`, 'Installments');
    else if (reportType === 'BalanceSheet')
      exportToXLSX(
        [
          ...balanceSheet.assets.map(a => ({ Section: 'Asset', Code: a.code, Head: a.name, Amount_PKR: a.balance })),
          ...balanceSheet.liabilities.map(l => ({
            Section: 'Liability',
            Code: l.code,
            Head: l.name,
            Amount_PKR: l.balance,
          })),
          ...balanceSheet.equity.map(eq => ({ Section: 'Equity', Code: eq.code, Head: eq.name, Amount_PKR: eq.balance })),
          { Section: 'Equity', Code: 'NET', Head: 'Current Period Net Income', Amount_PKR: balanceSheet.netIncome },
        ],
        `Balance_Sheet_${new Date().toISOString().split('T')[0]}`
      );
    else if (reportType === 'CashFlow')
      exportToXLSX(
        [
          { Metric: 'Operating Cash Inflows', Amount_PKR: cashFlow.operatingInflows },
          { Metric: 'Operating Cash Outflows', Amount_PKR: cashFlow.operatingOutflows },
          { Metric: 'Net Operating Cash Flow', Amount_PKR: cashFlow.netOperatingCashFlow },
          { Metric: 'Investing Cash Flow', Amount_PKR: cashFlow.investingCashFlow },
          { Metric: 'Financing Cash Flow', Amount_PKR: cashFlow.financingCashFlow },
          { Metric: 'Net Cash Change', Amount_PKR: cashFlow.netCashChange },
          { Metric: 'Ending Cash & Bank', Amount_PKR: cashFlow.endingCashAndBank },
        ],
        `Cash_Flow_${new Date().toISOString().split('T')[0]}`
      );
    else if (reportType === 'ProfitLoss') {
      exportToXLSX(
        [
          { Metric: 'Total Gross Sales Revenue', Amount_PKR: totalSalesRevenue },
          { Metric: 'Cost of Goods Sold (COGS)', Amount_PKR: totalCostOfGoodsSold },
          { Metric: 'Gross Profit', Amount_PKR: grossProfit },
          { Metric: 'Operating Showroom Expenses', Amount_PKR: totalOperatingExpenses },
          { Metric: 'Net Operating Profit', Amount_PKR: netProfit },
        ],
        `AlMadinaERP_ProfitAndLoss_${new Date().toISOString().split('T')[0]}`
      );
    }
  };

  const handleExportCSV = () => {
    if (reportType === 'DateProfit') exportCollectionToCSV(dateProfitRows, 'DateWise_Profit');
    else if (reportType === 'BrandStock') exportCollectionToCSV(brandStockRows, 'BrandWise_Stock');
    else if (reportType === 'MonthlyReceived')
      exportCollectionToCSV(monthlyReceivedRows, `Monthly_Received_${monthYear}`);
    else if (reportType === 'Returns') exportCollectionToCSV([...salesReturns, ...purchaseReturns], 'Returns_Register');
    else if (reportType === 'ActivityLog') exportCollectionToCSV(auditLogs, 'Activity_Log');
    else if (reportType === 'Sales') exportCollectionToCSV(sales, 'Sales_Report');
    else if (reportType === 'Stock') exportCollectionToCSV(products, 'Stock_Report');
    else if (reportType === 'InventoryReports')
      exportCollectionToCSV(activeInventoryDataset, `Inventory_${selectedInvReport}`);
    else if (reportType === 'InstallmentReports')
      exportCollectionToCSV(activeInstallmentDataset, `Installments_${selectedInstReport}`);
    else if (reportType === 'BalanceSheet')
      exportCollectionToCSV([...balanceSheet.assets, ...balanceSheet.liabilities, ...balanceSheet.equity], 'Balance_Sheet');
    else exportCollectionToCSV(installments, 'Installments_Report');
  };

  const handleDownloadPDF = () => {
    if (reportType === 'Sales') exportSalesReportPDF(sales, settings);
    else if (reportType === 'ProfitLoss')
      exportProfitLossPDF(totalSalesRevenue, totalCostOfGoodsSold, grossProfit, totalOperatingExpenses, netProfit, settings);
    else if (reportType === 'BalanceSheet') exportBalanceSheetPDF(balanceSheet, settings);
    else if (reportType === 'Stock' || reportType === 'BrandStock') exportInventorySummaryPDF(products, settings);
    else if (reportType === 'Recovery') exportInstallmentsPDF(installments, settings);
    else window.print();
  };

  const tabs: { id: ReportTab; label: string }[] = [
    { id: 'Sales', label: 'Sales & Revenue' },
    { id: 'ProfitLoss', label: 'Profit & Loss' },
    { id: 'BalanceSheet', label: 'Balance Sheet' },
    { id: 'CashFlow', label: 'Cash Flow' },
    { id: 'DateProfit', label: 'Date-Wise Profit' },
    { id: 'Stock', label: 'Stock Valuation' },
    { id: 'BrandStock', label: 'Brand Stock' },
    { id: 'InventoryReports', label: '10 Inventory Reports' },
    { id: 'Recovery', label: 'Installments' },
    { id: 'InstallmentReports', label: '20 Installment Reports' },
    { id: 'MonthlyReceived', label: 'Monthly Received' },
    { id: 'Returns', label: 'Returns' },
    { id: 'ActivityLog', label: 'Activity Log' },
  ];

  const renderDynamicTable = (rows: Record<string, any>[], emptyLabel: string) => {
    if (!rows || rows.length === 0) {
      return <div className="p-8 text-center text-xs text-slate-400">{emptyLabel}</div>;
    }
    const keys = Object.keys(rows[0]).filter(
      k =>
        k !== 'schedule' &&
        k !== 'rescheduleHistory' &&
        k !== 'serials' &&
        k !== 'orgId' &&
        k !== 'createdByUid' &&
        k !== 'updatedAt'
    );
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
            <tr>
              {keys.map(k => (
                <th key={k} className="p-3 whitespace-nowrap">
                  {k.replace(/([A-Z])/g, ' $1').trim()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, idx) => (
              <tr key={idx} className="hover:bg-slate-50/70">
                {keys.map(k => {
                  const val = row[k];
                  const isNumeric = typeof val === 'number';
                  return (
                    <td
                      key={k}
                      className={`p-3 whitespace-nowrap ${
                        isNumeric ? 'font-mono tabular-nums font-semibold text-slate-900' : 'text-slate-700'
                      }`}
                    >
                      {val === null || val === undefined || val === ''
                        ? '—'
                        : isNumeric
                        ? val.toLocaleString()
                        : typeof val === 'object'
                        ? JSON.stringify(val)
                        : String(val)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Executive Reports & Financial Intelligence
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Balance Sheet, Cash Flow, P&L, 10 Inventory Reports, 20 Installment Reports & Activity Logs
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          <button
            onClick={handleDownloadPDF}
            className="flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100/80 px-3.5 py-2 text-xs font-bold text-rose-800 shadow-2xs transition whitespace-nowrap shrink-0"
          >
            <FileDown className="h-4 w-4 text-rose-600" />
            <span>PDF</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100/80 px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-2xs transition whitespace-nowrap shrink-0"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
            <span>Excel (.xlsx)</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs transition whitespace-nowrap shrink-0"
          >
            CSV
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-3.5 py-2 text-xs font-bold text-white shadow-2xs transition whitespace-nowrap shrink-0"
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
            className={`px-3.5 py-2 rounded-xl shrink-0 transition whitespace-nowrap ${
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
              <p className="text-2xl font-black text-slate-900 font-mono tabular-nums mt-1">
                ₨ {totalSalesRevenue.toLocaleString()}
              </p>
              <p className="text-xs text-slate-400 mt-0.5">{sales.length} Invoices posted</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cash POS Invoices</span>
              <p className="text-2xl font-black text-emerald-700 font-mono tabular-nums mt-1">
                ₨ {sales.filter(s => s.saleType === 'Cash').reduce((sum, s) => sum + s.grandTotal, 0).toLocaleString()}
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">Spot payment receipts</p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Installment Sales</span>
              <p className="text-2xl font-black text-blue-700 font-mono tabular-nums mt-1">
                ₨{' '}
                {sales.filter(s => s.saleType === 'Installment').reduce((sum, s) => sum + s.grandTotal, 0).toLocaleString()}
              </p>
              <p className="text-xs text-blue-600 mt-0.5">Financed sales book</p>
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
                  <th className="py-3 px-4 text-center">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
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
          <div className="space-y-4 text-xs font-mono tabular-nums">
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
              {accounts
                .filter(a => a.category === 'Expense' && a.id !== 'ACC-501')
                .map(exp => (
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

      {reportType === 'BalanceSheet' && (
        <div className="rounded-2xl bg-white p-6 border border-slate-200 shadow-2xs space-y-6 max-w-4xl mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase">{settings.showroomName}</h3>
              <p className="text-xs font-bold text-blue-700 uppercase">
                Statement of Financial Position (Balance Sheet)
              </p>
            </div>
            <span
              className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${
                balanceSheet.isBalanced
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {balanceSheet.isBalanced ? 'Assets = Liabilities + Equity ✓' : 'Accounting Imbalance'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Assets */}
            <div className="space-y-2">
              <h4 className="font-bold uppercase text-slate-700 border-b border-slate-200 pb-1">Assets</h4>
              {balanceSheet.assets.map(a => (
                <div key={a.id} className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-700">
                    <span className="font-mono text-slate-400 mr-1.5">{a.code}</span>
                    {a.name}
                  </span>
                  <span className="font-mono tabular-nums font-semibold">₨ {a.balance.toLocaleString()}</span>
                </div>
              ))}
              <div className="flex justify-between p-3 rounded-xl bg-blue-50 border border-blue-200 font-bold text-blue-950">
                <span>TOTAL ASSETS</span>
                <span className="font-mono tabular-nums">₨ {balanceSheet.assetsTotal.toLocaleString()}</span>
              </div>
            </div>

            {/* Liabilities & Equity */}
            <div className="space-y-4">
              <div className="space-y-2">
                <h4 className="font-bold uppercase text-slate-700 border-b border-slate-200 pb-1">Liabilities</h4>
                {balanceSheet.liabilities.map(l => (
                  <div key={l.id} className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-700">
                      <span className="font-mono text-slate-400 mr-1.5">{l.code}</span>
                      {l.name}
                    </span>
                    <span className="font-mono tabular-nums font-semibold">₨ {l.balance.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between pt-1 font-bold text-slate-900">
                  <span>Total Liabilities</span>
                  <span className="font-mono tabular-nums">₨ {balanceSheet.liabilitiesTotal.toLocaleString()}</span>
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold uppercase text-slate-700 border-b border-slate-200 pb-1">
                  Equity & Retained Earnings
                </h4>
                {balanceSheet.equity.map(eq => (
                  <div key={eq.id} className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-700">
                      <span className="font-mono text-slate-400 mr-1.5">{eq.code}</span>
                      {eq.name}
                    </span>
                    <span className="font-mono tabular-nums font-semibold">₨ {eq.balance.toLocaleString()}</span>
                  </div>
                ))}
                <div className="flex justify-between py-1 border-b border-slate-100">
                  <span className="text-slate-700">Current Period Net Income / (Loss)</span>
                  <span className="font-mono tabular-nums font-semibold">
                    ₨ {balanceSheet.netIncome.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between p-3 rounded-xl bg-emerald-50 border border-emerald-200 font-bold text-emerald-950">
                  <span>TOTAL LIABILITIES + EQUITY</span>
                  <span className="font-mono tabular-nums">
                    ₨ {balanceSheet.liabilitiesAndEquityTotal.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {reportType === 'CashFlow' && (
        <div className="rounded-2xl bg-white p-6 border border-slate-200 shadow-2xs space-y-4 max-w-2xl mx-auto">
          <div className="border-b border-slate-200 pb-3">
            <h3 className="text-base font-black text-slate-900 uppercase">Cash Flow Statement</h3>
            <p className="text-xs text-slate-400">Operating, Investing & Financing Cash Movements</p>
          </div>
          <div className="space-y-3 text-xs font-mono tabular-nums">
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="font-sans text-slate-700">Operating Cash Inflows</span>
              <span className="text-emerald-700 font-bold">+ ₨ {cashFlow.operatingInflows.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="font-sans text-slate-700">Operating Cash Outflows</span>
              <span className="text-rose-700 font-bold">- ₨ {cashFlow.operatingOutflows.toLocaleString()}</span>
            </div>
            <div className="flex justify-between p-3 rounded-xl bg-slate-50 font-sans font-bold text-slate-900">
              <span>Net Operating Cash Flow</span>
              <span className="font-mono">₨ {cashFlow.netOperatingCashFlow.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="font-sans text-slate-700">Investing Activities (Fixed Assets)</span>
              <span>₨ {cashFlow.investingCashFlow.toLocaleString()}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100">
              <span className="font-sans text-slate-700">Financing Activities (Owner Capital / Drawings)</span>
              <span>₨ {cashFlow.financingCashFlow.toLocaleString()}</span>
            </div>
            <div className="flex justify-between p-3 rounded-xl bg-blue-50 border border-blue-200 font-sans font-bold text-blue-950">
              <span>Net Cash Change</span>
              <span className="font-mono">₨ {cashFlow.netCashChange.toLocaleString()}</span>
            </div>
            <div className="flex justify-between p-4 rounded-xl bg-emerald-50 border-2 border-emerald-300 font-sans font-black text-sm text-emerald-950">
              <span>ENDING CASH & BANK BALANCE</span>
              <span className="font-mono">₨ {cashFlow.endingCashAndBank.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

      {reportType === 'DateProfit' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 flex flex-wrap items-center gap-3 text-xs">
            <label className="font-bold text-slate-700">From:</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="rounded-xl border border-slate-200 p-2"
            />
            <label className="font-bold text-slate-700">To:</label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="rounded-xl border border-slate-200 p-2"
            />
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('');
                  setEndDate('');
                }}
                className="text-blue-600 font-bold underline"
              >
                Clear
              </button>
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
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
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
                  <tr>
                    <td colSpan={5} className="p-8 text-center font-sans text-slate-400">
                      No sales in selected date range.
                    </td>
                  </tr>
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
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Landed Cost Value
              </span>
              <p className="text-2xl font-black text-slate-900 font-mono tabular-nums mt-1">
                ₨ {(totalStockValuation / 1000000).toFixed(2)}M
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Total Retail Market Value
              </span>
              <p className="text-2xl font-black text-blue-700 font-mono tabular-nums mt-1">
                ₨ {(totalRetailValuation / 1000000).toFixed(2)}M
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Unrealized Gross Margin</span>
              <p className="text-2xl font-black text-emerald-700 font-mono tabular-nums mt-1">
                ₨ {(expectedGrossMargin / 1000000).toFixed(2)}M
              </p>
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
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                {products.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-sans font-bold text-slate-900">{p.name}</td>
                    <td className="py-3 px-4 font-sans text-slate-700">{p.brand}</td>
                    <td className="py-3 px-4 text-center font-bold text-slate-900">{p.stockQuantity}</td>
                    <td className="py-3 px-4 text-right text-slate-600">₨ {p.purchasePrice.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right text-slate-600">₨ {p.retailPrice.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-bold text-blue-700">
                      ₨ {(p.purchasePrice * p.stockQuantity).toLocaleString()}
                    </td>
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
            <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
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
                <tr>
                  <td colSpan={6} className="p-8 text-center font-sans text-slate-400">
                    No inventory products recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {reportType === 'InventoryReports' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <label className="font-bold text-slate-700">Inventory Report Suite (10):</label>
              <select
                value={selectedInvReport}
                onChange={e => setSelectedInvReport(e.target.value as InventoryReportKey)}
                className="rounded-xl border border-slate-200 bg-white p-2 font-semibold text-slate-800"
              >
                {INVENTORY_REPORT_LABELS.map(r => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <span className="font-mono text-slate-500">{activeInventoryDataset.length} record(s)</span>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
            {renderDynamicTable(activeInventoryDataset, 'No records match this inventory report.')}
          </div>
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
            <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
              {installments.map(a => (
                <tr key={a.id} className="hover:bg-slate-50/60">
                  <td className="py-3 px-4 font-bold text-blue-700">{a.accountNumber}</td>
                  <td className="py-3 px-4 font-sans font-bold text-slate-900">{a.customerName}</td>
                  <td className="py-3 px-4 font-sans text-slate-700">{a.productName}</td>
                  <td className="py-3 px-4 text-right font-bold text-slate-900">
                    ₨ {a.monthlyInstallment.toLocaleString()}
                  </td>
                  <td className="py-3 px-4 text-right text-emerald-700">₨ {a.totalReceived.toLocaleString()}</td>
                  <td className="py-3 px-4 text-right font-bold text-rose-700">₨ {a.remainingBalance.toLocaleString()}</td>
                  <td className="py-3 px-4 text-center font-sans font-bold">{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reportType === 'InstallmentReports' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <label className="font-bold text-slate-700">Installment Report Suite (20):</label>
              <select
                value={selectedInstReport}
                onChange={e => setSelectedInstReport(e.target.value as InstallmentReportKey)}
                className="rounded-xl border border-slate-200 bg-white p-2 font-semibold text-slate-800"
              >
                {INSTALLMENT_REPORT_LABELS.map(r => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </select>
              <label className="font-bold text-slate-700">As-Of Date:</label>
              <input
                type="date"
                value={asOfDate}
                onChange={e => setAsOfDate(e.target.value)}
                className="rounded-xl border border-slate-200 p-2"
              />
            </div>
            <span className="font-mono text-slate-500">{activeInstallmentDataset.length} record(s)</span>
          </div>
          <div className="rounded-2xl bg-white border border-slate-200 shadow-2xs overflow-hidden">
            {renderDynamicTable(activeInstallmentDataset, 'No records match this installment report.')}
          </div>
        </div>
      )}

      {reportType === 'MonthlyReceived' && (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-white border border-slate-200 flex items-center justify-between text-xs">
            <div className="flex items-center gap-3">
              <label className="font-bold text-slate-700">Select Month:</label>
              <input
                type="month"
                value={monthYear}
                onChange={e => setMonthYear(e.target.value)}
                className="rounded-xl border border-slate-200 p-2"
              />
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
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
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
                  <tr>
                    <td colSpan={6} className="p-8 text-center font-sans text-slate-400">
                      No cash/bank collections recorded for {monthYear}.
                    </td>
                  </tr>
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
                    <p className="font-bold text-slate-900">
                      {r.returnNumber} • {r.customerName}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Orig #{r.originalInvoiceNo} • {r.refundMethod}
                    </p>
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
                    <p className="font-bold text-slate-900">
                      {r.returnNumber} • {r.supplierName}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Orig #{r.originalPurchaseNo} • {r.refundMethod}
                    </p>
                  </div>
                  <span className="font-mono font-bold text-amber-800">₨ {r.grandTotal.toLocaleString()}</span>
                </div>
              ))}
              {purchaseReturns.length === 0 && (
                <p className="text-slate-400 py-4 text-center">No purchase returns recorded.</p>
              )}
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
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-400">
                    No activity logs recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
