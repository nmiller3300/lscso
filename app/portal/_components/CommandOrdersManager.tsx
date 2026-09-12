"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type CommandOrderItem={id:string;orderNumber:number;title:string;body:string;issuer:string;targetAudience:string;acknowledgmentRequired:boolean;acknowledgmentDueAt:string|null;effectiveAt:string;status:string;createdAt:string;acknowledgedCount:number;targetCount:number};
const when=(value:string|null)=>value?new Date(value).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"}):"Not set";

export function CommandOrdersManager({initialOrders}:{initialOrders:CommandOrderItem[]}){
  const router=useRouter();
  const [orders,setOrders]=useState(initialOrders);
  const [open,setOpen]=useState(false);
  const [pending,setPending]=useState(false);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");

  async function create(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(pending)return;
    const form=new FormData(event.currentTarget);
    const title=String(form.get("title")??"").trim();
    const body=String(form.get("body")??"").trim();
    const target=String(form.get("target")??"All Personnel");
    const acknowledgmentRequired=form.get("ackRequired")==="on";
    const due=String(form.get("ackDue")??"").trim();
    const effective=String(form.get("effective")??"").trim();
    const publish=form.get("publish")==="on";
    if(title.length<4||body.length<10){setError("Enter the order title and directive.");return;}
    setPending(true);setError("");setNotice("");
    const {error:rpcError}=await (createClient() as any).rpc("create_command_order",{p_title:title,p_body:body,p_target_audience:target,p_acknowledgment_required:acknowledgmentRequired,p_acknowledgment_due_at:acknowledgmentRequired&&due?new Date(due).toISOString():null,p_effective_at:effective?new Date(effective).toISOString():new Date().toISOString(),p_publish:publish});
    setPending(false);
    if(rpcError){setError(rpcError.message);return;}
    setOpen(false);setNotice(publish?"Command Order published.":"Command Order saved as draft.");router.refresh();window.setTimeout(()=>setNotice(""),4500);
  }

  async function action(item:CommandOrderItem,kind:"publish"|"rescind"){
    if(pending)return;setPending(true);setError("");
    const rpc=kind==="publish"?"publish_command_order":"rescind_command_order";
    const {data,error:rpcError}=await (createClient() as any).rpc(rpc,{p_order_id:item.id});
    setPending(false);if(rpcError){setError(rpcError.message);return;}
    setOrders((current)=>current.map((row)=>row.id===item.id?{...row,status:data?.status??(kind==="publish"?"Active":"Rescinded")}:row));
    setNotice(kind==="publish"?"Command Order published.":"Command Order rescinded.");router.refresh();window.setTimeout(()=>setNotice(""),4500);
  }

  return <>
    <section className="portal-panel" style={{marginBottom:16}}><div className="portal-panel-heading"><div><p>Internal directives</p><h2>Command Orders</h2></div><button className="portal-button portal-button--primary" onClick={()=>setOpen(true)} type="button">New Command Order</button></div>
      <div className="portal-metric-grid"><article className="portal-metric portal-metric--gold"><span>Active</span><strong>{orders.filter((item)=>item.status==="Active").length}</strong><small>Current directives</small></article><article className="portal-metric"><span>Drafts</span><strong>{orders.filter((item)=>item.status==="Draft").length}</strong><small>Not yet issued</small></article><article className="portal-metric"><span>Awaiting acknowledgment</span><strong>{orders.filter((item)=>item.status==="Active"&&item.acknowledgmentRequired&&item.acknowledgedCount<item.targetCount).length}</strong><small>Orders with outstanding signatures</small></article><article className="portal-metric"><span>Archive</span><strong>{orders.filter((item)=>item.status==="Rescinded").length}</strong><small>Rescinded orders</small></article></div>
    </section>

    <section className="portal-panel"><div className="portal-panel-heading"><div><p>Permanent archive</p><h2>Order ledger</h2></div><span>{orders.length} total</span></div><div className="deputy-request-history">{orders.map((item)=><article key={item.id}><span>CO</span><div><strong>CO-{String(item.orderNumber).padStart(4,"0")} · {item.title}</strong><small>{item.status} · {item.targetAudience} · Effective {when(item.effectiveAt)} · Issued by {item.issuer}</small><p>{item.body}</p>{item.acknowledgmentRequired?<small>Acknowledged {item.acknowledgedCount}/{item.targetCount}{item.acknowledgmentDueAt?` · Due ${when(item.acknowledgmentDueAt)}`:""}</small>:null}</div><div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}><b>{item.status}</b>{item.status==="Draft"?<button className="portal-button portal-button--secondary" disabled={pending} onClick={()=>action(item,"publish")} type="button">Publish</button>:null}{item.status!=="Rescinded"?<button className="portal-button portal-button--danger" disabled={pending} onClick={()=>action(item,"rescind")} type="button">Rescind</button>:null}</div></article>)}</div></section>

    {open?<div className="portal-modal-backdrop" role="presentation" onMouseDown={(event)=>{if(event.currentTarget===event.target&&!pending)setOpen(false)}}><section className="portal-modal" role="dialog" aria-modal="true" aria-labelledby="command-order-title"><div className="portal-modal-heading"><div><span>Department directive</span><h2 id="command-order-title">New Command Order</h2></div><button disabled={pending} onClick={()=>setOpen(false)} type="button" aria-label="Close">×</button></div><form onSubmit={create}><div className="portal-form-grid"><label>Title<input name="title" maxLength={140} required /></label><label>Audience<select name="target" defaultValue="All Personnel"><option>All Personnel</option><option>Supervisors & Command</option><option>Command Only</option></select></label><label>Effective date/time<input name="effective" type="datetime-local" /></label><label>Acknowledgment due<input name="ackDue" type="datetime-local" /></label></div><label className="portal-call-sign-field">Directive<textarea name="body" rows={8} required placeholder="State the order clearly and directly." /></label><label className="portal-checkbox-row"><input name="ackRequired" type="checkbox"/><span><strong>Require personnel acknowledgment</strong></span></label><label className="portal-checkbox-row"><input name="publish" type="checkbox" defaultChecked/><span><strong>Publish immediately</strong></span></label>{error?<div className="portal-form-error" role="alert">{error}</div>:null}<div className="portal-modal-actions"><button className="portal-button portal-button--secondary" disabled={pending} onClick={()=>setOpen(false)} type="button">Cancel</button><button className="portal-button portal-button--primary" disabled={pending} type="submit">{pending?"Saving…":"Save Order"}</button></div></form></section></div>:null}
    {notice?<div className="portal-toast" role="status">{notice}</div>:null}
    {!open&&error?<div className="portal-toast" role="alert">{error}</div>:null}
  </>;
}
