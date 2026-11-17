import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { ORG_ID, OWNER_EMAIL, type BackupRecord, type ModulePermissionKey, type PermissionAction, type PermissionsMatrix, type RoleTemplate, type SecurityEvent, type UserSession } from '../types/rbac';
import type { ShowroomSettings, AccountHead, User } from '../types/erp';

export function stripUndefined<T>(obj: T): T {
  if (Array.isArray(obj)) {
    return obj.map(item => stripUndefined(item)) as unknown as T;
  }
  if (obj !== null && typeof obj === 'object') {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj as Record<string, any>)) {
      if (v !== undefined) {
        clean[k] = stripUndefined(v);
      }
    }
    return clean as T;
  }
  return obj;
}

export function sanitizeDocId(rawId: string): string {
  const cleaned = String(rawId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-');
  return (cleaned || `DOC-${Date.now()}`).slice(0, 128);
}

export type CloudCollectionName =
  | 'settings'
  | 'customers'
  | 'suppliers'
  | 'employees'
  | 'attendance'
  | 'visitors'
  | 'products'
  | 'purchases'
  | 'purchaseReturns'
  | 'sales'
  | 'salesReturns'
  | 'installments'
  | 'accounts'
  | 'vouchers'
  | 'cheques'
  | 'targets'
  | 'tasks'
  | 'auditLogs'
  | 'backups'
  | 'users'
  | 'roles'
  | 'sessions'
  | 'securityEvents';

export interface CloudSyncCallbacks {
  onCollectionUpdate: (name: CloudCollectionName, docs: any[]) => void;
  onSyncError?: (err: unknown) => void;
}

function userCanView(isOwner: boolean, perms: PermissionsMatrix, mod: ModulePermissionKey): boolean {
  if (isOwner) return true;
  const actions: PermissionAction[] | undefined = perms[mod];
  return Array.isArray(actions) && actions.includes('VIEW');
}

export function attachPermittedCloudListeners(
  uid: string,
  isOwner: boolean,
  permissions: PermissionsMatrix,
  callbacks: CloudSyncCallbacks
): () => void {
  if (!db) return () => {};
  const unsubs: Unsubscribe[] = [];

  const watchOrgCollection = (colName: CloudCollectionName, allowed: boolean) => {
    if (!allowed || !db) return;
    const q = query(collection(db, colName), where('orgId', '==', ORG_ID));
    const unsub = onSnapshot(
      q,
      snapshot => {
        const rows = snapshot.docs.map(d => ({ ...d.data(), id: d.data().id || d.id }));
        callbacks.onCollectionUpdate(colName, rows);
      },
      error => {
        try {
          handleFirestoreError(error, OperationType.LIST, colName);
        } catch (wrapped) {
          callbacks.onSyncError?.(wrapped);
        }
      }
    );
    unsubs.push(unsub);
  };

  watchOrgCollection('settings', true);
  watchOrgCollection('customers', userCanView(isOwner, permissions, 'customers') || userCanView(isOwner, permissions, 'pos') || userCanView(isOwner, permissions, 'installments'));
  watchOrgCollection('suppliers', userCanView(isOwner, permissions, 'suppliers') || userCanView(isOwner, permissions, 'purchases'));
  watchOrgCollection('employees', userCanView(isOwner, permissions, 'attendance') || userCanView(isOwner, permissions, 'targets'));
  watchOrgCollection('attendance', userCanView(isOwner, permissions, 'attendance'));
  watchOrgCollection('visitors', userCanView(isOwner, permissions, 'visitors'));
  watchOrgCollection('products', userCanView(isOwner, permissions, 'inventory') || userCanView(isOwner, permissions, 'pos') || userCanView(isOwner, permissions, 'purchases'));
  watchOrgCollection('purchases', userCanView(isOwner, permissions, 'purchases'));
  watchOrgCollection('purchaseReturns', userCanView(isOwner, permissions, 'purchaseReturns') || userCanView(isOwner, permissions, 'purchases') || userCanView(isOwner, permissions, 'reports'));
  watchOrgCollection('sales', userCanView(isOwner, permissions, 'pos') || userCanView(isOwner, permissions, 'reports') || userCanView(isOwner, permissions, 'ledgers'));
  watchOrgCollection('salesReturns', userCanView(isOwner, permissions, 'salesReturns') || userCanView(isOwner, permissions, 'pos') || userCanView(isOwner, permissions, 'reports'));
  watchOrgCollection('installments', userCanView(isOwner, permissions, 'installments') || userCanView(isOwner, permissions, 'reports'));
  watchOrgCollection('accounts', userCanView(isOwner, permissions, 'accounting') || userCanView(isOwner, permissions, 'ledgers') || userCanView(isOwner, permissions, 'reports'));
  watchOrgCollection('vouchers', userCanView(isOwner, permissions, 'accounting') || userCanView(isOwner, permissions, 'ledgers'));
  watchOrgCollection('cheques', userCanView(isOwner, permissions, 'cheques'));
  watchOrgCollection('targets', userCanView(isOwner, permissions, 'targets'));
  watchOrgCollection('tasks', userCanView(isOwner, permissions, 'tasks'));
  watchOrgCollection('auditLogs', isOwner || userCanView(isOwner, permissions, 'audit'));
  watchOrgCollection('backups', isOwner || userCanView(isOwner, permissions, 'audit'));

  if (isOwner) {
    watchOrgCollection('roles', true);
    watchOrgCollection('securityEvents', true);

    // Owner watches users & sessions for uid == current or all if bootstrapped owner
    const email = auth?.currentUser?.email?.toLowerCase();
    if (email === OWNER_EMAIL) {
      const usersUnsub = onSnapshot(
        query(collection(db, 'users'), where('orgId', '==', ORG_ID)),
        snap => callbacks.onCollectionUpdate('users', snap.docs.map(d => d.data())),
        err => console.warn('Users snapshot warning:', err.message)
      );
      const sessUnsub = onSnapshot(
        query(collection(db, 'sessions'), where('orgId', '==', ORG_ID)),
        snap => callbacks.onCollectionUpdate('sessions', snap.docs.map(d => d.data())),
        err => console.warn('Sessions snapshot warning:', err.message)
      );
      unsubs.push(usersUnsub, sessUnsub);
    }
  } else {
    // Non-owner listens only to own sessions
    const ownSessUnsub = onSnapshot(
      query(collection(db, 'sessions'), where('uid', '==', uid)),
      snap => callbacks.onCollectionUpdate('sessions', snap.docs.map(d => d.data())),
      err => console.warn('Own sessions snapshot warning:', err.message)
    );
    unsubs.push(ownSessUnsub);
  }

  return () => {
    unsubs.forEach(u => u());
  };
}

export async function persistCloudDoc(colName: CloudCollectionName, docId: string, payload: Record<string, any>): Promise<void> {
  if (!db || !auth?.currentUser) return;
  const safeId = sanitizeDocId(docId);
  const cleanPayload = stripUndefined({
    ...payload,
    id: safeId,
    orgId: ORG_ID,
  });
  try {
    await setDoc(doc(db, colName, safeId), cleanPayload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${colName}/${safeId}`);
  }
}

export interface BatchWriteOp {
  collection: CloudCollectionName;
  id: string;
  data: Record<string, any>;
  merge?: boolean;
}

export async function commitCloudBatch(ops: BatchWriteOp[]): Promise<void> {
  if (!db || !auth?.currentUser || ops.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const op of ops) {
      const safeId = sanitizeDocId(op.id);
      const clean = stripUndefined({
        ...op.data,
        ...(op.collection !== 'settings' ? { id: safeId } : {}),
        orgId: ORG_ID,
      });
      const ref = doc(db, op.collection, safeId);
      if (op.merge === false) {
        batch.set(ref, clean);
      } else {
        batch.set(ref, clean, { merge: true });
      }
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, ops.map(o => `${o.collection}/${o.id}`).join(','));
  }
}

export async function seedInitialCloudDefaultsIfNeeded(
  settings: ShowroomSettings,
  zeroedAccounts: AccountHead[],
  existingSettingsCount: number,
  existingAccountsCount: number
): Promise<void> {
  if (!db || !auth?.currentUser) return;
  const ops: BatchWriteOp[] = [];
  if (existingSettingsCount === 0) {
    ops.push({
      collection: 'settings',
      id: 'main',
      data: { ...settings, orgId: ORG_ID, updatedAt: new Date().toISOString() },
    });
  }
  if (existingAccountsCount === 0) {
    for (const acc of zeroedAccounts) {
      ops.push({
        collection: 'accounts',
        id: acc.id,
        data: { ...acc, orgId: ORG_ID },
      });
    }
  }
  if (ops.length > 0) {
    await commitCloudBatch(ops);
  }
}

export async function recordCloudBackupMetadata(backup: BackupRecord): Promise<void> {
  await persistCloudDoc('backups', backup.id, backup);
}

export async function persistRoleTemplate(role: RoleTemplate): Promise<void> {
  await persistCloudDoc('roles', role.id, role);
}

export async function persistUserSession(session: UserSession): Promise<void> {
  await persistCloudDoc('sessions', session.id, session);
}

export async function persistSecurityEvent(event: SecurityEvent): Promise<void> {
  await persistCloudDoc('securityEvents', event.id, event);
}

export async function updateStaffMemberDoc(user: User): Promise<void> {
  const uid = user.uid || user.id;
  await persistCloudDoc('users', uid, { ...user, id: uid, uid, orgId: ORG_ID });
  await persistCloudDoc('users_public' as any, uid, {
    uid,
    orgId: ORG_ID,
    name: user.name,
    role: user.role,
    active: user.active && !user.suspended,
  });
}
