import express from "express";
import compression from "compression";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import webpush from "web-push";
import { randomUUID, createHmac, createHash, timingSafeEqual } from "node:crypto";
import { createUserScopedClient } from "./src/lib/supabaseUserClient";
import { clampTo, clampPercent, clampUnit, hasScore, orderRange } from "./src/lib/scoreGuards";
import { cooldownFor, selectModels as chooseModels } from "./src/lib/modelCooldown";
import { readImageSignals, assessProvenance } from "./src/lib/imageProvenance";
import { shapeScanReport, type ScanReport } from "./src/lib/scanReport";
import { createGuestQuotaStore, digestIp, MemoryQuotaStore, type GuestQuotaStore } from "./src/lib/guestQuotaStore";
import { classifyStaticRequest } from "./src/lib/spaFallback";
import { clientIpOf as resolveClientIp } from "./src/lib/clientIp";
import { log, withRequestContext, setRequestUser, currentRequestId } from "./src/lib/logger";

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// The client bundle is ~1.6 MB raw / ~460 KB gzipped; serving it uncompressed
// makes every first visit pay full transfer cost.
app.use(compression());

// Behind Render's proxy: derive req.ip from the trusted proxy chain so a
// client cannot spoof X-Forwarded-For to rotate rate-limit identities.
app.set('trust proxy', 1);
app.disable('x-powered-by');

// ── Request identity ────────────────────────────────────────────────────────
// Runs before everything else, including the rate limiter, so a request that
// gets rejected still has an id and can be traced.
//
// An inbound `x-request-id` is honoured so a trace can be started upstream (a
// browser retry, a curl loop, a future gateway) and followed through this
// server. It is echoed back in the response header either way, which is what
// makes an id usable: you take it from a failing request and search for it.
const REQUEST_ID_HEADER = 'x-request-id';
app.use((req, res, next) => {
  const inbound = req.get(REQUEST_ID_HEADER);
  const requestId =
    typeof inbound === 'string' && /^[\w-]{8,128}$/.test(inbound)
      ? inbound
      : randomUUID();
  res.setHeader(REQUEST_ID_HEADER, requestId);
  withRequestContext({ requestId }, next);
});

// ── Security headers ───────────────────────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self)');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    // Styles keep 'unsafe-inline' for the UI's runtime CSS-in-JS; scripts stay
    // locked to 'self' (SW registration lives in the bundled main.tsx).
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; " +
      "script-src 'self'; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' https://fonts.gstatic.com; " +
      "img-src 'self' data: blob: https:; " +
      "media-src 'self'; " +
      "connect-src 'self' https:; " +
      "frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  }
  next();
});

// ── Per-IP rate limiter ────────────────────────────────────────────────────
// Two tiers: general API traffic and the expensive Gemini AI endpoints.
// Counters are keyed on req.ip (proxy-aware). In-memory only — swap in
// express-rate-limit + Redis when running multiple instances.
const RATE_WINDOW_MS = 60_000;
const GENERAL_RATE_LIMIT = 60;
const AI_RATE_LIMIT = 15;
const generalRateCounts = new Map<string, { count: number; resetAt: number }>();
const aiRateCounts = new Map<string, { count: number; resetAt: number }>();

/**
 * The address a limit should count against. Cloudflare sets CF-Connecting-IP
 * to the real client and 403s anything carrying its own copy, so it cannot be
 * rotated to escape a limit the way X-Forwarded-For can. See
 * src/lib/clientIp.ts for the measurement behind that.
 */
const clientIpOf = (req: express.Request): string => resolveClientIp(req);

function makeLimiter(limit: number, map: Map<string, { count: number; resetAt: number }>) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = clientIpOf(req);
    const now = Date.now();
    const entry = map.get(ip);
    if (!entry || now > entry.resetAt) {
      map.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    } else {
      entry.count++;
      if (entry.count > limit) {
        return res.status(429).json({ error: 'Too many requests. Please slow down.' });
      }
    }
    next();
  };
}

const generalLimiter = makeLimiter(GENERAL_RATE_LIMIT, generalRateCounts);
const aiLimiter = makeLimiter(AI_RATE_LIMIT, aiRateCounts);

app.use('/api', generalLimiter);

// Periodically evict stale limiter entries so the Map cannot grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of generalRateCounts) if (now > entry.resetAt) generalRateCounts.delete(ip);
  for (const [ip, entry] of aiRateCounts) if (now > entry.resetAt) aiRateCounts.delete(ip);
  const today = new Date().toISOString().slice(0, 10);
  for (const key of usageCounts.keys()) if (!key.includes(`:${today}:`)) usageCounts.delete(key);
}, 5 * 60_000).unref();

// ── Shared helpers ─────────────────────────────────────────────────────────
// Client-facing errors must never echo internal error messages.
function fail(res: express.Response, code: number, msg: string) {
  return res.status(code).json({ error: msg });
}
const AI_GENERIC_ERROR = 'The AI service is temporarily unavailable. Please try again in a moment.';

function localBotanicalReply(message: string): string {
  const query = message.toLowerCase();
  const preface = 'The botanical archive is temporarily unavailable, so here is a practical baseline from the local care guide:\n\n';
  if (/(yellow|pale|chlorosis)/.test(query)) {
    return `${preface}Check soil moisture and drainage first: yellowing from wet soil usually affects older leaves and comes with slow drying, while underwatering leaves are often crisp or curling. Pause watering until the top 2–5 cm dries, confirm the pot drains freely, and inspect the roots for odor or mushiness.`;
  }
  if (/(water|overwater|underwater|watering)/.test(query)) {
    return `${preface}Water thoroughly until a little drains from the pot, then wait for the top layer of soil to dry before watering again. Use the soil and root condition—not a fixed calendar—as the trigger, and empty any saucer after 10 minutes.`;
  }
  if (/(mite|gnat|aphid|pest|fungus)/.test(query)) {
    return `${preface}Isolate the plant, inspect leaf undersides and soil, then remove visible pests with water or a cotton swab. Avoid spraying stressed foliage in harsh sun; repeat a labeled soap or oil treatment at its stated interval and monitor new growth.`;
  }
  if (/(light|sun|humidity|temperature|humid)/.test(query)) {
    return `${preface}Give bright, indirect light unless the species specifically needs direct sun, keep foliage away from hot glass or vents, and improve humidity with grouping or a humidifier rather than constantly wetting leaves.`;
  }
  if (/(soil|ph|fertili[sz]|repot)/.test(query)) {
    return `${preface}Use a clean, airy mix matched to the species, ensure the container has drainage, and avoid fertilizing a visibly stressed plant until watering and root health are stable. Change one variable at a time so the response is measurable.`;
  }
  return `${preface}Share the plant species, light exposure, watering pattern, soil condition, and the exact symptom (including when it started). Until then, keep the plant stable: bright suitable light, good drainage, and no sudden changes or extra fertilizer.`;
}

// Binomial-safe species names: letters, numbers, spaces, hyphens, apostrophes,
// periods and parentheses only. Blocks prompt-injection payloads masquerading
// as species names.
const SPECIES_RE = /^[\p{L}\p{N}'’\-.() ]{2,80}$/u;
function isValidSpecies(name: unknown): name is string {
  return typeof name === 'string' && SPECIES_RE.test(name.trim());
}
function strLimit(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 && t.length <= max ? t : null;
}

// ── Optional Supabase API gate ─────────────────────────────────────────────
// When SUPABASE_URL + SUPABASE_ANON_KEY are set on the server, every /api
// request must carry a valid Supabase access token (Bearer). Without them
// (local dev / pre-Supabase deploys) the endpoints stay open but rate-limited.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
let supabaseAuthClient: any = null;
let supabaseAuthInitFailed = false;
if (SUPABASE_URL && SUPABASE_KEY) {
  import('@supabase/supabase-js').then(({ createClient }) => {
    supabaseAuthClient = createClient(SUPABASE_URL, SUPABASE_KEY);
    log.info('API auth gate enabled: /api/* requires a Supabase session token.');
  }).catch((err) => {
    supabaseAuthInitFailed = true;
    log.error('Supabase gate init failed', { err: err?.message });
  });
}

function apiGate(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return next(); // local mode
  if (!supabaseAuthClient) {
    return fail(res, 503, supabaseAuthInitFailed
      ? 'Authentication service is temporarily unavailable. Please try again.'
      : 'Authentication service is starting. Please try again.');
  }
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return fail(res, 401, 'Sign in to use the AI features.');
  supabaseAuthClient.auth.getUser(token)
    .then(({ data, error }: any) => {
      if (error || !data?.user) return fail(res, 401, 'Your session has expired. Please sign in again.');
      (req as any).authUserId = data.user.id as string;
      (req as any).authToken = token;
      // Everything logged from here on carries the user id, with no change to
      // any of the code that logs.
      setRequestUser(data.user.id as string);
      next();
    })
    .catch(() => fail(res, 401, 'Your session has expired. Please sign in again.'));
}

/**
 * THE GUEST LANE (identify only).
 *
 * The scanner is the product, and until now a visitor had to create an account
 * before seeing a single screen of it. This gate lets a signed-out visitor
 * through to /api/identify with a strict per-IP daily cap, so the first scan
 * happens before the sign-up, and the conversion ask arrives with a diagnosis
 * already on screen.
 *
 * Any request carrying a Bearer token goes through the full apiGate instead,
 * so nothing else changes for signed-in users. tierGate stays in the chain
 * after this; for guests (no authUserId) it already short-circuits open.
 */
const GUEST_IDENTIFY_LIMIT = 2;

// Shared when sql/guest_scan_quota.sql has been applied, in-process otherwise.
// An in-process Map is per instance, and production was observed granting a
// third scan immediately after refusing one, because the next request landed
// on a second instance. See src/lib/guestQuotaStore.ts.
let guestQuota: GuestQuotaStore = new MemoryQuotaStore(GUEST_IDENTIFY_LIMIT);

async function apiOrGuestGate(req: express.Request, res: express.Response, next: express.NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (token || !SUPABASE_URL || !SUPABASE_KEY) return apiGate(req, res, next);

  const day = new Date().toISOString().slice(0, 10);
  let quota;
  try {
    quota = await guestQuota.take(clientIpOf(req), day, 'identify');
  } catch (err) {
    // A quota store failure must not become a hard error for a visitor who
    // just wants to photograph a leaf. Serve them; log the reason.
    log.error('Guest quota store failed', { err });
    return next();
  }
  if (!quota.allowed) {
    return fail(res, 401, 'Your free guest scans are used up for today. Create a free account for 3 scans a day.');
  }
  (req as any).isGuest = true;
  next();
}

// ── Game economy (server-authoritative when Supabase is configured) ────────
// Service-role client: the ONLY writer allowed to grant Pro tier. Never
// expose SUPABASE_SERVICE_KEY to the client bundle.
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
let supabaseAdmin: any = null;
let supabaseAdminPromise: Promise<void> | null = null;
if (SUPABASE_URL && SUPABASE_SERVICE_KEY && (globalThis as any).__createSupabaseAdmin !== true) {
  supabaseAdminPromise = import('@supabase/supabase-js').then(({ createClient }) => {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    log.info('Economy admin client ready (service role).');
  }).catch((err) => log.error('Supabase admin init failed', { err: err?.message }));
}

// RLS-scoped client per request: reads/writes the caller's own economy rows.
// The header contract that keeps this working lives in the helper, with a
// regression test pinning it — see src/lib/supabaseUserClient.ts.
function userClient(token: string) {
  if (!supabaseAdmin) return null;
  return createUserScopedClient(SUPABASE_URL!, SUPABASE_KEY, token);
}

const PRO_COST_SEEDS = 1000;
const PRO_PRICE_PAISE = 9900; // ₹99/month

// Daily usage caps per user (in-memory; resets on restart — the rate limiter
// still bounds abuse, this protects Gemini cost per account).
const FREE_LIMITS = { identify: 3, assess: 2, voice: 5, forecast: 0, predict: 2, chat: 10 } as const;
const PRO_LIMITS = { identify: 30, assess: Infinity, voice: Infinity, forecast: Infinity, predict: 20, chat: 100 } as const;
const usageCounts = new Map<string, number>();

function usageKey(userId: string, kind: string) {
  const day = new Date().toISOString().slice(0, 10);
  return `${userId}:${day}:${kind}`;
}

function tierGate(kind: keyof typeof FREE_LIMITS) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const userId = (req as any).authUserId;
    if (!userId || !supabaseAdmin) return next(); // open mode: rate limiter only
    try {
      const { data: profile } = await supabaseAdmin
        .from('profiles').select('tier, pro_expires_at').eq('user_id', userId).single();
      let tier: string = profile?.tier || 'free';
      if (tier === 'pro' && profile?.pro_expires_at && new Date(profile.pro_expires_at) < new Date()) {
        tier = 'free'; // lapsed commission — honest downgrade, no write needed
      }

      (req as any).userTier = tier;
      const limit = (tier === 'pro' ? PRO_LIMITS : FREE_LIMITS)[kind];
      if (limit === Infinity) return next();
      const key = usageKey(userId, kind);
      const used = usageCounts.get(key) || 0;
      if (used >= limit) {
        return res.status(429).json({
          error: tier === 'free'
            ? `Daily ${kind} limit reached (${limit}/day on the free tier). Go Pro for more.`
            : 'Daily limit reached. Please try again tomorrow.'
        });
      }
      usageCounts.set(key, used + 1);
      next();
    } catch (error) {
      log.error('Tier lookup failed', { kind, err: error });
      return fail(res, 503, 'Account limits are temporarily unavailable. Please try again.');
    }
  };
}

app.post("/api/plant-voice", express.json({ limit: '16kb' }), aiLimiter, apiGate, tierGate("voice"), async (req, res) => {
  try {
    const { diagnosis, plantName, species, driftStatus, previousMessage } = req.body || {};
    const name = strLimit(plantName, 80);
    const plantSpecies = strLimit(species, 120);
    const symptom = strLimit(diagnosis?.primarySymptom || diagnosis?.diagnosis, 300);
    if (!name || !plantSpecies || !symptom || !['stable', 'declining', 'critical'].includes(driftStatus)) {
      return fail(res, 400, "Plant voice requires a valid plant, symptom, and drift status.");
    }
    const response = await generateWithRetry({
      contents: [{ parts: [{ text: `Plant name: ${name}\nSpecies: ${plantSpecies}\nDrift status: ${driftStatus}\nSpecific symptom: ${symptom}\nPrevious message: ${strLimit(previousMessage, 160) || 'none'}` }] }],
      config: {
        systemInstruction: "Speak as the plant itself in 1-2 short sentences. Reference the specific symptom, match urgency to severity, never mention AI or break character. Return only the requested JSON.",
        temperature: 0.7,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["message", "tone"],
          properties: {
            message: { type: Type.STRING, description: "Maximum 160 characters." },
            tone: { type: Type.STRING, enum: ["content", "concerned", "urgent"] },
            suggestedAction: { type: Type.STRING, description: "Optional, maximum 60 characters." }
          }
        }
      }
    });
    const result = JSON.parse((response.text || "").replace(/```json|```/gi, "").trim());
    if (typeof result.message !== 'string' || !['content', 'concerned', 'urgent'].includes(result.tone)) {
      return fail(res, 502, AI_GENERIC_ERROR);
    }
    res.json({ ...result, message: result.message.slice(0, 160), suggestedAction: result.suggestedAction?.slice(0, 60) });
  } catch (error: any) {
    log.error('Plant voice error', { err: error });
    fail(res, 500, AI_GENERIC_ERROR);
  }
});

app.post("/api/predict-growth", express.json({ limit: '16kb' }), aiLimiter, apiGate, tierGate("forecast"), async (req, res) => {
  try {
    const { plantId, species, checkInHistory } = req.body || {};
    if (typeof plantId !== 'string' || !isValidSpecies(species) || !Array.isArray(checkInHistory) || checkInHistory.length < 3 || checkInHistory.length > 10) {
      return fail(res, 400, "At least three valid check-ins are required.");
    }
    const response = await generateWithRetry({
      contents: [{ parts: [{ text: JSON.stringify({ plantId, species, checkIns: checkInHistory }) }] }],
      config: {
        systemInstruction: "You are a cautious plant health forecaster. Never invent certainty. Return a short two-path forecast grounded only in the supplied history.",
        temperature: 0.2,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["hasEnoughData", "currentTrend", "ifUnchanged", "ifFixed", "confidence"],
          properties: {
            hasEnoughData: { type: Type.BOOLEAN },
            currentTrend: { type: Type.STRING, enum: ["improving", "stable", "declining", "insufficient_data"] },
            ifUnchanged: { type: Type.OBJECT, properties: { timeframe: { type: Type.STRING }, prediction: { type: Type.STRING } } },
            ifFixed: { type: Type.OBJECT, properties: { fix: { type: Type.STRING }, timeframe: { type: Type.STRING }, prediction: { type: Type.STRING } } },
            confidence: { type: Type.STRING, enum: ["low", "medium", "high"] }
          }
        }
      }
    });
    // This used to be a raw passthrough: whatever came back was parsed and
    // handed to the client untouched, so a malformed or hallucinated payload
    // surfaced as a broken forecast card with no explanation. Validated now —
    // required keys, the trend/confidence enums, clamped scores.
    const rawForecast = JSON.parse((response.text || "").replace(/```json|```/gi, "").trim());
    const TREND_VALUES = ["improving", "stable", "declining", "insufficient_data"];
    const CONFIDENCE_VALUES = ["low", "medium", "high"];
    const forecastValid =
      rawForecast &&
      typeof rawForecast.hasEnoughData === "boolean" &&
      TREND_VALUES.includes(rawForecast.currentTrend) &&
      CONFIDENCE_VALUES.includes(rawForecast.confidence) &&
      rawForecast.ifUnchanged && typeof rawForecast.ifUnchanged.prediction === "string" &&
      rawForecast.ifFixed && typeof rawForecast.ifFixed.prediction === "string";
    if (!forecastValid) {
      log.error('Growth forecast came back malformed', { snippet: String(response.text || "").slice(0, 200) });
      return fail(res, 502, 'The growth forecast came back malformed. Please try again in a moment.');
    }
    res.json(rawForecast);
  } catch (error: any) {
    log.error('Growth forecast error', { err: error });
    fail(res, 500, AI_GENERIC_ERROR);
  }
});

// ── Web push ───────────────────────────────────────────────────────────────
// push_subscriptions was write-only for its whole life: the client could
// register an endpoint and nothing ever sent to it. Everything below exists to
// make the delivery half real.
//
// A subscription goes stale the moment the browser rotates it, and the push
// service answers 404/410 for those. Left alone they accumulate forever, so a
// send that fails that way deletes the row.
const PUSH_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:alerts@phytodoctor.ai';
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const pushEnabled = Boolean(VAPID_PUBLIC && VAPID_PRIVATE && supabaseAdmin);

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(PUSH_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  log.info('Web push sender configured.');
} else if (VAPID_PUBLIC || VAPID_PRIVATE) {
  // Half a keypair cannot sign, and silently disabling would hide the mistake.
  log.warn('Web push disabled: VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY must both be set.');
}

type PushRow = { id: string; user_id: string; endpoint: string; p256dh: string; auth_key: string; last_sent_at: string | null };

function toSubscription(row: PushRow) {
  return { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth_key } };
}

async function dropSubscription(id: string, reason: string) {
  const { error } = await supabaseAdmin.from('push_subscriptions').delete().eq('id', id);
  if (error) log.error('Could not remove stale push subscription', { subscriptionId: id, err: error.message });
  else log.info('Removed stale push subscription', { subscriptionId: id, reason });
}

/** Send one payload. Returns 'sent', 'stale' (endpoint gone) or 'failed'. */
async function deliver(row: PushRow, payload: Record<string, string>): Promise<'sent' | 'stale' | 'failed'> {
  try {
    await webpush.sendNotification(toSubscription(row), JSON.stringify(payload), { TTL: 60 * 60 });
    return 'sent';
  } catch (error: any) {
    // 404/410 are the documented "this subscription is gone" responses.
    if (error?.statusCode === 404 || error?.statusCode === 410) {
      await dropSubscription(row.id, `status ${error.statusCode}`);
      return 'stale';
    }
    log.error('Push delivery failed', { subscriptionId: row.id, err: error });
    return 'failed';
  }
}

/**
 * A plant is due when next_water_due has passed, or — when that column was
 * never set — when last_watered_at plus the watering interval has passed.
 */
function isDue(
  plant: { next_water_due: string | null; last_watered_at: string | null; watering_interval_days: number | null },
  now: number
): boolean {
  if (plant.next_water_due) return Date.parse(plant.next_water_due) <= now;
  if (!plant.last_watered_at) return false; // Never watered: no baseline to be "due" against.
  const interval = plant.watering_interval_days || 7;
  return Date.parse(plant.last_watered_at) + interval * 86_400_000 <= now;
}

/**
 * Send one summary push per subscribed user covering whatever is due, then
 * record it so a plant that stays overdue does not notify again for a day.
 */
async function runWateringReminders() {
  if (!pushEnabled) return { skipped: 'push not configured' };
  const now = Date.now();
  const since = new Date(now - 86_400_000).toISOString();

  const [subsResult, plantsResult] = await Promise.all([
    supabaseAdmin.from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth_key,last_sent_at'),
    supabaseAdmin.from('plants').select('id,user_id,name,next_water_due,last_watered_at,watering_interval_days'),
  ]);
  if (subsResult.error) throw new Error(subsResult.error.message);
  if (plantsResult.error) throw new Error(plantsResult.error.message);
  const subs = (subsResult.data || []) as PushRow[];
  const plants = (plantsResult.data || []) as any[];
  if (!subs.length) return { sent: 0, usersDue: 0 };

  const byUser = new Map<string, any[]>();
  for (const plant of plants) {
    if (!plant.user_id || !isDue(plant, now)) continue;
    if (!byUser.has(plant.user_id)) byUser.set(plant.user_id, []);
    byUser.get(plant.user_id)!.push(plant);
  }

  let sent = 0;
  for (const sub of subs) {
    const due = byUser.get(sub.user_id) || [];
    // Throttle: a device already told today is not told again today.
    if (sub.last_sent_at && sub.last_sent_at > since) continue;
    if (!due.length) continue;

    const first = due[0];
    const body = due.length === 1
      ? `${first.name} is due for water.`
      : `${due.length} plants are due for water, starting with ${first.name}.`;
    const result = await deliver(sub, {
      title: 'Time to water',
      body,
      tag: 'watering-reminder',
      url: `/plant/${first.id}`,
    });
    if (result === 'sent') {
      sent++;
      await supabaseAdmin.from('push_subscriptions')
        .update({ last_sent_at: new Date(now).toISOString() }).eq('id', sub.id);
      // Only the oldest plant is linked in the notification, but every plant
      // in the batch is recorded as alerted so none resurfaces tomorrow.
      //
      // This is a plain insert, not the upsert the migration's comment
      // describes, and the index backing it is not unique — so a retry after
      // a crash does write a second row for the same plant. That is currently
      // harmless: nothing reads this table. Suppression comes from
      // last_sent_at above. If something ever starts reading it to decide what
      // to skip, it needs a real unique constraint and an upsert first.
      await supabaseAdmin.from('push_alert_log').insert(
        due.map(p => ({ user_id: sub.user_id, plant_id: p.id, kind: 'watering' }))
      );
    }
  }
  log.info('Watering reminders run', { sent, users: byUser.size });
  return { sent, usersDue: byUser.size };
}

app.post("/api/push/subscribe", express.json({ limit: '16kb' }), apiGate, async (req, res) => {
  if (!pushEnabled) return fail(res, 503, "Weather alerts are not configured on this server.");
  try {
    const userId = (req as any).authUserId;
    const client = userClient((req as any).authToken);
    const subscription = req.body || {};
    if (!userId || !client || typeof subscription.endpoint !== 'string'
      || typeof subscription.keys?.p256dh !== 'string' || typeof subscription.keys?.auth !== 'string') {
      return fail(res, 400, "Invalid push subscription.");
    }
    const { error } = await client.from('push_subscriptions').upsert({
      user_id: userId, endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh, auth_key: subscription.keys.auth
    }, { onConflict: 'user_id,endpoint' });
    if (error) return fail(res, 500, "Could not save push subscription.");
    res.json({ ok: true });
  } catch (error: any) {
    log.error('Push subscription error', { err: error });
    fail(res, 500, "Could not save push subscription.");
  }
});

// Without this there is no way back out once a device has opted in.
app.post("/api/push/unsubscribe", express.json({ limit: '4kb' }), apiGate, async (req, res) => {
  try {
    const userId = (req as any).authUserId;
    const client = userClient((req as any).authToken);
    const endpoint = req.body?.endpoint;
    if (!userId || !client || typeof endpoint !== 'string') {
      return fail(res, 400, "Invalid push subscription.");
    }
    const { error } = await client.from('push_subscriptions').delete()
      .eq('user_id', userId).eq('endpoint', endpoint);
    if (error) return fail(res, 500, "Could not remove push subscription.");
    res.json({ ok: true });
  } catch (error: any) {
    log.error('Push unsubscribe error', { err: error });
    fail(res, 500, "Could not remove push subscription.");
  }
});

// Lets a user confirm alerts actually reach their device instead of trusting a
// green tick, and is the hook used to verify delivery end to end.
app.post("/api/push/test", express.json({ limit: '2kb' }), apiGate, async (req, res) => {
  if (!pushEnabled) return fail(res, 503, "Weather alerts are not configured on this server.");
  try {
    const userId = (req as any).authUserId;
    const { data, error } = await supabaseAdmin
      .from('push_subscriptions').select('id,user_id,endpoint,p256dh,auth_key,last_sent_at')
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    if (!data?.length) return fail(res, 404, "No alerts are enabled on this device yet.");
    const result = await deliver(data[0] as PushRow, {
      title: 'PhytoDoctor',
      body: 'Weather alerts are switched on for this device.',
      tag: 'test-alert',
      url: '/',
    });
    if (result === 'stale') return fail(res, 410, "This device's subscription has expired. Please switch alerts off and on again.");
    if (result === 'failed') return fail(res, 502, "The alert could not be delivered. Please try again.");
    await supabaseAdmin.from('push_alert_log').insert({ user_id: userId, kind: 'test' });
    res.json({ ok: true });
  } catch (error: any) {
    log.error('Push test error', { err: error });
    fail(res, 500, "The test alert could not be sent.");
  }
});

// Watering reminders. The per-day throttle inside runWateringReminders keeps a
// still-due plant to one push. Render's free tier sleeps an idle web service,
// so this fires on wake rather than on a fixed wall clock — good enough for a
// reminder, and the work is skipped entirely when nobody is using the app.
const PUSH_INTERVAL_MIN = Number(process.env.PUSH_REMINDER_INTERVAL_MINUTES) || 360;
function scheduleWateringReminders() {
  if (!pushEnabled) return;
  const tick = () => {
    supabaseAdminPromise
      ?.then(() => runWateringReminders())
      .catch((err) => log.error('Watering reminder run failed', { err }));
  };
  setTimeout(tick, 15_000).unref();
  setInterval(tick, PUSH_INTERVAL_MIN * 60_000).unref();
  log.info('Watering reminders scheduled', { intervalMinutes: PUSH_INTERVAL_MIN });
}

async function grantPro(userId: string, paymentId: string, amount: number, currency: string) {
  const { data, error } = await supabaseAdmin.rpc('grant_pro_from_payment', {
    p_user_id: userId,
    p_payment_id: paymentId,
    p_amount: amount,
    p_currency: currency,
  });
  if (error) throw new Error(error.message);
  return data;
}

// The RPCs the server calls via supabaseAdmin.rpc(). They live in the
// database, not in this process, so nothing else in the app can tell if they
// are missing — and this project has no supabase_migrations.schema_migrations
// table, because its migrations were applied by hand through the dashboard.
// That is how grant_pro_from_payment went absent while every env-var check
// stayed green: a payment would have been captured by Razorpay and then thrown
// away with a 500 the user never sees and no retry.
const NULL_UUID = '00000000-0000-0000-0000-000000000000';

// Each probe supplies the function's real parameter names with values that the
// function itself rejects, so it raises before touching any row. The arguments
// have to be named: PostgREST refuses a zero-argument call to a function that
// has parameters with PGRST202 — the same code it returns for a function that
// does not exist — so an unnamed probe cannot tell the two apart.
//
// A function that exists therefore raises its own error (or succeeds); one that
// does not is rejected by PostgREST with PGRST202 before it ever runs.
const REQUIRED_RPCS = [
  { name: 'grant_pro_from_payment', args: { p_user_id: NULL_UUID, p_payment_id: '', p_amount: 0, p_currency: '' } },
  { name: 'purchase_pro_with_seeds', args: { p_user_id: NULL_UUID, p_cost: 0 } },
  { name: 'increment_seeds', args: { p_user_id: NULL_UUID, p_amount: 0, p_source: '', p_description: '' } },
] as const;

type RpcProbe = 'present' | 'missing' | 'unauthorized';

// The tables the server writes to. The RPC probe above cannot see these: a
// function that is present says nothing about whether its table was ever
// created, and this project's migrations were applied by hand, so a migration
// file is not evidence that production has it. That gap is not theoretical —
// public.plants shipped missing nine columns that its migration declared, which
// broke saving any plant while every health signal stayed green.
//
// push/subscribe was unreachable until the RLS header bug was fixed, so its
// upsert has never actually run against production. Without this the first
// person to enable notifications would be the one to discover the table is
// absent, and they would only see "Could not save push subscription."
//
// Split by consequence. A missing core table means the app is broken, so it
// degrades the status. A missing push table means one optional feature is
// broken while everything else works, and flipping the whole service to 503
// for it would page someone about a healthy site — the same class of mistake as
// reporting an unreachable database as schema drift. Both are still reported,
// so nothing is hidden; only the severity differs.
const REQUIRED_TABLES = [
  'plants',
  'profiles',
  'seed_transactions',
] as const;

const OPTIONAL_TABLES = [
  'push_subscriptions',
  'push_alert_log',
  // Written by the identify handler's fire-and-forget persistence. Missing it
  // disables report storage gracefully — see persistScanReport.
  'scan_reports',
  // Written by the purchase_pro_with_seeds RPC, not by this server, so the
  // RPC probe above cannot see it: the function answering proves nothing about
  // whether the table it inserts into was ever created. Pro is bought with
  // seeds, so a missing table breaks that path and nothing else.
  'subscriptions',
  // Absent until sql/guest_scan_quota.sql is run. Without it the guest scan
  // cap is per instance rather than shared, which is a cost problem, not an
  // outage -- so it is reported and never counted against readiness.
  'guest_scan_quota',
  // Absent until sql/market_ledger.sql is run. Without it purchased market
  // state stays device-local exactly as before the sync existed -- a feature
  // that quietly does not turn on, not an outage.
  'market_ledger',
] as const;

const ALL_TABLES = [...REQUIRED_TABLES, ...OPTIONAL_TABLES] as const;

let rpcCheck: {
  ok: boolean;
  missing: string[];
  missingTables?: string[];
  missingOptionalTables?: string[];
  error?: string;
} | null = null;
let rpcCheckedAt = 0;
const RPC_CHECK_TTL_MS = 60_000;

// Three outcomes, not two. Collapsing "the key was rejected" into "the function
// is there" is what would make this check lie: a bad service key fails every
// probe with a 401, which matches neither PGRST202 nor the function's own error,
// and a two-valued test would read that as three healthy RPCs.
async function probeRpc(name: string, args: Record<string, unknown>): Promise<RpcProbe> {
  const { error } = await supabaseAdmin.rpc(name as never, args as never);
  if (!error) return 'present';
  const text = `${error.code ?? ''} ${error.message}`;
  if (/PGRST202|42883|could not find the function/i.test(text)) return 'missing';
  if (/42501|401|403|invalid api key|jwt|unauthorized|permission denied/i.test(text)) {
    return 'unauthorized';
  }
  // Some other error (our own raised exception, a timeout surfacing as a
  // PostgREST error). The function was reached, which is what we care about.
  return 'present';
}

// Same three outcomes as the RPC probe, for the same reason: a table that
// exists can still raise (RLS, a bad column), and a rejected key must not be
// reported as a healthy schema. limit(0) fetches no rows, so this stays cheap
// and touches no data.
//
// A table absent from the schema cache surfaces as PGRST205; one that exists in
// the database but was never exposed to PostgREST surfaces as 42P01.
async function probeTable(name: string): Promise<RpcProbe> {
  const { error } = await supabaseAdmin.from(name).select('*').limit(0);
  if (!error) return 'present';
  const text = `${error.code ?? ''} ${error.message}`;
  if (/PGRST205|42P01|could not find the table|not found in the schema cache/i.test(text)) {
    return 'missing';
  }
  if (/42501|401|403|invalid api key|jwt|unauthorized|permission denied/i.test(text)) {
    return 'unauthorized';
  }
  return 'present';
}

// Health check for Render and deployment diagnostics. Never expose secret values.
app.get('/healthz', async (_req, res) => {
  const configured = {
    supabase: Boolean(SUPABASE_URL && SUPABASE_KEY && SUPABASE_SERVICE_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    razorpay: Boolean(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET && RAZORPAY_WEBHOOK_SECRET),
  };

  // Cached so a health check polled every few seconds doesn't become eight
  // database round-trips every few seconds. A stale 'ok' is fine: the failure
  // this guards against is an unapplied migration, not a transient blip.
  if (supabaseAdmin && Date.now() - rpcCheckedAt > RPC_CHECK_TTL_MS) {
    rpcCheckedAt = Date.now();
    try {
      const [rpcResults, tableResults] = await Promise.all([
        Promise.all(REQUIRED_RPCS.map(rpc => probeRpc(rpc.name, rpc.args))),
        Promise.all(ALL_TABLES.map(probeTable)),
      ]);
      const missing = REQUIRED_RPCS.filter((_, i) => rpcResults[i] === 'missing').map(rpc => rpc.name);
      const absent = ALL_TABLES.filter((_, i) => tableResults[i] === 'missing');
      // Only a core table degrades the status. See the note on the two lists.
      const missingTables = REQUIRED_TABLES.filter((_, i) => tableResults[i] === 'missing');
      const missingOptionalTables = OPTIONAL_TABLES.filter(
        (_, i) => tableResults[REQUIRED_TABLES.length + i] === 'missing'
      );
      const unauthorized = rpcResults.some(r => r === 'unauthorized') || tableResults.some(r => r === 'unauthorized');
      rpcCheck = {
        ok: missing.length === 0 && missingTables.length === 0 && !unauthorized,
        missing,
        // A named table is what an operator needs to go apply the migration.
        // Reporting only "drift" would leave them guessing which one.
        ...(missingTables.length ? { missingTables } : {}),
        // Reported, but not counted against readiness.
        ...(missingOptionalTables.length ? { missingOptionalTables } : {}),
        // Names the credential problem without naming the credential. This is
        // the signal that catches a rotated-but-not-propagated service key.
        ...(unauthorized ? { error: 'service key rejected by Supabase' } : {}),
      };
    } catch (error: any) {
      // A network failure is not evidence of drift, and reporting it as drift
      // would page someone about a database that is merely unreachable.
      log.error('Health check RPC probe failed', { err: error });
      rpcCheck = { ok: true, missing: [] };
    }
  }

  const isMisconfigured = process.env.NODE_ENV === 'production' && !configured.supabase;
  const ready = isMisconfigured ? false : Boolean(supabaseAuthClient && supabaseAdmin) || process.env.NODE_ENV !== 'production';
  // Only fail the check in production, and only when a probe actually ran and
  // found something missing.
  const drift = process.env.NODE_ENV === 'production' && rpcCheck !== null && !rpcCheck.ok;

  res.status(isMisconfigured || drift ? 503 : 200).json({
    status: isMisconfigured || drift ? 'degraded' : 'ok',
    configured,
    ready,
    schema: rpcCheck,
  });
});

// Liveness, deliberately separate from readiness.
//
// /healthz above is a readiness check: it probes Supabase for schema drift and
// answers 503 when the database is unreachable. That is right for deciding
// "should this instance take traffic" and wrong for deciding "should the
// platform restart this process" — a database blip would have the platform
// kill and respawn a perfectly healthy container in a loop, turning a
// recoverable dependency outage into a self-inflicted one.
//
// This endpoint confirms the process is alive and nothing else: no database,
// no credentials, no external calls. Point the platform's restart probe here
// and /healthz at the readiness check.
app.get(['/healthz/live', '/api/health/live'], (_req, res) => {
  res.status(200).json({ status: 'ok', uptimeSeconds: Math.floor(process.uptime()) });
});


// Gemini Initialization
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    // Caps every attempt: without it a hung Gemini call never resolves and
    // the Express request hangs until the client gives up. 60s because the
    // full identify schema can legitimately need more than 30s on the
    // high-capacity tiers before this falls through to the next model.
    timeout: 60000,
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Wait-facing routes get a shorter per-attempt budget. The 60s cap exists so a
// hung call eventually resolves, but paying 60s before falling back is itself
// the defect: a production /api/sandbox assess measured ~105s wall clock, which
// is 60s of dead time on the first model plus a fast answer from the fallback.
const aiFast = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    timeout: 25000,
    headers: { 'User-Agent': 'aistudio-build' },
  }
});

const MODEL_CHAIN = ["gemini-3.8-flash", "gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash"];

// Verified against the production key on 2026-09-28: Google retired
// gemini-2.5-flash/2.0-flash/1.5-flash for new-format keys ("no longer
// available to new users", 404 with a pointer to gemini-3.8-flash), which
// made EVERY AI route fail after walking the whole dead chain. Live-verified:
// 3.8-flash and 3.5-flash answer 200 (intermittently 503 capacity-shed),
// 3.1-flash-lite answers 200. 2.5-flash stays last for legacy AIza keys.

// A model that just timed out or was capacity-shed is overwhelmingly likely to
// do it again on the very next request, and the chain is walked in order — so
// without a cooldown the slowest model taxes every user request. Parking it
// briefly turns "every call is 105s" into "one call is 105s, the rest are fast".
const modelCooldownUntil = new Map<string, number>();

function noteModelFailure(model: string, missing = false) {
  modelCooldownUntil.set(model, cooldownFor(missing));
}

function selectModels() {
  return chooseModels(Date.now(), modelCooldownUntil, process.env.GEMINI_MODEL);
}

async function generateWithRetry(params: any, retries = 1, client: GoogleGenAI = aiFast) {
  const models = selectModels();

  for (const modelName of models) {
    for (let i = 0; i <= retries; i++) {
      try {
        const modelParams: any = { ...params, model: modelName };
        // 2.5+ generation models spend internal "thinking" tokens before
        // emitting — seconds per call on the scan path. 1.5/2.0 reject the
        // field, so it is attached to everything else. Callers opt in via
        // config.disableThinking (stripped here so it never reaches the API).
        if (params.config?.disableThinking) {
          modelParams.config = { ...params.config };
          delete modelParams.config.disableThinking;
          if (!/^gemini-(1\.5|2\.0)/.test(modelName)) {
            modelParams.config.thinkingConfig = { thinkingBudget: 0 };
          }
        }
        return await client.models.generateContent(modelParams);
      } catch (err: any) {
        const isFatal = err?.status === 400 || err?.status === 401 || err?.status === 403;
        if (isFatal) throw err; // Don't delay on authentication or bad request errors

        // 404 IS model-specific (retired/renamed model) and keeps its
        // fallback. 429 is project-level quota — failing fast avoids
        // repeating the failure against every model with sleeps in between.
        const isModelMissing = err?.status === 404 || err?.message?.includes("not found");
        if (isModelMissing) noteModelFailure(modelName, true);
        if (isModelMissing && modelName !== models[models.length - 1]) {
          log.warn('Model unavailable, falling back', { model: modelName, status: err?.status || 'error' });
          break;
        }
        if (err?.status === 429) throw err;

        // Capacity shedding (503 "high demand") and deadline kills (504 /
        // client abort) will not clear within a 400ms retry — fall through to
        // the next model immediately instead of burning the same one twice.
        const isCapacity = err?.status === 503 || err?.status === 504 || /aborted|deadline/i.test(String(err?.message || ''));
        if (isCapacity) {
          noteModelFailure(modelName);
          if (modelName !== models[models.length - 1]) {
            log.warn('Model saturated, falling back', { model: modelName, status: err?.status || 'error' });
            break;
          }
          if (i === retries) throw err;
        }

        if (i === retries && modelName === models[models.length - 1]) throw err;
        log.warn('Gemini attempt failed, retrying', { model: modelName, attempt: i + 1, err });
        await new Promise(r => setTimeout(r, 400 * (i + 1)));
      }
    }
  }
  throw new Error("Gemini API generateContent failed across all models");
}

// ── Scan report persistence ────────────────────────────────────────────────
// Every finished analysis is recorded in scan_reports: the account (or hashed
// guest IP), the subject kind, the triage route and the full versioned report.
// The photo itself never leaves the client — this is the finished text report
// only, which is what makes the backend the system of record for the app's
// most important output.
//
// Fire-and-forget by contract: a persistence failure must never fail or slow
// the diagnosis the Keeper is waiting for. A missing table (migration not yet
// applied) disables persistence for the process lifetime after one warning,
// the same graceful degradation guestQuotaStore uses.
let scanReportStoreDisabled = false;
async function persistScanReport(report: ScanReport, req: any): Promise<void> {
  if (!supabaseAdmin || scanReportStoreDisabled) return;
  try {
    const userId = (req?.authUserId as string | undefined) ?? null;
    // Same salted digest as the guest quota — a bare sha256 of an IPv4 address
    // is reversible by brute force over the whole address space.
    const guestHash = userId ? null : digestIp(clientIpOf(req), SUPABASE_SERVICE_KEY);
    // supabase-js resolves to { data, error } rather than throwing: without
    // this check a missing table fails silently forever (BUG-1).
    const { error: insertError } = await supabaseAdmin.from('scan_reports').insert({
      user_id: userId,
      guest_ip_hash: guestHash,
      kind: report.kind,
      route: report.route,
      report,
    });
    if (insertError) throw insertError;
    // 1%-random retention sweep, the guest_scan_quota pattern: a lazy 90-day
    // window pruned inline instead of by timer or RPC.
    if (Math.random() < 0.01) {
      const cutoff = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
      const { error: pruneError } = await supabaseAdmin.from('scan_reports').delete().lt('created_at', cutoff);
      if (pruneError) log.warn('scan_reports retention prune failed', { err: pruneError });
    }
  } catch (err: any) {
    const missing = err?.code === 'PGRST205' || err?.code === '42P01' || /does not exist/i.test(String(err?.message));
    if (missing) {
      scanReportStoreDisabled = true;
      log.warn('scan_reports table missing — report persistence disabled until the migration is applied');
      return;
    }
    log.error('Scan report persistence failed', { err });
  }
}

app.post("/api/identify", express.json({ limit: '11mb' }), aiLimiter, apiOrGuestGate, tierGate("identify"), async (req, res) => {
  try {
    const { image, location } = req.body;
    if (!image || typeof image !== 'string') {
      return fail(res, 400, "No image provided");
    }

    // Extract base64 data and mimeType — strict allowlist, no silent fallback
    const mimeMatch = image.match(/^data:(image\/(jpeg|png|webp|gif|bmp|tiff|avif));base64,/);
    if (!mimeMatch) {
      return fail(res, 400, 'Invalid image format. Supported: JPEG, PNG, WebP, GIF, BMP, TIFF, AVIF.');
    }
    const mimeType = mimeMatch[1];
    const base64Data = image.replace(/^data:image\/[a-zA-Z0-9.+]+;base64,/, '').trim();
    // ~8M base64 chars ≈ 6 MB of image data. The parser above already caps at
    // 11MB; this tighter bound keeps Gemini calls cheap.
    if (base64Data.length < 100 || base64Data.length > 8_000_000) {
      return fail(res, 413, 'Image is too large. Please upload an image under 6 MB.');
    }

    // Build location + weather context block for the prompt
    let locationBlock = "";
    if (location && typeof location === 'object') {
      const parts: string[] = [];
      const city = strLimit(location.city, 120);
      if (city) parts.push(`City/Region: ${city}`);
      const lat = Number(location.latitude);
      const lon = Number(location.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180) {
        parts.push(`Coordinates: ${lat.toFixed(3)}, ${lon.toFixed(3)}`);
      }
      if (location.weather && typeof location.weather === 'object') {
        const w = location.weather;
        const temp = Number(w.temp), hum = Number(w.humidity), wind = Number(w.windSpeed);
        const cond = strLimit(w.condition, 60);
        parts.push(`Current Weather: ${Number.isFinite(temp) ? temp : '?'}°C, ${Number.isFinite(hum) ? hum : '?'}% humidity, ${cond ?? 'unknown'}${Number.isFinite(wind) ? `, wind ${wind} km/h` : ""}`);
      }
      if (parts.length > 0) {
        locationBlock = `\n\nUSER LOCATION CONTEXT (use this to personalise ALL advice):\n${parts.join("\n")}\nTailor watering frequency, pest risk, seasonal care, climate compatibility, and all recommendations to this exact region and current weather conditions.`;
      }
    }

    const prompt = `You are PhytoDoctor AI, the world's most advanced botanical diagnostician. Perform a clinically precise analysis of the plant in this image.

BEFORE ANYTHING ELSE, triage the subject of this image:
- subjectKind: "plant" if the main subject is a plant, tree, flower, moss or other botanical specimen; "fungus" for mushrooms and moulds; "animal" for any animal; "human" for a person; "other_living" for any other living organism; "non_living" for objects, products, food, rooms, screenshots, artwork, landscapes without a clear subject, or text. If the subject genuinely cannot be determined, use "uncertain".
- subjectConfidence: your confidence in that classification, 0 to 1.
- subjectDescription: one or two sentences on what the image actually shows.
If the subject is NOT a plant, keep honest kind and species naming (e.g. commonName "Human" and scientificName "Homo sapiens" for a person, or the real animal/fungus name). For fungus, fill environmental care fields mycology-style (soil as substrate, watering as moisture/humidity, temperature, light). For human/animal/non-living, summarise what is visible honestly in diagnosis and subjectDescription without forcing plant diseases onto it. Only a confident, clearly botanical subject gets a full clinical analysis.

ALSO, judge the image's provenance (provenanceJudgment): from the visual evidence alone — rendering artefacts, uncanny texture regularity, impossible detail, studio-perfect lighting, watermark style — say whether this looks like an AI-generated image or a genuine photograph, and how confident you are. Judge only the image, not the user.

Be specific in every field; keep each field concise:
1. Identify the exact species (common name, full scientific name with authority if known).
2. Visually assess ALL visible symptoms: leaf colour, texture, lesions, spots, wilting, edge burn, yellowing pattern, stem condition, soil surface if visible, pest evidence.
3. Assign a health status (Healthy / Stressed / Diseased / Infested) and severity 1-5.
4. Write a thorough diagnosis paragraph — name the exact pathology or deficiency if detectable, not generic phrases.
5. List 3-4 differential diagnoses with realistic confidence percentages.
6. Provide a treatment timeline with 3-4 milestones.
7. Write step-by-step treatment instructions (3-5 concise, actionable steps).
8. Give precise care parameters: watering schedule, light requirements, soil type, temperature range.
9. List 3-4 specific care tips tailored to the detected condition.
10. Explain vulnerability notes — WHY this specific specimen shows these symptoms.${locationBlock}

LOCATION-AWARE FIELDS (required if location provided):
- locationAdvice: Specific advice for growing this plant in the user's exact city/region — native range, climate match, whether it's suited to grow outdoors there, seasonal adjustments.
- seasonalCare: What specific care adjustments are needed right now given the current season and weather in that region.
- localPestRisks: Which pests and diseases are most prevalent in that geographic region/climate zone that this plant owner should watch for.
- climateCompatibility: Rate and explain how well this species' native climate matches the user's current location climate.`;

    const response = await generateWithRetry({
      contents: [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: base64Data,
                mimeType: mimeType
              }
            }
          ]
        }
      ],
      config: {
        systemInstruction: "You are PhytoDoctor AI's Chief Botanical Pathologist and Regional Horticulture Specialist. You perform precise, evidence-based visual diagnoses. You always consider the user's local climate, geography, and current weather when giving care advice. Never give generic advice — always be specific to the plant specimen, its visible condition, and the user's location. Return complete, structured JSON according to the schema.",
        temperature: 0.15,
        // The schema's long-form fields (diagnosis, timeline, instructions,
        // location advice) run 1.5-3k output tokens in practice. Leaving the
        // cap at the model default let a verbose answer get cut mid-JSON,
        // which surfaced to the Keeper as "AI response was malformed" after
        // the full generation wait. Pinning a generous ceiling keeps complete
        // payloads under it; thinkingBudget is 0, so these are all answer.
        maxOutputTokens: 8192,
        // Internal marker consumed by generateWithRetry: skip 2.5 "thinking"
        // tokens so the scan result arrives as fast as possible.
        disableThinking: true,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["subject", "provenanceJudgment", "commonName", "scientificName", "confidence", "healthStatus", "severity", "diagnosis", "differentialDiagnosis", "treatmentTimeline", "treatmentInstructions", "watering", "light", "soil", "temperature", "careTips", "vulnerabilityNotes"],
          properties: {
            subject: {
              type: Type.OBJECT,
              required: ["subjectKind", "subjectConfidence", "subjectDescription"],
              description: "Triage of what the image actually shows, decided before any botanical analysis.",
              properties: {
                subjectKind: {
                  type: Type.STRING,
                  description: "One of: plant, fungus, animal, human, other_living, non_living, uncertain."
                },
                subjectConfidence: { type: Type.NUMBER, description: "Confidence in subjectKind, 0 to 1." },
                subjectDescription: { type: Type.STRING, description: "What the image actually shows, in one or two sentences." }
              }
            },
            provenanceJudgment: {
              type: Type.OBJECT,
              required: ["appearsAiGenerated", "confidence", "visualClues"],
              description: "The model's own visual judgment of whether the image is AI-generated. Independent of file metadata.",
              properties: {
                appearsAiGenerated: { type: Type.BOOLEAN },
                confidence: { type: Type.NUMBER, description: "Confidence in that judgment, 0 to 1." },
                visualClues: { type: Type.STRING, description: "The visual evidence, in one sentence." }
              }
            },
            commonName: { type: Type.STRING },
            scientificName: { type: Type.STRING },
            confidence: { type: Type.NUMBER, description: "Overall identification confidence, 0 to 1." },
            healthStatus: {
              type: Type.STRING,
              description: "Overall health rating: Healthy, Stressed, Diseased, or Infested"
            },
            severity: {
              type: Type.NUMBER,
              description: "Severity score from 1 (minor) to 5 (critical/terminal)."
            },
            diagnosis: {
              type: Type.STRING,
              description: "Detailed primary diagnosis including visible symptoms observed, root cause, and pathology name if applicable."
            },
            differentialDiagnosis: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["name", "confidence", "description"],
                properties: {
                  name: { type: Type.STRING },
                  confidence: { type: Type.NUMBER, description: "Percentage (0-100)" },
                  description: { type: Type.STRING, description: "Why this differential is considered and how to rule it in/out" }
                }
              }
            },
            treatmentTimeline: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                required: ["day", "action", "expectedOutcome"],
                properties: {
                  day: { type: Type.STRING, description: "e.g. Day 1, Day 3-5, Week 2, etc." },
                  action: { type: Type.STRING },
                  expectedOutcome: { type: Type.STRING }
                }
              }
            },
            treatmentInstructions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "Specific, numbered step-by-step treatment instructions. Minimum 5 steps."
            },
            watering: { type: Type.STRING, description: "Precise watering frequency and method for this specimen's condition" },
            light: { type: Type.STRING, description: "Specific light requirements: hours, intensity, direction" },
            soil: { type: Type.STRING, description: "Recommended soil mix, drainage requirements, pH range" },
            temperature: { type: Type.STRING, description: "Ideal temperature range, frost tolerance, and heat limits" },
            careTips: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "At least 4 actionable, specific care tips for this specimen and condition"
            },
            vulnerabilityNotes: {
              type: Type.STRING,
              description: "Detailed explanation of why this specific plant is showing these symptoms — root cause analysis."
            },
            locationAdvice: {
              type: Type.STRING,
              description: "Specific advice for cultivating this plant in the user's city/region — climate match, outdoor viability, local adjustments."
            },
            seasonalCare: {
              type: Type.STRING,
              description: "Current seasonal care adjustments based on the user's location and weather right now."
            },
            localPestRisks: {
              type: Type.STRING,
              description: "Pests and diseases most common in the user's geographic region that threaten this species."
            },
            climateCompatibility: {
              type: Type.STRING,
              description: "How well this species' native climate matches the user's local climate, with rating and explanation."
            }
          }
        }
      }
    },
    // Identify keeps the full 60s budget: the vision schema is far larger than
    // the text routes and legitimately needs more than the fast client's 25s.
    1,
    ai);

    const rawText = response.text || "";
    const cleanedText = rawText.replace(/```json|```/gi, "").trim();
    let result;
    try {
      result = JSON.parse(cleanedText);
    } catch (parseErr: any) {
      // finishReason in the log separates "hit the output cap" (MAX_TOKENS,
      // fixed by maxOutputTokens above) from a model that simply ignored the
      // JSON contract — different fixes for each.
      const finishReason = (response as any)?.candidates?.[0]?.finishReason;
      // The snippet is the model's own unparseable output, not the user's input,
  // and it is the only thing that makes this failure diagnosable. Capped.
  log.error('Model returned unparseable JSON', { finishReason: finishReason ?? 'unknown', err: parseErr.message, snippet: cleanedText.slice(0, 200) });
      throw new Error("AI response was malformed. Please try again.");
    }
    // severity drives Clinic's `isQuarantineRequired` (>= 3) and the severity
    // dots in BotanicalLab, so an off-scale value silently skips quarantine on
    // a critical finding. The differential confidences render as percentages.
    // Only clamp values that are actually present: when the model omits
    // severity, Clinic falls back to deriving a level from healthStatus, and
    // substituting a number here would suppress that fallback and report an
    // infested plant as mild.
    if (hasScore(result.severity)) {
      result.severity = clampTo(result.severity, 1, 5, 1);
    }
    if (Array.isArray(result.differentialDiagnosis)) {
      for (const d of result.differentialDiagnosis) {
        if (d && typeof d === 'object' && 'confidence' in d) {
          d.confidence = clampPercent(d.confidence);
        }
      }
    }

    // ── subject triage ──
    // The three-way split the scanner flow needs. Only a CONFIDENT non-plant
    // diverts; `uncertain` and low-confidence non-plants fall through to the
    // plant flow, because a misrouted fern is worse than an odd routing for a
    // marginal photo.
    const subject = result.subject || {};
    const rawKind = String(subject.subjectKind || subject.kind || result.subjectKind || 'uncertain').toLowerCase();
    // BUG-14: Normalise colloquials so the Set lookup always works. Models may
    // return "insect", "bird", "person", "bacteria", "mold" etc. which are not
    // in the enum but are unambiguously non-plant.
    const KIND_SYNONYMS: Record<string, string> = {
      insect: 'animal', bug: 'animal', bird: 'animal', fish: 'animal',
      mammal: 'animal', reptile: 'animal', amphibian: 'animal', invertebrate: 'animal',
      person: 'human', people: 'human', man: 'human', woman: 'human', child: 'human',
      mold: 'fungus', mould: 'fungus', mushroom: 'fungus', lichen: 'fungus',
      bacteria: 'other_living', algae: 'other_living', microorganism: 'other_living',
    };
    const kind = KIND_SYNONYMS[rawKind] ?? rawKind;
    const subjectConfidence = clampUnit(Number(subject.subjectConfidence ?? subject.confidence ?? result.subjectConfidence ?? 0));
    const subjectDescription = strLimit(subject.subjectDescription || subject.description || result.subjectDescription, 400) || '';
    const LIVING_NON_PLANT = new Set(['fungus', 'animal', 'human', 'other_living']);

    // ── provenance: checks 1 and 2 run on the raw bytes, check 3 came back in the payload ──
    const imageBuffer = Buffer.from(base64Data, 'base64');
    const signals = readImageSignals(new Uint8Array(imageBuffer));
    const rawJudgment = result.provenanceJudgment;
    const modelJudgment = rawJudgment && typeof rawJudgment === 'object' ? {
      appearsAiGenerated: Boolean(rawJudgment.appearsAiGenerated),
      confidence: clampUnit(Number(rawJudgment.confidence ?? 0)),
      visualClues: strLimit(rawJudgment.visualClues, 300) || undefined,
    } : null;
    const provenance = assessProvenance(signals, modelJudgment);
    // The full provenance block: the assessment plus the byte-forensics fields
    // it deliberately does not carry. Every route's report and the legacy
    // top-level shape share this one object.
    const provenanceFull = {
      verdict: provenance.verdict,
      checks: provenance.checks,
      reasons: provenance.reasons.slice(0, 4),
      container: signals.container,
      resolution: signals.width && signals.height ? `${signals.width}x${signals.height}` : null,
    };

    if (kind === 'non_living' && subjectConfidence >= 0.6) {
      const report = shapeScanReport({
        model: result,
        route: 'non_living',
        subject: { kind, confidence: subjectConfidence, description: subjectDescription },
        provenance: provenanceFull,
        locationProvided: Boolean(locationBlock),
        message: 'Only living specimens are analysed. PhytoDoctor AI diagnoses plants — point the lens at a plant, leaf, flower or tree and scan again.',
      });
      void persistScanReport(report, req);
      return res.json({
        report,
        // Legacy top-level shape, one transition release — every current client
        // field stays readable while the bundle catches up.
        route: 'non_living',
        subject: { kind, confidence: subjectConfidence, description: subjectDescription, subjectKind: kind },
        commonName: result.commonName || 'Inanimate Object',
        message: report.message,
      });
    }
    if (LIVING_NON_PLANT.has(kind) && subjectConfidence >= 0.45) {
      const names: Record<string, string> = {
        fungus: 'a fungus',
        animal: 'an animal',
        human: 'a person',
        other_living: 'a living thing, but not a plant',
      };
      const report = shapeScanReport({
        model: result,
        route: 'living_non_plant',
        subject: { kind, confidence: subjectConfidence, description: subjectDescription },
        provenance: provenanceFull,
        locationProvided: Boolean(locationBlock),
        message: `That looks like ${names[kind]}. PhytoDoctor AI diagnoses plants only, so there is no botanical verdict here — but the Sanctuary is always open for a plant scan.`,
      });
      void persistScanReport(report, req);
      return res.json({
        report,
        route: 'living_non_plant',
        subject: { kind, confidence: subjectConfidence, description: subjectDescription, subjectKind: kind },
        commonName: result.commonName,
        scientificName: result.scientificName,
        soil: result.soil,
        watering: result.watering,
        temperature: result.temperature,
        light: result.light,
        careTips: result.careTips,
        message: report.message,
        provenance: report.provenance,
      });
    }

    // Belt-and-braces: if the payload would fall through as 'plant' but subject.subjectKind is a known non-plant kind at >=0.45 confidence, divert anyway.
    // Shaped through the same function as the primary branch, so the payload is
    // no longer a smaller cousin of it — provenance and mycology ride along.
    const fallbackKind = String(result.subject?.subjectKind || result.subject?.kind || result.subjectKind || kind).toLowerCase();
    const fallbackConf = clampUnit(Number(result.subject?.subjectConfidence ?? result.subject?.confidence ?? subjectConfidence));
    if ((LIVING_NON_PLANT.has(fallbackKind) && fallbackConf >= 0.45) || (fallbackKind === 'non_living' && fallbackConf >= 0.6)) {
      const route = fallbackKind === 'non_living' ? 'non_living' as const : 'living_non_plant' as const;
      const report = shapeScanReport({
        model: result,
        route,
        subject: { kind: fallbackKind, confidence: fallbackConf, description: subjectDescription },
        provenance: provenanceFull,
        locationProvided: Boolean(locationBlock),
        message: 'Non-plant subject diverted. PhytoDoctor AI diagnoses plants only.',
      });
      void persistScanReport(report, req);
      return res.json({
        report,
        route,
        subject: { kind: fallbackKind, confidence: fallbackConf, description: subjectDescription, subjectKind: fallbackKind },
        commonName: result.commonName,
        scientificName: result.scientificName,
        message: report.message,
        provenance: report.provenance,
      });
    }

    // Plain plant flow: provenance rides along so the client can gate the seed
    // reward without blocking the diagnosis.
    result.route = 'plant';
    result.provenance = provenanceFull;
    const report = shapeScanReport({
      model: result,
      route: 'plant',
      subject: { kind, confidence: subjectConfidence, description: subjectDescription },
      provenance: provenanceFull,
      locationProvided: Boolean(locationBlock),
    });
    void persistScanReport(report, req);
    // report last: a stray `report` key in the raw model payload must never
    // overwrite the server-shaped one.
    res.json({ ...result, report });
  } catch (error: any) {
    log.error('Gemini request failed', { status: error?.response?.status || error?.status, err: error });
    fail(res, 500, AI_GENERIC_ERROR);
  }
});

app.post("/api/sandbox", express.json({ limit: '64kb' }), aiLimiter, apiGate, tierGate("assess"), async (req, res) => {
  try {
    const { mode, species, environment } = req.body;
    if (!isValidSpecies(species)) {
      return fail(res, 400, "Please enter a valid plant species name (2–80 characters, letters and basic punctuation).");
    }

    if (mode === "profile") {
      const response = await generateWithRetry({
        contents: [{
          role: "user",
          parts: [{ text: `Create a horticultural dossier for the plant species "${species.trim()}". If the name is ambiguous, pick the most commonly cultivated interpretation. Be specific and evidence-based. If the requested name is not a real, existing plant species (fictional, invented, misspelled beyond recognition, or non-botanical), set isRealSpecies to false and fill the remaining fields with your best-effort interpretation marked as such.` }]
        }],
        config: {
          systemInstruction: "You are PhytoDoctor AI's horticultural physiologist. Return only JSON matching the schema. Ideal ranges must be realistic for that species. Never invent a plant that does not exist — flag fictional or non-botanical names via isRealSpecies=false.",
          temperature: 0.2,
          disableThinking: true, // a Keeper is waiting on this dossier; skip 2.5 thinking tokens
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            required: ["isRealSpecies", "commonName", "scientificName", "overview", "origin", "hardinessZones", "idealTempMin", "idealTempMax", "idealHumidityMin", "idealHumidityMax", "light", "soil", "soilPh", "watering", "photoperiodHours", "nativeClimate", "pests"],
            properties: {
              isRealSpecies: { type: Type.BOOLEAN, description: "True only if this is a real, existing plant species. False for fictional, invented, or non-botanical names." },
              commonName: { type: Type.STRING },
              scientificName: { type: Type.STRING },
              overview: { type: Type.STRING },
              origin: { type: Type.STRING },
              hardinessZones: { type: Type.STRING },
              idealTempMin: { type: Type.NUMBER },
              idealTempMax: { type: Type.NUMBER },
              idealHumidityMin: { type: Type.NUMBER },
              idealHumidityMax: { type: Type.NUMBER },
              light: { type: Type.STRING },
              soil: { type: Type.STRING },
              soilPh: { type: Type.STRING },
              watering: { type: Type.STRING },
              photoperiodHours: { type: Type.NUMBER },
              nativeClimate: { type: Type.STRING },
              pests: { type: Type.STRING }
            }
          }
        }
      });
      const raw = (response.text || "").replace(/```json|```/gi, "").trim();
      const result = JSON.parse(raw);
      if (result.isRealSpecies === false) {
        return fail(res, 422, `"${species.trim()}" does not appear to be a real plant species. Please check the spelling or try a known species (e.g. Monstera deliciosa).`);
      }
      delete result.isRealSpecies;
      // The client ranges against each bound independently, so an inverted
      // pair (min above max) charges the penalty twice for one condition.
      [result.idealTempMin, result.idealTempMax] = orderRange(result.idealTempMin, result.idealTempMax);
      [result.idealHumidityMin, result.idealHumidityMax] = orderRange(result.idealHumidityMin, result.idealHumidityMax);
      return res.json(result);
    }

    if (mode === "assess") {
      if (!environment || typeof environment !== 'object') return fail(res, 400, "Environment is required");
      if (JSON.stringify(environment).length > 8000) return fail(res, 400, "Environment payload is too large.");
      const response = await generateWithRetry({
        contents: [{
          role: "user",
          parts: [{ text: `Assess whether "${species.trim()}" can survive and thrive in this placement.

SITE:
${JSON.stringify(environment, null, 2)}

Score climate, water, light, soil, pest exposure and seasonal timing independently on a 0-100 suitability scale, where 100 always means "ideal for this plant" and 0 always means "unfavourable for this plant". Every score uses that one direction, including pestScore: score how SAFE the site is from pests, so a site with heavy pest pressure scores LOW, never high. Survival chance is the overall likelihood the plant lives 12 months in these conditions with reasonable amateur care. Give concrete tips and ranked risks.` }]
        }],
        config: {
          systemInstruction: "You are PhytoDoctor AI running a clinical placement simulation. Be honest: hostile climates should score low. Every 0-100 score is suitability for the plant, so higher is always better and pestScore in particular scores pest SAFETY, not pest pressure. Return only JSON.",
          temperature: 0.2,
          disableThinking: true, // vault assessments are wait-facing; skip 2.5 thinking tokens
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            required: ["survivalChance", "verdict", "climateScore", "waterScore", "lightScore", "soilScore", "pestScore", "seasonalScore", "summary", "tips", "risks", "protocol"],
            properties: {
              survivalChance: { type: Type.NUMBER },
              verdict: { type: Type.STRING },
              climateScore: { type: Type.NUMBER },
              waterScore: { type: Type.NUMBER },
              lightScore: { type: Type.NUMBER },
              soilScore: { type: Type.NUMBER },
              pestScore: { type: Type.NUMBER, description: "Higher is safer (lower pest pressure for this species)" },
              seasonalScore: { type: Type.NUMBER },
              summary: { type: Type.STRING },
              tips: { type: Type.ARRAY, items: { type: Type.STRING } },
              risks: { type: Type.ARRAY, items: { type: Type.STRING } },
              protocol: { type: Type.STRING }
            }
          }
        }
      });
      const raw = (response.text || "").replace(/```json|```/gi, "").trim();
      const result = JSON.parse(raw);
      // These render as A-F grades and 0-100% bars, and the response schema
      // declares them as bare numbers, so the model can overshoot its own
      // scale. Clamp before anything downstream reads them.
      for (const key of [
        'survivalChance',
        'climateScore',
        'waterScore',
        'lightScore',
        'soilScore',
        'pestScore',
        'seasonalScore',
      ]) {
        if (hasScore(result[key])) result[key] = clampPercent(result[key]);
      }
      return res.json(result);
    }

    return fail(res, 400, "mode must be profile or assess");
  } catch (error: any) {
    log.error('Sandbox request failed', { status: error?.response?.status || error?.status, err: error });
    fail(res, 500, AI_GENERIC_ERROR);
  }
});

app.post("/api/chat", express.json({ limit: '64kb' }), aiLimiter, apiGate, async (req, res) => {
  let requestedMessages: Array<{ role?: string; content?: string }> = [];
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return fail(res, 400, "Messages are required");
    }
    requestedMessages = messages;
    if (messages.length > 40) {
      return fail(res, 400, "Conversation is too long. Please start a new chat.");
    }
    for (const m of messages) {
      if (!m || typeof m.content !== 'string' || m.content.trim().length === 0) {
        return fail(res, 400, "Invalid message content.");
      }
    }

    const systemPrompt = `You are PhytoDoctor AI's Chief Master Botanist and world-renowned Plant Pathologist.

CORE BOTANICAL PERSONA:
You possess encyclopedic, evidence-based mastery over botany, plant physiology, horticulture, soil microbiology, organic pest management, and phytopathology. Your tone is warm, authoritative, deeply knowledgeable, and reassuring.

CRITICAL GUARDRAILS:
- You ONLY answer questions related to plants, gardening, botany, indoor flora, agriculture, soil chemistry, pests, plant diseases, fertilizers, and horticulture.
- If a user asks about any non-plant or non-botanical topics (such as general knowledge, coding, politics, math, entertainment, sports, non-botanical personal advice), POLITELY and FIRMLY deflect back to botany:
  "I am exclusively dedicated to botanical sciences and plant care. Let's redirect our focus to your flora—what plant species or gardening questions can I help you with today?"

RESPONSE FORMAT & PACING (SHORT STANZAS):
- Deliver your guidance in prompt, concise, structured short stanzas (short paragraphs of 2-3 sentences each).
- Use clear bullet points and bold key parameters (e.g., **Lighting**, **Watering Schedule**, **Treatment**).
- Avoid long rambling essays; keep it crisp, insightful, and immediately actionable so the user can easily digest and apply the advice.`;

    // Older turns are clamped rather than rejected. A single oversized message
    // used to fail the whole batch, which meant one long paste (or one runaway
    // generation) locked the user out of the assistant permanently — every
    // later send replayed that message and hit the same 400. Only the live
    // message needs a hard ceiling; history is trimmed from the front so the
    // most recent context survives.
    const MAX_TURN_CHARS = 4000;
    const clamp = (text: string, limit: number) =>
      text.length > limit ? text.slice(text.length - limit) : text;

    let formattedContents = messages
      .filter(m => m && typeof m.content === 'string' && m.content.trim().length > 0)
      .slice(-20) // cap: keep only last 20 messages to prevent cost abuse
      .map((m, i, arr) => {
        const isLatestUserTurn = m.role === 'user' && i === arr.length - 1;
        const text = isLatestUserTurn ? m.content.slice(0, MAX_TURN_CHARS) : clamp(m.content, MAX_TURN_CHARS);
        return {
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text }]
        };
      });

    // Gemini multi-turn conversation requires the first turn to be from 'user'
    while (formattedContents.length > 0 && formattedContents[0].role === 'model') {
      formattedContents.shift();
    }

    if (formattedContents.length === 0) {
      return fail(res, 400, "At least one user message is required");
    }

    const response = await generateWithRetry({
      contents: formattedContents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.3,
        // Care advice is retrieval-and-format work, not multi-step reasoning:
        // thinking tokens buy nothing here and cost seconds on every message.
        // Measured 15-35s per reply before this, most of it spent thinking.
        // The scan path already opts out for the same reason.
        disableThinking: true,
      }
    });

    res.json({ content: response.text, degraded: false });
  } catch (error: any) {
    log.error('Chat request failed', { status: error?.response?.status || error?.status, err: error });
    const latestUserMessage = [...requestedMessages].reverse().find(m => m?.role === 'user')?.content;
    // The local reply is a genuine safety net for a downed model, but it
    // returns 200 like a real answer, which makes an outage indistinguishable
    // from a healthy response. That is how a crash in this handler hid behind
    // a 40x speedup that turned out to be the fallback, not the model. The
    // flag lets callers and monitoring tell the two apart.
    if (latestUserMessage) {
      return res.json({ content: localBotanicalReply(latestUserMessage), degraded: true });
    }
    fail(res, 500, AI_GENERIC_ERROR);
  }
});

app.post("/api/guardian/predict", express.json({ limit: '64kb' }), aiLimiter, apiGate, async (req, res) => {
  try {
    const { species, checkins, sensorData, weather } = req.body;
    if (!isValidSpecies(species)) {
      return fail(res, 400, "Please provide a valid plant species name.");
    }
    if (JSON.stringify({ checkins, sensorData, weather }).length > 20_000) {
      return fail(res, 400, "Check-in history payload is too large.");
    }

    const prompt = `Based on the following data for a ${species}, predict potential health stressors in the next 14 days. 
    Check-in history: ${JSON.stringify(checkins)}
    Sensor trajectory: ${JSON.stringify(sensorData)}
    Local weather forecast: ${JSON.stringify(weather)}
    
    Return a structured JSON report with a risk score (0-100), primary stressor, confidence, and a brief evidence-based reasoning.
    Address specific biological vulnerabilities of this species.`;

    const response = await generateWithRetry({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["riskScore", "primaryStressor", "confidence", "reasoning", "protocolRecommendation"],
          properties: {
            riskScore: { type: Type.NUMBER },
            primaryStressor: { 
              type: Type.STRING,
              enum: ["Light", "Water", "Humidity", "Temperature", "Nutrition", "Unknown"]
            },
            confidence: { type: Type.NUMBER, description: "0-1" },
            reasoning: { type: Type.STRING },
            protocolRecommendation: { type: Type.STRING }
          }
        }
      }
    });

    const rawText = response.text || "";
    const cleanedText = rawText.replace(/```json|```/gi, "").trim();
    const result = JSON.parse(cleanedText);
    // The client picks alert severity by thresholding riskScore (>= 75 is
    // critical) and renders confidence as `* 100`, so an out-of-scale number
    // misclassifies the alert instead of merely looking wrong.
    if ('riskScore' in result) result.riskScore = clampPercent(result.riskScore);
    if ('confidence' in result) result.confidence = clampUnit(result.confidence);
    res.json(result);
  } catch (error: any) {
    log.error('Prediction request failed', { status: error?.response?.status || error?.status, err: error });
    fail(res, 500, AI_GENERIC_ERROR);
  }
});

// ── Economy & billing endpoints (Supabase-mode only) ───────────────────────
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || '';
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

// GET own authoritative profile (seeds + tier). Client mirrors this into Dexie.
app.get("/api/economy/profile", apiGate, async (req, res) => {
  try {
    const userId = (req as any).authUserId;
    const client = userClient((req as any).authToken);
    if (!SUPABASE_URL || !SUPABASE_KEY) return res.json({ seeds: 500, tier: 'free' }); // local mode
    if (!userId || !client || !supabaseAdmin) return fail(res, 503, "Economy service is temporarily unavailable.");
    const { data, error } = await client
      .from('profiles').select('seeds, tier, pro_expires_at, current_streak, longest_streak, total_xp, collection_size').eq('user_id', userId).single();
    if (error && error.code !== 'PGRST116') {
      log.error('economy/profile read failed', { err: error.message });
      return fail(res, 503, "Your profile is temporarily unavailable. Please try again.");
    }
    if (!data) {
      // First sign-in on a new device: bootstrap the row.
      if (supabaseAdmin) {
        const { data: created, error: createError } = await supabaseAdmin
          .from('profiles')
          .insert({ user_id: userId, seeds: 500, tier: 'free' })
          .select()
          .single();
        if (createError?.code === '23505') {
          const { data: existing, error: existingError } = await supabaseAdmin
            .from('profiles')
            .select('seeds, tier, pro_expires_at, current_streak, longest_streak, total_xp, collection_size')
            .eq('user_id', userId)
            .single();
          if (!existingError && existing) return res.json(existing);
        }
        if (createError || !created) {
          log.error('economy/profile bootstrap failed', { err: createError?.message || 'profile was not created' });
          return fail(res, 503, "Your profile is temporarily unavailable. Please try again.");
        }
        return res.json(created);
      }
      return res.json({ seeds: 500, tier: 'free' });
    }
    res.json(data);
  } catch (err: any) {
    log.error('economy/profile failed', { err });
    fail(res, 500, "Could not load your profile.");
  }
});

// POST seed delta from the client (dual-write after local Dexie updates).
// SEC-01 Architecture Rationale:
// 1. Offline-First: Client records actions locally (IndexedDB) and syncs via outbox.
// 2. Idempotency & Replay: Strict RFC 4122 UUID transactionId verified here; PostgreSQL RPC
//    'increment_seeds' enforces 'ON CONFLICT (id) DO NOTHING' on seed_transactions table.
// 3. Atomic Balance Integrity: Database enforces 'seeds + p_amount >= 0' and table
//    check constraint. No pre-check in Express is needed, which avoids TOCTOU race
//    conditions and redundant database round-trips.
// 4. Column Privileges: Direct 'profiles.seeds' updates are REVOKED from authenticated role.
// 5. Pro tier escalation is handled server-side via atomic RPC with row locks ('FOR UPDATE').
app.post("/api/economy/seed-sync", express.json({ limit: '16kb' }), apiGate, async (req, res) => {
  try {
    const userId = (req as any).authUserId;
    if (!SUPABASE_URL || !SUPABASE_KEY) return res.json({ ok: true, synced: false }); // local mode
    if (!userId || !supabaseAdmin) return fail(res, 503, "Economy service is temporarily unavailable.");
    const { delta, source, description, transactionId } = req.body || {};
    const d = Math.trunc(Number(delta));
    if (!Number.isFinite(d) || d === 0 || Math.abs(d) > 10000) return fail(res, 400, "Invalid seed delta.");
    if (!['checkin', 'bonus', 'spend', 'reward'].includes(String(source))) {
      return fail(res, 400, "Invalid seed source.");
    }
    if (!transactionId || typeof transactionId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(transactionId)) {
      return fail(res, 400, "Missing or invalid transactionId.");
    }
    // Deliberately supabaseAdmin, not userClient(authToken). The RPC was
    // granted to `authenticated`, which left a second door into the economy: a
    // signed-in user could call PostgREST directly with their own JWT and mint
    // seeds without ever passing through this route or its validation. That
    // grant is revoked in sql/economy_service_role_only.sql, making this the
    // only way in. userId comes from the verified JWT via apiGate, never the
    // body, and increment_seeds re-checks it against auth.uid().
    const { data: next, error } = await supabaseAdmin.rpc('increment_seeds', {
      p_user_id: userId,
      p_amount: d,
      p_source: String(source || 'bonus').slice(0, 40),
      p_description: String(description || '').slice(0, 200),
      p_transaction_id: transactionId
    });
    if (error) {
      const message = String(error.message || '');
      // Permanent failures get 4xx so the client outbox drops them instead of
      // retrying forever; anything else stays a retryable 500.
      // The daily ceiling is deliberately 429, NOT 422: 422 is permanent and
      // the outbox would DROP the entry — a big-but-legitimate grant (a
      // discovery bonus landing on a day that already earned 150) would be
      // silently lost. 429 keeps the entry pending, the flush retries, and the
      // grant lands the next day when the counter resets.
      if (message === 'daily seed credit limit') {
        return fail(res, 429, "Daily seed earning limit reached. Your reward will arrive tomorrow.");
      }
      if (message === 'insufficient seeds') {
        return fail(res, 402, "Insufficient seeds.");
      }
      log.error('seed-sync rpc failed', { err: message });
      return fail(res, 500, "Could not sync seeds.");
    }
    res.json({ seeds: next });
  } catch (err: any) {
    log.error('seed-sync failed', { err });
    fail(res, 500, "Could not sync seeds.");
  }
});

// POST a product request to the market's community board. Players ask for
// real-world plant/garden items they want stocked; the owner refreshes the
// stalls daily and stocks what is asked for. RLS on product_requests lets any
// signed-in Keeper read the board, so counts feel shared; the write goes
// through here so the per-user daily limit is enforced server-side.
app.post("/api/market/request", express.json({ limit: '4kb' }), apiGate, async (req, res) => {
  try {
    const userId = (req as any).authUserId;
    if (!userId || !supabaseAdmin) return fail(res, 503, "Market service is temporarily unavailable.");

    const productName = strLimit(req.body?.productName, 120)?.trim() || '';
    const details = strLimit(req.body?.details, 500)?.trim() || '';
    const category = String(req.body?.category || 'other');
    if (productName.length < 3) return fail(res, 400, "Tell us what to stock (at least 3 characters).");
    if (!['pots', 'care', 'tools', 'seeds', 'home', 'books', 'other'].includes(category)) {
      return fail(res, 400, "Unknown category.");
    }

    // 3 requests per Keeper per day — a wishlist, not a shoutbox.
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { count, error: countErr } = await supabaseAdmin
      .from('product_requests')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', since);
    if (countErr) {
      log.error('market request count failed', { err: countErr.message });
      return fail(res, 500, "Could not record your request.");
    }
    if ((count ?? 0) >= 3) {
      return fail(res, 429, "You've asked for plenty today — the bazaar needs time. Try again tomorrow.");
    }

    const { data, error } = await supabaseAdmin
      .from('product_requests')
      .insert({ user_id: userId, product_name: productName, category, details: details || null })
      .select('id, product_name, category, details, created_at')
      .single();
    if (error) {
      log.error('market request insert failed', { err: error.message });
      return fail(res, 500, "Could not record your request.");
    }
    res.json({ ok: true, request: data });
  } catch (err: any) {
    log.error('market request failed', { err });
    fail(res, 500, "Could not record your request.");
  }
});

// GET recent requests for the community board.
app.get("/api/market/requests", apiGate, async (req, res) => {
  try {
    if (!supabaseAdmin) return fail(res, 503, "Market service is temporarily unavailable.");
    const { data, error } = await supabaseAdmin
      .from('product_requests')
      .select('id, product_name, category, details, created_at, user_id')
      .order('created_at', { ascending: false })
      .limit(30);
    if (error) {
      log.error('market requests list failed', { err: error.message });
      return fail(res, 500, "Could not load the request board.");
    }
    res.json({ requests: data ?? [] });
  } catch (err: any) {
    log.error('market requests list failed', { err });
    fail(res, 500, "Could not load the request board.");
  }
});

// ── Market ledger: cross-device sync of purchased state ────────────────────
//
// The client's marketLedger row (punched tickets, claimed seed-refund codes,
// basket, wishlist) is bought with seeds and used to be device-local. The
// client reconciles: pull on visit, push after each change, last-writer-wins
// on the row's own updatedAt. The server is a dumb, per-user mirror — it
// never merges, because the resolution belongs where the clocks are.
app.get("/api/market/ledger", apiGate, async (req, res) => {
  try {
    const userId = (req as any).authUserId;
    if (!userId || !supabaseAdmin) return fail(res, 503, "Market service is temporarily unavailable.");
    const { data, error } = await supabaseAdmin
      .from('market_ledger')
      .select('data')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) {
      log.error('market ledger read failed', { err: error.message });
      return fail(res, 500, "Could not load your market ledger.");
    }
    res.json({ ledger: data?.data ?? null });
  } catch (err: any) {
    log.error('market ledger read failed', { err });
    fail(res, 500, "Could not load your market ledger.");
  }
});

app.post("/api/market/ledger", express.json({ limit: '64kb' }), apiGate, async (req, res) => {
  try {
    const userId = (req as any).authUserId;
    if (!userId || !supabaseAdmin) return fail(res, 503, "Market service is temporarily unavailable.");
    const ledger = req.body?.ledger;
    const updatedAt = req.body?.updatedAt;
    if (typeof ledger !== 'object' || ledger === null || Array.isArray(ledger)) {
      return fail(res, 400, "Malformed ledger.");
    }
    const fields = ['refunds', 'claimedItemIds', 'tickets', 'wishlist', 'cart'];
    if (!fields.every((f) => Array.isArray(ledger[f]))) {
      return fail(res, 400, "Malformed ledger.");
    }
    if (typeof updatedAt !== 'number' || !Number.isFinite(updatedAt)) {
      return fail(res, 400, "Malformed ledger timestamp.");
    }
    const { error } = await supabaseAdmin
      .from('market_ledger')
      .upsert({ user_id: userId, data: { ...ledger, updatedAt }, updated_at: new Date().toISOString() }, {
        onConflict: 'user_id'
      });
    if (error) {
      log.error('market ledger write failed', { err: error.message });
      return fail(res, 500, "Could not save your market ledger.");
    }
    res.json({ ok: true });
  } catch (err: any) {
    log.error('market ledger write failed', { err });
    fail(res, 500, "Could not save your market ledger.");
  }
});

// POST purchase Pro with seeds — server verifies the balance; the client is
// not trusted. Tier write goes through the service role.
app.post("/api/billing/purchase-with-seeds", express.json({ limit: '8kb' }), apiGate, async (req, res) => {
  try {
    if (!supabaseAdmin) return fail(res, 501, "Billing requires Supabase configuration.");
    const userId = (req as any).authUserId;
    if (!userId) return fail(res, 401, "Sign in before purchasing Pro.");
    const { data, error } = await supabaseAdmin.rpc('purchase_pro_with_seeds', {
      p_user_id: userId,
      p_cost: PRO_COST_SEEDS
    });
    if (error) {
      const message = String(error.message || '');
      if (message.includes('already pro')) return fail(res, 409, "You are already a Pro member.");
      // The RPC raises 'insufficient seeds' with no balance payload, so the
      // exact shortfall cannot be computed here.
      if (message.includes('insufficient')) return fail(res, 402, "Insufficient seeds.");
      log.error('purchase rpc failed', { err: message });
      return fail(res, 500, "Purchase failed. Please try again.");
    }
    res.json(data);
  } catch (err: any) {
    log.error('purchase-with-seeds failed', { err });
    fail(res, 500, "Purchase failed. Please try again.");
  }
});

// POST create a Razorpay order for the real-money Pro fast-pass.
app.post("/api/billing/create-order", express.json({ limit: '8kb' }), aiLimiter, apiGate, async (req, res) => {
  try {
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) return fail(res, 501, "Payments are not configured yet.");
    const userId = (req as any).authUserId;
    if (!userId) return fail(res, 401, "Sign in before starting a payment.");
    const auth = Buffer.from(`${RAZORPAY_KEY_ID}:${RAZORPAY_KEY_SECRET}`).toString('base64');
    const resp = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${auth}` },
      body: JSON.stringify({
        amount: PRO_PRICE_PAISE,
        currency: 'INR',
        receipt: `pro_${userId.slice(0, 8)}_${Date.now()}`,
        notes: { userId, plan: 'pro_monthly' }
      })
    });
    const order = await resp.json();
    if (!resp.ok) {
      log.error('Razorpay order failed', { err: order });
      return fail(res, 502, "Could not start the payment. Please try again.");
    }
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: RAZORPAY_KEY_ID });
  } catch (err: any) {
    log.error('create-order failed', { err });
    fail(res, 500, "Could not start the payment.");
  }
});

// POST Razorpay webhook — raw body + HMAC signature verification. This is the
// only place real money turns into Pro tier, and it never trusts the client.
app.post("/api/billing/webhook", express.raw({ type: 'application/json', limit: '256kb' }), async (req, res) => {
  try {
    if (!RAZORPAY_WEBHOOK_SECRET) return fail(res, 501, "Webhooks not configured.");
    if (!supabaseAdmin) return fail(res, 501, "Supabase not configured.");
    const raw = (req as any).body as Buffer;
    const signature = req.headers['x-razorpay-signature'] as string | undefined;
    if (!signature) return fail(res, 400, "Missing signature.");
    const expected = createHmac('sha256', RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
    const a = Buffer.from(expected), b = Buffer.from(signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      log.warn('Webhook signature mismatch');
      return fail(res, 401, "Invalid signature.");
    }
    const event = JSON.parse(raw.toString('utf8'));
    const type = event?.event;
    const payment = event?.payload?.payment?.entity;
    const userId: string | undefined = payment?.notes?.userId;
    const paymentId = typeof payment?.id === 'string' ? payment.id : '';
    const validUserId = typeof userId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId);
    if (type === 'payment.captured' || type === 'order.paid') {
      if (!validUserId || !paymentId) {
        return fail(res, 400, "Payment identity is invalid.");
      }
      if (payment.amount !== PRO_PRICE_PAISE || payment.currency !== 'INR') {
        return fail(res, 400, "Payment details do not match the Pro plan.");
      }
      const result = await grantPro(userId, paymentId, payment.amount, payment.currency);
      if (result?.duplicate) return res.json({ ok: true, duplicate: true });
      log.info('Pro granted via Razorpay', { userId, paymentId });
    }
    res.json({ ok: true });
  } catch (err: any) {
    log.error('webhook failed', { err });
    fail(res, 500, "Webhook processing failed.");
  }
});

// ── Centralized Error Handler (SEC-05) ─────────────────────────────────────
// Intercept JSON parse errors and unexpected exceptions to prevent stack traces
// and internal file paths from leaking to the client in error responses.
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON payload.' });
  }
  // body-parser rejects a payload over the route's `limit` with a
  // PayloadTooLargeError carrying `type: 'entity.too.large'`. It is not a
  // SyntaxError, so without this it fell through to the generic 500 below and
  // the player saw "Internal server error" for what is really their own
  // paste being too long.
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: "That request was too large. Please shorten it and try again." });
  }
  if (res.headersSent) {
    return next(err);
  }
  log.error('Unhandled request error', { err, requestId: currentRequestId() });
  res.status(500).json({ error: 'Internal server error.' });
});

async function startServer() {
  if (process.env.NODE_ENV === "production") {
    const missing = [
      !SUPABASE_URL && 'SUPABASE_URL',
      !SUPABASE_KEY && 'SUPABASE_ANON_KEY',
      !SUPABASE_SERVICE_KEY && 'SUPABASE_SERVICE_KEY',
    ].filter(Boolean);
    if (missing.length > 0) {
      throw new Error(`Missing required production configuration: ${missing.join(', ')}`);
    }
    if (!process.env.GEMINI_API_KEY) {
      log.warn('GEMINI_API_KEY is not configured; AI requests will use fallback behavior.');
    }
    if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET || !RAZORPAY_WEBHOOK_SECRET) {
      log.warn('Razorpay is not fully configured; paid Pro checkout is disabled.');
    }
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Only real navigations get the SPA shell. A miss for an actual file 404s
    // honestly, and a miss under /api answers in JSON -- `app.get('*')` served
    // index.html with a 200 for all three, which meant /robots.txt returned
    // HTML and a stale asset name failed as "Unexpected token '<'".
    app.use((req, res) => {
      const decision = classifyStaticRequest(req.path, req.method);
      if (decision === 'api-not-found') {
        return fail(res, 404, 'Unknown endpoint.');
      }
      if (decision === 'not-found') {
        return res.status(404).type('text/plain').send('Not found');
      }
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  if (supabaseAdminPromise) {
    try {
      await Promise.race([
        supabaseAdminPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 7000))
      ]);
    } catch (err) {
      log.warn('Supabase admin init timed out or failed, continuing boot');
    }
  }

  // Pick the guest quota backing store once the admin client is up. Runs
  // before listen() so the very first guest request already hits the right
  // store rather than the placeholder.
  guestQuota = await createGuestQuotaStore({
    supabase: supabaseAdmin,
    limit: GUEST_IDENTIFY_LIMIT,
    salt: SUPABASE_SERVICE_KEY,
    log: (message) => log.info(message),
  });

  scheduleWateringReminders();

  app.listen(PORT, "0.0.0.0", () => {
    log.info('Server listening', { url: `http://localhost:${PORT}` });
  });
}

startServer();
