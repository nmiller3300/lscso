"use client";

import { useEffect, useRef } from "react";

const vertexShaderSource = `#version 300 es
precision highp float;

void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

const fragmentShaderSource = `#version 300 es
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uPointer;
uniform float uEnergy;
out vec4 outColor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
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
  float value = 0.0;
  float amp = 0.5;
  mat2 rot = mat2(0.82, -0.57, 0.57, 0.82);
  for (int i = 0; i < 5; i++) {
    value += amp * noise(p);
    p = rot * p * 2.03 + 11.7;
    amp *= 0.5;
  }
  return value;
}

float lineField(vec2 uv, float phase, float bend) {
  float n = fbm(uv * 1.55 + phase);
  float wave = uv.y + sin(uv.x * 2.25 + phase + n * 3.2) * bend;
  return exp(-abs(wave) * 8.0);
}

void main() {
  vec2 res = max(uResolution, vec2(1.0));
  vec2 uv = (gl_FragCoord.xy - 0.5 * res.xy) / res.y;
  vec2 pointer = vec2(uPointer.x * res.x / res.y, uPointer.y) * 0.48;
  float t = uTime * 0.075;

  vec2 q;
  q.x = fbm(uv * 1.35 + vec2(0.0, t));
  q.y = fbm(uv * 1.35 + vec2(5.2, -t * 0.72));

  vec2 r;
  r.x = fbm(uv * 1.9 + q * 2.35 + vec2(1.7, t * 0.48));
  r.y = fbm(uv * 1.9 + q * 2.15 + vec2(8.3, -t * 0.41));

  float warped = fbm(uv * 2.25 + r * 2.7);
  float distToPointer = length(uv - pointer);
  float ripple = sin(distToPointer * 24.0 - uTime * 1.9) * exp(-distToPointer * 5.7);
  warped += ripple * 0.055 * uEnergy;

  float centerDist = length(uv * vec2(0.9, 1.0));
  float calmCenter = 1.0 - smoothstep(0.18, 0.58, centerDist);
  float detailMask = mix(1.0, 0.32, calmCenter);

  float goldRibbon = lineField(uv + vec2(0.0, -0.34), t * 0.85 + warped, 0.11);
  float blueRibbon = lineField(vec2(uv.x, -uv.y) + vec2(0.0, -0.29), -t * 0.72 + warped * 1.2, 0.095);
  float fineRibbon = lineField(uv * 1.12 + vec2(0.0, 0.04), t * 0.38 + warped * 1.7, 0.052);

  float causticA = abs(sin((warped + q.x * 0.65) * 18.0 - t * 3.2));
  float causticB = abs(sin((warped + r.y * 0.75) * 13.0 + t * 2.6));
  float caustics = pow(max(0.0, 1.0 - min(causticA, causticB)), 5.5) * detailMask;

  vec3 baseA = vec3(0.020, 0.031, 0.046);
  vec3 baseB = vec3(0.055, 0.075, 0.100);
  vec3 color = mix(baseA, baseB, smoothstep(-0.9, 0.8, uv.x + uv.y * 0.32));

  vec3 gold = vec3(0.82, 0.64, 0.26);
  vec3 paleGold = vec3(0.98, 0.88, 0.53);
  vec3 steelBlue = vec3(0.16, 0.34, 0.53);
  vec3 iceBlue = vec3(0.38, 0.63, 0.82);

  color += gold * goldRibbon * 0.20 * detailMask;
  color += steelBlue * blueRibbon * 0.18 * detailMask;
  color += mix(gold, paleGold, warped) * fineRibbon * 0.075 * detailMask;
  color += mix(steelBlue, iceBlue, q.y) * caustics * 0.105;

  float pointerGlow = exp(-distToPointer * 3.5) * 0.055 * uEnergy;
  color += mix(gold, iceBlue, 0.5 + 0.5 * sin(t)) * pointerGlow;

  float edgeGold = exp(-abs(uv.x + 0.78) * 4.4) * 0.055;
  float edgeBlue = exp(-abs(uv.x - 0.82) * 4.8) * 0.05;
  color += gold * edgeGold;
  color += steelBlue * edgeBlue;

  float vignette = smoothstep(1.14, 0.22, length(uv * vec2(0.82, 1.05)));
  color *= mix(0.44, 1.0, vignette);

  float grain = hash21(gl_FragCoord.xy + fract(uTime) * 173.0) - 0.5;
  color += grain * 0.012;

  outColor = vec4(color, 1.0);
}
`;

function createShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function PortalCinematicBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const root = rootRef.current;
    if (!canvas || !root) return;

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

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vertexShader || !fragmentShader) {
      root.dataset.renderer = "fallback";
      return;
    }

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      root.dataset.renderer = "fallback";
      return;
    }

    const resolutionLocation = gl.getUniformLocation(program, "uResolution");
    const timeLocation = gl.getUniformLocation(program, "uTime");
    const pointerLocation = gl.getUniformLocation(program, "uPointer");
    const energyLocation = gl.getUniformLocation(program, "uEnergy");

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointer = { x: 0, y: 0, tx: 0, ty: 0, energy: 0.35, targetEnergy: 0.35 };
    let frame = 0;
    let width = 1;
    let height = 1;
    let hidden = document.hidden;

    root.dataset.renderer = "webgl";
    gl.useProgram(program);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.35);
      width = Math.max(1, Math.floor(rect.width * dpr));
      height = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
    };

    const render = (now: number) => {
      resize();
      pointer.x += (pointer.tx - pointer.x) * 0.045;
      pointer.y += (pointer.ty - pointer.y) * 0.045;
      pointer.energy += (pointer.targetEnergy - pointer.energy) * 0.04;

      gl.useProgram(program);
      gl.uniform2f(resolutionLocation, width, height);
      gl.uniform1f(timeLocation, now * 0.001);
      gl.uniform2f(pointerLocation, pointer.x, pointer.y);
      gl.uniform1f(energyLocation, reducedMotion.matches ? 0.0 : pointer.energy);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (!reducedMotion.matches && !hidden) frame = window.requestAnimationFrame(render);
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer.tx = (event.clientX / Math.max(window.innerWidth, 1) - 0.5) * 2;
      pointer.ty = -((event.clientY / Math.max(window.innerHeight, 1) - 0.5) * 2);
      pointer.targetEnergy = 1;
      root.style.setProperty("--portal-px", pointer.tx.toFixed(3));
      root.style.setProperty("--portal-py", pointer.ty.toFixed(3));
    };

    const onPointerLeave = () => {
      pointer.tx = 0;
      pointer.ty = 0;
      pointer.targetEnergy = 0.35;
      root.style.setProperty("--portal-px", "0");
      root.style.setProperty("--portal-py", "0");
    };

    const onVisibility = () => {
      hidden = document.hidden;
      window.cancelAnimationFrame(frame);
      if (!hidden) render(performance.now());
    };

    const onMotionChange = () => {
      window.cancelAnimationFrame(frame);
      render(performance.now());
    };

    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    reducedMotion.addEventListener("change", onMotionChange);

    render(performance.now());

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      reducedMotion.removeEventListener("change", onMotionChange);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, []);

  return (
    <div ref={rootRef} className="portal-cinematic-backdrop" aria-hidden="true">
      <canvas ref={canvasRef} className="portal-cinematic-backdrop__canvas" />
      <div className="portal-cinematic-backdrop__crest portal-cinematic-backdrop__crest--left" />
      <div className="portal-cinematic-backdrop__crest portal-cinematic-backdrop__crest--right" />
      <div className="portal-cinematic-backdrop__prism" />
      <div className="portal-cinematic-backdrop__sheen" />
    </div>
  );
}
