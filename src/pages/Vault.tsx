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

  const knownSpecies = useMemo(
    () => [...new Set(dbPlants.filter(p => !p.isDemo).map(p => p.species).filter(Boolean))],
    [dbPlants]
  );

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
    if (left <= 0) return error(`Daily cap reached (${ASSESSMENTS_PER_DAY} assessments). Come back tomorrow.`);
    setLoadingReport(true);
    try {
      const result = await assessPlacement(dossier.scientificName || speciesInput, site);
      if (!consumeAssessment()) return error('Daily cap reached.');
      setLeft(assessmentsLeftToday());
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
    <PageWrapper className="min-h-screen text-text-bark">
      <div className="pointer-events-none fixed inset-0 opacity-[0.35]" style={{
        backgroundImage: 'radial-gradient(ellipse at 20% 0%, rgba(90,125,90,0.18), transparent 50%), radial-gradient(ellipse at 90% 80%, rgba(193,127,89,0.12), transparent 45%)'
      }} />

      <main className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 pt-10 pb-28">
        {step !== 'report' && (
          <header className="mb-10">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] bg-moss text-white">
                <Leaf size={11} /> PhytoDoctor · Clinical Lab
              </span>
              <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.16em] border border-gold/40 text-gold bg-gold/10">
                {left} of {ASSESSMENTS_PER_DAY} reports remaining today
              </span>
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl font-semibold tracking-tight text-text-bark">
              Botanical placement <em className="italic text-moss">sandbox</em>
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-text-stone">
              Intake a species, lock a real or simulated climate, then issue a scored clinical survivability document.
            </p>

            <ol className="mt-8 grid grid-cols-3 gap-2">
              {STEPS.map((s, i) => {
                const active = step === s.id;
                const done = STEPS.findIndex(x => x.id === step) > i;
                return (
                  <li key={s.id} className={`rounded-2xl border px-3 py-3 ${active ? 'border-moss bg-moss/10' : done ? 'border-moss/30 bg-bg-secondary' : 'border-border-light bg-bg-secondary/60'}`}>
                    <p className={`font-mono text-[10px] ${active ? 'text-moss' : 'text-text-muted'}`}>{s.n}</p>
                    <p className="text-[11px] font-bold uppercase tracking-wider mt-0.5">{s.label}</p>
                  </li>
                );
              })}
            </ol>
          </header>
        )}

        {step === 'species' && (
          <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="rounded-[1.75rem] border border-border-medium bg-bg-secondary/90 backdrop-blur-md shadow-xl overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-moss via-gold to-terracotta" />
            <div className="p-7 sm:p-10 space-y-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-moss">Specimen intake</p>
                <h2 className="font-serif text-2xl mt-1">What will you place?</h2>
                <p className="text-sm text-text-stone mt-1">The engine compiles origin, hardiness, and ideal abiotic ranges before any site is chosen.</p>
              </div>
              <input
                value={speciesInput}
                onChange={(e) => setSpeciesInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && runProfile()}
                placeholder="Binomial or common name — Monstera deliciosa, olive, tomato…"
                className="w-full p-5 rounded-2xl bg-bg-primary border border-border-medium font-serif text-xl italic text-text-bark placeholder:text-text-muted/70 focus:outline-none focus:ring-2 focus:ring-moss/40"
              />
              {knownSpecies.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {knownSpecies.slice(0, 8).map(s => (
                    <button key={s} onClick={() => setSpeciesInput(s)} className="px-3 py-1.5 text-xs rounded-full border border-border-light hover:border-moss hover:bg-moss/10 transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <button onClick={runProfile} disabled={loadingProfile} className="w-full py-4 rounded-2xl bg-moss text-white font-black uppercase tracking-[0.18em] text-xs flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-moss/20">
                <Sparkles size={15} /> {loadingProfile ? 'Compiling species dossier…' : 'Compile species dossier'}
              </button>
            </div>
          </motion.section>
        )}

        {step === 'site' && dossier && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            <section className="rounded-[1.75rem] border border-border-medium bg-bg-secondary/90 p-7 shadow-lg">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-moss">Dossier</p>
                  <h2 className="font-serif text-3xl leading-tight">{dossier.commonName}</h2>
                  <p className="italic text-text-stone">{dossier.scientificName}</p>
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
              <div className="rounded-3xl border border-border-medium bg-bg-secondary p-6 sm:p-8 shadow-lg">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gold">Site conditions locked</p>
                <h3 className="font-serif text-2xl mt-1">{site.label}</h3>
                <p className="text-xs text-text-stone mt-1">{site.weather} · {new Date(site.datetime).toLocaleString()}</p>
                <div className="mt-5 overflow-hidden rounded-2xl border border-border-light">
                  {[
                    ['Air temperature', `${site.temp} °C`, <Thermometer size={14} key="t" />],
                    ['Relative humidity', `${site.humidity}%`, <Droplets size={14} key="h" />],
                    ['Wind', `${site.windSpeed} km/h`, <Wind size={14} key="w" />],
                    ['Precipitation', `${site.rainfallMm} mm`, <Droplets size={14} key="r" />],
                    ['UV index', String(site.uvIndex), <Sun size={14} key="u" />],
                    ['Photoperiod', `${site.photoperiodHours} h`, <Sun size={14} key="p" />],
                    ['Soil texture', site.soilType, <FlaskConical size={14} key="s" />],
                    ['Soil pH', String(site.soilPh), <FlaskConical size={14} key="ph" />],
                  ].map((row, i) => (
                    <div key={i} className={`flex items-center justify-between px-4 py-2.5 text-sm ${i % 2 ? 'bg-bg-primary/40' : 'bg-transparent'}`}>
                      <span className="flex items-center gap-2 text-text-stone">{row[2]} {row[0]}</span>
                      <span className="font-mono font-bold">{row[1]}</span>
                    </div>
                  ))}
                </div>
                <button onClick={runAssessment} disabled={loadingReport || left <= 0} className="mt-6 w-full py-4 rounded-2xl bg-[#1c1916] text-[#faf7f2] font-black uppercase tracking-[0.18em] text-xs flex items-center justify-center gap-2 disabled:opacity-40">
                  {loadingReport ? 'Issuing clinical report…' : <><FileText size={15} /> Issue clinical assessment <ArrowRight size={14} /></>}
                </button>
                {left <= 0 && <p className="mt-3 text-center text-xs font-bold text-terracotta">Quota exhausted. Two reports per UTC day.</p>}
              </div>
            )}
          </motion.div>
        )}

        {step === 'report' && report && dossier && site && (
          <motion.article initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="print:shadow-none">
            <div className="flex justify-end gap-2 mb-4 print:hidden">
              <button onClick={() => window.print()} className="px-4 py-2 rounded-xl border border-border-medium bg-bg-secondary text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <Printer size={13} /> Print / PDF
              </button>
              <button onClick={reset} className="px-4 py-2 rounded-xl border border-border-medium text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <RotateCcw size={13} /> New case
              </button>
            </div>

            <div
              className="relative mx-auto"
              style={{ background: '#f6f1e6', color: '#1f1a14', boxShadow: '0 25px 60px rgba(44,36,25,0.18)' }}
            >
              <div className="absolute left-0 top-0 bottom-0 w-2" style={{ background: stamp.rule }} />
              <div className="px-8 sm:px-12 py-10 sm:py-14">
                <div className="flex justify-between items-start gap-6 border-b-2 pb-6" style={{ borderColor: '#1f1a14' }}>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.35em]" style={{ color: stamp.rule }}>PhytoDoctor AI</p>
                    <h1 className="font-serif text-3xl sm:text-4xl mt-1 leading-tight">Clinical Placement Assessment</h1>
                    <p className="text-[11px] mt-2 tracking-wide uppercase text-[#6b6358]">Horticultural survivability · Confidential</p>
                  </div>
                  <div className="text-right text-[11px] font-mono leading-5 shrink-0">
                    <p>CASE {caseId}</p>
                    <p>{(issuedAt || new Date()).toLocaleString()}</p>
                    <p>QUOTA {ASSESSMENTS_PER_DAY - left}/{ASSESSMENTS_PER_DAY}</p>
                  </div>
                </div>

                <div
                  className="mt-8 float-right ml-6 mb-4 w-36 h-36 rounded-full border-[6px] flex flex-col items-center justify-center text-center rotate-[-8deg]"
                  style={{ borderColor: stamp.rule, background: stamp.bg, color: stamp.fg }}
                >
                  <span className="text-[9px] font-black uppercase tracking-widest">Index</span>
                  <span className="font-serif text-4xl font-bold leading-none">{Math.round(report.survivalChance)}</span>
                  <span className="text-[10px] font-black tracking-widest mt-1">GRADE {gradeOf(report.survivalChance)}</span>
                </div>

                <h2 className="font-serif text-xl border-b border-black/20 pb-1 mb-4">I. Identification</h2>
                <table className="w-full text-[13px] mb-8">
                  <tbody>
                    {[
                      ['Common name', dossier.commonName],
                      ['Scientific name', dossier.scientificName],
                      ['Native climate', dossier.nativeClimate],
                      ['Hardiness', dossier.hardinessZones],
                      ['Placement mode', site.mode === 'simulate' ? `Simulated — ${site.label}${site.indoor ? ' (indoor)' : ''}` : `Observed — ${site.label}`],
                      ['Epoch', new Date(site.datetime).toLocaleString()],
                      ['Meteorology', site.weather],
                    ].map(([k, v]) => (
                      <tr key={k} className="border-b border-black/10">
                        <th className="py-2 pr-4 text-left font-bold uppercase tracking-wider text-[10px] text-[#6b6358] w-40 align-top">{k}</th>
                        <td className="py-2 leading-relaxed">{v}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <h2 className="font-serif text-xl border-b border-black/20 pb-1 mb-3 clear-both">II. Abiotic ledger at site</h2>
                <table className="w-full text-[12px] mb-8 border border-black/15">
                  <thead style={{ background: '#eae3d4' }}>
                    <tr>
                      {['Temp', 'RH', 'Wind', 'Precip', 'UV', 'Daylength', 'Soil', 'pH'].map(h => (
                        <th key={h} className="py-2 px-2 text-left font-black uppercase tracking-wider text-[9px]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="font-mono">
                      <td className="p-2">{site.temp}°C</td>
                      <td className="p-2">{site.humidity}%</td>
                      <td className="p-2">{site.windSpeed} km/h</td>
                      <td className="p-2">{site.rainfallMm} mm</td>
                      <td className="p-2">{site.uvIndex}</td>
                      <td className="p-2">{site.photoperiodHours} h</td>
                      <td className="p-2">{site.soilType}</td>
                      <td className="p-2">{site.soilPh}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="text-[12px] leading-6 text-[#4a433c] mb-8 -mt-4">
                  Ideal for this taxon: {dossier.idealTempMin}–{dossier.idealTempMax}°C · {dossier.idealHumidityMin}–{dossier.idealHumidityMax}% RH · {dossier.light} · {dossier.soil}.
                </p>

                <h2 className="font-serif text-xl border-b border-black/20 pb-1 mb-3">III. Findings</h2>
                <p className="font-serif text-2xl italic mb-3" style={{ color: stamp.fg }}>{report.verdict}</p>
                <p className="text-[14px] leading-7 mb-8 text-[#2c2419]">{report.summary}</p>

                <h2 className="font-serif text-xl border-b border-black/20 pb-1 mb-3">IV. Scored matrix</h2>
                <table className="w-full text-[13px] mb-8 border border-black/15">
                  <thead style={{ background: '#eae3d4' }}>
                    <tr>
                      <th className="text-left p-2.5 uppercase text-[10px] tracking-wider">Domain</th>
                      <th className="text-left p-2.5 uppercase text-[10px] tracking-wider w-16">Score</th>
                      <th className="text-left p-2.5 uppercase text-[10px] tracking-wider w-12">Grade</th>
                      <th className="text-left p-2.5 uppercase text-[10px] tracking-wider">Band</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.map(([label, value], i) => {
                      const v = Math.round(value);
                      return (
                        <tr key={label} className={i % 2 ? 'bg-black/[0.03]' : ''}>
                          <td className="p-2.5">{label}</td>
                          <td className="p-2.5 font-mono font-bold">{v}</td>
                          <td className="p-2.5 font-bold">{gradeOf(v)}</td>
                          <td className="p-2.5">
                            <div className="h-1.5 bg-black/10 rounded-full overflow-hidden max-w-[180px]">
                              <div className="h-full" style={{ width: `${v}%`, background: tone(v).rule }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    <tr style={{ background: stamp.bg }}>
                      <td className="p-2.5 font-bold">Overall survivability (12 mo.)</td>
                      <td className="p-2.5 font-mono font-bold">{Math.round(report.survivalChance)}</td>
                      <td className="p-2.5 font-bold">{gradeOf(report.survivalChance)}</td>
                      <td className="p-2.5 text-[11px] uppercase tracking-wider font-bold" style={{ color: stamp.fg }}>Index</td>
                    </tr>
                  </tbody>
                </table>

                <div className="grid sm:grid-cols-2 gap-8 mb-8">
                  <div>
                    <h2 className="font-serif text-xl border-b border-black/20 pb-1 mb-3">V. Recommendations</h2>
                    <ol className="list-decimal pl-5 space-y-2.5 text-[13px] leading-6">
                      {report.tips.map((t, i) => <li key={i}>{t}</li>)}
                    </ol>
                  </div>
                  <div>
                    <h2 className="font-serif text-xl border-b border-black/20 pb-1 mb-3">VI. Risk register</h2>
                    <ol className="list-decimal pl-5 space-y-2.5 text-[13px] leading-6">
                      {report.risks.map((t, i) => <li key={i}>{t}</li>)}
                    </ol>
                  </div>
                </div>

                <h2 className="font-serif text-xl border-b border-black/20 pb-1 mb-3">VII. Care protocol</h2>
                <p className="text-[14px] leading-7 whitespace-pre-wrap mb-12">{report.protocol}</p>

                <footer className="border-t-2 pt-5 flex flex-col sm:flex-row justify-between gap-4 text-[10px] uppercase tracking-[0.16em] text-[#6b6358]" style={{ borderColor: '#1f1a14' }}>
                  <div>
                    <p>Prepared by PhytoDoctor Clinical Engine</p>
                    <p>Not a substitute for local extension service or licensed agronomy</p>
                  </div>
                  <div className="sm:text-right">
                    <p>Document {caseId}</p>
                    <p>Page 1 of 1</p>
                  </div>
                </footer>
              </div>
            </div>
          </motion.article>
        )}
      </main>
    </PageWrapper>
  );
}
