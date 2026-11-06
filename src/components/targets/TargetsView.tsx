import React, { useState } from 'react';
import { Target as TargetIcon, Plus, CheckCircle, TrendingUp, X } from 'lucide-react';
import { getTargets, saveTarget, getEmployees } from '../../services/storage';
import { Target } from '../../types/erp';

export const TargetsView: React.FC = () => {
  const [targets, setTargets] = useState<Target[]>(getTargets());
  const employees = getEmployees();
  const [showAddModal, setShowAddModal] = useState(false);

  // Form
  const [targetType, setTargetType] = useState<'Sales' | 'Recovery'>('Sales');
  const [targetAmount, setTargetAmount] = useState<number>(5000000);
  const [assignedTo, setAssignedTo] = useState('Showroom Overall');

  const handleSaveTarget = (e: React.FormEvent) => {
    e.preventDefault();
    const newTgt: Target = {
      id: `TGT-${Date.now().toString().slice(-4)}`,
      targetType,
      period: 'Monthly',
      monthYear: '2026-11',
      targetAmount,
      achievedAmount: Math.round(targetAmount * 0.35), // initial progress
      assignedTo,
      status: 'In Progress'
    };

    saveTarget(newTgt);
    setTargets(getTargets());
    setShowAddModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Sales & Recovery Target Management
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Assign showroom goals, recovery quotas & track team performance vs monthly milestones
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition active:scale-98 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>Set New Target</span>
        </button>
      </div>

      {/* Target Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {targets.map(t => {
          const pct = Math.min(100, Math.round((t.achievedAmount / (t.targetAmount || 1)) * 100));

          return (
            <div key={t.id} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                    {t.period} {t.targetType} Target
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-2">{t.assignedTo}</h3>
                  <p className="text-xs text-slate-400 font-mono">Period: {t.monthYear}</p>
                </div>

                <span className="text-lg font-black text-blue-700 font-mono">{pct}%</span>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${pct}%` }}
                    className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 rounded-full transition-all duration-500"
                  />
                </div>
                <div className="flex justify-between text-xs font-mono text-slate-500">
                  <span>Achieved: <strong>₨ {t.achievedAmount.toLocaleString()}</strong></span>
                  <span>Target: <strong>₨ {t.targetAmount.toLocaleString()}</strong></span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Remaining: ₨ {Math.max(0, t.targetAmount - t.achievedAmount).toLocaleString()}</span>
                <span className="font-semibold text-emerald-600">{t.status}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Set Target Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Configure Performance Target</h3>
            <form onSubmit={handleSaveTarget} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Target Type</label>
                <select
                  value={targetType}
                  onChange={e => setTargetType(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5"
                >
                  <option value="Sales">Monthly Sales Volume</option>
                  <option value="Recovery">Installment Recovery Collection</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Target Amount (₨) *</label>
                <input
                  type="number"
                  min={1000}
                  required
                  value={targetAmount}
                  onChange={e => setTargetAmount(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 p-2.5 font-mono text-sm font-bold"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-semibold mb-1">Assign To</label>
                <select
                  value={assignedTo}
                  onChange={e => setAssignedTo(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5"
                >
                  <option value="Showroom Overall">Showroom Overall Team</option>
                  {employees.map(e => (
                    <option key={e.id} value={`${e.name} (${e.designation})`}>{e.name} ({e.designation})</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-blue-600 py-2.5 font-bold text-white hover:bg-blue-700"
                >
                  Save Target
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
