import React, { useState } from 'react';
import { Sparkles, Send, ArrowRight, AlertTriangle, Loader2, ShieldCheck } from 'lucide-react';
import { Modal } from './Modal';
import { authorizedApiFetch } from '../../services/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  getProducts,
  getSales,
  getCustomers,
  getSuppliers,
  getInstallmentAccounts,
  getCheques,
  getBalanceSheetStatement,
  getInventoryReportsData,
  getInstallmentReportsData,
} from '../../services/storage';

interface AiAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (module: string) => void;
}

interface ProposedAction {
  type: string;
  targetTab?: string;
  label: string;
  draftText?: string;
}

interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
  proposedAction?: ProposedAction | null;
  model?: string;
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  const { can, isOwner, staffUser } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const buildScopedContext = () => {
    const context: Record<string, any> = {};
    const today = new Date().toISOString().split('T')[0];

    if (can('dashboard', 'VIEW')) {
      const sales = getSales();
      const todaySales = sales.filter(s => s.date === today);
      context.kpis = {
        todayDate: today,
        todayInvoicesCount: todaySales.length,
        todaySalesTotal: todaySales.reduce((sum, s) => sum + s.grandTotal, 0),
        todayCashCollected: todaySales.reduce((sum, s) => sum + s.paidAmount, 0),
        lifetimeSalesCount: sales.length,
        lifetimeSalesTotal: sales.reduce((sum, s) => sum + s.grandTotal, 0),
      };
    }

    if (can('inventory', 'VIEW') || can('pos', 'VIEW')) {
      const products = getProducts();
      const invReports = getInventoryReportsData();
      context.inventory = {
        totalProducts: products.length,
        totalStockUnits: products.reduce((sum, p) => sum + p.stockQuantity, 0),
        totalInventoryCostValue: products.reduce((sum, p) => sum + p.purchasePrice * p.stockQuantity, 0),
        lowStockCount: invReports.lowStockReorder.length,
        lowStockTopItems: invReports.lowStockReorder.slice(0, 10).map(p => ({
          name: p.name,
          sku: p.sku,
          stockQuantity: p.stockQuantity,
          reorderLevel: p.reorderLevel ?? p.minStockLevel,
        })),
        damagedTotalUnits: products.reduce((sum, p) => sum + (p.damagedQuantity || 0), 0),
      };
    }

    if (can('installments', 'VIEW')) {
      const accounts = getInstallmentAccounts();
      const instReports = getInstallmentReportsData(today);
      const overdue = accounts.filter(a => a.status === 'Overdue');
      context.installments = {
        totalAccounts: accounts.length,
        activeAccounts: accounts.filter(a => a.status === 'Active').length,
        overdueCount: overdue.length,
        totalPortfolioRemaining: accounts.reduce((sum, a) => sum + a.remainingBalance, 0),
        overdueSample: overdue.slice(0, 8).map(a => ({
          customerName: a.customerName,
          productName: a.productName,
          remainingBalance: a.remainingBalance,
          monthlyInstallment: a.monthlyInstallment,
        })),
        dueTodayCount: instReports.dueToday.length,
      };
    }

    if (can('accounting', 'VIEW') || can('reports', 'VIEW')) {
      const bs = getBalanceSheetStatement();
      context.financials = {
        totalAssets: bs.assetsTotal,
        totalLiabilities: bs.liabilitiesTotal,
        totalEquity: bs.equityTotal,
        isBalanced: bs.isBalanced,
        netProfit: bs.netIncome,
      };
    }

    if (can('cheques', 'VIEW')) {
      const cheques = getCheques();
      context.cheques = {
        totalCheques: cheques.length,
        pendingCount: cheques.filter(c => c.status === 'Pending' || c.status === 'Deposited').length,
        bouncedCount: cheques.filter(c => c.status === 'Bounced').length,
        pendingAmount: cheques
          .filter(c => c.status === 'Pending' || c.status === 'Deposited')
          .reduce((sum, c) => sum + c.amount, 0),
      };
    }

    if (can('customers', 'VIEW')) {
      const customers = getCustomers();
      context.customers = {
        totalCustomers: customers.length,
        totalReceivableBalance: customers.reduce((sum, c) => sum + c.currentBalance, 0),
        topReceivables: [...customers]
          .filter(c => c.currentBalance > 0)
          .sort((a, b) => b.currentBalance - a.currentBalance)
          .slice(0, 5)
          .map(c => ({ name: c.name, balance: c.currentBalance })),
      };
    }

    if (can('suppliers', 'VIEW')) {
      const suppliers = getSuppliers();
      context.suppliers = {
        totalSuppliers: suppliers.length,
        totalPayableBalance: suppliers.reduce((sum, s) => sum + s.currentBalance, 0),
      };
    }

    return context;
  };

  const handleSubmit = async (e?: React.FormEvent, overridePrompt?: string) => {
    if (e) e.preventDefault();
    const cleanPrompt = (overridePrompt ?? prompt).trim();
    if (!cleanPrompt || loading) return;

    setErrorMsg('');
    setPrompt('');
    setTurns(prev => [...prev, { role: 'user', text: cleanPrompt }]);
    setLoading(true);

    try {
      const res = await authorizedApiFetch('/api/ai/assistant', {
        method: 'POST',
        body: JSON.stringify({
          prompt: cleanPrompt,
          context: buildScopedContext(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Assistant request failed (HTTP ${res.status}).`);
      }

      setTurns(prev => [
        ...prev,
        {
          role: 'assistant',
          text: String(data.reply || 'No response received.'),
          proposedAction: data.proposedAction || null,
          model: data.model,
        },
      ]);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to reach AI Business Assistant service.');
    } finally {
      setLoading(false);
    }
  };

  const quickSuggestions: string[] = [];
  if (can('dashboard', 'VIEW')) quickSuggestions.push("Summarize today's showroom sales and collections.");
  if (can('inventory', 'VIEW')) quickSuggestions.push('Which products are currently low on stock?');
  if (can('installments', 'VIEW')) quickSuggestions.push('Summarize overdue installment accounts requiring follow-up.');
  if (can('reports', 'VIEW') || can('accounting', 'VIEW')) quickSuggestions.push('Review our current Balance Sheet and net profit.');

  const executeProposedAction = (action: ProposedAction) => {
    if (action.type === 'navigate' && action.targetTab) {
      onNavigate(action.targetTab);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="ERP Business Assistant"
      subtitle={`Grounded exclusively in your live ${isOwner ? 'Owner' : staffUser?.role || 'Staff'} RBAC-permitted ERP data`}
      maxWidth="2xl"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Responses are strictly filtered by your role permissions and live ledger numbers.</span>
          </div>
        </div>

        {quickSuggestions.length > 0 && turns.length === 0 && (
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Suggested Inquiries
            </p>
            <div className="flex flex-wrap gap-2">
              {quickSuggestions.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSubmit(undefined, q)}
                  className="text-left text-xs px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {turns.map((turn, idx) => (
            <div
              key={idx}
              className={`rounded-xl p-3 text-xs leading-relaxed ${
                turn.role === 'user'
                  ? 'bg-blue-50 border border-blue-200 text-slate-900 ml-8'
                  : 'bg-white border border-slate-200 text-slate-800 mr-4 shadow-2xs'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {turn.role === 'user' ? staffUser?.name || 'You' : 'Al-Madina ERP Assistant'}
                </span>
              </div>
              <p className="whitespace-pre-wrap">{turn.text}</p>

              {turn.proposedAction && turn.proposedAction.type === 'navigate' && turn.proposedAction.targetTab && (
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">Suggested action (requires confirmation):</span>
                  <button
                    type="button"
                    onClick={() => executeProposedAction(turn.proposedAction!)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold whitespace-nowrap shrink-0 transition"
                  >
                    <span>{turn.proposedAction.label}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span>Analyzing permitted ERP records...</span>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={e => handleSubmit(e)} className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <input
            type="text"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Ask about sales, low stock, overdue installments, or financials..."
            maxLength={2000}
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
          />
          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 px-4 py-2 text-xs font-semibold text-white whitespace-nowrap shrink-0 transition"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Ask</span>
            <Send className="h-3 w-3" />
          </button>
        </form>
      </div>
    </Modal>
  );
};
