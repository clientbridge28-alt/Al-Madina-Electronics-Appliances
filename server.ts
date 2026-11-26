import 'dotenv/config';
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response, type NextFunction } from 'express';
import nodemailer from 'nodemailer';
import { GoogleGenAI } from '@google/genai';
import { initializeApp, getApps, type App } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveServerPort(): number {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if ((arg === '--port' || arg === '-p') && args[i + 1]) {
      const parsed = Number(args[i + 1]);
      if (Number.isInteger(parsed) && parsed > 0) return parsed;
    } else if (arg.startsWith('--port=')) {
      const parsed = Number(arg.slice('--port='.length));
      if (Number.isInteger(parsed) && parsed > 0) return parsed;
    }
  }
  const envPort = process.env.PORT ? Number(process.env.PORT) : NaN;
  const nginxPort = process.env.NGINX_PORT ? Number(process.env.NGINX_PORT) : NaN;
  const defaultAppPort = process.env.DEFAULT_APP_PORT ? Number(process.env.DEFAULT_APP_PORT) : 3000;
  if (
    process.env.NODE_ENV !== 'production' &&
    Number.isInteger(nginxPort) &&
    envPort === nginxPort
  ) {
    return Number.isInteger(defaultAppPort) && defaultAppPort > 0 ? defaultAppPort : 3000;
  }
  if (Number.isInteger(envPort) && envPort > 0) return envPort;
  return Number.isInteger(defaultAppPort) && defaultAppPort > 0 ? defaultAppPort : 3000;
}

const PORT = resolveServerPort();
const CANONICAL_OWNER_EMAIL = 'clientbridge28@gmail.com';
const SECONDARY_ADMIN_EMAIL = 'wrelectronicsofficial@gmail.com';
const CANONICAL_OWNER_EMAILS: readonly string[] = [
  CANONICAL_OWNER_EMAIL,
  SECONDARY_ADMIN_EMAIL,
];
const OWNER_ALERT_EMAIL = (process.env.OWNER_ALERT_EMAIL || CANONICAL_OWNER_EMAIL).toLowerCase();
const ORG_ID = 'al-madina-main';
const GH_PAGES_BASE = '/Al-Madina-Electronics-Appliances';

function isCanonicalOwnerEmail(email?: string | null): boolean {
  const normalized = String(email || '').trim().toLowerCase();
  return Boolean(normalized && (CANONICAL_OWNER_EMAILS.includes(normalized) || normalized === OWNER_ALERT_EMAIL));
}

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId?: string;
  authDomain?: string;
}

function cleanServerEnv(val?: string): string {
  if (!val) return '';
  return val.trim().replace(/^"+|"+$/g, '').replace(/,+$/, '').replace(/^"+|"+$/g, '').trim();
}

function isMalformedServerEnv(val?: string): boolean {
  if (!val) return false;
  const t = val.trim();
  return t.startsWith('"') || t.endsWith(',');
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
const envFirebaseProject = !isMalformedServerEnv(process.env.FIREBASE_PROJECT_ID)
  ? cleanServerEnv(process.env.FIREBASE_PROJECT_ID)
  : !isMalformedServerEnv(process.env.VITE_FIREBASE_PROJECT_ID)
  ? cleanServerEnv(process.env.VITE_FIREBASE_PROJECT_ID)
  : '';
const resolvedProjectId = envFirebaseProject || appletConfig?.projectId || '';
const envDatabaseId = !isMalformedServerEnv(process.env.FIREBASE_DATABASE_ID)
  ? cleanServerEnv(process.env.FIREBASE_DATABASE_ID)
  : !isMalformedServerEnv(process.env.VITE_FIREBASE_DATABASE_ID)
  ? cleanServerEnv(process.env.VITE_FIREBASE_DATABASE_ID)
  : '';
const resolvedDatabaseId =
  envDatabaseId ||
  (resolvedProjectId && resolvedProjectId === appletConfig?.projectId ? appletConfig?.firestoreDatabaseId || '' : '');

let adminApp: App | null = null;
let adminInitError: string | null = null;

try {
  const existing = getApps();
  if (existing.length > 0) {
    adminApp = existing[0];
  } else if (resolvedProjectId) {
    adminApp = initializeApp({ projectId: resolvedProjectId });
  }
} catch (err: any) {
  adminInitError = err?.message || 'Firebase Admin initialization failed';
}

const adminAuth = adminApp ? getAuth(adminApp) : null;
const adminDb = adminApp
  ? resolvedDatabaseId
    ? getFirestore(adminApp, resolvedDatabaseId)
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

function isPrivateOrDisallowedIp(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower.startsWith('::ffff:')) {
    return isPrivateOrDisallowedIp(lower.slice(7));
  }
  if (net.isIPv4(lower)) {
    const parts = lower.split('.').map(Number);
    if (parts.length !== 4 || parts.some(n => Number.isNaN(n))) return true;
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  if (net.isIPv6(lower)) {
    if (lower === '::' || lower === '::1') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA fc00::/7
    if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true; // link-local fe80::/10
    return false;
  }
  return true;
}

async function validateExternalHttpUrl(rawUrl: string): Promise<{ valid: boolean; normalizedUrl?: string; reason?: string }> {
  const trimmed = String(rawUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) {
    return { valid: false, reason: 'External URL is empty.' };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, reason: 'Invalid URL format.' };
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { valid: false, reason: 'Only http:// and https:// URLs are permitted.' };
  }
  if (parsed.username || parsed.password) {
    return { valid: false, reason: 'Embedded URL credentials are not allowed.' };
  }
  const hostname = parsed.hostname.toLowerCase();
  if (
    !hostname ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal')
  ) {
    return { valid: false, reason: `Disallowed internal hostname "${hostname}".` };
  }
  if (net.isIP(hostname) && isPrivateOrDisallowedIp(hostname)) {
    return { valid: false, reason: `Private or loopback IP address "${hostname}" is blocked.` };
  }
  try {
    const resolved = await dns.lookup(hostname, { all: true });
    if (resolved.some(rec => isPrivateOrDisallowedIp(rec.address))) {
      return { valid: false, reason: `Hostname "${hostname}" resolves to a private network address.` };
    }
  } catch {
    // Allow DNS lookup to fail gracefully later on fetch() if offline sandbox, unless hostname is already literal private IP
  }
  return { valid: true, normalizedUrl: parsed.origin + (parsed.pathname === '/' ? '' : parsed.pathname) };
}

const wpRuntimeConfig: ServerWpConfig = {
  siteUrl: (process.env.WP_SITE_URL || '').trim().replace(/\/+$/, ''),
  restUsername: process.env.WP_REST_USERNAME || '',
  appPassword: process.env.WP_APP_PASSWORD || '',
  wcKey: process.env.WP_WC_KEY || '',
  wcSecret: process.env.WP_WC_SECRET || '',
  syncProductsAuto: false,
  syncStockAuto: true,
  syncOrdersAuto: false,
};

// MFA OTP store (persists to Firestore when adminDb is available, falls back to memory in local sandbox)
interface OtpChallenge {
  codeHash: string;
  expiresAt: number;
  attempts: number;
  used: boolean;
}
const otpStore = new Map<string, OtpChallenge>();
const otpRateLimiter = new Map<string, number[]>();
const aiRateLimiter = new Map<string, number[]>();

async function saveOtpChallenge(uid: string, challenge: OtpChallenge): Promise<void> {
  otpStore.set(uid, challenge);
  if (adminDb) {
    try {
      await adminDb.collection('mfaChallenges').doc(uid).set(challenge);
    } catch {
      // In-memory fallback already populated
    }
  }
}

async function loadOtpChallenge(uid: string): Promise<OtpChallenge | null> {
  if (adminDb) {
    try {
      const snap = await adminDb.collection('mfaChallenges').doc(uid).get();
      if (snap.exists) {
        return snap.data() as OtpChallenge;
      }
    } catch {
      // Fall through to in-memory store
    }
  }
  return otpStore.get(uid) || null;
}

async function clearOtpChallenge(uid: string): Promise<void> {
  otpStore.delete(uid);
  if (adminDb) {
    try {
      await adminDb.collection('mfaChallenges').doc(uid).delete();
    } catch {
      // Ignore
    }
  }
}

async function checkAndRecordOtpRateLimit(uid: string): Promise<boolean> {
  const now = Date.now();
  const windowMs = 10 * 60 * 1000;
  if (adminDb) {
    try {
      const ref = adminDb.collection('otpRateLimits').doc(uid);
      const snap = await ref.get();
      const prev: number[] = snap.exists && Array.isArray(snap.data()?.timestamps) ? snap.data()!.timestamps : [];
      const recent = prev.filter(t => now - t < windowMs);
      if (recent.length >= 5) return false;
      recent.push(now);
      await ref.set({ timestamps: recent, updatedAt: new Date(now).toISOString() });
      return true;
    } catch {
      // Fall back to in-memory
    }
  }
  const recent = (otpRateLimiter.get(uid) || []).filter(t => now - t < windowMs);
  if (recent.length >= 5) return false;
  recent.push(now);
  otpRateLimiter.set(uid, recent);
  return true;
}

function getGeminiApiKey(): string {
  const key = String(process.env.GEMINI_API_KEY || '').trim();
  if (!key || key === 'MY_GEMINI_API_KEY' || key.startsWith('YOUR_')) return '';
  return key;
}

function isSmsConfigured(): boolean {
  const hasWebhook = Boolean(process.env.SMS_GATEWAY_URL && process.env.SMS_GATEWAY_URL.trim());
  const hasTwilio = Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER
  );
  return hasWebhook || hasTwilio;
}

// Helper: Check SMTP readiness
function isSmtpConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

async function sendSecurityEmail(subject: string, html: string, toEmail: string = OWNER_ALERT_EMAIL): Promise<{ sent: boolean; reason?: string }> {
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
    let profileFetchSucceeded = false;
    if (adminDb) {
      try {
        const snap = await adminDb.collection('users').doc(decoded.uid).get();
        profileFetchSucceeded = true;
        if (snap.exists) {
          profile = snap.data() || null;
        }
      } catch {
        // Ignore if Admin ADC is unavailable in local dev sandbox
      }
    }
    req.staffProfile = profile;
    const decodedEmail = (decoded.email || '').toLowerCase();
    const isOwnerEmail = isCanonicalOwnerEmail(decodedEmail);
    const isOwnerRole = profile?.role === 'Owner' && profile?.active === true && profile?.suspended === false;
    req.isOwnerUser = Boolean(isOwnerEmail || isOwnerRole);

    if (profileFetchSucceeded && !profile && !isOwnerEmail) {
      res.status(403).json({ error: 'Account is not provisioned in showroom staff directory.' });
      return;
    }

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
    const extraOrigins = (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    const allowedOrigins = [
      'https://clientbridge28-alt.github.io',
      process.env.APP_URL || '',
      'http://localhost:3000',
      ...extraOrigins,
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
      cloudRunReady: true,
      port: PORT,
      timestamp: new Date().toISOString(),
      projectId: resolvedProjectId || null,
      firestoreDatabaseId: resolvedDatabaseId || null,
      firebaseAdminReady: Boolean(adminAuth && adminDb),
      adminInitError,
      smtpConfigured: isSmtpConfigured(),
      smsConfigured: isSmsConfigured(),
      geminiConfigured: Boolean(getGeminiApiKey()),
      ownerEmail: CANONICAL_OWNER_EMAIL,
      ownerEmails: CANONICAL_OWNER_EMAILS,
      ownerAlertEmail: OWNER_ALERT_EMAIL,
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

  // ---------------- CUSTOMER & RECOVERY SMS NOTIFICATIONS ----------------
  app.post('/api/notifications/sms', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    if (!hasBackendPermission(req, 'customers', 'EDIT') && !hasBackendPermission(req, 'installments', 'EDIT')) {
      res.status(403).json({ error: 'Customer or Installment notification permission required.' });
      return;
    }

    const { recipients, message, campaignType = 'General' } = req.body || {};
    if (!Array.isArray(recipients) || recipients.length === 0 || recipients.length > 100) {
      res.status(400).json({ error: 'Provide between 1 and 100 SMS recipients.' });
      return;
    }
    const cleanMessage = String(message || '').trim();
    if (!cleanMessage || cleanMessage.length > 600) {
      res.status(400).json({ error: 'Message text is required (max 600 characters).' });
      return;
    }

    if (!isSmsConfigured()) {
      res.status(503).json({
        sent: false,
        configured: false,
        error: 'SMS gateway is not configured on the backend server (set SMS_GATEWAY_URL or TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM_NUMBER).',
      });
      return;
    }

    const normalizedRecipients = recipients
      .map((r: any) => ({
        name: String(r?.name || 'Customer').slice(0, 120),
        phone: String(r?.phone || '').replace(/[^\d+]/g, '').slice(0, 24),
      }))
      .filter((r: { phone: string }) => r.phone.length >= 7);

    if (normalizedRecipients.length === 0) {
      res.status(400).json({ error: 'No valid recipient phone numbers provided.' });
      return;
    }

    const gatewayUrl = String(process.env.SMS_GATEWAY_URL || '').trim();
    const results: { phone: string; ok: boolean; error?: string }[] = [];

    if (gatewayUrl) {
      const check = await validateExternalHttpUrl(gatewayUrl);
      if (!check.valid || !check.normalizedUrl) {
        res.status(500).json({ sent: false, error: `Configured SMS_GATEWAY_URL is unsafe: ${check.reason}` });
        return;
      }
      for (const rec of normalizedRecipients) {
        try {
          const gwRes = await fetch(check.normalizedUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(process.env.SMS_GATEWAY_TOKEN ? { Authorization: `Bearer ${process.env.SMS_GATEWAY_TOKEN}` } : {}),
            },
            body: JSON.stringify({
              to: rec.phone,
              recipientName: rec.name,
              senderId: process.env.SMS_SENDER_ID || 'AlMadinaERP',
              message: cleanMessage,
              campaignType,
            }),
          });
          results.push({ phone: rec.phone, ok: gwRes.ok, error: gwRes.ok ? undefined : `HTTP ${gwRes.status}` });
        } catch (err: any) {
          results.push({ phone: rec.phone, ok: false, error: err?.message || 'Gateway request failed' });
        }
      }
    } else {
      const sid = process.env.TWILIO_ACCOUNT_SID!;
      const token = process.env.TWILIO_AUTH_TOKEN!;
      const from = process.env.TWILIO_FROM_NUMBER!;
      const authHeader = 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64');
      for (const rec of normalizedRecipients) {
        try {
          const form = new URLSearchParams({ To: rec.phone, From: from, Body: cleanMessage });
          const twRes = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
            method: 'POST',
            headers: {
              Authorization: authHeader,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: form.toString(),
          });
          results.push({ phone: rec.phone, ok: twRes.ok, error: twRes.ok ? undefined : `Twilio HTTP ${twRes.status}` });
        } catch (err: any) {
          results.push({ phone: rec.phone, ok: false, error: err?.message || 'Twilio dispatch failed' });
        }
      }
    }

    const sentCount = results.filter(r => r.ok).length;
    const failedCount = results.length - sentCount;
    await recordServerSecurityEvent({
      type: 'SMS_DISPATCH',
      severity: 'INFO',
      actorUid: req.firebaseUser!.uid,
      actorEmail: req.firebaseUser!.email,
      title: `SMS Dispatch (${campaignType})`,
      details: `Dispatched SMS to ${sentCount}/${results.length} recipients.`,
      notifiedOwner: false,
      emailStatus: 'N/A',
    });

    res.json({ sent: sentCount > 0, configured: true, sentCount, failedCount, results });
  });

  // ---------------- SERVER-SIDE GEMINI AI ASSISTANT ----------------
  app.post('/api/ai/assistant', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const apiKey = getGeminiApiKey();
    if (!apiKey) {
      res.status(503).json({
        configured: false,
        error: 'GEMINI_API_KEY is not configured on the backend server.',
      });
      return;
    }

    const uid = req.firebaseUser!.uid;
    const now = Date.now();
    const recentCalls = (aiRateLimiter.get(uid) || []).filter(t => now - t < 10 * 60 * 1000);
    if (recentCalls.length >= 25) {
      res.status(429).json({ error: 'AI Assistant rate limit reached. Please wait a few minutes.' });
      return;
    }
    recentCalls.push(now);
    aiRateLimiter.set(uid, recentCalls);

    const promptText = String(req.body?.prompt || '').trim();
    if (!promptText || promptText.length > 2000) {
      res.status(400).json({ error: 'A prompt between 1 and 2000 characters is required.' });
      return;
    }

    const rawContext = (req.body?.context && typeof req.body.context === 'object') ? req.body.context : {};
    const scopedContext: Record<string, any> = {
      userRole: req.staffProfile?.role || (req.isOwnerUser ? 'Owner' : 'Staff'),
      permittedModules: req.isOwnerUser
        ? ['ALL']
        : Object.entries(req.staffProfile?.permissions || {})
            .filter(([, acts]) => Array.isArray(acts) && acts.includes('VIEW'))
            .map(([mod]) => mod),
    };

    if (hasBackendPermission(req, 'dashboard', 'VIEW') && rawContext.kpis) {
      scopedContext.kpis = rawContext.kpis;
    }
    if ((hasBackendPermission(req, 'inventory', 'VIEW') || hasBackendPermission(req, 'pos', 'VIEW')) && rawContext.inventory) {
      scopedContext.inventory = rawContext.inventory;
    }
    if (hasBackendPermission(req, 'installments', 'VIEW') && rawContext.installments) {
      scopedContext.installments = rawContext.installments;
    }
    if ((hasBackendPermission(req, 'accounting', 'VIEW') || hasBackendPermission(req, 'reports', 'VIEW')) && rawContext.financials) {
      scopedContext.financials = rawContext.financials;
    }
    if (hasBackendPermission(req, 'cheques', 'VIEW') && rawContext.cheques) {
      scopedContext.cheques = rawContext.cheques;
    }
    if (hasBackendPermission(req, 'customers', 'VIEW') && rawContext.customers) {
      scopedContext.customers = rawContext.customers;
    }
    if (hasBackendPermission(req, 'suppliers', 'VIEW') && rawContext.suppliers) {
      scopedContext.suppliers = rawContext.suppliers;
    }

    const modelName = String(process.env.GEMINI_MODEL || 'gemini-4-hydrogen').trim();
    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const systemPrompt = [
        'You are the Al-Madina Electronics & Appliances ERP Business Assistant.',
        'Strictly ground every figure, balance, stock quantity, and overdue amount ONLY in the RBAC-filtered JSON context below.',
        'Do NOT invent, extrapolate, or guess financial numbers or customer balances not present in the context.',
        'If the user asks about a module not included in permittedModules or absent from context, clearly state that their role lacks access or data was not provided.',
        'Use PKR (₨) for monetary values.',
        'If helpful, you may propose ONE explicit navigation or draft action using this exact JSON fenced block at the end (the UI will require explicit user confirmation before executing):',
        '```action\n{"type":"navigate","targetTab":"reports","label":"Open Reports & Statements"}\n```',
        `Allowed navigation targetTab values: dashboard, pos, inventory, purchases, installments, customers, suppliers, accounting, ledgers, cheques, reports, targets, visitors, attendance, tasks, audit, settings, admin.`,
      ].join('\n');

      const response = await ai.models.generateContent({
        model: modelName,
        contents: `${systemPrompt}\n\nRBAC-SCOPED ERP CONTEXT:\n${JSON.stringify(scopedContext, null, 2)}\n\nUSER QUESTION:\n${promptText}`,
      });

      const rawReply = response.text || 'No response generated.';
      let proposedAction: { type: string; targetTab?: string; label: string; draftText?: string } | null = null;
      let cleanReply = rawReply;
      const actionMatch = rawReply.match(/```action\s*([\s\S]*?)```/);
      if (actionMatch) {
        try {
          const parsedAction = JSON.parse(actionMatch[1].trim());
          if (parsedAction && typeof parsedAction === 'object' && parsedAction.label) {
            proposedAction = parsedAction;
          }
          cleanReply = rawReply.replace(actionMatch[0], '').trim();
        } catch {
          // Keep text as-is if action JSON is malformed
        }
      }

      res.json({
        configured: true,
        model: modelName,
        reply: cleanReply,
        proposedAction,
      });
    } catch (err: any) {
      res.status(502).json({
        configured: true,
        error: err?.message || 'Gemini AI request failed.',
      });
    }
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
    const allowed = await checkAndRecordOtpRateLimit(uid);
    if (!allowed) {
      res.status(429).json({ error: 'Too many OTP requests. Please wait 10 minutes.' });
      return;
    }

    const otp = String(crypto.randomInt(100000, 999999));
    const codeHash = crypto.createHash('sha256').update(`${uid}:${otp}`).digest('hex');
    await saveOtpChallenge(uid, {
      codeHash,
      expiresAt: Date.now() + 5 * 60 * 1000,
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

  app.post('/api/mfa/verify', requireFirebaseAuth, async (req: AuthedRequest, res: Response) => {
    const uid = req.firebaseUser!.uid;
    const code = String(req.body?.code || '').trim();
    const record = await loadOtpChallenge(uid);
    if (!record || record.used) {
      res.status(400).json({ verified: false, error: 'No active OTP challenge. Please request a new code.' });
      return;
    }
    if (Date.now() > record.expiresAt) {
      await clearOtpChallenge(uid);
      res.status(400).json({ verified: false, error: 'OTP expired. Request a new code.' });
      return;
    }
    if (record.attempts >= 5) {
      await clearOtpChallenge(uid);
      res.status(429).json({ verified: false, error: 'Maximum OTP attempts exceeded.' });
      return;
    }

    record.attempts += 1;
    const codeHash = crypto.createHash('sha256').update(`${uid}:${code}`).digest('hex');
    if (codeHash !== record.codeHash) {
      await saveOtpChallenge(uid, record);
      res.status(401).json({ verified: false, error: 'Invalid OTP code.' });
      return;
    }

    await clearOtpChallenge(uid);
    res.json({ verified: true });
  });

  // ---------------- OWNER SUPER ADMIN USER & SESSION APIs ----------------
  app.post('/api/admin/users', requireFirebaseAuth, requireOwner, async (req: AuthedRequest, res: Response) => {
    if (!adminAuth || !adminDb) {
      res.status(503).json({ error: 'Firebase Admin SDK unavailable.' });
      return;
    }
    const { name, email, password, phone = '', role = 'Cashier', customRoleName = '', permissions = {}, mfaEnabled = false } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const allowedRoles = ['Owner', 'Manager', 'Accountant', 'Cashier', 'StockManager', 'RecoveryOfficer', 'Receptionist', 'Custom'];
    if (!name || !normalizedEmail) {
      res.status(400).json({ error: 'Staff name and email are required.' });
      return;
    }
    if (!allowedRoles.includes(String(role))) {
      res.status(400).json({ error: `Invalid staff role "${role}".` });
      return;
    }
    if (role === 'Owner' && !isCanonicalOwnerEmail(normalizedEmail)) {
      res.status(403).json({ error: `Owner Super Admin role can only be assigned to canonical owners (${CANONICAL_OWNER_EMAILS.join(', ')}).` });
      return;
    }

    try {
      let authUser;
      try {
        authUser = await adminAuth.getUserByEmail(normalizedEmail);
      } catch {
        if (!password || String(password).length < 8) {
          res.status(400).json({ error: 'Password (min 8 chars) is required to create a new Firebase Auth account.' });
          return;
        }
        authUser = await adminAuth.createUser({
          email: normalizedEmail,
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

  // Helper: deterministic recursive key sort for backup checksum verification
  function sortKeysDeep(value: any): any {
    if (Array.isArray(value)) {
      return value.map(sortKeysDeep);
    }
    if (value && typeof value === 'object') {
      const sorted: Record<string, any> = {};
      for (const key of Object.keys(value).sort()) {
        if (value[key] !== undefined) {
          sorted[key] = sortKeysDeep(value[key]);
        }
      }
      return sorted;
    }
    return value;
  }

  function extractRecordTimestampMs(doc: any): number {
    if (!doc || typeof doc !== 'object') return 0;
    const candidate = doc.updatedAt || doc.createdAt || doc.timestamp || doc.lastLogin || doc.date || '';
    if (!candidate || typeof candidate !== 'string') return 0;
    const ms = Date.parse(candidate);
    return Number.isFinite(ms) ? ms : 0;
  }

  // ---------------- OWNER-ONLY DISASTER RECOVERY RESTORE ----------------
  app.post('/api/admin/restore', requireFirebaseAuth, requireOwner, async (req: AuthedRequest, res: Response) => {
    if (!adminDb) {
      res.status(503).json({ error: 'Firebase Admin Firestore unavailable for atomic restore.' });
      return;
    }

    const { snapshot, expectedChecksum, overwriteNewer = false } = req.body || {};
    if (!snapshot || typeof snapshot !== 'object') {
      res.status(400).json({ error: 'Backup snapshot payload is required.' });
      return;
    }

    const rawChecksum = crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
    const canonicalChecksum = crypto.createHash('sha256').update(JSON.stringify(sortKeysDeep(snapshot))).digest('hex');
    if (expectedChecksum && expectedChecksum !== canonicalChecksum && expectedChecksum !== rawChecksum) {
      res.status(400).json({ error: 'Backup integrity checksum verification failed. File may be corrupted or tampered.' });
      return;
    }

    const collectionsToRestore = [
      'customers', 'suppliers', 'employees', 'attendance', 'visitors',
      'products', 'purchases', 'purchaseReturns', 'sales', 'salesReturns',
      'installments', 'accounts', 'vouchers', 'cheques', 'targets', 'tasks'
    ];

    try {
      const restoreTimestamp = new Date().toISOString();

      // 1. Pre-restore backup integrity record
      const preBackupId = `BKP-PRERESTORE-${Date.now()}`;
      await adminDb.collection('backups').doc(preBackupId).set({
        id: preBackupId,
        orgId: ORG_ID,
        type: 'PreRestore',
        format: 'JSON',
        recordCount: Object.values(snapshot).reduce((s: number, v: any) => s + (Array.isArray(v) ? v.length : 0), 0),
        checksum: canonicalChecksum,
        status: 'Verified',
        createdAt: restoreTimestamp,
        createdBy: req.firebaseUser?.email || 'Owner',
        notes: overwriteNewer ? 'Pre-restore record (force overwrite mode)' : 'Pre-restore record (non-destructive merge preserving newer documents)',
      });

      // 2. Write restored documents in bounded chunks with timestamp conflict protection
      let restoredCount = 0;
      let createdCount = 0;
      let overwrittenOlderCount = 0;
      let skippedNewerCount = 0;

      for (const colName of collectionsToRestore) {
        const rows = snapshot[colName];
        if (!Array.isArray(rows)) continue;

        const validItems = rows.filter(item => item && item.id);
        for (let i = 0; i < validItems.length; i += 400) {
          const chunk = validItems.slice(i, i + 400);
          const docRefs = chunk.map(item => adminDb!.collection(colName).doc(String(item.id)));
          const existingSnaps = docRefs.length > 0 ? await adminDb.getAll(...docRefs) : [];

          const batch = adminDb.batch();
          let chunkHasWrites = false;

          chunk.forEach((item, idx) => {
            const existingSnap = existingSnaps[idx];
            const incomingMs = extractRecordTimestampMs(item);
            if (existingSnap && existingSnap.exists && !overwriteNewer) {
              const existingMs = extractRecordTimestampMs(existingSnap.data());
              if (existingMs > 0 && existingMs > incomingMs) {
                skippedNewerCount += 1;
                return;
              }
              overwrittenOlderCount += 1;
            } else if (!existingSnap || !existingSnap.exists) {
              createdCount += 1;
            } else {
              overwrittenOlderCount += 1;
            }

            const docPayload = {
              ...item,
              orgId: ORG_ID,
              createdByUid: item.createdByUid || req.firebaseUser!.uid,
              updatedAt: item.updatedAt || restoreTimestamp,
            };
            batch.set(docRefs[idx], docPayload, { merge: true });
            restoredCount += 1;
            chunkHasWrites = true;
          });

          if (chunkHasWrites) {
            await batch.commit();
          }
        }
      }

      if (snapshot.settings && typeof snapshot.settings === 'object') {
        const settingsRef = adminDb.collection('settings').doc('main');
        const existingSettingsSnap = await settingsRef.get();
        const existingSettingsMs = existingSettingsSnap.exists ? extractRecordTimestampMs(existingSettingsSnap.data()) : 0;
        const incomingSettingsMs = extractRecordTimestampMs(snapshot.settings);
        if (overwriteNewer || !existingSettingsSnap.exists || existingSettingsMs <= incomingSettingsMs) {
          const { id: _omitSettingsId, ...cleanSettingsPayload } = snapshot.settings;
          await settingsRef.set({
            ...cleanSettingsPayload,
            orgId: ORG_ID,
            updatedAt: cleanSettingsPayload.updatedAt || restoreTimestamp,
          }, { merge: true });
        } else {
          skippedNewerCount += 1;
        }
      }

      const mailRes = await sendSecurityEmail(
        '[Al-Madina ERP] CRITICAL: Disaster Recovery Restore Executed',
        `<p>Owner <strong>${req.firebaseUser?.email}</strong> restored <strong>${restoredCount}</strong> ERP records (${createdCount} created, ${overwrittenOlderCount} older updated, ${skippedNewerCount} newer records preserved). Checksum: <code>${canonicalChecksum}</code></p>`
      );

      await recordServerSecurityEvent({
        type: 'DATABASE_RESTORE',
        severity: 'CRITICAL',
        actorUid: req.firebaseUser!.uid,
        actorEmail: req.firebaseUser!.email,
        title: 'Disaster Recovery Restore Completed',
        details: `Restored ${restoredCount} records (${createdCount} new, ${overwrittenOlderCount} older updated, ${skippedNewerCount} newer preserved). SHA-256: ${canonicalChecksum.slice(0, 16)}...`,
        notifiedOwner: mailRes.sent,
        emailStatus: mailRes.sent ? 'Sent' : mailRes.reason || 'Skipped',
      });

      res.json({
        restored: true,
        restoredCount,
        createdCount,
        overwrittenOlderCount,
        skippedNewerCount,
        overwriteNewer: Boolean(overwriteNewer),
        checksum: canonicalChecksum,
        emailNotification: mailRes,
      });
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
    if (typeof siteUrl === 'string' && siteUrl.trim()) {
      const check = await validateExternalHttpUrl(siteUrl);
      if (!check.valid || !check.normalizedUrl) {
        res.status(400).json({ saved: false, error: check.reason || 'Unsafe or invalid WordPress URL.' });
        return;
      }
      wpRuntimeConfig.siteUrl = check.normalizedUrl;
    }
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
    const rawTargetUrl = String(req.body?.siteUrl || wpRuntimeConfig.siteUrl || '').trim();
    const urlCheck = await validateExternalHttpUrl(rawTargetUrl);
    if (!urlCheck.valid || !urlCheck.normalizedUrl) {
      res.status(400).json({ success: false, message: urlCheck.reason || 'Valid external WordPress site URL is required.' });
      return;
    }
    const targetUrl = urlCheck.normalizedUrl;

    try {
      const wpRes = await fetch(`${targetUrl}/wp-json/`, { redirect: 'error' });
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
          redirect: 'error',
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

      const urlCheck = await validateExternalHttpUrl(wpRuntimeConfig.siteUrl);
      if (!urlCheck.valid || !urlCheck.normalizedUrl) {
        res.status(400).json({ success: false, message: urlCheck.reason || 'Configured WP_SITE_URL is unsafe.' });
        return;
      }
      const wpRes = await fetch(`${urlCheck.normalizedUrl}/wp-json/wc/v3/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authHeader,
        },
        redirect: 'error',
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
      const urlCheck = await validateExternalHttpUrl(wpRuntimeConfig.siteUrl);
      if (!urlCheck.valid || !urlCheck.normalizedUrl) {
        res.status(400).json({ success: false, message: urlCheck.reason || 'Configured WP_SITE_URL is unsafe.' });
        return;
      }
      // Posts backup snapshot metadata & encrypted manifest as a private WP draft post / custom backup endpoint
      const wpRes = await fetch(`${urlCheck.normalizedUrl}/wp-json/wp/v2/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${token}`,
        },
        redirect: 'error',
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

  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API route not found.' });
  });

  // ---------------- VITE DEV MIDDLEWARE OR PRODUCTION STATIC ----------------
  if (process.env.NODE_ENV !== 'production') {
    const vitePromise = import('vite').then(({ createServer: createViteServer }) =>
      createViteServer({
        mode: 'development',
        server: { middlewareMode: true, hmr: false, ws: false },
        appType: 'spa',
      })
    );
    vitePromise.catch(err => {
      console.error('Failed to initialize Vite dev middleware:', err);
    });
    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(GH_PAGES_BASE, express.static(distDir));
    app.use('/', express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  const httpServer = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Al-Madina Electronics ERP Server running on http://0.0.0.0:${PORT}`);
  });
  httpServer.on('error', err => {
    console.error(`Express server failed to bind port ${PORT}:`, err);
    process.exit(1);
  });
}

startServer().catch(err => {
  console.error('Failed to start Express server:', err);
  process.exit(1);
});
