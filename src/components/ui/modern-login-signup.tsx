import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Modern login backdrop — the animated dot-grid field behind the Sanctuary
 * gate. A port of the 21st.dev "modern-login-signup" component (originally a
 * THREE.ShaderMaterial over a fullscreen quad): the fragment shader is kept
 * byte-for-byte except for the palette, and the three.js renderer shell is
 * replaced by ~40 lines of raw WebGL2. Same look, no CDN script tag (which
 * would break offline), no 600 KB three dependency in the graph.
 *
 * The dots bloom outward from the centre on load, then shimmer — that intro
 * ripple IS the component's signature, so the uniforms that drive it
 * (u_total_size, u_dot_size, timing constants) are left exactly as upstream.
 * Only u_colors changes: white-on-black became the garden palette, so the
 * field reads as sunlight flecks over the cream ground instead of stars.
 */

export type ModernLoginSignupVariant = 'day' | 'night';

interface ModernLoginSignupProps {
  variant?: ModernLoginSignupVariant;
  className?: string;
}

/** Garden palette, day: logo greens + moss tokens + one harvest-gold accent. */
const DAY_COLORS = [
  0.114, 0.337, 0.263, // #1D5643 deep pine (app-icon ground)
  0.247, 0.627, 0.373, // #3FA05F leaf (app-icon gradient)
  0.353, 0.49, 0.353, //  #5A7D5A moss token
  0.608, 0.871, 0.545, // #9BDE8B pale leaf (app-icon gradient)
  0.18, 0.29, 0.204, //   #2E4A34 sanctuary green
  0.831, 0.659, 0.263, // #D4A843 harvest gold token
];

/** Night: the same greens, re-brightened the way tokens.css brightens moss. */
const NIGHT_COLORS = [
  0.561, 0.71, 0.561, //  #8FB58F moss-light
  0.659, 0.788, 0.659, // #A8C9A8 dawn-gradient green
  0.353, 0.62, 0.353, //  #5A9E5A thriving green
  0.773, 0.82, 0.749, //  #C5D1BF sage-light
  0.427, 0.549, 0.427, // #6D8C6D mid moss
  0.91, 0.788, 0.478, //  #E8C97A gold-light
];

const OPACITIES = [0.3, 0.3, 0.3, 0.5, 0.5, 0.5, 0.8, 0.8, 0.8, 1.0];

const VERT = `#version 300 es
// u_resolution is shared with the fragment stage, which runs mediump — the
// precision must match or strict linkers (ANGLE) reject the program.
precision mediump float;
in vec2 aPos;
uniform vec2 u_resolution;
out vec2 fragCoord;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
  fragCoord = (aPos.xy + 1.0) * 0.5 * u_resolution;
  fragCoord.y = u_resolution.y - fragCoord.y;
}`;

const FRAG = `#version 300 es
precision mediump float;
in vec2 fragCoord;

uniform float u_time;
uniform float u_opacities[10];
uniform vec3 u_colors[6];
uniform float u_total_size;
uniform float u_dot_size;
uniform vec2 u_resolution;

out vec4 fragColor;

float PHI = 1.61803398874989484820459;
float random(vec2 xy) {
    return fract(tan(distance(xy * PHI, xy) * 0.5) * xy.x);
}

void main() {
    vec2 st = fragCoord.xy;
    st.x -= abs(floor((mod(u_resolution.x, u_total_size) - u_dot_size) * 0.5));
    st.y -= abs(floor((mod(u_resolution.y, u_total_size) - u_dot_size) * 0.5));

    float opacity = step(0.0, st.x) * step(0.0, st.y);

    vec2 st2 = vec2(int(st.x / u_total_size), int(st.y / u_total_size));

    float frequency = 5.0;
    float show_offset = random(st2);
    float rand = random(st2 * floor((u_time / frequency) + show_offset + frequency));
    opacity *= u_opacities[int(rand * 10.0)];
    opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.x / u_total_size));
    opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.y / u_total_size));

    vec3 color = u_colors[int(show_offset * 6.0)];

    float animation_speed_factor = 3.0;
    vec2 center_grid = u_resolution / 2.0 / u_total_size;
    float dist_from_center = distance(center_grid, st2);

    float timing_offset_intro = dist_from_center * 0.01 + (random(st2) * 0.15);

    float current_timing_offset = timing_offset_intro;
    opacity *= step(current_timing_offset, u_time * animation_speed_factor);
    opacity *= clamp((1.0 - step(current_timing_offset + 0.1, u_time * animation_speed_factor)) * 1.25, 1.0, 1.25);

    fragColor = vec4(color, opacity);
    fragColor.rgb *= fragColor.a;
}`;

// The centre wash seats the card the way the original's dark vignette did —
// light ground in day, night ground in night — so dots soften behind the
// glass instead of buzzing through it.
const WASH: Record<ModernLoginSignupVariant, string> = {
  day: 'radial-gradient(ellipse 90% 72% at 50% 44%, rgba(237,232,223,0.65) 0%, rgba(237,232,223,0.22) 48%, rgba(237,232,223,0) 78%)',
  night: 'radial-gradient(ellipse 90% 72% at 50% 44%, rgba(15,20,25,0.78) 0%, rgba(15,20,25,0.28) 48%, rgba(15,20,25,0) 78%)',
};

export default function ModernLoginSignup({ variant = 'day', className }: ModernLoginSignupProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // The GL state lives inside the mount effect; this ref is the only bridge
  // the theme-flip effect has to it.
  const setColorsRef = useRef<(v: ModernLoginSignupVariant) => void>(() => {});
  const variantRef = useRef(variant);
  variantRef.current = variant;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let gl: WebGL2RenderingContext | null = null;
    try {
      gl = canvas.getContext('webgl2', { alpha: true, antialias: false }) as WebGL2RenderingContext | null;
    } catch {
      return;
    }
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh) || 'shader');
      return sh;
    };

    let program: WebGLProgram;
    try {
      program = gl.createProgram()!;
      gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) || 'link');
    } catch (err) {
      // The CSS ground and wash still render; but a shader regression must not
      // vanish into a silent blank field.
      console.error('[modern-login-signup] field disabled:', err);
      return;
    }
    gl.useProgram(program);

    // One fullscreen triangle; the vertex shader derives fragCoord from clip
    // space, so no attribute buffer beyond this is ever needed.
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    // The shader premultiplies its own output, so standard premultiplied-alpha
    // compositing puts each dot at its opacity straight over the page ground.
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    const U = (name: string) => gl.getUniformLocation(program, name);
    gl.uniform1fv(U('u_opacities'), new Float32Array(OPACITIES));
    gl.uniform1f(U('u_total_size'), 20.0);
    gl.uniform1f(U('u_dot_size'), 6.0);
    const colorsLoc = U('u_colors');
    const resolutionLoc = U('u_resolution');
    const timeLoc = U('u_time');

    const setColors = (v: ModernLoginSignupVariant) => {
      gl.uniform3fv(colorsLoc, new Float32Array(v === 'night' ? NIGHT_COLORS : DAY_COLORS));
    };
    setColors(variantRef.current);
    setColorsRef.current = setColors;

    // u_resolution stays in a 2x CSS space (as upstream): dot density is then
    // independent of device pixel ratio, while the backing store stays crisp.
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(resolutionLoc, canvas.clientWidth * 2, canvas.clientHeight * 2);
    };

    const draw = (t: number) => {
      gl.uniform1f(timeLoc, t);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0;
    let simTime = 0;
    let last = performance.now();
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      simTime += Math.min(0.1, (now - last) / 1000);
      last = now;
      draw(simTime);
    };

    resize();
    if (reduced) {
      // One settled frame: past the intro ripple, full field, no motion.
      draw(6.0);
    } else {
      raf = requestAnimationFrame(frame);
    }

    const onResize = () => {
      resize();
      if (reduced) draw(6.0);
    };
    window.addEventListener('resize', onResize);
    // The tab losing visibility must not bank a giant dt on return — dt is
    // capped in the loop, but pausing outright keeps the GPU idle too.
    const onVisibility = () => {
      if (reduced) return;
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      // No loseContext here: StrictMode re-runs this effect on the same
      // canvas, and getContext hands back the one context the element will
      // ever have — losing it kills the remount too. The canvas (and with it
      // the context) is garbage-collected with the component.
    };
  }, []);

  // Theme flips update the palette in place — no context rebuild, no flash.
  useEffect(() => {
    setColorsRef.current(variant);
  }, [variant]);

  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 transition-colors duration-500" style={{ background: WASH[variant] }} />
    </div>
  );
}
