"use client";

import { useEffect, useRef } from "react";

const vertexShader = `#version 300 es
precision highp float;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

const fragmentShader = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uPointer;
uniform float uEnergy;
out vec4 outColor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  mat2 r = mat2(0.84, -0.54, 0.54, 0.84);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = r * p * 2.03 + 9.7;
    a *= 0.5;
  }
  return v;
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec2 res = max(uResolution, vec2(1.0));
  vec2 uv = (gl_FragCoord.xy * 2.0 - res.xy) / res.y;
  float aspect = res.x / res.y;
  float t = uTime;
  vec2 pointer = vec2(uPointer.x * aspect, uPointer.y);

  vec2 q = vec2(
    fbm(uv * 1.15 + vec2(t * 0.020, t * 0.034)),
    fbm(uv * 1.22 + vec2(5.1 - t * 0.025, -t * 0.018))
  );
  float warp = fbm(uv * 2.0 + q * 2.9 + vec2(t * 0.014, -t * 0.012));

  vec3 col = mix(
    vec3(0.008, 0.014, 0.022),
    vec3(0.025, 0.040, 0.057),
    smoothstep(-1.05, 1.05, uv.x + uv.y * 0.23)
  );

  float center = length(uv * vec2(0.82, 1.0));
  float edgeActivity = smoothstep(0.22, 0.74, center);
  float centerCalm = 1.0 - smoothstep(0.06, 0.50, center);

  float goldRibbon = exp(-abs(uv.y + 0.50 + sin(uv.x * 2.5 + t * 0.12 + warp * 3.4) * 0.075) * 14.0);
  float steelRibbon = exp(-abs(uv.y - 0.46 + sin(uv.x * 2.2 - t * 0.10 + q.y * 3.0) * 0.067) * 15.0);
  col += vec3(0.94, 0.69, 0.25) * goldRibbon * 0.12 * edgeActivity;
  col += vec3(0.12, 0.34, 0.60) * steelRibbon * 0.13 * edgeActivity;

  float caustic = pow(1.0 - abs(sin((warp + q.x * 0.72) * 18.0 + t * 0.26)), 7.0);
  vec3 causticTint = mix(vec3(0.10, 0.30, 0.52), vec3(0.82, 0.59, 0.20), q.y);
  col += causticTint * caustic * 0.070 * edgeActivity;

  vec2 p = uv - pointer * 0.14;
  float halo = exp(-length(p) * 2.35);
  col += mix(vec3(0.74, 0.52, 0.17), vec3(0.16, 0.40, 0.68), 0.48 + 0.18 * sin(t * 0.22)) * halo * 0.045;

  float leftArc = exp(-abs(length(uv - vec2(-0.56 * max(aspect, 0.62), 0.48)) - 0.42) * 24.0);
  float rightArc = exp(-abs(length(uv - vec2(0.58 * max(aspect, 0.62), -0.52)) - 0.38) * 26.0);
  col += vec3(0.95, 0.72, 0.30) * leftArc * 0.10 * edgeActivity;
  col += vec3(0.20, 0.48, 0.76) * rightArc * 0.10 * edgeActivity;

  float refraction = sin((uv.x + q.x * 0.18) * 18.0 - t * 0.16) * sin((uv.y + q.y * 0.18) * 16.0 + t * 0.13);
  col += mix(vec3(0.05, 0.14, 0.24), vec3(0.24, 0.17, 0.055), step(0.0, refraction)) * abs(refraction) * 0.022 * edgeActivity;

  vec2 cells = uv * vec2(42.0, 66.0) + vec2(t * 0.018, -t * 0.014);
  vec2 cid = floor(cells);
  vec2 cf = fract(cells) - 0.5;
  float h = hash21(cid);
  float dust = smoothstep(0.055, 0.0, length(cf)) * step(0.987, h);
  float twinkle = 0.45 + 0.55 * sin(t * (0.65 + h * 1.7) + h * 19.0);
  col += vec3(0.96, 0.90, 0.72) * dust * twinkle * 0.18 * edgeActivity;

  col *= 1.0 - centerCalm * 0.10;
  col += vec3(0.14, 0.105, 0.04) * centerCalm * 0.035;

  float pointerPulse = exp(-length(uv - pointer * 0.24) * 5.2) * uEnergy;
  col += vec3(0.18, 0.14, 0.07) * pointerPulse * 0.035;

  float vignette = smoothstep(1.45, 0.28, length(uv * vec2(0.82, 1.0)));
  col *= mix(0.48, 1.0, vignette);

  float grain = hash21(gl_FragCoord.xy + fract(t * 0.71) * 137.0) - 0.5;
  col += grain * 0.011;

  col = aces(col * 1.22);
  col = pow(col, vec3(0.4545));
  outColor = vec4(col, 1.0);
}
`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("Responsive portal shader failed to compile", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function PortalResponsiveCinematicBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;

    const compact = window.matchMedia("(max-width: 980px)");
    if (!compact.matches) {
      root.dataset.renderer = "disabled";
      return;
    }

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
    });

    if (!gl) {
      root.dataset.renderer = "fallback";
      return;
    }

    const vs = compile(gl, gl.VERTEX_SHADER, vertexShader);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentShader);
    if (!vs || !fs) {
      root.dataset.renderer = "fallback";
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      root.dataset.renderer = "fallback";
      return;
    }

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("Responsive portal shader failed to link", gl.getProgramInfoLog(program));
      root.dataset.renderer = "fallback";
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return;
    }

    const resolution = gl.getUniformLocation(program, "uResolution");
    const time = gl.getUniformLocation(program, "uTime");
    const pointerLocation = gl.getUniformLocation(program, "uPointer");
    const energy = gl.getUniformLocation(program, "uEnergy");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const pointer = { x: 0, y: 0, tx: 0, ty: 0, energy: 0.24, targetEnergy: 0.24 };
    let frame = 0;
    let lastFrame = 0;
    let hidden = document.hidden;
    let width = 1;
    let height = 1;

    root.dataset.renderer = "webgl";
    gl.useProgram(program);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const shortest = Math.min(rect.width, rect.height);
      const scale = shortest < 430 ? 0.66 : shortest < 700 ? 0.76 : 0.84;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.2) * scale;
      width = Math.max(1, Math.floor(rect.width * dpr));
      height = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
    };

    const draw = (now: number) => {
      const fps = window.innerWidth <= 620 ? 30 : 42;
      const interval = 1000 / fps;
      if (!reducedMotion.matches && now - lastFrame < interval) {
        frame = window.requestAnimationFrame(draw);
        return;
      }
      lastFrame = now;
      resize();
      pointer.x += (pointer.tx - pointer.x) * 0.045;
      pointer.y += (pointer.ty - pointer.y) * 0.045;
      pointer.energy += (pointer.targetEnergy - pointer.energy) * 0.05;

      gl.useProgram(program);
      gl.uniform2f(resolution, width, height);
      gl.uniform1f(time, reducedMotion.matches ? 0 : now * 0.001);
      gl.uniform2f(pointerLocation, pointer.x, pointer.y);
      gl.uniform1f(energy, reducedMotion.matches ? 0 : pointer.energy);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (!reducedMotion.matches && !hidden) frame = window.requestAnimationFrame(draw);
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer.tx = (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2;
      pointer.ty = -((event.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2);
      pointer.targetEnergy = 0.8;
      root.style.setProperty("--portal-rx", pointer.tx.toFixed(3));
      root.style.setProperty("--portal-ry", pointer.ty.toFixed(3));
    };

    const onPointerEnd = () => {
      pointer.tx = 0;
      pointer.ty = 0;
      pointer.targetEnergy = 0.24;
      root.style.setProperty("--portal-rx", "0");
      root.style.setProperty("--portal-ry", "0");
    };

    const onVisibility = () => {
      hidden = document.hidden;
      window.cancelAnimationFrame(frame);
      if (!hidden) draw(performance.now());
    };

    const onMotion = () => {
      window.cancelAnimationFrame(frame);
      draw(performance.now());
    };

    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerup", onPointerEnd, { passive: true });
    window.addEventListener("pointercancel", onPointerEnd, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    reducedMotion.addEventListener("change", onMotion);

    draw(performance.now());

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerEnd);
      window.removeEventListener("pointercancel", onPointerEnd);
      document.removeEventListener("visibilitychange", onVisibility);
      reducedMotion.removeEventListener("change", onMotion);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return (
    <div ref={rootRef} className="portal-responsive-backdrop" aria-hidden="true">
      <canvas ref={canvasRef} className="portal-responsive-backdrop__canvas" />
      <div className="portal-responsive-backdrop__crest portal-responsive-backdrop__crest--left" />
      <div className="portal-responsive-backdrop__crest portal-responsive-backdrop__crest--right" />
      <div className="portal-responsive-backdrop__glass" />
      <div className="portal-responsive-backdrop__grain" />
    </div>
  );
}
