"use client";

import { useEffect, useState } from "react";
import { usePortalProfile } from "./PortalProfileProvider";

const KEY="lscso-white-prank-20261010";
export function WhiteDashboardPrank(){
 const profile=usePortalProfile();
 const [stage,setStage]=useState<"hidden"|"breach"|"reveal">("hidden");
 useEffect(()=>{
  if(profile.personnel_id!=="LS-002")return;
  try {if(sessionStorage.getItem(KEY))return;sessionStorage.setItem(KEY,"seen");}catch{return;}
  const start=window.setTimeout(()=>setStage("breach"),1300);
  const reveal=window.setTimeout(()=>setStage("reveal"),9000);
  const end=window.setTimeout(()=>setStage("hidden"),22000);
  return()=>{window.clearTimeout(start);window.clearTimeout(reveal);window.clearTimeout(end);};
 },[profile.personnel_id]);
 if(stage==="hidden"||profile.personnel_id!=="LS-002")return null;
 return <div className="white-prank-root" aria-live="polite">
  <section className={stage==="breach"?"white-prank-card is-breach":"white-prank-card is-reveal"}>
   <button type="button" className="white-prank-dismiss" aria-label="Dismiss prank" onClick={()=>setStage("hidden")}>×</button>
   {stage==="breach"?<>
    <div className="white-prank-signal">CRITICAL SECURITY ALERT · EXECUTIVE CHANNEL</div>
    <h2>COMMAND ACCESS COMPROMISED</h2>
    <p>Undersheriff authorization has been overridden. Attempting to regain control…</p>
    <div className="white-prank-lines"><span>› target identified: UNDERSHERIFF MICHAEL WHITE</span><span>› executive hierarchy: SHERIFF OVERRIDE ACCEPTED</span><span>› downloading 47 terabytes of questionable leadership decisions...</span><span>› authenticating notorious intruder: SHERIFF MILLER</span></div>
    <div className="white-prank-meter"><span/></div>
   </>:<>
    <div className="white-prank-signal">ACCESS OVERRIDE COMPLETE · SHERIFF MILLER</div>
    <h2>YOU JUST GOT ABSOLUTELY OWNED 😂</h2>
    <p>White, you were two seconds away from calling the IT department. I AM the IT department. — Sheriff Miller</p>
    <small>PRANK REVEAL: This was a harmless visual gag. Nothing was accessed, modified, deleted, or hacked.</small>
    <button className="white-prank-ok" type="button" onClick={()=>setStage("hidden")}>Fine, you got me 💀</button>
   </>}
  </section>
  <style jsx global>{`
    .white-prank-root{position:fixed;z-index:5000;top:90px;left:50%;transform:translateX(-50%);width:min(590px,calc(100vw - 32px));pointer-events:none}
    .white-prank-card{pointer-events:auto;position:relative;background:#070d11;color:#e7f5ed;border:2px solid #44d69a;border-radius:14px;padding:26px 30px;box-shadow:0 14px 65px #000b,0 0 42px #12b98155;font-family:ui-monospace,monospace;text-align:center;animation:white-prank-in .35s ease-out}
    .white-prank-card.is-breach{border-color:#e45b67;box-shadow:0 14px 65px #000b,0 0 42px #da243e55}
    .white-prank-signal{font-size:11px;font-weight:800;letter-spacing:2px;color:#77e1b1}
    .is-breach .white-prank-signal{color:#ff838d}
    .white-prank-card h2{font-size:clamp(23px,4vw,35px);letter-spacing:1px;color:inherit;margin:14px 0}
    .white-prank-card p{font-size:16px;line-height:1.5;color:#d8e4e1}
    .white-prank-lines{text-align:left;background:#111a1f;border-radius:8px;padding:15px;display:grid;gap:7px;font-size:12px;color:#e4a9a9;margin-top:16px}
    .white-prank-meter{height:7px;background:#303b42;border-radius:9px;overflow:hidden;margin-top:18px}
    .white-prank-meter span{display:block;height:100%;background:#eb5f73;animation:white-prank-load 7.5s linear forwards}
    .white-prank-dismiss{position:absolute;right:12px;top:8px;background:none;border:0;color:#fff;font-size:24px;cursor:pointer}
    .white-prank-ok{margin-top:18px;background:#4bd8a1;border:0;border-radius:8px;padding:10px 15px;color:#062218;font-weight:800;cursor:pointer}
    .white-prank-card small{display:block;color:#b9d0c7;margin-top:10px}
    @keyframes white-prank-in{from{transform:translateY(-20px);opacity:0}to{transform:translateY(0);opacity:1}}
    @keyframes white-prank-load{from{width:0}to{width:100%}}
  `}</style>
 </div>
}
