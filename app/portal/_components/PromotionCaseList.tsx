"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type PromotionCaseItem={id:string;caseNumber:number;subjectPersonnelId:string;subjectName:string;currentRank:string;requestedRank:string;sourceType:string;initiatorName:string;statement:string;status:string;decisionNotes:string|null;createdAt:string;events:Array<{id:string;eventType:string;actorLabel:string|null;detail:string|null;createdAt:string}>};
const when=(value:string)=>new Date(value).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});

export function PromotionCaseList({initialCases,canBegin,canDecide}:{initialCases:PromotionCaseItem[];canBegin:boolean;canDecide:boolean}){
  const router=useRouter();
  const [items,setItems]=useState(initialCases);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [note,setNote]=useState("");
  const [pending,setPending]=useState(false);
  const [notice,setNotice]=useState("");
  const selected=items.find((item)=>item.id===selectedId)??null;
  const open=items.filter((item)=>["Submitted","Under Review"].includes(item.status));
  const closed=items.filter((item)=>!["Submitted","Under Review"].includes(item.status));

  async function begin(item:PromotionCaseItem){
    if(pending)return;setPending(true);
    const {data,error}=await (createClient() as any).rpc("begin_promotion_case_review",{p_case_id:item.id,p_notes:note.trim()||null});
    setPending(false);if(error){setNotice(error.message);return;}
    setItems((current)=>current.map((row)=>row.id===item.id?{...row,status:data?.status??"Under Review"}:row));setSelectedId(null);setNote("");setNotice(`PR-${String(item.caseNumber).padStart(4,"0")} is under Command review.`);router.refresh();
  }

  async function decide(item:PromotionCaseItem,decision:"Approved"|"Denied"){
    if(pending||note.trim().length<4)return;setPending(true);
    const {data,error}=await (createClient() as any).rpc("decide_promotion_case",{p_case_id:item.id,p_decision:decision,p_notes:note.trim()});
    setPending(false);if(error){setNotice(error.message);return;}
    setItems((current)=>current.map((row)=>row.id===item.id?{...row,status:data?.status??decision,decisionNotes:note.trim()}:row));setSelectedId(null);setNote("");setNotice(decision==="Approved"?`${item.subjectName} promoted to ${item.requestedRank}.`:`Promotion review denied for ${item.subjectName}.`);router.refresh();window.setTimeout(()=>setNotice(""),5000);
  }

  return <>
    <section className="portal-panel" style={{marginBottom:16}}><div className="portal-panel-heading"><div><p>Active review</p><h2>Promotion cases</h2></div><span>{open.length} open</span></div><div className="portal-approval-list">
      {open.map((item)=><article key={item.id}><span className="portal-record-type">PR</span><div className="portal-approval-id"><strong>PR-{String(item.caseNumber).padStart(4,"0")}</strong><span>{item.sourceType}</span></div><div><strong>{item.subjectName}</strong><span>{item.currentRank} → {item.requestedRank}</span></div><span className="portal-priority portal-priority--routine">{item.status}</span><small>{when(item.createdAt)}</small><button className="portal-approval-review-button" onClick={()=>{setSelectedId(item.id);setNote("")}} type="button">Review →</button></article>)}
      {!open.length?<div className="portal-empty-state"><strong>No active promotion reviews.</strong></div>:null}
    </div></section>
    {closed.length?<section className="portal-panel"><div className="portal-panel-heading"><div><p>Promotion history</p><h2>Completed reviews</h2></div><span>{closed.length}</span></div><div className="deputy-request-history">{closed.slice(0,20).map((item)=><article key={item.id}><span>PR</span><div><strong>{item.subjectName} · {item.requestedRank}</strong><small>PR-{String(item.caseNumber).padStart(4,"0")} · {item.sourceType} · {when(item.createdAt)}</small>{item.decisionNotes?<small>{item.decisionNotes}</small>:null}</div><b>{item.status}</b></article>)}</div></section>:null}
    {selected?<div className="portal-modal-backdrop" role="presentation" onMouseDown={(event)=>{if(event.currentTarget===event.target&&!pending)setSelectedId(null)}}><section className="portal-modal" role="dialog" aria-modal="true" aria-labelledby="promotion-review-title"><div className="portal-modal-heading"><div><span>PR-{String(selected.caseNumber).padStart(4,"0")} · {selected.sourceType}</span><h2 id="promotion-review-title">{selected.subjectName}</h2></div><button disabled={pending} onClick={()=>setSelectedId(null)} type="button" aria-label="Close">×</button></div><div className="portal-request-review"><div><span>Current rank</span><strong>{selected.currentRank}</strong></div><div><span>Proposed rank</span><strong>{selected.requestedRank}</strong></div><div><span>Status</span><strong>{selected.status}</strong></div><div><span>Initiated by</span><strong>{selected.initiatorName}</strong></div><article><span>Basis for review</span><p>{selected.statement}</p></article>{selected.events.length?<article><span>Case history</span>{selected.events.map((event)=><p key={event.id}><strong>{event.eventType}</strong> · {when(event.createdAt)}{event.actorLabel?` · ${event.actorLabel}`:""}{event.detail?` — ${event.detail}`:""}</p>)}</article>:null}<Link className="portal-button portal-button--secondary" href={`/portal/command/personnel/${selected.subjectPersonnelId}`}>Open Personnel Record</Link>{(selected.status==="Submitted"&&canBegin)||(selected.status==="Under Review"&&canDecide)?<label className="portal-call-sign-field">Review note<textarea value={note} onChange={(event)=>setNote(event.target.value)} rows={4} placeholder="Record the review or decision reason." /></label>:null}</div><div className="portal-modal-actions"><button className="portal-button portal-button--secondary" disabled={pending} onClick={()=>setSelectedId(null)} type="button">Close</button>{selected.status==="Submitted"&&canBegin?<button className="portal-button portal-button--primary" disabled={pending} onClick={()=>begin(selected)} type="button">{pending?"Saving…":"Begin Review"}</button>:null}{selected.status==="Under Review"&&canDecide?<><button className="portal-button portal-button--danger" disabled={pending||note.trim().length<4} onClick={()=>decide(selected,"Denied")} type="button">{pending?"Saving…":"Deny"}</button><button className="portal-button portal-button--primary" disabled={pending||note.trim().length<4} onClick={()=>decide(selected,"Approved")} type="button">{pending?"Saving…":`Approve ${selected.requestedRank}`}</button></>:null}</div></section></div>:null}
    {notice?<div className="portal-toast" role="status">{notice}</div>:null}
  </>;
}
