import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, ExternalLink } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/database';
import type { Plant } from '../../types';

/**
 * Seasonal care tips on Home — the actable half of nothing weather-related:
 * this is the CALENDAR's care advice ("what does this season ask of a
 * keeper"), fed by /api/library/seasonal-alerts (SerpApi, ONE call per
 * (season, climate) pair per 90 DAYS shared by every account, 90-day client
 * cache). Climate comes from the collection's hardiness zones when any plant
 * carries one, falling back to an honest "temperate" assumption that the
 * card states in words.
 */

interface SeasonalTip {
  tip: string;
  source: string;
  url: string;
  summary: string;
  priority: 'high' | 'medium' | 'low';
  appliesTo: string[];
}

interface SeasonalResponse {
  tips: SeasonalTip[];
  fetchedAt: string | null;
  error?: string;
}

/** Meteorological seasons, northern hemisphere — stated on the card so the
 *  assumption is visible rather than silent. */
export function seasonForMonth(month: number): string {
  if (month <= 2 || month === 12) return 'winter';
  if (month <= 5) return 'spring';
  if (month <= 8) return 'summer';
  return 'autumn';
}

const PRIORITY_STYLE: Record<SeasonalTip['priority'], string> = {
  high: 'text-[#8f2f26] dark:text-[#e07a5f]',
  medium: 'text-[#7a602f] dark:text-[#e8c97a]',
  low: 'text-[#5f7161] dark:text-[#b6a087]',
};

export default function SeasonalCareCard() {
  // The collection's own hardiness zones: the honest climate signal the app
  // already holds, if any plant carries one.
  const zones = useLiveQuery(async () => {
    const rows = await db.plants.toArray();
    return rows
      .filter(p => !p.isDemo && p.hardinessZone)
      .map(p => String(p.hardinessZone));
  }, []) ?? [];

  const climate = useMemo(() => {
    if (!zones.length) return 'temperate';
    const counts = new Map<string, number>();
    for (const z of zones) counts.set(z, (counts.get(z) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0].toLowerCase();
  }, [zones]);

  const season = useMemo(() => seasonForMonth(new Date().getMonth() + 1), []);

  const [tips, setTips] = useState<SeasonalTip[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const key = `phyto_seasonal_${season}_${climate}`;
    const cachedRaw = (() => {
      try { return sessionStorage.getItem(key); } catch { return null; }
    })();
    if (cachedRaw) {
      try {
        const cached = JSON.parse(cachedRaw) as { at: number; tips: SeasonalTip[]; note: string | null };
        if (Date.now() - cached.at < 90 * 86_400_000 && cached.tips) {
          setTips(cached.tips);
          setNote(cached.note);
          return;
        }
      } catch { /* private mode — fetch live */ }
    }
    setLoading(true);
    fetch(`/api/library/seasonal-alerts?season=${encodeURIComponent(season)}&climate=${encodeURIComponent(climate)}`)
      .then(r => r.json())
      .then((data: SeasonalResponse) => {
        if (cancelled) return;
        // Non-OK responses carry an `error` body — surface it, never a
        // silent empty list (the content-loader lesson).
        setTips(data.tips ?? []);
        setNote(data.error ?? null);
        try { sessionStorage.setItem(key, JSON.stringify({ at: Date.now(), tips: data.tips ?? [], note: data.error ?? null })); } catch { /* noop */ }
      })
      .catch(() => {
        if (!cancelled) setNote('Seasonal lookup failed.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [season, climate]);

  return (
    <div
      className="p-4 rounded-2xl border border-[#dcd0bd] bg-white/60 dark:bg-[#251d16]"
      role="region"
      aria-label="Seasonal care tips"
    >
      <div className="flex items-center gap-2 mb-1.5">
        <CalendarDays size={14} className="text-[#c5a059]" aria-hidden="true" />
        <h4 className="font-serif font-bold text-sm text-[#2e2117] dark:text-[#faebd7]">
          Seasonal care — {season}
        </h4>
      </div>
      <p className="text-[10px] font-mono text-[#8c765c] mb-2">
        {season} · northern-hemisphere calendar · {climate} climate{zones.length === 0 && ' (assumed — set a hardiness zone on a plant to refine)'}
      </p>
      {loading ? (
        <p className="text-xs font-mono text-[#7a6a50] py-2">Gathering the season's notes…</p>
      ) : tips && tips.length > 0 ? (
        <ul className="space-y-2">
          {tips.map((t, i) => (
            <li key={`${t.url}-${i}`} className="text-xs">
              <a
                href={t.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#2d6a4f] dark:text-[#95d5b2] hover:underline inline-flex items-center gap-1"
              >
                {t.tip} <ExternalLink size={10} aria-hidden="true" />
              </a>
              <span className={`text-[10px] font-mono ml-2 ${PRIORITY_STYLE[t.priority]}`}>{t.priority} priority</span>
              <span className="text-[10px] font-mono text-[#8c765c] ml-2">{t.source}</span>
              {t.summary && <p className="text-[11px] text-text-stone leading-snug mt-0.5">{t.summary}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs font-mono text-[#7a6a50] py-2">
          {note ?? 'No seasonal notes found — the garden stands as it is.'}
        </p>
      )}
    </div>
  );
}
