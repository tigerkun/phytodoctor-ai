import { TelemetryService } from './telemetryService';
import { SPECIES_PROFILES } from '../forecasting/speciesProfiles';

export interface PlantSignature {
  hsvHistogram: number[]; // 48 elements: H[0-15], S[0-15], V[0-15]
  leafContours: number;
  meanRgb: [number, number, number];
  textureEnergy: number;
  computedAt: Date;
  luminance?: number; // 0-255: overall brightness
}

export interface DriftResult {
  signature: PlantSignature;
  driftScore: number; // 0 = identical to baseline, 1 = completely different
  driftStatus: 'stable' | 'watching' | 'alert';
  reasoning: string[];
  biasWarning?: string;
}

// Convert image to signature using Canvas API
export async function extractSignature(imageFile: Blob): Promise<PlantSignature> {
  const startTime = performance.now();
  const bitmap = await createImageBitmap(imageFile);
  const canvas = document.createElement('canvas');
  canvas.width = 224;
  canvas.height = 224;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, 224, 224);
  
  const imageData = ctx.getImageData(0, 0, 224, 224);
  const pixels = imageData.data; // Uint8ClampedArray, length = 224*224*4
  
  // 1. Mean RGB & Luminance
  let rSum = 0, gSum = 0, bSum = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    rSum += pixels[i];
    gSum += pixels[i + 1];
    bSum += pixels[i + 2];
  }
  const pixelCount = 224 * 224;
  const meanRgb: [number, number, number] = [
    rSum / pixelCount,
    gSum / pixelCount,
    bSum / pixelCount
  ];
  
  // Rec. 709 luminance
  const luminance = (0.2126 * meanRgb[0] + 0.7152 * meanRgb[1] + 0.0722 * meanRgb[2]);

  // 2. HSV Histogram (16 bins per channel)
  const hBins = new Array(16).fill(0);
  const sBins = new Array(16).fill(0);
  const vBins = new Array(16).fill(0);
  
  for (let i = 0; i < pixels.length; i += 4) {
    const [h, s, v] = rgbToHsv(pixels[i], pixels[i + 1], pixels[i + 2]);
    hBins[Math.min(15, Math.floor(h / 22.5))]++;
    sBins[Math.min(15, Math.floor(s * 16))]++;
    vBins[Math.min(15, Math.floor(v * 16))]++;
  }
  
  // Normalize bins
  const hsvHistogram = [
    ...hBins.map(v => v / pixelCount),
    ...sBins.map(v => v / pixelCount),
    ...vBins.map(v => v / pixelCount)
  ];
  
  // 3. Leaf contours (simplified: count connected regions of green-ish pixels)
  const leafContours = estimateLeafContours(pixels);
  
  // 4. Texture energy (edge density using simple gradient)
  const textureEnergy = computeTextureEnergy(pixels, 224, 224);
  
  const duration = performance.now() - startTime;
  await TelemetryService.log('latency', Math.round(duration), 'CV_Extraction');

  return {
    hsvHistogram,
    leafContours,
    meanRgb,
    textureEnergy,
    luminance,
    computedAt: new Date()
  };
}

// RGB to HSV conversion
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;
  
  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  return [h * 360, s, v];
}

// Simple leaf contour estimation: threshold green channel, count blobs
function estimateLeafContours(pixels: Uint8ClampedArray): number {
  // Create binary mask: green-dominant pixels
  const mask = new Uint8Array(224 * 224);
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    // Green if G > R + 10 and G > B + 10
    mask[i / 4] = (g > r + 10 && g > b + 10) ? 1 : 0;
  }
  
  // Simple connected components (4-connectivity)
  const visited = new Uint8Array(224 * 224);
  let components = 0;
  
  for (let y = 0; y < 224; y++) {
    for (let x = 0; x < 224; x++) {
      const idx = y * 224 + x;
      if (mask[idx] && !visited[idx]) {
        components++;
        // BFS flood fill
        const queue = [idx];
        visited[idx] = 1;
        while (queue.length > 0) {
          const curr = queue.pop()!;
          const cy = Math.floor(curr / 224);
          const cx = curr % 224;
          const neighbors = [[cy-1,cx],[cy+1,cx],[cy,cx-1],[cy,cx+1]];
          for (const [ny, nx] of neighbors) {
            if (ny >= 0 && ny < 224 && nx >= 0 && nx < 224) {
              const nidx = ny * 224 + nx;
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
  
  return components;
}

// Simple edge energy: sum of gradient magnitudes
function computeTextureEnergy(pixels: Uint8ClampedArray, width: number, height: number): number {
  let energy = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const right = ((y * width + (x + 1)) * 4);
      const down = (((y + 1) * width + x) * 4);
      
      const dx = Math.abs(pixels[idx] - pixels[right]) +
                 Math.abs(pixels[idx + 1] - pixels[right + 1]) +
                 Math.abs(pixels[idx + 2] - pixels[right + 2]);
      const dy = Math.abs(pixels[idx] - pixels[down]) +
                 Math.abs(pixels[idx + 1] - pixels[down + 1]) +
                 Math.abs(pixels[idx + 2] - pixels[down + 2]);
      
      energy += Math.sqrt(dx * dx + dy * dy);
    }
  }
  return energy / (width * height);
}

// Compare current signature to baseline
export function computeDrift(baseline: PlantSignature, current: PlantSignature): number {
  // HSV histogram: cosine similarity
  const hsvDot = baseline.hsvHistogram.reduce((sum, v, i) => sum + v * current.hsvHistogram[i], 0);
  const hsvMagBase = Math.sqrt(baseline.hsvHistogram.reduce((sum, v) => sum + v * v, 0));
  const hsvMagCurr = Math.sqrt(current.hsvHistogram.reduce((sum, v) => sum + v * v, 0));
  const hsvSim = hsvDot / (hsvMagBase * hsvMagCurr + 1e-8);
  
  // Mean RGB: normalized Euclidean distance
  const rgbDist = Math.sqrt(
    Math.pow(baseline.meanRgb[0] - current.meanRgb[0], 2) +
    Math.pow(baseline.meanRgb[1] - current.meanRgb[1], 2) +
    Math.pow(baseline.meanRgb[2] - current.meanRgb[2], 2)
  ) / 441.67; // max possible distance is sqrt(255^2 * 3) ≈ 441.67
  
  // Leaf contours: relative difference
  const contourDiff = Math.abs(baseline.leafContours - current.leafContours) / 
                      Math.max(baseline.leafContours, 1);
  
  // Texture energy: relative difference
  const textureDiff = Math.abs(baseline.textureEnergy - current.textureEnergy) / 
                      Math.max(baseline.textureEnergy, 1e-8);
  
  // Weighted combination
  const driftScore = (
    (1 - hsvSim) * 0.4 +      // histogram shift
    rgbDist * 0.3 +            // color change
    Math.min(contourDiff, 1) * 0.15 +  // leaf loss/gain
    Math.min(textureDiff, 1) * 0.15     // texture degradation
  );
  
  return Math.min(1, Math.max(0, driftScore));
}

export function classifyDrift(driftScore: number): 'stable' | 'watching' | 'alert' {
  // Calibrated against measured baseline variance (0.08 * 1.5 ≈ 0.12)
  if (driftScore < 0.12) return 'stable';
  if (driftScore < 0.28) return 'watching';
  return 'alert';
}

export async function analyzePlantHealth(
  imageBlob: Blob,
  baseline: PlantSignature | null,
  species?: string
): Promise<DriftResult> {
  const signature = await extractSignature(imageBlob);
  const profile = species ? SPECIES_PROFILES[species] : null;
  
  if (!baseline) {
    const tip = profile ? `Establishment tip for ${species}: Maintain ${profile.optimalTemp[0]}°C+ and ${profile.optimalLight} light cycle.` : 'Baseline established.';
    return {
      signature,
      driftScore: 0,
      driftStatus: 'stable',
      reasoning: [tip, 'Statistical deviation analysis active for future assessments.']
    };
  }
  
  const driftScore = computeDrift(baseline, signature);
  const driftStatus = classifyDrift(driftScore);
  
  const reasoning: string[] = [];
  let biasWarning: string | undefined;

  // Luminance Guard
  if (signature.luminance !== undefined && baseline.luminance !== undefined) {
    const lumDiff = Math.abs(signature.luminance - baseline.luminance);
    if (lumDiff > 50) {
      biasWarning = "Significant lighting variance detected. Drift score may be skewed by environment bias.";
      TelemetryService.log('drift_event', 'bias_detected', `LumDiff: ${lumDiff.toFixed(1)}`);
    }
  }

  if (driftScore > 0.12) reasoning.push(`Visual phenotype shifted ${(driftScore * 100).toFixed(1)}% vs. baseline repository.`);
  if (Math.abs(baseline.leafContours - signature.leafContours) > baseline.leafContours * 0.2) {
    reasoning.push(`Significant contour deviation detected: ${baseline.leafContours} → ${signature.leafContours}.`);
  }

  // Species-specific advisory injection
  if (profile && driftScore > 0.1) {
    if (profile.sensitivity.includes('low_humidity') && signature.textureEnergy < baseline.textureEnergy * 0.9) {
      reasoning.push(`${species} specific: Texture degradation detected. Check humidity levels against target 40-60%.`);
    }
    if (profile.sensitivity.includes('overwatering') && signature.meanRgb[1] < baseline.meanRgb[1] * 0.95) {
      reasoning.push(`${species} specific: Chlorophyll saturation drop detected. Verify drainage protocol.`);
    }
  }
  
  // Log successful drift event
  await TelemetryService.log('drift_event', driftScore.toFixed(4), driftStatus);
  
  return { signature, driftScore, driftStatus, reasoning, biasWarning };
}
