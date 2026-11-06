import React, { useState } from 'react';
import { Shield, Lock, Mail, ArrowRight, UserCheck, CheckCircle2 } from 'lucide-react';
import { getUsers, setActiveUser, logAuditAction } from '../../services/storage';
import { User } from '../../types/erp';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const users = getUsers();
  const [email, setEmail] = useState('tariq@almadinaelectronics.pk');
  const [password, setPassword] = useState('••••••••');
  const [selectedUser, setSelectedUser] = useState<User>(users[0]);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    const matched = users.find(u => u.email.toLowerCase() === email.toLowerCase()) || selectedUser;
    setActiveUser(matched);
    logAuditAction('Authentication', 'Login Portal Sign In', `User signed into portal: ${matched.name} (${matched.role})`);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 600);
  };

  const handleQuickSelect = (u: User) => {
    setSelectedUser(u);
    setEmail(u.email);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto no-print">
      <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md" onClick={onClose} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div 
          className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200"
          onClick={e => e.stopPropagation()}
        >
          {/* Header Banner */}
          <div className="p-8 text-center bg-radial from-slate-800 to-slate-950 text-white relative">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/30 text-blue-400 border border-blue-400/30 shadow-lg shadow-blue-500/20 mb-3">
              <Shield className="h-7 w-7 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Secure Access Portal</h2>
            <p className="text-xs text-slate-400 mt-1">Al-Madina Electronics & Appliances ERP</p>
          </div>

          {/* Form */}
          <div className="p-8">
            {isSuccess ? (
              <div className="py-8 text-center space-y-3">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto animate-bounce" />
                <h3 className="text-lg font-bold text-slate-800">Authenticated Successfully</h3>
                <p className="text-xs text-slate-500">Loading authorized ERP workspace...</p>
              </div>
            ) : (
              <form onSubmit={handleSignIn} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      placeholder="name@almadinaelectronics.pk"
                      className="w-full rounded-xl border border-slate-200 pl-10 pr-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Password
                    </label>
                    <a href="#forgot" onClick={(e) => { e.preventDefault(); alert('Password reset link sent to authorized registered email.'); }} className="text-xs text-blue-600 hover:underline">
                      Forgot Password?
                    </a>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full rounded-xl border border-slate-200 pl-10 pr-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 text-xs shadow-md shadow-blue-500/20 transition active:scale-98"
                >
                  <span>Sign In to Showroom ERP</span>
                  <ArrowRight className="h-4 w-4" />
                </button>

                {/* Quick Switch Profiles */}
                <div className="pt-4 border-t border-slate-100">
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 text-center">
                    Quick Role Selector (1-Click Test)
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto p-1">
                    {users.map(u => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleQuickSelect(u)}
                        className={`p-2 rounded-xl border text-left transition text-xs ${
                          selectedUser.id === u.id
                            ? 'bg-blue-50 border-blue-400 text-blue-900 font-semibold'
                            : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <p className="truncate font-medium">{u.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{u.role}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
