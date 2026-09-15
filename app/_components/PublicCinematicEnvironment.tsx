"use client";

import { useEffect, useRef } from "react";

const vertexShader = `#version 300 es
precision highp float;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const fragmentShader = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uPointer;
out vec4 outColor;

float hash21(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  float a = hash21(i), b = hash21(i+vec2(1,0));
  float c = hash21(i+vec2(0,1)), d = hash21(i+vec2(1,1));
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}

float fbm(vec2 p){
  float v=0.0, a=0.5;
  mat2 r=mat2(.82,-.57,.57,.82);
  for(int i=0;i<4;i++){
    v += a*noise(p);
    p = r*p*2.03 + 7.4;
    a *= .5;
  }
  return v;
}

float ring(vec2 p, float r, float w){
  return exp(-abs(length(p)-r)/w);
}

void main(){
  vec2 res=max(uResolution,vec2(1.));
  vec2 uv=(gl_FragCoord.xy*2.-res.xy)/res.y;
  float t=uTime;
  vec2 pointer=vec2(uPointer.x*res.x/res.y,uPointer.y);

  vec3 col=mix(vec3(.006,.011,.016),vec3(.012,.024,.036),clamp(.5+.35*uv.y+.12*uv.x,0.,1.));

  vec2 q=vec2(fbm(uv*1.2+vec2(t*.018,0.)),fbm(uv*1.35+vec2(5.2,-t*.014)));
  float warp=fbm(uv*2.1+q*2.2+vec2(0.,t*.012));

  float goldRibbon=exp(-abs(uv.y+.42+sin(uv.x*2.0+t*.09+warp*3.0)*.08)*13.0);
  float steelRibbon=exp(-abs(uv.y-.38+sin(uv.x*1.7-t*.075+q.y*2.8)*.07)*14.0);
  col += vec3(.95,.68,.22)*goldRibbon*.055;
  col += vec3(.12,.38,.68)*steelRibbon*.060;

  vec2 lp=uv-vec2(-1.35,.16)-pointer*.035;
  vec2 rp=uv-vec2(1.42,-.18)+pointer*.03;
  float leftRing=ring(lp,.60,.018)+ring(lp,.66,.009)*.55;
  float rightRing=ring(rp,.52,.016)+ring(rp,.58,.008)*.5;
  col += vec3(.88,.63,.19)*leftRing*.11;
  col += vec3(.18,.44,.72)*rightRing*.105;

  float beamL=exp(-abs(uv.y+uv.x*.14+.08)*4.8)*(1.-smoothstep(-1.8,-.18,uv.x));
  float beamR=exp(-abs(uv.y+uv.x*.10-.12)*5.0)*smoothstep(.18,1.8,uv.x);
  col += vec3(.75,.51,.13)*beamL*.033;
  col += vec3(.08,.28,.52)*beamR*.04;

  float glint=pow(1.-abs(sin((warp+q.x*.7)*18.+t*.17)),8.);
  col += mix(vec3(.18,.38,.60),vec3(.78,.58,.20),q.y)*glint*.022;

  vec2 cells=uv*vec2(52.,30.)+vec2(t*.018,-t*.012);
  vec2 id=floor(cells), f=fract(cells)-.5;
  float h=hash21(id);
  float dust=smoothstep(.055,0.,length(f))*step(.987,h);
  col += vec3(.92,.86,.66)*dust*(.35+.65*sin(t*(.7+h)+h*12.)*.5+.5)*.10;

  float vignette=smoothstep(1.55,.15,length(uv*vec2(.78,1.0)));
  col *= .68+.32*vignette;

  col=col/(col+vec3(1.0));
  outColor=vec4(col,1.0);
}`;

export function PublicCinematicEnvironment() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });

    if (!gl) {
      root.dataset.renderer = "fallback";
      return;
    }

    const compile = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compile(gl.VERTEX_SHADER, vertexShader);
    const fs = compile(gl.FRAGMENT_SHADER, fragmentShader);
    if (!vs || !fs) {
      root.dataset.renderer = "fallback";
      return;
    }

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      root.dataset.renderer = "fallback";
      gl.deleteProgram(program);
      return;
    }

    const uResolution = gl.getUniformLocation(program, "uResolution");
    const uTime = gl.getUniformLocation(program, "uTime");
    const uPointer = gl.getUniformLocation(program, "uPointer");
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

    const onPointerMove = (event: PointerEvent) => {
      pointer.tx = (event.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
      pointer.ty = 1 - (event.clientY / Math.max(window.innerHeight, 1)) * 2;
    };

    const onPointerLeave = () => {
      pointer.tx = 0;
      pointer.ty = 0;
    };

    const resize = () => {
      const mobile = window.innerWidth < 760;
      const dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.15 : 1.45);
      const width = Math.max(1, Math.floor(window.innerWidth * dpr));
      const height = Math.max(1, Math.floor(window.innerHeight * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
    };

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onPointerLeave);

    gl.useProgram(program);
    root.dataset.renderer = "webgl";
    const started = performance.now();
    let frame = 0;

    const render = (now: number) => {
      pointer.x += (pointer.tx - pointer.x) * 0.045;
      pointer.y += (pointer.ty - pointer.y) * 0.045;
      root.style.setProperty("--public-px", pointer.x.toFixed(4));
      root.style.setProperty("--public-py", pointer.y.toFixed(4));
      gl.useProgram(program);
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uTime, reduced ? 7.5 : (now - started) / 1000);
      gl.uniform2f(uPointer, pointer.x, pointer.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduced) frame = requestAnimationFrame(render);
    };

    frame = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      gl.deleteProgram(program);
    };
  }, []);

  return (
    <div className="public-cinematic-environment" ref={rootRef} aria-hidden="true">
      <canvas className="public-cinematic-environment__canvas" ref={canvasRef} />
      <div className="public-cinematic-environment__crest public-cinematic-environment__crest--left" />
      <div className="public-cinematic-environment__crest public-cinematic-environment__crest--right" />
      <div className="public-cinematic-environment__prism" />
      <div className="public-cinematic-environment__grain" />
      <div className="public-cinematic-environment__vignette" />
    </div>
  );
}
