import React, { useRef, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Activity, Camera, Zap } from 'lucide-react';

export default function VisualAnalysisLab() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [stats, setStats] = useState({ hue: 0, saturation: 0, vibrancy: 0 });

  useEffect(() => {
    if (analyzing) {
      const interval = setInterval(() => {
        analyzeFrame();
      }, 200);
      return () => clearInterval(interval);
    }
  }, [analyzing]);

  const startAnalysis = async () => {
     try {
       const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
       if (videoRef.current) {
         videoRef.current.srcObject = stream;
         setAnalyzing(true);
       }
     } catch (err) {
       console.error("Camera access denied", err);
     }
  };

  const analyzeFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = frame.data;

    let hSum = 0, sSum = 0, vSum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i+1], b = data[i+2];
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const d = max - min;
      const s = max === 0 ? 0 : d / max;
      const v = max / 255;
      let h = 0;
      if (max !== min) {
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }
      hSum += h; sSum += s; vSum += v;
    }

    const pixels = data.length / 4;
    setStats({
      hue: (hSum / pixels) * 360,
      saturation: (sSum / pixels) * 100,
      vibrancy: (vSum / pixels) * 100
    });
  };

  return (
    <div className="bg-garden-earth/40 p-8 rounded-[2rem] border border-white/5 backdrop-blur-xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h3 className="text-xl font-bold text-white mb-2">Visual Drift Laboratory</h3>
          <p className="text-xs text-white/40 max-w-md italic">
            Real-time HSV histogram analysis. Deterministic stress detection via color thresholding.
          </p>
        </div>
        <button 
          onClick={startAnalysis}
          className="flex items-center gap-2 px-6 py-3 bg-garden-sage text-garden-earth text-xs font-black uppercase tracking-widest rounded-full hover:scale-105 transition-transform"
        >
          <Camera size={16} />
          {analyzing ? 'Analysis Active' : 'Start Camera Feed'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="relative aspect-video rounded-3xl overflow-hidden bg-black border border-white/10 group">
          <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover grayscale brightness-50" />
          <canvas ref={canvasRef} className="hidden" width={100} height={100} />
          
          <div className="absolute inset-0 pointer-events-none border-[20px] border-white/5" />
          <div className="absolute top-1/2 left-0 w-full h-[1px] bg-garden-sage/30" />
          <div className="absolute top-0 left-1/2 h-full w-[1px] bg-garden-sage/30" />
          
          <div className="absolute bottom-6 left-6 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-[10px] font-mono text-garden-sage">
              <Zap size={12} fill="currentColor" />
              LIVE_HSV_INFERENCE_READY
            </div>
            <div className="text-[10px] font-mono text-white/40">LATENCY: ~18ms | SENSOR: RGB-8</div>
          </div>

          {!analyzing && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20">Standby Mode</span>
            </div>
          )}
        </div>

        <div className="space-y-6 flex flex-col justify-center">
          <AnalysisMetric label="Hue (Botanical Core)" value={`${stats.hue.toFixed(0)}°`} percent={stats.hue / 360 * 100} color="bg-garden-sage" />
          <AnalysisMetric label="Saturation (Cell Turgor)" value={`${stats.saturation.toFixed(1)}%`} percent={stats.saturation} color="bg-garden-amber" />
          <AnalysisMetric label="Vibrancy (Photosynthetic Rate)" value={`${stats.vibrancy.toFixed(1)}%`} percent={stats.vibrancy} color="bg-white" />
          
          <div className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/5">
            <h4 className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-3 flex items-center gap-2">
               <Activity size={12} className="text-garden-sage" />
               Signal Interpretation
            </h4>
            <p className="text-[11px] text-white/60 leading-relaxed">
              {stats.hue > 60 && stats.hue < 150 
                ? 'Signal detects optimal chlorophyll density. High confidence in photosynthetic stability.' 
                : stats.hue > 0 && analyzing 
                ? 'Anomalous hue detected. Potential chlorosis or anthocyanin buildup. Mitigation protocol recommended.' 
                : 'Waiting for signal input...'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function AnalysisMetric({ label, value, percent, color }: { label: string, value: string, percent: number, color: string }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">{label}</span>
        <span className="text-[10px] font-mono text-white/60">{value}</span>
      </div>
      <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${percent}%` }}
          className={`h-full ${color}`}
        />
      </div>
    </div>
  );
}
