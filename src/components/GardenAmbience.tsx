import { memo } from 'react';
import { useDayNightTheme } from '@/hooks/useDayNightTheme';
import { useEcoMode } from '@/hooks/useEcoMode';
import { useTimeOfDay } from '@/hooks/useTimeOfDay';

/**
 * GardenAmbience — the app's living background.
 *
 * Stacked, GPU-cheap layers that give the garden depth without ever
 * competing with the content:
 *   1. light pools   — large soft radial washes that drift on 50-90s cycles
 *   2. foliage       — botanical silhouettes framing the edges, gently swaying
 *   3. motes         — fine drifting dust catching the light
 *   4. celestial & atmospheric layers:
 *      - night / late-night: twinkling stars, drifting moon disc, wandering fireflies, shooting star
 *      - dawn / morning: warm sun disc with rotating conic ray wheel and soft bloom
 *      - afternoon: soft drifting blurred clouds
 *      - dusk: horizon glow plus first stars
 *   5. vignette      — pulls the eye back to the centre column
 *
 * Everything animates with `transform`/`opacity` only, so it stays on the
 * compositor. Under eco mode or `prefers-reduced-motion` the layers render
 * once and hold still.
 */

interface MoteSpec {
  left: string;
  size: number;
  delay: number;
  duration: number;
  drift: number;
  opacity: number;
}

// Hand-placed so the distribution reads as depth rather than a grid.
const DAY_MOTES: MoteSpec[] = [
  { left: '8%',  size: 3, delay: 0,    duration: 34, drift: 26,  opacity: 0.5 },
  { left: '17%', size: 2, delay: 6,    duration: 41, drift: -18, opacity: 0.4 },
  { left: '26%', size: 4, delay: 12,   duration: 37, drift: 32,  opacity: 0.35 },
  { left: '34%', size: 2, delay: 3,    duration: 46, drift: -22, opacity: 0.45 },
  { left: '43%', size: 3, delay: 18,   duration: 39, drift: 20,  opacity: 0.4 },
  { left: '52%', size: 2, delay: 9,    duration: 44, drift: -28, opacity: 0.35 },
  { left: '61%', size: 3, delay: 21,   duration: 35, drift: 24,  opacity: 0.45 },
  { left: '69%', size: 4, delay: 15,   duration: 42, drift: -16, opacity: 0.3 },
  { left: '77%', size: 2, delay: 24,   duration: 38, drift: 30,  opacity: 0.5 },
  { left: '85%', size: 3, delay: 7,    duration: 45, drift: -20, opacity: 0.4 },
  { left: '92%', size: 2, delay: 27,   duration: 33, drift: 18,  opacity: 0.45 },
  { left: '12%', size: 2, delay: 30,   duration: 43, drift: -26, opacity: 0.35 },
  { left: '48%', size: 2, delay: 36,   duration: 40, drift: 22,  opacity: 0.4 },
  { left: '71%', size: 3, delay: 11,   duration: 47, drift: -14, opacity: 0.3 },
  { left: '3%',  size: 3, delay: 19,   duration: 36, drift: 28,  opacity: 0.4 },
  { left: '97%', size: 2, delay: 33,   duration: 40, drift: -24, opacity: 0.35 },
];

const NIGHT_STARS = [
  { top: '8%',  left: '12%', size: 2,   delay: '0.2s', duration: '2.5s', opacity: 0.85 },
  { top: '14%', left: '26%', size: 1.5, delay: '1.2s', duration: '3.2s', opacity: 0.7 },
  { top: '6%',  left: '38%', size: 2.5, delay: '0.6s', duration: '2.8s', opacity: 0.95 },
  { top: '18%', left: '48%', size: 1.5, delay: '1.9s', duration: '3.6s', opacity: 0.75 },
  { top: '10%', left: '60%', size: 2,   delay: '0.4s', duration: '2.7s', opacity: 0.9 },
  { top: '22%', left: '72%', size: 1.5, delay: '1.5s', duration: '3.3s', opacity: 0.65 },
  { top: '9%',  left: '84%', size: 2,   delay: '2.1s', duration: '3.0s', opacity: 0.85 },
  { top: '16%', left: '94%', size: 1.5, delay: '0.8s', duration: '3.7s', opacity: 0.7 },
  { top: '27%', left: '16%', size: 1.5, delay: '1.1s', duration: '2.9s', opacity: 0.75 },
  { top: '31%', left: '34%', size: 2,   delay: '1.7s', duration: '2.6s', opacity: 0.9 },
  { top: '25%', left: '56%', size: 1.5, delay: '2.4s', duration: '3.4s', opacity: 0.65 },
  { top: '33%', left: '68%', size: 2,   delay: '0.5s', duration: '2.8s', opacity: 0.85 },
  { top: '29%', left: '82%', size: 1.5, delay: '1.8s', duration: '3.5s', opacity: 0.75 },
  { top: '12%', left: '76%', size: 2.5, delay: '1.0s', duration: '2.4s', opacity: 0.95 },
];

const DUSK_STARS = [
  { top: '8%',  left: '20%', size: 2,   delay: '0.5s', duration: '3.0s', opacity: 0.55 },
  { top: '12%', left: '45%', size: 1.5, delay: '1.6s', duration: '3.5s', opacity: 0.45 },
  { top: '7%',  left: '70%', size: 2,   delay: '0.8s', duration: '2.8s', opacity: 0.6 },
  { top: '15%', left: '85%', size: 1.5, delay: '2.0s', duration: '3.2s', opacity: 0.5 },
  { top: '20%', left: '35%', size: 1.5, delay: '1.2s', duration: '3.8s', opacity: 0.4 },
];

const FIREFLIES = [
  { top: '62%', left: '16%', duration: '14s', delay: '0s',  driftX: 35,  driftY: -45 },
  { top: '74%', left: '38%', duration: '18s', delay: '3s',  driftX: -40, driftY: -35 },
  { top: '56%', left: '72%', duration: '16s', delay: '7s',  driftX: 30,  driftY: -50 },
  { top: '82%', left: '54%', duration: '20s', delay: '2s',  driftX: -35, driftY: -40 },
  { top: '66%', left: '86%', duration: '15s', delay: '5s',  driftX: 25,  driftY: -30 },
];

const AFTERNOON_CLOUDS = [
  { top: '11%', width: 'min(36vw, 340px)', height: '60px', duration: '74s', delay: '0s' },
  { top: '24%', width: 'min(44vw, 420px)', height: '75px', duration: '88s', delay: '28s' },
  { top: '8%',  width: 'min(28vw, 280px)', height: '50px', duration: '64s', delay: '48s' },
];

export const GardenAmbience = memo(function GardenAmbience() {
  const { theme } = useDayNightTheme();
  const { shouldDisableAnimations, motionPreference } = useEcoMode();
  const { timeOfDay: timePeriod } = useTimeOfDay();
  const still = shouldDisableAnimations;
  const isDay = theme === 'day';

  const isNightScene = timePeriod === 'night' || timePeriod === 'late-night';
  const isSunScene = timePeriod === 'dawn' || timePeriod === 'morning';
  const isAfternoonScene = timePeriod === 'afternoon';
  const isDuskScene = timePeriod === 'dusk';

  const motes = isDay ? DAY_MOTES : DAY_MOTES.slice(0, 10);

  return (
    <div
      aria-hidden="true"
      className="garden-ambience"
      data-scene={isDay ? 'day' : 'night'}
      data-period={timePeriod}
      data-motion={motionPreference}
      data-still={still ? 'true' : undefined}
    >
      {/* 1 — light pools (untouched geometry) */}
      <div className="garden-ambience__pools">
        <span className="garden-pool garden-pool--moss" />
        <span className="garden-pool garden-pool--gold" />
        <span className="garden-pool garden-pool--sage" />
        <span className="garden-pool garden-pool--clay" />
      </div>

      {/* 2 — celestial & atmospheric periods */}
      {isNightScene && (
        <>
          <div className="garden-moon" />
          <div className="garden-shooting-star" style={{ animationDelay: still ? undefined : '6s' }} />
          <div className="garden-ambience__stars">
            {NIGHT_STARS.map((s, i) => (
              <span
                key={i}
                className="garden-star"
                style={{
                  top: s.top,
                  left: s.left,
                  width: s.size,
                  height: s.size,
                  opacity: s.opacity,
                  animationDelay: still ? undefined : s.delay,
                  animationDuration: still ? undefined : s.duration,
                }}
              />
            ))}
          </div>
          <div className="garden-ambience__fireflies">
            {FIREFLIES.map((ff, i) => (
              <span
                key={i}
                className="garden-firefly"
                style={{
                  top: ff.top,
                  left: ff.left,
                  animationDelay: still ? undefined : ff.delay,
                  animationDuration: still ? undefined : ff.duration,
                  ['--ff-x' as string]: `${ff.driftX}px`,
                  ['--ff-y' as string]: `${ff.driftY}px`,
                }}
              />
            ))}
          </div>
        </>
      )}

      {isSunScene && (
        <div className="garden-ambience__sun-group">
          <div className="garden-sun-bloom" />
          <div className="garden-sun-rays" style={{ animationDuration: still ? undefined : '140s' }} />
          <div className="garden-sun-disc" />
        </div>
      )}

      {isAfternoonScene && (
        <div className="garden-ambience__clouds">
          {AFTERNOON_CLOUDS.map((c, i) => (
            <span
              key={i}
              className="garden-cloud"
              style={{
                top: c.top,
                width: c.width,
                height: c.height,
                animationDelay: still ? undefined : c.delay,
                animationDuration: still ? undefined : c.duration,
              }}
            />
          ))}
        </div>
      )}

      {isDuskScene && (
        <>
          <div className="garden-ambience__dusk-glow" />
          <div className="garden-ambience__stars">
            {DUSK_STARS.map((s, i) => (
              <span
                key={i}
                className="garden-star"
                style={{
                  top: s.top,
                  left: s.left,
                  width: s.size,
                  height: s.size,
                  opacity: s.opacity,
                  animationDelay: still ? undefined : s.delay,
                  animationDuration: still ? undefined : s.duration,
                }}
              />
            ))}
          </div>
        </>
      )}

      {/* 3 — botanical silhouettes framing the content column */}
      <svg
        className="garden-ambience__foliage garden-foliage--left"
        viewBox="0 0 220 420"
        preserveAspectRatio="xMinYMax meet"
      >
        <g fill="currentColor">
          <path d="M14 420 C10 330 26 250 58 190 C74 158 96 132 124 112 C112 152 96 190 74 224 C46 266 28 330 26 420 Z" />
          <path d="M30 420 C34 348 56 288 92 244 C112 220 136 200 162 188 C146 220 126 250 100 278 C68 314 50 358 46 420 Z" opacity="0.72" />
          <path d="M52 420 C58 366 78 322 108 292 C124 275 142 262 160 254 C146 278 130 300 112 322 C88 352 72 382 68 420 Z" opacity="0.5" />
          <path d="M8 250 C22 226 40 210 62 200 C50 220 36 238 18 252 Z" opacity="0.6" />
          <path d="M70 160 C82 140 98 126 118 118 C106 136 92 152 76 164 Z" opacity="0.45" />
        </g>
      </svg>

      <svg
        className="garden-ambience__foliage garden-foliage--right"
        viewBox="0 0 220 420"
        preserveAspectRatio="xMaxYMax meet"
      >
        <g fill="currentColor">
          <path d="M206 420 C210 336 196 258 166 198 C150 166 130 140 104 120 C116 160 130 196 152 230 C178 270 194 334 194 420 Z" />
          <path d="M190 420 C186 352 166 292 132 248 C112 224 90 204 66 192 C82 224 100 252 126 280 C156 316 172 360 174 420 Z" opacity="0.72" />
          <path d="M168 420 C162 368 144 326 116 296 C100 280 82 266 64 258 C78 282 92 304 110 326 C132 356 148 384 152 420 Z" opacity="0.5" />
          <path d="M212 254 C198 230 180 214 158 204 C170 224 184 242 202 256 Z" opacity="0.6" />
          <path d="M150 164 C138 144 122 130 102 122 C114 140 128 156 144 168 Z" opacity="0.45" />
        </g>
      </svg>

      {/* 4 — drifting motes */}
      <div className="garden-ambience__motes">
        {motes.map((m, i) => (
          <span
            key={i}
            className="garden-mote"
            style={{
              left: m.left,
              width: m.size,
              height: m.size,
              opacity: m.opacity,
              animationDelay: still ? undefined : `${m.delay}s`,
              animationDuration: still ? undefined : `${m.duration}s`,
              ['--drift' as string]: `${m.drift}px`,
            }}
          />
        ))}
      </div>

      {/* 5 — vignette to hold the centre column */}
      <div className="garden-ambience__vignette" />
    </div>
  );
});

export default GardenAmbience;
