import { useCallback, useEffect, useState } from 'react';

/**
 * Makes installing the app a first-class action instead of a browser-menu
 * secret. Chrome/Android fire `beforeinstallprompt`; the event must be caught
 * and held — the browser only lets you call `prompt()` from a user gesture,
 * and it fires once per page load, so missing it means no install affordance
 * at all until the next visit.
 *
 * `standalone` is true once the app is already running installed; the UI uses
 * it to hide the offer (nagging someone who already installed is noise).
 * iOS Safari never fires the event — there the install is a Share-menu
 * action, so the UI shows the one-line hint instead of a button.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    setStandalone(
      window.matchMedia('(display-mode: standalone)').matches ||
      // iOS Safari reports installed state only here, not via matchMedia.
      (navigator as unknown as { standalone?: boolean }).standalone === true
    );
    setIsIOS(
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      // iPadOS 13+ masquerades as desktop Safari.
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );

    const onPrompt = (e: Event) => {
      // Taking the event is what suppresses Chrome's own mini-infobar; the
      // app offers install where it fits instead.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferred) return 'unavailable';
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // The event is single-use; an accepted install means it is never needed
    // again, and a dismissed one is re-offered on the next visit — Chrome
    // re-fires the event at its own pace.
    setDeferred(null);
    return outcome;
  }, [deferred]);

  return { canInstall: !!deferred, standalone, isIOS, install };
}
