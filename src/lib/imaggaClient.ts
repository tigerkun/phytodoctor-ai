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
  /** Custom-classifier species guess — null unless IMAGGA_CLASSIFIER_ID is
   *  configured and the categorizer answered. */
  categories: { species: string; confidence: number; alternatives: { species: string; confidence: number }[] } | null;
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

// ── Diagnostic tag interpretation ───────────────────────────────────────────
// The tags for a scan are already fetched by the pre-screen, so everything
// below is PURE interpretation of ImaggaTag[] — no additional API calls, no
// additional quota. These are weak, auxiliary signals: they pre-diagnose for
// the Gemini evidence block and surface as hints, never as verdicts.

/** Symptom vocabulary Imagga plausibly emits, mapped to keeper language. */
const DISEASE_PATTERNS: Array<{ tags: string[]; disease: string }> = [
  { tags: ['leaf spot', 'spots', 'spotted', 'dots', 'blemish', 'blemishes', 'lesion'], disease: 'Leaf spotting (fungal or bacterial)' },
  { tags: ['yellowing', 'yellow', 'yellowed', 'chlorosis', 'yellow leaves', 'yellow leaf'], disease: 'Chlorosis (yellowing)' },
  { tags: ['pest', 'insect', 'bugs', 'aphid', 'aphids', 'scale insect', 'mealybug', 'mealybugs', 'spider mite', 'spider mites'], disease: 'Pest presence' },
  { tags: ['mold', 'mildew', 'fungus', 'fungal', 'powdery', 'rot', 'rotten'], disease: 'Mold, mildew or rot' },
  { tags: ['webbing', 'web', 'cobweb'], disease: 'Webbing (spider mite signature)' },
  { tags: ['holes', 'hole', 'torn', 'eaten', 'chewed', 'damage', 'damaged'], disease: 'Physical damage or chewing' },
  { tags: ['wilting', 'wilted', 'wilt', 'drooping', 'droopy', ' limp'], disease: 'Wilting' },
];

export interface ImaggaDiseaseHit {
  disease: string;
  confidence: number;
}

export interface DiseasePatternResult {
  diseases: ImaggaDiseaseHit[];
  severity: 'low' | 'medium' | 'high';
}

/**
 * Symptom hints from the tag set. Severity is honest about the source:
 * generic auto-tags cannot distinguish a healthy variegated leaf from
 * disease, so "high" requires strong confidence on multiple independent
 * patterns, never a single loud tag.
 */
export function detectDiseasePatterns(tags: ImaggaTag[]): DiseasePatternResult {
  const byName = new Map(tags.map(t => [t.name, t.confidence]));
  const diseases: ImaggaDiseaseHit[] = [];
  for (const pattern of DISEASE_PATTERNS) {
    let best = 0;
    for (const tag of pattern.tags) {
      const c = byName.get(tag);
      if (c !== undefined && c > best) best = c;
    }
    if (best >= EVIDENCE_THRESHOLD) diseases.push({ disease: pattern.disease, confidence: Math.round(best) });
  }
  const strong = diseases.filter(d => d.confidence >= 60).length;
  const severity: DiseasePatternResult['severity'] =
    diseases.length === 0 ? 'low' : strong >= 2 ? 'high' : strong === 1 || diseases.length >= 3 ? 'medium' : 'low';
  return { diseases, severity };
}

const GROWTH_STAGE_TAGS: Array<{ stage: 'seedling' | 'juvenile' | 'mature' | 'flowering'; tags: string[] }> = [
  { stage: 'flowering', tags: ['flowering', 'flower', 'flowers', 'bloom', 'blooming', 'blossom', 'blossoms', 'buds'] },
  { stage: 'seedling', tags: ['seedling', 'sprout', 'sprouting', 'seed', 'germination', 'cotyledon'] },
  { stage: 'juvenile', tags: ['new growth', 'young leaves', 'young leaf', 'small plant', 'baby plant'] },
  { stage: 'mature', tags: ['mature', 'established', 'large plant', 'lush', 'full grown', 'big plant'] },
];

export interface GrowthStageResult {
  stage: 'seedling' | 'juvenile' | 'mature' | 'flowering' | null;
  confidence: number;
}

/**
 * Growth stage from the tag set, flowering checked first (it outranks the
 * foliage stage a flowering plant also tags). Null when nothing in the
 * vocabulary matched — no stage is invented from silence.
 */
export function detectGrowthStage(tags: ImaggaTag[]): GrowthStageResult {
  const byName = new Map(tags.map(t => [t.name, t.confidence]));
  for (const { stage, tags: candidates } of GROWTH_STAGE_TAGS) {
    let best = 0;
    for (const tag of candidates) {
      const c = byName.get(tag);
      if (c !== undefined && c > best) best = c;
    }
    if (best >= EVIDENCE_THRESHOLD) return { stage, confidence: Math.round(best) };
  }
  return { stage: null, confidence: 0 };
}

const PROPAGATION_TAGS: Array<{ method: 'cutting' | 'division' | 'offset'; tags: string[] }> = [
  { method: 'offset', tags: ['offshoot', 'offshoots', 'pup', 'pups', 'runner', 'runners', 'baby plant', 'plantlet'] },
  { method: 'division', tags: ['cluster', 'clump', 'multiple stems', 'crowded', 'divided'] },
  { method: 'cutting', tags: ['node', 'nodes', 'stem cutting', 'cutting', 'new growth', 'healthy stem'] },
];

export interface PropagationReadiness {
  ready: boolean;
  method: 'cutting' | 'division' | 'offset' | 'none';
  confidence: number;
}

/**
 * Propagation readiness from what the tags can actually see. Imagga's
 * /v2/tags carries no bounding boxes, so unlike the original spec there are
 * no coordinates — the honest output is method + confidence only.
 */
export function assessPropagationReadiness(tags: ImaggaTag[]): PropagationReadiness {
  const byName = new Map(tags.map(t => [t.name, t.confidence]));
  let bestMethod: PropagationReadiness['method'] = 'none';
  let bestConfidence = 0;
  for (const { method, tags: candidates } of PROPAGATION_TAGS) {
    for (const tag of candidates) {
      const c = byName.get(tag);
      if (c !== undefined && c >= EVIDENCE_THRESHOLD && c > bestConfidence) {
        bestConfidence = c;
        bestMethod = method;
      }
    }
  }
  return { ready: bestMethod !== 'none', method: bestMethod, confidence: Math.round(bestConfidence) };
}

/** The three interpretations, bundled for the identify response. */
export interface ImaggaInsights {
  diseases: DiseasePatternResult;
  growthStage: GrowthStageResult;
  propagation: PropagationReadiness;
}

export function interpretImaggaTags(tags: ImaggaTag[]): ImaggaInsights {
  return {
    diseases: detectDiseasePatterns(tags),
    growthStage: detectGrowthStage(tags),
    propagation: assessPropagationReadiness(tags),
  };
}

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

    // Species categorizer (Feature: species-specific recognition) rides the
    // SAME upload — no second upload, one extra read only when a classifier
    // is configured. Without IMAGGA_CLASSIFIER_ID this is null and generic
    // tags are never dressed up as species.
    let categories: { species: string; confidence: number; alternatives: { species: string; confidence: number }[] } | null = null;
    const classifierId = process.env.IMAGGA_CLASSIFIER_ID?.trim();
    if (classifierId) {
      try {
        const catPayload = await imaggaFetch(`/v2/categorizers/${encodeURIComponent(classifierId)}/analyze?image_upload_id=${encodeURIComponent(uploadId)}`);
        const raw: any[] = Array.isArray(catPayload?.result?.categorizers?.[0]?.categories)
          ? catPayload.result.categorizers[0].categories
          : [];
        const cats = raw
          .map(c => ({ species: String(c?.name ?? c?.tag?.en ?? '').trim(), confidence: Math.round(Number(c?.confidence) || 0) }))
          .filter(c => c.species.length > 0)
          .sort((a, b) => b.confidence - a.confidence);
        if (cats.length > 0) {
          categories = { species: cats[0].species, confidence: cats[0].confidence, alternatives: cats.slice(1, 5) };
          requestsUsed += 1;
        }
      } catch {
        // A categorizer misfire must not fail the scan — tags still carry the verdict.
      }
    }

    consecutiveFailures = 0;

    const tags: ImaggaTag[] = rawTags
      .map((t) => ({
        name: String(t?.tag?.en ?? '').toLowerCase().trim(),
        confidence: Number(t?.confidence),
      }))
      .filter((t) => t.name.length > 0 && Number.isFinite(t.confidence));

    const { plantMax, objectMax, isClearlyNonPlant, evidence } = evaluateImaggaTags(tags);
    return { tags, plantMax, objectMax, isClearlyNonPlant, evidence, categories };
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
