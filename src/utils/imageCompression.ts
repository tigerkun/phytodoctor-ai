/**
 * Canvas-based downscale/re-encode for user photos.
 *
 * Camera photos are 3-6 MB; the vision model needs at most ~1280px, and every
 * extra megabyte is upload time on the scan path's critical route (the photo
 * travels to the API as base64 inside JSON, a ~33% inflation). Compression is
 * best-effort: any failure falls back to the original data URL so scanning
 * never breaks because of it.
 */
export interface CompressOptions {
  maxDimension?: number;
  quality?: number;
  mimeType?: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image could not be decoded'));
    img.src = src;
  });
}

export async function compressImageToDataUrl(
  source: Blob | string,
  { maxDimension = 1280, quality = 0.8, mimeType = 'image/jpeg' }: CompressOptions = {}
): Promise<string> {
  try {
    const dataUrl =
      typeof source === 'string'
        ? source
        : await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error('Image could not be read'));
            reader.readAsDataURL(source);
          });

    const img = await loadImage(dataUrl);
    const width = img.naturalWidth || img.width;
    const height = img.naturalHeight || img.height;
    if (!width || !height) return dataUrl;

    const scale = Math.min(1, maxDimension / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return dataUrl;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const compressed = canvas.toDataURL(mimeType, quality);
    // Only use the re-encode when it is actually smaller.
    return compressed.length < dataUrl.length ? compressed : dataUrl;
  } catch {
    return typeof source === 'string' ? source : '';
  }
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
