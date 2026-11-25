import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXPECTED_PROJECT_ID = 'al-madina-electronics';

export const REQUIRED_FIREBASE_KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];

const MASKED_SECRET_KEYS = new Set([
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]);

export function normalizeFirebaseEnvValue(raw) {
  if (typeof raw !== 'string') {
    return { normalized: '', modified: false, reasons: [] };
  }

  let val = raw.trim();
  const reasons = [];
  if (val !== raw) {
    reasons.push('trimmed outer whitespace');
  }

  if (val.endsWith(',')) {
    val = val.replace(/,+$/, '').trim();
    reasons.push('removed trailing comma');
  }

  let strippedQuotes = false;
  while (
    (val.startsWith('"') && val.endsWith('"') && val.length >= 2) ||
    (val.startsWith("'") && val.endsWith("'") && val.length >= 2)
  ) {
    val = val.slice(1, -1).trim();
    strippedQuotes = true;
  }
  if (strippedQuotes) {
    reasons.push('removed surrounding quotes');
  }

  return {
    normalized: val,
    modified: val !== raw,
    reasons,
  };
}

export function validateNormalizedFirebaseField(key, val) {
  if (!val) {
    return 'missing or empty';
  }
  if (/^YOUR_FIREBASE_|remixed-project-id|^replace[-_]?me$|^placeholder$/i.test(val)) {
    return 'placeholder value is not allowed';
  }
  if (/["',`\r\n\s]/.test(val)) {
    return 'contains invalid quotes, commas, or whitespace';
  }

  switch (key) {
    case 'VITE_FIREBASE_API_KEY':
      if (!/^[A-Za-z0-9_-]{20,}$/.test(val)) {
        return 'invalid Firebase Web API key format';
      }
      break;
    case 'VITE_FIREBASE_PROJECT_ID':
      if (val !== EXPECTED_PROJECT_ID) {
        return `project ID mismatch (expected ${EXPECTED_PROJECT_ID})`;
      }
      break;
    case 'VITE_FIREBASE_AUTH_DOMAIN':
      if (!new RegExp(`^${EXPECTED_PROJECT_ID}\\.(firebaseapp\\.com|web\\.app)$`).test(val)) {
        return `invalid authDomain for ${EXPECTED_PROJECT_ID} (expected ${EXPECTED_PROJECT_ID}.firebaseapp.com)`;
      }
      break;
    case 'VITE_FIREBASE_STORAGE_BUCKET':
      if (!new RegExp(`^${EXPECTED_PROJECT_ID}\\.(firebasestorage\\.app|appspot\\.com)$`).test(val)) {
        return `invalid storageBucket for ${EXPECTED_PROJECT_ID}`;
      }
      break;
    case 'VITE_FIREBASE_MESSAGING_SENDER_ID':
      if (!/^\d{6,20}$/.test(val)) {
        return 'invalid messagingSenderId format (expected numeric sender ID)';
      }
      break;
    case 'VITE_FIREBASE_APP_ID':
      if (!/^\d+:\d+:(web|android|ios):[A-Za-z0-9]+$/.test(val)) {
        return 'invalid Firebase appId format';
      }
      break;
    default:
      break;
  }

  return null;
}

export function validateAndNormalizeFirebaseEnv(env = process.env, options = {}) {
  const { githubEnvPath = process.env.GITHUB_ENV, isGitHubActions = process.env.GITHUB_ACTIONS === 'true', logger = console } =
    options;

  const normalizedValues = {};
  const missingKeys = [];
  const errors = [];
  const auditLines = [];

  logger.log('=== Production Firebase Configuration Validation ===');

  for (const key of REQUIRED_FIREBASE_KEYS) {
    const raw = typeof env[key] === 'string' ? env[key] : '';
    const { normalized, modified, reasons } = normalizeFirebaseEnvValue(raw);

    if (!normalized) {
      missingKeys.push(key);
      errors.push(`${key}: missing or empty`);
      const line = `- ${key}: MISSING (source: GitHub Secrets or Variables)`;
      auditLines.push(line);
      logger.log(line);
      continue;
    }

    const fieldError = validateNormalizedFirebaseField(key, normalized);
    if (fieldError) {
      errors.push(`${key}: ${fieldError}`);
      const line = `- ${key}: INVALID (${fieldError}; source: GitHub Secrets or Variables)`;
      auditLines.push(line);
      logger.log(line);
      continue;
    }

    normalizedValues[key] = normalized;
    const normNote = modified && reasons.length > 0 ? `normalized: ${reasons.join(', ')}; ` : '';
    const line = `- ${key}: VALID (${normNote}source: GitHub Secrets or Variables)`;
    auditLines.push(line);
    logger.log(line);
  }

  if (missingKeys.length > 0) {
    logger.log(`Missing required secrets/variables at runtime: ${missingKeys.join(', ')}`);
  }

  if (errors.length > 0) {
    logger.error(`\nValidation failed:\n- ${errors.join('\n- ')}`);
    return { ok: false, errors, missingKeys, normalizedValues, auditLines };
  }

  if (githubEnvPath) {
    const envLines = [];
    for (const key of REQUIRED_FIREBASE_KEYS) {
      const value = normalizedValues[key];
      if (isGitHubActions && MASKED_SECRET_KEYS.has(key) && value !== env[key]) {
        logger.log(`::add-mask::${value}`);
      }
      envLines.push(`${key}=${value}`);
    }
    fs.appendFileSync(githubEnvPath, `${envLines.join('\n')}\n`, 'utf8');
  }

  logger.log(`All ${REQUIRED_FIREBASE_KEYS.length} production Firebase variables validated cleanly for project ${EXPECTED_PROJECT_ID}.`);
  return { ok: true, errors: [], missingKeys: [], normalizedValues, auditLines };
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(currentFile)) {
  const result = validateAndNormalizeFirebaseEnv();
  if (!result.ok) {
    process.exit(1);
  }
}
