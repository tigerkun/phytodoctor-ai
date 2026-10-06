import React from 'react';
import { RefreshCw, Info } from 'lucide-react';
import type { NonPlantScanReport } from '../../services/geminiService';

export interface NonPlantReportProps {
  report: NonPlantScanReport;
  onScanAgain: () => void;
  className?: string;
  alwaysBright?: boolean;
}

/**
 * The non-plant report renderer.
 *
 * Everything that makes this a report — the kind resolution, the profile
 * copy, the confidence scale, the mycology block — is shaped server-side in
 * src/lib/scanReport and arrives as a finished NonPlantScanReport. This
 * component only picks the kind's visual styling and renders.
 */

const KIND_STYLING: Record<string, { glyph: string; border: string; bg: string; accent: string }> = {
  human: { glyph: '👤', border: 'border-amber-400/40', bg: 'bg-amber-500/5', accent: 'text-amber-800' },
  animal: { glyph: '🐾', border: 'border-orange-400/40', bg: 'bg-orange-500/5', accent: 'text-orange-800' },
  fungus: { glyph: '🍄', border: 'border-purple-400/40', bg: 'bg-purple-500/5', accent: 'text-purple-800' },
  non_living: { glyph: '⚖', border: 'border-stone-400/40', bg: 'bg-stone-500/5', accent: 'text-stone-800' },
  other_living: { glyph: '🔬', border: 'border-teal-400/40', bg: 'bg-teal-500/5', accent: 'text-teal-800' },
  uncertain: { glyph: '🌿', border: 'border-[#b4a58c]/40', bg: 'bg-stone-500/5', accent: 'text-stone-800' },
};

export const NonPlantReport: React.FC<NonPlantReportProps> = ({
  report,
  onScanAgain,
  className = '',
  alwaysBright = false,
}) => {
  const d = (cls: string) => (alwaysBright ? '' : cls);
  const styling = KIND_STYLING[report.kind] ?? KIND_STYLING.uncertain;
  const profile = report.profile;
  const provenance = report.provenance;

  return (
    <div
      className={`rounded-2xl border ${styling.border} ${styling.bg} p-6 sm:p-8 text-left transition-all ${className}`}
      role="region"
      aria-label={`${profile.title} summary`}
    >
      {/* Header Banner */}
      <div className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-5 border-b border-stone-200/50 ${d('dark:border-stone-700/50')}`}>
        <div className="flex items-center gap-3.5">
          <div
            className={`w-14 h-14 rounded-2xl bg-white/80 ${d('dark:bg-stone-800/80')} shadow-xs border border-stone-200 ${d('dark:border-stone-700')} flex items-center justify-center text-3xl shrink-0`}
            aria-hidden="true"
          >
            {styling.glyph}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${styling.accent} bg-white/70 ${d('dark:bg-stone-800/70')} border border-current`}>
                {profile.chip}
              </span>
              {report.subject.confidencePct > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono text-stone-600 ${d('dark:text-stone-400')} bg-stone-100 ${d('dark:bg-stone-800')}`}>
                  {report.subject.confidencePct}% match
                </span>
              )}
            </div>
            <h2 className={`text-xl sm:text-2xl font-serif font-black text-[#2C2419] ${d('dark:text-[#F5F0E8]')} mt-1`}>
              {profile.title}
            </h2>
            <p className={`text-xs font-mono text-[#6B5E51] ${d('dark:text-[#A8B5A0]')} italic`}>
              {profile.subtitle}
            </p>
          </div>
        </div>

        {/* Provenance badge if available */}
        {provenance?.verdict && (
          <div className="shrink-0 text-right">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold ${
                provenance.verdict === 'self_captured'
                  ? `bg-emerald-100 text-emerald-800 ${d('dark:bg-emerald-950/40 dark:text-emerald-300')}`
                  : provenance.verdict === 'likely_synthetic'
                  ? `bg-rose-100 text-rose-800 ${d('dark:bg-rose-950/40 dark:text-rose-300')}`
                  : `bg-amber-100 text-amber-800 ${d('dark:bg-amber-950/40 dark:text-amber-300')}`
              }`}
            >
              {provenance.verdict === 'self_captured' ? '📷 Self-Captured' : provenance.verdict === 'likely_synthetic' ? '⚠ Likely AI/Synthetic' : '❔ Origin Unverified'}
            </span>
          </div>
        )}
      </div>

      {/* Visual Observation */}
      <div className="mt-5 space-y-3">
        <div>
          <h3 className={`text-[11px] font-mono uppercase tracking-widest text-[#6B5E51] ${d('dark:text-[#9A9086]')} font-bold`}>
            Visual Observation
          </h3>
          <p className={`mt-1 text-sm text-[#2C2419] ${d('dark:text-[#E8E2D9]')} leading-relaxed`}>
            {report.subject.description || 'The image provided was evaluated by the vision diagnostic engine.'}
          </p>
        </div>

        {/* Clinical Boundary Notice */}
        <div className={`p-3.5 rounded-xl bg-white/70 ${d('dark:bg-stone-900/60')} border border-stone-200 ${d('dark:border-stone-800')} flex items-start gap-3`}>
          <Info size={16} className={`text-[#6B5E51] ${d('dark:text-[#9A9086]')} shrink-0 mt-0.5`} aria-hidden="true" />
          <p className={`text-xs text-[#6B5E51] ${d('dark:text-[#B8B0A5]')} leading-relaxed`}>
            {profile.notice}
          </p>
        </div>

        {/* Mycology Habitat — server only fills this for fungus */}
        {report.mycology && (
          <div className={`mt-6 pt-5 border-t border-purple-200/50 ${d('dark:border-purple-800/50')} space-y-4`}>
            <div className="flex items-center gap-2">
              <span className="text-base" aria-hidden="true">🍄</span>
              <h3 className={`text-sm font-serif font-bold text-[#2C2419] ${d('dark:text-[#F5F0E8]')}`}>
                Mycology Habitat &amp; Substrate Parameters
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {report.mycology.substrate && (
                <div className={`p-3 rounded-lg bg-white/60 ${d('dark:bg-stone-800/60')} border border-stone-200 ${d('dark:border-stone-700')}`}>
                  <span className={`font-mono uppercase font-bold text-[10px] text-purple-700 ${d('dark:text-purple-300')} block mb-1`}>
                    Substrate &amp; Medium
                  </span>
                  <span className={`text-[#2C2419] ${d('dark:text-[#E8E2D9]')}`}>{report.mycology.substrate}</span>
                </div>
              )}
              {report.mycology.moisture && (
                <div className={`p-3 rounded-lg bg-white/60 ${d('dark:bg-stone-800/60')} border border-stone-200 ${d('dark:border-stone-700')}`}>
                  <span className={`font-mono uppercase font-bold text-[10px] text-purple-700 ${d('dark:text-purple-300')} block mb-1`}>
                    Moisture &amp; Humidity
                  </span>
                  <span className={`text-[#2C2419] ${d('dark:text-[#E8E2D9]')}`}>{report.mycology.moisture}</span>
                </div>
              )}
              {report.mycology.temperature && (
                <div className={`p-3 rounded-lg bg-white/60 ${d('dark:bg-stone-800/60')} border border-stone-200 ${d('dark:border-stone-700')}`}>
                  <span className={`font-mono uppercase font-bold text-[10px] text-purple-700 ${d('dark:text-purple-300')} block mb-1`}>
                    Temperature Range
                  </span>
                  <span className={`text-[#2C2419] ${d('dark:text-[#E8E2D9]')}`}>{report.mycology.temperature}</span>
                </div>
              )}
              {report.mycology.light && (
                <div className={`p-3 rounded-lg bg-white/60 ${d('dark:bg-stone-800/60')} border border-stone-200 ${d('dark:border-stone-700')}`}>
                  <span className={`font-mono uppercase font-bold text-[10px] text-purple-700 ${d('dark:text-purple-300')} block mb-1`}>
                    Light Conditions
                  </span>
                  <span className={`text-[#2C2419] ${d('dark:text-[#E8E2D9]')}`}>{report.mycology.light}</span>
                </div>
              )}
            </div>

            {report.mycology.fieldNotes.length > 0 && (
              <div className={`p-3.5 rounded-xl bg-purple-50/50 ${d('dark:bg-purple-950/20')} border border-purple-200 ${d('dark:border-purple-900')}`}>
                <h4 className={`font-mono uppercase font-bold text-[10px] text-purple-800 ${d('dark:text-purple-300')} mb-2`}>
                  Mycology Field Notes
                </h4>
                <ul className={`space-y-1.5 list-disc list-inside text-xs text-[#2C2419] ${d('dark:text-[#D5CED0]')}`}>
                  {report.mycology.fieldNotes.map((tip, idx: number) => (
                    <li key={idx} className="leading-relaxed">{tip}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className={`mt-6 pt-5 border-t border-stone-200/50 ${d('dark:border-stone-700/50')} flex flex-col sm:flex-row items-center justify-between gap-4`}>
        <p className={`text-[10px] font-mono uppercase tracking-widest text-[#6B5E51] ${d('dark:text-[#9A9086]')}`}>
          Subject read as {report.kind} · No seeds awarded · Not added to sanctuary
        </p>

        <button
          onClick={onScanAgain}
          type="button"
          aria-label="Scan a botanical specimen"
          className="min-h-[44px] w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#3D5A3D] hover:bg-[#4E724E] text-white font-black uppercase tracking-wider text-xs rounded-xl shadow-md transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3D5A3D] focus-visible:ring-offset-2"
        >
          <RefreshCw size={14} aria-hidden="true" />
          <span>Scan a Plant</span>
        </button>
      </div>
    </div>
  );
};

export default NonPlantReport;
