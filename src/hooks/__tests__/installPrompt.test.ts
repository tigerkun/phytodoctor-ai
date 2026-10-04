import { describe, it, expect } from 'vitest';
import { readSource } from '../../test/helpers';

/**
 * Installing the app is offered in-product rather than left in the browser's
 * menu. The mechanics are unforgiving in ways worth pinning: the
 * `beforeinstallprompt` event fires once per page load and must be caught (a
 * missed one means no install affordance until the next visit); `prompt()`
 * is only legal from a user gesture; the offer must hide once the app runs
 * installed; and the iOS hint — which has no event to gate it — is the only
 * place a dismissal must persist, or it becomes a permanent nag.
 */

const hook = readSource('src/hooks/useInstallPrompt.ts');
const profile = readSource('src/pages/Profile.tsx');

describe('the install prompt hook', () => {
  it('catches and holds the beforeinstallprompt event', () => {
    expect(hook).toMatch(/window\.addEventListener\('beforeinstallprompt', onPrompt\)/);
    expect(hook).toMatch(/e\.preventDefault\(\)/);
  });

  it('detects standalone by both matchMedia and the iOS navigator flag', () => {
    // iOS Safari only reports installed state through navigator.standalone;
    // matchMedia alone would keep offering the app to people who installed.
    expect(hook).toMatch(/\(display-mode: standalone\)/);
    expect(hook).toMatch(/standalone === true/);
  });

  it('treats the captured event as single-use', () => {
    expect(hook).toMatch(/setDeferred\(null\)/);
  });

  it('recognises iPadOS masquerading as desktop Safari', () => {
    expect(hook).toMatch(/MacIntel['"] && navigator\.maxTouchPoints > 1/);
  });
});

describe('the profile install card', () => {
  it('renders from the hook, not its own event listener', () => {
    expect(profile).toContain('useInstallPrompt()');
  });

  it('hides for installed users and for dismissed hints', () => {
    expect(profile).toMatch(/!\s*standalone && !dismissedInstall && \(canInstall \|\| isIOS\)/);
  });

  it('shows an actionable Install button only when the browser allows it', () => {
    expect(profile).toMatch(/canInstall \? \(/);
    expect(profile).toMatch(/outcome === 'accepted'/);
  });

  it('persists the iOS hint dismissal', () => {
    expect(profile).toMatch(/localStorage\.setItem\('phyto_install_hint_dismissed', '1'\)/);
  });
});
