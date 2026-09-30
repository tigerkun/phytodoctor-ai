/**
 * SHARE PLUMBING
 *
 * The Web Share API with files is the whole point -- it puts the card straight
 * into Instagram stories, TikTok, WhatsApp and Discord on the devices this
 * audience actually holds. But it only exists on mobile and a slice of desktop,
 * so every level of capability degrades gracefully instead of failing:
 *
 *   files shareable  -> native sheet with the PNG (the good path)
 *   share, no files  -> native sheet with the caption + link
 *   neither          -> clipboard the link, download the card, say so
 */

export type ShareOutcome = 'shared' | 'shared-link' | 'copied' | 'downloaded';

interface ShareLike {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data: ShareData) => boolean;
}

function shareApi(): ShareLike | null {
  const nav = navigator as Navigator & ShareLike;
  return nav.canShare && nav.share ? nav : null;
}

export interface CardShareInput {
  blob: Blob;
  fileName: string;
  caption: string;
  url: string;
}

export async function shareCard(input: CardShareInput): Promise<ShareOutcome> {
  const nav = shareApi();
  const file = new File([input.blob], input.fileName, { type: 'image/png' });

  if (nav && nav.canShare!({ files: [file] })) {
    await nav.share!({ files: [file], text: `${input.caption} ${input.url}` });
    return 'shared';
  }

  if (nav) {
    await nav.share({ title: 'PhytoDoctor', text: `${input.caption} ${input.url}`, url: input.url });
    return 'shared-link';
  }

  // No Web Share at all (rare desktop browsers): put the link on the clipboard
  // and save the card, so the user still gets both halves of the post.
  try {
    await navigator.clipboard.writeText(`${input.caption} ${input.url}`);
  } catch { /* clipboard may be blocked; the download still stands */ }
  triggerDownload(input.blob, input.fileName);
  return 'copied';
}

export function triggerDownload(blob: Blob, fileName: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** Only the devices that can do the good path show a plain "Share" label. */
export function canShareFiles(): boolean {
  const nav = shareApi();
  if (!nav) return false;
  const probe = new File([new Blob(['x'])], 'probe.png', { type: 'image/png' });
  return nav.canShare!({ files: [probe] });
}
