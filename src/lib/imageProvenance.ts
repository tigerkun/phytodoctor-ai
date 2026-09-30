/**
 * IMAGE PROVENANCE
 *
 * Where did this photo come from? The scanner pays real seeds on every find,
 * and a photo lifted from the web or generated wholesale should not pay the
 * same as one the Keeper walked outside and took. Three independent checks:
 *
 *   1. Capture metadata  -- a real camera embeds Make/Model/DateTimeOriginal.
 *      Phone photos carry them; scraped and generated images almost never do.
 *      This is the strongest signal and the only one that says YES.
 *   2. Container forensics -- generators leave fingerprints the other way:
 *      Software tags naming Midjourney/DALL-E/Stable Diffusion, C2PA content
 *      credentials, or a prompt accidentally embedded in a PNG's tEXt chunk.
 *      These say NO.
 *   3. Model judgment -- the vision model's own read of the image, filled in
 *      alongside the diagnosis at no extra cost.
 *
 * THE FAIL-SAFE. Every check is evidence, not a verdict; the verdict is the
 * combination, and it is deliberately biased toward letting honest photos
 * through:
 *
 *   self_captured     camera metadata present, nothing synthetic found.
 *   likely_synthetic  hard generator evidence (AI software tag, C2PA
 *                     credentials, or an embedded prompt), or the model is
 *                     itself confident (>=0.75) the image is generated.
 *   unverified        everything else -- screenshots, images re-compressed by
 *                     a messaging app, cameras that write no metadata. A bare
 *                     1024x1024 with no EXIF is suspicious but NOT proof; it
 *                     lands here, not in synthetic.
 *
 * `unverified` and `likely_synthetic` are both survivable by a real photo:
 * the client gates only the seed reward, and a one-tap attestation ("I took
 * this photo myself") restores it. Nothing about the diagnosis itself is ever
 * withheld -- a misjudged verdict costs the user a few seeds, never an answer.
 *
 * The parser is deliberately paranoid: every read is bounds-checked and any
 * malformed input returns whatever was found before the fault, because this
 * runs on untrusted bytes at the edge of the API.
 */

export type ProvenanceVerdict = 'self_captured' | 'unverified' | 'likely_synthetic';

export interface ImageSignals {
  container: string;
  width: number | null;
  height: number | null;
  cameraMake: string | null;
  cameraModel: string | null;
  capturedAt: string | null;
  /** Software tag from the file, if any (e.g. "Adobe Photoshop", "GIMP"). */
  softwareTag: string | null;
  /** Software/embedded text naming a known AI generator. */
  aiGeneratorTag: string | null;
  /** Content Credentials (C2PA/JUMBF) manifest present. */
  hasC2pa: boolean;
  /** Any embedded prompt text found in the container. */
  embeddedPrompt: string | null;
}

export interface ModelJudgment {
  appearsAiGenerated: boolean;
  confidence: number;
  visualClues?: string;
}

export interface ProvenanceAssessment {
  verdict: ProvenanceVerdict;
  checks: {
    captureMetadata: 'pass' | 'absent';
    containerForensics: 'clean' | 'flagged';
    modelJudgment: 'clean' | 'flagged' | 'absent';
  };
  reasons: string[];
}

const AI_GENERATOR_MARKERS = [
  'midjourney', 'dall-e', 'dall\u00b7e', 'dall e', 'openai', 'stable diffusion',
  'stablediffusion', 'comfyui', 'automatic1111', 'invoke-ai', 'invokeai',
  'adobe firefly', 'firefly generative', 'ideogram', 'flux.1', 'flux gen',
  'niji', 'novelai', 'runwayml', 'imagen', 'grok imagine', 'bing image creator',
  'leonardo.ai', 'nightcafe', 'artbreeder', 'deepai', 'craiyon',
] as const;

/** A software tag that means "edited", not "generated". Not evidence of AI. */
const EDITOR_MARKERS = [
  'photoshop', 'lightroom', 'gimp', 'paint.net', 'affinity', 'snapseed',
  'picsart', 'canva', 'pixlr', 'darktable', 'capture one', 'luminar',
] as const;

function includesAny(haystack: string, needles: readonly string[]): string | null {
  const lower = haystack.toLowerCase();
  for (const n of needles) {
    if (lower.includes(n)) {
      const i = lower.indexOf(n);
      return haystack.slice(Math.max(0, i - 20), i + n.length + 20).trim();
    }
  }
  return null;
}

// ── low-level readers, all bounds-checked ──

function u16(buf: Uint8Array, off: number, le: boolean): number {
  if (off + 2 > buf.length) return -1;
  return le ? buf[off] | (buf[off + 1] << 8) : (buf[off] << 8) | buf[off + 1];
}

function u32(buf: Uint8Array, off: number, le: boolean): number {
  if (off + 4 > buf.length) return -1;
  return le
    ? (buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16) | (buf[off + 3] << 24)) >>> 0
    : ((buf[off] << 24) | (buf[off + 1] << 16) | (buf[off + 2] << 8) | buf[off + 3]) >>> 0;
}

function latin1(buf: Uint8Array, start: number, len: number): string {
  let out = '';
  const end = Math.min(start + len, buf.length);
  for (let i = start; i < end; i++) out += String.fromCharCode(buf[i]);
  return out;
}

function asciiOf(buf: Uint8Array): string {
  // Cap the scan: prompt strings live in headers, not megabytes deep.
  return latin1(buf, 0, Math.min(buf.length, 262_144));
}

// ── TIFF/EXIF ──

/** Reads Make/Model/Software/DateTimeOriginal out of a TIFF block. */
function readTiffTags(buf: Uint8Array, base: number, out: ImageSignals): void {
  const endian = latin1(buf, base, 2);
  const le = endian === 'II';
  if (!le && endian !== 'MM') return;
  if (u16(buf, base + 2, le) !== 42) return;

  const readIfd = (ifdOff: number): number => {
    if (ifdOff < 0 || base + ifdOff + 2 > buf.length) return -1;
    const count = u16(buf, base + ifdOff, le);
    if (count <= 0 || count > 512) return -1;
    let next = -1;
    for (let e = 0; e < count; e++) {
      const entry = base + ifdOff + 2 + e * 12;
      if (entry + 12 > buf.length) break;
      const tag = u16(buf, entry, le);
      const type = u16(buf, entry + 2, le);
      const num = u32(buf, entry + 4, le);
      const sizes: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
      const unit = sizes[type] ?? 1;
      const byteLen = num * unit;
      const valOff = byteLen <= 4 ? entry + 8 : base + u32(buf, entry + 8, le);
      if (byteLen > 4096 || valOff < 0 || valOff + byteLen > buf.length) continue;
      const str = type === 2 ? latin1(buf, valOff, num).replace(/\0+$/, '').trim() : null;
      if (tag === 0x010f && str) out.cameraMake = str;
      else if (tag === 0x0110 && str) out.cameraModel = str;
      else if (tag === 0x0131 && str) out.softwareTag = out.softwareTag ?? str;
      else if (tag === 0x9003 && str) out.capturedAt = str;
      else if (tag === 0x0132 && str) out.capturedAt = out.capturedAt ?? str;
      else if (tag === 0x8769) next = u32(buf, entry + 8, le); // Exif sub-IFD
    }
    return next;
  };

  const ifd0 = u32(buf, base + 4, le);
  const exifIfd = readIfd(ifd0);
  if (exifIfd > 0) readIfd(exifIfd);
}

// ── container walkers ──

function readJpeg(buf: Uint8Array, out: ImageSignals): void {
  // SOFn gives dimensions; APP1/Exif gives metadata.
  let p = 2;
  while (p + 4 <= buf.length) {
    if (buf[p] !== 0xff) break;
    const marker = buf[p + 1];
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { p += 2; continue; }
    const len = u16(buf, p + 2, false);
    if (len < 2) break;
    const seg = p + 4;
    if (marker === 0xe1 && latin1(buf, seg, 6) === 'Exif\0\0') {
      readTiffTags(buf, seg + 6, out);
    } else if (marker === 0xe2 && latin1(buf, seg, 11).startsWith('http://ns.adobe')) {
      out.hasC2pa = out.hasC2pa || asciiOf(buf).includes('c2pa');
    } else if ((marker & 0xf0) === 0xc0 && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      // SOFn layout: [precision 1][height 2][width 2], counted from `seg`.
      const h = u16(buf, seg + 1, false);
      const w = u16(buf, seg + 3, false);
      if (h > 0 && w > 0) { out.width = w; out.height = h; }
    }
    p = seg - 2 + len;
  }
}

function readPng(buf: Uint8Array, out: ImageSignals): void {
  if (buf.length < 24) return;
  out.width = u32(buf, 16, false);
  out.height = u32(buf, 20, false);

  let p = 8;
  while (p + 12 <= buf.length) {
    const len = u32(buf, p, false);
    const type = latin1(buf, p + 4, 4);
    if (len < 0 || p + 12 + len > buf.length) break;
    const dataStart = p + 8;

    if (type === 'tEXt' || type === 'iTXt') {
      const text = latin1(buf, dataStart, Math.min(len, 4096));
      const nul = text.indexOf('\0');
      const keyword = (nul >= 0 ? text.slice(0, nul) : text).toLowerCase();
      const value = nul >= 0 ? text.slice(nul + 1) : '';
      if (keyword === 'software') out.softwareTag = out.softwareTag ?? value.slice(0, 200);
      if (keyword === 'parameters' || keyword === 'prompt' || keyword === 'negative_prompt') {
        out.embeddedPrompt = out.embeddedPrompt ?? value.slice(0, 200);
      }
    } else if (type === 'eXIf') {
      readTiffTags(buf, dataStart, out);
    }
    // C2PA manifests live in JUMBF superboxes; a string scan is enough.
    p = dataStart + len + 4;
  }
}

function readWebp(buf: Uint8Array, out: ImageSignals): void {
  if (buf.length < 30) return;
  const fourcc = latin1(buf, 12, 4);
  if (fourcc === 'VP8 ') {
    // lossy: dimensions in the frame header after a 3-byte start code
    if (buf.length >= 30) {
      out.width = u16(buf, 26, true) & 0x3fff;
      out.height = u16(buf, 28, true) & 0x3fff;
    }
  } else if (fourcc === 'VP8L') {
    const b = buf[21] | (buf[22] << 8) | (buf[23] << 16) | (buf[24] << 24);
    out.width = (b & 0x3fff) + 1;
    out.height = ((b >> 14) & 0x3fff) + 1;
  } else if (fourcc === 'VP8X') {
    const b = (buf[24] | (buf[25] << 8) | (buf[26] << 16)) + 1;
    const h = (buf[27] | (buf[28] << 8) | (buf[29] << 16)) + 1;
    out.width = b; out.height = h;
  }

  // Chunks follow: look for EXIF/XMP by FourCC rather than walking properly,
  // because a malformed chunk length would otherwise stop the walk early.
  const head = asciiOf(buf);
  const exifAt = buf.indexOf ? head.indexOf('Exif') : -1;
  if (exifAt > 0) readTiffTags(buf, exifAt + 4, out);
  if (head.includes('c2pa') || head.includes('jumbf')) out.hasC2pa = true;
  if (head.includes('<x:xmpmeta')) {
    const gen = includesAny(head, AI_GENERATOR_MARKERS);
    if (gen) out.aiGeneratorTag = out.aiGeneratorTag ?? gen;
  }
}

// ── public API ──

export function readImageSignals(buf: Uint8Array): ImageSignals {
  const out: ImageSignals = {
    container: 'unknown',
    width: null,
    height: null,
    cameraMake: null,
    cameraModel: null,
    capturedAt: null,
    softwareTag: null,
    aiGeneratorTag: null,
    hasC2pa: false,
    embeddedPrompt: null,
  };
  try {
    if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8) {
      out.container = 'jpeg';
      readJpeg(buf, out);
    } else if (buf.length >= 8 && latin1(buf, 0, 8) === '\u0089PNG\r\n\u001a\n') {
      out.container = 'png';
      readPng(buf, out);
    } else if (buf.length >= 12 && latin1(buf, 0, 4) === 'RIFF' && latin1(buf, 8, 4) === 'WEBP') {
      out.container = 'webp';
      readWebp(buf, out);
    } else if (buf.length >= 4 && (latin1(buf, 0, 4) === 'II*\0' || latin1(buf, 0, 4) === 'MM\0*')) {
      out.container = 'tiff';
      readTiffTags(buf, 0, out);
    } else if (buf.length >= 6 && latin1(buf, 0, 6).toUpperCase().startsWith('GIF8')) {
      out.container = 'gif';
      out.width = u16(buf, 6, true);
      out.height = u16(buf, 8, true);
    }
  } catch {
    // Malformed input: return whatever was recovered. Never throw from here.
  }

  // AI fingerprints from any container's text payloads.
  const raw = asciiOf(buf);
  if (raw.includes('c2pa') || raw.includes('jumbf')) out.hasC2pa = true;
  if (!out.embeddedPrompt) {
    const promptish = includesAny(raw, ['parameters:', 'negative prompt', '"prompt"']);
    if (promptish) out.embeddedPrompt = promptish.slice(0, 200);
  }
  if (!out.aiGeneratorTag) {
    const gen = includesAny(raw, AI_GENERATOR_MARKERS);
    if (gen) out.aiGeneratorTag = gen.slice(0, 200);
  }
  return out;
}

/**
 * Combines the three checks into a verdict. `modelJudgment` may be null when
 * the model did not return one -- the other two checks still decide.
 */
export function assessProvenance(
  signals: ImageSignals,
  modelJudgment: ModelJudgment | null
): ProvenanceAssessment {
  const reasons: string[] = [];

  const hasCamera = Boolean(
    (signals.cameraMake || signals.cameraModel) && (signals.capturedAt || signals.cameraModel)
  );
  const checks: ProvenanceAssessment['checks'] = {
    captureMetadata: hasCamera ? 'pass' : 'absent',
    containerForensics: 'clean',
    modelJudgment: modelJudgment ? (modelJudgment.appearsAiGenerated ? 'flagged' : 'clean') : 'absent',
  };

  if (hasCamera) {
    reasons.push(
      `Capture metadata present${signals.cameraMake ? ` (${[signals.cameraMake, signals.cameraModel].filter(Boolean).join(' ')})` : ''}${signals.capturedAt ? `, taken ${signals.capturedAt}` : ''}.`
    );
  }

  if (signals.aiGeneratorTag) {
    checks.containerForensics = 'flagged';
    reasons.push(`File metadata names an AI generator: "${signals.aiGeneratorTag}".`);
  }
  if (signals.embeddedPrompt) {
    checks.containerForensics = 'flagged';
    reasons.push('The file carries an embedded generation prompt.');
  }
  if (signals.hasC2pa) {
    checks.containerForensics = 'flagged';
    reasons.push('The file carries Content Credentials (C2PA) metadata.');
    // C2PA alone is not proof of generation (real cameras are starting to sign
    // photos too), so it flags but relies on the next checks to convict.
    if (signals.cameraMake) {
      checks.containerForensics = 'clean';
      reasons.pop();
    }
  }
  if (signals.softwareTag) {
    const gen = includesAny(signals.softwareTag, AI_GENERATOR_MARKERS);
    const editor = includesAny(signals.softwareTag, EDITOR_MARKERS);
    if (gen) {
      checks.containerForensics = 'flagged';
      reasons.push(`Software tag names an AI generator: "${signals.softwareTag}".`);
    } else if (!editor) {
      reasons.push(`Non-camera software tag present: "${signals.softwareTag}" (consistent with editing or export).`);
    }
  }

  if (modelJudgment?.appearsAiGenerated && modelJudgment.confidence >= 0.75) {
    reasons.push(`The diagnostic model judged the image AI-generated (${Math.round(modelJudgment.confidence * 100)}% confidence)${modelJudgment.visualClues ? `: ${modelJudgment.visualClues}` : '.'}`);
  }
  if (modelJudgment?.visualClues && !modelJudgment.appearsAiGenerated && !hasCamera) {
    reasons.push(`Model read: ${modelJudgment.visualClues}`);
  }

  const modelFlagsIt = Boolean(modelJudgment?.appearsAiGenerated && modelJudgment.confidence >= 0.75);
  const hardSyntheticEvidence =
    Boolean(signals.aiGeneratorTag) ||
    (signals.hasC2pa && !signals.cameraMake) ||
    Boolean(signals.embeddedPrompt);

  let verdict: ProvenanceVerdict;
  if (hardSyntheticEvidence || (modelFlagsIt && !hasCamera)) {
    verdict = 'likely_synthetic';
  } else if (hasCamera && checks.containerForensics === 'clean') {
    verdict = 'self_captured';
  } else {
    verdict = 'unverified';
    if (!hasCamera) {
      reasons.push('No camera metadata in the file (common for screenshots and images re-sent through messaging apps).');
    }
  }

  // A flagged software tag that is only an editor (Photoshop on a real camera
  // photo) must not convict: if camera metadata is present and nothing names a
  // generator, the photo is still self-captured.
  if (verdict === 'likely_synthetic' && hasCamera && !hardSyntheticEvidence && !modelFlagsIt) {
    verdict = 'unverified';
    reasons.push('Edited image rather than a confirmed generation — treated as unverified.');
  }

  return { verdict, checks, reasons };
}
