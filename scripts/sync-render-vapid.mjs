#!/usr/bin/env node
// Copy the VAPID keys from local .env onto the Render service.
//
// Why this exists: push notifications are wired end to end in the code
// (server.ts calls webpush.setVapidDetails, NotificationOptIn subscribes
// with the browser key) but the Render service has no VAPID_* variables,
// so every subscription request fails at runtime. The keys already exist
// in the local .env. This script moves them across without anyone having
// to open the Render dashboard and paste three base64 blobs by hand.
//
// Usage:
//   RENDER_API_KEY=rnd_xxx node scripts/sync-render-vapid.mjs
//
// Safety: key VALUES are never printed. The output is only variable names
// and value lengths, so a terminal transcript or CI log cannot leak them.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RENDER_API = 'https://api.render.com/v1';
const SERVICE_NAME = process.env.RENDER_SERVICE_NAME || 'phytodoctor-ai';

// These three are read by server.ts at runtime; VITE_VAPID_PUBLIC_KEY is
// inlined into the client bundle at build time, so Render needs it too (it
// reads build-time vars from the same env var list on the service).
const WANTED = [
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
  'VITE_VAPID_PUBLIC_KEY',
];

function readDotEnv(path) {
  const out = {};
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return out;
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[line.slice(0, eq).trim()] = value;
  }
  return out;
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${RENDER_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const detail = Array.isArray(json?.errors)
      ? json.errors.map((e) => e.message || e.code).join('; ')
      : text.slice(0, 200);
    throw new Error(`${method} ${path} -> ${res.status}: ${detail}`);
  }
  return json;
}

const apiKey = process.env.RENDER_API_KEY;
if (!apiKey) {
  console.error('RENDER_API_KEY is not set. See the header comment in this file.');
  process.exit(1);
}

const env = readDotEnv(join(ROOT, '.env'));
const missing = WANTED.filter((k) => !env[k]);
if (missing.length) {
  console.error(`These are not in .env, so they cannot be synced: ${missing.join(', ')}`);
  console.error('Generate a fresh pair with:  npx web-push generate-vapid-keys');
  process.exit(1);
}

const services = await api('/services?limit=100');
const match = (Array.isArray(services) ? services : [])
  .filter((s) => s.service?.name === SERVICE_NAME)
  .map((s) => s.service);
if (match.length !== 1) {
  console.error(
    `Expected exactly 1 service named "${SERVICE_NAME}", found ${match.length}.` +
      (match.length ? ' Refusing to guess.' : ''),
  );
  process.exit(1);
}

const service = match[0];
console.log(`Service: ${service.name} [${service.id}] (${service.type})`);

// Render's env var list is the full desired state -- anything omitted is
// removed -- so the existing list is read and merged rather than replaced.
const current = await api(`/services/${service.id}/env-vars`);
const existing = new Map(
  (Array.isArray(current) ? current : []).map((e) => [e.key, e]),
);

const merged = (Array.isArray(current) ? current : []).filter((e) => !WANTED.includes(e.key));
for (const key of WANTED) {
  merged.push({ key, value: env[key], type: 'plain' });
  const prior = existing.get(key);
  const note = prior ? ' (updated)' : ' (added)';
  console.log(`  ${key.padEnd(24)} ${note} — ${env[key].length} chars`);
}

// Echo the keys we are leaving alone so an accidental clobber is visible.
const untouched = (Array.isArray(current) ? current : [])
  .filter((e) => !WANTED.includes(e.key))
  .map((e) => e.key);
console.log(`\nPreserving ${untouched.length} existing env var(s): ${untouched.join(', ') || 'none'}`);

await api(`/services/${service.id}/env-vars`, { method: 'PUT', body: merged });

console.log('\nDone. Render will redeploy on its own -- no manual trigger needed.');
console.log('Web push stays disabled until the redeploy finishes and the keys are present.');
