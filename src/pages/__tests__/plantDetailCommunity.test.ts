import { describe, it, expect } from 'vitest';
import { readSource, stripJsComments } from '../../test/helpers';

/**
 * The PlantDetail community section: REAL Reddit threads only — this is the
 * app's one answer to "who else had this problem?", and the reason it can
 * say that is that nothing here is simulated. On-demand like the other
 * content sections, 7-day client cache, subreddit derived from the URL,
 * and no upvote counts because the engine doesn't reliably carry them.
 */

const detail = stripJsComments(readSource('src/pages/PlantDetail.tsx'));
const server = stripJsComments(readSource('src/server/communityThreads.ts'));

describe('PlantDetail community section', () => {
  it('the scan found the section it means to check', () => {
    expect(detail).toContain('From the community —');
    expect(detail).toContain('/api/library/community?${params.toString()}');
  });

  it('is on-demand, never fetched on mount', () => {
    expect(detail).toContain('{!threads && (');
    expect(detail).toContain('Find community threads');
    expect(detail).toContain('Asking around…');
  });

  it('derives the issue from the plant\u2019s own status', () => {
    // A struggling plant asks about problems; a healthy one about care.
    expect(detail).toContain("plant && plant.status !== 'Stable'");
    expect(detail).toContain('problem care help');
  });

  it('client cache mirrors the server window: 7 days, keyed by species + issue', () => {
    expect(detail).toContain('phyto_community_');
    expect(detail).toContain('7 * 86_400_000');
  });

  it('surfaces error bodies as honest notes (rate limit, outage)', () => {
    expect(detail).toContain('data.error ?? data.note ?? null');
  });

  it('links out safely and names the subreddit from the URL', () => {
    expect(detail).toContain('{t.subreddit && (');
    expect(detail).toContain('rel="noopener noreferrer"');
  });
});

describe('server honesty rules', () => {
  it('the scan found the module it means to check', () => {
    expect(server).toContain("'/api/library/community'");
  });

  it('queries real reddit threads, scoped to r/houseplants', () => {
    expect(server).toContain('site:reddit.com/r/houseplants');
  });

  it('derives the subreddit from the URL, never from thin air', () => {
    expect(server).toContain('reddit\\.com\\/r\\/([A-Za-z0-9_]+)');
    expect(server).toContain('`r/${m[1]}`');
  });

  it('renders no upvote counts — the engine does not reliably carry them', () => {
    // (Comments are stripped; the shape of the thread object is the
    // evidence.) The thread interface carries exactly title/url/snippet/
    // subreddit — no score, no ups, nothing invented.
    const iface = server.slice(
      server.indexOf('export interface CommunityThread'),
      server.indexOf('};', server.indexOf('export interface CommunityThread')),
    );
    expect(iface).toContain('title: string;');
    expect(iface).toContain('url: string;');
    expect(iface).toContain('snippet: string;');
    expect(iface).toContain('subreddit: string | null;');
    expect(server).not.toContain('upvotes');
    expect(iface).not.toContain('score');
  });

  it('subreddit identity comes from the thread URL', () => {
    // The reddit-URL filter itself lives beside a `//` regex the stripper
    // eats; subredditFromUrl is the durable evidence, and the behavioural
    // tests prove off-site results are filtered.
    expect(server).toContain('subredditFromUrl');
    expect(server).toContain('`r/${m[1]}`');
  });
});
