import { describe, it, expect } from 'vitest';
import { readSource, stripJsComments } from '../../test/helpers';
import { ALL_CATEGORIES } from '../HelpPage';

/**
 * Measured at 390px the Help centre was 3461px — 4.1 phone screens — for 38
 * answers in 8 categories, with no way to reach a category except scrolling
 * past the other seven or already knowing a word to search for. These tests
 * pin the category bar and, just as importantly, that category and search
 * *compose*: picking "Market" and then typing must narrow within Market rather
 * than throw the choice away or silently search every category.
 */

const source = stripJsComments(readSource('src/pages/HelpPage.tsx'));

const CATEGORY_COUNT = 8;
const FAQ_COUNT = 38;

describe('Help categories', () => {
  it('opens on every category', () => {
    expect(ALL_CATEGORIES).toBe('All');
    expect(source).toContain('const [category, setCategory] = useState<string>(ALL_CATEGORIES)');
  });

  it('keys the choice on the category title, not its position', () => {
    // An index would silently shift the selection if a category were ever
    // inserted or reordered — the bar would show one category lit while the
    // list showed another.
    expect(source).toContain('category === ALL_CATEGORIES || c.title === category');
    expect(source).toContain('setCategory(c.title)');
  });

  it('narrows within the chosen category instead of replacing it', () => {
    const memo = source.slice(source.indexOf('const filtered = useMemo'), source.indexOf('const resultCount'));
    // Both inputs must reach the same computation, or choosing a category and
    // then typing would do one of the two silently.
    expect(memo).toContain('.filter(c => category === ALL_CATEGORIES || c.title === category)');
    expect(memo).toContain('c.items.filter(');
    expect(source).toContain('}, [query, category]);');
  });

  it('still lets the search box accept typed text', () => {
    // A category reset wired into onChange looks reasonable and is a trap: it
    // can discard the value the user just typed.
    const input = source.slice(source.indexOf('type="search"'), source.indexOf('Category bar'));
    expect(input).toContain('onChange={e => setQuery(e.target.value)}');
  });

  it('renders one chip per category plus All', () => {
    const chips = source.slice(source.indexOf('aria-label="Help categories"'), source.indexOf('resultCount} answer'));
    expect(chips).toContain('FAQS.map(c =>');
    expect(chips).toContain('{c.short}');
    expect(chips).toContain('setCategory(ALL_CATEGORIES)');
    // Both chips, not one: with aria-current on only the category chips, the
    // "All" view — the page's default state — shows nothing marked as current.
    expect((chips.match(/aria-current/g) || []).length).toBe(2);
  });

  it('gives every chip the 44px touch target', () => {
    const nav = source.slice(source.indexOf('aria-label="Help categories"'), source.indexOf('resultCount} answer'));
    // The All chip and the per-category chip are the only two button sources in
    // the bar; both carry shrink-0 so a long category name scrolls the row
    // instead of squashing the row's tap targets.
    expect((nav.match(/<button/g) || []).length).toBe(2);
    expect((nav.match(/shrink-0/g) || []).length).toBe(2);
    expect(nav).toContain('overflow-x-auto');
  });

  it('uses the app-wide tab idiom rather than a third tab shape', () => {
    expect(source).toContain('bazaar-tab');
    expect(source).toContain("is-on");
  });

  it('names the category when a search inside it finds nothing', () => {
    // "Nothing matches zzzz" while Market is lit sends the reader hunting for a
    // missing feature; the message has to say where they are and how to leave.
    const empty = source.slice(source.indexOf('{resultCount === 0 &&'), source.indexOf('<div className="space-y-8">'));
    expect(empty).toContain('category !== ALL_CATEGORIES');
    expect(empty).toContain('{category}');
  });

  it('does not shadow the category state inside the list map', () => {
    const list = source.slice(source.indexOf('<div className="space-y-8">'), source.indexOf('CTA / COLOPHON') >= 0 ? source.indexOf('CTA / COLOPHON') : source.length);
    expect(list).toContain('filtered.map(cat =>');
    expect(list).not.toMatch(/filtered\.map\(category/);
  });

  it('keeps every answer reachable', () => {
    expect(source).toContain('const TOTAL = FAQS.reduce((n, c) => n + c.items.length, 0);');
    // The eight categories and 38 answers the audit counted must still be there:
    // filtering is a way in, never a way to drop content.
    expect((source.match(/^\s{4}short: '/gm) || []).length).toBe(CATEGORY_COUNT);
    expect((source.match(/^\s{8}q: '/gm) || []).length).toBe(FAQ_COUNT);
  });
});