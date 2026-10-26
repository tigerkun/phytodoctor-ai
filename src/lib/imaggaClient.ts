/**
 * IMAGGA AUTO-TAGGING CLIENT
 *
 * An independent, non-generative pair of eyes on every upload. Imagga's
 * auto-tagging service (https://imagga.com) classifies images against a huge
 * general vocabulary and returns tags with confidences. PhytoDoctor uses it
 * for two things inside /api/identify:
 *
 *   1. Pre-screen  -- before spending a Gemini vision call, the tags answer a
 *      cheap question: does this image even contain a plant? Strong object /
 *      screenshot / food evidence with NO botanical tags short-circuits the
 *      scan with the standard non-living report.
 *   2. Enrichment  -- for real scans, the top tags ride along in the prompt as
 *      auxiliary evidence, grounding the model's triage in a second opinion.
 *
 * THE FAIL-SAFE. Imagga is evidence, never a gatekeeper of honest scans:
 *   - The pre-screen only diverts when botanical evidence is essentially
 *     absent AND object evidence is overwhelming -- the same conservative
 *     bias the Gemini triage uses (a misrouted fern is worse than an odd
 *     routing for a marginal photo).
 *   - Any error, timeout or exhausted quota degrades to today's behaviour:
 *     the scan proceeds Gemini-only. A dead Imagga never blocks a scan.
 *
 * QUOTA. The HACKER plan is 100 requests/month. The client counts its own
 * calls in-memory and, on a quota-rejection response, trips a circuit breaker
 * that disables the service for the life of the process. Consecutive
 * transport failures trip the same breaker, so a network outage cannot turn
 * every scan into a 10-second stall.
 *
 * Server-only by convention: credentials come from process.env and must never
 * reach the client bundle.
 */

const IMAGGA_BASE = 'https://api.imagga.com';

export interface ImaggaTag {
  /** The English tag text, lowercased by Imagga. */
  name: string;
  /** 0-100. */
  confidence: number;
}

export interface ImaggaAssessment {
  tags: ImaggaTag[];
  /** Highest botanical-tag confidence (0 when none matched), 0-100. */
  plantMax: number;
  /** Highest strong-object-tag confidence (0 when none matched), 0-100. */
  objectMax: number;
  /** True when the tags clear the bar for short-circuiting as non_living. */
  isClearlyNonPlant: boolean;
  /** Tags above the enrichment threshold, formatted "tag (95.2)" for the prompt. */
  evidence: string;
}

/** Botanical vocabulary Imagga actually emits for plant photos. */
const PLANT_TERMS = new Set([
  'plant', 'plants', 'leaf', 'leaves', 'leafy', 'foliage', 'flower', 'flowers',
  'flowering', 'blossom', 'bloom', 'blooming', 'blossoms', 'buds', 'petal', 'petals',
  'tree', 'trees', 'shrub', 'bush', 'houseplant', 'potted plant', 'pot plant',
  'garden', 'gardening', 'grass', 'fern', 'cactus', 'succulent', 'moss', 'herb',
  'herbs', 'orchid', 'rose', 'tulip', 'branch', 'branches', 'trunk', 'stem',
  'stems', 'botanical', 'botany', 'flora', 'floral', 'greenery', 'house plants',
  'house plant', 'vegetation', 'vine', 'vines', 'palm', 'bamboo', 'root', 'roots',
  'sprout', 'seedling', 'houseplant care', 'planter', 'planters', 'flowerpot',
  'flower pot', 'vase with flowers', 'potted flowers', 'botanical garden', 'green',
  'bonsai', 'crop', 'crops', 'seed', 'seeds', 'evergreen', 'deciduous', 'horticulture',
]);

/**
 * Strong non-plant evidence. Deliberately narrow: only terms that are
 * overwhelming on their own. Ambiguous companions of plant photos ("pot",
 * "table", "indoor", "vase") are excluded -- a monstera on a coffee table
 * tags half a furniture vocabulary around it.
 */
const OBJECT_TERMS = new Set([
  'person', 'people', 'woman', 'man', 'girl', 'boy', 'face', 'portrait', 'human',
  'car', 'vehicle', 'road', 'street', 'city', 'skyline', 'sky', 'sunset', 'sunrise',
  'food', 'dish', 'meal', 'restaurant', 'plate', 'coffee', 'dessert', 'cake',
  'pizza', 'burger', 'sandwich', 'snack', 'tableware',
  'screenshot', 'computer', 'laptop', 'monitor', 'keyboard', 'phone', 'smartphone',
  'text', 'document', 'paper', 'chart', 'graph', 'website', 'ui', 'typing',
  'building', 'architecture', 'room', 'interior', 'bedroom', 'kitchen',
  'bridge', 'mountain', 'landscape', 'beach', 'ocean', 'snow', 'musical instrument',
  'guitar', 'piano', 'book', 'clock', 'lamp', 'chair', 'sofa', 'electronics',
]);

/** Tags at or above this confidence count as evidence in both directions. */
const EVIDENCE_THRESHOLD = 30;
/** Botanical evidence this weak means Imagga saw no plant. */
const PLANT_ABSENT_THRESHOLD = 30;
/** Object evidence at least this strong, with no plant above, diverts the scan. */
const OBJECT_DIVERT_THRESHOLD = 70;

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_CONSECUTIVE_FAILURES = 3;
/** HACKER plan: 100 requests per billing month. */
const FREE_PLAN_REQUEST_LIMIT = 100;

// ── Circuit breaker + quota state (process-lifetime) ───────────────────────
let requestsUsed = 0;
let consecutiveFailures = 0;
let disabledReason: string | null = null;

/** Reset in-process quota & circuit breaker state (for test isolation). */
export function _resetImaggaStateForTests(): void {
  requestsUsed = 0;
  consecutiveFailures = 0;
  disabledReason = null;
}

function authHeader(): string | null {
  const key = process.env.IMAGGA_API_KEY?.trim();
  const secret = process.env.IMAGGA_API_SECRET?.trim();
  if (!key || !secret) return null;
  return `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`;
}

export function imaggaEnabled(): boolean {
  const key = process.env.IMAGGA_API_KEY?.trim();
  const secret = process.env.IMAGGA_API_SECRET?.trim();
  if (!key || !secret) return false;
  return disabledReason === null;
}

export function imaggaStatus(): { enabled: boolean; requestsUsed: number; disabledReason: string | null } {
  return { enabled: imaggaEnabled(), requestsUsed, disabledReason };
}

function tripBreaker(reason: string): void {
  disabledReason = reason;
}

/**
 * Pure evaluation function that scores raw tags against botanical vs object vocabularies.
 */
export function evaluateImaggaTags(tags: ImaggaTag[]): {
  plantMax: number;
  objectMax: number;
  isClearlyNonPlant: boolean;
  evidence: string;
} {
  const strong = tags.filter((t) => t.confidence >= EVIDENCE_THRESHOLD);
  const plantMax = strong.reduce((max, t) => (PLANT_TERMS.has(t.name) && t.confidence > max ? t.confidence : max), 0);
  const objectMax = strong.reduce((max, t) => (OBJECT_TERMS.has(t.name) && t.confidence > max ? t.confidence : max), 0);
  const isClearlyNonPlant = plantMax < PLANT_ABSENT_THRESHOLD && objectMax >= OBJECT_DIVERT_THRESHOLD;
  const evidence = strong
    .slice(0, 10)
    .map((t) => `${t.name} (${t.confidence.toFixed(1)})`)
    .join(', ');

  return { plantMax, objectMax, isClearlyNonPlant, evidence };
}

async function imaggaFetch(path: string, init?: RequestInit): Promise<any> {
  const auth = authHeader();
  if (!auth) throw new Error('Imagga credentials missing');
  const res = await fetch(`${IMAGGA_BASE}${path}`, {
    ...init,
    headers: { Authorization: auth, ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (res.status === 402 || res.status === 429) {
    throw Object.assign(new Error(`Imagga quota rejected the request (HTTP ${res.status})`), { quotaExhausted: true });
  }
  if (!res.ok) {
    throw new Error(`Imagga HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Tag a local image. Uploads the raw bytes to /v2/uploads, then reads
 * /v2/tags by upload id -- the documented path for images that are not on a
 * public URL. Returns null (never throws) on any failure.
 */
export async function assessImageWithImagga(base64Data: string, mimeType: string): Promise<ImaggaAssessment | null> {
  if (!imaggaEnabled()) return null;
  if (requestsUsed >= FREE_PLAN_REQUEST_LIMIT) {
    tripBreaker(`in-memory counter reached the ${FREE_PLAN_REQUEST_LIMIT}/month plan limit`);
    return null;
  }

  try {
    const form = new FormData();
    form.append('image', new Blob([Buffer.from(base64Data, 'base64')], { type: mimeType }), 'scan.jpg');
    const upload = await imaggaFetch('/v2/uploads', { method: 'POST', body: form });
    const uploadId = upload?.result?.upload_id;
    if (typeof uploadId !== 'string' || !uploadId) {
      throw new Error('upload_id missing from /v2/uploads response');
    }

    // One billing period counts both calls, but /uploads alone cannot answer
    // anything -- the tag read is where the value is.
    const tagPayload = await imaggaFetch(`/v2/tags?image_upload_id=${encodeURIComponent(uploadId)}&threshold=20`);
    const rawTags: any[] = Array.isArray(tagPayload?.result?.tags) ? tagPayload.result.tags : [];
    requestsUsed += 2;
    consecutiveFailures = 0;

    const tags: ImaggaTag[] = rawTags
      .map((t) => ({
        name: String(t?.tag?.en ?? '').toLowerCase().trim(),
        confidence: Number(t?.confidence),
      }))
      .filter((t) => t.name.length > 0 && Number.isFinite(t.confidence));

    const { plantMax, objectMax, isClearlyNonPlant, evidence } = evaluateImaggaTags(tags);
    return { tags, plantMax, objectMax, isClearlyNonPlant, evidence };
  } catch (err: any) {
    consecutiveFailures += 1;
    if (err?.quotaExhausted) {
      tripBreaker('quota exhausted (billing-cycle limit reached)');
    } else if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      tripBreaker(`${consecutiveFailures} consecutive failures, last: ${err?.message ?? err}`);
    }
    return null;
  }
}
