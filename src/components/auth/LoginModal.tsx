import React, { useState } from 'react';
import {
  Shield, Lock, Mail, ArrowRight, AlertCircle,
  CheckCircle2, Sparkles, KeyRound, LogOut, RefreshCw, X, Wrench
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getFirebaseRuntimeDiagnostics } from '../../services/firebase';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  requireGate?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, requireGate = false }) => {
  const {
    status,
    firebaseUser,
    authError,
    signInWithGoogle,
    signInWithEmail,
    requestPasswordReset,
    resendVerificationEmail,
    requestMfaCode,
    verifyMfaCode,
    enterDemoMode,
    logout,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  if (!isOpen && !requireGate) return null;

  const diag = getFirebaseRuntimeDiagnostics();
  const firebaseReady = diag.isConfigured && diag.authInitialized && diag.firestoreInitialized;

  const handleRequestMfa = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setBusy(true);
    try {
      const res = await requestMfaCode();
      if (res.ok) setInfoMsg(res.message);
      else setErrorMsg(res.message);
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setBusy(true);
    try {
      const res = await verifyMfaCode(mfaCode.trim());
      if (res.ok) {
        setInfoMsg(res.message);
        if (!requireGate) onClose();
      } else {
        setErrorMsg(res.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setBusy(true);
    try {
      await signInWithGoogle();
      if (!requireGate) onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Google Sign-In cancelled or failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    setBusy(true);
    try {
      await signInWithEmail(email, password);
      if (!requireGate) onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Invalid email or password.');
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setErrorMsg('Enter your registered staff email address first to receive a password reset link.');
      return;
    }
    const res = await requestPasswordReset(email);
    if (res.ok) setInfoMsg(res.message);
    else setErrorMsg(res.message);
  };

  const handleResendVerification = async () => {
    const res = await resendVerificationEmail();
    if (res.ok) setInfoMsg(res.message);
    else setErrorMsg(res.message);
  };

  const handleDemoEntry = () => {
    enterDemoMode();
    if (!requireGate) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto no-print">
      <div
        className="fixed inset-0 bg-slate-950/85 backdrop-blur-md"
        onClick={!requireGate ? onClose : undefined}
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header Banner */}
          <div className="p-7 text-center bg-radial from-slate-800 to-slate-950 text-white relative">
            {!requireGate && (
              <button
                onClick={onClose}
                className="absolute right-4 top-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/30 text-blue-400 border border-blue-400/30 shadow-lg shadow-blue-500/20 mb-3">
              <Shield className="h-7 w-7 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">Secure Access Portal</h2>
            <p className="text-xs text-slate-400 mt-1">Al-Madina Electronics & Appliances ERP</p>
          </div>

          <div className="p-7 space-y-4">
            {(errorMsg || authError) && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                <span>{errorMsg || authError}</span>
              </div>
            )}

            {infoMsg && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                <span>{infoMsg}</span>
              </div>
            )}

            {status === 'needs_verification' && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-3">
                <p className="font-bold">Email Verification Required</p>
                <p>
                  Signed in as <strong>{firebaseUser?.email}</strong>, but your email address is not yet verified. Verify your inbox before accessing showroom records.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleResendVerification}
                    className="flex-1 py-2 rounded-xl bg-amber-600 text-white font-bold hover:bg-amber-700"
                  >
                    Resend Verification Email
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-3 py-2 rounded-xl border border-amber-300 bg-white font-semibold flex items-center gap-1"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Verified
                  </button>
                </div>
                <button
                  onClick={logout}
                  className="w-full py-1.5 text-xs text-slate-600 hover:text-slate-900 underline"
                >
                  Sign Out
                </button>
              </div>
            )}

            {status === 'suspended' && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-300 text-rose-900 text-xs space-y-3">
                <p className="font-bold">Account Suspended</p>
                <p>Your staff access has been suspended by the Owner Administrator. Contact management to restore access.</p>
                <button
                  onClick={logout}
                  className="w-full py-2 rounded-xl bg-rose-600 text-white font-bold flex items-center justify-center gap-1.5"
                >
                  <LogOut className="h-4 w-4" /> Sign Out
                </button>
              </div>
            )}

            {status === 'no_staff_profile' && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-3">
                <p className="font-bold">Account Not Provisioned for Showroom</p>
                <p>
                  Authenticated as <strong>{firebaseUser?.email}</strong>, but no staff permission profile exists yet. Ask the Owner Admin (<code>clientbridge28@gmail.com</code>) to invite/provision your account in Super Admin.
                </p>
                <button
                  onClick={logout}
                  className="w-full py-2 rounded-xl bg-slate-800 text-white font-bold"
                >
                  Sign Out & Switch Account
                </button>
              </div>
            )}

            {status === 'needs_mfa' && (
              <form onSubmit={handleVerifyMfa} className="p-4 rounded-2xl bg-blue-50 border border-blue-200 text-blue-950 text-xs space-y-3">
                <p className="font-bold">Two-Factor Email Verification Required</p>
                <p>
                  Enter the 6-digit security OTP sent to <strong>{firebaseUser?.email}</strong>.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={handleRequestMfa}
                    className="px-3 py-2 rounded-xl border border-blue-300 bg-white font-semibold hover:bg-blue-100/50 disabled:opacity-50"
                  >
                    Send 6-Digit OTP
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    required
                    value={mfaCode}
                    onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="123456"
                    className="flex-1 rounded-xl border border-blue-300 bg-white px-3 py-2 font-mono text-center tracking-widest text-sm focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={busy || mfaCode.length < 6}
                  className="w-full py-2.5 rounded-xl bg-blue-700 text-white font-bold hover:bg-blue-800 disabled:opacity-50"
                >
                  {busy ? 'Verifying...' : 'Verify OTP & Unlock ERP'}
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="w-full py-1.5 text-xs text-slate-600 hover:text-slate-900 underline"
                >
                  Sign Out
                </button>
              </form>
            )}

            {status !== 'needs_verification' && status !== 'needs_mfa' && status !== 'suspended' && status !== 'no_staff_profile' && (
              <>
                <button
                  type="button"
                  disabled={busy || !firebaseReady}
                  onClick={handleGoogleSignIn}
                  className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 py-3 px-4 text-xs font-bold text-slate-800 shadow-xs transition disabled:opacity-50"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z" />
                    <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z" />
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z" />
                  </svg>
                  <span>{busy ? 'Authenticating...' : 'Continue with Verified Google Account'}</span>
                </button>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-slate-200" />
                  <span className="shrink mx-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Or Staff Email & Password
                  </span>
                  <div className="flex-grow border-t border-slate-200" />
                </div>

                <form onSubmit={handleEmailSignIn} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                      Staff Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        placeholder="staff@almadinaelectronics.pk"
                        className="w-full rounded-xl border border-slate-200 pl-10 pr-3.5 py-2.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Password
                      </label>
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <KeyRound className="h-3 w-3" /> Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        className="w-full rounded-xl border border-slate-200 pl-10 pr-3.5 py-2.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={busy || !firebaseReady}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 text-xs shadow-md shadow-blue-500/20 transition disabled:opacity-50"
                  >
                    <span>Sign In to Live Cloud ERP</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>

                {/* Production Configuration Diagnostics */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowDiagnostics(v => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-[11px] font-semibold text-slate-700 transition"
                  >
                    <span className="flex items-center gap-1.5">
                      <Wrench className="h-3.5 w-3.5 text-slate-500" />
                      Production Configuration Diagnostics
                    </span>
                    <span className={firebaseReady ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                      {firebaseReady ? 'Firebase Ready' : 'Action Required'}
                    </span>
                  </button>

                  {(showDiagnostics || !firebaseReady) && (
                    <div className="mt-2 p-3 rounded-xl bg-slate-900 text-slate-200 font-mono text-[10px] space-y-1">
                      <div>Project ID: <span className="text-white">{diag.projectId}</span> ({diag.configuredVia})</div>
                      <div>Auth Domain: <span className="text-white">{diag.authDomain}</span></div>
                      <div>Firestore DB: <span className="text-white">{diag.firestoreDatabaseId}</span></div>
                      <div>App Origin: <span className="text-white">{diag.origin}</span></div>
                      <div>Backend API: <span className="text-white">{diag.apiBaseUrl}</span></div>
                      <div>
                        SDKs: Auth={diag.authInitialized ? 'OK' : 'OFF'} | Firestore={diag.firestoreInitialized ? 'OK' : 'OFF'} | API Key={diag.apiKeyPresent ? 'SET' : 'MISSING'} | App ID={diag.appIdPresent ? 'SET' : 'MISSING'}
                      </div>
                      {diag.missingFields.length > 0 && (
                        <div className="text-rose-300 font-semibold pt-1">
                          Missing Env Vars: {diag.missingFields.join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Isolated Read-Only Client Demo Preview */}
                <div className="pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={handleDemoEntry}
                    className="w-full flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100/70 text-amber-900 font-bold py-2.5 text-xs transition"
                  >
                    <Sparkles className="h-4 w-4 text-amber-600" />
                    <span>Enter Isolated Client Demo Showcase (Read-Only Sample)</span>
                  </button>
                  <p className="text-[10px] text-center text-slate-400 mt-1.5">
                    Demo Showcase runs in temporary session memory only and never modifies production Cloud Firestore data.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
