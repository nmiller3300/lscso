"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Person = { id: string; display_name: string; rank: string; call_sign: string | null };
type Flag = { id: string; profile_id: string; flag_type: string; notes: string | null; created_at: string };
type Award = { id: string; profile_id: string; award_name: string; citation: string; awarded_on: string };

const awardTypes = ["Medal of Valor","Medal of Merit","Life Saving Award","Distinguished Service Award"] as const;
const medalAssetPaths: Record<(typeof awardTypes)[number], string> = {
  "Medal of Valor": "/images/medals/medal-of-valor.jpeg",
  "Medal of Merit": "/images/medals/medal-of-merit.jpeg",
  "Life Saving Award": "/images/medals/life-saving-award.jpeg",
  "Distinguished Service Award": "/images/medals/distinguished-service-award.jpeg",
};
const flagTypes = ["Promotion Eligible","Promotion Hold","Training Required","Certification Deficiency","Administrative Review","Probationary","FTO Eligible","Supervisor Eligible","Command Review Required","Return From LOA Review","Restricted Duty","Separation Pending"];

export function ServiceRecordWorkspace({ personnel, flags, awards }: { personnel: Person[]; flags: Flag[]; awards: Award[] }) {
  const router = useRouter();
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  async function award(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const medal = String(form.get("award")) as (typeof awardTypes)[number];
    setPending(true);
    const supabase = createClient() as any;
    const { error } = await supabase.rpc("issue_personnel_award", {
      target_profile_id: String(form.get("member")), award_type: medal,
      citation_text: String(form.get("citation") ?? "").trim(),
      award_date: String(form.get("awardDate") ?? "") || new Date().toISOString().slice(0,10),
      asset_path: medalAssetPaths[medal],
    });
    setPending(false);
    if (error) { setNotice(error.message); return; }
    setNotice("Medal issued and added to the permanent service record."); router.refresh();
  }

  async function addFlag(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form=new FormData(event.currentTarget); setPending(true); const supabase=createClient() as any; const {error}=await supabase.rpc("add_personnel_flag",{target_profile_id:String(form.get("member")),flag_name:String(form.get("flag")),flag_notes:String(form.get("notes")??"").trim()||null}); setPending(false); if(error){setNotice(error.message);return;} setNotice("Personnel flag added and audited."); router.refresh(); }
  async function resolveFlag(id:string){setPending(true);const supabase=createClient() as any;const {error}=await supabase.rpc("resolve_personnel_flag",{flag_id:id,resolution_notes:"Resolved through Command Service Records"});setPending(false);if(error){setNotice(error.message);return;}setNotice("Personnel flag resolved.");router.refresh();}
  async function restore(event:FormEvent<HTMLFormElement>){event.preventDefault();const form=new FormData(event.currentTarget);const type=String(form.get("restorationType"));const supabase=createClient() as any;setPending(true);const result=type==="Outstanding Performance"?await supabase.rpc("award_outstanding_performance",{target_profile_id:String(form.get("member")),reason_text:String(form.get("reason")??"")}):await supabase.rpc("award_commendation_restoration",{target_profile_id:String(form.get("member")),restore_points:Number(form.get("points")??1),reason_text:String(form.get("reason")??"")});setPending(false);if(result.error){setNotice(result.error.message);return;}setNotice(`Disciplinary restoration processed. Current score: ${result.data?.points??"updated"}.`);router.refresh();}

  return <>
    <div className="portal-dashboard-grid"><section className="portal-panel"><div className="portal-panel-heading"><div><p>Awards & decorations</p><h2>Issue medal</h2></div><span>Separate from commendations</span></div><form onSubmit={award}><div className="portal-form-grid"><label>Personnel<select required name="member" defaultValue=""><option disabled value="">Select personnel</option>{personnel.map(p=><option key={p.id} value={p.id}>{p.display_name} · {p.rank}</option>)}</select></label><label>Medal<select name="award">{awardTypes.map(a=><option key={a}>{a}</option>)}</select></label></div><label className="portal-call-sign-field">Citation<textarea required minLength={10} name="citation" rows={4} placeholder="Document why this decoration is being awarded..." /></label><label>Award date<input name="awardDate" type="date" defaultValue={new Date().toISOString().slice(0,10)} /></label><div className="portal-modal-actions"><button className="portal-button portal-button--primary" disabled={pending}>Issue medal</button></div></form></section>
    <section className="portal-panel"><div className="portal-panel-heading"><div><p>Administrative indicators</p><h2>Add personnel flag</h2></div><span>Flags do not replace Guardians</span></div><form onSubmit={addFlag}><div className="portal-form-grid"><label>Personnel<select required name="member" defaultValue=""><option disabled value="">Select personnel</option>{personnel.map(p=><option key={p.id} value={p.id}>{p.display_name} · {p.rank}</option>)}</select></label><label>Flag<select name="flag">{flagTypes.map(f=><option key={f}>{f}</option>)}</select></label></div><label className="portal-call-sign-field">Administrative notes<textarea name="notes" rows={4} /></label><div className="portal-modal-actions"><button className="portal-button portal-button--primary" disabled={pending}>Add flag</button></div></form></section></div>
    <section className="portal-panel"><div className="portal-panel-heading"><div><p>Disciplinary standing</p><h2>Point restoration</h2></div><span>Restoration never creates stored credit</span></div><form onSubmit={restore}><div className="portal-form-grid portal-form-grid--three"><label>Personnel<select required name="member" defaultValue=""><option disabled value="">Select personnel</option>{personnel.map(p=><option key={p.id} value={p.id}>{p.display_name} · {p.rank}</option>)}</select></label><label>Restoration type<select name="restorationType"><option>Outstanding Performance</option><option>Commendation Restoration</option></select></label><label>Requested restoration<select name="points"><option value="1">1 point</option><option value="2">2 points</option><option value="3">3 points</option></select></label></div><label className="portal-call-sign-field">Reason<textarea required minLength={4} name="reason" rows={3} /></label><div className="portal-form-protection"><strong>Enforced by Supabase</strong><span>Outstanding Performance is limited to 1 point per qualifying month. Commendation restoration is limited to 1–3 points and no more than 3 per month. Scores cannot fall below 0.</span></div><div className="portal-modal-actions"><button className="portal-button portal-button--primary" disabled={pending}>Apply restoration</button></div></form></section>
    <section className="portal-panel"><div className="portal-panel-heading"><div><p>Active administration</p><h2>Personnel flags</h2></div><span>{flags.length} active</span></div><div className="deputy-request-history">{flags.map(flag=>{const person=personnel.find(p=>p.id===flag.profile_id);return <article key={flag.id}><span>PF</span><div><strong>{flag.flag_type}</strong><small>{person?.display_name??"Personnel"} · {flag.notes??"No note"}</small></div><button disabled={pending} onClick={()=>resolveFlag(flag.id)} type="button">Resolve</button></article>})}{!flags.length?<div className="portal-empty-state"><strong>No active personnel flags.</strong></div>:null}</div></section>
    <section className="portal-panel"><div className="portal-panel-heading"><div><p>Permanent record</p><h2>Recent medals</h2></div><span>{awards.length} recorded</span></div><div className="deputy-request-history">{awards.map(a=>{const person=personnel.find(p=>p.id===a.profile_id);return <article key={a.id}><span>MD</span><div><strong>{a.award_name}</strong><small>{person?.display_name??"Personnel"} · {a.citation}</small></div><b>{new Date(a.awarded_on).toLocaleDateString()}</b></article>})}{!awards.length?<div className="portal-empty-state"><strong>No medals have been issued yet.</strong></div>:null}</div></section>{notice?<div className="portal-toast" role="status">{notice}</div>:null}
  </>;
}
