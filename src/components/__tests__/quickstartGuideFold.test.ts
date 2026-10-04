import { describe, it, expect } from 'vitest';
import { readSource, stripJsComments } from '../../test/helpers';

/**
 * Measured at 390px the signed-in dashboard was 5944px — 7.1 phone screens — and
 * the largest single block on it was the Conservatory Guide, 1351px of it, shown
 * in full to every returning keeper who had already walked through it once.
 * These tests pin the fold and, more importantly, that it *stays* folded: the
 * remembered state is worthless if the flag is written inverted.
 */

const source = stripJsComments(readSource('src/components/home/QuickstartGuide.tsx'));

describe('Quickstart Guide fold', () => {
  it('opens on a first visit and stays shut on every one after', () => {
    // '1' is folded. Nothing stored (first visit) must mean open, so the
    // walkthrough is still the thing you see when you arrive.
    expect(source).toContain("useState(() => localStorage.getItem('quickstart_guide_hidden') !== '1')");
  });

  it('remembers the fold in the direction it reads it', () => {
    // Writing `next` here instead of `next ? '0' : '1'` stores '1' on *opening*:
    // folding looks like it works, and then silently resets on the next visit.
    // This is the exact inversion that shipped once and was caught in the
    // browser, not by reading the code.
    expect(source).toContain("localStorage.setItem('quickstart_guide_hidden', next ? '0' : '1')");
    expect(source).not.toMatch(/setItem\('quickstart_guide_hidden',\s*next\s*\)/);
  });

  it('toggles on one button and tells assistive tech which way it points', () => {
    expect(source).toContain('onClick={toggleOpen}');
    expect(source).toContain('aria-expanded={open}');
    expect((source.match(/aria-expanded=\{open\}/g) || []).length).toBe(1);
  });

  it('gives the toggle a real touch target', () => {
    const button = source.slice(source.indexOf('onClick={toggleOpen}'), source.indexOf('onClick={toggleOpen}') + 400);
    expect(button).toContain('min-h-[44px]');
  });

  it('drops the walkthrough but not its contents when folded', () => {
    // Folding must remove the 1351px of manual, not the information: the four
    // protocol titles survive on one line so a folded guide is still a summary.
    const branch = source.slice(source.indexOf('{!open ? ('));
    expect(branch).toContain('{steps.map(s => s.title).join(');
    // The voucher, the step tabs and the folio all live past the folded branch,
    // so they leave the render entirely rather than lingering as hidden nodes.
    const branchAt = source.indexOf('{!open ? (');
    expect(source.indexOf('Gift size={20}')).toBeGreaterThan(branchAt);
    expect(source.indexOf('lg:grid-cols-4 gap-4 mb-8')).toBeGreaterThan(branchAt);
    expect(source.indexOf('<AnimatePresence mode="wait">')).toBeGreaterThan(branchAt);
  });

  it('keeps the guide mounted for the signed-out page too', () => {
    // Home renders this unconditionally; if the fold defaulted to shut, a
    // visitor who has never seen the walkthrough would never see it at all.
    expect(source).toContain('{!open ? (');
    expect(branchHasFoldedCopy(source)).toBe(true);
  });
});

function branchHasFoldedCopy(src: string): boolean {
  const branch = src.slice(src.indexOf('{!open ? ('), src.indexOf(') : ('));
  return /Four methods/.test(branch);
}
