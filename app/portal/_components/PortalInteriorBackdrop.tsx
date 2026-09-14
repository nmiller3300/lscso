"use client";

import { useEffect, useRef } from "react";

const vertex = `#version 300 es
precision highp float;
void main(){
  vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));
  gl_Position=vec4(p*2.0-1.0,0.0,1.0);
}`;

const fragment = `#version 300 es
precision highp float;
uniform vec2 uResolution;
uniform float uTime;
uniform vec2 uPointer;
out vec4 outColor;

float h(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float f(vec2 p){float v=0.0,a=.5;mat2 r=mat2(.84,-.54,.54,.84);for(int i=0;i<4;i++){v+=a*n(p);p=r*p*2.02+9.8;a*=.5;}return v;}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.0,1.0);}

void main(){
  vec2 res=max(uResolution,vec2(1.0));
  vec2 uv=(gl_FragCoord.xy*2.0-res.xy)/res.y;
  float t=uTime;
  vec2 p=vec2(uPointer.x*res.x/res.y,uPointer.y);
  vec2 q=vec2(f(uv*1.15+vec2(t*.014,t*.020)),f(uv*1.18+vec2(4.6-t*.016,-t*.012)));
  float w=f(uv*1.9+q*2.6+vec2(t*.01,-t*.008));
  vec3 c=mix(vec3(.006,.011,.017),vec3(.022,.034,.048),smoothstep(-1.3,1.2,uv.x+uv.y*.2));
  float edge=smoothstep(.12,.9,length(uv*vec2(.74,1.0)));
  float g=exp(-abs(uv.y+.58+sin(uv.x*1.8+t*.08+w*3.0)*.06)*12.0);
  float b=exp(-abs(uv.y-.62+sin(uv.x*1.7-t*.07+q.y*2.8)*.055)*13.0);
  c+=vec3(.90,.65,.22)*g*.065*edge;
  c+=vec3(.10,.29,.52)*b*.07*edge;
  float ca=pow(1.0-abs(sin((w+q.x*.72)*17.0+t*.17)),8.0);
  c+=mix(vec3(.07,.20,.36),vec3(.54,.38,.12),q.y)*ca*.037*edge;
  float pg=exp(-length(uv-p*.10)*2.8);
  c+=mix(vec3(.33,.23,.07),vec3(.07,.22,.39),.45)*pg*.022;
  float vign=smoothstep(1.75,.28,length(uv*vec2(.66,1.0)));
  c*=mix(.50,1.0,vign);
  float grain=h(gl_FragCoord.xy+fract(t*.37)*111.0)-.5;
  c+=grain*.008;
  c=aces(c*1.16);
  c=pow(c,vec3(.4545));
  outColor=vec4(c,1.0);
}`;

function shader(gl: WebGL2RenderingContext, type: number, source: string) {
  const out = gl.createShader(type);
  if (!out) return null;
  gl.shaderSource(out, source);
  gl.compileShader(out);
  if (!gl.getShaderParameter(out, gl.COMPILE_STATUS)) {
    gl.deleteShader(out);
    return null;
  }
  return out;
}

export function PortalInteriorBackdrop() {
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
      powerPreference: "low-power",
      preserveDrawingBuffer: false,
    });
    if (!gl) {
      root.dataset.renderer = "fallback";
      return;
    }

    const vs = shader(gl, gl.VERTEX_SHADER, vertex);
    const fs = shader(gl, gl.FRAGMENT_SHADER, fragment);
    if (!vs || !fs) {
      root.dataset.renderer = "fallback";
      return;
    }

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      root.dataset.renderer = "fallback";
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      return;
    }

    const resolution = gl.getUniformLocation(program, "uResolution");
    const time = gl.getUniformLocation(program, "uTime");
    const pointerLocation = gl.getUniformLocation(program, "uPointer");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let last = 0;
    let hidden = document.hidden;
    let width = 1;
    let height = 1;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

    root.dataset.renderer = "webgl";
    gl.useProgram(program);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const scale = window.innerWidth < 860 ? .48 : .58;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.15) * scale;
      width = Math.max(1, Math.floor(rect.width * dpr));
      height = Math.max(1, Math.floor(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
    };

    const draw = (now: number) => {
      if (!reduced.matches && now - last < 34) {
        frame = requestAnimationFrame(draw);
        return;
      }
      last = now;
      resize();
      pointer.x += (pointer.tx - pointer.x) * .035;
      pointer.y += (pointer.ty - pointer.y) * .035;
      gl.useProgram(program);
      gl.uniform2f(resolution, width, height);
      gl.uniform1f(time, reduced.matches ? 0 : now * .001);
      gl.uniform2f(pointerLocation, pointer.x, pointer.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!reduced.matches && !hidden) frame = requestAnimationFrame(draw);
    };

    const move = (event: PointerEvent) => {
      pointer.tx = (event.clientX / Math.max(innerWidth, 1) - .5) * 2;
      pointer.ty = -((event.clientY / Math.max(innerHeight, 1) - .5) * 2);
      root.style.setProperty("--portal-shell-x", pointer.tx.toFixed(3));
      root.style.setProperty("--portal-shell-y", pointer.ty.toFixed(3));
    };
    const leave = () => {
      pointer.tx = 0;
      pointer.ty = 0;
      root.style.setProperty("--portal-shell-x", "0");
      root.style.setProperty("--portal-shell-y", "0");
    };
    const visibility = () => {
      hidden = document.hidden;
      cancelAnimationFrame(frame);
      if (!hidden) draw(performance.now());
    };
    const motion = () => {
      cancelAnimationFrame(frame);
      draw(performance.now());
    };

    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    reduced.addEventListener("change", motion);
    draw(performance.now());

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", visibility);
      reduced.removeEventListener("change", motion);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return (
    <div ref={rootRef} className="portal-interior-backdrop" aria-hidden="true">
      <canvas ref={canvasRef} />
      <div className="portal-interior-backdrop__crest" />
      <div className="portal-interior-backdrop__light portal-interior-backdrop__light--gold" />
      <div className="portal-interior-backdrop__light portal-interior-backdrop__light--steel" />
    </div>
  );
}
