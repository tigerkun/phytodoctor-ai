'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { GameService } from '../services/gameService';
import PageWrapper from '../components/home/PageWrapper';
import Navigation from '../components/Navigation';
import { 
  Thermometer, Droplets, Sun, Wind, ShieldAlert, Sparkles, 
  Dna, HelpCircle, RefreshCw, Zap, Snowflake, CloudRain,
  Sprout, Award, Info, Settings, Activity, Play, Bot, AlertTriangle, CheckCircle
} from 'lucide-react';
import { triggerHaptic, playAudio } from '@/utils/hapticAudio';
import { chatWithGardener } from '../services/chatService';
import { useToast } from '../components/Toast';

// Mock base species templates for simulation if database is empty
const TEMPLATE_SPECIES = [
  { id: 't1', name: 'Monty', species: 'Monstera Deliciosa', baseTemp: 22, baseHumidity: 65, baseLight: 12, baseWater: 60, icon: '🌿' },
  { id: 't2', name: 'Fidget', species: 'Ficus Lyrata', baseTemp: 24, baseHumidity: 50, baseLight: 14, baseWater: 50, icon: '🌳' },
  { id: 't3', name: 'Viper Cactus', species: 'Cereus Repandus', baseTemp: 32, baseHumidity: 20, baseLight: 16, baseWater: 15, icon: '🌵' },
  { id: 't4', name: 'Rose Quartz', species: 'Rosa Rubiginosa', baseTemp: 20, baseHumidity: 55, baseLight: 12, baseWater: 50, icon: '🌹' },
  { id: 't5', name: 'Staghorn Fern', species: 'Platycerium Bifurcatum', baseTemp: 18, baseHumidity: 80, baseLight: 6, baseWater: 80, icon: '🌱' }
];

export default function VaultPage() {
  const { info, error, success, toast } = useToast();
  const profile = useLiveQuery(() => GameService.getProfile());
  const dbPlants = useLiveQuery(() => db.plants.toArray()) || [];
  const seeds = profile?.seeds ?? 0;

  // Combine DB plants and default templates for dropdown selection
  const selectOptions = useMemo(() => {
    const plants = dbPlants.map(p => ({
      id: p.id,
      name: p.name,
      species: p.species,
      baseTemp: 22,
      baseHumidity: 60,
      baseLight: 12,
      baseWater: 50,
      icon: '🌿'
    }));
    return [...plants, ...TEMPLATE_SPECIES];
  }, [dbPlants]);

  // Selected specimen for simulation
  const [selectedSpecimenId, setSelectedSpecimenId] = useState<string>(selectOptions[0]?.id || 't1');
  const activeSpecimen = useMemo(() => {
    return selectOptions.find(o => o.id === selectedSpecimenId) || selectOptions[0] || TEMPLATE_SPECIES[0];
  }, [selectedSpecimenId, selectOptions]);

  // --- Environment Variables (Sliders) ---
  const [temperature, setTemperature] = useState(22.0); // -15°C to 50°C
  const [humidity, setHumidity] = useState(60); // 0% to 100% RH
  const [photoperiod, setPhotoperiod] = useState(12); // 0 to 24 hours of light
  const [soilMoisture, setSoilMoisture] = useState(50); // 0% to 100%
  const [co2Level, setCo2Level] = useState(400); // 300 to 2000 ppm
  const [soilPh, setSoilPh] = useState(6.5); // 3.0 to 10.0
  const [uvIntensity, setUvIntensity] = useState(2); // 0 to 5 index
  const [cryoStasis, setCryoStasis] = useState(false); // Freezes dynamics

  // Custom Notes & Gemini AI Simulation State
  const [customNotes, setCustomNotes] = useState('');
  const [aiResponse, setAiResponse] = useState<any>(null);
  const [isLoadingAi, setIsLoadingAi] = useState(false);
  const [isAiSyncing, setIsAiSyncing] = useState(false);
  const [isSimulatingTest, setIsSimulatingTest] = useState(false);
  const [simMessage, setSimMessage] = useState('');

  // Reset simulator to species defaults
  const handleResetToDefaults = () => {
    triggerHaptic('light');
    if (!activeSpecimen) return;
    setTemperature(activeSpecimen.baseTemp);
    setHumidity(activeSpecimen.baseHumidity);
    setPhotoperiod(activeSpecimen.baseLight);
    setSoilMoisture(activeSpecimen.baseWater);
    setCo2Level(400);
    setSoilPh(6.5);
    setUvIntensity(2);
    setCryoStasis(false);
    setAiResponse(null);
  };

  // Determine plant category based on species name for specific medical rule thresholds
  const plantCategory = useMemo(() => {
    const spec = activeSpecimen?.species?.toLowerCase() || '';
    if (spec.includes('cactus') || spec.includes('succulent') || spec.includes('cereus') || activeSpecimen?.id === 't3') {
      return 'cactus';
    }
    if (spec.includes('fern') || spec.includes('platycerium') || activeSpecimen?.id === 't5') {
      return 'fern';
    }
    if (spec.includes('rose') || spec.includes('rosa') || activeSpecimen?.id === 't4') {
      return 'rose';
    }
    if (spec.includes('ficus') || spec.includes('lyrata') || activeSpecimen?.id === 't2') {
      return 'ficus';
    }
    return 'tropical';
  }, [activeSpecimen]);

  // --- Real-Time Simulation Calculation Engine (Clinical Botanical Rules) ---
  const simulationResults = useMemo(() => {
    if (cryoStasis) {
      return {
        survivalChance: 100,
        turgorStatus: 'Cryo-Stasis metabolic suspension',
        turgorDescription: 'Freezing temperatures and stasis fields have suspended cell division and transpiration. Osmotic pressure is locked.',
        photothermalTolerance: 'Cryogenic Protection',
        photothermalDescription: 'Cell walls are protected from cellular crystallization by laboratory vitrification chemicals.',
        nutrientAvailability: 'Metabolically Inactive',
        nutrientDescription: 'Ion transport across root membranes has ceased.',
        clinicalDiagnosis: 'Cryogenic vitrification active. The specimen will not grow, decay, or die in this state.',
        condition: 'Cryo-Stasis' as const,
        growthRate: 0,
        photosynthesisRate: 0
      };
    }

    // Initialize metrics (0 to 100)
    let turgorVal = 100; // Leaf water turgor
    let photothermalVal = 100; // Solar/heat resilience
    let pHVal = 100; // pH compatibility
    let survivalChance = 100;

    let turgorStatus = 'Healthy Turgidity';
    let turgorDescription = 'Perfect water pressure balance inside cell vacuoles.';
    
    let photothermalStatus = 'Optimal Photoperiod';
    let photothermalDescription = 'Photothermal conditions are ideal for sugar synthesis.';

    let nutrientStatus = 'Uninhibited Ion Absorption';
    let nutrientDescription = 'Soil pH allows absolute availability of nitrogen, phosphorus, and trace minerals.';

    let clinicalDiagnosis = 'The plant is thriving. Water, light, and temperature conditions are well within survival thresholds.';
    let condition: 'Optimal' | 'Stressed' | 'Wilted' | 'Drowning' | 'Acid Burned' | 'Extreme Shock' = 'Optimal';

    // --- 1. CACTUS MEDICAL CLINICAL PATHOLOGY ---
    if (plantCategory === 'cactus') {
      // Overwatering (Cactus cannot handle damp soil)
      if (soilMoisture > 30) {
        const excess = soilMoisture - 30;
        turgorVal -= excess * 2.5;
        survivalChance -= excess * 2.8;
        turgorStatus = 'Osmotic Lysis (Root Drowning)';
        turgorDescription = 'Excess water has oversaturated the root cortex. Root cells are bursting from osmotic pressure, inducing rotting.';
      }
      // Low Temperature (Cactus cannot handle freezing temperatures)
      if (temperature < 5) {
        const chill = 5 - temperature;
        photothermalVal -= chill * 8;
        survivalChance -= chill * 9;
        photothermalStatus = 'Cryogenic Cell Lysis (Frost Bite)';
        photothermalDescription = 'Low temperatures have caused water crystals to form inside cellular compartments, tearing tissue walls apart.';
      }
      // High humidity (Cactus needs arid conditions)
      if (humidity > 60) {
        survivalChance -= (humidity - 60) * 0.8;
      }
    }

    // --- 2. FERN MEDICAL CLINICAL PATHOLOGY ---
    else if (plantCategory === 'fern') {
      // Dehydration (Fern needs constant moisture)
      if (soilMoisture < 45) {
        const dry = 45 - soilMoisture;
        turgorVal -= dry * 2.8;
        survivalChance -= dry * 3.0;
        turgorStatus = 'Severe Plasmolysis (Desiccation)';
        turgorDescription = 'Cell membranes are pulling away from cell walls as vacuoles empty. Fronds are wilting rapidly.';
      }
      // Low Humidity (Fern will shrivel in dry air)
      if (humidity < 50) {
        const dryAir = 50 - humidity;
        turgorVal -= dryAir * 2;
        survivalChance -= dryAir * 2;
        turgorStatus = 'Transpirational Desiccation';
        turgorDescription = 'Stomata are releasing moisture faster than roots can absorb, drying out leaflets.';
      }
      // High Sunlight/UV (Fern leaves burn easily)
      if (uvIntensity > 2) {
        const burns = uvIntensity - 2;
        photothermalVal -= burns * 25;
        survivalChance -= burns * 20;
        photothermalStatus = 'Photoinhibition & Chloroplast Bleaching';
        photothermalDescription = 'Excessive UV radiation is destroying chloroplast arrays, leading to chlorophyll collapse.';
      }
    }

    // --- 3. ROSE MEDICAL CLINICAL PATHOLOGY ---
    else if (plantCategory === 'rose') {
      // Heat Stress
      if (temperature > 32) {
        const heat = temperature - 32;
        photothermalVal -= heat * 6;
        survivalChance -= heat * 7;
        photothermalStatus = 'Thermal Necrosis';
        photothermalDescription = 'Excessive ambient heat is denaturing vital plant enzymes and cooking leaf margins.';
      }
      // Overwatering (Rose suffers from root rot and fungus)
      if (soilMoisture > 80) {
        turgorVal -= (soilMoisture - 80) * 2;
        survivalChance -= (soilMoisture - 80) * 2.2;
        turgorStatus = 'Root Anoxia (Waterlogging)';
        turgorDescription = 'Soil lacks oxygen, causing root asphyxiation and encouraging pathogenic mold like blackspot.';
      }
      // Acidic Soil pH (Rose requires neutral 6.0-7.0 pH)
      if (soilPh < 5.5 || soilPh > 8.0) {
        const diff = Math.max(0, 5.5 - soilPh) || Math.max(0, soilPh - 8.0);
        pHVal -= diff * 35;
        survivalChance -= diff * 20;
        nutrientStatus = 'pH-Induced Nutrient Lockout';
        nutrientDescription = `Extreme soil pH (${soilPh}) binds essential minerals like iron and manganese, preventing root absorption.`;
      }
    }

    // --- 4. FICUS LYRATA PATHOLOGY ---
    else if (plantCategory === 'ficus') {
      // Leaf Abscission from low humidity
      if (humidity < 40) {
        turgorVal -= (40 - humidity) * 2.5;
        survivalChance -= (40 - humidity) * 2.8;
        turgorStatus = 'Leaf Abscission Trigger';
        turgorDescription = 'Dry air triggers a shock response causing the plant to seal off and drop its leaves to conserve moisture.';
      }
      // Cold stress
      if (temperature < 12) {
        photothermalVal -= (12 - temperature) * 7;
        survivalChance -= (12 - temperature) * 8;
        photothermalStatus = 'Chilling Injury';
        photothermalDescription = 'Cold shock halts enzymatic systems, causing black necrosis spots across foliage.';
      }
    }

    // --- 5. TROPICAL (MONSTERA / DEFAULT) PATHOLOGY ---
    else {
      if (temperature > 36) {
        photothermalVal -= (temperature - 36) * 5;
        survivalChance -= (temperature - 36) * 6;
        photothermalStatus = 'Thermal Desiccation';
        photothermalDescription = 'High temperatures are evaporating moisture faster than vascular tubes can pump.';
      }
      if (soilMoisture < 25) {
        turgorVal -= (25 - soilMoisture) * 3;
        survivalChance -= (25 - soilMoisture) * 3.2;
        turgorStatus = 'Plasmolysis (Leaf Droop)';
        turgorDescription = 'Low vascular pressure is causing the monstera stems to bend and droop.';
      }
      if (uvIntensity > 3) {
        photothermalVal -= (uvIntensity - 3) * 25;
        survivalChance -= (uvIntensity - 3) * 15;
        photothermalStatus = 'Foliage Bleaching';
        photothermalDescription = 'Direct high intensity UV rays are burning the white/variegated portions of leaves.';
      }
    }

    // Global factors
    // pH factors
    if (soilPh < 4.0 || soilPh > 9.5) {
      const phDiff = Math.abs(soilPh - 6.5);
      pHVal -= phDiff * 15;
      survivalChance -= phDiff * 10;
      nutrientStatus = 'Acidic/Alkaline Osmotic Shock';
      nutrientDescription = 'pH levels are dissolving delicate root hairs, making water absorption impossible.';
    }

    // Clamp values
    turgorVal = Math.max(0, Math.min(100, Math.round(turgorVal)));
    photothermalVal = Math.max(0, Math.min(100, Math.round(photothermalVal)));
    pHVal = Math.max(0, Math.min(100, Math.round(pHVal)));
    survivalChance = Math.max(0, Math.min(100, Math.round(survivalChance)));

    // Final condition status updates
    if (survivalChance <= 0) {
      condition = 'Extreme Shock';
      clinicalDiagnosis = 'Lethal parameters exceeded. The plant is dead. Rebalance hydration or temperature to prevent complete cell death.';
    } else if (survivalChance < 30) {
      condition = 'Extreme Shock';
      clinicalDiagnosis = 'Critical state. Cellular collapse is imminent. Immediate water correction or thermal rebalancing required.';
    } else if (turgorVal < 50) {
      condition = 'Wilted';
      clinicalDiagnosis = 'Severely dehydrated. Stomata have sealed shut to prevent transpiration, but tissue will soon dry and die.';
    } else if (turgorStatus.includes('Lysis') || turgorStatus.includes('Drowning')) {
      condition = 'Drowning';
      clinicalDiagnosis = 'Roots are suffocating in anaerobic, waterlogged soil. Rot is setting in.';
    } else if (pHVal < 60) {
      condition = 'Acid Burned';
      clinicalDiagnosis = 'Soil pH levels have created chemical lockout. The plant will suffer iron-deficiency chlorosis and pale leaves.';
    } else if (survivalChance < 75) {
      condition = 'Stressed';
      clinicalDiagnosis = 'Metabolic strain. Suboptimal conditions are restricting energy output and lowering survival probability.';
    }

    // Simple computed factors for visuals
    const photosynthesisRate = Math.round(Math.max(0, (photothermalVal * 0.6 + turgorVal * 0.4) * (photoperiod / 14)));
    const growthRate = Math.round(photosynthesisRate * (co2Level / 400));

    return {
      survivalChance,
      turgorStatus,
      turgorDescription,
      photothermalTolerance: photothermalStatus,
      photothermalDescription,
      nutrientAvailability: nutrientStatus,
      nutrientDescription,
      clinicalDiagnosis,
      condition,
      growthRate,
      photosynthesisRate
    };
  }, [temperature, humidity, photoperiod, soilMoisture, co2Level, soilPh, uvIntensity, cryoStasis, plantCategory]);

  // Core AI simulation query function
  const queryGeminiSimulation = async (
    temp: number,
    hum: number,
    moist: number,
    ph: number,
    uv: number,
    co2: number,
    light: number,
    notes: string
  ) => {
    setIsAiSyncing(true);
    try {
      const prompt = `You are a clinical botanical diagnostic system. Return ONLY a valid JSON block containing the following health metrics for a plant of species "${activeSpecimen.species}".
      The current sandbox settings are:
      - Temperature: ${temp}°C
      - Humidity: ${hum}%
      - Soil Hydration (Water): ${moist}%
      - Soil pH: ${ph}
      - UV Light Level: ${uv}/5
      - Carbon Dioxide: ${co2}ppm
      - Photoperiod (Daylight): ${light}h
      ${notes.trim() ? `- Custom Conditions & Infection Notes: ${notes}` : ''}
      
      JSON format (No markdown backticks, no comments, just raw JSON):
      {
        "survivalChance": 0-100,
        "turgorStatus": "Healthy Turgidity" or "Plasmolysis" or "Osmotic Lysis",
        "turgorDescription": "Short text explanation",
        "photothermalTolerance": "Optimal" or "Thermal Necrosis" or "Etiolation" or "Photoinhibition",
        "photothermalDescription": "Short text explanation",
        "nutrientAvailability": "Optimal" or "pH-Induced Lockout",
        "nutrientDescription": "Short text explanation",
        "clinicalDiagnosis": "A detailed medical botanical diagnosis of how it will behave and whether it will survive."
      }`;

      const messages = [{ role: 'user' as const, content: prompt }];
      const response = await chatWithGardener(messages);
      
      // Attempt clean json parse
      const cleaned = response.replace(/```json|```/gi, '').trim();
      const parsed = JSON.parse(cleaned);
      
      setAiResponse(parsed);
      triggerHaptic('heavy');
    } catch (err) {
      console.warn("Gemini Auto-Sync failed (using local fallback):", err);
      // Fallback response simulation
      setAiResponse({
        survivalChance: Math.max(10, Math.round(simulationResults.survivalChance * 0.9)),
        turgorStatus: simulationResults.turgorStatus,
        turgorDescription: simulationResults.turgorDescription,
        photothermalTolerance: simulationResults.photothermalTolerance,
        photothermalDescription: simulationResults.photothermalDescription,
        nutrientAvailability: simulationResults.nutrientAvailability,
        nutrientDescription: simulationResults.nutrientDescription,
        clinicalDiagnosis: simulationResults.clinicalDiagnosis
      });
    } finally {
      setIsAiSyncing(false);
    }
  };

  // Debounced Auto-Query Effect when variables change
  useEffect(() => {
    if (cryoStasis) return;

    const timer = setTimeout(() => {
      queryGeminiSimulation(temperature, humidity, soilMoisture, soilPh, uvIntensity, co2Level, photoperiod, customNotes);
    }, 1200); // 1.2s debounce to allow smooth slider adjustments

    return () => clearTimeout(timer);
  }, [temperature, humidity, soilMoisture, soilPh, uvIntensity, co2Level, photoperiod, selectedSpecimenId, cryoStasis]);

  // Manual Trigger
  const handleQueryGemini = async () => {
    triggerHaptic('medium');
    await queryGeminiSimulation(temperature, humidity, soilMoisture, soilPh, uvIntensity, co2Level, photoperiod, customNotes);
  };

  const handleTriggerStressTest = () => {
    setIsSimulatingTest(true);
    triggerHaptic('medium');
    playAudio('success');

    const stresses = [];
    if (temperature < 0) stresses.push("Sub-zero Frost Simulation");
    if (temperature > 38) stresses.push("Solar Flare Heat");
    if (soilPh < 4.5 || soilPh > 8.5) stresses.push("Soil pH Shock");
    if (soilMoisture > 90) stresses.push("Flooding Stress");
    if (uvIntensity >= 4) stresses.push("Intense UV Irradiation");
    if (co2Level > 1500) stresses.push("Hypercapnia Hyper-Growth");

    const activeStress = stresses.length > 0 ? stresses.join(" & ") : "Standard Ambient Run";
    setSimMessage(`Deploying ${activeStress}...`);

    setTimeout(() => {
      setIsSimulatingTest(false);
      triggerHaptic('heavy');
      const diagnostics = aiResponse || simulationResults;
      toast({
        message: `Simulation Run Complete\nCondition: ${diagnostics.condition || 'Tested'}\nSurvival Index: ${diagnostics.survivalChance}%\nDiagnosis: ${diagnostics.clinicalDiagnosis}`,
        type: "success"
      });
    }, 2000);
  };

  // Claim/Save adaptive genetic seed blueprint
  const [unlockedBlueprint, setUnlockedBlueprint] = useState(false);

  const handleExtractBlueprint = async () => {
    if (seeds < 1000) {
      error("Extraction costs 1,000 Seeds.");
      return;
    }
    
    triggerHaptic('heavy');
    playAudio('success');
    
    // Add seed cost deduct
    await GameService.addSeeds(-1000, 'spend', `Extracted ${activeSpecimen.species} Adaptive Blueprint`);
    setUnlockedBlueprint(true);
  };

  // Interactive dynamic leaf color calculations
  const leafColor = useMemo(() => {
    const activeData = aiResponse || simulationResults;
    if (cryoStasis) return '#7dd3fc'; // Frozen Ice Blue
    if (activeData.survivalChance <= 0) return '#b45309'; // Scorched Brown / Dead
    if (activeData.survivalChance < 40) return '#ea580c'; // Highly Stressed Orange
    if (activeData.turgorStatus.includes('Plasmolysis') || activeData.turgorStatus.includes('Wilted')) return '#854d0e'; // Dry Olive
    if (activeData.turgorStatus.includes('Lysis') || activeData.turgorStatus.includes('Drowning')) return '#1e3a8a'; // Drowning Blue-Green
    if (activeData.nutrientAvailability.includes('Lockout')) return '#ca8a04'; // Acid Yellow
    return '#10b981'; // Lush Healthy Green
  }, [simulationResults, aiResponse, cryoStasis]);

  const activeData = aiResponse || simulationResults;

  return (
    <PageWrapper className="min-h-screen bg-[var(--bg-cream)] text-[var(--text-bark)] relative">
      <main className="relative z-10 max-w-7xl mx-auto px-6 pt-12 pb-24 space-y-12">
        {/* Header Dashboard */}
        <section className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-border-medium pb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider bg-moss/10 text-moss border border-moss/20 rounded-md">
                Laboratory Sandbox
              </span>
              <span className="px-2.5 py-1 text-[9px] font-black uppercase tracking-wider bg-gold/10 text-gold border border-gold/20 rounded-md">
                Svalbard-II Simulator
              </span>
            </div>
            <h1 className="font-serif text-4xl md:text-5xl font-black text-text-bark tracking-tight">
              Clinical Botanical Sandbox
            </h1>
            <p className="text-text-stone text-sm max-w-2xl mt-1">
              Select a plant species, alter natural/stress sliders, or input custom disease notes. The simulation calculates clinical survival outcomes.
            </p>
          </div>

          {/* Seeds Wallet Status */}
          <div className="p-4 rounded-2xl bg-bg-secondary border border-border-medium flex items-center gap-4 shrink-0 shadow-sm">
            <div>
              <p className="text-[10px] font-black uppercase tracking-wider text-text-stone">Sim Wallet</p>
              <p className="text-2xl font-mono font-black text-gold mt-0.5">{seeds.toLocaleString()} Seeds</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-gold/10 border border-gold/20 flex items-center justify-center text-xl">
              🌱
            </div>
          </div>
        </section>

        {/* Dynamic Chamber Simulator Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: Environment Control Sliders (7 Cols) */}
          <div className="lg:col-span-7 bg-bg-secondary border border-border-medium rounded-3xl p-6 md:p-8 space-y-8 shadow-xs">
            <div className="flex justify-between items-center pb-4 border-b border-border-light">
              <div className="flex items-center gap-2">
                <Settings className="text-moss" size={20} />
                <h3 className="font-serif text-lg font-black text-text-bark">Atmospheric Matrix</h3>
              </div>
              <button 
                onClick={handleResetToDefaults}
                className="px-3 py-1.5 text-xs font-black bg-bg-primary hover:bg-bg-tertiary border border-border-medium rounded-xl flex items-center gap-1.5 transition-all text-text-stone hover:text-text-bark"
              >
                <RefreshCw size={12} /> Reset defaults
              </button>
            </div>

            {/* Specimen Picker Dropdown */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-text-stone">Specimen Species & Threshold Model</label>
              <select
                value={selectedSpecimenId}
                onChange={(e) => {
                  triggerHaptic('light');
                  setSelectedSpecimenId(e.target.value);
                  setAiResponse(null); // Clear previous AI analysis to recalculate for new species
                }}
                className="w-full p-3.5 bg-bg-primary border border-border-medium rounded-xl text-sm font-bold text-text-bark focus:ring-2 focus:ring-moss focus:outline-none"
              >
                {selectOptions.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.icon} {option.name} ({option.species})
                  </option>
                ))}
              </select>
            </div>

            {/* Natural Variables Slider Group */}
            <div className="space-y-6">
              <h4 className="text-[11px] font-black uppercase tracking-widest text-moss border-b border-moss/10 pb-1 flex items-center gap-1.5">
                <Sun size={14} /> Natural Parameters
              </h4>

              {/* Temperature */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold flex items-center gap-1.5 text-text-bark"><Thermometer size={14} className="text-red-500" /> Temperature</span>
                  <span className="font-mono font-bold text-text-stone">{temperature.toFixed(1)} °C</span>
                </div>
                <input 
                  type="range" 
                  min="-15" 
                  max="50" 
                  step="0.5"
                  value={temperature} 
                  onChange={(e) => {
                    setTemperature(parseFloat(e.target.value));
                    if (aiResponse) setAiResponse(null); // Recalculate
                  }}
                  className="w-full accent-moss cursor-pointer"
                />
                <div className="flex justify-between text-[9px] font-mono text-text-stone">
                  <span>-15°C (Freeze)</span>
                  <span>22°C (Optimal)</span>
                  <span>50°C (Desert Heat)</span>
                </div>
              </div>

              {/* Humidity */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold flex items-center gap-1.5 text-text-bark"><Droplets size={14} className="text-sky-500" /> Humidity (Atmospheric)</span>
                  <span className="font-mono font-bold text-text-stone">{humidity}% RH</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={humidity} 
                  onChange={(e) => {
                    setHumidity(parseInt(e.target.value));
                    if (aiResponse) setAiResponse(null);
                  }}
                  className="w-full accent-moss cursor-pointer"
                />
                <div className="flex justify-between text-[9px] font-mono text-text-stone">
                  <span>0% (Arid)</span>
                  <span>65% (Tropical)</span>
                  <span>100% (Saturated Fog)</span>
                </div>
              </div>

              {/* Soil Moisture */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold flex items-center gap-1.5 text-text-bark"><CloudRain size={14} className="text-blue-500" /> Soil Hydration (Water)</span>
                  <span className="font-mono font-bold text-text-stone">{soilMoisture}%</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={soilMoisture} 
                  onChange={(e) => {
                    setSoilMoisture(parseInt(e.target.value));
                    if (aiResponse) setAiResponse(null);
                  }}
                  className="w-full accent-moss cursor-pointer"
                />
                <div className="flex justify-between text-[9px] font-mono text-text-stone">
                  <span>0% (Desert Dry)</span>
                  <span>50% (Damp loam)</span>
                  <span>100% (Drowned Roots)</span>
                </div>
              </div>

              {/* Photoperiod */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold flex items-center gap-1.5 text-text-bark"><Sun size={14} className="text-amber-500" /> Photoperiod (Daylight)</span>
                  <span className="font-mono font-bold text-text-stone">{photoperiod} Hours/Day</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="24" 
                  value={photoperiod} 
                  onChange={(e) => {
                    setPhotoperiod(parseInt(e.target.value));
                    if (aiResponse) setAiResponse(null);
                  }}
                  className="w-full accent-moss cursor-pointer"
                />
                <div className="flex justify-between text-[9px] font-mono text-text-stone">
                  <span>0h (Permanent Darkness)</span>
                  <span>12h (Equator)</span>
                  <span>24h (Polar Summer)</span>
                </div>
              </div>
            </div>

            {/* Artificial / Laboratory Controls */}
            <div className="space-y-6 pt-4 border-t border-border-light">
              <h4 className="text-[11px] font-black uppercase tracking-widest text-gold border-b border-gold/10 pb-1 flex items-center gap-1.5">
                <Zap size={14} /> Artificial & Lab-Induced Stress
              </h4>

              {/* CO2 Levels */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold flex items-center gap-1.5 text-text-bark"><Wind size={14} className="text-teal-600" /> Carbon Dioxide Enrichment</span>
                  <span className="font-mono font-bold text-text-stone">{co2Level} ppm</span>
                </div>
                <input 
                  type="range" 
                  min="300" 
                  max="2000" 
                  step="50"
                  value={co2Level} 
                  onChange={(e) => {
                    setCo2Level(parseInt(e.target.value));
                    if (aiResponse) setAiResponse(null);
                  }}
                  className="w-full accent-gold cursor-pointer"
                />
                <div className="flex justify-between text-[9px] font-mono text-text-stone">
                  <span>300 ppm (Pre-Industrial)</span>
                  <span>420 ppm (Global Ambient)</span>
                  <span>2000 ppm (Enriched Room)</span>
                </div>
              </div>

              {/* Soil pH */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold flex items-center gap-1.5 text-text-bark"><Sprout size={14} className="text-emerald-700" /> Soil Acidity / Alkaline pH</span>
                  <span className="font-mono font-bold text-text-stone">pH {soilPh}</span>
                </div>
                <input 
                  type="range" 
                  min="3.0" 
                  max="10.0" 
                  step="0.1"
                  value={soilPh} 
                  onChange={(e) => {
                    setSoilPh(parseFloat(e.target.value));
                    if (aiResponse) setAiResponse(null);
                  }}
                  className="w-full accent-gold cursor-pointer"
                />
                <div className="flex justify-between text-[9px] font-mono text-text-stone">
                  <span>3.0 pH (Acid Rain)</span>
                  <span>6.5 pH (Neutral Loam)</span>
                  <span>10.0 pH (Alkaline Ash)</span>
                </div>
              </div>

              {/* UV intensity */}
              <div className="space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold flex items-center gap-1.5 text-text-bark"><Zap size={14} className="text-purple-600" /> Ultraviolet (UV) Light Spectrum</span>
                  <span className="font-mono font-bold text-text-stone">Level {uvIntensity} / 5</span>
                </div>
                <input 
                  type="range" 
                  min="0" 
                  max="5" 
                  value={uvIntensity} 
                  onChange={(e) => {
                    setUvIntensity(parseInt(e.target.value));
                    if (aiResponse) setAiResponse(null);
                  }}
                  className="w-full accent-gold cursor-pointer"
                />
                <div className="flex justify-between text-[9px] font-mono text-text-stone">
                  <span>0 (Off)</span>
                  <span>2 (Filtered Sunlight)</span>
                  <span>5 (Sterilization Burn)</span>
                </div>
              </div>

              {/* Cryo Stasis switch */}
              <div className="flex justify-between items-center p-3.5 bg-bg-primary rounded-2xl border border-border-medium mt-4">
                <div>
                  <h5 className="text-xs font-bold text-text-bark flex items-center gap-1.5">
                    <Snowflake size={14} className="text-sky-400 animate-spin" /> Cryogenic Bio-Stasis Protection
                  </h5>
                  <p className="text-[10px] text-text-stone mt-0.5">Locks molecular degradation. Suspends active growth dynamics.</p>
                </div>
                <button
                  onClick={() => {
                    triggerHaptic('medium');
                    setCryoStasis(!cryoStasis);
                    if (aiResponse) setAiResponse(null);
                  }}
                  className={`w-12 h-6 rounded-full transition-all duration-300 relative ${cryoStasis ? 'bg-sky-500' : 'bg-black/10'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transition-all duration-300 ${cryoStasis ? 'left-6.5' : 'left-0.5'}`} />
                </button>
              </div>
            </div>

            {/* Custom Gemini AI Input Section */}
            <div className="bg-bg-primary rounded-2xl border border-border-medium p-5 space-y-4 pt-4">
              <h4 className="text-[11px] font-black uppercase tracking-widest text-moss border-b border-moss/10 pb-1 flex items-center gap-1.5">
                <Bot size={14} /> Custom Pathogen / Infection Simulation
              </h4>
              <p className="text-xs text-text-stone">
                Enter unique variables (e.g. "Struggling with Powdery Mildew mold" or "Stuffed in clay soil with spider mite pest infestation") to query Gemini's clinical botanical engine.
              </p>
              <textarea
                value={customNotes}
                onChange={(e) => setCustomNotes(e.target.value)}
                placeholder="Example: Leaf margins show blackspot fungal spores; roots are smelling like decay."
                className="w-full h-24 p-3 bg-bg-secondary border border-border-medium rounded-xl text-xs font-medium focus:ring-2 focus:ring-moss focus:outline-none resize-none text-text-bark"
              />
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleQueryGemini}
                disabled={isAiSyncing || !customNotes.trim()}
                className="w-full py-3 bg-zinc-950 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 hover:bg-zinc-800 disabled:opacity-40"
              >
                {isAiSyncing ? '⏳ Syncing Gemini Expert...' : '⚡ Consult Gemini AI Engine'}
              </motion.button>
            </div>
          </div>

          {/* RIGHT COLUMN: Interactive Simulation Chamber Visualization & Analytics (5 Cols) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Visual Simulator Chamber Render Box - HOLOGRAM GRAPHICS */}
            <div className={`relative aspect-square md:aspect-auto md:h-[450px] rounded-3xl border border-border-medium bg-zinc-950 overflow-hidden shadow-2xl flex flex-col justify-end p-6 ${isSimulatingTest ? 'animate-bounce' : ''}`}>
              
              {/* Scanline overlay for cyber lab vibes */}
              <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[size:100%_4px,3px_100%] pointer-events-none z-30" />

              {/* Dynamic Environmental Visual Effects Overlay */}
              {/* 1. Ultraviolet Grow Light Glow */}
              <div 
                className="absolute inset-0 bg-purple-600/20 pointer-events-none transition-opacity duration-500 z-10" 
                style={{ opacity: uvIntensity * 0.18 }}
              />

              {/* 2. Acid/Toxicity Fog */}
              {soilPh < 4.5 && (
                <div className="absolute inset-0 bg-yellow-500/10 pointer-events-none mix-blend-color-burn animate-pulse z-10" />
              )}

              {/* 3. Heat Wave Haze */}
              {temperature > 35 && (
                <div className="absolute inset-0 bg-red-500/10 pointer-events-none transition-all z-10" />
              )}

              {/* 4. Frost / Freezing Glass Crystals border */}
              {temperature < 0 && (
                <div className="absolute inset-0 border-8 border-sky-400/20 rounded-3xl pointer-events-none shadow-[inset_0_0_30px_rgba(56,189,248,0.4)] animate-pulse z-10" />
              )}

              {/* 5. Rain/Flooding overlay */}
              {soilMoisture > 75 && (
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/20 via-transparent to-transparent pointer-events-none z-10" />
              )}

              {/* Floating Environmental Status Indicators inside Chamber */}
              <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none z-20">
                <span className="px-2.5 py-1 text-[9px] font-mono uppercase bg-black/60 text-white rounded border border-white/10 tracking-widest backdrop-blur-xs flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> SVAL-II BIO-POD
                </span>
                
                <span className={`px-2.5 py-1 text-[9px] font-black uppercase rounded border tracking-wider backdrop-blur-xs transition-all ${
                  isAiSyncing ? 'bg-indigo-950/80 text-indigo-300 border-indigo-500/30 animate-pulse' :
                  activeData.survivalChance > 70 ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/30' :
                  activeData.survivalChance === 0 ? 'bg-rose-950/80 text-rose-400 border-rose-500/30 animate-pulse' :
                  'bg-amber-950/80 text-amber-400 border-amber-500/30'
                }`}>
                  {isAiSyncing ? '🤖 Syncing AI...' : activeData.survivalChance > 0 ? (aiResponse ? 'AI Mode' : simulationResults.condition) : 'Dead'}
                </span>
              </div>

              {/* High-Fidelity Interactive SVG Plant Stalk Model */}
              <div className="flex-grow flex items-center justify-center relative min-h-[220px]">
                <svg viewBox="0 0 100 120" className="w-48 h-48 transition-transform duration-1000 z-10" style={{ transformOrigin: 'bottom center' }}>
                  {/* Stem / Stalk */}
                  <motion.path 
                    d="M 50 110 Q 50 70 50 30" 
                    fill="none" 
                    stroke="#1e3a1e" 
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    animate={{
                      d: activeData.survivalChance < 50 
                        ? "M 50 110 Q 55 85 68 55"  // Drooping stem
                        : "M 50 110 Q 50 70 50 30"
                    }}
                    transition={{ duration: 1.5, ease: 'easeInOut' }}
                  />

                  {/* Left Leaf branch */}
                  <motion.path 
                    d="M 50 80 Q 30 75 25 60" 
                    fill="none" 
                    stroke="#1e3a1e" 
                    strokeWidth="2"
                    animate={{
                      d: activeData.survivalChance < 50
                        ? "M 50 92 Q 33 93 25 80" 
                        : "M 50 80 Q 30 75 25 60"
                    }}
                    transition={{ duration: 1.5 }}
                  />
                  {/* Leaf A Shape */}
                  <motion.path 
                    d="M 25 60 C 20 50 30 45 35 55 C 38 62 30 68 25 60 Z"
                    fill={leafColor}
                    stroke="#134e4a"
                    strokeWidth="1"
                    animate={{
                      rotate: activeData.survivalChance < 50 ? [0, 10, 0] : [0, -2, 2, 0],
                      y: activeData.survivalChance < 50 ? 20 : 0,
                      x: activeData.survivalChance < 50 ? 5 : 0
                    }}
                    transition={{ duration: 3, repeat: Infinity }}
                  />

                  {/* Right Leaf branch */}
                  <motion.path 
                    d="M 50 60 Q 70 55 75 40" 
                    fill="none" 
                    stroke="#1e3a1e" 
                    strokeWidth="2"
                    animate={{
                      d: activeData.survivalChance < 50
                        ? "M 50 78 Q 68 76 72 60"
                        : "M 50 60 Q 70 55 75 40"
                    }}
                    transition={{ duration: 1.5 }}
                  />
                  {/* Leaf B Shape */}
                  <motion.path 
                    d="M 75 40 C 80 30 70 25 65 35 C 62 42 70 48 75 40 Z"
                    fill={leafColor}
                    stroke="#134e4a"
                    strokeWidth="1"
                    animate={{
                      rotate: activeData.survivalChance < 50 ? [0, -10, 0] : [0, 2, -2, 0],
                      y: activeData.survivalChance < 50 ? 18 : 0,
                      x: activeData.survivalChance < 50 ? -4 : 0
                    }}
                    transition={{ duration: 3.5, repeat: Infinity, delay: 0.5 }}
                  />

                  {/* Top Crown Leaf */}
                  <motion.path 
                    d="M 50 30 C 40 18 60 18 50 30 Z"
                    fill={leafColor}
                    stroke="#134e4a"
                    strokeWidth="1.2"
                    animate={{
                      scale: activeData.survivalChance < 50 ? 0.85 : 1,
                      y: activeData.survivalChance < 50 ? 22 : 0,
                      x: activeData.survivalChance < 50 ? 12 : 0
                    }}
                    transition={{ duration: 1.5 }}
                  />
                </svg>

                {/* Animated holographic rays */}
                <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(16,185,129,0.03),transparent)] pointer-events-none" />

                {/* Ambient dynamic elements: Mist/Water drops/Photosynthesis bubbles */}
                {soilMoisture > 75 && (
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <motion.div
                        key={`drop-${i}`}
                        className="absolute w-0.5 h-3 bg-blue-400/40 rounded-full"
                        style={{ left: `${i * 18}%`, top: `-${i * 10}px` }}
                        animate={{ y: [0, 300] }}
                        transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2, ease: 'linear' }}
                      />
                    ))}
                  </div>
                )}

                {humidity > 70 && (
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <motion.div 
                      animate={{ opacity: [0.15, 0.35, 0.15], scale: [1, 1.05, 0.98, 1] }}
                      transition={{ duration: 6, repeat: Infinity }}
                      className="absolute inset-0 bg-white/5 backdrop-blur-[1px] pointer-events-none" 
                    />
                  </div>
                )}

                {!cryoStasis && activeData.survivalChance > 60 && (
                  <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    {[1, 2, 3].map((i) => (
                      <motion.div
                        key={`bubble-${i}`}
                        className="absolute w-2 h-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 flex items-center justify-center text-[7px] text-emerald-400 font-bold"
                        style={{ left: `${25 + i * 15}%`, bottom: '20px' }}
                        animate={{ y: [0, -160], opacity: [0, 0.8, 0], x: [0, i * 4 - 6, 0] }}
                        transition={{ duration: 3, repeat: Infinity, delay: i * 0.7 }}
                      >
                        o
                      </motion.div>
                    ))}
                  </div>
                )}
              </div>

              {/* Real-time Status Overlay inside screen */}
              <div className="relative z-20 bg-black/80 backdrop-blur-md border border-white/10 rounded-2xl p-4 text-left space-y-2 shadow-2xl">
                <div className="flex justify-between items-center">
                  <h4 className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest leading-none flex items-center gap-1.5">
                    <Activity size={10} className="text-emerald-500 animate-pulse" /> Diagnostic Feedback
                  </h4>
                  <span className="text-[8px] font-mono text-zinc-500">REFRESH_RATE: 12HZ</span>
                </div>
                <p className="text-[11px] text-zinc-100 font-medium leading-relaxed">
                  {isAiSyncing ? '🤖 Recalculating clinical diagnosis in real-time with Gemini LLM engine...' : activeData.clinicalDiagnosis}
                </p>
              </div>
            </div>

            {/* Diagnostic Parameters Output */}
            <div className="bg-bg-secondary border border-border-medium rounded-3xl p-6 shadow-sm space-y-6">
              <h3 className="font-serif text-lg font-black text-text-bark border-b border-border-light pb-3">Clinical Pathology Output</h3>
              
              <div className="space-y-6">
                
                {/* Survival Index */}
                <div className="p-4 bg-bg-primary rounded-2xl border border-border-medium text-center relative overflow-hidden">
                  <div className="absolute -top-10 -right-10 w-20 h-20 bg-moss/10 rounded-full blur-xl pointer-events-none" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-text-stone">Plant Survival Probability</p>
                  <p className={`text-4xl font-mono font-black mt-2 ${
                    activeData.survivalChance > 75 ? 'text-emerald-600' :
                    activeData.survivalChance > 35 ? 'text-amber-500 animate-pulse' :
                    'text-rose-600 animate-bounce'
                  }`}>{activeData.survivalChance}%</p>
                  
                  <div className="h-2 w-full bg-black/5 rounded-full overflow-hidden mt-3">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        activeData.survivalChance > 75 ? 'bg-emerald-600' :
                        activeData.survivalChance > 35 ? 'bg-amber-500' :
                        'bg-rose-600'
                      }`}
                      style={{ width: `${activeData.survivalChance}%` }} 
                    />
                  </div>
                </div>

                {/* Turgor Status */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-text-bark">
                    <span>Vacuole Turgor Status</span>
                    <span className="font-mono text-text-stone text-[10px]">{activeData.turgorStatus}</span>
                  </div>
                  <p className="text-[10px] text-text-stone leading-relaxed">{activeData.turgorDescription}</p>
                </div>

                {/* Photothermal Tolerance */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-text-bark">
                    <span>Photothermal Tolerance</span>
                    <span className="font-mono text-text-stone text-[10px]">{activeData.photothermalTolerance}</span>
                  </div>
                  <p className="text-[10px] text-text-stone leading-relaxed">{activeData.photothermalDescription}</p>
                </div>

                {/* pH Nutrient Availability */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-bold text-text-bark">
                    <span>pH Mineral Availability</span>
                    <span className="font-mono text-text-stone text-[10px]">{activeData.nutrientAvailability}</span>
                  </div>
                  <p className="text-[10px] text-text-stone leading-relaxed">{activeData.nutrientDescription}</p>
                </div>

              </div>

              {/* Bottom Chamber Actions */}
              <div className="pt-4 border-t border-border-light flex flex-col gap-3">
                <motion.button
                  whileHover={{ scale: 1.02, boxShadow: '0 0 20px rgba(18, 116, 68, 0.35)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleTriggerStressTest}
                  disabled={isSimulatingTest}
                  className="w-full py-4 bg-moss hover:bg-moss-dark text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-98 flex items-center justify-center gap-2 border border-emerald-500/20"
                >
                  <Play size={14} fill="currentColor" className="text-emerald-300 animate-pulse" />
                  {isSimulatingTest ? '⏳ Running Clinical stress Test...' : '⚡ Run Clinical pathology Test'}
                </motion.button>

                <motion.button
                  whileHover={activeData.survivalChance > 70 && !unlockedBlueprint ? { scale: 1.02, boxShadow: '0 0 20px rgba(218, 165, 32, 0.3)' } : {}}
                  whileTap={activeData.survivalChance > 70 && !unlockedBlueprint ? { scale: 0.98 } : {}}
                  onClick={handleExtractBlueprint}
                  disabled={activeData.survivalChance <= 70 || unlockedBlueprint}
                  className="w-full py-4 bg-bg-primary hover:bg-bg-tertiary border border-border-medium text-text-bark disabled:opacity-40 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                >
                  <Award size={14} className="text-gold animate-bounce" /> 
                  {unlockedBlueprint ? 'Blueprint Extracted!' : 'Synthesize Resilient Seed Blueprint (-1,000 Seeds)'}
                </motion.button>

                {unlockedBlueprint && (
                  <p className="text-[10px] text-moss text-center font-bold animate-pulse">
                    ✓ Climate-Resilient Seed Blueprint stored in your Botanical Sanctuary inventory!
                  </p>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
    </PageWrapper>
  );
}