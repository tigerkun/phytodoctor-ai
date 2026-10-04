import { describe, it, expect } from 'vitest';
import { readSource, stripJsComments, openingTags } from '../../test/helpers';

/**
 * Two measurements drove these tests.
 *
 * The Library rendered all 16 folio plates fully open at 390px — about 550px
 * each in a single 358px column, 10014px of page, 11.8 phone screens — so
 * reaching the last plate meant scrolling past fifteen others. Plates are now
 * closed rows carrying the identifying facts, opened one at a time.
 *
 * The onboarding tour's five buttons measured 16px, 40px and 42px, below the
 * 44px floor the rest of the app holds to, and the tour shows over every page,
 * so those were the only sub-44px targets left anywhere in the app.
 */

const library = stripJsComments(readSource('src/pages/Library.tsx'));
const tour = stripJsComments(readSource('src/components/OnboardingTour.tsx'));

describe('Library folio plates', () => {
  it('starts with every plate closed', () => {
    expect(library).toContain('const [openPlate, setOpenPlate] = useState<string | null>(null)');
  });

  it('toggles the tapped plate closed again', () => {
    // Without the `k === key ? null` arm, opening a second plate leaves the
    // first one open too and the page silently grows back.
    expect(library).toContain('setOpenPlate(k => (k === key ? null : key))');
  });

  it('gives each plate a single identified toggle', () => {
    expect(library).toContain('const key = `${disease.name}-${i}`');
    expect(library).toContain('const isOpen = openPlate === key');
    // Keyed on the same key it toggles: if the two disagreed, React would
    // remount the plate on every open and the animation would restart.
    expect(library).toContain('key={key}');
  });

  it('marks the toggle state for assistive tech', () => {
    expect(library).toContain('aria-expanded={isOpen}');
  });

  it('keeps the identifying facts on the closed row', () => {
    // A closed plate that only says "Tabula 07" is a list you cannot use.
    const header = library.slice(library.indexOf('aria-expanded={isOpen}'), library.indexOf('h-[3px] w-full'));
    expect(header).toContain('{disease.name}');
    expect(header).toContain('{disease.scientific}');
    expect(header).toContain('{disease.severity}');
    expect(header).toContain('{disease.organ}');
  });

  it('keeps the photograph and clinical detail behind the toggle', () => {
    const open = library.slice(library.indexOf('{isOpen && ('), library.indexOf('Evidence grade footer'));
    expect(open).toContain('{disease.symptoms}');
    expect(open).toContain('{disease.protocol}');
    expect(open).toContain('botanical specimen');
  });

  it('no longer stretches a closed plate to match an open sibling', () => {
    // h-full in a grid row makes every plate as tall as the tallest, so opening
    // one would re-inflate the other thirteen.
    const plate = openingTags(library, ['<motion.div'])
      .filter(t => t.tag.includes('antique-folio-plate') && t.tag.includes('cardVariants'));
    expect(plate).toHaveLength(1);
    expect(plate[0].tag).toContain('self-start');
    expect(plate[0].tag).not.toContain('h-full');
  });
});

describe('Onboarding tour targets', () => {
  it('gives every button the 44px touch target', () => {
    const buttons = openingTags(tour, ['<button']);
    expect(buttons.length).toBeGreaterThan(0);
    for (const { tag } of buttons) {
      expect(tag, `button without a 44px target: ${tag.slice(0, 90)}`).toContain('min-h-[44px]');
      expect(tag).toContain('items-center');
    }
  });
});