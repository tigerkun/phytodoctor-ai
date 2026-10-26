import { describe, it, expect } from 'vitest';
import { readSource, stripJsComments } from '../../test/helpers';

const library = stripJsComments(readSource('src/pages/Library.tsx'));
const blogs = stripJsComments(readSource('src/components/ui/blogs-3.tsx'));

describe('Library field blog', () => {
  it('mounts the plant blog grid on the Library page', () => {
    expect(library).toContain("import BlogsSection from '../components/ui/blogs-3'");
    expect(library).toContain('<BlogsSection />');
  });

  it('ships photographed plant and environment plates', () => {
    const titles = [...blogs.matchAll(/title:\s*'([^']+)'/g)].map((m) => m[1]);
    const images = [...blogs.matchAll(/image:\s*\n\s*'([^']+)'/g)].map((m) => m[1]);
    const hrefs = [...blogs.matchAll(/href:\s*'([^']+)'/g)].map((m) => m[1]);
    expect(titles.length).toBeGreaterThan(8);
    expect(images.length).toBe(titles.length);
    expect(hrefs.length).toBe(titles.length);
    expect(images.every((src) => src.startsWith('https://images.unsplash.com/'))).toBe(true);
    expect(hrefs.every((href) => href.startsWith('https://'))).toBe(true);
    const haystack = titles.join(' ').toLowerCase();
    expect(haystack).toMatch(/tree|plant|bamboo|lotus|mangrove|flytrap|banana/i);
  });
});
