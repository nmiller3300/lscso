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

const float PI = 3.141592653589793;

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
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = r * p * 2.02 + 11.9;
    a *= 0.5;
  }
  return v;
}

mat2 rot(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}

float sdStarExtruded(vec3 p, float points, float outerR, float innerR, float halfDepth) {
  float sector = (PI * 2.0) / points;
  float a = atan(p.y, p.x);
  float local = abs(mod(a + sector * 0.5, sector) - sector * 0.5) / (sector * 0.5);
  float edge = smoothstep(0.0, 1.0, local);
  float radius = mix(outerR, innerR, edge);
  float side = length(p.xy) - radius;
  vec2 q = vec2(side, abs(p.z) - halfDepth);
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - 0.018;
}

float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xy) - t.x, p.z);
  return length(q) - t.y;
}

float sdRoundBox(vec3 p, vec3 b, float r) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0) - r;
}

vec2 mapScene(vec3 p, float t) {
  vec2 best = vec2(100.0, 0.0);

  vec3 leftStar = p - vec3(-1.63, 0.12, 0.08);
  leftStar.xz = rot(-0.74 + sin(t * 0.16) * 0.05) * leftStar.xz;
  leftStar.yz = rot(0.28 + cos(t * 0.12) * 0.035) * leftStar.yz;
  leftStar.xy = rot(-0.11 + sin(t * 0.11) * 0.02) * leftStar.xy;
  float dStar = sdStarExtruded(leftStar, 7.0, 0.92, 0.39, 0.085);
  if (dStar < best.x) best = vec2(dStar, 1.0);

  vec3 leftCore = leftStar;
  float dCore = sdTorus(leftCore * vec3(1.0, 1.0, 1.45), vec2(0.33, 0.034));
  if (dCore < best.x) best = vec2(dCore, 2.0);

  vec3 rightRing = p - vec3(1.69, -0.27, 0.0);
  rightRing.xz = rot(0.66 + sin(t * 0.13) * 0.05) * rightRing.xz;
  rightRing.yz = rot(-0.24 + cos(t * 0.1) * 0.04) * rightRing.yz;
  rightRing.xy = rot(0.18 + t * 0.025) * rightRing.xy;
  float dRing = sdTorus(rightRing, vec2(0.58, 0.048));
  if (dRing < best.x) best = vec2(dRing, 3.0);

  vec3 rightStar = rightRing;
  rightStar.z += 0.045;
  float dSmallStar = sdStarExtruded(rightStar, 7.0, 0.46, 0.19, 0.052);
  if (dSmallStar < best.x) best = vec2(dSmallStar, 4.0);

  vec3 shardA = p - vec3(-1.05, -0.72, 0.34);
  shardA.xy = rot(-0.5 + t * 0.03) * shardA.xy;
  shardA.xz = rot(0.9) * shardA.xz;
  float dShardA = sdRoundBox(shardA, vec3(0.055, 0.42, 0.018), 0.026);
  if (dShardA < best.x) best = vec2(dShardA, 5.0);

  vec3 shardB = p - vec3(1.12, 0.74, 0.18);
  shardB.xy = rot(0.72 - t * 0.022) * shardB.xy;
  shardB.xz = rot(-0.62) * shardB.xz;
  float dShardB = sdRoundBox(shardB, vec3(0.045, 0.32, 0.015), 0.022);
  if (dShardB < best.x) best = vec2(dShardB, 5.0);

  return best;
}

vec2 raymarch(vec3 ro, vec3 rd, float t) {
  float travel = 0.0;
  float id = 0.0;
  for (int i = 0; i < 68; i++) {
    vec2 hit = mapScene(ro + rd * travel, t);
    if (hit.x < 0.0018) {
      id = hit.y;
      break;
    }
    travel += hit.x * 0.76;
    if (travel > 8.0) break;
  }
  if (travel > 8.0) id = 0.0;
  return vec2(travel, id);
}

vec3 normalAt(vec3 p, float t) {
  vec2 e = vec2(0.0016, 0.0);
  float d = mapScene(p, t).x;
  return normalize(vec3(
    mapScene(p + e.xyy, t).x - d,
    mapScene(p + e.yxy, t).x - d,
    mapScene(p + e.yyx, t).x - d
  ));
}

vec3 backgroundField(vec2 uv, float t, vec2 pointer) {
  vec2 q = vec2(
    fbm(uv * 1.25 + vec2(0.0, t * 0.035)),
    fbm(uv * 1.25 + vec2(4.8, -t * 0.028))
  );
  float warp = fbm(uv * 2.15 + q * 2.7 + vec2(t * 0.018, 0.0));
  float center = length(uv * vec2(0.82, 1.0));
  float activity = smoothstep(0.28, 0.72, center);

  vec3 col = mix(vec3(0.012, 0.020, 0.030), vec3(0.032, 0.049, 0.068), smoothstep(-0.9, 1.0, uv.x + uv.y * 0.28));

  float goldRibbon = exp(-abs(uv.y + 0.38 + sin(uv.x * 2.3 + t * 0.12 + warp * 3.3) * 0.075) * 15.0);
  float blueRibbon = exp(-abs(uv.y - 0.36 + sin(uv.x * 2.0 - t * 0.095 + q.y * 3.1) * 0.065) * 16.0);
  col += vec3(0.92, 0.68, 0.24) * goldRibbon * 0.105 * activity;
  col += vec3(0.10, 0.32, 0.58) * blueRibbon * 0.11 * activity;

  float caustic = pow(1.0 - abs(sin((warp + q.x * 0.7) * 18.0 + t * 0.23)), 7.0);
  col += mix(vec3(0.13, 0.31, 0.49), vec3(0.78, 0.57, 0.21), q.y) * caustic * 0.055 * activity;

  float leftBeam = (1.0 - smoothstep(-1.75, -0.22, uv.x)) * exp(-abs(uv.y + uv.x * 0.17 + 0.12) * 4.4);
  float rightBeam = smoothstep(0.22, 1.75, uv.x) * exp(-abs(uv.y + uv.x * 0.11 - 0.08) * 4.8);
  col += vec3(0.55, 0.39, 0.11) * leftBeam * 0.05;
  col += vec3(0.08, 0.24, 0.43) * rightBeam * 0.055;

  float pointerGlow = exp(-length(uv - pointer * 0.32) * 3.6) * 0.03;
  col += mix(vec3(0.75, 0.53, 0.18), vec3(0.16, 0.42, 0.68), 0.5 + 0.5 * sin(t * 0.22)) * pointerGlow;

  vec2 cells = uv * vec2(58.0, 34.0) + vec2(t * 0.025, -t * 0.016);
  vec2 cid = floor(cells);
  vec2 cf = fract(cells) - 0.5;
  float h = hash21(cid);
  float dust = smoothstep(0.07, 0.0, length(cf)) * step(0.982, h);
  float twinkle = 0.45 + 0.55 * sin(t * (0.8 + h * 1.6) + h * 18.0);
  col += vec3(0.94, 0.88, 0.67) * dust * twinkle * 0.18 * activity;

  return col;
}

vec3 shadeSurface(vec3 p, vec3 rd, float id, float t) {
  vec3 n = normalAt(p, t);
  vec3 v = normalize(-rd);

  vec3 goldBase = vec3(0.54, 0.34, 0.09);
  vec3 paleGold = vec3(1.0, 0.82, 0.38);
  vec3 steelBase = vec3(0.12, 0.20, 0.29);
  vec3 ice = vec3(0.34, 0.59, 0.82);

  vec3 base = goldBase;
  float metallic = 0.95;
  float roughness = 0.18;

  if (id > 2.5 && id < 4.5) {
    base = mix(steelBase, vec3(0.34, 0.38, 0.43), 0.36);
    roughness = 0.14;
  }
  if (id > 4.5) {
    base = vec3(0.08, 0.18, 0.28);
    metallic = 0.78;
    roughness = 0.08;
  }

  vec3 lGold = normalize(vec3(-0.75, 0.88, 0.64));
  vec3 lBlue = normalize(vec3(0.92, -0.18, 0.58));
  float diffGold = max(dot(n, lGold), 0.0);
  float diffBlue = max(dot(n, lBlue), 0.0);

  vec3 hGold = normalize(lGold + v);
  vec3 hBlue = normalize(lBlue + v);
  float specPower = mix(120.0, 38.0, roughness);
  float specGold = pow(max(dot(n, hGold), 0.0), specPower);
  float specBlue = pow(max(dot(n, hBlue), 0.0), specPower);

  float fresnel = pow(1.0 - max(dot(n, v), 0.0), 4.0);
  vec3 reflected = reflect(rd, n);
  float envMix = 0.5 + 0.5 * reflected.y;
  vec3 env = mix(vec3(0.06, 0.12, 0.20), vec3(0.62, 0.44, 0.16), envMix);

  vec3 col = base * (0.12 + diffGold * 0.48 + diffBlue * 0.22);
  col += paleGold * specGold * 1.7;
  col += ice * specBlue * 1.25;
  col += env * fresnel * (0.7 + metallic * 0.7);

  if (id > 4.5) {
    col += mix(ice, paleGold, 0.35) * fresnel * 0.8;
  }

  float rim = pow(1.0 - abs(dot(n, v)), 2.0);
  col += mix(paleGold, ice, step(2.5, id)) * rim * 0.18;
  return col;
}

vec3 aces(vec3 x) {
  return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}

void main() {
  vec2 res = max(uResolution, vec2(1.0));
  vec2 uv = (gl_FragCoord.xy * 2.0 - res.xy) / res.y;
  float t = uTime;
  vec2 pointer = vec2(uPointer.x * res.x / res.y, uPointer.y);

  vec3 col = backgroundField(uv, t, pointer);

  if (abs(uv.x) > 0.43) {
    vec3 ro = vec3(pointer.x * 0.045, pointer.y * 0.035, 4.25);
    vec3 target = vec3(pointer.x * 0.06, pointer.y * 0.04, 0.0);
    vec3 forward = normalize(target - ro);
    vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, forward);
    vec3 rd = normalize(forward + uv.x * right * 0.82 + uv.y * up * 0.82);

    vec2 hit = raymarch(ro, rd, t);
    if (hit.y > 0.5) {
      vec3 p = ro + rd * hit.x;
      vec3 shaded = shadeSurface(p, rd, hit.y, t);
      float fog = exp(-hit.x * 0.095);
      float edgeMask = smoothstep(0.42, 0.78, abs(uv.x));
      col = mix(col, shaded, fog * edgeMask * 0.94);
    }
  }

  float edgeGlowL = exp(-abs(uv.x + 1.22) * 2.7) * 0.05;
  float edgeGlowR = exp(-abs(uv.x - 1.22) * 2.7) * 0.05;
  col += vec3(0.93, 0.69, 0.27) * edgeGlowL;
  col += vec3(0.18, 0.42, 0.68) * edgeGlowR;

  float vignette = smoothstep(1.6, 0.35, length(uv * vec2(0.72, 1.0)));
  col *= mix(0.52, 1.0, vignette);

  float grain = hash21(gl_FragCoord.xy + fract(t * 0.73) * 147.0) - 0.5;
  col += grain * 0.012;

  col = aces(col * 1.18);
  col = pow(col, vec3(0.4545));
  outColor = vec4(col, 1.0);
}
`;

function createShader(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.warn("Portal background shader failed to compile", gl.getShaderInfoLog(shader));
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

    const desktop = window.matchMedia("(min-width: 981px)");
    if (!desktop.matches) {
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

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vertexShader || !fragmentShader) {
      root.dataset.renderer = "fallback";
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      root.dataset.renderer = "fallback";
      return;
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.warn("Portal background program failed to link", gl.getProgramInfoLog(program));
      root.dataset.renderer = "fallback";
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
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

    root.dataset.renderer = "raymarch";
    gl.useProgram(program);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const quality = rect.width >= 1800 ? 0.78 : rect.width >= 1400 ? 0.86 : 0.92;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.15) * quality;
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
      pointer.x += (pointer.tx - pointer.x) * 0.038;
      pointer.y += (pointer.ty - pointer.y) * 0.038;
      pointer.energy += (pointer.targetEnergy - pointer.energy) * 0.04;

      gl.useProgram(program);
      gl.uniform2f(resolutionLocation, width, height);
      gl.uniform1f(timeLocation, reducedMotion.matches ? 0.0 : now * 0.001);
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
