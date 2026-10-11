"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePortalProfile } from "./PortalProfileProvider";

type Lesson = { title:string; href:string; selector:string; why:string; leadership:string; practice:string; question:string; answers:[string,string,string]; correct:number };
const LESSONS:Lesson[] = [
  {title:"Your command dashboard",href:"/portal/command/home",selector:'a[href="/portal/command/home"]',why:"This is your morning briefing: pending Guardians, requests, recruitment, promotions, and time-sensitive work are surfaced together.",leadership:"Prioritize risk and overdue personnel matters before routine administration. An alert is a review cue, not an instruction to rubber-stamp.",practice:"Locate the action counts on the Home screen. Identify which item would require your attention first.",question:"A dashboard counter shows a pending disciplinary item. What comes first?",answers:["Approve it to clear the counter","Read the record and supporting context","Assign punishment from the dashboard"],correct:1},
  {title:"Approvals and requests",href:"/portal/command/approvals",selector:'a[href="/portal/command/approvals"]',why:"This workspace is where requests are reviewed, routed, and resolved.",leadership:"Confirm your authority, the requester's circumstances, and documentation before deciding. Do not approve your own request.",practice:"Find a pending item and inspect its route and history. Do not submit a decision.",question:"A request is in your queue but lacks supporting details. What should you do?",answers:["Approve it anyway","Reject every incomplete request","Review and request clarification"],correct:2},
  {title:"Personnel and roster",href:"/portal/command/personnel",selector:'a[href="/portal/command/personnel"]',why:"The directory joins ranks, employment status, callsigns, and personnel files.",leadership:"Treat personnel records as controlled information. Confirm identity and policy before updating a record; employee numbers do not change with promotion.",practice:"Locate your own profile and confirm rank, callsign, and record history.",question:"After a promotion, should an employee's unique personnel ID change?",answers:["No, it stays with the employee","Yes, it matches the new rank","Only if a supervisor requests it"],correct:0},
  {title:"Promotions and career",href:"/portal/command/promotions",selector:'a[href="/portal/command/promotions"]',why:"Promotion cases document career progression and approvals.",leadership:"Review the member's record, training and supporting recommendations. Use the formal workflow, not informal rank edits.",practice:"Find the promotion review area and locate case status and history.",question:"What is the proper basis for a promotion decision?",answers:["Friendship or seniority alone","A documented review and applicable standards","Whoever asks first"],correct:1},
  {title:"Recruitment command review",href:"/portal/command/applications",selector:'a[href="/portal/command/applications"]',why:"Applications proceed through review, interview, decisions and onboarding.",leadership:"Be consistent and document factual reasons. Do not hire directly from an unreviewed application.",practice:"Trace the status of an existing application without changing it.",question:"What should Command do before a hiring decision?",answers:["Read the application and required assessments","Skip to hiring","Delete unsuccessful applications immediately"],correct:0},
  {title:"Supervision",href:"/portal/command/supervision",selector:'a[href="/portal/command/supervision"]',why:"Supervision gives Command an overview of people and delegated responsibilities.",leadership:"Apply standards consistently, respect the reporting chain, and intervene constructively when follow-up is needed.",practice:"Locate personnel supervision and assigned responsibilities.",question:"Effective Command supervision emphasizes:",answers:["Accountability and consistent follow-up","Public criticism without review","Unrecorded exceptions"],correct:0},
  {title:"Guardian accountability",href:"/portal/command/guardians",selector:'a[href="/portal/command/guardians"]',why:"Guardian records establish documented oversight, approvals, responses, and follow-ups.",leadership:"Separate an allegation from a finding; read the complete record and preserve procedural fairness.",practice:"Read an existing Guardian's status and follow-up details without changing it.",question:"When reviewing a Guardian, what matters most?",answers:["Only the title","The record, evidence, response and approval status","Closing it as quickly as possible"],correct:1},
  {title:"Training and FTO",href:"/portal/command/training",selector:'a[href="/portal/command/training"]',why:"Track qualification, field training, development and certification status.",leadership:"Assign development based on gaps and readiness; verify completed requirements before approving advancement.",practice:"Find the training progress and certification areas.",question:"A deputy is missing a mandatory qualification. What is the leadership response?",answers:["Ignore the requirement","Mark it complete without training","Arrange proper training and verify completion"],correct:2},
  {title:"Command orders",href:"/portal/orders",selector:'a[href="/portal/orders"]',why:"Formal orders establish department directives and may require acknowledgment.",leadership:"Write precise, enforceable direction and check required acknowledgments. Orders are different from general news.",practice:"Read an existing order and locate its acknowledgment requirements.",question:"Which belongs in a Command Order?",answers:["An enforceable official directive","A casual congratulations post","An unverified rumor"],correct:0},
  {title:"Department announcements",href:"/portal/command/announcements",selector:'a[href="/portal/command/announcements"]',why:"Official communications can reach members and Discord.",leadership:"Verify content, audience and timing. A publish action is real, so never use it for a test.",practice:"Locate the publishing controls without posting.",question:"Before publishing an official announcement:",answers:["Assume all drafts are safe","Review factual accuracy and recipients","Post first and correct later"],correct:1},
  {title:"Public information",href:"/portal/command/psa",selector:'a[href="/portal/command/psa"]',why:"PSAs and notices may become public representations of the Office.",leadership:"Protect private personnel information and coordinate sensitive communications with authorized leadership.",practice:"Locate current public notices and publishing options, but do not publish.",question:"A PSA includes private employee information. What should happen?",answers:["Publish anyway","Remove or appropriately authorize sensitive details first","Copy it into Discord"],correct:1},
  {title:"Administration and access",href:"/portal/command/administration",selector:'a[href="/portal/command/administration"]',why:"Administration includes account management and other high-impact operations.",leadership:"Use least privilege, identify the person and reason, and preserve an audit trail. Some functions remain restricted even to Command.",practice:"Locate account controls but do not create, deactivate or reset accounts.",question:"What is the safe way to change a member's access?",answers:["Share an existing login","Give every employee Executive access","Use an authorized, auditable account workflow"],correct:2},
  {title:"Your own personnel office",href:"/portal/my-office",selector:'a[href="/portal/my-office"]',why:"My Info is the member-facing view of records, requests, documents, qualifications, and leave.",leadership:"Command staff are also subject to department standards. Keep personal records accurate and follow the same approved processes.",practice:"Open My Info and find your personal documents and requests.",question:"Do department leaders still follow normal personnel procedures?",answers:["Yes, including documentation and accountability","No, Command is exempt","Only when supervised"],correct:0}
];

const VERSION="leadership-v3";
const TARGETS=new Set(["LS-002","LS-004"]);
type Rect={top:number;left:number;width:number;height:number};
type Task={ selector:string; instruction:string; explain:string; destination?:string; fallback?:string; };
const TASKS:Record<number,Task>={
 0:{selector:'a[href="/portal/notifications#action-required"]',instruction:"Find the Action Center shortcut and open it.",explain:"The Action Center consolidates work needing a response. Reviewing an item is different from deciding it.",destination:"/portal/notifications",fallback:".portal-page-heading"},
 1:{selector:'a[href="#personnel-requests"]',instruction:"Click Personnel requests to jump to its review queue.",explain:"Here you inspect requests assigned to you, their status and any routing. During training, never press Approve or Deny.",destination:"#personnel-requests",fallback:".portal-page-heading"},
 2:{selector:'a[href="/portal/command/personnel/roster"]',instruction:"Open the Department Roster using the highlighted button.",explain:"Compare personnel identity, callsign and employment status. Use records rather than guessing based on a name.",destination:"/portal/command/personnel/roster",fallback:".portal-page-heading"},
 3:{selector:".portal-page-heading",instruction:"Examine the career and promotions page. Find its case-review controls and current status.",explain:"A documented review with training and history comes before a rank decision."},
 4:{selector:'a[href="/portal/command/applications/editor"]',instruction:"Open the Recruitment Application Editor to learn where application questions are maintained.",explain:"Separate application form management from live applicant decisions. Do not save a change during orientation.",destination:"/portal/command/applications/editor",fallback:".portal-page-heading"},
 5:{selector:'a[href="/portal/command/guardians"]',instruction:"Use the Guardian Workspace shortcut in Supervision to inspect where oversight records live.",explain:"Supervision connects personnel oversight to documented follow-ups and Guardians.",destination:"/portal/command/guardians",fallback:".portal-page-heading"},
 6:{selector:"#guardian-record-directory-title",instruction:"Find Search Existing Records. This is where you research historical Guardians.",explain:"Read findings and responses before taking action. Creating or approving one is not part of this tour.",fallback:".portal-page-heading"},
 7:{selector:'a[href="/portal/command/certifications"]',instruction:"Click Open Certification Center to see how qualifications are reviewed.",explain:"This is how you check current and pending certifications; starting training is a separate live action.",destination:"/portal/command/certifications",fallback:".portal-page-heading"},
 8:{selector:".portal-page-heading",instruction:"Review the Command Orders interface and find its acknowledgement details.",explain:"A directive creates a formal obligation. Do not issue an order as an exercise."},
 9:{selector:".portal-page-heading",instruction:"Locate the Department Announcements publishing area, without posting.",explain:"Verify audience, wording and distribution before a live Discord announcement."},
 10:{selector:".portal-page-heading",instruction:"Locate public information controls. Do not publish a PSA during the tour.",explain:"Public notices should be accurate, approved and free of protected personnel details."},
 11:{selector:'a[href="/portal/command/approvals"]',instruction:"Inspect the administrative workspace. Follow the highlighted shortcut to Approvals.",explain:"Administrative authority is limited and auditable. Account changes must follow the authorized process.",destination:"/portal/command/approvals",fallback:".portal-page-heading"},
 12:{selector:".portal-page-heading",instruction:"Find your personnel information, documents and requests.",explain:"Leadership has the same obligation to maintain accurate records and follow department process."}
};
export function CommandPortalTour(){
 const profile=usePortalProfile(),pathname=usePathname(),router=useRouter();
 const eligible=TARGETS.has(profile.personnel_id);
 const [open,setOpen]=useState(false),[loaded,setLoaded]=useState(false),[step,setStep]=useState(0),[phase,setPhase]=useState<"navigate"|"explore"|"done">("navigate"),[rect,setRect]=useState<Rect|null>(null),[targetFound,setTargetFound]=useState(false),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 const lesson=LESSONS[step],task=TASKS[step];
 const navSelector=`a[href="${lesson.href}"]`;
 useEffect(()=>{
  if(!eligible)return;let active=true;
  async function init(){
   const {data:{user}}=await createClient().auth.getUser();
   if(!active||!user)return;
   const {data,error}=await (createClient() as any).from("command_tour_progress").select("tour_version,current_step,completed_at").eq("auth_user_id",user.id).maybeSingle();
   if(!active)return;setLoaded(true);if(error){setMessage("Unable to read tour progress. Use Start Training to retry.");return;}
   if(data?.tour_version===VERSION&&data.completed_at)return;
   const next=data?.tour_version===VERSION?Math.max(0,Math.min(LESSONS.length-1,data.current_step)):0;
   setStep(next);const savedPhase=sessionStorage.getItem("lscso-tour-phase:"+user.id+":"+next);setPhase(savedPhase==="done"?"done":location.pathname===LESSONS[next].href?"explore":"navigate");setOpen(true);
  }
  void init();return()=>{active=false};
 },[eligible]);
 useEffect(()=>{
  if(!open)return;
  if(phase==="navigate"&&pathname===lesson.href)setPhase("explore");
  if(phase==="explore"&&task.destination&&pathname!==lesson.href) {
   const expected=task.destination.split("#")[0];
   if((expected&&pathname===expected)||(!expected&&location.hash===task.destination))setPhase("done");
  }
 },[open,phase,pathname,lesson.href,task.destination]);
 useEffect(()=>{
  if(!open||phase!=="explore"||!task.destination?.startsWith("#"))return;
  if(location.hash===task.destination)setPhase("done");
  const check=()=>{if(location.hash===task.destination)setPhase("done")};
  window.addEventListener("hashchange",check);return()=>window.removeEventListener("hashchange",check);
 },[open,phase,task.destination]);
 useEffect(()=>{
  if(!open||phase==="done")return;
  const selector=phase==="navigate"?navSelector:task.selector;
  let frame=0;let observer:MutationObserver|null=null;
  const refresh=()=>{
   const preferred=document.querySelector<HTMLElement>(`.portal-navigation ${selector}`)||document.querySelector<HTMLElement>(selector);
   const element=preferred|| (phase==="explore"&&task.fallback?document.querySelector<HTMLElement>(task.fallback):null);
   setTargetFound(Boolean(preferred));
   if(!element){setRect(null);return}
   const r=element.getBoundingClientRect();
   if(r.width&&r.height)setRect({top:Math.max(4,r.top-4),left:Math.max(4,r.left-4),width:r.width+8,height:r.height+8});
   else setRect(null);
  };
  const run=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(refresh)};
  run();window.addEventListener("scroll",run,true);window.addEventListener("resize",run);
  observer=new MutationObserver(run);observer.observe(document.body,{childList:true,subtree:true});
  return()=>{observer?.disconnect();cancelAnimationFrame(frame);window.removeEventListener("scroll",run,true);window.removeEventListener("resize",run)};
 },[open,phase,pathname,navSelector,task.selector,task.fallback]);
 useEffect(()=>{
  if(!open)return;
  const handle=(event:MouseEvent)=>{
   const el=event.target instanceof Element?event.target.closest("a,button"):null;
   if(!el)return;
   if(phase==="navigate"&&el.matches(navSelector)){setPhase("explore");setMessage("");}
   else if(phase==="explore"&&task.destination&&el.matches(task.selector)){sessionStorage.setItem("lscso-tour-phase:"+profile.auth_user_id+":"+step,"done");setPhase("done");setMessage("");}
  };
  document.addEventListener("click",handle,true);return()=>document.removeEventListener("click",handle,true);
 },[open,phase,navSelector,task.selector,task.destination,profile.auth_user_id,step]);
 const advance=useCallback(async()=>{
  setBusy(true);setMessage("");
  try{
   const {data:{user}}=await createClient().auth.getUser();if(!user)throw Error("You must be signed in.");
   const finish=step===LESSONS.length-1,next=Math.min(step+1,LESSONS.length-1);
   const {error}=await (createClient() as any).from("command_tour_progress").upsert({auth_user_id:user.id,tour_version:VERSION,current_step:next,completed_at:finish?new Date().toISOString():null,updated_at:new Date().toISOString()},{onConflict:"auth_user_id"});
   if(error)throw error;
   sessionStorage.removeItem("lscso-tour-phase:"+user.id+":"+step);if(finish)setOpen(false);
   else{setStep(next);setPhase("navigate");setRect(null);}
  }catch{setMessage("Unable to save your progress; try again.");}
  finally{setBusy(false);}
 },[step]);
 if(!eligible)return null;
 if(!open)return <button type="button" className="lscso-tour-launch" onClick={()=>{setStep(0);setPhase("navigate");setMessage("");setOpen(true);}} style={{position:"fixed",bottom:20,right:20,zIndex:99991,padding:"12px 18px",borderRadius:10,border:"1px solid #d9b579",background:"#152a36",color:"#f4d6a1",fontWeight:700,cursor:"pointer"}}>{loaded?"Start / Replay Leadership Training":"Start Leadership Training"}</button>;
 const navigate=phase==="navigate";
 return <div className="lscso-leadership-tour" role="region" aria-label="LSCSO guided leadership training">
  {rect?<div className="lscso-tour-spotlight" style={{top:rect.top,left:rect.left,width:rect.width,height:rect.height}} aria-hidden="true"/>:<div className="lscso-tour-shade" aria-hidden="true"/>}
  <section className="lscso-tour-card" aria-live="polite">
   <div className="lscso-tour-kicker">OFFICE OF THE SHERIFF · INTERACTIVE COMMAND TRAINING</div>
   <div className="lscso-tour-track"><div style={{width:`${(step+(phase==="done"?1:phase==="explore"?.5:0))/LESSONS.length*100}%`}}/></div>
   <p className="lscso-tour-counter">Module {step+1} of {LESSONS.length} · {phase==="navigate"?"1. Open the section":phase==="explore"?"2. Explore the feature":"3. Section complete"}</p>
   <h2>{lesson.title}</h2>
   {navigate?<><p>First, click the highlighted <strong>{lesson.title}</strong> link in the actual portal menu.</p><p>You will be taken to the live workspace, where the next spotlight demonstrates an actual feature.</p></>:phase==="explore"?<><p>{lesson.why}</p><div className="lscso-tour-leadership"><strong>How Command uses this</strong><p>{lesson.leadership}</p></div><div className="lscso-tour-practice"><strong>Do this now:</strong> {task.instruction}</div><p>{task.explain}</p></>:<><h3>Section explored</h3><p>{task.explain}</p><p>You can move on once you're comfortable finding and using this part of the portal.</p></>}
   {message&&<p role="alert">{message}</p>}
   <div className="lscso-tour-actions">
    <button type="button" onClick={()=>{if(phase==="navigate"){router.push(lesson.href);setPhase("explore")}else if(phase==="explore")setPhase("navigate");else setPhase("explore")}}>{navigate?"Open section for me":phase==="done"?"Review again":"Back to menu step"}</button>
    {phase==="explore"&&!task.destination?<button type="button" className="primary" onClick={()=>setPhase("done")}>I've located this feature</button>:phase==="explore"&&!targetFound?<button type="button" className="primary" onClick={()=>setPhase("done")}>This control isn't available</button>:phase==="done"?<button type="button" className="primary" disabled={busy} onClick={()=>void advance()}>{busy?"Saving…":step===LESSONS.length-1?"Finish orientation":"Next module →"}</button>:null}
   </div>
   <small>This is a guided practice tour. Click highlighted controls directly; it will never automatically submit approvals, publish notices, or modify personnel records. Completed modules are saved to your LSCSO account.</small>
  </section>
  <style jsx global>{`
   .lscso-leadership-tour{position:fixed;inset:0;z-index:99990;pointer-events:none;font-family:inherit}
   .lscso-tour-spotlight{position:fixed;z-index:99990;border:2px solid #deb976;border-radius:10px;box-shadow:0 0 0 200vmax rgba(2,9,16,.78),0 0 18px #d4a95d;background:rgba(213,176,108,.12);pointer-events:none}
   .lscso-tour-shade{position:fixed;inset:0;background:rgba(2,9,16,.78);pointer-events:none}
   .lscso-tour-card{position:fixed;right:24px;bottom:22px;z-index:99991;width:min(470px,calc(100vw - 28px));max-height:min(84vh,790px);overflow:auto;pointer-events:auto;background:#101c25;border:1px solid #b29967;border-radius:16px;box-shadow:0 24px 75px #000b;padding:23px;color:#eaf1f4}
   .lscso-tour-kicker{font-size:10px;letter-spacing:1.5px;font-weight:800;color:#dbc08b}
   .lscso-tour-track{height:5px;border-radius:9px;background:#304451;overflow:hidden;margin:12px 0}.lscso-tour-track div{height:100%;background:#e0bd7d;transition:width .25s}
   .lscso-tour-counter{font-size:12px;color:#b6c3cb}
   .lscso-tour-card h2{font-size:23px;color:#fff;margin:9px 0}
   .lscso-tour-card p{line-height:1.5;font-size:14px}
   .lscso-tour-leadership{border-left:3px solid #cfac76;padding:8px 12px;background:#1c303a;border-radius:5px;margin:14px 0}.lscso-tour-leadership strong{color:#f0d09a}.lscso-tour-leadership p{margin:6px 0}
   .lscso-tour-practice{background:#22343d;padding:12px;border-radius:8px;line-height:1.5;font-size:14px}.lscso-tour-practice strong{color:#f0d09a}
   .lscso-tour-actions{display:flex;justify-content:space-between;gap:12px;margin:16px 0}.lscso-tour-actions button{border-radius:8px;border:1px solid #81909c;padding:11px 16px;color:#fff;background:#243540;font-weight:700;cursor:pointer}.lscso-tour-actions button.primary{background:#d9b579;border-color:#d9b579;color:#14212a}.lscso-tour-actions button:disabled{opacity:.4;cursor:not-allowed}
   .lscso-tour-card small{color:#a9b6c0;font-size:11px;line-height:1.5;display:block}
   @media(max-width:780px){.lscso-tour-card{right:12px;bottom:12px;max-height:73vh;padding:15px}.lscso-tour-card h2{font-size:19px}}
  `}</style>
 </div>;
}
