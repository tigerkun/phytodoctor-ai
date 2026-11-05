import { describe, it, expect } from 'vitest';
import { readSource, stripJsComments } from '../../test/helpers';

/**
 * Market real products (SERP Shopping Feature 1.1) — source-level tests
 * following the established pattern. Each scan first proves it found the
 * structures it means to police.
 */

const marketProducts = stripJsComments(readSource('src/server/marketProducts.ts'));
const serverEntry = stripJsComments(readSource('server.ts'));

describe('market products server module', () => {
  it('the scan found the module it means to check', () => {
    expect(marketProducts).toContain('registerMarketProductsRoute');
  });

  it('exports the route registration function', () => {
    expect(marketProducts).toContain('export function registerMarketProductsRoute');
  });

  it('uses serpApiSearch with google_shopping engine', () => {
    expect(marketProducts).toContain('serpApiSearch');
    expect(marketProducts).toContain('google_shopping');
  });

  it('checks serpApiStatus before fetching', () => {
    expect(marketProducts).toContain('serpApiStatus');
  });

  it('has cache with TTL', () => {
    expect(marketProducts).toContain('CACHE_TTL_MS');
    expect(marketProducts).toContain('cache.set');
    expect(marketProducts).toContain('cache.get');
  });

  it('extracts products from shopping results', () => {
    expect(marketProducts).toContain('extractProducts');
    expect(marketProducts).toContain('shopping_results');
  });

  it('requires category parameter', () => {
    expect(marketProducts).toContain('category');
    expect(marketProducts).toContain('400');
  });

  it('has category mapping', () => {
    expect(marketProducts).toContain('LIVE_CATEGORIES');
    expect(marketProducts).toContain('pots');
    expect(marketProducts).toContain('care');
    expect(marketProducts).toContain('tools');
  });

  it('has cache reset function for tests', () => {
    expect(marketProducts).toContain('_resetMarketProductsCacheForTests');
  });

  it('serves stale cache on error', () => {
    expect(marketProducts).toContain('stale: true');
    expect(marketProducts).toContain('cached');
  });

  it('extracts real product data', () => {
    expect(marketProducts).toContain('price');
    expect(marketProducts).toContain('rating');
    expect(marketProducts).toContain('reviews');
    expect(marketProducts).toContain('thumbnail');
    expect(marketProducts).toContain('link');
    expect(marketProducts).toContain('source');
  });

  it('filters invalid products', () => {
    expect(marketProducts).toContain('filter');
    expect(marketProducts).toContain('p.price > 0');
  });
});

describe('server wiring', () => {
  it('imports the market products route', () => {
    expect(serverEntry).toContain('import { registerMarketProductsRoute } from "./src/server/marketProducts";');
  });

  it('registers the route', () => {
    expect(serverEntry).toContain('registerMarketProductsRoute(app);');
  });
});
