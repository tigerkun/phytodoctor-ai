import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Crosshair } from 'lucide-react';

interface LocationBarProps {
  /** The place currently in force, or '' when none has been chosen. */
  city: string;
  error: string | null;
  locating: boolean;
  onSaveCity: (city: string) => void;
  onUseDeviceLocation: () => void;
}

/**
 * The one place a Keeper sets where they are.
 *
 * This exists because there was nowhere to do it. The location hook wrote the
 * chosen city to storage but had no caller for `updateCity`, so the only way
 * `botanical_city` could ever be set was the GPS reverse geocode — meaning the
 * app demanded a permission it had no alternative to, and Home filled the gap
 * with hardcoded Delhi weather when it was refused.
 *
 * Typing a city is the default path. The device button is offered beside it,
 * not in front of it, and nothing here runs a lookup until it is pressed.
 */
export function LocationBar({
  city,
  error,
  locating,
  onSaveCity,
  onUseDeviceLocation,
}: LocationBarProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(city);

  // The stored city can change underneath us — a device fix lands while this
  // bar is open — and a draft left over from a previous city would then be one
  // keystroke from restoring the old one.
  useEffect(() => { setDraft(city); }, [city]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    onSaveCity(draft);
    setEditing(false);
  }

  if (city && !editing) {
    return (
      // aria-live: a saved city, a landed GPS fix and a failed lookup all
      // re-render this line asynchronously — announce the change politely
      // instead of silently replacing text a screen reader has already read.
      <div className="mx-auto w-full max-w-7xl px-6" aria-live="polite">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-sm)] border border-border-light bg-bg-secondary/70 px-4 py-2.5">
          <span className="flex items-center gap-2 text-sm font-medium text-text-stone">
            <MapPin size={15} className="shrink-0 text-moss" aria-hidden="true" />
            {/* The error has to survive the collapsed state. Saving a city that
                will not resolve used to collapse the editor into a confident
                "Local weather for X" line while no weather loaded at all. */}
            {error ? (
              <span className="text-amber-700 dark:text-amber-300">{error}</span>
            ) : (
              <span>
                Local weather for <span className="font-semibold text-text-bark">{city}</span>
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="min-h-11 rounded-[var(--radius-sm)] px-3 text-xs font-bold uppercase tracking-wider text-moss underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--moss)] focus-visible:ring-offset-2"
          >
            {error ? 'Fix city' : 'Change'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-6">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 rounded-[var(--radius-sm)] border border-border-light bg-bg-secondary/70 px-4 py-4 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label
            htmlFor="location-city"
            className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-text-muted"
          >
            Your city
          </label>
          <input
            id="location-city"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="e.g. Pune"
            autoComplete="address-level2"
            className="mt-2 w-full rounded-[var(--radius-sm)] border border-border-medium bg-bg-primary px-3 py-2.5 text-sm font-medium text-text-bark placeholder:text-text-muted focus:border-moss focus:outline-none focus:ring-2 focus:ring-moss/30"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={!draft.trim()}
            className="min-h-11 rounded-[var(--radius-sm)] px-5 text-sm font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--moss)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ background: 'var(--moss-deep)', boxShadow: 'var(--shadow-sm)' }}
          >
            Save city
          </button>

          <button
            type="button"
            onClick={onUseDeviceLocation}
            disabled={locating}
            className="inline-flex min-h-11 items-center gap-2 rounded-[var(--radius-sm)] border border-border-medium px-4 text-sm font-semibold text-text-stone transition-colors hover:border-moss hover:text-moss focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--moss)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Crosshair size={15} aria-hidden="true" />
            {locating ? 'Finding you…' : 'Use my location'}
          </button>

          {city && (
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="min-h-11 px-2 text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-text-stone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--moss)]"
            >
              Cancel
            </button>
          )}
        </div>

        {/* role="status": the hint doubles as the error line in the editor,
            and an error arriving after the save attempt must be announced. */}
        <p role="status" className="w-full text-xs leading-relaxed text-text-stone sm:col-span-2">
          {error || 'Used for weather, watering advice and site reports. Nothing is shared with anyone.'}
        </p>
      </motion.form>
    </div>
  );
}

export default LocationBar;