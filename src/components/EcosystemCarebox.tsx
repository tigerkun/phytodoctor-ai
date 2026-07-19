import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Cloud, Wind, Droplets, Sun, Thermometer, Leaf, Sprout, Zap,
} from 'lucide-react';
import { getCachedWeather, WeatherData } from '../services/weatherService';

interface EcosystemCareboxProps {
  identification: {
    commonName: string;
    healthStatus: string;
    watering: string;
    light: string;
    temperature?: string;
  } | null;
}

const CAREBOX_ITEMS: Record<string, { label: string; icon: React.ReactNode; priority: number }[]> = {
  watering: [
    { label: 'Well-draining Aroid Mix',            icon: <Sprout size={14} />, priority: 1 },
    { label: 'Moisture Meter Probe',               icon: <Droplets size={14} />, priority: 2 },
    { label: 'Terracotta Self-Watering Pot',       icon: <Droplets size={14} />, priority: 3 },
  ],
  light: [
    { label: 'Full-Spectrum Grow Light',           icon: <Sun size={14} />, priority: 1 },
    { label: 'Sheer UV-Filtering Curtains',        icon: <Sun size={14} />, priority: 2 },
    { label: 'Grow Light Timer + Dimmer',          icon: <Thermometer size={14} />, priority: 3 },
  ],
  humidity: [
    { label: 'Ultrasonic Plant Humidifier',        icon: <Cloud size={14} />, priority: 1 },
    { label: 'Pebble Humidity Tray',               icon: <Droplets size={14} />, priority: 2 },
    { label: 'Greenhouse Propagation Dome',        icon: <Leaf size={14} />, priority: 3 },
  ],
  pest: [
    { label: 'Organic Neem Tonic',                 icon: <Leaf size={14} />, priority: 1 },
    { label: 'Sticky Yellow Traps',                icon: <Leaf size={14} />, priority: 2 },
    { label: 'Beneficial Ladybug Habitat',         icon: <Zap size={14} />, priority: 3 },
  ],
  general: [
    { label: 'Slow-Release Organic Fertilizer',    icon: <Sprout size={14} />, priority: 1 },
    { label: 'pH Testing Strips',                  icon: <Droplets size={14} />, priority: 2 },
    { label: 'Pruning Shears – Precision Set',     icon: <Zap size={14} />, priority: 3 },
  ],
};

function getPrescription(id: EcosystemCareboxProps['identification']): string {
  if (!id) return 'Feed and withhold water. Apply balanced nutrition.';
  const water = id.watering?.toLowerCase() ?? '';
  const light = id.light?.toLowerCase() ?? '';
  if (water.includes('moist')) return 'Raise ambient humidity. Mist twice daily.';
  if (water.includes('dry'))   return 'Deep soak every 10–14 days. Reduce frequency.';
  if (light.includes('indirect')) return 'Relocate to east-facing exposure.';
  if (light.includes('low'))     return 'Supplement with full-spectrum grow lamp.';
  return 'Maintain current protocol. Re-scan in 7 days to confirm stability.';
}

function getWeatherCategory(_weather?: WeatherData): string {
  if (!_weather) return 'General Care';
  if (_weather.humidity > 75) return 'Humidity Care';
  if (_weather.temperature > 28) return 'Heat Alert';
  if (_weather.temperature < 12) return 'Cold Warning';
  return 'Environmental Balance';
}

export default function EcosystemCarebox({ identification }: EcosystemCareboxProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const data = await getCachedWeather(19.076, 72.8777);
        setWeather(data);
      } catch {
        setWeather(null);
      }
    };
    fetchWeather();
  }, []);

  if (!identification && !weather) return null;

  const prescription = getPrescription(identification);
  const category      = getWeatherCategory(weather ?? undefined);

  let items = CAREBOX_ITEMS.general;
  if (weather && weather.humidity > 75) items = CAREBOX_ITEMS.humidity;
  if (identification?.watering?.toLowerCase().includes('moist')) items = CAREBOX_ITEMS.watering;
  if (identification?.light?.toLowerCase().includes('low')) items = CAREBOX_ITEMS.light;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.6 }}
      className="
        bg-gradient-to-br
        from-[var(--moss-dark)] to-[#2D5A4A]
        text-white
        rounded-3xl
        p-6 md:p-8
        shadow-xl
        relative
        overflow-hidden
        mt-6
      "
    >
      {/* ── Ambient leaf accents ──────────────────────────────── */}
      <div className="absolute -bottom-10 -right-10 opacity-10 pointer-events-none">
        <Leaf size={180} />
      </div>
      <div className="absolute top-4 right-6 opacity-10 pointer-events-none animate-[float_6s_ease-in-out_infinite]">
        <Sprout size={120} />
      </div>

      {/* ── Header Row ─────────────────────────────────────────── */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Cloud size={16} className="text-[var(--moss-light)]" />
            <h3 className="font-serif text-2xl md:text-3xl font-bold">Ecosystem Carebox Recommendations</h3>
          </div>
          <p className="text-white/50 text-xs font-black uppercase tracking-widest">
            Context-Aware Recommendations · {category}
          </p>
        </div>

        {/* Weather pill badge */}
        {weather && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 border border-white/10 text-white/80 text-[10px] font-black uppercase tracking-widest">
            <Wind size={11} /> {weather.description?.charAt(0).toUpperCase() ?? 'Unknown'} · {Math.round(weather.temperature)}°C · {Math.round(weather.humidity)}% humidity
          </div>
        )}
      </div>

      {/* ── Prescription Text ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="
          relative z-10 mb-8
          px-6 py-5
          bg-white/5
          rounded-2xl
          border-l-4
          border-[var(--moss-light)]
          font-serif
          italic
          text-lg
          leading-relaxed
          text-white/90
        "
      >
        &ldquo;{prescription}&rdquo;
      </motion.div>

      {/* ── Product Sub-Chips ───────────────────────────────────── */}
      <div className="relative z-10 space-y-4">
        <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-3">Curated Supplies</p>
        <div className="flex flex-wrap gap-3">
          {items.map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + i * 0.1 }}
              className="
                flex items-center gap-3
                px-4
                py-2.5
                bg-white/10
                border border-white/15
                rounded-xl
                text-white/85
                text-[11px] font-semibold
                hover:bg-white/20 hover:border-white/30
                transition-all
                cursor-default
              "
            >
              <span className="text-[var(--moss-light)] shrink-0">{item.icon}</span>
              <span>{item.label}</span>
              {i === 0 && (
                <span className="ml-1 text-[9px] font-black uppercase tracking-widest text-[var(--terracotta)] bg-[var(--terracotta)]/10 px-1.5 py-0.5 rounded-full">
                  Primary
                </span>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
