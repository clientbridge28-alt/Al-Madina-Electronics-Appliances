import React, { useState } from 'react';
import {
  Shield,
  Lock,
  Mail,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  X,
  KeyRound,
  RefreshCw,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { isFirebaseConfigured, getFirebaseRuntimeDiagnostics } from '../../services/firebase';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  requireGate?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onClose,
  requireGate = false,
}) => {
  const {
    status,
    firebaseUser,
    authError,
    mfaState,
    signInWithGoogle,
    signInWithEmail,
    requestPasswordReset,
    resendVerificationEmail,
    refreshVerificationStatus,
    requestMfaOtp,
    verifyMfaOtp,
    logout,
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!isOpen && !requireGate) return null;

  const firebaseReady = isFirebaseConfigured();
  const firebaseDiag = !firebaseReady ? getFirebaseRuntimeDiagnostics() : null;
  const displayError =
    errorMsg ||
    authError ||
    (!firebaseReady
      ? firebaseDiag?.initError ||
        'Firebase Configuration Missing: Configure VITE_FIREBASE_* environment variables to sign in.'
      : null);

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setBusy(true);
    try {
      await signInWithGoogle();
      if (!requireGate) onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google Sign-In Failed.';
      setErrorMsg(msg);
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Wrong Password: Invalid email or password.';
      setErrorMsg(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async (e: React.MouseEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);
    if (!email.trim()) {
      setErrorMsg('Invalid Email: Enter your email address first to reset your password.');
      return;
    }
    setBusy(true);
    try {
      const res = await requestPasswordReset(email);
      if (res.ok) {
        setInfoMsg(res.message);
      } else {
        setErrorMsg(res.message);
      }
    } finally {
      setBusy(false);
    }
  };

  const handleResendVerification = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setBusy(true);
    try {
      const res = await resendVerificationEmail();
      if (res.ok) setInfoMsg(res.message);
      else setErrorMsg(res.message);
    } finally {
      setBusy(false);
    }
  };

  const handleRefreshVerification = async () => {
    setErrorMsg(null);
    setInfoMsg(null);
    setBusy(true);
    try {
      const verified = await refreshVerificationStatus();
      if (!verified) {
        setErrorMsg('Email is still unverified. Click the verification link in your inbox and retry.');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    await verifyMfaOtp(otpCode);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto no-print">
      <div
        className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm"
        onClick={!requireGate ? onClose : undefined}
      />
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10 overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          <div className="p-7 text-center bg-slate-900 text-white relative">
            {!requireGate && (
              <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10"
                aria-label="Close login modal"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/25 text-blue-400 border border-blue-400/30 mb-3">
              <Shield className="h-6 w-6 text-blue-400" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">Al-Madina Electronics &amp; Appliances ERP</h1>
            <p className="text-xs text-slate-400 mt-1">
              {status === 'verification_required'
                ? 'Verify your email address to continue'
                : status === 'mfa_required'
                ? 'Two-factor email verification required'
                : 'Sign in to access your showroom dashboard'}
            </p>
          </div>

          <div className="p-7 space-y-4">
            {status === 'verification_required' ? (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                  <p className="font-bold">Email Verification Required</p>
                  <p>
                    Signed in as <strong>{firebaseUser?.email}</strong>, but your email is not yet verified.
                  </p>
                </div>

                {displayError && (
                  <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                    <span>{displayError}</span>
                  </div>
                )}

                {infoMsg && (
                  <div role="status" className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                    <span>{infoMsg}</span>
                  </div>
                )}

                <button
                  type="button"
                  disabled={busy}
                  onClick={handleRefreshVerification}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 text-xs transition disabled:opacity-50"
                >
                  <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
                  <span>I Verified My Email — Refresh</span>
                </button>

                <button
                  type="button"
                  disabled={busy}
                  onClick={handleResendVerification}
                  className="w-full rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-semibold py-2.5 text-xs transition disabled:opacity-50"
                >
                  Resend Verification Email
                </button>

                <button
                  type="button"
                  onClick={() => logout()}
                  className="w-full flex items-center justify-center gap-1.5 rounded-xl text-rose-700 hover:bg-rose-50 font-semibold py-2 text-xs transition"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : status === 'mfa_required' ? (
              <form onSubmit={handleVerifyMfa} className="space-y-4 text-xs">
                <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900">
                  <p className="font-bold flex items-center gap-1.5">
                    <KeyRound className="h-4 w-4 text-blue-700" />
                    <span>One-Time Verification Code</span>
                  </p>
                  <p className="mt-1 text-[11px] text-blue-800">
                    Account: <strong>{firebaseUser?.email}</strong>
                  </p>
                </div>

                {(mfaState.error || displayError) && (
                  <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                    <span>{mfaState.error || displayError}</span>
                  </div>
                )}

                {mfaState.info && (
                  <div role="status" className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                    <span>{mfaState.info}</span>
                  </div>
                )}

                <div>
                  <label htmlFor="mfa-otp" className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    6-Digit OTP Code
                  </label>
                  <input
                    id="mfa-otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                    value={otpCode}
                    onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="123456"
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-center font-mono text-base font-bold tracking-[0.4em] text-slate-900 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={mfaState.verifying || otpCode.length !== 6}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 text-xs transition disabled:opacity-50"
                >
                  <span>{mfaState.verifying ? 'Verifying...' : 'Verify & Open ERP'}</span>
                  <ArrowRight className="h-4 w-4" />
                </button>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    disabled={mfaState.sending}
                    onClick={() => requestMfaOtp()}
                    className="text-xs font-semibold text-blue-700 hover:underline disabled:opacity-50"
                  >
                    {mfaState.sending ? 'Sending...' : 'Resend OTP Code'}
                  </button>
                  <button
                    type="button"
                    onClick={() => logout()}
                    className="text-xs font-semibold text-rose-700 hover:underline"
                  >
                    Cancel &amp; Sign Out
                  </button>
                </div>
              </form>
            ) : (
              <>
                {displayError && (
                  <div
                    role="alert"
                    className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-600" />
                    <span>{displayError}</span>
                  </div>
                )}

                {infoMsg && (
                  <div
                    role="status"
                    className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5 text-emerald-600" />
                    <span>{infoMsg}</span>
                  </div>
                )}

                <form onSubmit={handleEmailSignIn} noValidate className="space-y-3.5">
                  <div>
                    <label
                      htmlFor="login-email"
                      className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1"
                    >
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                      <input
                        id="login-email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        placeholder="name@company.com"
                        className="w-full rounded-xl border border-slate-200 pl-10 pr-3.5 py-2.5 text-xs text-slate-800 focus:border-blue-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label
                        htmlFor="login-password"
                        className="text-xs font-semibold text-slate-700 uppercase tracking-wider"
                      >
                        Password
                      </label>
                      <button
                        type="button"
                        disabled={busy || !firebaseReady}
                        onClick={handleForgotPassword}
                        className="text-xs font-medium text-blue-600 hover:underline disabled:opacity-50"
                      >
                        Forgot Password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                      <input
                        id="login-password"
                        type="password"
                        autoComplete="current-password"
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
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 text-xs shadow-sm transition disabled:opacity-50"
                  >
                    <span>{busy ? 'Signing in...' : 'Sign In'}</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>

                <div className="relative flex py-1 items-center">
                  <div className="flex-grow border-t border-slate-200" />
                  <span className="shrink mx-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Or
                  </span>
                  <div className="flex-grow border-t border-slate-200" />
                </div>

                <button
                  type="button"
                  disabled={busy || !firebaseReady}
                  onClick={handleGoogleSignIn}
                  className="w-full flex items-center justify-center gap-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 py-3 px-4 text-xs font-bold text-slate-800 shadow-2xs transition disabled:opacity-50"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z" />
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z" />
                    <path fill="#FBBC05" d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z" />
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z" />
                  </svg>
                  <span>Sign in with Google</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
