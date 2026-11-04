import { describe, it, expect } from 'vitest';
import { readSource, stripJsComments } from '../../test/helpers';

/**
 * The PlantDetail video-tutorials section: the care-guide pattern with a
 * 30-day window. On-demand (never fetched on mount), client-cached for the
 * same window the server cache runs, honest notes on degrade, and only real
 * engine fields rendered.
 */

const detail = stripJsComments(readSource('src/pages/PlantDetail.tsx'));
const server = stripJsComments(readSource('src/server/speciesVideos.ts'));

describe('PlantDetail video tutorials section', () => {
  it('the scan found the section it means to check', () => {
    expect(detail).toContain('Watch &amp; learn —');
    expect(detail).toContain('/api/library/videos?species=${encodeURIComponent(plant.species)}');
  });

  it('is on-demand, like the care guides — never fetched on mount', () => {
    expect(detail).toContain('{!videos && (');
    expect(detail).toContain('Find video tutorials');
    expect(detail).toContain('Searching the archive…');
  });

  it('client cache mirrors the server window: 30 days, per species', () => {
    expect(detail).toContain('phyto_species_videos_');
    expect(detail).toContain('30 * 86_400_000');
  });

  it('degrades with the server\u2019s honest note, never a fake list', () => {
    expect(detail).toContain('{videosNote && (');
    expect(detail).toContain("'Video lookup failed.'");
  });

  it('renders engine fields only — channel, views, length, date as printed', () => {
    expect(detail).toContain('{v.channel ?? \u0027YouTube\u0027}');
    expect(detail).toContain('{v.views ? ` · ${v.views}`');
    expect(detail).toContain('{v.length ? ` · ${v.length}`');
    expect(detail).toContain('{v.published ? ` · ${v.published}`');
  });

  it('links out safely to the video', () => {
    expect(detail).toContain('target="_blank"');
    expect(detail).toContain('rel="noopener noreferrer"');
  });
});

describe('server module budget', () => {
  it('the scan found the module it means to check', () => {
    expect(server).toContain("'/api/library/videos'");
  });

  it('the youtube engine runs on the shared metered client', () => {
    expect(server).toContain("serpApiSearch('youtube'");
    expect(server).toContain('CACHE_TTL_MS = 30 * 86_400_000');
  });

  it('extraction caps the list and reads the youtube payload', () => {
    // (The URL guard regex contains `//` and is stripped by the comment
    // filter; the cap constant and payload key are the durable evidence.)
    expect(server).toContain('MAX_VIDEOS = 4');
    expect(server).toContain('video_results');
  });
});
