import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { shareCard, canShareFiles, type CardShareInput } from '../share';

/**
 * The share loop has one good path and two graceful degradations. What is
 * worth pinning: the native sheet carries BOTH the card file and the caption
 * when the device allows it, and a device with no Web Share API still walks
 * out with the link on the clipboard and the card downloaded -- never a dead
 * button.
 */

const input: CardShareInput = {
  blob: new Blob(['png-bytes'], { type: 'image/png' }),
  fileName: 'phyto-monso.png',
  caption: 'just pulled an Epic Monstera',
  url: 'https://phytodoctor-ai.onrender.com',
};

let shared: any[] = null;
let clipboard: string[] = null;
let downloads: string[] = null;
let realDocument: any = null;

beforeEach(() => {
  shared = [];
  clipboard = [];
  downloads = [];
  // Node has no clipboard, downloads or DOM in this environment; install
  // recording stubs, matching the localStorage-stub convention of the other
  // service tests.
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: async (t: string) => { clipboard.push(t); } },
    configurable: true,
  });
  (globalThis as any).URL.createObjectURL = vi.fn(() => 'blob:mock');
  (globalThis as any).URL.revokeObjectURL = vi.fn();
  realDocument = (globalThis as any).document;
  (globalThis as any).document = {
    createElement: (tag: string) => ({
      tagName: tag,
      href: '',
      download: '',
      click() { downloads.push(this.download); },
      remove() {},
    }),
    body: { appendChild() {}, removeChild() {} },
  };
});

afterEach(() => {
  vi.restoreAllMocks();
  delete (navigator as any).share;
  delete (navigator as any).canShare;
  delete (navigator as any).clipboard;
  (globalThis as any).document = realDocument;
});

function installShare(canFiles: boolean | null) {
  if (canFiles === null) return; // leave the API absent
  (navigator as any).canShare = (data: any) => Array.isArray(data.files) ? canFiles : true;
  (navigator as any).share = async (data: any) => { shared.push(data); };
}

describe('share loop', () => {
  it('hands the card file and caption to the native sheet when files are shareable', async () => {
    installShare(true);
    const outcome = await shareCard(input);
    expect(outcome).toBe('shared');
    expect(shared).toHaveLength(1);
    expect(shared[0].files[0].name).toBe('phyto-monso.png');
    expect(shared[0].text).toContain('just pulled an Epic Monstera');
    expect(shared[0].text).toContain('https://phytodoctor-ai.onrender.com');
    expect(downloads).toHaveLength(0);
  });

  it('falls back to a text-only sheet when the device refuses files', async () => {
    installShare(false);
    const outcome = await shareCard(input);
    expect(outcome).toBe('shared-link');
    expect(shared[0].url).toBe(input.url);
    expect(shared[0].text).toContain('Epic Monstera');
  });

  it('on devices with no Web Share API, copies the link and downloads the card', async () => {
    installShare(null);
    const outcome = await shareCard(input);
    expect(outcome).toBe('copied');
    expect(clipboard[0]).toContain('https://phytodoctor-ai.onrender.com');
    expect(clipboard[0]).toContain('Epic Monstera');
    expect(downloads).toEqual(['phyto-monso.png']);
  });

  it('a clipboard failure does not lose the download', async () => {
    installShare(null);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: async () => { throw new Error('blocked'); } },
      configurable: true,
    });
    const outcome = await shareCard(input);
    expect(outcome).toBe('copied');
    expect(downloads).toEqual(['phyto-monso.png']);
  });

  it('canShareFiles probes with a real file', async () => {
    installShare(true);
    expect(canShareFiles()).toBe(true);
    installShare(false);
    expect(canShareFiles()).toBe(false);
    installShare(null);
    expect(canShareFiles()).toBe(false);
  });
});
