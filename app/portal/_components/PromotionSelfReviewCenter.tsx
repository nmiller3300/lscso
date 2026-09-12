"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePortalProfile } from "./PortalProfileProvider";

const ranks=["Recruit","Deputy","Deputy II","Deputy III","Master Deputy","Corporal","Sergeant","Lieutenant","1st Lieutenant","Captain","Major","Undersheriff","Sheriff"] as const;
type PromotionCase={id:string;case_number:number;source_type:string;current_rank:string;requested_rank:string;statement:string;status:string;decision_notes:string|null;effective_at:string|null;created_at:string};
const isOpen=(status:string)=>["Submitted","Under Review"].includes(status);
const when=(value:string|null)=>value?new Date(value).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}):"Not recorded";

export function PromotionSelfReviewCenter(){
  const profile=usePortalProfile();
  const [cases,setCases]=useState<PromotionCase[]>([]);
  const [openForm,setOpenForm]=useState(false);
  const [rank,setRank]=useState("");
  const [statement,setStatement]=useState("");
  const [pending,setPending]=useState(false);
  const [notice,setNotice]=useState("");

  async function load(){
    const {data}=await (createClient() as any).from("promotion_cases").select("id,case_number,source_type,current_rank,requested_rank,statement,status,decision_notes,effective_at,created_at").eq("subject_profile_id",profile.id).order("created_at",{ascending:false});
    setCases(data??[]);
  }
  useEffect(()=>{void load();},[profile.id]);
  const active=cases.find((item)=>isOpen(item.status));
  const options=useMemo(()=>{const current=ranks.indexOf(profile.rank as (typeof ranks)[number]);return ranks.filter((item,index)=>item!=="Sheriff"&&index>current);},[profile.rank]);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(pending)return;
    if(!rank||statement.trim().length<10){setNotice("Choose the rank and explain why you are requesting promotion review.");return;}
    setPending(true);
    const {error}=await (createClient() as any).rpc("submit_promotion_review_request",{p_requested_rank:rank,p_statement:statement.trim()});
    setPending(false);if(error){setNotice(error.message);return;}
    setOpenForm(false);setRank("");setStatement("");setNotice("Promotion review requested.");await load();window.setTimeout(()=>setNotice(""),4500);
  }

  async function withdraw(item:PromotionCase){
    if(pending)return;setPending(true);
    const {error}=await (createClient() as any).rpc("withdraw_promotion_review",{p_case_id:item.id,p_reason:"Withdrawn by member"});
    setPending(false);if(error){setNotice(error.message);return;}
    setNotice("Promotion review withdrawn.");await load();window.setTimeout(()=>setNotice(""),4500);
  }

  return <section className="portal-panel" id="promotion-review" style={{marginBottom:17}}>
    <div className="portal-panel-heading"><div><p>Career progression</p><h2>Promotion Review</h2></div>{!active&&options.length?<button className="portal-button portal-button--primary" onClick={()=>setOpenForm(true)} type="button">Request Promotion Review</button>:null}</div>
    {active?<div className="request-routing-card"><span>PR</span><div className="request-routing-main"><strong>{active.current_rank} → {active.requested_rank}</strong><small>PR-{String(active.case_number).padStart(4,"0")} · {active.source_type} · Opened {when(active.created_at)}</small><div className="request-routing-status"><div><span>Status</span><strong>{active.status}</strong></div><div><span>Source</span><strong>{active.source_type}</strong></div><div><span>Next action</span><strong>{active.status==="Submitted"?"Awaiting Command review":"Command decision pending"}</strong></div></div><p>{active.statement}</p>{active.source_type==="Self Request"?<button className="portal-button portal-button--secondary" disabled={pending} onClick={()=>withdraw(active)} type="button">Withdraw Request</button>:null}</div><b>{active.status}</b></div>:<div className="portal-empty-state"><strong>No active promotion review.</strong><span>{profile.rank==="Sheriff"?"Sheriff rank has no promotion path.":"You may request review when you want Command to consider you for a higher rank."}</span></div>}
    {cases.some((item)=>!isOpen(item.status))?<details className="personnel-history-disclosure"><summary>Promotion review history <span>{cases.filter((item)=>!isOpen(item.status)).length}</span></summary><div className="deputy-request-history">{cases.filter((item)=>!isOpen(item.status)).map((item)=><article key={item.id}><span>PR</span><div><strong>{item.current_rank} → {item.requested_rank}</strong><small>PR-{String(item.case_number).padStart(4,"0")} · {item.source_type} · {when(item.created_at)}</small>{item.decision_notes?<small>{item.decision_notes}</small>:null}</div><b>{item.status}</b></article>)}</div></details>:null}
    {openForm?<div className="portal-modal-backdrop" role="presentation" onMouseDown={(event)=>{if(event.currentTarget===event.target&&!pending)setOpenForm(false)}}><section className="portal-modal portal-modal--compact" role="dialog" aria-modal="true" aria-labelledby="promotion-self-title"><div className="portal-modal-heading"><div><span>Personnel request</span><h2 id="promotion-self-title">Request Promotion Review</h2></div><button disabled={pending} onClick={()=>setOpenForm(false)} type="button" aria-label="Close">×</button></div><form onSubmit={submit}><label>Requested rank<select value={rank} onChange={(event)=>setRank(event.target.value)} required><option value="" disabled>Select rank</option>{options.map((item)=><option key={item}>{item}</option>)}</select></label><label className="portal-call-sign-field">Why should Command review you for promotion?<textarea value={statement} onChange={(event)=>setStatement(event.target.value)} rows={5} placeholder="State your qualifications, readiness, and reason for requesting review." required /></label><div className="portal-modal-actions"><button className="portal-button portal-button--secondary" disabled={pending} onClick={()=>setOpenForm(false)} type="button">Cancel</button><button className="portal-button portal-button--primary" disabled={pending||!rank||statement.trim().length<10} type="submit">{pending?"Submitting…":"Request Review"}</button></div></form></section></div>:null}
    {notice?<div className="portal-toast" role="status">{notice}</div>:null}
  </section>;
}
