import { describe, it, expect } from 'vitest';
import { readSource, stripJsComments, openingTags, tagAround } from '../../test/helpers';
import { PROFILE_FOLIOS, type ProfileFolio } from '../Profile';

/**
 * Measured at 390px, Profile was one flat 4849px scroll — 5.7 phone screens.
 * The level and seed totals sat two screens down and the settings four and a
 * half down, so opening the passport to check one thing meant scrolling past
 * the other four with nothing to say where you were. These tests pin the fix:
 * on a phone exactly one folio is reachable at a time behind an explicit tab
 * bar, and on a wide screen the original two-column booklet is untouched.
 */

const source = stripJsComments(readSource('src/pages/Profile.tsx'));

describe('Profile folios', () => {
  it('offers all five parts of the passport', () => {
    expect(PROFILE_FOLIOS.map(f => f.id)).toEqual<ProfileFolio[]>([
      'passport', 'mastery', 'badges', 'treasury', 'settings',
    ]);
  });

  it('labels every folio for the tab bar', () => {
    for (const { id, label } of PROFILE_FOLIOS) {
      expect(label.length).toBeGreaterThan(2);
      expect(id).not.toBe(label);
    }
  });

  it('renders a tab button per folio, marked as the current one when active', () => {
    const nav = source.slice(source.indexOf('Passport sections'), source.indexOf('MAIN TWO-COLUMN PASSPORT LAYOUT'));
    expect(nav).toContain('PROFILE_FOLIOS.map');
    expect(nav).toContain('setFolio(id)');
    // A tab bar with no current-tab signal leaves the reader guessing which
    // section they are in — the exact thing the bar exists to replace.
    expect(nav).toContain('aria-current');
  });

  it('keeps the tab bar off the two-column booklet layout', () => {
    const nav = tagAround(source, 'Passport sections', ['<nav']);
    expect(nav).toContain('lg:hidden');
  });

  it('gives the left booklet column to the passport tab and hides it otherwise', () => {
    const col = openingTags(source, ['<div']).filter(t => t.tag.includes('lg:col-span-5'));
    expect(col).toHaveLength(1);
    expect(col[0].tag).toContain("folio === 'passport' ? 'space-y-8' : 'hidden lg:block'");
  });

  it('shows exactly one right-column folio on a phone', () => {
    const sections = openingTags(source, ['<section']);
    const folios = sections.filter(t => t.tag.includes('passport-visa-folio'));
    expect(folios).toHaveLength(4);
    for (const { tag } of folios) {
      // Each folio is either the selected one or display:none below lg. A folio
      // with neither condition is always visible, which is what re-creates the
      // long flat scroll this bar removed.
      expect(tag).toMatch(/folio === '\w+' \? '' : 'hidden lg:block'/);
    }
    // ...and each is selected by a different tab, so the four cannot all be
    // toggled by one click.
    const ids = folios.map(t => t.tag.match(/folio === '(\w+)'/)?.[1]);
    expect(new Set(ids).size).toBe(4);
  });

  it('does not let space-y open a gap above the one visible folio', () => {
    const col = openingTags(source, ['<div']).filter(t => t.tag.includes('lg:col-span-7'));
    expect(col).toHaveLength(1);
    // space-y-8 styles *every* sibling, hidden ones included, so with four
    // folios display:none the container would open 2rem of dead space.
    expect(col[0].tag).toContain('space-y-0 lg:space-y-8');
  });
});