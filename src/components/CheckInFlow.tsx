import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Droplets, Sun, Wind, Check, Camera, ArrowRight, X, Loader2, Sparkles, AlertTriangle, Zap } from 'lucide-react';
import { db } from '../db/database';
import { extractSignature, analyzePlantHealth, type DriftResult } from '../services/driftDetector';
import { runGuardianDossier } from '../notifications/alertEngine';
import { GameService } from '../services/gameService';
import { createSensorProvider } from '../sensors/SensorProvider';
import { MoistureLevel, LightLevel } from '../types';

interface CheckInFlowProps {
  plantName: string;
  plantId: string;
  onComplete: () => void;
  onClose: () => void;
}

export default function CheckInFlow({ plantName, plantId, onComplete, onClose }: CheckInFlowProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [driftResult, setDriftResult] = useState<DriftResult | null>(null);
  const [sensorStatus, setSensorStatus] = useState<'available' | 'unavailable' | 'detecting'>('unavailable');
  const [data, setData] = useState({
    soilMoisture: '' as 'Dry' | 'Moist' | 'Wet' | '',
    lightLevel: '' as 'Direct' | 'Indirect' | 'Low' | '',
    changes: [] as string[],
    photo: null as string | null,
    photoBlob: null as Blob | null
  });

  useEffect(() => {
    const lightSensor = createSensorProvider('ambient_light', true);
    if (lightSensor.isAvailable()) {
      setSensorStatus('available');
      lightSensor.start();
      
      const checkSensor = setInterval(() => {
        const latest = lightSensor.getLatest();
        if (latest && latest.source === 'hardware') {
          const lux = latest.value as number;
          let level: 'Direct' | 'Indirect' | 'Low' = 'Low';
          if (lux > 8000) level = 'Direct';
          else if (lux > 800) level = 'Indirect';
          
          setData(d => ({ ...d, lightLevel: level }));
          setSensorStatus('detecting');
        }
      }, 1000);

      return () => {
        clearInterval(checkSensor);
        lightSensor.stop();
      };
    }
  }, []);

  const nextStep = () => {
    setStep(s => s + 1);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setData(d => ({ ...d, photoBlob: file, photo: URL.createObjectURL(file) }));
      await runAnalysis(file);
    }
  };

  const runAnalysis = async (blob: Blob) => {
    setLoading(true);
    try {
      const plant = await db.plants.get(plantId);
      const result = await analyzePlantHealth(blob, plant?.baselineSignature || null, plant?.species);
      setDriftResult(result);
    } catch (error) {
      console.error('Analysis failed', error);
    } finally {
      setLoading(false);
    }
  };

  const saveCheckIn = async () => {
    setLoading(true);
    try {
      const randomFactor = Math.floor(Math.random() * 15);
      const hasPhoto = !!data.photoBlob;
      
      const gScore = (() => {
        if (!hasPhoto) {
          // No photo = capped score, no precision bonus possible
          return Math.min(85, 72 + randomFactor);
        }
        
        // With photo: full calculation including drift
        const driftPenalty = (driftResult?.driftScore || 0) * 60;
        const baseScore = 78 + randomFactor - driftPenalty;
        
        // Bonus for excellent care WITH photo evidence
        if (baseScore >= 90 && driftResult && driftResult.driftScore < 0.1) {
          return Math.min(98, baseScore + 5); 
        }
        
        return Math.min(95, baseScore);
      })();
      
      const checkInId = crypto.randomUUID();
      await db.checkins.add({
        id: checkInId,
        plantId,
        timestamp: new Date(),
        soilMoisture: data.soilMoisture as MoistureLevel,
        lightLevel: data.lightLevel as LightLevel,
        changes: data.changes,
        photoBlob: data.photoBlob,
        photoUrl: null, // Don't store volatile Blob URLs
        signature: driftResult?.signature || null,
        guardianScore: Math.max(0, Math.min(100, gScore)),
        driftScore: driftResult?.driftScore || null,
        driftStatus: driftResult?.driftStatus || null,
        weatherTemp: null,
        weatherHumidity: null,
        weatherDescription: null,
        synced: 0
      });

      // Update plant status and baseline if needed
      const updates: any = {
        guardianScore: Math.max(0, Math.min(100, gScore)),
        status: driftResult ? (driftResult.driftStatus === 'stable' ? 'Stable' : driftResult.driftStatus === 'watching' ? 'Watching' : 'Alert') : 'Stable',
        updatedAt: new Date()
      };

      const plant = await db.plants.get(plantId);
      if (plant && !plant.baselineSignature && driftResult?.signature) {
        updates.baselineSignature = driftResult.signature;
      }

      await db.plants.update(plantId, updates);
      
      // Game: Generate/Update PhytoCard
      const finalCheckIn = await db.checkins.get(checkInId);
      if (finalCheckIn) {
        await GameService.generateCardForPlant(plantId);
        await GameService.updateCardFromCheckIn(plantId, finalCheckIn);
      }
      
      // Run forecasting dossier
      await runGuardianDossier(plantId);
      
      onComplete();
    } catch (error) {
      console.error('Failed to save check-in', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleChange = (change: string) => {
    setData(prev => ({
      ...prev,
      changes: prev.changes.includes(change) 
        ? prev.changes.filter(c => c !== change)
        : [...prev.changes, change]
    }));
  };

  const isStepValid = () => {
    if (step === 1) return data.soilMoisture !== '';
    if (step === 2) return data.lightLevel !== '';
    // Optional photo step but encouraged
    return true;
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-garden-earth/40 backdrop-blur-xl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white w-full max-w-xl rounded-[3.5rem] shadow-2xl border border-garden-olive/10 overflow-hidden relative"
      >
        <button 
          onClick={onClose}
          className="absolute top-8 right-8 w-10 h-10 rounded-2xl bg-garden-cream flex items-center justify-center text-garden-earth/40 hover:text-garden-coral transition-colors z-10"
        >
          <X size={20} />
        </button>

        <div className="p-10 md:p-14">
          <header className="mb-12">
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-garden-sage mb-2 block">Daily Check-In</span>
            <h2 className="font-serif text-4xl font-bold text-garden-earth">
              How is <span className="italic text-garden-sage">{plantName}</span>?
            </h2>
            <div className="flex gap-2 mt-6">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className={`h-1.5 flex-grow rounded-full transition-all duration-500 ${i <= step ? 'bg-garden-sage' : 'bg-garden-earth/5'}`} />
              ))}
            </div>
          </header>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div>
                  <h3 className="text-sm font-bold text-garden-earth mb-6 uppercase tracking-widest flex items-center gap-2">
                    <Droplets size={16} className="text-blue-500" /> Soil Moisture
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    {['Dry', 'Moist', 'Wet'].map(level => (
                      <button
                        key={level}
                        onClick={() => {
                          setData(d => ({ ...d, soilMoisture: level as any }));
                          nextStep();
                        }}
                        className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 ${
                          data.soilMoisture === level 
                            ? 'border-garden-sage bg-garden-sage/5 text-garden-earth' 
                            : 'border-garden-olive/5 bg-garden-cream/30 text-garden-earth/40 hover:border-garden-olive/20'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${data.soilMoisture === level ? 'bg-garden-sage text-white' : 'bg-white'}`}>
                           {level === 'Dry' ? '🌵' : level === 'Moist' ? '💧' : '🌊'}
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest">{level}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-sm font-bold text-garden-earth uppercase tracking-widest flex items-center gap-2">
                      <Sun size={16} className="text-orange-500" /> Light Exposure
                    </h3>
                    {sensorStatus === 'detecting' && (
                      <div className="flex items-center gap-2 px-3 py-1 bg-garden-sage/10 text-garden-sage rounded-full">
                        <Zap size={10} className="animate-pulse" />
                        <span className="text-[8px] font-black uppercase tracking-widest">Hardware Calibration Active</span>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {['Direct', 'Indirect', 'Low'].map(level => (
                      <button
                        key={level}
                        onClick={() => {
                          setData(d => ({ ...d, lightLevel: level as any }));
                          nextStep();
                        }}
                        className={`p-6 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 relative overflow-hidden ${
                          data.lightLevel === level 
                            ? 'border-garden-sage bg-garden-sage/5 text-garden-earth' 
                            : 'border-garden-olive/5 bg-garden-cream/30 text-garden-earth/40 hover:border-garden-olive/20'
                        }`}
                      >
                        {sensorStatus === 'detecting' && data.lightLevel === level && (
                          <div className="absolute top-2 right-2">
                            <Zap size={10} className="text-garden-sage fill-garden-sage" />
                          </div>
                        )}
                        <span className="text-2xl">{level === 'Direct' ? '☀️' : level === 'Indirect' ? '🌤️' : '☁️'}</span>
                        <span className="text-xs font-bold uppercase tracking-widest">{level}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div>
                  <h3 className="text-sm font-bold text-garden-earth mb-6 uppercase tracking-widest">Observable Changes</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {['New Growth', 'Dropped Leaf', 'Pests Seen', 'Yellowing', 'Browning', 'Wilting'].map(change => (
                      <button
                        key={change}
                        onClick={() => toggleChange(change)}
                        className={`p-4 rounded-2xl border-2 text-left transition-all text-xs font-bold ${
                          data.changes.includes(change)
                            ? 'border-garden-sage bg-garden-sage/5 text-garden-earth'
                            : 'border-garden-olive/5 bg-garden-cream/30 text-garden-earth/40 hover:border-garden-olive/20'
                        }`}
                      >
                        {change}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 4 && (
              <motion.div 
                key="step4"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-8"
              >
                <div className="text-center py-4">
                  <h3 className="text-sm font-bold text-garden-earth mb-6 uppercase tracking-widest">Visual Drift Baseline Check</h3>
                  
                  {!data.photo ? (
                    <label className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-garden-olive/20 rounded-[3rem] bg-garden-cream/30 cursor-pointer hover:border-garden-sage hover:bg-garden-sage/5 transition-all group">
                       <div className="w-20 h-20 bg-white rounded-[2rem] flex items-center justify-center text-garden-sage shadow-xl group-hover:scale-110 transition-transform mb-6">
                        <Camera size={32} />
                      </div>
                      <span className="text-sm font-serif font-bold text-garden-earth mb-2">Capture Health Selfie</span>
                      <span className="text-[10px] font-black uppercase tracking-widest text-garden-earth/30">Essential for cellular drift detection</span>
                      <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                    </label>
                  ) : (
                    <div className="space-y-8">
                       <div className="relative w-full aspect-square max-w-[280px] mx-auto rounded-[3rem] overflow-hidden shadow-2xl">
                          <img src={data.photo} className="w-full h-full object-cover" alt="checkin" />
                          {loading && (
                            <div className="absolute inset-0 bg-garden-earth/60 backdrop-blur-md flex flex-col items-center justify-center text-white p-8">
                               <Loader2 className="animate-spin mb-4" size={32} />
                               <span className="text-[10px] font-black uppercase tracking-widest text-center">Analyzing leaf contour variance & HSV shift...</span>
                            </div>
                          )}
                          {driftResult && !loading && (
                            <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md p-4 rounded-2xl flex items-center gap-3">
                               <Sparkles className="text-garden-sage" size={20} />
                               <div className="text-left">
                                  <p className="text-[10px] font-black uppercase tracking-widest text-garden-earth leading-none">Visual Stability</p>
                                  <p className="text-xs font-bold text-garden-sage uppercase tracking-widest">{((1 - driftResult.driftScore) * 100).toFixed(0)}% Corrected</p>
                                </div>
                            </div>
                          )}
                       </div>
                       
                       {driftResult && !loading && (
                         <motion.div 
                           initial={{ opacity: 0, y: 10 }}
                           animate={{ opacity: 1, y: 0 }}
                           className="p-6 bg-garden-amber/5 border border-garden-amber/10 rounded-3xl text-left flex gap-4"
                         >
                            <AlertTriangle className="text-garden-amber shrink-0" size={20} />
                            <div className="space-y-2">
                               {driftResult.reasoning.map((r, i) => (
                                 <p key={i} className="text-xs text-garden-slate italic leading-relaxed">{r}</p>
                               ))}
                            </div>
                         </motion.div>
                       )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <footer className="mt-12 flex justify-between items-center">
            {step > 1 ? (
              <button 
                onClick={() => setStep(s => s - 1)} 
                className="text-[10px] font-black uppercase tracking-widest text-garden-earth/40 hover:text-garden-earth"
              >
                Back
              </button>
            ) : <div />}
            
            <button 
              disabled={!isStepValid() || loading}
              onClick={step === 4 ? saveCheckIn : nextStep}
              className="px-10 py-5 bg-garden-earth text-white rounded-2xl font-black uppercase tracking-widest text-[10px] flex items-center gap-3 hover:bg-garden-sage transition-all disabled:opacity-20 shadow-xl shadow-garden-earth/10 group active:scale-95"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={14} /> Processing...
                </>
              ) : (
                <>
                  {step === 4 ? 'Complete Protocol' : 'Continue'} {(step < 4) && <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" /> }
                </>
              )}
            </button>
          </footer>
        </div>

        {/* Decorative corner */}
        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-garden-sage/5 rounded-full blur-3xl pointer-events-none" />
      </motion.div>
    </div>
  );
}
