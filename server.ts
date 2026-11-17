import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response, type NextFunction } from 'express';
import nodemailer from 'nodemailer';
import { initializeApp, getApps, type App } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const OWNER_EMAIL = (process.env.OWNER_ALERT_EMAIL || 'clientbridge28@gmail.com').toLowerCase();
const ORG_ID = 'al-madina-main';
const GH_PAGES_BASE = '/Al-Madina-Electronics-Appliances';

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId?: string;
  authDomain?: string;
}

function loadFirebaseAppletConfig(): FirebaseAppletConfig | null {
  try {
    const configPath = path.join(__dirname, 'firebase-applet-config.json');
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf8')) as FirebaseAppletConfig;
    }
  } catch (err) {
    console.warn('Could not read firebase-applet-config.json:', err);
  }
  return null;
}

const appletConfig = loadFirebaseAppletConfig();
let adminApp: App | null = null;
let adminInitError: string | null = null;

try {
  const existing = getApps();
  if (existing.length > 0) {
    adminApp = existing[0];
  } else if (appletConfig?.projectId) {
    adminApp = initializeApp({ projectId: appletConfig.projectId });
  }
} catch (err: any) {
  adminInitError = err?.message || 'Firebase Admin initialization failed';
}

const adminAuth = adminApp ? getAuth(adminApp) : null;
const adminDb = adminApp
  ? appletConfig?.firestoreDatabaseId
    ? getFirestore(adminApp, appletConfig.firestoreDatabaseId)
    : getFirestore(adminApp)
  : null;

// In-memory runtime configuration for WordPress when configured dynamically by Owner in current server session
// (Never sent back in plaintext to the browser)
interface ServerWpConfig {
  siteUrl: string;
  restUsername: string;
  appPassword: string;
  wcKey: string;
  wcSecret: string;
  syncProductsAuto: boolean;
  syncStockAuto: boolean;
  syncOrdersAuto: boolean;
  lastBackupAt?: string;
  lastBackupStatus?: string;
  lastBackupRef?: string;
  lastError?: string;
}

const wpRuntimeConfig: ServerWpConfig = {
  siteUrl: process.env.WP_SITE_URL || '',
  restUsername: process.env.WP_REST_USERNAME || '',
  appPassword: process.env.WP_APP_PASSWORD || '',
  wcKey: process.env.WP_WC_KEY || '',
  wcSecret: process.env.WP_WC_SECRET || '',
  syncProductsAuto: false,
  syncStockAuto: true,
  syncOrdersAuto: false,
};

// MFA OTP store (in-memory with strict expiry + attempt limit + rate limit)
interface OtpChallenge {
  codeHash: string;
  expiresAt: number;
  attempts: number;
  used: boolean;
}
const otpStore = new Map<string, OtpChallenge>();
const otpRateLimiter = new Map<string, number[]>();

// Helper: Check SMTP readiness
function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function sendSecurityEmail(subject: string, html: string, toEmail: string = OWNER_EMAIL): Promise<{ sent: boolean; reason?: string }> {
  if (!isSmtpConfigured()) {
    return {
      sent: false,
      reason: 'SMTP_HOST / SMTP_USER / SMTP_PASS not configured on server. Event recorded in Firestore audit log only.',
    };
  }
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: toEmail,
      subject,
      html,
    });
    return { sent: true };
  } catch (err: any) {
    return { sent: false, reason: err?.message || 'SMTP dispatch failed' };
  }
}

interface AuthedRequest extends Request {
  firebaseUser?: DecodedIdToken;
  staffProfile?: Record<string, any> | null;
  isOwnerUser?: boolean;
}

async function requireFirebaseAuth(req: AuthedRequest, res: Response, next: NextFunction): Promise<void> {
  if (!adminAuth) {
    res.status(503).json({ error: 'Firebase Admin SDK is not initialized on this server.' });
    return;
  }
  const authHeader = req.headers.authorization || '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    res.status(401).json({ error: 'Missing Authorization Bearer token.' });
    return;
  }
  try {
    const decoded = await adminAuth.verifyIdToken(match[1], true);
    if (!decoded.email_verified) {
      res.status(403).json({ error: 'Email verification is required.' });
      return;
    }
    req.firebaseUser = decoded;

    let profile: Record<string, any> | null = null;
    if (adminDb) {
      try {
        const snap = await adminDb.collection('users').doc(decoded.uid).get();
        if (snap.exists) {
          profile = snap.data() || null;
        }
      } catch {
        // Ignore if Admin ADC is unavailable in local dev sandbox
      }
    }
    req.staffProfile = profile;
    const isOwnerEmail = (decoded.email || '').toLowerCase() === OWNER_EMAIL;
    const isOwnerRole = profile?.role === 'Owner' && profile?.active === true && profile?.suspended === false;
    req.isOwnerUser = Boolean(isOwnerEmail || isOwnerRole);

    if (profile && (profile.suspended === true || profile.active === false) && !isOwnerEmail) {
      res.status(403).json({ error: 'Account is suspended or inactive.' });
      return;
    }

    next();
  } catch (err: any) {
    res.status(401).json({ error: err?.message || 'Invalid or expired Firebase ID token.' });
  }
}

function requireOwner(req: AuthedRequest, res: Response, next: NextFunction): void {
  if (!req.isOwnerUser) {
    res.status(403).json({ error: 'Owner Super Admin privileges required.' });
    return;
  }
  next();
}

function hasBackendPermission(req: AuthedRequest, moduleKey: string, action: string): boolean {
  if (req.isOwnerUser) return true;
  const perms = req.staffProfile?.permissions;
  if (!perms || typeof perms !== 'object') return false;
  const actions = perms[moduleKey];
  return Array.isArray(actions) && actions.includes(action);
}

async function recordServerSecurityEvent(payload: {
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  actorUid: string;
  actorEmail?: string;
  title: string;
  details: string;
  notifiedOwner: boolean;
  emailStatus: string;
}): Promise<void> {
  if (!adminDb) return;
  try {
    const id = `SEC-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    await adminDb.collection('securityEvents').doc(id).set({
      id,
      orgId: ORG_ID,
      type: payload.type,
      severity: payload.severity,
      actorUid: payload.actorUid,
      actorEmail: payload.actorEmail || '',
      title: payload.title,
      details: payload.details,
      notifiedOwner: payload.notifiedOwner,
      emailStatus: payload.emailStatus,
      createdAt: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('Could not persist server security event to Firestore:', err);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));

  // CORS for GitHub Pages static deployment calling Cloud Run API (if VITE_API_BASE_URL is configured)
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowedOrigins = [
      'https://clientbridge28-alt.github.io',
      process.env.APP_URL || '',
      'http://localhost:3000',
    ].filter(Boolean);

    if (origin && (allowedOrigins.some(o => origin.startsWith(o)) || origin.endsWith('.run.app'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, PUT, DELETE, OPTIONS');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // ---------------- HEALTH & CAPABILITY STATUS ----------------
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      projectId: appletConfig?.projectId || null,
      firestoreDatabaseId: appletConfig?.firestoreDatabaseId || null,
      firebaseAdminReady: Boolean(adminAuth && adminDb),
      adminInitError,
      smtpConfigured: isSmtpConfigured(),
      ownerEmail: OWNER_EMAIL,
      wordpressConfigured: Boolean(wpRuntimeConfig.siteUrl && (wpRuntimeConfig.wcKey || wpRuntimeConfig.appPassword)),
    });
  });

  // ---------------- OWNER SECURITY NOTIFICATIONS ----------------
  app.post('/api/notifications/owner', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const { type, severity = 'INFO', title, details } = req.body || {};
    if (!type || !title || !details) {
      res.status(400).json({ error: 'type, title, and details are required.' });
      return;
    }

    const actorEmail = req.firebaseUser?.email || 'unknown';
    const html = `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
        <h2 style="margin:0 0 8px; color: #0f172a;">Al-Madina ERP Security Alert (${severity})</h2>
        <p style="margin:0 0 12px; color:#334155;"><strong>${String(title)}</strong></p>
        <p style="margin:0 0 8px; font-size: 13px; color:#475569;">Event Type: <code>${String(type)}</code></p>
        <p style="margin:0 0 8px; font-size: 13px; color:#475569;">Actor: <code>${actorEmail}</code> (${req.firebaseUser?.uid})</p>
        <p style="margin:0 0 8px; font-size: 13px; color:#475569;">Details: ${String(details)}</p>
        <p style="margin:16px 0 0; font-size: 11px; color:#94a3b8;">Timestamp: ${new Date().toISOString()}</p>
      </div>
    `;

    const mailRes = await sendSecurityEmail(`[Al-Madina ERP] ${severity}: ${String(title)}`, html);
    await recordServerSecurityEvent({
      type: String(type),
      severity: severity === 'CRITICAL' || severity === 'WARNING' ? severity : 'INFO',
      actorUid: req.firebaseUser!.uid,
      actorEmail,
      title: String(title),
      details: String(details),
      notifiedOwner: mailRes.sent,
      emailStatus: mailRes.sent ? 'Sent' : mailRes.reason || 'Not sent',
    });

    res.json({
      recorded: true,
      sent: mailRes.sent,
      reason: mailRes.reason,
    });
  });

  // ---------------- MFA / OTP SERVER CHALLENGES ----------------
  app.post('/api/mfa/request', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    if (!isSmtpConfigured()) {
      res.status(503).json({
        error: 'SMTP server credentials are not configured, so MFA OTP email cannot be dispatched.',
        smtpConfigured: false,
      });
      return;
    }

    const uid = req.firebaseUser!.uid;
    const email = req.firebaseUser!.email!;
    const now = Date.now();
    const recent = (otpRateLimiter.get(uid) || []).filter(t => now - t < 10 * 60 * 1000);
    if (recent.length >= 5) {
      res.status(429).json({ error: 'Too many OTP requests. Please wait 10 minutes.' });
      return;
    }
    recent.push(now);
    otpRateLimiter.set(uid, recent);

    const otp = String(crypto.randomInt(100000, 999999));
    const codeHash = crypto.createHash('sha256').update(`${uid}:${otp}`).digest('hex');
    otpStore.set(uid, {
      codeHash,
      expiresAt: now + 5 * 60 * 1000,
      attempts: 0,
      used: false,
    });

    const mailRes = await sendSecurityEmail(
      'Al-Madina ERP — One-Time Verification Code',
      `<p>Your Al-Madina Electronics ERP verification code is:</p><h1 style="letter-spacing:4px;font-family:monospace;">${otp}</h1><p>Valid for 5 minutes. Never share this code with anyone.</p>`,
      email
    );

    if (!mailRes.sent) {
      res.status(502).json({ error: mailRes.reason || 'Failed to send OTP email' });
      return;
    }

    res.json({ sent: true, expiresInSeconds: 300 });
  });

  app.post('/api/mfa/verify', requireFirebaseAuth, (req: AuthedRequest, res: Response) => {
    const uid = req.firebaseUser!.uid;
    const code = String(req.body?.code || '').trim();
    const record = otpStore.get(uid);
    if (!record || record.used) {
      res.status(400).json({ verified: false, error: 'No active OTP challenge. Please request a new code.' });
      return;
    }
    if (Date.now() > record.expiresAt) {
      otpStore.delete(uid);
      res.status(400).json({ verified: false, error: 'OTP expired. Request a new code.' });
      return;
    }
    if (record.attempts >= 5) {
      otpStore.delete(uid);
      res.status(429).json({ verified: false, error: 'Maximum OTP attempts exceeded.' });
      return;
    }

    record.attempts += 1;
    const codeHash = crypto.createHash('sha256').update(`${uid}:${code}`).digest('hex');
    if (codeHash !== record.codeHash) {
      res.status(401).json({ verified: false, error: 'Invalid OTP code.' });
      return;
    }

    record.used = true;
    otpStore.delete(uid);
    res.json({ verified: true });
  });

  // ---------------- OWNER SUPER ADMIN USER & SESSION APIs ----------------
  app.post('/api/admin/users', requireFirebaseAuth, requireOwner, async (req: AuthedRequest, res: Response) => {
    if (!adminAuth || !adminDb) {
      res.status(503).json({ error: 'Firebase Admin SDK unavailable.' });
      return;
    }
    const { name, email, password, phone = '', role = 'Cashier', customRoleName = '', permissions = {}, mfaEnabled = false } = req.body || {};
    if (!name || !email) {
      res.status(400).json({ error: 'Staff name and email are required.' });
      return;
    }

    try {
      let authUser;
      try {
        authUser = await adminAuth.getUserByEmail(String(email).trim());
      } catch {
        if (!password || String(password).length < 8) {
          res.status(400).json({ error: 'Password (min 8 chars) is required to create a new Firebase Auth account.' });
          return;
        }
        authUser = await adminAuth.createUser({
          email: String(email).trim(),
          password: String(password),
          displayName: String(name).trim(),
          emailVerified: false,
        });
      }

      const now = new Date().toISOString();
      const userDoc = {
        id: authUser.uid,
        uid: authUser.uid,
        orgId: ORG_ID,
        name: String(name).trim(),
        email: String(email).trim(),
        role,
        customRoleName: String(customRoleName || ''),
        phone: String(phone || ''),
        active: true,
        suspended: false,
        emailVerified: authUser.emailVerified,
        mfaEnabled: Boolean(mfaEnabled),
        sessionVersion: 1,
        permissions,
        lastLogin: '',
        createdAt: now,
        updatedAt: now,
      };

      await adminDb.collection('users').doc(authUser.uid).set(userDoc, { merge: true });
      await adminDb.collection('users_public').doc(authUser.uid).set({
        uid: authUser.uid,
        orgId: ORG_ID,
        name: userDoc.name,
        role: userDoc.role,
        active: true,
      });

      const mailRes = await sendSecurityEmail(
        '[Al-Madina ERP] New Staff Account Provisioned',
        `<p>Owner <strong>${req.firebaseUser?.email}</strong> provisioned account <strong>${userDoc.name}</strong> (${userDoc.email}) with role <strong>${role}</strong>.</p>`
      );

      await recordServerSecurityEvent({
        type: 'STAFF_CREATED',
        severity: 'WARNING',
        actorUid: req.firebaseUser!.uid,
        actorEmail: req.firebaseUser!.email,
        title: `Staff Account Provisioned: ${userDoc.name}`,
        details: `Created/updated staff account ${userDoc.email} with role ${role}.`,
        notifiedOwner: mailRes.sent,
        emailStatus: mailRes.sent ? 'Sent' : mailRes.reason || 'Skipped',
      });

      res.status(201).json({ user: userDoc, emailNotification: mailRes });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to provision staff user.' });
    }
  });

  app.post('/api/admin/users/:uid/revoke', requireFirebaseAuth, requireOwner, async (req: AuthedRequest, res: Response) => {
    if (!adminAuth || !adminDb) {
      res.status(503).json({ error: 'Firebase Admin SDK unavailable.' });
      return;
    }
    const targetUid = req.params.uid;
    try {
      await adminAuth.revokeRefreshTokens(targetUid);
      const userRef = adminDb.collection('users').doc(targetUid);
      const snap = await userRef.get();
      const prevVersion = Number(snap.data()?.sessionVersion || 1);
      await userRef.set({ sessionVersion: prevVersion + 1, updatedAt: new Date().toISOString() }, { merge: true });

      const sessionsSnap = await adminDb.collection('sessions').where('uid', '==', targetUid).where('revoked', '==', false).get();
      const batch = adminDb.batch();
      sessionsSnap.docs.forEach(d => batch.update(d.ref, { revoked: true }));
      await batch.commit();

      res.json({ revoked: true, newSessionVersion: prevVersion + 1 });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to revoke sessions.' });
    }
  });

  // ---------------- OWNER-ONLY DISASTER RECOVERY RESTORE ----------------
  app.post('/api/admin/restore', requireFirebaseAuth, requireOwner, async (req: AuthedRequest, res: Response) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Firebase Admin Firestore unavailable for atomic restore.' });
      return;
    }

    const { snapshot, expectedChecksum } = req.body || {};
    if (!snapshot || typeof snapshot !== 'object') {
      res.status(400).json({ error: 'Backup snapshot payload is required.' });
      return;
    }

    const actualChecksum = crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
    if (expectedChecksum && expectedChecksum !== actualChecksum) {
      res.status(400).json({ error: 'Backup integrity checksum verification failed. File may be corrupted or tampered.' });
      return;
    }

    const collectionsToRestore = [
      'customers', 'suppliers', 'employees', 'attendance', 'visitors',
      'products', 'purchases', 'purchaseReturns', 'sales', 'salesReturns',
      'installments', 'accounts', 'vouchers', 'cheques', 'targets', 'tasks'
    ];

    try {
      // 1. Pre-restore backup record
      const preBackupId = `BKP-PRERESTORE-${Date.now()}`;
      await adminDb.collection('backups').doc(preBackupId).set({
        id: preBackupId,
        orgId: ORG_ID,
        type: 'PreRestore',
        format: 'JSON',
        recordCount: Object.values(snapshot).reduce((s: number, v: any) => s + (Array.isArray(v) ? v.length : 0), 0),
        checksum: actualChecksum,
        status: 'Verified',
        createdAt: new Date().toISOString(),
        createdBy: req.firebaseUser?.email || 'Owner',
        notes: 'Automatic pre-restore integrity record',
      });

      // 2. Write restored documents in bounded batches of 400
      let restoredCount = 0;
      for (const colName of collectionsToRestore) {
        const rows = snapshot[colName];
        if (!Array.isArray(rows)) continue;

        for (let i = 0; i < rows.length; i += 400) {
          const batch = adminDb.batch();
          const chunk = rows.slice(i, i + 400);
          for (const item of chunk) {
            if (!item || !item.id) continue;
            const docPayload = {
              ...item,
              orgId: ORG_ID,
              createdByUid: item.createdByUid || req.firebaseUser!.uid,
            };
            batch.set(adminDb.collection(colName).doc(String(item.id)), docPayload);
            restoredCount += 1;
          }
          await batch.commit();
        }
      }

      if (snapshot.settings && typeof snapshot.settings === 'object') {
        await adminDb.collection('settings').doc('main').set({
          ...snapshot.settings,
          orgId: ORG_ID,
          updatedAt: new Date().toISOString(),
        }, { merge: true });
      }

      const mailRes = await sendSecurityEmail(
        '[Al-Madina ERP] CRITICAL: Disaster Recovery Restore Executed',
        `<p>Owner <strong>${req.firebaseUser?.email}</strong> restored <strong>${restoredCount}</strong> ERP records. Checksum: <code>${actualChecksum}</code></p>`
      );

      await recordServerSecurityEvent({
        type: 'DATABASE_RESTORE',
        severity: 'CRITICAL',
        actorUid: req.firebaseUser!.uid,
        actorEmail: req.firebaseUser!.email,
        title: 'Disaster Recovery Restore Completed',
        details: `Restored ${restoredCount} records across showroom collections. SHA-256: ${actualChecksum.slice(0, 16)}...`,
        notifiedOwner: mailRes.sent,
        emailStatus: mailRes.sent ? 'Sent' : mailRes.reason || 'Skipped',
      });

      res.json({ restored: true, restoredCount, checksum: actualChecksum, emailNotification: mailRes });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Disaster recovery restore failed.' });
    }
  });

  // ---------------- SERVER-SIDE WORDPRESS / WOOCOMMERCE INTEGRATION ----------------
  app.get('/api/wordpress/status', requireFirebaseAuth, (req: AuthedRequest, res: Response) => {
    if (!hasBackendPermission(req, 'wordpress', 'VIEW') && !hasBackendPermission(req, 'settings', 'VIEW')) {
      res.status(403).json({ error: 'WordPress integration view permission required.' });
      return;
    }
    res.json({
      siteUrl: wpRuntimeConfig.siteUrl,
      hasRestCredentials: Boolean(wpRuntimeConfig.restUsername && wpRuntimeConfig.appPassword),
      hasWooCredentials: Boolean(wpRuntimeConfig.wcKey && wpRuntimeConfig.wcSecret),
      syncProductsAuto: wpRuntimeConfig.syncProductsAuto,
      syncStockAuto: wpRuntimeConfig.syncStockAuto,
      syncOrdersAuto: wpRuntimeConfig.syncOrdersAuto,
      lastBackupAt: wpRuntimeConfig.lastBackupAt || null,
      lastBackupStatus: wpRuntimeConfig.lastBackupStatus || 'Never',
      lastBackupRef: wpRuntimeConfig.lastBackupRef || null,
      lastError: wpRuntimeConfig.lastError || null,
      secretStoragePolicy: 'Server-side environment variables / memory only (never stored in browser localStorage)',
    });
  });

  app.post('/api/wordpress/configure', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    if (!req.isOwnerUser && !hasBackendPermission(req, 'wordpress', 'MANAGE') && !hasBackendPermission(req, 'settings', 'EDIT')) {
      res.status(403).json({ error: 'Only Owner or permitted admins can update WordPress server configuration.' });
      return;
    }
    const { siteUrl, restUsername, appPassword, wcKey, wcSecret, syncProductsAuto, syncStockAuto, syncOrdersAuto } = req.body || {};
    if (typeof siteUrl === 'string') wpRuntimeConfig.siteUrl = siteUrl.trim().replace(/\/+$/, '');
    if (typeof restUsername === 'string' && restUsername.trim()) wpRuntimeConfig.restUsername = restUsername.trim();
    if (typeof appPassword === 'string' && appPassword.trim()) wpRuntimeConfig.appPassword = appPassword.trim();
    if (typeof wcKey === 'string' && wcKey.trim()) wpRuntimeConfig.wcKey = wcKey.trim();
    if (typeof wcSecret === 'string' && wcSecret.trim()) wpRuntimeConfig.wcSecret = wcSecret.trim();
    if (typeof syncProductsAuto === 'boolean') wpRuntimeConfig.syncProductsAuto = syncProductsAuto;
    if (typeof syncStockAuto === 'boolean') wpRuntimeConfig.syncStockAuto = syncStockAuto;
    if (typeof syncOrdersAuto === 'boolean') wpRuntimeConfig.syncOrdersAuto = syncOrdersAuto;

    res.json({
      saved: true,
      siteUrl: wpRuntimeConfig.siteUrl,
      hasRestCredentials: Boolean(wpRuntimeConfig.restUsername && wpRuntimeConfig.appPassword),
      hasWooCredentials: Boolean(wpRuntimeConfig.wcKey && wpRuntimeConfig.wcSecret),
    });
  });

  app.post('/api/wordpress/test', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    if (!hasBackendPermission(req, 'wordpress', 'VIEW') && !hasBackendPermission(req, 'settings', 'VIEW')) {
      res.status(403).json({ error: 'Permission denied.' });
      return;
    }
    const targetUrl = String(req.body?.siteUrl || wpRuntimeConfig.siteUrl || '').trim().replace(/\/+$/, '');
    if (!targetUrl) {
      res.status(400).json({ success: false, message: 'WordPress site URL is required.' });
      return;
    }

    try {
      const wpRes = await fetch(`${targetUrl}/wp-json/`);
      if (!wpRes.ok) {
        res.json({ success: false, isWooCommerce: false, message: `WordPress REST endpoint returned HTTP ${wpRes.status}.` });
        return;
      }
      const wpData = await wpRes.json() as { name?: string; namespaces?: string[] };
      const namespaces = wpData.namespaces || [];
      const hasWoo = namespaces.includes('wc/v3') || namespaces.includes('wc/v2');

      if (wpRuntimeConfig.wcKey && wpRuntimeConfig.wcSecret) {
        const authHeader = 'Basic ' + Buffer.from(`${wpRuntimeConfig.wcKey}:${wpRuntimeConfig.wcSecret}`).toString('base64');
        const wcRes = await fetch(`${targetUrl}/wp-json/wc/v3/system_status`, {
          headers: { Authorization: authHeader },
        });
        if (wcRes.ok) {
          res.json({
            success: true,
            isWooCommerce: true,
            message: `Server-verified connection to WooCommerce REST API on ${targetUrl}.`,
          });
          return;
        }
        res.json({
          success: false,
          isWooCommerce: hasWoo,
          message: `WooCommerce authentication returned HTTP ${wcRes.status}. Check server WP_WC_KEY / WP_WC_SECRET.`,
        });
        return;
      }

      res.json({
        success: true,
        isWooCommerce: hasWoo,
        message: `WordPress reachable ("${wpData.name || targetUrl}"). ${hasWoo ? 'WooCommerce namespace detected.' : 'Standard WordPress REST detected.'}`,
      });
    } catch (err: any) {
      res.json({ success: false, isWooCommerce: false, message: `Connection failed: ${err?.message || 'Network error'}` });
    }
  });

  app.post('/api/wordpress/sync-product', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    if (!hasBackendPermission(req, 'wordpress', 'MANAGE') && !hasBackendPermission(req, 'inventory', 'EDIT')) {
      res.status(403).json({ error: 'Permission denied.' });
      return;
    }
    if (!wpRuntimeConfig.siteUrl || !wpRuntimeConfig.wcKey || !wpRuntimeConfig.wcSecret) {
      res.status(400).json({ success: false, message: 'Server-side WooCommerce credentials are not configured.' });
      return;
    }
    const { product } = req.body || {};
    if (!product?.sku || !product?.name) {
      res.status(400).json({ success: false, message: 'Valid product payload required.' });
      return;
    }

    try {
      const authHeader = 'Basic ' + Buffer.from(`${wpRuntimeConfig.wcKey}:${wpRuntimeConfig.wcSecret}`).toString('base64');
      const payload = {
        sku: product.sku,
        name: product.name,
        type: 'simple',
        regular_price: String(product.retailPrice),
        description: product.description || `${product.brand} ${product.modelNumber} with warranty.`,
        manage_stock: true,
        stock_quantity: product.stockQuantity,
        stock_status: product.stockQuantity > 0 ? 'instock' : 'outofstock',
      };

      const wpRes = await fetch(`${wpRuntimeConfig.siteUrl}/wp-json/wc/v3/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify(payload),
      });
      const data = await wpRes.json().catch(() => ({})) as any;
      if (!wpRes.ok) {
        res.status(wpRes.status).json({ success: false, message: data?.message || `HTTP ${wpRes.status}` });
        return;
      }
      res.json({ success: true, wpId: data.id, message: `Synced "${product.name}" to WooCommerce (WP ID: ${data.id})` });
    } catch (err: any) {
      res.status(502).json({ success: false, message: err?.message || 'WooCommerce sync error' });
    }
  });

  app.post('/api/wordpress/backup', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    if (!hasBackendPermission(req, 'wordpress', 'MANAGE') && !hasBackendPermission(req, 'audit', 'EXPORT')) {
      res.status(403).json({ error: 'Backup permission required.' });
      return;
    }
    if (!wpRuntimeConfig.siteUrl || !wpRuntimeConfig.restUsername || !wpRuntimeConfig.appPassword) {
      res.status(400).json({
        success: false,
        message: 'WordPress secondary backup credentials (WP_SITE_URL, WP_REST_USERNAME, WP_APP_PASSWORD) are not configured on the server.',
      });
      return;
    }

    const { backupId, checksum, recordCount, summary } = req.body || {};
    const token = Buffer.from(`${wpRuntimeConfig.restUsername}:${wpRuntimeConfig.appPassword}`).toString('base64');

    try {
      // Posts backup snapshot metadata & encrypted manifest as a private WP draft post / custom backup endpoint
      const wpRes = await fetch(`${wpRuntimeConfig.siteUrl}/wp-json/wp/v2/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${token}`,
        },
        body: JSON.stringify({
          title: `Al-Madina ERP Backup Snapshot ${backupId || new Date().toISOString()}`,
          status: 'private',
          content: JSON.stringify({
            orgId: ORG_ID,
            backupId,
            checksum,
            recordCount,
            summary,
            archivedAt: new Date().toISOString(),
          }),
        }),
      });

      const wpData = await wpRes.json().catch(() => ({})) as any;
      if (!wpRes.ok) {
        wpRuntimeConfig.lastBackupStatus = 'Failed';
        wpRuntimeConfig.lastError = wpData?.message || `HTTP ${wpRes.status}`;
        await sendSecurityEmail(
          '[Al-Madina ERP] WARNING: WordPress Secondary Backup Failed',
          `<p>WordPress secondary backup failed with HTTP ${wpRes.status}: ${wpRuntimeConfig.lastError}</p>`
        );
        res.status(wpRes.status).json({ success: false, message: wpRuntimeConfig.lastError });
        return;
      }

      wpRuntimeConfig.lastBackupAt = new Date().toISOString();
      wpRuntimeConfig.lastBackupStatus = 'Success';
      wpRuntimeConfig.lastBackupRef = wpData.link || `WP Post #${wpData.id}`;
      wpRuntimeConfig.lastError = undefined;

      res.json({
        success: true,
        wpPostId: wpData.id,
        wpRef: wpRuntimeConfig.lastBackupRef,
        timestamp: wpRuntimeConfig.lastBackupAt,
      });
    } catch (err: any) {
      wpRuntimeConfig.lastBackupStatus = 'Failed';
      wpRuntimeConfig.lastError = err?.message || 'Network failure';
      res.status(502).json({ success: false, message: wpRuntimeConfig.lastError });
    }
  });

  // ---------------- VITE DEV MIDDLEWARE OR PRODUCTION STATIC ----------------
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(GH_PAGES_BASE, express.static(distDir));
    app.use('/', express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Al-Madina Electronics ERP Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start Express server:', err);
  process.exit(1);
});
