"use client";

import { useEffect, useRef } from "react";
import type { SeasonalSettings } from "@/lib/seasonal/config";

// Real time, pointer-reactive flowing light. One WebGL renderer, with a static
// gradient fallback for browsers that do not support WebGL2.
const vertex = `#version 300 es
precision highp float;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;
const fragment = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uTime;
uniform float uIntensity;
out vec4 outColor;
float hash(vec2 p) {
  p = fract(p * vec2(127.1, 311.7));
  p += dot(p, p + 34.7);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + 1.0), f.x), f.y);
}
float fbm(vec2 p) {
  float value = 0.0, amplitude = 0.5;
  mat2 rot = mat2(0.82,-0.57,0.57,0.82);
  for (int i=0; i<5; i++) {
    value += amplitude * noise(p);
    p = rot * p * 2.05 + 8.6;
    amplitude *= 0.5;
  }
  return value;
}
void main() {
  vec2 res = max(uResolution, vec2(1.0));
  vec2 uv = (gl_FragCoord.xy*2.0-res)/res.y;
  vec2 pointer = vec2(uPointer.x*res.x/res.y, uPointer.y);
  float t = uTime;
  // Advected fields ensure motion even without mouse input.
  vec2 flowA = vec2(fbm(uv * 1.22 + vec2(t*.085,-t*.057)),
                    fbm(uv * 1.28 + vec2(4.3-t*.072,2.9+t*.063)));
  float curlA = fbm(uv*2.15+flowA*3.7+pointer*.26+vec2(t*.06,-t*.04));
  float curlB = fbm(uv*2.9-flowA*2.6-pointer*.16+vec2(-t*.05,t*.075));
  vec2 warped = uv + vec2(curlA-.5,curlB-.5)*.39;
  vec3 midnight = vec3(.013,.005,.029);
  vec3 violet = vec3(.17,.042,.24);
  vec3 burnt = vec3(.32,.070,.017);
  float chamber = smoothstep(-1.8,.8,warped.x+flowA.x*.22);
  vec3 col = mix(midnight, mix(violet,burnt,smoothstep(.05,1.1,warped.x)), .32*chamber);
  float ribbonA = exp(-abs(warped.y - .22 + sin(warped.x*2.4 + t*.82 + curlA*4.4)*.14)*10.0);
  float ribbonB = exp(-abs(warped.y + .34 + sin(warped.x*2.3 - t*.68 + flowA.y*4.7)*.15)*11.0);
  float ribbonC = exp(-abs(warped.y - .07 + sin(warped.x*3.4-t*.48+curlB*4.5)*.09)*14.0);
  col += vec3(.38,.10,.62)*ribbonA*.39*uIntensity;
  col += vec3(.85,.22,.035)*ribbonB*.28*uIntensity;
  col += vec3(.30,.07,.43)*ribbonC*.20*uIntensity;
  float causticA = pow(1.0-abs(sin((curlA+flowA.x*.7)*19.0 + t*.96)),8.0);
  float causticB = pow(1.0-abs(sin((curlB-flowA.y*.55)*17.0 - t*.74)),9.0);
  col += mix(vec3(.50,.12,.75),vec3(.98,.34,.09),smoothstep(-.5,.85,warped.x)) * causticA*.12*uIntensity;
  col += vec3(.35,.11,.40) * causticB*.075*uIntensity;
  float lens = exp(-length(uv-pointer*.49)*2.1);
  col += mix(vec3(.38,.12,.72),vec3(.92,.29,.06),clamp(pointer.x*.5+.5,0.0,1.0))*lens*.07*uIntensity;
  // Slow eddies make the scene read as flowing liquid instead of a static gradient.
  float cloud = fbm(warped*1.32 + flowA*1.8 + vec2(t*.04,-t*.05));
  col += vec3(.18,.045,.25)*cloud*.16;
  col *= 1.0 - smoothstep(.72,1.84,length(uv*vec2(.69,1.0)))*.46;
  outColor = vec4(clamp(col,0.0,1.0),1.0);
}`;

export function SeasonalLiquidCanvas({ intensity = "high" }: { intensity?: SeasonalSettings["intensity"] }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", { antialias:false, alpha:false, powerPreference:"high-performance" });
    if (!gl) return;
    function shader(type:number, source:string) {
      const s=gl!.createShader(type);
      if(!s)return null;
      gl!.shaderSource(s,source); gl!.compileShader(s);
      if(!gl!.getShaderParameter(s,gl!.COMPILE_STATUS)){gl!.deleteShader(s);return null;}
      return s;
    }
    const vert=shader(gl.VERTEX_SHADER,vertex),frag=shader(gl.FRAGMENT_SHADER,fragment);
    if(!vert||!frag) { if(vert)gl.deleteShader(vert);if(frag)gl.deleteShader(frag);return; }
    const program=gl.createProgram();
    if(!program){gl.deleteShader(vert);gl.deleteShader(frag);return;}
    gl.attachShader(program,vert);gl.attachShader(program,frag);gl.linkProgram(program);
    if(!gl.getProgramParameter(program,gl.LINK_STATUS)){
      gl.deleteProgram(program);gl.deleteShader(vert);gl.deleteShader(frag);return;
    }
    const resolution=gl.getUniformLocation(program,"uResolution");
    const time=gl.getUniformLocation(program,"uTime");
    const pointer=gl.getUniformLocation(program,"uPointer");
    const strength=gl.getUniformLocation(program,"uIntensity");
    const strengthValue={low:.64,medium:.95,high:1.28}[intensity];
    const motion=window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame=0,last=0,hidden=document.hidden;
    const start=performance.now();
    const current={x:0,y:0,tx:0,ty:0};
    const onMove=(e:PointerEvent)=>{current.tx=(e.clientX/window.innerWidth)*2-1;current.ty=-((e.clientY/window.innerHeight)*2-1);};
    const onLeave=()=>{current.tx=0;current.ty=0;};
    const resize=()=>{
      const dpr=Math.min(window.devicePixelRatio||1,window.innerWidth<760?1.1:1.4);
      const w=Math.max(1,Math.floor(canvas.clientWidth*dpr));
      const h=Math.max(1,Math.floor(canvas.clientHeight*dpr));
      if(w!==canvas.width||h!==canvas.height){canvas.width=w;canvas.height=h;}
      gl.viewport(0,0,w,h);
    };
    const draw=(now:number)=>{
      if(hidden)return;
      // Desktop ~60fps, mobile ~30fps, and a still frame for reduced motion.
      const interval=window.innerWidth<760?30:15;
      if(!motion.matches&&now-last<interval){frame=requestAnimationFrame(draw);return;}
      last=now; resize();
      current.x+=(current.tx-current.x)*.058;
      current.y+=(current.ty-current.y)*.058;
      gl.useProgram(program);
      gl.uniform2f(resolution,canvas.width,canvas.height);
      gl.uniform2f(pointer,current.x,current.y);
      gl.uniform1f(time,motion.matches?0:(now-start)/1000);
      gl.uniform1f(strength,strengthValue);
      gl.drawArrays(gl.TRIANGLES,0,3);
      if(!motion.matches)frame=requestAnimationFrame(draw);
    };
    const stop=()=>{cancelAnimationFrame(frame);};
    const onVisibility=()=>{hidden=document.hidden;stop();if(!hidden)frame=requestAnimationFrame(draw);};
    const onMotion=()=>{stop();frame=requestAnimationFrame(draw);};
    const onContextLoss=(e:Event)=>{e.preventDefault();hidden=true;stop();};
    window.addEventListener("pointermove",onMove,{passive:true});
    window.addEventListener("pointerleave",onLeave);
    document.addEventListener("visibilitychange",onVisibility);
    motion.addEventListener("change",onMotion);
    canvas.addEventListener("webglcontextlost",onContextLoss);
    frame=requestAnimationFrame(draw);
    return ()=>{stop();window.removeEventListener("pointermove",onMove);
      window.removeEventListener("pointerleave",onLeave);
      document.removeEventListener("visibilitychange",onVisibility);
      motion.removeEventListener("change",onMotion);
      canvas.removeEventListener("webglcontextlost",onContextLoss);
      gl.deleteProgram(program);gl.deleteShader(vert);gl.deleteShader(frag);};
  },[intensity]);
  return <div className="seasonal-liquid-backdrop" aria-hidden="true"><canvas ref={ref}/></div>;
}
