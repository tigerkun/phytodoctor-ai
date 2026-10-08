import { db } from '../db/database';
import { SPECIES_PROFILES } from '../forecasting/speciesProfiles';
import type { PlantSignature } from './driftDetector';
import type { Plant } from '../types';

export interface PathologySignature extends PlantSignature {
  chlorosisFraction: number; // 0 to 1
  necrosisFraction: number; // 0 to 1
  chlorophyllFraction: number; // 0 to 1
}

export interface PathologyMetrics {
  chlorosisA: number; // percentage (0 - 100%)
  chlorosisB: number; // percentage (0 - 100%)
  deltaChlorosis: number; // percentage shift e.g. -5.2% or +12.1%
  necrosisA: number;
  necrosisB: number;
  deltaNecrosis: number;
  chlorophyllA: number;
  chlorophyllB: number;
  deltaChlorophyll: number;
  textureStability: number; // 0% to 100%
  deltaTextureEnergy: number;
  recoveryDriftPercent: number; // -100% (acute decline) to +100% (full recovery)
  classification: 'Recovering' | 'Stabilizing' | 'Active Pathology' | 'Severe Drift';
  lightingBiasWarning?: boolean;
}

export interface ClinicalInsight {
  title: string;
  narrative: string;
  recommendedAction: string;
  urgency: 'low' | 'moderate' | 'high';
}

/**
 * Converts RGB [0..255] to HSV: H in [0..360), S in [0..1], V in [0..1]
 */
export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (d !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return [h * 360, s, v];
}

/**
 * Pure mathematical pixel extraction for on-device foliar pathology analysis.
 * Operates purely on raw typed arrays without DOM/canvas dependencies, ensuring
 * deterministic execution in Vitest Node 22 without mocks.
 */
export function extractPathologySignatureFromPixels(
  pixels: Uint8ClampedArray,
  width = 224,
  height = 224
): PathologySignature {
  const pixelCount = width * height;
  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  const hBins = new Array(16).fill(0);
  const sBins = new Array(16).fill(0);
  const vBins = new Array(16).fill(0);

  let validCount = 0;
  let chlorosisCount = 0;
  let necrosisCount = 0;
  let chlorophyllCount = 0;

  for (let i = 0; i < pixels.length; i += 4) {
    const a = pixels[i + 3];
    // Skip transparent or semi-transparent background pixels
    if (a < 128) continue;

    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    rSum += r;
    gSum += g;
    bSum += b;

    const [h, s, v] = rgbToHsv(r, g, b);
    hBins[Math.min(15, Math.floor(h / 22.5))]++;
    sBins[Math.min(15, Math.floor(s * 16))]++;
    vBins[Math.min(15, Math.floor(v * 16))]++;

    // Filter out specular highlights/glare and deep pitch black shadow
    const isSpecular = v > 0.96 && s < 0.08;
    const isCrushedBlack = v < 0.08;
    if (isSpecular || isCrushedBlack) continue;

    validCount++;

    // 1. Necrosis: 5°-38° with moderate saturation/darkness, or dark necrotic lesions (V <= 0.22, S >= 0.10)
    const isNecrotic = (h >= 5 && h < 38 && s >= 0.15 && v <= 0.55) || (v <= 0.22 && s >= 0.1);
    // 2. Chlorosis: 38°-68° yellowing band, S >= 0.18, V >= 0.30
    const isChlorotic = h >= 38 && h < 68 && s >= 0.18 && v >= 0.3;
    // 3. Chlorophyll: 68°-165° healthy green foliage band, S >= 0.15, V >= 0.15
    const isChlorophyll = h >= 68 && h <= 165 && s >= 0.15 && v >= 0.15;

    if (isNecrotic) necrosisCount++;
    else if (isChlorotic) chlorosisCount++;
    else if (isChlorophyll) chlorophyllCount++;
  }

  const effectivePixelCount = Math.max(1, pixelCount);
  const effectiveValid = Math.max(1, validCount);

  const meanRgb: [number, number, number] = [
    rSum / effectivePixelCount,
    gSum / effectivePixelCount,
    bSum / effectivePixelCount,
  ];

  const luminance = 0.2126 * meanRgb[0] + 0.7152 * meanRgb[1] + 0.0722 * meanRgb[2];

  const hsvHistogram = [
    ...hBins.map(v => v / effectivePixelCount),
    ...sBins.map(v => v / effectivePixelCount),
    ...vBins.map(v => v / effectivePixelCount),
  ];

  // Texture energy (edge gradient sum)
  let textureEnergy = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const right = (y * width + (x + 1)) * 4;
      const down = ((y + 1) * width + x) * 4;

      const dx =
        Math.abs(pixels[idx] - pixels[right]) +
        Math.abs(pixels[idx + 1] - pixels[right + 1]) +
        Math.abs(pixels[idx + 2] - pixels[right + 2]);
      const dy =
        Math.abs(pixels[idx] - pixels[down]) +
        Math.abs(pixels[idx + 1] - pixels[down + 1]) +
        Math.abs(pixels[idx + 2] - pixels[down + 2]);

      textureEnergy += Math.sqrt(dx * dx + dy * dy);
    }
  }
  textureEnergy = textureEnergy / (width * height);

  // Contour estimation (green connected components)
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    mask[i / 4] = g > r + 10 && g > b + 10 ? 1 : 0;
  }
  const visited = new Uint8Array(width * height);
  let leafContours = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (mask[idx] && !visited[idx]) {
        leafContours++;
        const queue = [idx];
        visited[idx] = 1;
        while (queue.length > 0) {
          const curr = queue.pop()!;
          const cy = Math.floor(curr / width);
          const cx = curr % width;
          const neighbors = [
            [cy - 1, cx],
            [cy + 1, cx],
            [cy, cx - 1],
            [cy, cx + 1],
          ];
          for (const [ny, nx] of neighbors) {
            if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
              const nidx = ny * width + nx;
              if (mask[nidx] && !visited[nidx]) {
                visited[nidx] = 1;
                queue.push(nidx);
              }
            }
          }
        }
      }
    }
  }

  return {
    hsvHistogram,
    leafContours,
    meanRgb,
    textureEnergy,
    luminance,
    computedAt: new Date(),
    chlorosisFraction: chlorosisCount / effectiveValid,
    necrosisFraction: necrosisCount / effectiveValid,
    chlorophyllFraction: chlorophyllCount / effectiveValid,
  };
}

/**
 * Extracts spectral fractions from a signature, checking for detailed pathology
 * properties or falling back to the 48-bin HSV histogram.
 */
function getSpectralFractions(sig: PlantSignature): {
  chlorosis: number;
  necrosis: number;
  chlorophyll: number;
} {
  const pSig = sig as Partial<PathologySignature>;
  if (
    typeof pSig.chlorosisFraction === 'number' &&
    typeof pSig.necrosisFraction === 'number' &&
    typeof pSig.chlorophyllFraction === 'number'
  ) {
    return {
      chlorosis: pSig.chlorosisFraction,
      necrosis: pSig.necrosisFraction,
      chlorophyll: pSig.chlorophyllFraction,
    };
  }

  const h = sig.hsvHistogram || [];
  // Chlorosis: Bin 2 (45°-67.5°) + 31% of Bin 1 (38°-45°)
  const chlorosis = (h[2] || 0) + 0.31 * (h[1] || 0);
  // Necrosis: Hue 0 & 1 with low V (bins 32-35)
  const lowV = (h[32] || 0) + (h[33] || 0) + (h[34] || 0);
  const necrosis = ((h[0] || 0) + 0.69 * (h[1] || 0)) * (lowV * 3 + 0.2);
  // Chlorophyll: Bins 3..6 (67.5°-157.5°) + 33% of Bin 7 (157.5°-165°)
  const chlorophyll = (h[3] || 0) + (h[4] || 0) + (h[5] || 0) + (h[6] || 0) + 0.33 * (h[7] || 0);

  return { chlorosis, necrosis, chlorophyll };
}

/**
 * Pure mathematical comparative pathology calculation.
 * Compares two phenotypes and returns signed delta HSV distributions,
 * texture stability, signed overall recovery drift (-100% to +100%), and 4-tier classification.
 */
export function computeComparativePathology(
  sigA: PlantSignature,
  sigB: PlantSignature,
  species?: string
): PathologyMetrics {
  const fA = getSpectralFractions(sigA);
  const fB = getSpectralFractions(sigB);

  const chlorosisA = Number((fA.chlorosis * 100).toFixed(1));
  const chlorosisB = Number((fB.chlorosis * 100).toFixed(1));
  const deltaChlorosis = Number((chlorosisB - chlorosisA).toFixed(1));

  const necrosisA = Number((fA.necrosis * 100).toFixed(1));
  const necrosisB = Number((fB.necrosis * 100).toFixed(1));
  const deltaNecrosis = Number((necrosisB - necrosisA).toFixed(1));

  const chlorophyllA = Number((fA.chlorophyll * 100).toFixed(1));
  const chlorophyllB = Number((fB.chlorophyll * 100).toFixed(1));
  const deltaChlorophyll = Number((chlorophyllB - chlorophyllA).toFixed(1));

  const energyA = sigA.textureEnergy || 0;
  const energyB = sigB.textureEnergy || 0;
  const deltaTextureEnergy = Number((energyB - energyA).toFixed(2));
  const textureStability = Number(
    Math.max(
      0,
      Math.min(100, 100 * (1 - Math.abs(energyB - energyA) / Math.max(energyA, 1.0)))
    ).toFixed(1)
  );

  // Recovery drift formula:
  // - Increasing chlorophyll is positive
  // - Decreasing chlorosis is positive
  // - Decreasing necrosis is strongly positive (multiplier 2.0)
  // - Texture energy increase (roughness) penalizes recovery
  // Texture shift penalty: foliar roughness increase adds a mild penalty to recovery
  const textureShift = Math.max(0, deltaTextureEnergy / Math.max(energyA, 1.0)) * 10;
  const rawRecovery =
    deltaChlorophyll * 1.0 - deltaChlorosis * 1.25 - deltaNecrosis * 2.0 - textureShift;
  const recoveryDriftPercent = Number(
    Math.max(-100, Math.min(100, rawRecovery)).toFixed(1)
  );

  // 4-tier clinical classification
  let classification: 'Recovering' | 'Stabilizing' | 'Active Pathology' | 'Severe Drift';
  if (recoveryDriftPercent < -50 || deltaNecrosis >= 12) {
    classification = 'Severe Drift';
  } else if (recoveryDriftPercent < -10 || deltaChlorosis >= 6 || deltaNecrosis >= 4) {
    classification = 'Active Pathology';
  } else if (recoveryDriftPercent >= 15) {
    classification = 'Recovering';
  } else {
    classification = 'Stabilizing';
  }

  // Lighting bias warning if luminance variance exceeds 50
  const lumA = sigA.luminance;
  const lumB = sigB.luminance;
  const lightingBiasWarning =
    lumA !== undefined && lumB !== undefined && Math.abs(lumB - lumA) > 50;

  return {
    chlorosisA,
    chlorosisB,
    deltaChlorosis,
    necrosisA,
    necrosisB,
    deltaNecrosis,
    chlorophyllA,
    chlorophyllB,
    deltaChlorophyll,
    textureStability,
    deltaTextureEnergy,
    recoveryDriftPercent,
    classification,
    lightingBiasWarning,
  };
}

/**
 * In-browser canvas extractor for Blob images.
 * Adheres to PERF-02 invariant (closing bitmap in finally block).
 */
export async function extractPathologySignature(imageFile: Blob): Promise<PathologySignature> {
  if (typeof createImageBitmap !== 'function') {
    throw new Error('createImageBitmap is not supported in this runtime environment');
  }
  const bitmap = await createImageBitmap(imageFile);
  let pixels: Uint8ClampedArray;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 224;
    canvas.height = 224;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to acquire 2D canvas context');
    ctx.drawImage(bitmap, 0, 0, 224, 224);
    pixels = ctx.getImageData(0, 0, 224, 224).data;
  } finally {
    bitmap.close();
  }
  return extractPathologySignatureFromPixels(pixels, 224, 224);
}

/**
 * High-level comparator for two photographic Blobs.
 * Entirely on-device (ADR 001). Zero network calls.
 */
export async function compareSpecimenImages(
  imgA: Blob,
  imgB: Blob,
  species?: string
): Promise<PathologyMetrics> {
  const [sigA, sigB] = await Promise.all([
    extractPathologySignature(imgA),
    extractPathologySignature(imgB),
  ]);
  return computeComparativePathology(sigA, sigB, species);
}

/**
 * Resolves photographic references (Dexie local vault, base64 data URIs, or remote URLs)
 * into a standard binary Blob without requiring network round-trips for local photos.
 */
export async function resolvePhotoBlob(
  photoUrl: string | null | undefined,
  photoBlob: Blob | null | undefined
): Promise<Blob | null> {
  if (photoBlob instanceof Blob) return photoBlob;
  if (!photoUrl) return null;

  // 1. Local Dexie vault URI
  if (photoUrl.startsWith('local://photos/')) {
    const photoId = photoUrl.replace('local://photos/', '');
    try {
      const row = await db.photos.get(photoId);
      if (row?.blob) return row.blob;
    } catch {
      // In offline/test environments without IndexedDB
    }
    return null;
  }

  // 2. Base64 Data URI
  if (photoUrl.startsWith('data:')) {
    try {
      const [header, base64] = photoUrl.split(',');
      const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return new Blob([bytes], { type: mime });
    } catch {
      return null;
    }
  }

  // 3. Remote HTTP/HTTPS URL
  if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
    try {
      const res = await fetch(photoUrl);
      if (res.ok) return await res.blob();
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Resolves photographic references to a URL suitable for display in an <img src="..."> element.
 * For local blobs and IndexedDB records, creates an Object URL.
 */
export async function resolvePhotoUrl(
  photoUrl: string | null | undefined,
  photoBlob: Blob | null | undefined
): Promise<string | null> {
  if (photoBlob instanceof Blob) {
    return URL.createObjectURL(photoBlob);
  }
  if (!photoUrl) return null;

  if (photoUrl.startsWith('local://photos/')) {
    const blob = await resolvePhotoBlob(photoUrl, null);
    if (blob) {
      return URL.createObjectURL(blob);
    }
    return null;
  }

  return photoUrl;
}

/**
 * Generates actionable clinical narrative connecting visual progression telemetry
 * with the plant's active recovery roadmap.
 */
export function generateClinicalInsight(
  metrics: PathologyMetrics,
  plantName: string,
  roadmap?: Plant['recoveryRoadmap'] | null
): ClinicalInsight {
  const nextRoadmapAction = roadmap?.timeline?.[0]?.action;

  switch (metrics.classification) {
    case 'Recovering': {
      const chlorosisText =
        metrics.deltaChlorosis < 0
          ? `Chlorotic yellowing contracted by ${Math.abs(metrics.deltaChlorosis).toFixed(1)}%.`
          : 'Chlorosis remains contained.';
      const narrative = `${plantName} demonstrates positive foliar recovery (+${metrics.recoveryDriftPercent.toFixed(1)}%). ${chlorosisText} Foliar cellular architecture is stable with ${metrics.textureStability.toFixed(0)}% texture fidelity.`;
      const recommendedAction = nextRoadmapAction
        ? `Continue scheduled protocol: "${nextRoadmapAction}". Maintain existing illumination and substrate moisture gradient.`
        : 'Maintain current regimen and environmental parameters. Re-inspect foliar margins in 5–7 days.';
      return {
        title: 'Positive Foliar Remission',
        narrative,
        recommendedAction,
        urgency: 'low',
      };
    }
    case 'Stabilizing': {
      const narrative = `${plantName} is maintaining physiological equilibrium (${metrics.recoveryDriftPercent >= 0 ? '+' : ''}${metrics.recoveryDriftPercent.toFixed(1)}%). Cellular drift is halted with ${metrics.textureStability.toFixed(0)}% texture stability.`;
      const recommendedAction = nextRoadmapAction
        ? `Continue active regimen step: "${nextRoadmapAction}". Specimen is holding steady.`
        : 'Maintain consistent watering interval and ambient humidity. Watch for emerging new growth.';
      return {
        title: 'Specimen Equilibrium Maintained',
        narrative,
        recommendedAction,
        urgency: 'low',
      };
    }
    case 'Active Pathology': {
      const detail =
        metrics.deltaChlorosis > 0
          ? `Chlorotic yellowing expanded by +${metrics.deltaChlorosis.toFixed(1)}%`
          : `Necrotic spotting expanded by +${metrics.deltaNecrosis.toFixed(1)}%`;
      const narrative = `Active foliar degradation detected in ${plantName} (${metrics.recoveryDriftPercent.toFixed(1)}%). ${detail}. Cellular texture stability is at ${metrics.textureStability.toFixed(0)}%.`;
      const recommendedAction = nextRoadmapAction
        ? `Prioritize scheduled protocol step: "${nextRoadmapAction}". Adjust substrate drainage and moderate light exposure.`
        : 'Audit soil moisture and root zone aeration. Check underside of leaves for early fungal or pest colonization.';
      return {
        title: 'Active Pathological Drift',
        narrative,
        recommendedAction,
        urgency: 'moderate',
      };
    }
    case 'Severe Drift': {
      const narrative = `Critical cellular breakdown detected in ${plantName} (${metrics.recoveryDriftPercent.toFixed(1)}%). Acute necrotic tissue expansion (+${metrics.deltaNecrosis.toFixed(1)}%) with significant lamina texture degradation.`;
      const recommendedAction = nextRoadmapAction
        ? `Execute urgent salvage action: "${nextRoadmapAction}". Isolate specimen, excise severely blighted leaves, and inspect root zone for hypoxia or rot.`
        : 'Isolate specimen immediately to prevent contagion. Prune necrotic tissue, flush substrate if salt/fertilizer accumulation is suspected, and hold watering.';
      return {
        title: 'Critical Tissue Breakdown',
        narrative,
        recommendedAction,
        urgency: 'high',
      };
    }
  }
}
