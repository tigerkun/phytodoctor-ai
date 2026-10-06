import { describe, it, expect } from 'vitest';
import { readSource, stripJsComments, openingTags, tagAround } from '../../test/helpers';
import { DISPATCH_FOLIOS, type DispatchFolio } from '../home/GardenCoach';

/**
 * Measured at 390px the Head Gardener's Dispatch was 1592px — 1.5 phone screens —
 * four full-width cards stacked with the treatment plan, the shop, the weather
 * forecast and a line of trivia reading as one undifferentiated column. The
 * grid's own comment claimed "Horizontal Snapping", but `grid-cols-1` put all
 * four in a single column and nothing about them snapped.
 *
 * These tests pin the phone folio bar, and just as much that the four-across
 * grid still returns at `lg` — the point of the change is fewer screens on a
 * phone, not a worse desktop.
 */

const source = stripJsComments(readSource('src/components/home/GardenCoach.tsx'));

describe('Garden Coach dispatches', () => {
  it('offers all four dispatches, in grid order', () => {
    expect(DISPATCH_FOLIOS.map(f => f.id)).toEqual<DispatchFolio[]>([
      'plan', 'apothecary', 'forecast', 'lore',
    ]);
  });

  it('labels every dispatch for the tab bar', () => {
    for (const { id, label } of DISPATCH_FOLIOS) {
      expect(label.length).toBeGreaterThan(2);
      expect(id).not.toBe(label);
    }
  });

  it('opens on the treatment plan, not on an arbitrary card', () => {
    // The plan is the only dispatch with a real action on it, so it is the one
    // worth a phone screen's worth of attention by default.
    expect(source).toContain('useState<DispatchFolio>(\'plan\')');
  });

  it('renders a tab button per dispatch, marked current when active', () => {
    const nav = source.slice(
      source.indexOf("Head gardener's dispatches"),
      source.indexOf('grid grid-cols-1 lg:grid-cols-4'),
    );
    expect(nav).toContain('DISPATCH_FOLIOS.map');
    expect(nav).toContain('setFolio(id)');
    expect(nav).toContain('aria-current');
  });

  it('keeps the tab bar off the four-across grid', () => {
    const nav = tagAround(source, "Head gardener's dispatches", ['<nav']);
    expect(nav).toContain('lg:hidden');
  });

  it('shows exactly one dispatch on a phone, each behind a different tab', () => {
    const cards = openingTags(source, ['<motion.div']).filter(t => t.tag.includes('oiled-teak-frame'));
    expect(cards).toHaveLength(4);
    for (const { tag } of cards) {
      // A card with neither condition is always visible, which is what
      // re-creates the long flat column this bar removed.
      expect(tag).toMatch(/folio === '\w+' \? '' : 'hidden lg:flex'/);
    }
    const ids = cards.map(t => t.tag.match(/folio === '(\w+)'/)?.[1]);
    expect(new Set(ids).size).toBe(4);
    expect(ids).toEqual(DISPATCH_FOLIOS.map(f => f.id));
  });

  it('restores the visible display so hidden cards keep their flex direction', () => {
    // `hidden` is display:none and `flex` is display:flex; dropping the
    // `lg:flex` half would leave the three off-phone cards display:none even on
    // a wide screen, where the grid is supposed to show all four.
    const cards = openingTags(source, ['<motion.div']).filter(t => t.tag.includes('oiled-teak-frame'));
    for (const { tag } of cards) {
      expect(tag).toContain("'hidden lg:flex'");
      // flex-col must survive, or the wide-screen cards lose their layout.
      expect(tag).toContain('flex-col');
    }
  });

  it('drops the grid to one column before the four-across one', () => {
    // `md:grid-cols-2` would put the single phone-visible card in one half of
    // a two-column grid from 768px to 1024px — an empty cell beside every card.
    // The grid is a motion.div now — it staggers its four cards into view — so
    // the scan has to see motion tags as well as plain ones.
    const grid = openingTags(source, ['<div', '<motion.div']).find(t => t.tag.includes('grid-cols-1 lg:grid-cols-4'));
    expect(grid, 'the dispatch grid was not found').toBeDefined();
    expect(grid!.tag).not.toContain('md:grid-cols-2');
  });
});