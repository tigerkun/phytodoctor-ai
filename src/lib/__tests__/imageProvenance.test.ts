import { describe, it, expect } from 'vitest';
import { readImageSignals, assessProvenance, type ImageSignals } from '../imageProvenance';

/**
 * The provenance gate decides whether a scan pays seeds, so both halves get
 * pinned: the byte-level readers (which run on untrusted input) and the verdict
 * combiner (whose defaults must lean toward letting honest photos through).
 */

// ── synthetic containers ──

function jpegWithExif(tags: { make?: string; model?: string; software?: string; taken?: string }): Uint8Array {
  // A little-endian TIFF block: IFD0 at offset 8, string values stored
  // out-of-line after the IFD, as the spec requires for anything over 4 bytes.
  const ascii = (s: string) => [...s].map(c => c.charCodeAt(0));
  const entries: { tag: number; data: number[] }[] = [];
  const push = (tag: number, s?: string) => { if (s) entries.push({ tag, data: ascii(s) }); };
  push(0x010f, tags.make);
  push(0x0110, tags.model);
  push(0x9003, tags.taken);
  push(0x0131, tags.software);

  const ifdOffset = 8;
  const ifdSize = 2 + entries.length * 12 + 4;
  const valuesOffset = ifdOffset + ifdSize;
  const total = valuesOffset + entries.reduce((n, e) => n + e.data.length, 0);
  const tiff = new Uint8Array(total);
  const dv = new DataView(tiff.buffer);
  tiff[0] = 0x49; tiff[1] = 0x49; // "II" little-endian
  dv.setUint16(2, 42, true);
  dv.setUint32(4, ifdOffset, true);
  dv.setUint16(ifdOffset, entries.length, true);

  let writeAt = valuesOffset;
  entries.forEach((e, i) => {
    const off = ifdOffset + 2 + i * 12;
    dv.setUint16(off, e.tag, true);
    dv.setUint16(off + 2, 2, true); // ASCII
    dv.setUint32(off + 4, e.data.length, true);
    if (e.data.length <= 4) {
      e.data.forEach((b, j) => tiff[off + 8 + j] = b);
    } else {
      dv.setUint32(off + 8, writeAt, true);
      tiff.set(e.data, writeAt);
      writeAt += e.data.length;
    }
  });

  const exifPayload = new Uint8Array(6 + tiff.length);
  exifPayload.set([0x45, 0x78, 0x69, 0x66, 0, 0]); // "Exif\0\0"
  exifPayload.set(tiff, 6);

  const segs: number[][] = [[0xff, 0xd8]];
  const app1 = [0xff, 0xe1, 0, 0];
  const len = exifPayload.length + 2;
  app1[2] = (len >> 8) & 0xff; app1[3] = len & 0xff;
  segs.push(app1, [...exifPayload], [0xff, 0xda, 0, 2]);
  return new Uint8Array(segs.flat());
}

function pngWithText(chunks: { keyword: string; value: string }[]): Uint8Array {
  const parts: number[][] = [[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]];
  // IHDR: 1024x1024, the default canvas of most generators.
  const ihdr = new Uint8Array(13);
  new DataView(ihdr.buffer).setUint32(0, 1024);
  new DataView(ihdr.buffer).setUint32(4, 1024);
  parts.push([0, 0, 0, 13], [...'IHDR'].map(c => c.charCodeAt(0)), [...ihdr], [0, 0, 0, 0]);
  for (const { keyword, value } of chunks) {
    const data = [...keyword].map(c => c.charCodeAt(0)).concat([0], [...value].map(c => c.charCodeAt(0)));
    parts.push([(data.length >>> 24) & 0xff, (data.length >>> 16) & 0xff, (data.length >>> 8) & 0xff, data.length & 0xff]);
    parts.push([...'tEXt'].map(c => c.charCodeAt(0)), data, [0, 0, 0, 0]);
  }
  return new Uint8Array(parts.flat());
}

function plainJpeg(): Uint8Array {
  // SOF0 with 1024x1024 and nothing else -- the shape of a stripped export.
  return new Uint8Array([0xff, 0xd8, 0xff, 0xc0, 0, 11, 8, 0x04, 0x00, 0x04, 0x00, 1, 0, 0xff, 0xda, 0, 2]);
}

// ── readers ──

describe('provenance: container readers', () => {
  it('reads camera make, model and capture time from EXIF', () => {
    const s = readImageSignals(jpegWithExif({ make: 'Google', model: 'Pixel 8', taken: '2026:09:30 10:00:00' }));
    expect(s.container).toBe('jpeg');
    expect(s.cameraMake).toBe('Google');
    expect(s.cameraModel).toBe('Pixel 8');
    expect(s.capturedAt).toBe('2026:09:30 10:00:00');
  });

  it('reads a software tag out of EXIF', () => {
    const s = readImageSignals(jpegWithExif({ make: 'Google', model: 'Pixel 8', software: 'Adobe Photoshop 25.0' }));
    expect(s.softwareTag).toBe('Adobe Photoshop 25.0');
  });

  it('reads PNG dimensions and tEXt software/prompt chunks', () => {
    const s = readImageSignals(pngWithText([
      { keyword: 'Software', value: 'Stable Diffusion' },
      { keyword: 'parameters', value: 'a monstera, cinematic lighting' },
    ]));
    expect(s.container).toBe('png');
    expect(s.width).toBe(1024);
    expect(s.height).toBe(1024);
    expect(s.softwareTag).toBe('Stable Diffusion');
    expect(s.embeddedPrompt).toContain('monstera');
  });

  it('survives truncated and random input without throwing', () => {
    expect(() => readImageSignals(new Uint8Array([0xff, 0xd8, 0xff]))).not.toThrow();
    expect(() => readImageSignals(new Uint8Array(0))).not.toThrow();
    expect(() => readImageSignals(new Uint8Array([1, 2, 3, 4, 5]))).not.toThrow();
    const garbage = readImageSignals(new Uint8Array([0xff, 0xe1, 0, 4, 0, 0, 0, 0]));
    expect(garbage.container).toBe('unknown');
  });

  it('detects dimensions in a stripped JPEG', () => {
    const s = readImageSignals(plainJpeg());
    expect(s.container).toBe('jpeg');
    expect(s.width).toBe(1024);
    expect(s.height).toBe(1024);
  });
});

// ── verdict ──

const base: ImageSignals = {
  container: 'jpeg', width: 3024, height: 4032, cameraMake: null, cameraModel: null,
  capturedAt: null, softwareTag: null, aiGeneratorTag: null, hasC2pa: false, embeddedPrompt: null,
};

describe('provenance: verdict', () => {
  it('camera metadata with clean forensics is self_captured', () => {
    const v = assessProvenance({ ...base, cameraMake: 'Google', cameraModel: 'Pixel 8', capturedAt: '2026:09:30' }, null);
    expect(v.verdict).toBe('self_captured');
    expect(v.checks.captureMetadata).toBe('pass');
  });

  it('an AI generator tag convicts regardless of anything else', () => {
    const v = assessProvenance({ ...base, cameraMake: 'Google', aiGeneratorTag: 'Midjourney v6' }, null);
    expect(v.verdict).toBe('likely_synthetic');
  });

  it('an embedded generation prompt convicts', () => {
    const v = assessProvenance({ ...base, embeddedPrompt: 'parameters: monstera, 8k' }, null);
    expect(v.verdict).toBe('likely_synthetic');
  });

  it('C2PA without camera metadata convicts; with camera metadata it does not', () => {
    const flagged = assessProvenance({ ...base, hasC2pa: true }, null);
    expect(flagged.verdict).toBe('likely_synthetic');

    const signed = assessProvenance({ ...base, cameraMake: 'Leica', cameraModel: 'M11', capturedAt: '2026:09:30', hasC2pa: true }, null);
    expect(signed.verdict).toBe('self_captured');
  });

  it('a confident model call convicts only when the file backs it up', () => {
    const bare = assessProvenance(base, { appearsAiGenerated: true, confidence: 0.9 });
    expect(bare.verdict).toBe('likely_synthetic');

    // Camera metadata says otherwise: metadata outranks the model's read.
    const withCamera = assessProvenance(
      { ...base, cameraMake: 'Google', capturedAt: '2026:09:30' },
      { appearsAiGenerated: true, confidence: 0.9 }
    );
    expect(withCamera.verdict).not.toBe('likely_synthetic');
  });

  it('a low-confidence model call never convicts', () => {
    const v = assessProvenance(base, { appearsAiGenerated: true, confidence: 0.5 });
    expect(v.verdict).toBe('unverified');
  });

  it('a stripped screenshot lands unverified, not synthetic', () => {
    const v = assessProvenance({ ...base, width: 1024, height: 1024 }, null);
    expect(v.verdict).toBe('unverified');
    expect(v.reasons.some(r => r.includes('No camera metadata'))).toBe(true);
  });

  it('an editor software tag does not convict a camera photo', () => {
    const v = assessProvenance(
      { ...base, cameraMake: 'Google', cameraModel: 'Pixel 8', capturedAt: '2026:09:30', softwareTag: 'Adobe Photoshop 25.0' },
      null
    );
    expect(v.verdict).toBe('self_captured');
  });

  it('an editor tag without camera metadata stays unverified', () => {
    const v = assessProvenance({ ...base, softwareTag: 'GIMP 2.10' }, null);
    expect(v.verdict).toBe('unverified');
  });
});
