import React, { useCallback, useEffect, useState } from 'react';
import { History, ChevronDown, RefreshCw, Info, BookOpen } from 'lucide-react';
import { fetchScanHistory, type ScanHistoryItem } from '../../services/scanHistoryService';
import { type PlantScanReport } from '../../services/geminiService';
import NonPlantReport from './NonPlantReport';

interface ScanHistoryPanelProps {
  isAuthed: boolean;
  onSignIn: () => void;
  /** Re-indexes a plant report into the sanctuary (photo-less). */
  onIndexPlant: (report: PlantScanReport) => Promise<void>;
}

const PAGE_SIZE = 20;

const KIND_GLYPH: Record<string, string> = {
  plant: '🌿',
  human: '👤',
  animal: '🐾',
  fungus: '🍄',
  other_living: '🔬',
  non_living: '⚖',
  uncertain: '❔',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/**
 * The Herbarium Archive — every scan the backend has recorded for this
 * account, newest first. Read-only history: expanding a row shows the
 * finished report, and plant reports can be re-indexed into the sanctuary
 * without re-scanning (the photo is not stored server-side, by design, so
 * the re-indexed plant carries no image).
 */
export function ScanHistoryPanel({ isAuthed, onSignIn, onIndexPlant }: ScanHistoryPanelProps) {
  const [items, setItems] = useState<ScanHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [indexingId, setIndexingId] = useState<string | null>(null);
  const [indexedId, setIndexedId] = useState<string | null>(null);

  const load = useCallback(async (nextOffset: number, append: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const page = await fetchScanHistory(PAGE_SIZE, nextOffset);
      setUnavailable(Boolean(page.unavailable));
      setTotal(page.total);
      setOffset(nextOffset);
      setItems(prev => (append ? [...prev, ...page.items] : page.items));
    } catch (err: any) {
      if (err?.message === 'SIGN_IN_REQUIRED') {
        setNeedsAuth(true);
      } else {
        setError(err?.message || 'Could not load the archive.');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthed) void load(0, false);
  }, [isAuthed, load]);

  // A mid-session 401 sets needsAuth; when the token recovers (re-login
  // without a reload) the effect above does not re-fire, so clear the banner
  // and fetch here instead.
  useEffect(() => {
    if (isAuthed && needsAuth) {
      setNeedsAuth(false);
      void load(0, false);
    }
  }, [isAuthed, needsAuth, load]);

  if (!isAuthed) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <History size={32} className="mx-auto text-moss mb-4" aria-hidden="true" />
        <h3 className="font-serif text-xl font-bold text-text-bark">The Herbarium Archive</h3>
        <p className="mt-2 text-sm text-text-stone max-w-md mx-auto leading-relaxed">
          Every diagnosis the clinic has issued for your account, kept server-side and readable from any device. Sign in to open yours.
        </p>
        <button
          type="button"
          onClick={onSignIn}
          className="mt-6 min-h-[44px] px-6 py-3 bg-moss-deep hover:bg-moss text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider shadow-md transition-all active:scale-95"
        >
          Sign in to view
        </button>
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className="max-w-3xl mx-auto py-16 text-center">
        <Info size={28} className="mx-auto text-text-stone mb-4" aria-hidden="true" />
        <h3 className="font-serif text-xl font-bold text-text-bark">Archive not yet provisioned</h3>
        <p className="mt-2 text-sm text-text-stone max-w-md mx-auto leading-relaxed">
          The scan_reports table has not been applied to this environment yet, so nothing is being recorded. Scans still diagnose normally.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="font-serif text-2xl font-black text-text-bark flex items-center gap-2">
            <BookOpen size={20} className="text-moss" aria-hidden="true" /> Herbarium Archive
          </h3>
          <p className="text-xs text-text-stone font-mono mt-1">
            {total} recorded diagnosis{total === 1 ? '' : 's'} · server-side, readable from any device
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load(0, false)}
          disabled={loading}
          aria-label="Refresh scan history"
          className="min-h-[44px] px-4 rounded-xl border border-border-light text-text-stone hover:text-moss hover:border-moss transition-colors disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/30 text-sm text-text-stone mb-6">
          {error}
        </div>
      )}

      {needsAuth && (
        <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/30 text-sm text-text-stone mb-6">
          Your session expired — sign in again to read the archive.
        </div>
      )}

      {!loading && items.length === 0 && !error && (
        <div className="py-12 text-center text-sm text-text-stone">
          Nothing recorded yet — your next diagnosis lands here automatically.
        </div>
      )}

      <div className="space-y-3">
        {items.map((item) => {
          const report = item.report;
          const expanded = expandedId === item.id;
          const isPlant = report.kind === 'plant';
          return (
            <div key={item.id} className="botanical-index-card rounded-2xl border border-[#b4a58c]/35 dark:border-[#8fb58f]/20 overflow-hidden">
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : item.id)}
                aria-expanded={expanded}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-moss/5 transition-colors min-h-[44px]"
              >
                <span className="text-xl shrink-0" aria-hidden="true">{KIND_GLYPH[report.kind] ?? '❔'}</span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-text-bark truncate">
                    {report.displayName}
                    {isPlant && 'healthStatus' in report ? ` — ${report.healthStatus}` : ''}
                  </span>
                  <span className="block text-[10px] font-mono text-text-stone uppercase tracking-wider">
                    {formatDate(item.createdAt)} · {report.kind}
                    {isPlant && 'vitals' in report ? ` · vitality ${report.vitals.guardianScore}` : ''}
                  </span>
                </span>
                <ChevronDown size={16} className={`text-text-stone transition-transform ${expanded ? 'rotate-180' : ''}`} aria-hidden="true" />
              </button>

              {expanded && (
                <div className="px-4 pb-4 border-t border-border-light pt-4">
                  {isPlant ? (
                    (() => {
                      const plant = report as PlantScanReport;
                      return (
                        <div className="space-y-3 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-bg-secondary text-text-bark border border-border-light">
                              {plant.healthStatus}
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono text-text-stone border border-border-light">
                              Severity {plant.severity}/5
                            </span>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono text-text-stone border border-border-light">
                              Vitality {plant.vitals.guardianScore} · {plant.vitals.statusLabel}
                            </span>
                          </div>
                          <p className="text-text-stone leading-relaxed">{plant.diagnosis || '—'}</p>
                          {plant.treatmentSteps.length > 0 && (
                            <ol className="list-decimal list-inside space-y-1 text-xs text-text-stone">
                              {plant.treatmentSteps.slice(0, 4).map((step, i) => (
                                <li key={i}>{step}</li>
                              ))}
                            </ol>
                          )}
                          <button
                            type="button"
                            disabled={indexingId === item.id || indexedId === item.id}
                            onClick={async () => {
                              setIndexingId(item.id);
                              try {
                                await onIndexPlant(plant);
                                setIndexedId(item.id);
                              } finally {
                                setIndexingId(null);
                              }
                            }}
                            className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 bg-moss-deep hover:bg-moss disabled:opacity-60 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all active:scale-95"
                          >
                            <RefreshCw size={13} className={indexingId === item.id ? 'animate-spin' : ''} aria-hidden="true" />
                            {indexedId === item.id ? 'In the Sanctuary' : 'Index to Sanctuary (no photo)'}
                          </button>
                        </div>
                      );
                    })()
                  ) : (
                    <NonPlantReport report={report} onScanAgain={() => setExpandedId(null)} hideActions />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {items.length < total && (
        <div className="mt-6 text-center">
          <button
            type="button"
            // Derived from items.length, not the offset state — a fast
            // double-tap cannot request the same page twice.
            onClick={() => void load(items.length, true)}
            disabled={loading}
            className="min-h-[44px] px-6 py-3 rounded-xl border border-border-light text-text-stone hover:text-moss hover:border-moss text-xs font-mono font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading…' : `Load more (${total - items.length} older)`}
          </button>
        </div>
      )}
    </div>
  );
}

export default ScanHistoryPanel;
