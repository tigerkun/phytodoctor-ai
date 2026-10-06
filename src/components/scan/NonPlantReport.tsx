import React from 'react';
import { RefreshCw, Info } from 'lucide-react';
import type { IdentifyResult } from '../../services/geminiService';

/** Everything the report actually reads. A full IdentifyResult satisfies it;
    the Clinic's triage notice — a route, a kind and a message — does too. */
export interface NonPlantReportData {
  route?: string;
  message?: string;
  commonName?: string;
  scientificName?: string;
  subjectKind?: string;
  subject?: {
    kind?: string;
    subjectKind?: string;
    confidence?: number;
    subjectConfidence?: number;
    description?: string;
    subjectDescription?: string;
  };
  provenance?: IdentifyResult['provenance'];
  soil?: string;
  watering?: string;
  temperature?: string;
  light?: string;
  careTips?: string[];
}

export interface NonPlantReportProps {
  result: NonPlantReportData | null;
  onScanAgain: () => void;
  className?: string;
  alwaysBright?: boolean;
}

export const NonPlantReport: React.FC<NonPlantReportProps> = ({
  result,
  onScanAgain,
  className = '',
  alwaysBright = false,
}) => {
  const subject = result?.subject || {};
  const kind = String(
    subject.kind ||
    subject.subjectKind ||
    result?.subjectKind ||
    (result?.route === 'non_living' ? 'non_living' : 'uncertain')
  ).toLowerCase();
  const rawConfidence = Number(subject.confidence ?? subject.subjectConfidence ?? 0);
  const confidence = Math.round(rawConfidence * 100);
  const description = subject.description || subject.subjectDescription || result?.message || '';
  const provenance = result?.provenance;

  const d = (cls: string) => (alwaysBright ? '' : cls);

  // Kind-specific profiles
  const profiles: Record<string, {
    title: string;
    subtitle: string;
    glyph: string;
    chip: string;
    border: string;
    bg: string;
    accent: string;
    notice: string;
  }> = {
    human: {
      title: 'Human Subject Profile',
      subtitle: result?.commonName
        ? `${result.commonName} (${result?.scientificName || 'Homo sapiens'})`
        : (result?.scientificName || 'Homo sapiens'),
      glyph: '👤',
      chip: 'Homo sapiens · Biological Subject',
      border: 'border-amber-400/40',
      bg: 'bg-amber-500/5',
      accent: `text-amber-800 ${d('dark:text-amber-300')}`.trim(),
      notice: 'This clinic diagnoses botanical specimens only. No plant pathology or horticultural care plan can be generated for human subjects.',
    },
    animal: {
      title: 'Fauna Specimen Observed',
      subtitle: result?.commonName
        ? (result.scientificName ? `${result.commonName} (${result.scientificName})` : result.commonName)
        : (result?.scientificName || 'Animalia'),
      glyph: '🐾',
      chip: 'Kingdom Animalia · Fauna',
      border: 'border-orange-400/40',
      bg: 'bg-orange-500/5',
      accent: `text-orange-800 ${d('dark:text-orange-300')}`.trim(),
      notice: 'PhytoDoctor AI specializes exclusively in flora. For animal wellbeing or veterinary consultation, seek professional veterinary care.',
    },
    fungus: {
      title: 'Fungal Specimen Profile',
      subtitle: result?.commonName || result?.scientificName || 'Kingdom Fungi',
      glyph: '🍄',
      chip: 'Kingdom Fungi · Mycology',
      border: 'border-purple-400/40',
      bg: 'bg-purple-500/5',
      accent: `text-purple-800 ${d('dark:text-purple-300')}`.trim(),
      notice: 'Fungi belong to kingdom Fungi, biologically distinct from plants. While plant-adjacent in soil ecosystems, standard botanical therapies do not apply.',
    },
    non_living: {
      title: 'Inanimate Subject Detected',
      subtitle: result?.commonName || 'Non-Living Object',
      glyph: '⚖',
      chip: 'Non-Living Material',
      border: 'border-stone-400/40',
      bg: 'bg-stone-500/5',
      accent: `text-stone-800 ${d('dark:text-stone-300')}`.trim(),
      notice: 'Only living specimens can be analysed. Point the camera lens at a live leaf, stem, flower or tree to receive a botanical diagnosis.',
    },
    other_living: {
      title: 'Non-Botanical Organism',
      subtitle: result?.commonName || 'Living Specimen',
      glyph: '🔬',
      chip: 'Living Organism · Non-Plant',
      border: 'border-teal-400/40',
      bg: 'bg-teal-500/5',
      accent: `text-teal-800 ${d('dark:text-teal-300')}`.trim(),
      notice: 'This specimen appears to be a living organism outside the plant kingdom. PhytoDoctor AI provides clinical analysis for plants only.',
    },
  };

  const profile = profiles[kind] || {
    title: 'Non-Plant Specimen',
    subtitle: result?.commonName || 'Unclassified Subject',
    glyph: '🌿',
    chip: 'Uncertain Taxonomy',
    border: 'border-[#b4a58c]/40',
    bg: 'bg-stone-500/5',
    accent: `text-stone-800 ${d('dark:text-stone-300')}`.trim(),
    notice: 'PhytoDoctor AI diagnoses plants only. Please submit an image focused clearly on a botanical subject.',
  };

  const isFungus = kind === 'fungus';
  const hasFungusCare = isFungus && (result?.soil || result?.watering || result?.temperature || result?.light || (result?.careTips && result.careTips.length > 0));

  return (
    <div
      className={`rounded-2xl border ${profile.border} ${profile.bg} p-6 sm:p-8 text-left transition-all ${className}`}
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
            {profile.glyph}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${profile.accent} bg-white/70 ${d('dark:bg-stone-800/70')} border border-current`}>
                {profile.chip}
              </span>
              {confidence > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono text-stone-600 ${d('dark:text-stone-400')} bg-stone-100 ${d('dark:bg-stone-800')}`}>
                  {confidence}% match
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
            {description || 'The image provided was evaluated by the vision diagnostic engine.'}
          </p>
        </div>

        {/* Clinical Boundary Notice */}
        <div className={`p-3.5 rounded-xl bg-white/70 ${d('dark:bg-stone-900/60')} border border-stone-200 ${d('dark:border-stone-800')} flex items-start gap-3`}>
          <Info size={16} className={`text-[#6B5E51] ${d('dark:text-[#9A9086]')} shrink-0 mt-0.5`} aria-hidden="true" />
          <p className={`text-xs text-[#6B5E51] ${d('dark:text-[#B8B0A5]')} leading-relaxed`}>
            {profile.notice}
          </p>
        </div>

        {/* Mycology Specific Ecological Care Section */}
        {hasFungusCare && (
          <div className={`mt-6 pt-5 border-t border-purple-200/50 ${d('dark:border-purple-800/50')} space-y-4`}>
            <div className="flex items-center gap-2">
              <span className="text-base" aria-hidden="true">🍄</span>
              <h3 className={`text-sm font-serif font-bold text-[#2C2419] ${d('dark:text-[#F5F0E8]')}`}>
                Mycology Habitat &amp; Substrate Parameters
              </h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {result.soil && (
                <div className={`p-3 rounded-lg bg-white/60 ${d('dark:bg-stone-800/60')} border border-stone-200 ${d('dark:border-stone-700')}`}>
                  <span className={`font-mono uppercase font-bold text-[10px] text-purple-700 ${d('dark:text-purple-300')} block mb-1`}>
                    Substrate &amp; Medium
                  </span>
                  <span className={`text-[#2C2419] ${d('dark:text-[#E8E2D9]')}`}>{result.soil}</span>
                </div>
              )}
              {result.watering && (
                <div className={`p-3 rounded-lg bg-white/60 ${d('dark:bg-stone-800/60')} border border-stone-200 ${d('dark:border-stone-700')}`}>
                  <span className={`font-mono uppercase font-bold text-[10px] text-purple-700 ${d('dark:text-purple-300')} block mb-1`}>
                    Moisture &amp; Humidity
                  </span>
                  <span className={`text-[#2C2419] ${d('dark:text-[#E8E2D9]')}`}>{result.watering}</span>
                </div>
              )}
              {result.temperature && (
                <div className={`p-3 rounded-lg bg-white/60 ${d('dark:bg-stone-800/60')} border border-stone-200 ${d('dark:border-stone-700')}`}>
                  <span className={`font-mono uppercase font-bold text-[10px] text-purple-700 ${d('dark:text-purple-300')} block mb-1`}>
                    Temperature Range
                  </span>
                  <span className={`text-[#2C2419] ${d('dark:text-[#E8E2D9]')}`}>{result.temperature}</span>
                </div>
              )}
              {result.light && (
                <div className={`p-3 rounded-lg bg-white/60 ${d('dark:bg-stone-800/60')} border border-stone-200 ${d('dark:border-stone-700')}`}>
                  <span className={`font-mono uppercase font-bold text-[10px] text-purple-700 ${d('dark:text-purple-300')} block mb-1`}>
                    Light Conditions
                  </span>
                  <span className={`text-[#2C2419] ${d('dark:text-[#E8E2D9]')}`}>{result.light}</span>
                </div>
              )}
            </div>

            {Array.isArray(result.careTips) && result.careTips.length > 0 && (
              <div className={`p-3.5 rounded-xl bg-purple-50/50 ${d('dark:bg-purple-950/20')} border border-purple-200 ${d('dark:border-purple-900')}`}>
                <h4 className={`font-mono uppercase font-bold text-[10px] text-purple-800 ${d('dark:text-purple-300')} mb-2`}>
                  Mycology Field Notes
                </h4>
                <ul className={`space-y-1.5 list-disc list-inside text-xs text-[#2C2419] ${d('dark:text-[#D5CED0]')}`}>
                  {result.careTips.slice(0, 3).map((tip: string, idx: number) => (
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
          Subject read as {kind} · No seeds awarded · Not added to sanctuary
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
