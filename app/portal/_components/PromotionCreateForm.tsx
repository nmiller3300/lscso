"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type PromotionCandidate = { id:string; personnelId:string; displayName:string; rank:string; callSign:string|null };
const ranks=["Recruit","Deputy","Deputy II","Deputy III","Master Deputy","Corporal","Sergeant","Lieutenant","1st Lieutenant","Captain","Major","Undersheriff","Sheriff"] as const;
const rankLevel=(rank:string)=>ranks.indexOf(rank as (typeof ranks)[number]);

export function PromotionCreateForm({actorRank,canInitiate,candidates}:{actorRank:string;canInitiate:boolean;candidates:PromotionCandidate[]}){
  const router=useRouter();
  const [open,setOpen]=useState(false);
  const [candidateId,setCandidateId]=useState(candidates[0]?.id??"");
  const [requestedRank,setRequestedRank]=useState("");
  const [reason,setReason]=useState("");
  const [pending,setPending]=useState(false);
  const [notice,setNotice]=useState("");
  const candidate=candidates.find((item)=>item.id===candidateId)??candidates[0];
  const options=useMemo(()=>{
    if(!candidate)return [];
    const current=rankLevel(candidate.rank),actor=rankLevel(actorRank);
    return ranks.filter((rank,index)=>rank!=="Sheriff"&&index>current&&index<actor);
  },[candidate,actorRank]);

  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!candidate||pending)return;
    if(!requestedRank||reason.trim().length<10){setNotice("Choose the proposed rank and enter the reason for review.");return;}
    setPending(true);
    const rpc=canInitiate?"initiate_promotion_review":"recommend_promotion";
    const {error}=await (createClient() as any).rpc(rpc,{p_subject_profile_id:candidate.id,p_requested_rank:requestedRank,p_statement:reason.trim()});
    setPending(false);
    if(error){setNotice(error.message);return;}
    setOpen(false);setRequestedRank("");setReason("");
    setNotice(canInitiate?"Promotion review opened.":"Promotion recommendation submitted.");
    router.refresh();window.setTimeout(()=>setNotice(""),4500);
  }

  return <>
    <button className="portal-button portal-button--primary" disabled={!candidates.length} onClick={()=>setOpen(true)} type="button">{canInitiate?"Open Promotion Review":"Recommend Promotion"}</button>
    {open?<div className="portal-modal-backdrop" role="presentation" onMouseDown={(event)=>{if(event.currentTarget===event.target&&!pending)setOpen(false)}}><section className="portal-modal portal-modal--compact" role="dialog" aria-modal="true" aria-labelledby="promotion-create-title">
      <div className="portal-modal-heading"><div><span>{canInitiate?"Command initiated":"Supervisor recommendation"}</span><h2 id="promotion-create-title">{canInitiate?"Open Promotion Review":"Recommend Promotion"}</h2></div><button disabled={pending} onClick={()=>setOpen(false)} type="button" aria-label="Close">×</button></div>
      <form onSubmit={submit}>
        <div className="portal-form-grid"><label>Personnel<select value={candidateId} onChange={(event)=>{setCandidateId(event.target.value);setRequestedRank("")}} required>{candidates.map((item)=><option key={item.id} value={item.id}>{item.callSign?`${item.callSign} · `:""}{item.displayName} · {item.rank}</option>)}</select></label><label>Proposed rank<select value={requestedRank} onChange={(event)=>setRequestedRank(event.target.value)} required><option value="" disabled>Select rank</option>{options.map((rank)=><option key={rank}>{rank}</option>)}</select></label></div>
        <label className="portal-call-sign-field">Reason<textarea value={reason} onChange={(event)=>setReason(event.target.value)} rows={5} placeholder="State why this member should be reviewed for promotion." required /></label>
        <div className="portal-modal-actions"><button className="portal-button portal-button--secondary" disabled={pending} onClick={()=>setOpen(false)} type="button">Cancel</button><button className="portal-button portal-button--primary" disabled={pending||!requestedRank||reason.trim().length<10} type="submit">{pending?"Saving…":canInitiate?"Open Review":"Submit Recommendation"}</button></div>
      </form>
    </section></div>:null}
    {notice?<div className="portal-toast" role="status">{notice}</div>:null}
  </>;
}
