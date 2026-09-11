import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Thermometer, Droplets, Sun, Wind, MapPin, FlaskConical,
  Sparkles, ArrowRight, RotateCcw, FileText, Printer, Leaf
} from 'lucide-react';
import { db } from '../db/database';
import { GameService } from '../services/gameService';
import PageWrapper from '../components/home/PageWrapper';
import { useToast } from '../components/Toast';
import { useGeolocation } from '../hooks/useGeolocation';
import {
  ASSESSMENTS_PER_DAY,
  BIOMES,
  SpeciesDossier,
  SiteEnvironment,
  PlacementReport,
  assessmentsLeftToday,
  consumeAssessment,
  profileSpecies,
  assessPlacement,
  geocodeCity,
  fetchSiteClimate,
  simulateBiome,
} from '../services/sandboxService';

type Step = 'species' | 'site' | 'report';

const STEPS: { id: Step; n: string; label: string }[] = [
  { id: 'species', n: '01', label: 'Species intake' },
  { id: 'site', n: '02', label: 'Site / climate' },
  { id: 'report', n: '03', label: 'Clinical report' },
];

function gradeOf(score: number) {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 50) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

function tone(score: number) {
  if (score >= 70) return { fg: '#3d6b4a', bg: '#e8f2ea', rule: '#5a7d5a' };
  if (score >= 40) return { fg: '#8a6a12', bg: '#f7efd6', rule: '#c4a035' };
  return { fg: '#8b3d2c', bg: '#f6e4de', rule: '#c17f59' };
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div className="border-b border-black/10 py-2.5 grid grid-cols-[140px_1fr] gap-4 text-[13px]">
      <dt className="uppercase tracking-[0.14em] text-[10px] font-bold text-[#7a7268] pt-0.5">{k}</dt>
      <dd className="text-[#2c2419] leading-relaxed">{v}</dd>
    </div>
  );
}

export default function VaultPage() {
  const { error, success } = useToast();
  const { location, city } = useGeolocation();
  const userId = GameService.getUserId();
  const dbPlants = useLiveQuery(() => db.plants.where('userId').equals(userId).toArray(), [userId]) || [];

  const [step, setStep] = useState<Step>('species');
  const [speciesInput, setSpeciesInput] = useState('');
  const [dossier, setDossier] = useState<SpeciesDossier | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [siteMode, setSiteMode] = useState<'location' | 'simulate'>('location');
  const [cityQuery, setCityQuery] = useState(city || '');
  const [biome, setBiome] = useState('temperate');
  const [indoor, setIndoor] = useState(false);
  const [when, setWhen] = useState(() => new Date().toISOString().slice(0, 16));
  const [site, setSite] = useState<SiteEnvironment | null>(null);
  const [loadingSite, setLoadingSite] = useState(false);
  const [report, setReport] = useState<PlacementReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [issuedAt, setIssuedAt] = useState<Date | null>(null);
  const [left, setLeft] = useState(assessmentsLeftToday);
  const [isPro, setIsPro] = useState(false);

  React.useEffect(() => {
    GameService.isPro(userId).then(setIsPro).catch(() => setIsPro(false));
  }, [userId]);

  React.useEffect(() => {
    if (!cityQuery && city && city !== 'Your Location') {
      setCityQuery(city);
    }
  }, [city, cityQuery]);

  const knownSpecies = useMemo(() => {
    const list = [...new Set(dbPlants.map(p => p.species).filter(Boolean))];
    if (list.length > 0) return list;
    return ['Monstera deliciosa', 'Ficus lyrata', 'Olea europaea', 'Lavandula angustifolia', 'Sansevieria trifasciata'];
  }, [dbPlants]);

  const caseId = useMemo(() => {
    const d = issuedAt || new Date();
    const tag = (dossier?.scientificName || speciesInput || 'UNK').replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'UNK';
    return `PD-CBA-${d.toISOString().slice(0, 10).replace(/-/g, '')}-${tag}`;
  }, [dossier, speciesInput, issuedAt]);

  const runProfile = async () => {
    const name = speciesInput.trim();
    if (!name) return error('Enter a species name first.');
    setLoadingProfile(true);
    try {
      const result = await profileSpecies(name);
      setDossier(result);
      setStep('site');
      success(`Dossier ready for ${result.commonName}`);
    } catch (e: any) {
      error(e.message || 'Could not process that species.');
    } finally {
      setLoadingProfile(false);
    }
  };

  const loadLocationSite = async () => {
    const q = cityQuery.trim();
    if (!q && !(location?.latitude && location?.longitude)) return error('Enter a city or allow location.');
    setLoadingSite(true);
    try {
      let lat = location?.latitude;
      let lon = location?.longitude;
      let label = q || city;
      if (q) {
        const geo = await geocodeCity(q);
        lat = geo.lat;
        lon = geo.lon;
        label = geo.label;
      }
      if (lat == null || lon == null) throw new Error('Need coordinates for that place.');
      setSite(await fetchSiteClimate(lat, lon, label));
    } catch (e: any) {
      error(e.message || 'Could not load that location.');
    } finally {
      setLoadingSite(false);
    }
  };

  const loadSimulatedSite = () => setSite(simulateBiome(biome, new Date(when), indoor));

  const runAssessment = async () => {
    if (!dossier || !site) return error('Process a species and lock a site first.');
    if (!isPro && left <= 0) return error(`Daily cap reached (${ASSESSMENTS_PER_DAY} assessments). Come back tomorrow — or upgrade to Pro for unlimited reports.`);
    setLoadingReport(true);
    try {
      const result = await assessPlacement(dossier.scientificName || speciesInput, site);
      if (!isPro) {
        if (!consumeAssessment()) return error('Daily cap reached.');
        setLeft(assessmentsLeftToday());
      }
      setIssuedAt(new Date());
      setReport(result);
      setStep('report');
    } catch (e: any) {
      error(e.message || 'Assessment failed.');
    } finally {
      setLoadingReport(false);
    }
  };

  const reset = () => {
    setStep('species');
    setDossier(null);
    setSite(null);
    setReport(null);
    setIssuedAt(null);
  };

  const metrics = report ? [
    ['Climate compatibility', report.climateScore],
    ['Hydric / watering fit', report.waterScore],
    ['Photoperiod & light', report.lightScore],
    ['Edaphic / soil match', report.soilScore],
    ['Pest & pathogen safety', report.pestScore],
    ['Seasonal timing', report.seasonalScore],
  ] as const : [];

  const stamp = report ? tone(report.survivalChance) : tone(50);

  return (
    <PageWrapper className="min-h-screen skin-vault text-text-bark">
      <div className="pointer-events-none fixed inset-0 opacity-[0.35]" style={{
        backgroundImage: 'radial-gradient(ellipse at 20% 0%, rgba(90,125,90,0.18), transparent 50%), radial-gradient(ellipse at 90% 80%, rgba(193,127,89,0.12), transparent 45%)'
      }} />

      <main className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-10 pb-28">
        <header className="mb-10 print:hidden">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] bg-moss text-white">
              <Leaf size={11} /> PhytoDoctor · Clinical Lab
            </span>
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.16em] border border-gold/40 text-gold bg-gold/10">
              {isPro ? '∞ Pro · unlimited reports' : `${left} of ${ASSESSMENTS_PER_DAY} reports remaining today`}
            </span>
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl font-semibold tracking-tight text-text-bark">
            Botanical placement <em className="italic text-moss">sandbox</em>
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-stone">
            Intake a species, lock a real or simulated climate, then issue a scored clinical survivability document.
          </p>

          <ol className="mt-8 grid grid-cols-3 gap-3" role="tablist" aria-label="Herbarium workflow drawers">
            {STEPS.map((s, i) => {
              const active = step === s.id;
              const done = (s.id === 'species' && !!dossier) || (s.id === 'site' && !!site && step === 'report');
              const isNavigable = s.id === 'species' || (s.id === 'site' && !!dossier) || (s.id === 'report' && !!report);

              return (
                <li key={s.id} className="relative">
                  <button
                    type="button"
                    disabled={!isNavigable}
                    onClick={() => {
                      if (isNavigable) setStep(s.id);
                    }}
                    className={`w-full text-left rounded-xl walnut-drawer p-3 sm:p-4 flex flex-col justify-between h-full transition-all ${
                      active ? 'is-active' : done ? 'is-done cursor-pointer' : isNavigable ? 'cursor-pointer hover:border-gold/50' : 'opacity-70 cursor-not-allowed'
                    }`}
                    title={isNavigable ? `Open drawer: ${s.label}` : `${s.label} locked`}
                  >
                    {/* Brass label holder frame */}
                    <div className="brass-label-holder w-full flex items-center justify-between mb-2">
                      <span className="font-mono text-[9px] font-black tracking-widest text-[#4a350d]">
                        DW-{s.n}
                      </span>
                      {done && (
                        <span className="w-2 h-2 rounded-full bg-moss inline-block shadow-sm" title="Completed" />
                      )}
                      {active && (
                        <span className="w-2 h-2 rounded-full bg-gold inline-block animate-pulse" title="Active drawer" />
                      )}
                    </div>

                    {/* Drawer Face Index Card */}
                    <div className="brass-label-card px-2 py-1.5 rounded text-center">
                      <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#2d2216] truncate font-serif">
                        {s.label}
                      </p>
                    </div>

                    {/* Brass Cup Pull Handle */}
                    <div className="mt-2.5 flex justify-center">
                      <div className="brass-cup-pull" />
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </header>

        {step === 'species' && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="ruled-ledger-blotter rounded-3xl p-7 sm:p-10 relative overflow-hidden text-text-bark"
          >
            {/* Ledger folio banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#a0825f]/30 pb-4 mb-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-moss">
                  Naturalist Specimen Register · Folio No. 1894
                </p>
                <h2 className="font-serif italic text-2xl sm:text-3xl mt-1 text-text-bark font-medium copperplate-script">
                  Taxon Accession & Hardiness Inquiry
                </h2>
                <p className="text-xs sm:text-sm text-text-stone mt-1 max-w-xl leading-relaxed">
                  Enter binomial nomenclature or common cultivar. The engine compiles origin, hardiness, and ideal abiotic ranges before any site is chosen.
                </p>
              </div>
              <div className="sepia-accession-mark px-3 py-1.5 text-[10px] rotate-[-2deg] shrink-0">
                ROYAL HERBARIUM INTAKE
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <label htmlFor="species-input" className="block text-[11px] font-bold uppercase tracking-wider text-text-stone mb-2">
                  Specimen Taxon
                </label>
                <div className="relative">
                  <input
                    id="species-input"
                    value={speciesInput}
                    onChange={(e) => setSpeciesInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && runProfile()}
                    placeholder="e.g. Monstera deliciosa, Olea europaea, Ficus lyrata, tomato…"
                    className="w-full p-4 sm:p-5 rounded-2xl bg-bg-primary/90 border-2 border-[#b89552]/40 font-serif italic text-xl sm:text-2xl text-text-bark placeholder:text-text-muted/60 focus:outline-none focus:border-moss focus:ring-2 focus:ring-moss/20 shadow-inner"
                  />
                  {speciesInput && (
                    <button
                      type="button"
                      onClick={() => setSpeciesInput('')}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-text-stone hover:text-text-bark font-bold"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {knownSpecies.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-text-stone mb-2">
                    {dbPlants.length > 0 ? 'Recorded Specimens in Personal Herbarium:' : 'Cataloged Reference Specimens:'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {knownSpecies.slice(0, 8).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSpeciesInput(s)}
                        className="px-3 py-1.5 text-xs rounded-full border border-[#b89552]/30 bg-bg-primary/70 hover:border-moss hover:bg-moss/10 text-text-bark transition-colors font-serif italic flex items-center gap-1.5 shadow-sm"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-moss/70" />
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={runProfile}
                disabled={loadingProfile}
                className="w-full py-4 rounded-2xl bg-moss hover:bg-moss/90 text-white font-black uppercase tracking-[0.18em] text-xs flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-moss/20 transition-all active:scale-[0.99]"
              >
                <Sparkles size={15} /> {loadingProfile ? 'Compiling botanical profile…' : 'Compile species dossier'}
              </button>
            </div>
          </motion.section>
        )}

        {step === 'site' && dossier && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <section className="botanical-index-card rounded-3xl p-7 shadow-lg">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-moss">Herbarium Dossier Record</p>
                  <h2 className="font-serif text-3xl leading-tight text-text-bark">{dossier.commonName}</h2>
                  <p className="italic text-text-stone font-serif">{dossier.scientificName}</p>
                </div>
                <button onClick={reset} className="h-fit text-[11px] font-bold uppercase tracking-wider text-text-stone hover:text-text-bark flex items-center gap-1">
                  <RotateCcw size={12} /> Reset
                </button>
              </div>
              <p className="mt-4 text-sm leading-7 text-text-bark">{dossier.overview}</p>
              <dl className="mt-5">
                <Field k="Temperature" v={`${dossier.idealTempMin}–${dossier.idealTempMax} °C`} />
                <Field k="Humidity" v={`${dossier.idealHumidityMin}–${dossier.idealHumidityMax}% RH`} />
                <Field k="Light" v={`${dossier.photoperiodHours} h photoperiod · ${dossier.light}`} />
                <Field k="Soil" v={`${dossier.soil} · ${dossier.soilPh}`} />
                <Field k="Water" v={dossier.watering} />
                <Field k="Origin" v={`${dossier.origin} · USDA ${dossier.hardinessZones}`} />
                <Field k="Climate" v={dossier.nativeClimate} />
                <Field k="Pathogens" v={dossier.pests} />
              </dl>
            </section>

            <section className="grid md:grid-cols-2 gap-4">
              {([
                { id: 'location' as const, icon: MapPin, title: 'Observed location', copy: 'City or region. Live heat, humidity, UV, wind, rainfall, and day length.' },
                { id: 'simulate' as const, icon: FlaskConical, title: 'Simulated climate', copy: 'Biome + date. Full abiotic sheet generated for that season.' },
              ]).map(opt => (
                <button
                  key={opt.id}
                  onClick={() => { setSiteMode(opt.id); setSite(null); }}
                  className={`text-left rounded-3xl border p-6 transition-all ${siteMode === opt.id ? 'border-moss bg-moss/10 shadow-md' : 'border-border-medium bg-bg-secondary hover:border-moss/40'}`}
                >
                  <opt.icon size={20} className={siteMode === opt.id ? 'text-moss' : 'text-text-stone'} />
                  <p className="mt-3 font-serif text-xl">{opt.title}</p>
                  <p className="mt-1 text-xs leading-5 text-text-stone">{opt.copy}</p>
                </button>
              ))}
            </section>

            {siteMode === 'location' ? (
              <div className="rounded-3xl border border-border-medium bg-bg-secondary p-6 space-y-3">
                <input value={cityQuery} onChange={(e) => setCityQuery(e.target.value)} placeholder="City, region, or landmark" className="w-full p-4 rounded-2xl bg-bg-primary border border-border-medium font-bold" />
                <button onClick={loadLocationSite} disabled={loadingSite} className="w-full py-3.5 rounded-2xl bg-moss text-white font-black uppercase tracking-[0.16em] text-xs disabled:opacity-50">
                  {loadingSite ? 'Reading meteorological sheet…' : 'Lock observed climate'}
                </button>
              </div>
            ) : (
              <div className="rounded-3xl border border-border-medium bg-bg-secondary p-6 space-y-3">
                <select value={biome} onChange={(e) => setBiome(e.target.value)} className="w-full p-4 rounded-2xl bg-bg-primary border border-border-medium font-bold">
                  {BIOMES.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                </select>
                <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="w-full p-4 rounded-2xl bg-bg-primary border border-border-medium font-bold" />
                <label className="flex items-center gap-2 text-sm font-bold px-1">
                  <input type="checkbox" checked={indoor} onChange={(e) => setIndoor(e.target.checked)} /> Indoor chamber (buffered UV, wind, rain)
                </label>
                <button onClick={loadSimulatedSite} className="w-full py-3.5 rounded-2xl bg-gold text-[#2c2419] font-black uppercase tracking-[0.16em] text-xs">
                  Generate abiotic parameter sheet
                </button>
              </div>
            )}

            {site && (
              <div className="rounded-3xl border border-[#b89552]/40 bg-bg-secondary/95 p-6 sm:p-8 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-moss">
                    Hermetic Terrarium Instrumentation · Calibrated Abiotic Sheet
                  </p>
                  <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border border-gold/40 bg-gold/10 text-[#7a5c1e] dark:text-[#d4af37]">
                    LOCKED AT SITE
                  </span>
                </div>
                <h3 className="font-serif text-2xl sm:text-3xl mt-1 text-text-bark font-bold">{site.label}</h3>
                <p className="text-xs text-text-stone mt-1">
                  Condition: {site.weather} · Epoch: {new Date(site.datetime).toLocaleString()}
                </p>

                {/* Hermetic Terrarium Calibrated Brass Dials */}
                <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'Air Temperature', val: `${site.temp}°C`, sub: 'Thermometer', icon: Thermometer },
                    { label: 'Relative Humidity', val: `${site.humidity}%`, sub: 'Hygrometer', icon: Droplets },
                    { label: 'Wind Velocity', val: `${site.windSpeed} km/h`, sub: 'Anemometer', icon: Wind },
                    { label: 'Precipitation', val: `${site.rainfallMm} mm`, sub: 'Pluviometer', icon: Droplets },
                    { label: 'Solar UV Index', val: String(site.uvIndex), sub: 'Actinometer', icon: Sun },
                    { label: 'Photoperiod', val: `${site.photoperiodHours} h`, sub: 'Solar Cycle', icon: Sun },
                    { label: 'Soil Substrate', val: site.soilType, sub: 'Texture Gauge', icon: FlaskConical },
                    { label: 'Substrate Reaction', val: `pH ${site.soilPh}`, sub: 'Ion Meter', icon: FlaskConical },
                  ].map((dial, idx) => (
                    <div
                      key={idx}
                      className="hermetic-climate-dial rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between text-center min-h-[118px] transition-transform hover:scale-[1.02]"
                    >
                      <div className="dial-stamped-ticks mb-1" />
                      <div className="flex items-center justify-center gap-1 text-[#8c6b2d] dark:text-[#caa661]">
                        <dial.icon size={13} />
                        <span className="text-[9px] uppercase tracking-[0.16em] font-black">{dial.sub}</span>
                      </div>
                      <div className="my-1 font-serif font-black text-xl sm:text-2xl text-text-bark truncate">
                        {dial.val}
                      </div>
                      <div className="text-[10px] uppercase font-bold tracking-wider text-text-stone truncate">
                        {dial.label}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={runAssessment}
                  disabled={loadingReport || left <= 0}
                  className="mt-6 w-full py-4 rounded-2xl bg-moss hover:bg-moss/90 text-white font-black uppercase tracking-[0.18em] text-xs flex items-center justify-center gap-2 disabled:opacity-40 shadow-lg shadow-moss/20 transition-all active:scale-[0.99]"
                >
                  {loadingReport ? (
                    'Issuing clinical placement deed…'
                  ) : (
                    <>
                      <FileText size={15} /> Issue Clinical Survivability Deed <ArrowRight size={14} />
                    </>
                  )}
                </button>
                {left <= 0 && (
                  <p className="mt-3 text-center text-xs font-bold text-terracotta">
                    Daily deed quota exhausted ({ASSESSMENTS_PER_DAY} reports per UTC day).
                  </p>
                )}
              </div>
            )}
          </motion.div>
        )}

        {step === 'report' && report && dossier && site && (
          <motion.article initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="print:shadow-none">
            <div className="flex justify-end gap-2 mb-4 print:hidden">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 rounded-xl border border-border-medium bg-bg-secondary text-xs font-black uppercase tracking-wider flex items-center gap-1.5 hover:border-moss transition-colors"
              >
                <Printer size={13} /> Print / Archive PDF
              </button>
              <button
                onClick={reset}
                className="px-4 py-2 rounded-xl border border-border-medium bg-bg-secondary text-xs font-black uppercase tracking-wider flex items-center gap-1.5 hover:bg-moss/10 transition-colors"
              >
                <RotateCcw size={13} /> New Case Intake
              </button>
            </div>

            {/* Royal Survivability Deed */}
            <div className="royal-parchment-deed deckled-border rounded-3xl p-6 sm:p-12 relative overflow-hidden">
              {/* Left vermilion/moss marginal rule */}
              <div className="absolute left-0 top-0 bottom-0 w-2.5" style={{ background: stamp.rule }} />

              {/* Header block with official title and sepia accession mark */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b-2 border-[#2c2419]/25 pb-6">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-[0.32em]" style={{ color: stamp.rule }}>
                    The Royal Specimen Herbarium & Conservatory
                  </span>
                  <h1 className="font-serif text-3xl sm:text-4xl mt-1 leading-tight text-[#241c14] dark:text-[#ede3cc] font-bold">
                    Survivability Placement Deed
                  </h1>
                  <p className="text-[11px] mt-1.5 tracking-widest uppercase text-[#7a6f60] dark:text-[#a89b88]">
                    Horticultural Assessment of Competence · Archive Registry
                  </p>
                </div>

                {/* Sepia Rubber Accession Mark */}
                <div className="sepia-accession-mark p-3 text-[11px] leading-5 shrink-0 rotate-[-2deg] max-w-[260px]">
                  <p className="font-black">ACCESSION: {caseId}</p>
                  <p className="text-[10px]">ISSUED: {(issuedAt || new Date()).toLocaleDateString()}</p>
                  <p className="text-[10px]">QUOTA STAMP: {ASSESSMENTS_PER_DAY - left}/{ASSESSMENTS_PER_DAY}</p>
                </div>
              </div>

              {/* 3D Debossed Vermilion Wax Seal */}
              <div className="my-6 sm:float-right sm:ml-8 sm:mb-6 flex justify-center">
                <div className="tactile-wax-seal w-36 h-36 sm:w-40 sm:h-40 rotate-[-6deg]">
                  <span className="text-[8px] font-black uppercase tracking-[0.25em] opacity-90">ROYAL HERBARIUM</span>
                  <div className="flex items-center gap-0.5 my-0.5">
                    <span className="font-serif text-4xl sm:text-5xl font-black leading-none tracking-tight">
                      {Math.round(report.survivalChance)}
                    </span>
                    <span className="text-xl font-serif font-black">%</span>
                  </div>
                  <span className="text-[10px] font-black tracking-widest uppercase py-0.5 px-2 rounded border border-white/20 bg-black/10">
                    GRADE {gradeOf(report.survivalChance)}
                  </span>
                  <span className="text-[8px] uppercase tracking-[0.16em] opacity-80 mt-1">SURVIVABILITY</span>
                </div>
              </div>

              {/* Section I: Identification */}
              <h2 className="font-serif text-xl border-b border-black/20 dark:border-white/20 pb-1 mb-4 text-[#241c14] dark:text-[#ede3cc] font-semibold">
                I. Specimen & Site Identification
              </h2>
              <table className="w-full text-[13px] mb-8">
                <tbody>
                  {[
                    ['Common name', dossier.commonName],
                    ['Scientific taxon', dossier.scientificName],
                    ['Native climate', dossier.nativeClimate],
                    ['Hardiness rating', `USDA Zones ${dossier.hardinessZones}`],
                    ['Placement mode', site.mode === 'simulate' ? `Hermetic Simulation — ${site.label}${site.indoor ? ' (indoor buffer)' : ''}` : `Observed Ambient — ${site.label}`],
                    ['Inspection epoch', new Date(site.datetime).toLocaleString()],
                    ['Meteorological state', site.weather],
                  ].map(([k, v]) => (
                    <tr key={k} className="border-b border-black/10 dark:border-white/10">
                      <th className="py-2.5 pr-4 text-left font-bold uppercase tracking-wider text-[10px] text-[#7a6f60] dark:text-[#a89b88] w-40 align-top">{k}</th>
                      <td className="py-2.5 leading-relaxed text-[#241c14] dark:text-[#ede3cc]">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Section II: Abiotic Field Ledger */}
              <h2 className="font-serif text-xl border-b border-black/20 dark:border-white/20 pb-1 mb-3 clear-both text-[#241c14] dark:text-[#ede3cc] font-semibold">
                II. Abiotic Ledger at Site
              </h2>
              <div className="overflow-x-auto mb-4 border border-[#8c7355]/30 rounded-lg">
                <table className="w-full text-[12px]">
                  <thead className="bg-[#eae3d4] dark:bg-[#2b241c] text-[#241c14] dark:text-[#ede3cc]">
                    <tr>
                      {['Temp', 'RH', 'Wind', 'Precip', 'UV Index', 'Photoperiod', 'Substrate', 'pH'].map(h => (
                        <th key={h} className="py-2 px-2.5 text-left font-black uppercase tracking-wider text-[9px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-transparent font-mono text-[#241c14] dark:text-[#ede3cc]">
                    <tr>
                      <td className="p-2.5">{site.temp}°C</td>
                      <td className="p-2.5">{site.humidity}%</td>
                      <td className="p-2.5">{site.windSpeed} km/h</td>
                      <td className="p-2.5">{site.rainfallMm} mm</td>
                      <td className="p-2.5">{site.uvIndex}</td>
                      <td className="p-2.5">{site.photoperiodHours} h</td>
                      <td className="p-2.5">{site.soilType}</td>
                      <td className="p-2.5">{site.soilPh}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-[12px] leading-6 text-[#5a4e41] dark:text-[#b8a994] mb-8">
                Species physiological baseline: {dossier.idealTempMin}–{dossier.idealTempMax}°C · {dossier.idealHumidityMin}–{dossier.idealHumidityMax}% RH · {dossier.light} · {dossier.soil}.
              </p>

              {/* Section III: Findings */}
              <h2 className="font-serif text-xl border-b border-black/20 dark:border-white/20 pb-1 mb-3 text-[#241c14] dark:text-[#ede3cc] font-semibold">
                III. Clinical Findings & Verdict
              </h2>
              <p className="font-serif text-2xl sm:text-3xl italic mb-3 font-semibold" style={{ color: stamp.fg }}>
                {report.verdict}
              </p>
              <p className="text-[14px] leading-7 mb-8 text-[#2c2419] dark:text-[#e4dac7]">
                {report.summary}
              </p>

              {/* Section IV: Scored Matrix */}
              <h2 className="font-serif text-xl border-b border-black/20 dark:border-white/20 pb-1 mb-3 text-[#241c14] dark:text-[#ede3cc] font-semibold">
                IV. Scored Survivability Matrix
              </h2>
              <div className="overflow-x-auto mb-8 border border-[#8c7355]/30 rounded-lg">
                <table className="w-full text-[13px]">
                  <thead className="bg-[#eae3d4] dark:bg-[#2b241c] text-[#241c14] dark:text-[#ede3cc]">
                    <tr>
                      <th className="text-left p-2.5 uppercase text-[10px] tracking-wider">Domain</th>
                      <th className="text-left p-2.5 uppercase text-[10px] tracking-wider w-16">Score</th>
                      <th className="text-left p-2.5 uppercase text-[10px] tracking-wider w-14">Grade</th>
                      <th className="text-left p-2.5 uppercase text-[10px] tracking-wider">Index Bar</th>
                    </tr>
                  </thead>
                  <tbody className="text-[#241c14] dark:text-[#ede3cc]">
                    {metrics.map(([label, value], i) => {
                      const v = Math.round(value);
                      return (
                        <tr key={label} className={i % 2 ? 'bg-black/[0.03] dark:bg-white/[0.02]' : ''}>
                          <td className="p-2.5 font-medium">{label}</td>
                          <td className="p-2.5 font-mono font-bold">{v}</td>
                          <td className="p-2.5 font-bold">{gradeOf(v)}</td>
                          <td className="p-2.5">
                            <div className="h-2 bg-black/10 dark:bg-white/10 rounded-full overflow-hidden max-w-[180px]">
                              <div className="h-full rounded-full transition-all" style={{ width: `${v}%`, background: tone(v).rule }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    <tr style={{ background: stamp.bg }}>
                      <td className="p-2.5 font-black text-[#1f1a14]">Overall Survivability (12-Month Index)</td>
                      <td className="p-2.5 font-mono font-black text-[#1f1a14]">{Math.round(report.survivalChance)}</td>
                      <td className="p-2.5 font-black text-[#1f1a14]">{gradeOf(report.survivalChance)}</td>
                      <td className="p-2.5 text-[11px] uppercase tracking-wider font-black" style={{ color: stamp.fg }}>
                        COMPOSITE RATING
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Section V & VI: Recommendations & Risks */}
              <div className="grid sm:grid-cols-2 gap-8 mb-8">
                <div>
                  <h2 className="font-serif text-xl border-b border-black/20 dark:border-white/20 pb-1 mb-3 text-[#241c14] dark:text-[#ede3cc] font-semibold">
                    V. Horticultural Directives
                  </h2>
                  <ol className="list-decimal pl-5 space-y-2.5 text-[13px] leading-6 text-[#2c2419] dark:text-[#e4dac7]">
                    {report.tips.map((t, i) => <li key={i}>{t}</li>)}
                  </ol>
                </div>
                <div>
                  <h2 className="font-serif text-xl border-b border-black/20 dark:border-white/20 pb-1 mb-3 text-[#241c14] dark:text-[#ede3cc] font-semibold">
                    VI. Ecological Risk Register
                  </h2>
                  <ol className="list-decimal pl-5 space-y-2.5 text-[13px] leading-6 text-[#2c2419] dark:text-[#e4dac7]">
                    {report.risks.map((t, i) => <li key={i}>{t}</li>)}
                  </ol>
                </div>
              </div>

              {/* Section VII: Care Protocol */}
              <h2 className="font-serif text-xl border-b border-black/20 dark:border-white/20 pb-1 mb-3 text-[#241c14] dark:text-[#ede3cc] font-semibold">
                VII. Acclimatization & Care Protocol
              </h2>
              <p className="text-[14px] leading-7 whitespace-pre-wrap mb-12 text-[#2c2419] dark:text-[#e4dac7]">
                {report.protocol}
              </p>

              {/* Archival Deed Footer */}
              <footer className="border-t-2 pt-5 flex flex-col sm:flex-row justify-between gap-4 text-[10px] uppercase tracking-[0.16em] text-[#7a6f60] dark:text-[#a89b88] border-[#2c2419]/25">
                <div>
                  <p className="font-bold">Issued by Royal Specimen Herbarium & Clinical Engine</p>
                  <p>Archival survivability certification · Non-transferable botanical deed</p>
                </div>
                <div className="sm:text-right font-mono">
                  <p>DEED RECORD: {caseId}</p>
                  <p>FOLIO: 01 / 01</p>
                </div>
              </footer>
            </div>
          </motion.article>
        )}
      </main>
    </PageWrapper>
  );
}
