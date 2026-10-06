/**
 * Prepares a user photo for the diagnosis upload.
 *
 * Modern phone cameras emit 3–8 MB JPEGs. Base64-inflated that is 4–11 MB per
 * scan — slow on mobile data, and past the server's 6 MB hard cap, where the
 * scan dies with 413 before the AI ever sees it. Diagnosis quality does not
 * need those pixels: the model reads structure and symptoms, not lens
 * micro-detail, so the photo is downscaled to fit within a 2048px edge and
 * re-encoded as JPEG quality 0.85 (typically 200–500 KB).
 *
 * Falls back to the untouched file whenever the fast path is unavailable —
 * an un-optimised scan is strictly better than no scan.
 */

export const MAX_SCAN_EDGE = 2048;
export const SCAN_JPEG_QUALITY = 0.85;

export interface PreparedImage {
  /** A `data:image/...;base64,...` URL ready for identifyPlant(). */
  dataUrl: string;
  /** Roughly how much smaller the payload became (1 = unchanged). */
  scaleFactor: number;
}

/** Read a File/Blob as a data URL — the shared fallback path. */
export function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.onloadend = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

export async function prepareScanImage(file: File): Promise<PreparedImage> {
  const raw = await readAsDataUrl(file);
  // The bitmap is a GPU-backed handle: if anything between createImageBitmap
  // and close() throws, the finally is what keeps it from leaking.
  let bitmap: ImageBitmap | null = null;
  try {
    // imageOrientation:'from-image' bakes EXIF rotation into the pixels, so
    // the model sees the leaf the way the photographer did — a rotated upload
    // used to reach the server sideways on browsers that don't auto-orient.
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });

    // Small-enough files pass through untouched: re-encoding costs a beat of
    // CPU and a little quality for zero bandwidth win.
    const longestEdge = Math.max(bitmap.width, bitmap.height);
    const rawKB = Math.round(file.size / 1024);
    if (rawKB <= 800 && longestEdge <= MAX_SCAN_EDGE) {
      return { dataUrl: raw, scaleFactor: 1 };
    }

    const scale = Math.min(1, MAX_SCAN_EDGE / longestEdge);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    // White, not transparent: JPEG has no alpha channel, and a transparent
    // leaf photo re-encoded to JPEG would otherwise come out black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', SCAN_JPEG_QUALITY);
    if (dataUrl.length >= raw.length) {
      // Pathological case (tiny dim, huge metadata): the original is smaller.
      return { dataUrl: raw, scaleFactor: 1 };
    }
    return { dataUrl, scaleFactor: raw.length / dataUrl.length };
  } catch {
    // Decode failed (unsupported codec, memory pressure, ancient browser):
    // the server's own format checks and size cap still apply.
    return { dataUrl: raw, scaleFactor: 1 };
  } finally {
    bitmap?.close();
  }
}
