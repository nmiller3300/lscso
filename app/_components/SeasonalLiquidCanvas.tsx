"use client";

import { useEffect, useRef } from "react";

// A fluid atmospheric shader inspired by the movement of the Benny's site,
// re-colored and rebuilt specifically for LSCSO Halloween.
const vertex = `#version 300 es
precision highp float;
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}
`;
const fragment = `#version 300 es
precision highp float;
uniform vec2 uResolution; uniform float uTime; uniform vec2 uPointer;
out vec4 fragColor;
float hash(vec2 p){p=fract(p*vec2(127.1,311.7));p+=dot(p,p+34.7);return fract(p.x*p.y);}
float noise(vec2 p){vec2 i=floor(p), f=fract(p);f=f*f*(3.-2.*f);
return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 r=mat2(.8,-.6,.6,.8);for(int i=0;i<5;i++){v+=a*noise(p);p=r*p*2.05+8.4;a*=.5;}return v;}
void main(){
  vec2 uv=(2.*gl_FragCoord.xy-uResolution)/max(uResolution.y,1.);
  float t=uTime;vec2 q=vec2(fbm(uv*1.15+vec2(.028*t,-.015*t)),fbm(uv*1.22+vec2(4.7-.018*t,6.1+.019*t)));
  float turbulence=fbm(uv*2.4+q*3.1+uPointer*.11);
  float wave=fbm(uv*2.8-q*2.4+vec2(t*.012,-t*.016));
  vec3 col=mix(vec3(.022,.007,.052),vec3(.08,.014,.10),smoothstep(-1.4,1.3,uv.x+q.x*.3));
  float amethyst=exp(-abs(uv.y-.38+sin(uv.x*2.4+t*.14+turbulence*4.)*.105)*10.);
  float ember=exp(-abs(uv.y+.43+sin(uv.x*2.0-t*.12+q.y*3.4)*.09)*12.);
  col+=vec3(.35,.08,.62)*amethyst*.22+vec3(1.,.24,.035)*ember*.20;
  float soft=pow(1.-abs(sin((turbulence+wave*.45)*16.+t*.18)),8.);
  col+=mix(vec3(.38,.12,.66),vec3(.85,.27,.08),smoothstep(-.5,.7,uv.x))*soft*.12;
  float pointer=exp(-length(uv-uPointer*.36)*3.4);
  col+=mix(vec3(.35,.12,.7),vec3(.8,.27,.1),.5+.5*uPointer.x)*pointer*.035;
  float haze=fbm(uv*1.1+vec2(t*.017,-t*.008));
  col+=vec3(.11,.045,.16)*haze*.11;
  col*=mix(.58,1.,1.-smoothstep(.65,1.75,length(uv*vec2(.7,1.))));
  col=clamp(col*1.7,0.,1.);col=pow(col,vec3(.82));
  fragColor=vec4(col,1.);
}
`;

export function SeasonalLiquidCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl2", { antialias: false, alpha: false, powerPreference: "low-power" });
    if (!gl) return;
    function compile(type: number, source: string) {
      const shader = gl!.createShader(type);
      if (!shader) return null;
      gl!.shaderSource(shader, source); gl!.compileShader(shader);
      if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) { gl!.deleteShader(shader); return null; }
      return shader;
    }
    const vs = compile(gl.VERTEX_SHADER, vertex), fs = compile(gl.FRAGMENT_SHADER, fragment);
    if (!vs || !fs) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);gl.attachShader(program, fs);gl.linkProgram(program);
    if (!gl.getProgramParameter(program,gl.LINK_STATUS)) return;
    gl.useProgram(program);
    const res=gl.getUniformLocation(program,"uResolution"), time=gl.getUniformLocation(program,"uTime"),
      mouse=gl.getUniformLocation(program,"uPointer");
    let frame=0, last=0, start=performance.now();
    const pointer={x:0,y:0,tx:0,ty:0};
    const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
    const onPointer=(event:PointerEvent)=>{pointer.tx=event.clientX/window.innerWidth*2-1;pointer.ty=-(event.clientY/window.innerHeight*2-1);};
    const resize=()=>{const ratio=Math.min(window.devicePixelRatio||1,1.35),w=Math.max(1,Math.floor(canvas.clientWidth*ratio)),h=Math.max(1,Math.floor(canvas.clientHeight*ratio));if(w!==canvas.width||h!==canvas.height){canvas.width=w;canvas.height=h;}gl.viewport(0,0,w,h);};
    const draw=(now:number)=>{
      if(document.hidden)return;
      if(now-last<32&&!reduced.matches){frame=requestAnimationFrame(draw);return;}
      last=now;resize();
      pointer.x+=(pointer.tx-pointer.x)*.035;pointer.y+=(pointer.ty-pointer.y)*.035;
      gl.useProgram(program);gl.uniform2f(res,canvas.width,canvas.height);
      gl.uniform1f(time,reduced.matches?0:(now-start)*.001);gl.uniform2f(mouse,pointer.x,pointer.y);
      gl.drawArrays(gl.TRIANGLES,0,3);
      if(!reduced.matches)frame=requestAnimationFrame(draw);
    };
    const visibility=()=>{cancelAnimationFrame(frame);if(!document.hidden)frame=requestAnimationFrame(draw);};
    const motion=()=>visibility();
    window.addEventListener("pointermove",onPointer,{passive:true});
    document.addEventListener("visibilitychange",visibility);
    reduced.addEventListener("change",motion);
    frame=requestAnimationFrame(draw);
    return ()=>{cancelAnimationFrame(frame);window.removeEventListener("pointermove",onPointer);
      document.removeEventListener("visibilitychange",visibility);reduced.removeEventListener("change",motion);
      gl.deleteProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);};
  },[]);
  return <div className="seasonal-liquid-backdrop" aria-hidden="true"><canvas ref={canvasRef}/></div>;
}
