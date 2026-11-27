import React, { useEffect, useState } from 'react';
import {
  ShieldCheck, ShieldAlert, Users, KeyRound, Activity, Mail, RotateCcw,
  Plus, UserX, UserCheck, Ban, CheckCircle2, AlertTriangle,
  Upload, Lock, RefreshCw, Server, X, Search, Globe, Clock
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  getUsers,
  getUserSessions,
  getSecurityEvents,
  getAdminLoginAudits,
  logAuditAction,
  subscribeToDatabase,
} from '../../services/storage';
import {
  ADMIN_OWNER_EMAILS,
  ALL_PERMISSION_ACTIONS,
  ERP_MODULE_DEFINITIONS,
  getDefaultPermissionsForRole,
  isOwnerEmail,
  ORG_ID,
  OWNER_EMAIL,
  type AdminLoginAudit,
  type ExtendedUserRole,
  type ModulePermissionKey,
  type PermissionAction,
  type PermissionsMatrix,
} from '../../types/rbac';
import type { User } from '../../types/erp';
import { authorizedApiFetch } from '../../services/firebase';
import { persistStaffInviteDoc, persistUserSession, updateStaffMemberDoc } from '../../services/firestoreSync';
import { computeCanonicalSnapshotChecksum, parseBackupWorkbookForRestore } from '../../services/excelService';

type AdminTab = 'users' | 'permissions' | 'sessions' | 'adminLogins' | 'events' | 'recovery';

interface ServerHealth {
  firebaseAdminReady: boolean;
  smtpConfigured: boolean;
  wordpressConfigured: boolean;
  ownerEmail: string;
  adminInitError?: string | null;
}

export const SuperAdminView: React.FC = () => {
  const {
    isOwner,
    staffUser,
    superAdmin2faRequired,
    superAdmin2faVerified,
    mfaState,
    requestMfaOtp,
    verifySuperAdmin2faOtp,
    verifySuperAdmin2faReauth,
    lockSuperAdmin2fa,
    requestPasswordReset,
    reauthenticateOwner,
    notifyOwnerSecurityEvent,
  } = useAuth();

  const [, setVersion] = useState(0);
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [health, setHealth] = useState<ServerHealth | null>(null);
  const [banner, setBanner] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // Mandatory SuperAdmin 2FA gate state
  const [otpCode, setOtpCode] = useState('');
  const [reauthPassword, setReauthPassword] = useState('');
  const [twoFaFeedback, setTwoFaFeedback] = useState<{ type: 'error' | 'info' | 'success'; text: string } | null>(null);

  // Admin Login Audit Logs filter & server fetch state
  const [auditSearch, setAuditSearch] = useState('');
  const [auditEventFilter, setAuditEventFilter] = useState<string>('ALL');
  const [serverAuditLogs, setServerAuditLogs] = useState<AdminLoginAudit[] | null>(null);
  const [loadingServerAudits, setLoadingServerAudits] = useState(false);

  // Provision Staff Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newRole, setNewRole] = useState<ExtendedUserRole>('Cashier');
  const [newCustomRoleName, setNewCustomRoleName] = useState('');
  const [newMfaEnabled, setNewMfaEnabled] = useState(false);

  // Permissions Matrix state
  const [selectedUid, setSelectedUid] = useState<string>('');
  const [draftMatrix, setDraftMatrix] = useState<PermissionsMatrix>({});

  // Disaster Recovery state
  const [drParsed, setDrParsed] = useState<{
    fileName: string;
    snapshot: Record<string, any>;
    checksum: string;
    expectedChecksum?: string;
    recordCount: number;
  } | null>(null);
  const [drConfirmed, setDrConfirmed] = useState(false);

  useEffect(() => {
    const unsub = subscribeToDatabase(() => setVersion(v => v + 1));
    return unsub;
  }, []);

  useEffect(() => {
    authorizedApiFetch('/api/health')
      .then(r => r.json())
      .then(data => setHealth(data))
      .catch(() => setHealth(null));
  }, []);

  const canRenderAdminConsole = isOwner && (!superAdmin2faRequired || superAdmin2faVerified);

  const fetchServerAdminAudits = async () => {
    if (!canRenderAdminConsole) return;
    setLoadingServerAudits(true);
    try {
      const res = await authorizedApiFetch('/api/admin/login-audit');
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (Array.isArray(data.logs)) {
          setServerAuditLogs(data.logs as AdminLoginAudit[]);
        }
      }
    } catch {
      // Fall back cleanly to Firestore listener records
    } finally {
      setLoadingServerAudits(false);
    }
  };

  useEffect(() => {
    if (canRenderAdminConsole && activeTab === 'adminLogins') {
      void fetchServerAdminAudits();
    }
  }, [canRenderAdminConsole, activeTab]);

  const users = getUsers();
  const sessions = getUserSessions();
  const events = getSecurityEvents();
  const firestoreAdminAudits = getAdminLoginAudits();

  const mergedAdminAudits = React.useMemo(() => {
    const byId = new Map<string, AdminLoginAudit>();
    for (const item of firestoreAdminAudits) {
      byId.set(item.id, item);
    }
    if (serverAuditLogs) {
      for (const item of serverAuditLogs) {
        if (item?.id) byId.set(item.id, item);
      }
    }
    return Array.from(byId.values()).sort((a, b) =>
      String(b.timestamp || '').localeCompare(String(a.timestamp || ''))
    );
  }, [firestoreAdminAudits, serverAuditLogs]);

  const filteredAdminAudits = React.useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return mergedAdminAudits.filter(log => {
      if (auditEventFilter !== 'ALL' && log.eventType !== auditEventFilter) {
        return false;
      }
      if (!q) return true;
      return (
        log.email.toLowerCase().includes(q) ||
        log.userName.toLowerCase().includes(q) ||
        log.ipAddress.toLowerCase().includes(q) ||
        log.authMethod.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q)
      );
    });
  }, [mergedAdminAudits, auditSearch, auditEventFilter]);

  const editableUsers = users.filter(u => !isOwnerEmail(u.email) && u.role !== 'Owner');

  useEffect(() => {
    if (!selectedUid && editableUsers.length > 0) {
      setSelectedUid(editableUsers[0].uid || editableUsers[0].id);
      setDraftMatrix(editableUsers[0].permissions || getDefaultPermissionsForRole(editableUsers[0].role));
    }
  }, [editableUsers.length]);

  const handleSelectMatrixUser = (uid: string) => {
    setSelectedUid(uid);
    const target = users.find(u => (u.uid || u.id) === uid);
    if (target) {
      setDraftMatrix(target.permissions || getDefaultPermissionsForRole(target.role));
    }
  };

  if (!isOwner) {
    return (
      <div className="rounded-2xl bg-rose-50 border border-rose-200 p-8 text-center max-w-xl mx-auto mt-10">
        <Lock className="h-10 w-10 text-rose-600 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-rose-950">Owner Super Admin Access Required</h2>
        <p className="text-xs text-rose-800 mt-1">
          Only a verified Showroom Owner ({ADMIN_OWNER_EMAILS.join(', ')}) can manage staff accounts, RBAC permissions, sessions, or disaster recovery restores.
        </p>
      </div>
    );
  }

  if (superAdmin2faRequired && !superAdmin2faVerified) {
    return (
      <div className="max-w-xl mx-auto mt-8 rounded-2xl bg-white border border-slate-200 shadow-lg overflow-hidden">
        <div className="bg-slate-900 text-white p-6 flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-300 shrink-0">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-base font-bold">Mandatory Second-Factor Authentication (2FA)</h2>
            <p className="text-xs text-slate-300 mt-1">
              SuperAdminView access for <span className="font-semibold text-white">{staffUser?.email}</span> is protected by mandatory 2FA. Verify your identity before accessing staff RBAC, admin login audits, sessions, or disaster recovery.
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5 text-xs">
          {(twoFaFeedback || mfaState.error || mfaState.info) && (
            <div
              className={`rounded-xl p-3 border flex items-start gap-2 ${
                twoFaFeedback?.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : twoFaFeedback?.type === 'error' || mfaState.error
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-blue-50 border-blue-200 text-blue-900'
              }`}
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{twoFaFeedback?.text || mfaState.error || mfaState.info}</span>
            </div>
          )}

          {/* Method 1: Live Server Email 6-Digit OTP */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-900">1. Email 6-Digit Verification Code</h3>
                <p className="text-[11px] text-slate-500">
                  {health?.smtpConfigured
                    ? `Dispatches a cryptographic one-time code to ${staffUser?.email}.`
                    : 'Requires server SMTP credentials (use Live Firebase Re-Authentication below when offline/static).'}
                </p>
              </div>
              <button
                type="button"
                disabled={mfaState.sending || mfaState.verifying}
                onClick={async () => {
                  setTwoFaFeedback(null);
                  await requestMfaOtp();
                }}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold disabled:opacity-50"
              >
                {mfaState.sending ? 'Sending...' : 'Send 6-Digit OTP'}
              </button>
            </div>

            <form
              onSubmit={async e => {
                e.preventDefault();
                setTwoFaFeedback(null);
                const res = await verifySuperAdmin2faOtp(otpCode);
                if (!res.ok) {
                  setTwoFaFeedback({ type: 'error', text: res.error || 'OTP verification failed.' });
                } else {
                  setOtpCode('');
                }
              }}
              className="flex gap-2"
            >
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpCode}
                onChange={e => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit OTP"
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-sm tracking-widest focus:border-blue-600 focus:outline-none"
              />
              <button
                type="submit"
                disabled={mfaState.verifying || otpCode.length < 6}
                className="px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold disabled:opacity-50"
              >
                {mfaState.verifying ? 'Verifying...' : 'Verify OTP'}
              </button>
            </form>
          </div>

          {/* Method 2: Live Firebase Second-Factor Re-Authentication */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div>
              <h3 className="font-bold text-slate-900">2. Live Firebase Account Re-Authentication</h3>
              <p className="text-[11px] text-slate-500">
                Complete a fresh Google 2-Step Verification popup or re-confirm your account password to unlock SuperAdminView.
              </p>
            </div>

            <button
              type="button"
              disabled={mfaState.verifying}
              onClick={async () => {
                setTwoFaFeedback(null);
                const res = await verifySuperAdmin2faReauth();
                if (!res.ok) {
                  setTwoFaFeedback({ type: 'error', text: res.error || 'Google re-authentication failed.' });
                }
              }}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-900 font-bold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <ShieldCheck className="h-4 w-4 text-blue-700" />
              <span>{mfaState.verifying ? 'Verifying...' : 'Verify with Google 2-Step Re-Authentication'}</span>
            </button>

            <form
              onSubmit={async e => {
                e.preventDefault();
                setTwoFaFeedback(null);
                const res = await verifySuperAdmin2faReauth(reauthPassword);
                if (!res.ok) {
                  setTwoFaFeedback({ type: 'error', text: res.error || 'Password re-authentication failed.' });
                } else {
                  setReauthPassword('');
                }
              }}
              className="flex gap-2 pt-1"
            >
              <input
                type="password"
                value={reauthPassword}
                onChange={e => setReauthPassword(e.target.value)}
                placeholder="Re-enter admin password to verify"
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs focus:border-blue-600 focus:outline-none"
              />
              <button
                type="submit"
                disabled={mfaState.verifying || !reauthPassword}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold disabled:opacity-50"
              >
                Verify Password
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    setBusy(true);
    try {
      const defaultPerms = getDefaultPermissionsForRole(newRole);
      const res = await authorizedApiFetch('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          name: newName.trim(),
          email: newEmail.trim(),
          password: newPassword,
          phone: newPhone.trim(),
          role: newRole,
          customRoleName: newRole === 'Custom' ? newCustomRoleName.trim() : '',
          permissions: defaultPerms,
          mfaEnabled: newMfaEnabled,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 503 && newRole !== 'Owner') {
          const normalized = newEmail.trim().toLowerCase();
          await persistStaffInviteDoc({
            orgId: ORG_ID,
            email: normalized,
            name: newName.trim(),
            role: newRole,
            customRoleName: newRole === 'Custom' ? newCustomRoleName.trim() : undefined,
            phone: newPhone.trim() || undefined,
            permissions: defaultPerms,
            active: true,
            mfaEnabled: newMfaEnabled,
            invitedBy: staffUser?.email || OWNER_EMAIL,
            createdAt: new Date().toISOString(),
          });
          logAuditAction('SuperAdmin', 'Invite Staff User (Google Sign-In)', `Invited ${newName} (${normalized}) as ${newRole}`);
          setBanner({
            type: 'success',
            text: `Staff invite saved to Cloud Firestore for ${normalized} (${newRole}). They can now click "Continue with Google" to log in immediately.`,
          });
          setShowCreateModal(false);
          setNewName('');
          setNewEmail('');
          setNewPassword('');
          setNewPhone('');
          setNewCustomRoleName('');
          return;
        }
        setBanner({ type: 'error', text: data.error || 'Failed to provision staff account.' });
        return;
      }
      logAuditAction('SuperAdmin', 'Provision Staff User', `Provisioned ${newName} (${newEmail}) as ${newRole}`);
      const emailNote = data.emailNotification?.sent
        ? 'Owner security email alert dispatched.'
        : `Logged in Security Events (${data.emailNotification?.reason || 'SMTP not configured'}).`;
      setBanner({ type: 'success', text: `Staff user ${newEmail} provisioned cleanly. ${emailNote}` });
      setShowCreateModal(false);
      setNewName('');
      setNewEmail('');
      setNewPassword('');
      setNewPhone('');
      setNewCustomRoleName('');
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Provisioning request failed.' });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleSuspend = async (target: User) => {
    const nextSuspended = !target.suspended;
    setBusy(true);
    try {
      const updated: User = {
        ...target,
        suspended: nextSuspended,
        active: !nextSuspended,
        updatedAt: new Date().toISOString(),
      };
      await updateStaffMemberDoc(updated);
      await notifyOwnerSecurityEvent({
        type: nextSuspended ? 'USER_SUSPENDED' : 'USER_REACTIVATED',
        severity: nextSuspended ? 'WARNING' : 'INFO',
        title: `${nextSuspended ? 'Suspended' : 'Reactivated'}: ${target.name}`,
        details: `${target.email} was ${nextSuspended ? 'suspended' : 'reactivated'} by ${staffUser?.email}.`,
      });
      logAuditAction('SuperAdmin', nextSuspended ? 'Suspend Staff' : 'Reactivate Staff', target.email);
      setBanner({
        type: 'success',
        text: `${target.name} has been ${nextSuspended ? 'suspended' : 'reactivated'}.`,
      });
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Failed to update staff status.' });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleMfa = async (target: User) => {
    setBusy(true);
    try {
      const updated: User = {
        ...target,
        mfaEnabled: !target.mfaEnabled,
        updatedAt: new Date().toISOString(),
      };
      await updateStaffMemberDoc(updated);
      logAuditAction('SuperAdmin', 'Toggle MFA', `${target.email} MFA set to ${!target.mfaEnabled}`);
      setBanner({
        type: 'success',
        text: `Two-factor email OTP ${!target.mfaEnabled ? 'enabled' : 'disabled'} for ${target.name}.`,
      });
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Failed to toggle MFA.' });
    } finally {
      setBusy(false);
    }
  };

  const handleRevokeUserSessions = async (uid: string, label: string) => {
    setBusy(true);
    try {
      const res = await authorizedApiFetch(`/api/admin/users/${uid}/revoke`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ type: 'error', text: data.error || 'Could not revoke sessions.' });
        return;
      }
      logAuditAction('SuperAdmin', 'Revoke User Sessions', `Revoked active sessions for ${label}`);
      setBanner({ type: 'success', text: `All refresh tokens and sessions revoked for ${label}.` });
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Session revocation failed.' });
    } finally {
      setBusy(false);
    }
  };

  const handleToggleMatrixCell = (mod: ModulePermissionKey, action: PermissionAction) => {
    setDraftMatrix(prev => {
      const current = prev[mod] || [];
      const exists = current.includes(action);
      const next = exists ? current.filter(a => a !== action) : [...current, action];
      return { ...prev, [mod]: next };
    });
  };

  const handleSavePermissions = async () => {
    const target = users.find(u => (u.uid || u.id) === selectedUid);
    if (!target) return;
    setBusy(true);
    try {
      const updated: User = {
        ...target,
        permissions: draftMatrix,
        updatedAt: new Date().toISOString(),
      };
      await updateStaffMemberDoc(updated);
      await notifyOwnerSecurityEvent({
        type: 'PERMISSIONS_UPDATED',
        severity: 'WARNING',
        title: `Permissions Updated: ${target.name}`,
        details: `Granular RBAC matrix updated for ${target.email} by Owner.`,
      });
      logAuditAction('SuperAdmin', 'Update Permissions Matrix', `Updated RBAC permissions for ${target.email}`);
      setBanner({ type: 'success', text: `Permissions saved to Cloud Firestore for ${target.name}.` });
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Failed to save permissions matrix.' });
    } finally {
      setBusy(false);
    }
  };

  const handleSendTestAlert = async () => {
    setBusy(true);
    try {
      const res = await authorizedApiFetch('/api/notifications/owner', {
        method: 'POST',
        body: JSON.stringify({
          type: 'OWNER_TEST_ALERT',
          severity: 'INFO',
          title: 'Security Alert Pipeline Test',
          details: `Triggered manually from Super Admin by ${staffUser?.email}.`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.sent) {
        setBanner({ type: 'success', text: `Test email dispatched to ${OWNER_EMAIL} and recorded in Security Events.` });
      } else {
        setBanner({
          type: 'info',
          text: `Security event recorded in Firestore. Email was NOT sent: ${data.reason || 'SMTP credentials not configured on server.'}`,
        });
      }
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Alert request failed.' });
    } finally {
      setBusy(false);
    }
  };

  const handleDrFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBanner(null);
    setDrConfirmed(false);
    try {
      if (file.name.toLowerCase().endsWith('.json')) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const checksum = await computeCanonicalSnapshotChecksum(parsed);
        const recordCount = Object.values(parsed).reduce<number>(
          (sum, val) => sum + (Array.isArray(val) ? val.length : 0),
          0
        );
        setDrParsed({
          fileName: file.name,
          snapshot: parsed,
          checksum,
          recordCount,
        });
      } else {
        const result = await parseBackupWorkbookForRestore(file);
        setDrParsed({
          fileName: file.name,
          ...result,
        });
      }
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Could not parse backup file.' });
      setDrParsed(null);
    }
  };

  const handleExecuteRestore = async () => {
    if (!drParsed || !drConfirmed) return;
    setBanner(null);
    setBusy(true);
    try {
      const reauthed = await reauthenticateOwner();
      if (!reauthed) {
        setBanner({ type: 'error', text: 'Owner re-authentication cancelled or failed. Restore aborted for safety.' });
        return;
      }

      const res = await authorizedApiFetch('/api/admin/restore', {
        method: 'POST',
        body: JSON.stringify({
          snapshot: drParsed.snapshot,
          expectedChecksum: drParsed.expectedChecksum || drParsed.checksum,
          overwriteNewer: false,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBanner({ type: 'error', text: data.error || 'Disaster recovery restore failed.' });
        return;
      }
      logAuditAction('SuperAdmin', 'Disaster Recovery Restore', `Restored ${data.restoredCount} records (${data.skippedNewerCount || 0} newer preserved) from ${drParsed.fileName}`);
      setBanner({
        type: 'success',
        text: `Disaster recovery completed: ${data.restoredCount} records restored (${data.createdCount || 0} new, ${data.overwrittenOlderCount || 0} older updated, ${data.skippedNewerCount || 0} newer cloud records preserved).`,
      });
      setDrParsed(null);
      setDrConfirmed(false);
    } catch (err: any) {
      setBanner({ type: 'error', text: err?.message || 'Disaster recovery restore failed.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-blue-700" />
            <h2 className="text-xl font-bold text-slate-900">Owner Super Admin & Security Governance</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Cloud-enforced RBAC, staff account provisioning, active session revocation, security alerts & disaster recovery
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px]">
          {superAdmin2faRequired && superAdmin2faVerified && (
            <button
              type="button"
              onClick={lockSuperAdmin2fa}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-900 font-semibold"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Lock Admin 2FA</span>
            </button>
          )}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold ${
            health?.firebaseAdminReady ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}>
            <Server className="h-3.5 w-3.5" />
            Admin SDK: {health?.firebaseAdminReady ? 'Ready' : 'Check ADC'}
          </span>
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold ${
            health?.smtpConfigured ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-slate-100 border-slate-200 text-slate-700'
          }`}>
            <Mail className="h-3.5 w-3.5" />
            SMTP Email Alerts: {health?.smtpConfigured ? 'Configured' : 'Not Set (Log Only)'}
          </span>
        </div>
      </div>

      {banner && (
        <div className={`rounded-xl p-3.5 border text-xs flex items-start justify-between gap-3 ${
          banner.type === 'success'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : banner.type === 'error'
            ? 'bg-rose-50 border-rose-200 text-rose-900'
            : 'bg-blue-50 border-blue-200 text-blue-900'
        }`}>
          <div className="flex items-start gap-2">
            {banner.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />}
            <span>{banner.text}</span>
          </div>
          <button onClick={() => setBanner(null)} className="text-slate-400 hover:text-slate-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {[
          { id: 'users', label: `Staff & Users (${users.length})`, icon: Users },
          { id: 'permissions', label: 'Permissions Matrix (21 × 7)', icon: KeyRound },
          { id: 'sessions', label: `Active Sessions (${sessions.filter(s => !s.revoked).length})`, icon: Activity },
          { id: 'adminLogins', label: `Admin Login Audits (${mergedAdminAudits.length})`, icon: ShieldAlert },
          { id: 'events', label: `Security Events (${events.length})`, icon: Mail },
          { id: 'recovery', label: 'Disaster Recovery Restore', icon: RotateCcw },
        ].map(t => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as AdminTab)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
                active ? 'bg-slate-900 text-white shadow-xs' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: USERS */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Showroom Staff Directory</h3>
              <p className="text-xs text-slate-500">Server-provisioned Firebase Auth + Firestore staff profiles</p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white px-3.5 py-2 text-xs font-bold shadow-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Provision Staff User</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Staff Member</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">MFA OTP</th>
                  <th className="p-3">Last Login</th>
                  <th className="p-3 text-right">Security Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(u => {
                  const uid = u.uid || u.id;
                  const isTargetOwner = isOwnerEmail(u.email) || u.role === 'Owner';
                  return (
                    <tr key={uid} className="hover:bg-slate-50/70">
                      <td className="p-3">
                        <p className="font-bold text-slate-900">{u.name}</p>
                        <p className="text-[11px] text-slate-500">{u.email} {u.phone ? `• ${u.phone}` : ''}</p>
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-semibold border border-blue-200">
                          {u.customRoleName || u.role}
                        </span>
                      </td>
                      <td className="p-3">
                        {u.suspended || !u.active ? (
                          <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">Suspended</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">Active</span>
                        )}
                      </td>
                      <td className="p-3">
                        <button
                          disabled={busy}
                          onClick={() => handleToggleMfa(u)}
                          className={`px-2 py-0.5 rounded border font-semibold ${
                            u.mfaEnabled
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
                              : 'bg-slate-100 border-slate-200 text-slate-600'
                          }`}
                        >
                          {u.mfaEnabled ? 'Required' : 'Optional'}
                        </button>
                      </td>
                      <td className="p-3 text-slate-500 font-mono text-[11px]">
                        {u.lastLogin ? u.lastLogin.slice(0, 16).replace('T', ' ') : 'Never'}
                      </td>
                      <td className="p-3 text-right space-x-1.5">
                        {!isTargetOwner && (
                          <button
                            disabled={busy}
                            onClick={() => handleToggleSuspend(u)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold border ${
                              u.suspended
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : 'bg-rose-50 border-rose-200 text-rose-700'
                            }`}
                          >
                            {u.suspended ? <UserCheck className="h-3.5 w-3.5" /> : <UserX className="h-3.5 w-3.5" />}
                            <span>{u.suspended ? 'Restore' : 'Suspend'}</span>
                          </button>
                        )}
                        <button
                          disabled={busy}
                          onClick={() => handleRevokeUserSessions(uid, u.name)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold border border-amber-200 bg-amber-50 text-amber-800"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          <span>Revoke Sessions</span>
                        </button>
                        <button
                          disabled={busy}
                          onClick={async () => {
                            const res = await requestPasswordReset(u.email);
                            setBanner({ type: res.ok ? 'success' : 'error', text: res.message });
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          <span>Reset PW</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      No staff records loaded yet. Click "Provision Staff User" to invite showroom staff.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PERMISSIONS MATRIX */}
      {activeTab === 'permissions' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-slate-700">Target Staff Member:</label>
              <select
                value={selectedUid}
                onChange={e => handleSelectMatrixUser(e.target.value)}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-800"
              >
                {editableUsers.length === 0 && <option value="">No non-Owner staff created yet</option>}
                {editableUsers.map(u => (
                  <option key={u.uid || u.id} value={u.uid || u.id}>
                    {u.name} ({u.role}) — {u.email}
                  </option>
                ))}
              </select>
            </div>
            {editableUsers.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    const target = users.find(u => (u.uid || u.id) === selectedUid);
                    if (target) setDraftMatrix(getDefaultPermissionsForRole(target.role));
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Apply Role Defaults
                </button>
                <button
                  disabled={busy}
                  onClick={handleSavePermissions}
                  className="px-4 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-xs"
                >
                  Save Permissions to Firestore
                </button>
              </div>
            )}
          </div>

          {editableUsers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Module</th>
                    {ALL_PERMISSION_ACTIONS.map(act => (
                      <th key={act} className="p-2.5 text-center">{act}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ERP_MODULE_DEFINITIONS.map(mod => (
                    <tr key={mod.key} className="hover:bg-slate-50/70">
                      <td className="p-2.5">
                        <p className="font-bold text-slate-900">{mod.label}</p>
                        <p className="text-[10px] text-slate-500">{mod.group} • {mod.description}</p>
                      </td>
                      {ALL_PERMISSION_ACTIONS.map(act => {
                        const checked = Boolean(draftMatrix[mod.key]?.includes(act));
                        return (
                          <td key={act} className="p-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => handleToggleMatrixCell(mod.key, act)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-slate-500 py-8 text-center">
              Provision a staff user in the Staff & Users tab first to customize their 21-module permission matrix.
            </p>
          )}
        </div>
      )}

      {/* TAB 3: ACTIVE SESSIONS */}
      {activeTab === 'sessions' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="text-sm font-bold text-slate-900">Active & Historical Staff Sessions</h3>
            <p className="text-xs text-slate-500">Revoking a session immediately signs out the remote browser via Firestore listener + Firebase Admin token revocation</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="p-3">User</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Device / Browser</th>
                  <th className="p-3">Started</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessions.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/70">
                    <td className="p-3">
                      <p className="font-bold text-slate-900">{s.userName}</p>
                      <p className="text-[11px] text-slate-500">{s.email}</p>
                    </td>
                    <td className="p-3 font-semibold text-slate-700">{s.role}</td>
                    <td className="p-3 text-[11px] text-slate-500 max-w-xs truncate">{s.deviceInfo || 'Browser'}</td>
                    <td className="p-3 font-mono text-[11px] text-slate-500">{s.createdAt?.slice(0, 16).replace('T', ' ')}</td>
                    <td className="p-3">
                      {s.revoked ? (
                        <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-bold">Revoked</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">Active</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {!s.revoked && (
                        <button
                          disabled={busy}
                          onClick={async () => {
                            await persistUserSession({ ...s, orgId: ORG_ID, revoked: true });
                            logAuditAction('SuperAdmin', 'Revoke Session', `Revoked session ${s.id} for ${s.email}`);
                            setBanner({ type: 'success', text: `Session ${s.id} revoked.` });
                          }}
                          className="px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-semibold"
                        >
                          Revoke
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">No session records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: ADMIN LOGIN AUDITS (SUPERADMIN EXCLUSIVE) */}
      {activeTab === 'adminLogins' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <p className="text-[11px] font-semibold text-slate-500">Total Admin Events</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{mergedAdminAudits.length}</p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <p className="text-[11px] font-semibold text-slate-500">Distinct IP Addresses</p>
              <p className="text-xl font-bold text-blue-700 mt-1">
                {new Set(mergedAdminAudits.map(l => l.ipAddress).filter(Boolean)).size}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <p className="text-[11px] font-semibold text-slate-500">Verified 2FA Unlocks</p>
              <p className="text-xl font-bold text-emerald-700 mt-1">
                {mergedAdminAudits.filter(l => l.eventType === 'ADMIN_2FA_PASSED').length}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs">
              <p className="text-[11px] font-semibold text-slate-500">Failed / Blocked Attempts</p>
              <p className="text-xl font-bold text-rose-700 mt-1">
                {mergedAdminAudits.filter(l => l.eventType === 'ADMIN_2FA_FAILED' || l.eventType === 'ADMIN_LOGIN_BLOCKED').length}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-blue-700" />
                  <span>Immutable Admin Login & 2FA Audit Trail</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Accessible exclusively inside SuperAdminView. Logs every admin login, session restore, 2FA verification, IP address, and timestamp.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={auditSearch}
                    onChange={e => setAuditSearch(e.target.value)}
                    placeholder="Filter email, IP address, details..."
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs focus:border-blue-600 focus:outline-none w-56"
                  />
                </div>
                <select
                  value={auditEventFilter}
                  onChange={e => setAuditEventFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700"
                >
                  <option value="ALL">All Events</option>
                  <option value="ADMIN_LOGIN_SUCCESS">Login Success</option>
                  <option value="ADMIN_SESSION_RESUME">Session Resume</option>
                  <option value="ADMIN_2FA_PASSED">2FA Passed</option>
                  <option value="ADMIN_2FA_FAILED">2FA Failed</option>
                  <option value="ADMIN_LOGIN_BLOCKED">Login Blocked</option>
                </select>
                <button
                  type="button"
                  disabled={loadingServerAudits}
                  onClick={fetchServerAdminAudits}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingServerAudits ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Admin Account</th>
                    <th className="p-3">Event & Status</th>
                    <th className="p-3">Auth Method</th>
                    <th className="p-3">IP Address</th>
                    <th className="p-3">Details & Device</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAdminAudits.map(log => {
                    const isFail = log.status === 'Failed' || log.status === 'Blocked';
                    const isVerified = log.status === 'Verified';
                    return (
                      <tr key={log.id} className="hover:bg-slate-50/70">
                        <td className="p-3 font-mono text-[11px] text-slate-600 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-slate-400" />
                            <span>{log.timestamp?.slice(0, 19).replace('T', ' ')}</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <p className="font-bold text-slate-900">{log.userName}</p>
                          <p className="text-[11px] text-slate-500">{log.email}</p>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col gap-1 items-start">
                            <span
                              className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                isFail
                                  ? 'bg-rose-100 text-rose-800'
                                  : isVerified
                                  ? 'bg-indigo-100 text-indigo-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {log.eventType}
                            </span>
                            <span className="text-[10px] text-slate-500 font-semibold">Status: {log.status}</span>
                          </div>
                        </td>
                        <td className="p-3 font-semibold text-slate-700 whitespace-nowrap">{log.authMethod}</td>
                        <td className="p-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-[11px] text-slate-800">
                            <Globe className="h-3 w-3 text-slate-500" />
                            <span>{log.ipAddress || 'Unknown'}</span>
                          </span>
                        </td>
                        <td className="p-3 max-w-xs">
                          <p className="text-slate-700">{log.details}</p>
                          {log.userAgent && (
                            <p className="text-[10px] text-slate-400 truncate mt-0.5" title={log.userAgent}>
                              {log.userAgent}
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {filteredAdminAudits.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-400">
                        No matching admin login or 2FA audit entries recorded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SECURITY EVENTS */}
      {activeTab === 'events' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Security Events & Owner Email Alerts</h3>
              <p className="text-xs text-slate-500">Target alert recipient: {OWNER_EMAIL}</p>
            </div>
            <button
              disabled={busy}
              onClick={handleSendTestAlert}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-3.5 py-2 text-xs font-bold"
            >
              <Mail className="h-4 w-4" />
              <span>Send Test Owner Alert</span>
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {events.map(ev => (
              <div key={ev.id} className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                      ev.severity === 'CRITICAL'
                        ? 'bg-rose-100 text-rose-800'
                        : ev.severity === 'WARNING'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {ev.severity}
                    </span>
                    <span className="font-bold text-slate-900">{ev.title}</span>
                    <span className="text-[10px] font-mono text-slate-400">{ev.type}</span>
                  </div>
                  <p className="text-slate-600">{ev.details}</p>
                  <p className="text-[11px] text-slate-400">
                    Actor: {ev.actorEmail || ev.actorUid} • Email status: <strong>{ev.emailStatus || (ev.notifiedOwner ? 'Sent' : 'Logged')}</strong>
                  </p>
                </div>
                <span className="font-mono text-[11px] text-slate-400 shrink-0">
                  {ev.createdAt?.slice(0, 19).replace('T', ' ')}
                </span>
              </div>
            ))}
            {events.length === 0 && (
              <p className="p-8 text-center text-xs text-slate-400">No security events recorded yet.</p>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: DISASTER RECOVERY */}
      {activeTab === 'recovery' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-5 max-w-3xl">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 border border-rose-200">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Owner-Only Disaster Recovery Restore</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Restores a previously exported full multi-sheet Excel (<code>.xlsx</code>) or <code>.json</code> backup atomically into Cloud Firestore via server Admin SDK. Requires live Owner re-authentication and SHA-256 integrity verification.
              </p>
            </div>
          </div>

          <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100/70 p-6 cursor-pointer transition">
            <Upload className="h-7 w-7 text-blue-600 mb-2" />
            <span className="text-xs font-bold text-slate-800">Select ERP Backup File (.xlsx or .json)</span>
            <span className="text-[11px] text-slate-500 mt-0.5">Generated from Audit Trail & Backup Center</span>
            <input type="file" accept=".xlsx,.json" onChange={handleDrFileSelect} className="hidden" />
          </label>

          {drParsed && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">{drParsed.fileName}</span>
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold">
                  {drParsed.recordCount} Records Ready
                </span>
              </div>
              <div className="font-mono text-[11px] text-slate-600 break-all">
                Computed SHA-256: {drParsed.checksum}
                {drParsed.expectedChecksum && (
                  <div className="mt-1">
                    Embedded Meta SHA-256: {drParsed.expectedChecksum}{' '}
                    {drParsed.expectedChecksum === drParsed.checksum ? (
                      <span className="text-emerald-700 font-bold">(INTEGRITY VERIFIED)</span>
                    ) : (
                      <span className="text-rose-700 font-bold">(CHECKSUM MISMATCH)</span>
                    )}
                  </div>
                )}
              </div>

              <label className="flex items-start gap-2 pt-2 text-rose-900 font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={drConfirmed}
                  onChange={e => setDrConfirmed(e.target.checked)}
                  className="mt-0.5 rounded border-rose-300 text-rose-600"
                />
                <span>
                  I understand this will restore missing/older documents in Cloud Firestore from the verified snapshot above after Owner re-authentication, while automatically preserving newer cloud documents.
                </span>
              </label>

              <button
                disabled={busy || !drConfirmed}
                onClick={handleExecuteRestore}
                className="w-full py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white font-bold disabled:opacity-50"
              >
                {busy ? 'Executing Atomic Server Restore...' : 'Re-Authenticate Owner & Restore Database'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* MODAL: PROVISION STAFF USER */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Provision Showroom Staff Account</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="e.g. Bilal Ahmed"
                  className="w-full rounded-xl border border-slate-200 p-2.5 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Staff Email *</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="bilal@almadinaelectronics.pk"
                  className="w-full rounded-xl border border-slate-200 p-2.5 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Initial Password (optional for Google Sign-In, min 8 chars)</label>
                <input
                  type="password"
                  minLength={8}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="StrongTempPass#2026 (or leave blank for Google)"
                  className="w-full rounded-xl border border-slate-200 p-2.5 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    placeholder="0300-1234567"
                    className="w-full rounded-xl border border-slate-200 p-2.5"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Base Role *</label>
                  <select
                    value={newRole}
                    onChange={e => setNewRole(e.target.value as ExtendedUserRole)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-2.5"
                  >
                    <option value="Manager">Manager</option>
                    <option value="Accountant">Accountant</option>
                    <option value="Cashier">Cashier</option>
                    <option value="StockManager">StockManager</option>
                    <option value="RecoveryOfficer">RecoveryOfficer</option>
                    <option value="Receptionist">Receptionist</option>
                    <option value="Custom">Custom Role</option>
                  </select>
                </div>
              </div>
              {newRole === 'Custom' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Custom Role Title *</label>
                  <input
                    type="text"
                    required
                    value={newCustomRoleName}
                    onChange={e => setNewCustomRoleName(e.target.value)}
                    placeholder="e.g. Warranty Desk Supervisor"
                    className="w-full rounded-xl border border-slate-200 p-2.5"
                  />
                </div>
              )}
              <label className="flex items-center gap-2 pt-1 text-slate-700">
                <input
                  type="checkbox"
                  checked={newMfaEnabled}
                  onChange={e => setNewMfaEnabled(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600"
                />
                <span>Require 6-digit Email OTP verification on login</span>
              </label>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 font-semibold text-slate-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 rounded-xl bg-blue-700 hover:bg-blue-800 py-2.5 font-bold text-white disabled:opacity-50"
                >
                  {busy ? 'Creating...' : 'Create Staff Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
