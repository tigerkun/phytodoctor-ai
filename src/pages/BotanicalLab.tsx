import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { useSearchParams } from 'react-router-dom';
import { 
  Camera, 
  Sparkles, 
  BookOpen, 
  Heart, 
  Sprout,
  HelpCircle, 
  AlertTriangle, 
  Info, 
  UploadCloud, 
  Flame, 
  Coins, 
  CheckCircle,
  Plus,
  RefreshCw,
  X,
  ChevronDown,
  Droplets,
  Sun,
  Thermometer,
  Compass,
  History,
  ArrowRight,
  TrendingUp,
  FileText,
  Check
} from 'lucide-react';
import StreakPopup from '../components/game/StreakPopup';
import { db } from '../db/database';
import { GameService } from '../services/gameService';
import { identifyPlant, coerceLegacyToReport, type PlantScanReport } from '../services/geminiService';
import ScanHistoryPanel from '../components/scan/ScanHistoryPanel';
import PlantTelemetryCard from '../components/scan/PlantTelemetryCard';
import { inferLightFromWeather } from '../lib/environmentalSimulation';
import { PlantService, onPlantsChange } from '../services/plantService';
import { StorageService } from '../services/storageService';
import { analyzePlantHealth, type PlantSignature } from '../services/driftDetector';
import type { Plant } from '../types';

import { usePageTransition } from '../components/home/PageTransitionContext';
import { getPlantPhoto } from '../utils/plantImage';
import PageWrapper from '../components/home/PageWrapper';
import { useGeolocation } from '../hooks/useGeolocation';
import { prepareScanImage } from '../utils/imagePipeline';
import { fetchWeather } from '../utils/weatherIntegration';
import { updateUploadStreak } from '../game/rewardUtils';
import { useToast } from '../components/Toast';
import { useIsAuthenticated } from '../hooks/useIsAuthenticated';
import { triggerHaptic } from '../utils/hapticAudio';
import { rememberAuthReturn, stashPendingScan, takePendingScan, clearPendingScan } from '../lib/guestHandoff';
import NonPlantReport from '../components/scan/NonPlantReport';

// Rarity mapping helper
function getRarityFromSpecies(species: string): 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' {
  const s = species.toLowerCase();
  if (s.includes('corpse') || s.includes('ghost') || s.includes('jade vine')) return 'legendary';
  if (s.includes('variegated') || s.includes('dragon scale') || s.includes('pink princess')) return 'epic';
  if (s.includes('monstera') || s.includes('fiddle') || s.includes('fern')) return 'rare';
  if (s.includes('snake') || s.includes('pothos') || s.includes('spider')) return 'uncommon';
  return 'common';
}

interface Particle {
  id: number;
  x: number;
  y: number;
  scale: number;
}

/**
 * Real phases of a scan, in order. The overlay used to cycle four
 * decorative messages on a 1.5s timer for the whole scan regardless of what
 * was actually happening, so a fast identification and a two-minute
 * photo upload looked identical. Each stage below is entered when the work
 * it names actually begins, and stays until that work finishes.
 */
type ScanStage = 'idle' | 'reading' | 'identifying' | 'uploading' | 'saving' | 'rewarding';

const SCAN_STAGES: { id: Exclude<ScanStage, 'idle'>; label: string }[] = [
  { id: 'reading', label: 'Reading the specimen slide' },
  { id: 'identifying', label: 'Identifying species and symptoms' },
  { id: 'uploading', label: 'Storing the photo in your vault' },
  { id: 'saving', label: 'Adding the specimen to your sanctuary' },
  { id: 'rewarding', label: 'Awarding seeds and experience' },
];

const SCAN_STAGE_ORDER: ScanStage[] = SCAN_STAGES.map(s => s.id);

/**
 * The non-plant branch of the scan. The scanner's contract has always been
 * "point it at a plant", and pointing it at a mug or a dog used to produce a
 * confident-looking diagnosis of the mug. The model now triages first; this is
 * the page those scans land on instead.
 *
 * Two flavours with different copy: `non_living` is a polite refusal (the
 * product only analyses living things); `living_non_plant` is a friendly
 * deflection (something alive was seen, but there is no botanical verdict for
 * it). Neither awards seeds, and neither saves a specimen.
 */


/**
 * The three-check provenance readout for a plant scan. Shown compactly so it
 * reads as provenance of the photo, not a warning about the plant.
 */
function ProvenanceBadge({ provenance }: { provenance: any }) {
  if (!provenance?.verdict) return null;
  const isCaptured = provenance.verdict === 'self_captured';
  const isSynthetic = provenance.verdict === 'likely_synthetic';
  const chip = isCaptured
    ? 'bg-emerald-100/80 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800'
    : isSynthetic
      ? 'bg-rose-100/80 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
      : 'bg-amber-100/80 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
  const label = isCaptured ? '📷 Self-captured' : isSynthetic ? '⚠ Likely AI/web image' : '❔ Origin unverified';

  const checks = provenance.checks || {};
  const checkLine = [
    checks.captureMetadata === 'pass' ? 'camera metadata ✓' : 'camera metadata ✗',
    checks.containerForensics === 'clean' ? 'file forensics clean ✓' : 'file forensics flagged ✗',
    checks.modelJudgment === 'clean' ? 'visual check ✓' : checks.modelJudgment === 'flagged' ? 'visual check ✗' : 'visual check —',
  ].join(' · ');

  return (
    <div className="group relative inline-block">
      <span className={`px-2.5 py-1 border rounded-md text-[10px] font-black uppercase tracking-wider font-mono cursor-help ${chip}`}>
        {label}
      </span>
      <div className="absolute z-20 left-0 top-full mt-2 w-72 p-3 rounded-lg bg-bg-primary border border-border-medium shadow-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
        <p className="text-[10px] font-mono uppercase tracking-wider text-text-muted mb-1.5">{checkLine}</p>
        {(provenance.reasons || []).map((r: string, i: number) => (
          <p key={i} className="text-[11px] text-text-stone leading-snug">· {r}</p>
        ))}
      </div>
    </div>
  );
}



export default function BotanicalLab() {
  const { success, error } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab: 'dex' | 'sanctuary' | 'history' =
    searchParams.get('tab') === 'sanctuary' ? 'sanctuary'
    : searchParams.get('tab') === 'history' ? 'history'
    : 'dex';

  // Tabs: 'dex' = Garden-Dex, 'sanctuary' = My Sanctuary, 'history' = Herbarium Archive
  const [activeTab, setActiveTab] = useState<'dex' | 'sanctuary' | 'history'>(initialTab);
  
  // Modals & Panels
  const [showLedger, setShowLedger] = useState(false);
  const [activeAccordion, setActiveAccordion] = useState<number | null>(null);

  const [scanMode, setScanMode] = useState<'consult' | 'index'>('consult');
  const [magnification, setMagnification] = useState<'10x' | '40x' | '100x'>('40x');
  
  const [streakPopupData, setStreakPopupData] = useState<{ streak: number, seeds: number } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [scanStage, setScanStage] = useState<ScanStage>('idle');
  const [dexImage, setDexImage] = useState<string | null>(null);
  const [dexResult, setDexResult] = useState<any | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isNewSpecies, setIsNewSpecies] = useState(false);
  const [discoveryBonus, setDiscoveryBonus] = useState(0);
  const [scannedRewards, setScannedRewards] = useState<{ seeds: number; xp: number } | null>(null);
  // The provenance gate's hold on this scan's reward, if any. `attested` is
  // set once the Keeper confirms the photo was their own.
  const [provenanceHold, setProvenanceHold] = useState<{ verdict: string; withheldSeeds: number } | null>(null);
  const [attested, setAttested] = useState(false);
  const [attesting, setAttesting] = useState(false);
  // Guest lane. A visitor may scan without an account; the save is where the
  // account is asked for, and `guestHoldout` holds the panel open until they
  // either leave for sign-up or go back to scanning.
  const isAuthed = useIsAuthenticated();
  const [guestHoldout, setGuestHoldout] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanStartRef = useRef<number>(0);
  const [scanElapsed, setScanElapsed] = useState(0);

  // Elapsed seconds since the scan began. A slow scan is normal on the first
  // call — the model chain is walked from the top each time — so showing the
  // clock is more honest than a message that implies progress.
  useEffect(() => {
    if (!uploading) return;
    const tick = () => setScanElapsed(Math.floor((Date.now() - scanStartRef.current) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [uploading]);

  const [coins, setCoins] = useState<Particle[]>([]);
  const coinIdCounter = useRef(0);

  // Update logic state
  const updatePhotoInputRef = useRef<HTMLInputElement>(null);
  const [updatingPlantId, setUpdatingPlantId] = useState<string | null>(null);
  const [isUpdatingPhoto, setIsUpdatingPhoto] = useState(false);
  const [isUplinkingPhoto, setIsUplinkingPhoto] = useState(false);

  const { transitionTo } = usePageTransition();


  const userId = GameService.getUserId();
  const profile = useLiveQuery(() => GameService.getProfile(userId), [userId]);
  const [dbPlants, setDbPlants] = useState<Plant[]>([]);

  useEffect(() => {
    PlantService.fetchPlants().then(setDbPlants);
    return onPlantsChange(setDbPlants);
  }, []);

  // Coming back from sign-up: put the guest's diagnosis back on the bench
  // instead of making them spend a scan to find out what they already learned.
  useEffect(() => {
    const pending = takePendingScan();
    if (!pending) return;
    setDexImage(pending.image);
    // A scan stashed before the report contract shipped has no `report` —
    // coerce it so the restored payload satisfies the same shape as a live one.
    const restored: any = pending.result;
    setDexResult(restored?.report ? restored : { ...restored, report: coerceLegacyToReport(restored) });
    setScanMode('consult');
    success('Your diagnosis was waiting for you — index it to keep it.');
  }, []);

  // Only the sanctuary's own check-ins are read here, so scope the query to
  // those plant ids. db.checkins.toArray() pulled every user's history on
  // every write to the table. Keyed on a stable id string so the query only
  // re-runs when the collection actually changes.
  const plantIds = useMemo(
    () => dbPlants.filter(p => !p.isDemo).map(p => p.id).sort().join(','),
    [dbPlants]
  );
  const checkins = useLiveQuery(
    () => (plantIds ? db.checkins.where('plantId').anyOf(plantIds.split(',')).toArray() : []),
    [plantIds]
  ) || [];


  const { location, city } = useGeolocation();

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'sanctuary') {
      setActiveTab('sanctuary');
    } else if (tabParam === 'history') {
      setActiveTab('history');
    } else if (tabParam === 'dex') {
      setActiveTab('dex');
    }
  }, [searchParams]);

  const triggerCoinBurst = (e?: React.MouseEvent) => {
    const startX = e ? e.clientX : window.innerWidth / 2;
    const startY = e ? e.clientY : window.innerHeight / 2;

    const newCoins = Array.from({ length: 12 }).map(() => ({
      id: coinIdCounter.current++,
      x: startX + (Math.random() - 0.5) * 160,
      y: startY + (Math.random() - 0.5) * 160 - 100,
      scale: 0.6 + Math.random() * 0.8
    }));

    setCoins(prev => [...prev, ...newCoins]);
    setTimeout(() => {
      setCoins(prev => prev.filter(c => !newCoins.find(nc => nc.id === c.id)));
    }, 1500);
  };

  const resetDexScan = (openPicker = true) => {
    setDexImage(null);
    setDexResult(null);
    setUploading(false);
    setScanStage('idle');
    setScanElapsed(0);
    setIsNewSpecies(false);
    setScannedRewards(null);
    setProvenanceHold(null);
    setAttested(false);
    setGuestHoldout(false);
    clearPendingScan();
    setScanError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (openPicker) {
      setTimeout(() => {
        fileInputRef.current?.click();
      }, 50);
    }
  };

  const handleIndexSpecimen = async (resultToUse?: any, photoUrl?: string) => {
    const target = (resultToUse || dexResult)?.report;
    const photo = photoUrl || dexImage;
    if (!target || !photo) return;

    // Hard gate: non-plant scans cannot be indexed or award seeds. The report
    // carries the server's one canonical verdict — no client-side guessing.
    if (target.kind !== 'plant') {
      error('Only botanical specimens can be indexed to your sanctuary.');
      return;
    }

    // The conversion moment. A guest just saw the product work -- the save is
    // where an account starts to matter, so this is where the ask happens,
    // with the diagnosis still on screen and the seeds promised on the other
    // side of sign-up. Nothing is saved or awarded for a guest: the local
    // economy is the signed-in Keeper's game.
    if (!isAuthed) {
      setGuestHoldout(true);
      triggerHaptic();
      // Carry the diagnosis across the sign-up wall so coming back does not
      // cost the visitor a second scan.
      rememberAuthReturn('/lab?tab=dex');
      stashPendingScan(photo, resultToUse || dexResult);
      return;
    }
    const plantReport = target as PlantScanReport;
    const species = plantReport.scientificName || plantReport.displayName;
    const rarity = getRarityFromSpecies(species);
    let finalPhotoUrl = photo;
    if (photo && photo.startsWith('data:')) {
      setScanStage('uploading');
      setIsUplinkingPhoto(true);
      try {
        const cloudUrl = await StorageService.uploadPlantPhotoFromDataUrl(photo, userId);
        if (cloudUrl) {
          finalPhotoUrl = cloudUrl;
        }
      } finally {
        setIsUplinkingPhoto(false);
      }
    }

    setScanStage('saving');
    const plant = await GameService.indexScannedPlant(plantReport, finalPhotoUrl, userId);
    setDexResult((prev: any) => prev ? { ...prev, plantId: plant.id } : prev);

    setScanStage('rewarding');
    const alreadyDiscovered = profile?.discoveredSpecies?.includes(species);
    let resSeeds = 0;
    let resXp = 0;
    if (!alreadyDiscovered) {
      setIsNewSpecies(true);
      triggerCoinBurst();
      const res = await GameService.awardDiscoveryReward(species, rarity);
      const streakRes = await updateUploadStreak(userId);
      if (streakRes.continuedToday) {
        setStreakPopupData({ streak: streakRes.currentStreak, seeds: res.seedsAwarded });
      }
      resSeeds = res.seedsAwarded;
      resXp = res.xpAwarded;
    } else {
      const res = await GameService.awardRewardForAction('diagnosis_upload');
      const streakRes = await updateUploadStreak(userId);
      if (streakRes.continuedToday) {
        setStreakPopupData({ streak: streakRes.currentStreak, seeds: res.seedsAwarded });
      }
      resSeeds = res.seedsAwarded;
      resXp = res.xpAwarded;
      triggerCoinBurst();
    }

    // ── Provenance gate ──
    // The diagnosis is never withheld: only the currency is. An image with no
    // capture metadata pays half; one carrying generator evidence pays nothing
    // until the Keeper attests. The clawback is a separate ledger line rather
    // than a silent scale-down, so the trail shows exactly what was withheld
    // and why. Payloads from before the feature carried no verdict at all and
    // default to permissive — the gate must never punish what it cannot see.
    const verdict: string = target.provenance?.verdict || 'self_captured';
    if (verdict !== 'self_captured' && resSeeds > 0) {
      const clawback = verdict === 'likely_synthetic' ? resSeeds : Math.floor(resSeeds / 2);
      if (clawback > 0) {
        try {
          await GameService.spendSeeds(clawback, 'spend', `Provenance gate (${verdict}): ${species}`);
          setProvenanceHold({ verdict, withheldSeeds: clawback });
          resSeeds -= clawback;
        } catch {
          // A cap-exhausted balance cannot absorb the clawback; let the full
          // award stand rather than throwing away a completed scan.
        }
      }
    }
    setScannedRewards({ seeds: resSeeds, xp: resXp });

    await GameService.generateCardForPlant(plant.id, userId);
    if (!alreadyDiscovered) setDiscoveryBonus(resSeeds);
  };

  /**
   * The button path into indexing. `handleIndexSpecimen` throws for real
   * reasons -- a photo that will not upload, a weekly discovery cap that is
   * already spent -- and the button called it bare, so a failure became an
   * unhandled rejection: no toast, no error on the bench, a button that simply
   * re-enabled. The Keeper would lose a paid scan to a silent no-op. The
   * scan-from-file path already had a catch around this call.
   */
  const indexSpecimen = async () => {
    try {
      await handleIndexSpecimen();
    } catch (err: any) {
      setScanStage('idle');
      setIsUplinkingPhoto(false);
      error(err?.message || 'Could not index this specimen.');
    }
  };

  /**
   * One-tap fail-safe: the metadata check is evidence, not a verdict, and it
   * can be wrong about a photo the Keeper actually took. Attesting releases
   * exactly what the gate withheld, through the ledger so the reversal is
   * visible too.
   */
  const attestSelfCaptured = async () => {
    if (!provenanceHold || attesting) return;
    setAttesting(true);
    try {
      await GameService.earnSeeds(
        provenanceHold.withheldSeeds,
        'bonus',
        'Attested self-captured: provenance reward released'
      );
      success(`${provenanceHold.withheldSeeds} seeds returned — thank you for confirming.`);
      setScannedRewards(prev => prev
        ? { ...prev, seeds: prev.seeds + provenanceHold.withheldSeeds }
        : prev);
      setProvenanceHold(null);
      setAttested(true);
    } catch (e: any) {
      error(e.message || 'Could not release the withheld reward.');
    } finally {
      setAttesting(false);
    }
  };

  const handleDexUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    scanStartRef.current = Date.now();
    setUploading(true);
    setScanStage('reading');
    setDexResult(null);
    setScanError(null);
    setIsNewSpecies(false);
    setScannedRewards(null);
    setProvenanceHold(null);
    setAttested(false);

    const runScan = async () => {
      let base64: string;
      try {
        // Downscaled in-browser first: a raw phone photo is 4-11MB of base64,
        // which crawls on mobile data and dies at the server's 6MB cap before
        // the AI ever sees it. The model reads symptoms, not lens detail.
        const prepared = await prepareScanImage(file);
        base64 = prepared.dataUrl;
      } catch {
        setScanError("Failed to read the selected photo file.");
        setUploading(false);
        setScanStage('idle');
        return;
      }
      setDexImage(base64);

      try {
        let locationCtx: any;
        if (location?.latitude && location?.longitude) {
            locationCtx = { city, latitude: location.latitude, longitude: location.longitude };
        } else if (city) {
            locationCtx = { city };
        }

        setScanStage('identifying');
        const result = await identifyPlant(base64, locationCtx);
        setDexResult(result);

        if (scanMode === 'index') {
          await handleIndexSpecimen(result, base64);
        }
      } catch (err: any) {
        console.error('Scan Error:', err);
        setScanError(err.message || 'Failed to identify plant.');
        setDexImage(null);
      } finally {
        setUploading(false);
        setScanStage('idle');
      }
    };
    void runScan();
  };

  const handleUpdateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetPlantId = updatingPlantId;
    if (!file || !targetPlantId) return;

    setIsUpdatingPhoto(true);
    setScanError(null);

    const runUpdate = async () => {
      let base64: string;
      try {
        // Same preparation as the first scan; the archived copy that goes to
        // cloud storage below keeps the original file untouched.
        const prepared = await prepareScanImage(file);
        base64 = prepared.dataUrl;
      } catch {
        setScanError("Failed to read the selected photo file.");
        setIsUpdatingPhoto(false);
        setUpdatingPlantId(null);
        return;
      }

      try {
        // The check-in re-diagnosis gets the Keeper's place too — the
        // location-aware fields on the payload used to come back empty here.
        let locationCtx: any;
        if (location?.latitude && location?.longitude) {
          locationCtx = { city, latitude: location.latitude, longitude: location.longitude };
        } else if (city) {
          locationCtx = { city };
        }
        const result = await identifyPlant(base64, locationCtx);
        const plant = await db.plants.get(targetPlantId);
        if (!plant) throw new Error("Specimen record not found in Sanctuary.");

        // The new photo must show the same specimen. A photo of something else
        // (or of nothing alive) is not a check-in for this plant, so neither
        // the photo, the seeds nor the streak move.
        if (result?.report?.kind === 'non_living') {
          setScanError(result.report.message || 'Only living specimens are analysed — this photo does not update the record.');
          return;
        }
        if (result?.report?.kind !== 'plant') {
          setScanError(`That photo shows ${result.report.displayName || 'something living'}, not the registered plant. Photo not updated.`);
          return;
        }

        // BUG-13: Compare genus using scientificName (a real binomial) on both
        // sides. Using displayName / common name produces false mismatches:
        // "Swiss Cheese Plant" gives genus "swiss" which never equals "monstera".
        // Only treat plant.species as a genus source when it contains a space
        // (i.e. looks like a binomial), otherwise skip the check.
        const newScientific = result?.report?.scientificName || '';
        const newGenus = newScientific.split(' ')[0].toLowerCase();
        const oldSpecies = (plant.species || '');
        const oldGenus = oldSpecies.includes(' ') ? oldSpecies.split(' ')[0].toLowerCase() : '';

        if (oldGenus && newGenus && oldGenus !== newGenus) {
          const displayResult = result?.report?.displayName || newScientific || 'another species';
          setScanError(`Identification mismatch: specimen appears to be ${displayResult}, differing from registered ${plant.species}.`);
          return;
        }

        const today = new Date();
        const cloudUrl = await StorageService.uploadPlantPhoto(file, userId);
        if (!cloudUrl) {
          throw new Error("Failed to upload photo to secure vault.");
        }

        // BUG-06 fix: seeds granted after successful upload — retry-safe
        await GameService.earnSeeds(15, 'bonus', 'Updated plant photo check-in');
        const streakRes = await updateUploadStreak(userId);
        if (streakRes.continuedToday) {
          setStreakPopupData({ streak: streakRes.currentStreak, seeds: 15 });
        }
        triggerCoinBurst();

        await PlantService.updatePlant(targetPlantId, {
          checkInTime: 'just now',
          updatedAt: today,
          photoUrl: cloudUrl
        });

        // Re-derive the health numbers instead of asserting them. This path
        // used to write guardianScore: 95, driftScore: 0.1 and a hardcoded
        // "Sunny, 25°C" onto every plant, so a specimen that was visibly
        // failing still drew a flat healthy line on its timeline, and the
        // weather row was fiction regardless of where the Keeper was. The
        // score now follows from the photo they actually uploaded.
        const previous = await db.checkins
          .where('plantId').equals(targetPlantId)
          .reverse().sortBy('timestamp');

        let signature: PlantSignature | null = null;
        let driftScore: number | null = null;
        let driftStatus: 'stable' | 'watching' | 'alert' | null = null;
        try {
          const analysis = await analyzePlantHealth(file, plant.baselineSignature ?? null, plant.species);
          signature = analysis.signature;
          driftScore = analysis.driftScore;
          driftStatus = analysis.driftStatus;
        } catch (analysisErr) {
          // Drift analysis is a bonus on a photo refresh, not the point of it.
          // Failing it must not lose the upload or the seeds, so the check-in
          // still records — with a null drift reading rather than a fake one.
          console.warn('[Lab] Drift analysis skipped on photo refresh:', analysisErr);
        }

        const guardianScore = driftScore === null
          ? plant.guardianScore
          : Math.max(0, Math.min(100, Math.round(100 - driftScore * 60)));

        await db.checkins.add({
          id: crypto.randomUUID(),
          plantId: targetPlantId,
          timestamp: today,
          // A photo refresh is not a care observation, so the last real reading
          // stands rather than being invented. Null on a first-ever check-in,
          // which is the truth: nobody has recorded it yet.
          soilMoisture: previous[0]?.soilMoisture ?? null,
          lightLevel: previous[0]?.lightLevel ?? null,
          changes: ['Photo updated via Wet Lab'],
          photoBlob: null,
          photoUrl: cloudUrl,
          signature,
          guardianScore,
          driftScore,
          driftStatus,
          weatherTemp: result?.report?.weather?.temp ?? null,
          weatherHumidity: result?.report?.weather?.humidity ?? null,
          weatherDescription: result?.report?.weather?.condition ?? null,
          synced: 0
        });

        await PlantService.updatePlant(targetPlantId, {
          checkInTime: 'just now',
          updatedAt: today,
          photoUrl: cloudUrl,
          guardianScore,
          status: driftStatus === null ? plant.status
            : driftStatus === 'stable' ? 'Stable'
            : driftStatus === 'watching' ? 'Watching' : 'Alert',
          ...(signature && !plant.baselineSignature ? { baselineSignature: signature } : {}),
        });

      } catch (err: any) {
        console.error("Specimen update error:", err);
        setScanError(err.message || "Failed to process specimen update photo.");
      } finally {
        setIsUpdatingPhoto(false);
        setUpdatingPlantId(null);
        if (updatePhotoInputRef.current) {
          updatePhotoInputRef.current.value = '';
        }
      }
    };
    void runUpdate();
  };

  const handleUpdatePhoto = (plantId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setUpdatingPlantId(plantId);
    updatePhotoInputRef.current?.click();
  };

  const handleAddNewSlot = () => {
    setActiveTab('dex');
    setSearchParams({ tab: 'dex' });
    setScanMode('index');
    resetDexScan();
  };

  // Latest check-in per plant, built once per checkins change. isPlantActive
  // used to re-filter and re-reduce the entire check-in list for every card
  // on every render, and the card body repeated the same reduce a second time.
  const latestCheckinByPlant = useMemo(() => {
    const latest = new Map<string, (typeof checkins)[number]>();
    for (const c of checkins) {
      const prev = latest.get(c.plantId);
      if (!prev || new Date(c.timestamp) > new Date(prev.timestamp)) latest.set(c.plantId, c);
    }
    return latest;
  }, [checkins]);

  const today = new Date().toDateString();
  const isPlantActive = (plantId: string) => {
    const latest = latestCheckinByPlant.get(plantId);
    return !!latest && new Date(latest.timestamp).toDateString() === today;
  };

  const sanctuaryPlants = useMemo(() => {
    const byType = new Map<string, (typeof dbPlants)[number]>();
    for (const plant of dbPlants) {
      if (plant.isDemo) continue;
      const key = (plant.species || plant.name || plant.id).toLowerCase();
      const prev = byType.get(key);
      if (!prev || new Date(plant.updatedAt).getTime() > new Date(prev.updatedAt).getTime()) {
        byType.set(key, plant);
      }
    }
    return [...byType.values()];
  }, [dbPlants]);

  return (
    <PageWrapper className="min-h-screen skin-lab text-text-bark relative overflow-hidden font-sans transition-colors duration-1000">
      <AnimatePresence>
        {coins.map((c) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 1, x: c.x - 20, y: c.y }}
            animate={{ opacity: [1, 1, 0], y: c.y - 120, scale: [0.5, c.scale, 0.3] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            className="fixed z-50 text-2xl select-none pointer-events-none flex items-center gap-1 font-bold text-gold filter drop-shadow-md"
          >
            🌱 <span className="text-sm font-sans">+15</span>
          </motion.div>
        ))}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 relative z-10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 sm:mb-12 border-b border-border-light pb-6 sm:pb-8 w-full">
          <div className="flex-grow min-w-0 max-w-2xl">
            {/* A guest has no nav bar to click, so the way back to the
                landing page has to live here. */}
            {!isAuthed && (
              <button
                onClick={() => transitionTo('/', 'Estate')}
                // min-h, not py: at the floored 11px type the line box is 16.5px,
                // so `py-2` reaches only 32.5px. This was 17px tall before either
                // -- under half the touch minimum, on the front door of the
                // product, on the one control a signed-out visitor has for
                // leaving. The negative horizontal margin grows the hit area
                // without shifting the label off its optical edge.
                className="mb-3 -mx-2 flex items-center gap-1.5 min-h-[44px] text-[10px] font-black uppercase tracking-widest text-text-stone hover:text-moss transition-colors font-mono"
              >
                ← Back to the Estate
              </button>
            )}
            <p className="lab-kicker mb-2">Expedition Wet Lab · Microscope Bench № 02</p>
            <h1 className="text-3xl sm:text-4xl font-serif font-black text-text-bark flex items-center gap-3">
              Botanical Lab <span className="text-moss">🔬</span>
            </h1>
            <p className="text-text-stone text-xs sm:text-sm mt-2 leading-relaxed">
              Precision optical inspection, clinical disease diagnosis, and specimen slide registry.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 sm:gap-4 shrink-0">
            <div className="bg-bg-secondary p-1 rounded-full flex relative border border-border-light shadow-sm">
              {(['dex', 'sanctuary', 'history'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => { setActiveTab(tab); setSearchParams({ tab }); }}
                  className={`relative z-10 px-4 sm:px-6 py-2.5 sm:py-3 min-h-[44px] rounded-full text-xs font-black uppercase tracking-wider transition-colors duration-300 flex items-center gap-2 ${
                    activeTab === tab ? 'text-white' : 'text-text-stone hover:text-text-bark'
                  }`}
                >
                  {tab === 'dex' ? <Compass size={12} /> : tab === 'sanctuary' ? <Heart size={12} /> : <History size={12} />}
                  {tab === 'dex' ? 'Plant Database' : tab === 'sanctuary' ? 'Garden Sanctuary' : 'Archive'}
                  {activeTab === tab && <motion.div layoutId="labTabIndicator" className="absolute inset-0 bg-moss-deep rounded-full -z-10" />}
                </button>
              ))}
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowLedger(true)}
              className="flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 min-h-[44px] rounded-full bg-terracotta-deep hover:bg-terracotta text-white font-bold text-xs uppercase tracking-wider transition-all shadow-md shrink-0"
            >
              <Coins size={12} /> Rewards
            </motion.button>
          </div>
        </div>

        {/* Guest strip. The Lab is public now, so a visitor needs to know the
            rules and what an account buys -- stated plainly, once, without
            getting in the way of the scan. */}
        {!isAuthed && (
          <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 rounded-2xl border border-gold/30 bg-gold/5">
            <p className="text-xs text-text-stone leading-relaxed">
              <span className="font-black text-text-bark uppercase tracking-wider font-mono text-[11px]">Guest bench</span>
              {' — '}2 free diagnoses a day. A free account raises that to 3, and keeps your specimens,
              streak and seeds.
            </p>
            <button
              onClick={() => { rememberAuthReturn('/lab?tab=dex'); transitionTo('/auth', 'Sign up'); }}
              // The only call to action on this panel, and it was 34px tall at
              // 11px type -- `py-2` is 8px a side plus a ~18px line box. The phone
              // type floor raises the type, not the padding, so the height has to
              // be asked for explicitly.
              className="shrink-0 min-h-[44px] inline-flex items-center justify-center px-4 py-2 rounded-full bg-moss-deep hover:brightness-110 text-white font-black uppercase tracking-widest text-[11px] transition-all active:scale-95 font-mono whitespace-nowrap"
            >
              Sign up free
            </button>
          </div>
        )}

        {activeTab === 'dex' && (
          <div className="grid grid-cols-1 gap-8 relative">
            <div className="dissection-board flex flex-col items-center justify-center min-h-[420px] p-4 sm:p-8 rounded-3xl relative overflow-hidden border border-[#3d6b4a]/25 dark:border-[#8fb58f]/20 shadow-md">
              {/* Dissection Bench Calibration Scale Header */}
              <div className="w-full flex items-center justify-between pb-3 mb-6 border-b border-[#3d6b4a]/15 dark:border-[#8fb58f]/15 text-[9px] font-mono uppercase tracking-[0.2em] text-[#3d6b4a] dark:text-[#8fb58f]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#b89552] border border-[#7a602f] shadow-xs" />
                  <span>1mm BOTANICAL COORDINATE GRID · BENCH № 02</span>
                </div>
                <div className="hidden sm:flex items-center gap-3">
                  <span>OBJECTIVE: {magnification.toUpperCase()}</span>
                  <span>OPTIC AXIS: CALIBRATED</span>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {!dexImage && !scanError && (
                  <motion.div
                    key="camera-dropzone"
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="flex flex-col items-center text-center w-full max-w-md relative z-10 px-2 sm:px-6"
                  >
                    {/* Scan Mode Switcher */}
                    <div className="mb-6 flex p-1 bg-bg-secondary border border-border-light rounded-2xl gap-1.5 shadow-xs w-full max-w-sm">
                      <button
                        type="button"
                        onClick={() => setScanMode('consult')}
                        className={`min-h-[44px] flex-1 py-2 px-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                          scanMode === 'consult'
                            ? 'bg-moss-deep text-white shadow-md'
                            : 'text-text-stone hover:text-text-bark hover:bg-bg-tertiary'
                        }`}
                      >
                        🔬 Scan & Consult AI
                      </button>
                      <button
                        type="button"
                        onClick={() => setScanMode('index')}
                        className={`min-h-[44px] flex-1 py-2 px-3 rounded-xl text-[10px] sm:text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                          scanMode === 'index'
                            ? 'bg-moss-deep text-white shadow-md'
                            : 'text-text-stone hover:text-text-bark hover:bg-bg-tertiary'
                        }`}
                      >
                        📚 Scan & Index
                      </button>
                    </div>

                    {/* Brass Reticle Eyepiece Component */}
                    <div className="flex flex-col items-center mb-6">
                      {/* Magnification Objective Markers (10x, 40x, 100x) */}
                      <div className="inline-flex items-center gap-1 p-1 mb-4 rounded-full bg-[#f4ece1]/90 dark:bg-[#232019]/90 border border-[#b89552]/40 shadow-xs">
                        {(['10x', '40x', '100x'] as const).map((mag) => (
                          <button
                            key={mag}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setMagnification(mag);
                            }}
                            // min-h was 40px, four under the touch minimum, on the
                            // one control that changes what the specimen under the
                            // reticle means. The ring is `p-1`, so the 44px sits
                            // inside it without the group growing.
                            className={`px-3 py-2 min-h-[44px] inline-flex items-center justify-center rounded-full text-[10px] font-mono font-black tracking-widest uppercase transition-all ${
                              magnification === mag
                                ? /* Deep brass, not brass: white on #b89552 is 2.8:1.
                                     #8a6c33 is the rim colour already in this optic. */
                                  'bg-[#8a6c33] text-white shadow-xs'
                                : 'text-[#7a602f] dark:text-[#d4af37] hover:bg-[#b89552]/15'
                            }`}
                          >
                            {mag === '100x' ? '100× OIL' : `${mag.toUpperCase()} FIELD`}
                          </button>
                        ))}
                      </div>

                      {/* Authentic Brass Microscope Optic Ring */}
                      <motion.div
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => fileInputRef.current?.click()}
                        className="w-40 h-40 sm:w-48 sm:h-48 rounded-full brass-eyepiece cursor-pointer relative flex items-center justify-center p-2 group transition-shadow duration-300"
                        role="button"
                        tabIndex={0}
                        /* Label in Name (WCAG 2.5.3): the caption rendered inside
                           the eyepiece must appear verbatim in the accessible
                           name, or speech input users can't target it by what
                           they see. */
                        aria-label={`Activate the microscope eyepiece to upload a specimen — current optic: ${
                          magnification === '100x' ? 'OIL 1.25' : magnification === '10x' ? '10× FIELD' : 'APERTURE'
                        }`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            fileInputRef.current?.click();
                          }
                        }}
                      >
                        {/* Concentric Milled Brass Rim Accents */}
                        <div className="absolute inset-1.5 rounded-full border border-[#8a6c33]/40 pointer-events-none" />
                        <div className="absolute inset-2.5 rounded-full border border-dashed border-[#b89552]/40 pointer-events-none" />

                        {/* Etched Millimeter Crosshairs & Concentric Reticle SVG */}
                        {/* Etched Millimeter Crosshairs & Concentric Reticle SVG.
                            aria-hidden: the calibration numerals ("0.0mm", "+2mm")
                            are etched decoration, not content — left exposed they
                            end up in the accessible name computation and break
                            Label-in-Name for the whole eyepiece. */}
                        <svg
                          aria-hidden="true"
                          className="absolute inset-0 w-full h-full pointer-events-none text-[#2d4a33] dark:text-[#8fb58f] opacity-65 group-hover:opacity-90 transition-opacity duration-300"
                          viewBox="0 0 160 160"
                        >
                          <motion.g
                            animate={{
                              scale: magnification === '10x' ? 0.88 : magnification === '100x' ? 1.14 : 1,
                            }}
                            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                            style={{ transformOrigin: '80px 80px' }}
                          >
                            {/* Millimeter Hairlines */}
                            <line x1="12" y1="80" x2="148" y2="80" stroke="currentColor" strokeWidth="0.75" />
                            <line x1="80" y1="12" x2="80" y2="148" stroke="currentColor" strokeWidth="0.75" />

                            {/* Horizontal mm Ticks */}
                            {[24, 38, 52, 66, 94, 108, 122, 136].map((x) => (
                              <line
                                key={`tx-${x}`}
                                x1={x}
                                y1={x === 52 || x === 108 ? "74" : "76"}
                                x2={x}
                                y2={x === 52 || x === 108 ? "86" : "84"}
                                stroke="currentColor"
                                strokeWidth="0.75"
                              />
                            ))}

                            {/* Vertical mm Ticks */}
                            {[24, 38, 52, 66, 94, 108, 122, 136].map((y) => (
                              <line
                                key={`ty-${y}`}
                                x1={y === 52 || y === 108 ? "74" : "76"}
                                y1={y}
                                x2={y === 52 || y === 108 ? "86" : "84"}
                                stroke="currentColor"
                                strokeWidth="0.75"
                              />
                            ))}

                            {/* Concentric Reticle Rings */}
                            <circle cx="80" cy="80" r="30" fill="none" stroke="currentColor" strokeWidth="0.75" strokeDasharray="2 3" />
                            <circle cx="80" cy="80" r="56" fill="none" stroke="currentColor" strokeWidth="0.75" />
                            {magnification === '100x' && (
                              <circle cx="80" cy="80" r="18" fill="none" stroke="#b89552" strokeWidth="1" strokeDasharray="3 2" opacity="0.8" />
                            )}

                            {/* Calibration coordinate marks. The numeral
                                <text> elements they replace were the last
                                thing keeping the eyepiece from passing
                                Label-in-Name — Lighthouse counts rendered
                                text even under aria-hidden, so etched
                                decoration now stays purely graphic: the
                                tick pairs read as the same ruler marks at
                                this size. */}
                            <g strokeWidth="1">
                              <line x1="80" y1="20" x2="80" y2="26" />
                              <line x1="122" y1="74" x2="128" y2="74" />
                              <line x1="32" y1="74" x2="38" y2="74" />
                            </g>
                          </motion.g>
                        </svg>

                        {/* Center Optical Aperture & Camera Trigger */}
                        <div className="relative z-10 w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#f4f7f4]/85 dark:bg-[#18221b]/85 border border-[#3d6b4a]/40 shadow-inner flex flex-col items-center justify-center text-moss group-hover:scale-105 transition-transform duration-300">
                          <Camera size={26} className="text-moss filter drop-shadow-xs group-hover:scale-110 transition-transform duration-300" />
                          <span className="font-mono text-[8px] font-black uppercase tracking-widest text-[#3d6b4a] dark:text-[#8fb58f] mt-1">
                            {magnification === '100x' ? 'OIL 1.25' : magnification === '10x' ? '10× FIELD' : 'APERTURE'}
                          </span>
                        </div>
                      </motion.div>
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-serif font-black text-text-bark tracking-tight">
                      {scanMode === 'consult' ? 'Scan & Consult AI' : 'Scan & Index Specimen'}
                    </h2>
                    <p className="text-xs sm:text-sm text-text-stone mt-2 mb-6 max-w-xs leading-relaxed">
                      {scanMode === 'consult'
                        ? 'Snapshot any plant to analyze health & ask AI questions without adding it to your collection.'
                        : 'Snapshot any plant to analyze health and index it directly into your Sanctuary Registry database.'}
                    </p>

                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-6 sm:px-8 py-3 sm:py-3.5 min-h-[44px] bg-moss-deep hover:bg-moss text-white font-black uppercase tracking-widest text-[10px] sm:text-xs rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95 duration-200 font-mono flex items-center justify-center gap-2"
                    >
                      {scanMode === 'consult' ? '🔬 Open Optical Aperture' : '📚 Load Specimen Slide'}
                    </button>
                  </motion.div>
                )}

              {/* ── SCAN ERROR ── */}
              {scanError && !dexImage && (
                <motion.div
                  key="scan-error"
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97 }}
                  className="flex flex-col items-center gap-4 text-center w-full max-w-sm relative z-10"
                >
                  <div className="flex items-center gap-3 w-full px-4 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-left">
                    <span className="text-lg shrink-0">🌿</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-rose-400">Scan Failed</p>
                      <p className="text-[11px] text-text-stone truncate">Could not analyse plant — please try again</p>
                    </div>
                  </div>
                  <button
                    onClick={() => resetDexScan(true)}
                    className="min-h-[44px] inline-flex items-center justify-center px-6 py-2.5 bg-moss-deep hover:bg-moss text-white font-black uppercase tracking-widest text-xs rounded-xl shadow-md transition-all active:scale-95"
                  >
                    🔄 Try Again
                  </button>
                </motion.div>
              )}

              {dexImage && (
                  <motion.div
                    key="analysis-preview"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    className="w-full relative z-10"
                  >
                    {/* Upload / Analyzing State */}
                    {uploading && (
                      <div className="absolute inset-0 bg-bg-primary/95 backdrop-blur-xs z-50 flex flex-col items-center justify-center p-8 rounded-2xl">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                          className="w-10 h-10 border-2 border-moss border-t-transparent rounded-full mb-5"
                        />
                        <p className="font-serif text-lg font-bold text-text-bark">
                          {SCAN_STAGES.find(s => s.id === scanStage)?.label || 'Working on your scan'}
                        </p>
                        <p className="text-xs text-text-muted mt-1">
                          {scanElapsed}s elapsed · this can take a minute on a first scan
                        </p>

                        {/* The stages that belong to this mode, ticked as they complete. */}
                        <ol className="mt-6 w-full max-w-xs space-y-2">
                          {SCAN_STAGES
                            .filter(s => scanMode === 'index' || (s.id !== 'uploading' && s.id !== 'saving' && s.id !== 'rewarding'))
                            .map(s => {
                              // The overlay only mounts while uploading, so
                              // scanStage is never 'idle' here; the -1 is a
                              // belt-and-braces floor for the comparison.
                              const done = SCAN_STAGE_ORDER.indexOf(s.id) < SCAN_STAGE_ORDER.indexOf(scanStage);
                              const active = s.id === scanStage;
                              return (
                                <li
                                  key={s.id}
                                  className={`flex items-center gap-2.5 text-xs transition-opacity ${
                                    active ? 'text-text-bark font-semibold' : done ? 'text-moss' : 'text-text-muted/50'
                                  }`}
                                >
                                  <span
                                    aria-hidden="true"
                                    className={`w-4 h-4 shrink-0 rounded-full border flex items-center justify-center ${
                                      done ? 'bg-moss border-moss' : active ? 'border-moss border-2' : 'border-current'
                                    }`}
                                  >
                                    {done && <Check size={10} className="text-white" />}
                                  </span>
                                  {s.label}
                                </li>
                              );
                            })}
                        </ol>
                      </div>
                    )}

                    {/* Results Container */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full">
                      {/* Left: Image Preview (Mounted Specimen Slide) */}
                      <div className="lg:col-span-5 relative rounded-2xl overflow-hidden shadow-md border border-[#3d6b4a]/25 dark:border-[#8fb58f]/25 bg-black/5 max-h-[380px] group">
                        <img src={dexImage} alt="Scanned plant" className="w-full h-full object-cover" />
                        {/* Slide Mount Stamp */}
                        <div className="absolute top-3 left-3 px-2.5 py-1 rounded-sm bg-black/65 backdrop-blur-xs text-[8px] font-mono uppercase tracking-widest text-[#d4af37] border border-[#b89552]/40 shadow-xs">
                          OPTIC REF: {magnification.toUpperCase()} · SLIDE № 01
                        </div>
                        <button
                          onClick={() => resetDexScan(false)}
                          className="absolute top-3 right-3 p-2 rounded-full bg-bg-glass text-text-bark shadow-md hover:bg-bg-primary transition-all active:scale-90"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      {/* Right: Botanical Index Card Board */}
                      <div className="lg:col-span-7 flex flex-col justify-between">
                        {dexResult?.report && dexResult.report.kind !== 'plant' ? (
                          <NonPlantReport report={dexResult.report} onScanAgain={() => resetDexScan(true)} />
                        ) : (
                        <>
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-3">
                            <span className="px-2.5 py-1 bg-moss/10 text-moss border border-moss/20 rounded-md text-[10px] font-black uppercase tracking-wider font-mono">
                              {scanMode === 'consult' ? '🔬 Consultation Mode' : '📚 Sanctuary Index Mode'}
                            </span>

                            {isNewSpecies && (
                              <span className="px-2.5 py-1 bg-gold/10 border border-gold text-text-bark rounded-md text-[10px] font-black uppercase tracking-wider shadow-sm animate-pulse font-mono">
                                🌟 New Species Discovered: +{discoveryBonus} Seeds!
                              </span>
                            )}

                            {/* Where the photo came from. Hover for the three checks. */}
                            <ProvenanceBadge provenance={dexResult?.report?.provenance} />
                          </div>

                          <h2 className="text-3xl font-serif font-black text-text-bark">
                            {dexResult?.report?.displayName || 'Identifying...'}
                          </h2>
                          <p className="text-xs font-mono uppercase tracking-widest text-moss mt-0.5 font-bold">
                            {dexResult?.report?.scientificName || ''}
                          </p>

                          {/* Immediate Health Status & Severity */}
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            {(() => {
                              const status = dexResult?.report?.healthStatus || 'Healthy';
                              let badgeColor = 'bg-emerald-100/80 text-emerald-800 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800';
                              if (status === 'Stressed') badgeColor = 'bg-amber-100/80 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800';
                              if (status === 'Diseased' || status === 'Infested') badgeColor = 'bg-rose-100/80 text-rose-800 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800';

                              return (
                                <span className={`px-3 py-1 rounded-full border text-[11px] font-black uppercase tracking-wider font-mono ${badgeColor}`}>
                                  🏥 Health Status: {status}
                                </span>
                              );
                            })()}

                            {/* Severity Level Indicator */}
                            {dexResult?.report?.healthStatus && dexResult.report.healthStatus !== 'Healthy' && (
                              <div className="flex items-center gap-1.5 px-3 py-1 bg-bg-secondary border border-border-light rounded-full">
                                <span className="text-[9px] uppercase font-black tracking-wider text-text-muted font-mono">Severity:</span>
                                <div className="flex gap-1">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <div 
                                      key={i} 
                                      className={`w-2.5 h-2.5 rounded-full border ${i < (dexResult.report?.severity ?? 1) ? 'bg-rose-500 border-rose-600' : 'bg-black/10 dark:bg-white/10 border-transparent'}`} 
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="mt-6 space-y-4">
                            <div className="botanical-index-card p-4 sm:p-5 rounded-2xl relative border border-[#b4a58c]/35 dark:border-[#8fb58f]/20 shadow-xs">
                              <span className="text-[9px] font-black uppercase tracking-wider text-moss block mb-1 font-mono">
                                № 01 · Clinical Diagnosis &amp; Status
                              </span>
                              <p className="text-xs text-text-stone leading-relaxed font-sans font-medium">
                                {dexResult?.report?.diagnosis || 'Waiting for diagnostic payload...'}
                              </p>
                            </div>

                            {/* Interactive Physiological Telemetry & Recovery Roadmap */}
                            {dexResult?.report?.kind === 'plant' && (
                              <PlantTelemetryCard report={dexResult.report}
                                plantId={dexResult?.plantId || (dexResult?.report as any)?.plantId}
                                ambientWeather={dexResult.report.weather ? {
                                  temperatureC: dexResult.report.weather.temp,
                                  humidityPct: dexResult.report.weather.humidity,
                                  lightLevel: inferLightFromWeather(dexResult.report.weather.condition),
                                } : undefined}
                              />
                            )}

                            {/* Seeds and XP Allotment Rewards Claimed Banner */}
                            {scannedRewards && (
                              <div className="p-4 rounded-2xl border border-gold/30 bg-gold/5 dark:bg-gold/10 flex items-center justify-between shadow-xs">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-lg bg-gold/10 border border-gold/20 flex items-center justify-center text-xl shrink-0">
                                    🏆
                                  </div>
                                  <div>
                                    <h4 className="text-[11px] font-black text-text-bark uppercase tracking-wider font-mono">Indexed to Sanctuary</h4>
                                    <p className="text-[10px] text-text-muted">Specimen registered and rewards claimed!</p>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="block text-xs font-mono font-black text-moss">+{scannedRewards.seeds} Seeds</span>
                                  <span className="block text-[10px] font-mono font-bold text-text-stone">+{scannedRewards.xp} XP</span>
                                </div>
                              </div>
                            )}

                            {/* Provenance hold: the fail-safe release. The reward
                                was gated, never the diagnosis; this is the
                                Keeper's one-tap word against the metadata. */}
                            {provenanceHold && (
                              <div className={`p-4 rounded-2xl border ${attested ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/40 bg-amber-500/5'}`}>
                                <h4 className="text-[11px] font-black text-text-bark uppercase tracking-wider font-mono mb-1.5">
                                  {attested ? '✓ Origin confirmed by you' : '⚠ Provenance unverified — reward held'}
                                </h4>
                                <p className="text-xs text-text-stone leading-relaxed">
                                  {provenanceHold.verdict === 'likely_synthetic'
                                    ? 'This photo carries signs it was generated or taken from the web, so its seed reward is being held. If you took it yourself, say so below and the full reward is released — the diagnosis itself was never affected.'
                                    : 'This photo carried no camera metadata (common for screenshots and images sent through messaging apps), so half the seed reward is held. If you took it yourself, say so below.'}
                                </p>
                                {!attested && (
                                  <button
                                    onClick={attestSelfCaptured}
                                    disabled={attesting}
                                    // The provenance release is the one control that
                                    // gets a held seed back, and it sits in the
                                    // deepest state in the Lab -- behind a scan,
                                    // inside the hold card. `py-2.5` on a floored
                                    // 12px label is 44px exactly; the min-height
                                    // is what stops it dropping under when the
                                    // type floor is tuned again.
                                    className="mt-3 w-full min-h-[44px] inline-flex items-center justify-center py-2.5 bg-gold/20 hover:bg-gold/30 text-text-bark border border-gold/40 font-black uppercase tracking-widest text-[11px] rounded-xl transition-all active:scale-95 disabled:opacity-50 font-mono"
                                  >
                                    {attesting ? 'Releasing…' : `🤝 I took this photo myself — release ${provenanceHold.withheldSeeds} seeds`}
                                  </button>
                                )}
                              </div>
                            )}

                            {/* The conversion moment. Shown only to a guest who
                                pressed "Index to Sanctuary": the diagnosis stays
                                on screen, and the account is asked for here —
                                at the instant the result becomes worth keeping. */}
                            {guestHoldout && (
                              <div className="p-4 sm:p-5 rounded-2xl border border-gold/40 bg-gold/10">
                                <h4 className="text-[11px] font-black text-text-bark uppercase tracking-wider font-mono mb-1.5">
                                  🔖 Keep this specimen
                                </h4>
                                <p className="text-xs text-text-stone leading-relaxed">
                                  Sanctuaries are where the streak, the seeds and the collection live. A
                                  free account keeps this diagnosis — 3 scans a day, versus 2 as a guest.
                                </p>
                                <button
                                  onClick={() => { rememberAuthReturn('/lab?tab=dex'); transitionTo('/auth', 'Sign up'); }}
                                  // Same 44px as the panel-level sign-up above, and for the same reason:
                                // `py-2.5` on an 11px label is 36.5px. This one only
                                // renders once the quota panel opens, which is why
                                // auditing the Lab's tab URLs alone does not find it.
                                className="mt-3 w-full min-h-[44px] py-2.5 bg-moss-deep hover:brightness-110 text-white font-black uppercase tracking-widest text-[11px] rounded-xl transition-all active:scale-95 font-mono"
                                >
                                  Create free account — 20 seconds
                                </button>
                                <button
                                  onClick={() => { setGuestHoldout(false); resetDexScan(true); }}
                                  className="min-h-[44px] inline-flex items-center justify-center mt-2 w-full py-2 text-[11px] font-bold uppercase tracking-widest text-text-muted hover:text-text-stone transition-colors font-mono"
                                >
                                  Not now — scan another
                                </button>
                              </div>
                            )}

                            {/* Actionable Care Checklist — the server's one
                                canonical step list (instructions, with the
                                model's care tips as fallback). */}
                            {dexResult?.report?.treatmentSteps && dexResult.report.treatmentSteps.length > 0 && (
                              <div className="botanical-index-card p-4 sm:p-5 rounded-2xl relative border border-[#b4a58c]/35 dark:border-[#8fb58f]/20 shadow-xs">
                                <span className="text-[9px] font-black uppercase tracking-wider text-moss block mb-2 font-mono">
                                  № 04 · Actionable Treatment Instructions
                                </span>
                                <ul className="space-y-1.5">
                                  {dexResult.report.treatmentSteps.map((tip: string, idx: number) => (
                                    <li key={idx} className="text-xs text-text-stone flex items-start gap-2">
                                      <span className="text-moss font-bold select-none mt-0.5 font-mono">✓</span>
                                      <span>{tip}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* ── LOCATION INTELLIGENCE ── */}
                            {dexResult?.report?.location && (
                              <div className="space-y-3">
                                <span className="text-[9px] font-black uppercase tracking-wider text-moss flex items-center gap-1.5 font-mono">
                                  <Compass size={10} /> № 05 · Biogeographic Intelligence
                                </span>

                                {dexResult.report.location.climateCompatibility && (
                                  <div className="botanical-index-card p-4 rounded-xl border border-border-light">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-text-stone block mb-1 font-mono">🌍 Climate Compatibility</span>
                                    <p className="text-xs text-text-bark leading-relaxed">{dexResult.report.location.climateCompatibility}</p>
                                  </div>
                                )}

                                {dexResult.report.location.locationAdvice && (
                                  <div className="botanical-index-card p-4 rounded-xl border border-border-light">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-text-stone block mb-1 font-mono">📍 Regional Growing Advice</span>
                                    <p className="text-xs text-text-bark leading-relaxed">{dexResult.report.location.locationAdvice}</p>
                                  </div>
                                )}

                                {dexResult.report.location.seasonalCare && (
                                  <div className="botanical-index-card p-4 rounded-xl border border-border-light">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-text-stone block mb-1 font-mono">🗓️ Seasonal Care Right Now</span>
                                    <p className="text-xs text-text-bark leading-relaxed">{dexResult.report.location.seasonalCare}</p>
                                  </div>
                                )}

                                {dexResult.report.location.localPestRisks && (
                                  <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/15">
                                    <span className="text-[9px] font-black uppercase tracking-wider text-rose-400 block mb-1 font-mono">⚠️ Local Pest &amp; Disease Risks</span>
                                    <p className="text-xs text-text-bark leading-relaxed">{dexResult.report.location.localPestRisks}</p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-8 flex flex-wrap sm:flex-nowrap gap-3">
                          <button
                            onClick={() => resetDexScan(true)}
                            className="min-h-[44px] inline-flex items-center justify-center flex-1 py-3 bg-moss-deep hover:bg-moss text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all shadow-md active:scale-95"
                          >
                            📷 Scan Another
                          </button>

                          {scannedRewards ? (
                            <button
                              onClick={() => {
                                setActiveTab('sanctuary');
                                setSearchParams({ tab: 'sanctuary' });
                              }}
                              className="min-h-[44px] flex-1 py-3 bg-moss-deep hover:bg-moss text-white font-black uppercase tracking-widest text-xs rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95 font-mono"
                            >
                              🔬 View Specimen in Sanctuary <ArrowRight size={12} />
                            </button>
                          ) : scanMode === 'consult' ? (
                            <button
                              onClick={() => indexSpecimen()}
                              disabled={isUplinkingPhoto}
                              className="min-h-[44px] flex-1 py-3 bg-gold/20 hover:bg-gold/30 text-text-bark border border-gold/40 font-black uppercase tracking-widest text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95 font-mono disabled:opacity-50"
                            >
                              {isUplinkingPhoto ? 'Uplinking photo to vault...' : '📥 Index to Sanctuary'}
                            </button>
                          ) : null}


                          <button
                            onClick={() => {
                              const name = encodeURIComponent(dexResult?.commonName || '');
                              const spec = encodeURIComponent(dexResult?.scientificName || '');
                              const query = encodeURIComponent(`I just ran a scan on my ${dexResult?.report?.displayName || 'plant'}. The health status is ${dexResult?.report?.healthStatus || 'unknown'} with severity ${dexResult?.report?.severity ?? 1}/5. Diagnosis: ${dexResult?.report?.diagnosis || 'N/A'}. What is the best treatment plan?`);
                              transitionTo(`/assistant?plantName=${name}&species=${spec}&query=${query}`, 'AI Assistant');
                            }}
                            className="min-h-[44px] flex-1 py-3 bg-bg-secondary hover:bg-bg-tertiary text-text-bark border border-border-medium font-black uppercase tracking-widest text-xs rounded-xl transition-all shadow-sm flex items-center justify-center gap-1.5 active:scale-95 font-mono"
                          >
                            💬 Consult Assistant
                          </button>
                        </div>
                        </>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {/* ==================== TAB B: MY SANCTUARY ==================== */}
        {activeTab === 'history' && (
          <ScanHistoryPanel
            isAuthed={isAuthed}
            onSignIn={() => { rememberAuthReturn('/lab?tab=history'); transitionTo('/auth', 'Sign In'); }}
            onIndexPlant={async (report) => {
              await GameService.indexScannedPlant(report, null, userId);
              success('Specimen re-indexed from the archive.');
            }}
          />
        )}

        {activeTab === 'sanctuary' && (
          <div className="space-y-8">
            {scanError && (
              <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-700 dark:text-rose-300">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle size={18} className="text-rose-500 shrink-0" />
                  <p className="text-xs font-semibold font-sans">{scanError}</p>
                </div>
                <button
                  onClick={() => setScanError(null)}
                  className="min-h-[44px] inline-flex items-center justify-center text-[10px] font-mono font-black uppercase tracking-wider text-rose-500 hover:text-rose-700 px-2 py-1 rounded transition-colors"
                >
                  Dismiss [×]
                </button>
              </div>
            )}
            
            {/* Grid layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {sanctuaryPlants.map((plant) => {
                const isActive = isPlantActive(plant.id);
                const latest = latestCheckinByPlant.get(plant.id) || null;
                const healthScore = plant.guardianScore || latest?.guardianScore || 90;
                const isMissed = !isActive;
                const moistureLabel = latest?.soilMoisture || (isActive ? 'Moist' : 'Dry');
                const moisturePct = moistureLabel === 'Wet' ? '88%' : moistureLabel === 'Dry' ? '18%' : '58%';

                // Color mapping for health scores
                let healthColor = 'text-moss';
                let healthBg = 'bg-moss/10';
                if (healthScore < 50) {
                  healthColor = 'text-terracotta';
                  healthBg = 'bg-terracotta/10';
                } else if (healthScore < 70) {
                  healthColor = 'text-gold';
                  healthBg = 'bg-gold/10';
                }

                return (
                  <motion.div
                    key={plant.id}
                    layoutId={`plant-card-${plant.id}`}
                    whileHover={{ y: -6 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                    className="specimen-glass-slide rounded-3xl overflow-hidden flex flex-col justify-between min-h-[480px] transition-all duration-300 relative group shadow-sm hover:shadow-lg border border-white/70 dark:border-white/10"
                  >
                    <div>
                      {/* Ivory Adhesive Tape Header */}
                      <div className="ivory-tape-header px-4 py-2 flex items-center justify-between">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#b89552]" />
                          <span className="font-mono text-[9px] uppercase tracking-wider text-[#7a602f] dark:text-[#d4af37] font-bold truncate">
                            SPECIMEN № {plant.id.slice(0, 8).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-mono text-[9px] uppercase tracking-widest text-text-stone font-semibold shrink-0">
                          GLASS MOUNT
                        </span>
                      </div>

                      <div className="p-5">
                        {/* Top Row: Title & Status */}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="min-w-0">
                            <h3 className="text-lg sm:text-xl font-serif font-black text-text-bark truncate leading-tight">
                              {plant.name || 'Monty'}
                            </h3>
                            <p className="text-[10px] text-text-stone font-mono uppercase tracking-wider truncate mt-0.5">
                              {plant.species || 'Genus Specimen'}
                            </p>
                          </div>
                          <div className="shrink-0">
                            {isMissed ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-terracotta/10 text-terracotta text-[9px] font-black uppercase tracking-wider border border-terracotta/20 font-mono">
                                Needs Care
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-moss/10 text-moss text-[9px] font-black uppercase tracking-wider border border-moss/20 font-mono">
                                Thriving
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Specimen Visual Area (Mounted Glass Coverslip Frame) */}
                        <div className="relative rounded-2xl overflow-hidden aspect-[16/10] mb-4 border border-border-light shadow-xs bg-bg-secondary group/img">
                          <img 
                            src={getPlantPhoto(plant.photoUrl, plant.species)} 
                            alt={plant.name}
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = getPlantPhoto(null, plant.species);
                            }}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-60 pointer-events-none" />

                          {/* Brass Specimen Mounting Clips at Corners */}
                          <div className="absolute top-2 left-2 w-2.5 h-1 bg-[#b89552] border border-[#7a602f] rounded-xs shadow-xs" />
                          <div className="absolute top-2 right-2 w-2.5 h-1 bg-[#b89552] border border-[#7a602f] rounded-xs shadow-xs" />
                          
                          {/* Streamlined Stats Overlaid Cleanly */}
                          <div className="absolute bottom-2 right-2 flex gap-1.5 z-10">
                            <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md text-white px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest font-mono">
                              <Flame size={9} className="fill-current text-terracotta" /> {profile?.currentStreak || 0}D
                            </div>
                            <div className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest font-mono bg-black/60 backdrop-blur-md text-white">
                              Score: {healthScore}
                            </div>
                          </div>
                        </div>

                        {/* Interactive Telemetries in Botanical Index Card */}
                        <div className="space-y-3 mb-5 botanical-index-card p-3.5 sm:p-4 rounded-2xl border border-border-light">
                          {/* Litmus Paper Chemical Moisture Indicator */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-text-stone font-medium flex items-center gap-1.5">
                                <Droplets size={12} className="text-moss" />
                                <span className="font-mono text-[10px] uppercase tracking-wider">Litmus Indicator</span>
                              </span>
                              <div className="flex items-center gap-1.5">
                                <span 
                                  className="w-2.5 h-2.5 rounded-full shadow-xs shrink-0" 
                                  style={{
                                    backgroundColor: moistureLabel === 'Dry' ? '#d97736' : moistureLabel === 'Wet' ? '#1b4332' : '#5a7d5a'
                                  }}
                                />
                                <span className={`font-mono font-bold text-xs ${moistureLabel === 'Dry' ? 'text-terracotta' : 'text-moss'}`}>
                                  {moistureLabel} ({moisturePct})
                                </span>
                              </div>
                            </div>

                            {/* Litmus Paper Reagent Strip */}
                            <div className="relative pt-1 pb-1">
                              <div className="litmus-paper-track w-full h-2 rounded-full relative overflow-hidden">
                                <motion.div 
                                  initial={{ left: '0%' }}
                                  animate={{ left: moisturePct }}
                                  transition={{ duration: 0.8, ease: 'easeOut' }}
                                  className="absolute top-0 bottom-0 w-2 bg-white border border-black/50 shadow-xs rounded-full -ml-1 flex items-center justify-center"
                                >
                                  <span className="w-1 h-1 rounded-full bg-[#3d6b4a]" />
                                </motion.div>
                              </div>
                              {/* Calibration Graduation Marks */}
                              <div className="flex justify-between items-center text-[8px] font-mono text-text-stone tracking-wider mt-1 px-0.5">
                                <span>01 DRY (AMBER)</span>
                                <span>02 OPTIMAL</span>
                                <span>03 MOIST (MOSS)</span>
                              </div>
                            </div>
                          </div>

                          {/* Environment telemetry */}
                          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border-light text-[10px] text-text-stone">
                            <div className="flex items-center gap-1">
                              <Sun size={11} className="text-gold" />
                              <span>Light: <strong className="text-text-bark font-bold">{latest?.lightLevel || 'Indirect'}</strong></span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Thermometer size={11} className="text-terracotta" />
                              <span>Temp: <strong className="text-text-bark font-bold">{latest?.weatherTemp != null ? `${latest.weatherTemp}°C` : '—'}</strong></span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Panel */}
                    <div className="p-5 pt-0 space-y-2">
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        disabled={isUpdatingPhoto}
                        onClick={(e) => handleUpdatePhoto(plant.id, e)}
                        className={`w-full py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-200 border flex items-center justify-center gap-2 font-mono ${
                          isUpdatingPhoto && updatingPlantId === plant.id
                            ? 'bg-moss/20 border-moss/40 text-moss cursor-wait'
                            : isMissed
                            ? 'bg-terracotta-deep border-terracotta-deep hover:bg-terracotta text-white shadow-md'
                            : 'bg-bg-secondary border-border-medium hover:bg-bg-tertiary text-text-stone hover:text-text-bark font-bold'
                        }`}
                      >
                        <RefreshCw size={11} className={isUpdatingPhoto && updatingPlantId === plant.id ? 'animate-spin' : ''} /> 
                        {isUpdatingPhoto && updatingPlantId === plant.id
                          ? 'Uplinking photo to vault...'
                          : isMissed

                          ? 'Revive Streak'
                          : 'Update Photo (+15 Seeds)'}
                      </motion.button>

                      <button
                        onClick={() => transitionTo(`/plant/${plant.id}`, plant.name)}
                        className="min-h-[44px] w-full py-2 text-[9px] font-black uppercase tracking-widest text-moss hover:text-moss-dark flex items-center justify-center gap-1 transition-colors font-mono"
                      >
                        View Specimen Dossier <ArrowRight size={11} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}

              {/* Add New Genus Slot Card */}
              <motion.div
                whileHover={{ scale: 0.98 }}
                onClick={handleAddNewSlot}
                className="specimen-glass-slide rounded-3xl border-2 border-dashed border-moss/30 hover:border-moss/60 cursor-pointer p-6 flex flex-col items-center justify-center min-h-[480px] text-moss/70 hover:text-moss transition-all shadow-xs"
              >
                <div className="ivory-tape-header px-4 py-1.5 rounded-full border border-[#e5dcba] dark:border-[#8fb58f]/25 text-[9px] font-mono uppercase tracking-widest text-[#7a602f] dark:text-[#d4af37] font-bold mb-6">
                  UNREGISTERED SLIDE SLOT
                </div>
                <div className="w-14 h-14 rounded-full bg-moss/10 border border-moss/20 flex items-center justify-center mb-4 text-moss">
                  <Plus size={24} />
                </div>
                <p className="font-serif font-black text-xl text-text-bark">Add New Genus Slot</p>
                <p className="text-xs text-center px-4 mt-2 text-text-stone leading-relaxed font-medium max-w-xs">
                  Index a new species in the wild Plant Database to unlock a permanent glass slide mount in your Garden Sanctuary!
                </p>
              </motion.div>

            </div>
          </div>
        )}

      </div>

      {/* ==================== THE GAMIFICATION LEDGER DRAWER ==================== */}
      <AnimatePresence>
        {showLedger && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLedger(false)}
              className="fixed inset-0 bg-black/80 z-50"
            />

            {/* Sliding Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: '0%' }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', ease: 'easeOut', duration: 0.3 }}
              style={{ width: '448px', maxWidth: '100vw' }}
              className="fixed top-0 bottom-0 right-0 bg-bg-primary border-l border-border-medium shadow-2xl z-50 p-8 flex flex-col justify-between overflow-y-auto"
            >
              <div>
                <div className="flex items-center justify-between border-b border-border-light pb-4 mb-6">
                  <h2 className="text-2xl font-serif font-black text-text-bark">Rewards & Token System</h2>
                  <button
                    onClick={() => setShowLedger(false)}
                    aria-label="Close rewards system ledger"
                    className="p-2 rounded-full hover:bg-bg-secondary text-text-bark transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--moss)] focus-visible:ring-offset-2"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Accordion List */}
                <div className="space-y-3">
                  {[
                    { id: 1, title: '1. Daily Login: +10 Seeds', content: 'Open the app every day to collect your daily allowance. Multipliers stack based on streaks!' },
                    { id: 2, title: '2. 7-Day Streak: +30 Seeds (Bypasses Cap)', content: 'Maintain a 7-day streak to get 30 bonus seeds. This milestone bonus does not count toward your daily 150-seed cap.' },
                    { id: 3, title: '3. Base Diagnosis: +20 Seeds', content: 'Upload a leaf photo in the Garden-Dex to diagnose it. The AI verifies that it is a real, living plant.' },
                    { id: 4, title: '4. Health Bonus (Thriving 90-100): +20 Seeds', content: 'Receive an extra 20 seeds when scanning a plant that registers as thriving (90-100 health).' },
                    { id: 5, title: '5. Health Bonus (Critical <50): +2 Seeds', content: 'Earn a small compassion bonus of 2 seeds for checking on a critical, suffering plant. Every check-in counts.' },
                    { id: 6, title: '6. Discovery (Common): +8 Seeds | Rare: +60 Seeds | Legendary: +400 Seeds', content: 'Index a species for the first time to earn a massive discovery reward. Legendary plants grant 400 seeds!' },
                    { id: 7, title: '7. Missed Day: Streak Freezes', content: 'Missing a day freezes your streak. Uploading a photo will unfreeze and revive your multiplier.' },
                  ].map((item, idx) => {
                    const isOpen = activeAccordion === idx;
                    return (
                      <div key={item.id} className="border border-border-light rounded-2xl overflow-hidden bg-bg-secondary">
                        <button
                          onClick={() => setActiveAccordion(isOpen ? null : idx)}
                          className="min-h-[44px] w-full px-5 py-4 flex items-center justify-between text-left font-serif font-bold text-text-bark text-sm hover:bg-bg-tertiary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--moss)] focus-visible:ring-inset"
                        >
                          <span>{item.title}</span>
                          <motion.div
                            animate={{ rotate: isOpen ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                            className="text-moss"
                          >
                            <ChevronDown size={16} />
                          </motion.div>
                        </button>
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0 }}
                              animate={{ height: 'auto' }}
                              exit={{ height: 0 }}
                              className="overflow-hidden"
                            >
                              <p className="px-5 pb-5 pt-1 text-xs text-text-stone leading-relaxed font-sans font-medium">
                                {item.content}
                              </p>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-8 border-t border-border-light pt-6 text-center text-xs text-text-muted font-serif italic">
                BotanicalGuardian Economy System v2.0
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {streakPopupData && (
        <StreakPopup
          isOpen={true}
          streak={streakPopupData.streak}
          seedsEarned={streakPopupData.seeds}
          onClose={() => setStreakPopupData(null)}
        />
      )}

      {/* Hidden file inputs for camera snapshots, uploads, and photo updates */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleDexUpload}
        accept="image/*"
        className="hidden"
      />
      <input
        type="file"
        ref={updatePhotoInputRef}
        onChange={handleUpdateFileChange}
        accept="image/*"
        className="hidden"
      />
    </PageWrapper>
  );
}
