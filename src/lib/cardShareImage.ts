/**
 * SHARE CARD RENDERER
 *
 * Draws a specimen's share card as a PNG blob: 1080x1350, the 4:5 portrait
 * that fills an Instagram/TikTok story slot exactly. This is the image a
 * Keeper posts when their Monstera hits Epic -- the share loop's payload.
 *
 * The photo comes from Supabase Storage, which may or may not send CORS
 * headers depending on bucket configuration. A cross-origin image without
 * them taints the canvas and makes toDataURL/toBlob throw, so the photo is
 * attempted with crossOrigin='anonymous' and any failure falls back to the
 * brand mark on a gradient -- a degraded card, never a broken share.
 */

import { RARITY_CONFIGS, type RarityConfig } from '../game/RARITY_DATA';
import type { RarityTier } from '../types';

const W = 1080;
const H = 1350;

export interface ShareCardData {
  name: string;
  species: string;
  rarity: RarityTier;
  photoUrl?: string | null;
  daysAlive: number;
  checkIns: number;
  guardianScore: number;
  streak: number;
}

let cachedMark: HTMLImageElement | null = null;

async function loadMark(): Promise<HTMLImageElement | null> {
  if (cachedMark) return cachedMark;
  try {
    const res = await fetch('/icon.svg');
    const svg = await res.text();
    const img = new Image();
    img.src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    await img.decode();
    cachedMark = img;
    return img;
  } catch {
    return null;
  }
}

/** Loads the specimen photo defensively; null means "draw the fallback". */
async function loadPhoto(url: string | null | undefined): Promise<HTMLImageElement | null> {
  if (!url) return null;
  // data: URLs (locally-stored photos) are same-origin by definition.
  if (!url.startsWith('data:')) {
    try {
      const probe = await fetch(url, { method: 'HEAD' });
      if (!probe.ok) return null;
    } catch {
      return null;
    }
  }
  const img = new Image();
  if (!url.startsWith('data:')) img.crossOrigin = 'anonymous';
  img.src = url;
  try {
    await img.decode();
    return img;
  } catch {
    return null;
  }
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** Draws img into the rect with object-fit: cover semantics. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return false;
  const scale = Math.max(w / iw, h / ih);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (iw - sw) / 2;
  const sy = (ih - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  return true;
}

function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, basePx: number, font: (px: number) => string): number {
  let px = basePx;
  ctx.font = font(px);
  while (ctx.measureText(text).width > maxWidth && px > 28) {
    px -= 4;
    ctx.font = font(px);
  }
  return px;
}

export async function renderShareCard(data: ShareCardData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // The app's display fonts are webfonts; make sure they are actually loaded
  // before measuring text, or the fit loop measures with fallback metrics.
  try {
    await Promise.all([
      document.fonts.load('700 96px "Cormorant Garamond"'),
      document.fonts.load('italic 600 44px "Cormorant Garamond"'),
      document.fonts.load('800 40px Inter'),
      document.fonts.load('600 22px Inter'),
    ]);
  } catch { /* fall back to whatever is available */ }

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#123a2c');
  bg.addColorStop(1, '#0a241a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const mark = await loadMark();

  // Watermark mark, right side, barely there
  if (mark) {
    ctx.globalAlpha = 0.1;
    ctx.drawImage(mark, 600, 520, 620, 620);
    ctx.globalAlpha = 1;
  }

  // Photo panel (or mark fallback)
  const PX = 60, PY = 60, PW = W - 120, PH = 640;
  ctx.save();
  roundRectPath(ctx, PX, PY, PW, PH, 36);
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = '#0d2f24';
  ctx.fill();
  ctx.restore();

  ctx.save();
  roundRectPath(ctx, PX, PY, PW, PH, 36);
  ctx.clip();
  const photo = await loadPhoto(data.photoUrl);
  if (photo && drawCover(ctx, photo, PX, PY, PW, PH)) {
    const sheen = ctx.createLinearGradient(0, PY + PH - 240, 0, PY + PH);
    sheen.addColorStop(0, 'rgba(10,36,26,0)');
    sheen.addColorStop(1, 'rgba(10,36,26,0.55)');
    ctx.fillStyle = sheen;
    ctx.fillRect(PX, PY + PH - 240, PW, 240);
  } else if (mark) {
    const tile = ctx.createLinearGradient(PX, PY, PX + PW, PY + PH);
    tile.addColorStop(0, '#1d5643');
    tile.addColorStop(1, '#0f3527');
    ctx.fillStyle = tile;
    ctx.fillRect(PX, PY, PW, PH);
    ctx.drawImage(mark, PX + PW / 2 - 190, PY + PH / 2 - 190, 380, 380);
  }
  ctx.restore();

  // Rarity chip, seated on the photo's corner
  const rarity: RarityConfig = RARITY_CONFIGS[data.rarity] || RARITY_CONFIGS.common;
  const chipLabel = `${rarity.label.toUpperCase()} FIND`;
  ctx.font = '800 30px Inter, sans-serif';
  const chipW = ctx.measureText(chipLabel).width + 72;
  ctx.fillStyle = 'rgba(8, 30, 22, 0.88)';
  roundRectPath(ctx, PX + 28, PY + PH - 40, chipW, 78, 39);
  ctx.fill();
  ctx.strokeStyle = rarity.color;
  ctx.lineWidth = 4;
  roundRectPath(ctx, PX + 28, PY + PH - 40, chipW, 78, 39);
  ctx.stroke();
  ctx.fillStyle = rarity.color;
  ctx.textBaseline = 'middle';
  ctx.fillText(chipLabel, PX + 64, PY + PH - 40 + 39);
  ctx.textBaseline = 'alphabetic';

  // Name + species
  ctx.fillStyle = '#f4eee1';
  const namePx = fitText(ctx, data.name, W - 120, 96, (px) => `700 ${px}px "Cormorant Garamond", Georgia, serif`);
  ctx.font = `700 ${namePx}px "Cormorant Garamond", Georgia, serif`;
  ctx.fillText(data.name, 60, 836);

  ctx.fillStyle = '#9caf88';
  ctx.font = 'italic 600 44px "Cormorant Garamond", Georgia, serif';
  ctx.fillText(data.species, 62, 900);

  // Stat chips
  const stats: [string, string][] = [
    [`${data.daysAlive}`, 'days alive'],
    [`${data.checkIns}`, 'check-ins'],
    [`${data.guardianScore}`, 'guardian score'],
    [`${data.streak}d`, 'streak'],
  ];
  const chipGap = 16;
  const statW = (W - 120 - chipGap * 3) / 4;
  const SY = 952;
  stats.forEach(([value, label], i) => {
    const x = 60 + i * (statW + chipGap);
    ctx.fillStyle = 'rgba(244, 238, 225, 0.07)';
    roundRectPath(ctx, x, SY, statW, 150, 24);
    ctx.fill();
    ctx.strokeStyle = 'rgba(244, 238, 225, 0.14)';
    ctx.lineWidth = 2;
    roundRectPath(ctx, x, SY, statW, 150, 24);
    ctx.stroke();
    ctx.fillStyle = '#d4af37';
    ctx.font = '800 46px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(value, x + statW / 2, SY + 68);
    ctx.fillStyle = 'rgba(244, 238, 225, 0.62)';
    ctx.font = '600 20px Inter, sans-serif';
    ctx.fillText(label.toUpperCase(), x + statW / 2, SY + 112);
    ctx.textAlign = 'left';
  });

  // Footer lockup
  const FY = 1188;
  if (mark) ctx.drawImage(mark, 60, FY - 8, 104, 104);
  ctx.fillStyle = '#f4eee1';
  ctx.font = '600 44px "Cormorant Garamond", Georgia, serif';
  ctx.fillText('Diagnosed with ', 196, FY + 40);
  const after = ctx.measureText('Diagnosed with ').width;
  ctx.fillStyle = '#9bde8b';
  ctx.font = '700 44px "Cormorant Garamond", Georgia, serif';
  ctx.fillText('PhytoDoctor', 196 + after, FY + 40);
  ctx.fillStyle = 'rgba(244, 238, 225, 0.5)';
  ctx.font = '600 24px Inter, sans-serif';
  ctx.fillText('phytodoctor-ai.onrender.com', 198, FY + 84);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not render the share card.'))),
      'image/png'
    );
  });
}

/** The copy that accompanies a shared card. */
export function shareCaption(data: ShareCardData): string {
  const flex = data.rarity === 'common' || data.rarity === 'uncommon'
    ? `${data.name} is officially part of my collection`
    : `just pulled ${article(RARITY_CONFIGS[data.rarity]?.label ?? data.rarity)} ${data.name}`;
  return `${flex} — ${data.daysAlive} days alive and thriving. Diagnose yours free:`;
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`;
}
