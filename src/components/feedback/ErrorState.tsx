import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

/**
 * The error half of a data-driven view.
 *
 * Most pages in this app had two failure behaviours, both bad: they either
 * caught the error and dropped it on the floor — leaving the view sitting on a
 * stale or empty list with no explanation — or they rendered the same
 * "nothing here" copy they use for a genuinely empty list. A player could not
 * tell "the bazaar has no crates today" apart from "the bazaar did not answer",
 * and both looked like a broken page.
 *
 * This component makes the distinction explicit and always offers the one
 * action that can actually help: try the request again.
 *
 * `onRetry` is optional because not every error is retryable. When it is
 * omitted no retry button renders, rather than rendering one that would fail
 * the same way a second time.
 */
export default function ErrorState({
  title = 'Something went wrong',
  message = "We couldn't reach the server. Check your connection and try again.",
  onRetry,
  retryLabel = 'Try again',
  className = ''
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div
      // role="alert" announces the failure the moment it mounts. A view that
      // silently swaps its content for an error box is invisible to a screen
      // reader user unless something like this announces it.
      role="alert"
      className={`rounded-xl border border-[#d9a0a0] bg-[#fdf0f0] px-5 py-6 text-center ${className}`}
    >
      <AlertCircle size={22} className="mx-auto text-[#a14b4b]" aria-hidden="true" />
      <p className="mt-3 text-sm font-bold text-[#7a2f2f]">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-[#8a5a5a]">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex min-h-[44px] items-center justify-center gap-2 rounded bg-[#a14b4b] px-5 text-[10px] font-black uppercase tracking-widest text-white transition-colors hover:bg-[#8a3f3f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a2f2f]"
        >
          <RefreshCw size={12} aria-hidden="true" />
          {retryLabel}
        </button>
      )}
    </div>
  );
}