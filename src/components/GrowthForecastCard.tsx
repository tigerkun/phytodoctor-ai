import type { GrowthForecast } from '../services/growthForecastService';

export default function GrowthForecastCard({ forecast }: { forecast: GrowthForecast }) {
  if (!forecast.hasEnoughData) {
    return <div className="rounded-2xl border border-[#c5a059]/20 p-4 text-sm text-[#cbbda8]">Check in two more times to unlock a trustworthy forecast.</div>;
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-2xl border border-red-300/20 bg-red-950/15 p-4">
        <p className="text-[10px] uppercase tracking-widest text-[#cbbda8]">If nothing changes</p>
        <p className="mt-2 font-serif text-lg text-[#f4eee1]">{forecast.ifUnchanged?.prediction}</p>
        <p className="mt-2 text-xs text-[#cbbda8]">{forecast.ifUnchanged?.timeframe}</p>
      </div>
      <div className="rounded-2xl border border-[#86b98b]/30 bg-[#27452d]/20 p-4">
        <p className="text-[10px] uppercase tracking-widest text-[#cbbda8]">If you fix {forecast.ifFixed?.fix}</p>
        <p className="mt-2 font-serif text-lg text-[#f4eee1]">{forecast.ifFixed?.prediction}</p>
        <p className="mt-2 text-xs text-[#cbbda8]">{forecast.ifFixed?.timeframe}</p>
      </div>
    </div>
  );
}
