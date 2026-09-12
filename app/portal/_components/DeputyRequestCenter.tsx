"use client";

import { useEffect,useMemo,useState,type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePortalProfile } from "./PortalProfileProvider";

type RequestKind="transfer"|"certification"|"record"|"legacy-promotion";
type RouteEvent={id:string;eventType:string;stageLabel:string;reviewerLabel:string|null;actorLabel:string|null;detail:string|null;createdAt:string};
type PersonnelRequest={databaseId:string;id:string;kind:RequestKind;label:string;submitted:string;status:string;routingStage:string;routingLabel:string;reviewerLabel:string;requestedUnitName:string|null;events:RouteEvent[]};
type DivisionOption={id:string;name:string};

const requestTypes={
  transfer:{short:"DT",label:"Division transfer",description:"Request reassignment with chain-of-command routing.",routing:"Direct supervisor → Receiving division → Executive Command",databaseType:"Division Transfer"},
  certification:{short:"CR",label:"Certification addition",description:"Submit proof and route it to Training for validation.",routing:"Training & Recruitment → Personnel file",databaseType:"Certification"},
  record:{short:"RR",label:"Record review",description:"Ask Personnel Command to review a possible record issue.",routing:"Executive Command → Attributed resolution",databaseType:"Other"},
} as const;
const createKinds=["transfer","certification","record"] as const;
const formatWhen=(value:string)=>new Date(value).toLocaleString("en-US",{month:"short",day:"numeric",year:"numeric",hour:"numeric",minute:"2-digit"});
const nextAction=(request:PersonnelRequest)=>["Approved","Denied","Cancelled","Completed"].includes(request.status)?"No further action required":request.routingStage==="Supervisor Review"?"Awaiting supervisor review":request.routingStage==="Receiving Division Review"?"Awaiting receiving-division review":request.routingStage==="Training Review"?"Awaiting Training & Recruitment review":request.routingStage==="Executive Command"?"Awaiting Executive Command decision":"Awaiting routed review";

export function DeputyRequestCenter(){
  const profile=usePortalProfile();
  const [selectedKind,setSelectedKind]=useState<(typeof createKinds)[number]|null>(null);
  const [requests,setRequests]=useState<PersonnelRequest[]>([]);
  const [divisions,setDivisions]=useState<DivisionOption[]>([]);
  const [notice,setNotice]=useState("");
  const [submitting,setSubmitting]=useState(false);

  async function loadRequests(){
    const supabase=createClient() as any;
    const {data:rows}=await supabase.from("personnel_requests").select("id,request_number,request_type,status,created_at,routing_stage,routing_label,current_reviewer_label,requested_unit_id").eq("requester_profile_id",profile.id).order("created_at",{ascending:false});
    const ids=(rows??[]).map((row:any)=>row.id);
    const [eventsResult,unitsResult]=await Promise.all([
      ids.length?supabase.from("personnel_request_route_events").select("id,request_id,event_type,stage_label,reviewer_label,actor_label,detail,created_at").in("request_id",ids).order("created_at",{ascending:true}):Promise.resolve({data:[]}),
      supabase.from("organizational_units").select("id,name,unit_type,active").eq("active",true).eq("unit_type","Division").order("sort_order").order("name"),
    ]);
    const unitNames=new Map<string,string>((unitsResult.data??[]).map((unit:any)=>[String(unit.id),String(unit.name)]));
    const eventMap=new Map<string,RouteEvent[]>();
    for(const event of eventsResult.data??[]){const list=eventMap.get(event.request_id)??[];list.push({id:event.id,eventType:event.event_type,stageLabel:event.stage_label,reviewerLabel:event.reviewer_label,actorLabel:event.actor_label,detail:event.detail,createdAt:event.created_at});eventMap.set(event.request_id,list);}
    setDivisions((unitsResult.data??[]).filter((unit:any)=>unit.name!==profile.division&&unit.name!=="Office of the Sheriff").map((unit:any)=>({id:String(unit.id),name:String(unit.name)})));
    setRequests((rows??[]).map((row:any)=>{
      const kind:RequestKind=row.request_type==="Division Transfer"?"transfer":row.request_type==="Certification"?"certification":row.request_type==="Promotion"?"legacy-promotion":"record";
      const label=kind==="legacy-promotion"?"Legacy promotion request":requestTypes[kind].label;
      return {databaseId:row.id,id:`RQ-${String(row.request_number).padStart(4,"0")}`,kind,label,submitted:formatWhen(row.created_at),status:row.status,routingStage:row.routing_stage??"Routing pending",routingLabel:row.routing_label??"Routing pending",reviewerLabel:row.current_reviewer_label??(["Approved","Denied"].includes(row.status)?"Completed":"Command routing pending"),requestedUnitName:row.requested_unit_id?unitNames.get(String(row.requested_unit_id))??"Requested division":null,events:eventMap.get(row.id)??[]};
    }));
  }
  useEffect(()=>{void loadRequests();},[profile.id]);
  const openCount=useMemo(()=>requests.filter((request)=>!["Approved","Denied","Cancelled","Completed"].includes(request.status)).length,[requests]);

  async function submitRequest(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(!selectedKind||submitting)return;
    const form=new FormData(event.currentTarget),summary=String(form.get("requestSummary")??"").trim(),requestedUnitId=selectedKind==="transfer"?String(form.get("requestedUnitId")??"").trim():"";
    if(summary.length<10){setNotice("Add a brief operational explanation before submitting this request.");return;}
    if(selectedKind==="transfer"&&!requestedUnitId){setNotice("Choose the division you are requesting.");return;}
    setSubmitting(true);const type=requestTypes[selectedKind];
    const {data,error}=await (createClient() as any).from("personnel_requests").insert({requester_profile_id:profile.id,request_type:type.databaseType,subject:type.label,details:summary,requested_effective_at:form.get("effectiveDate")?new Date(`${String(form.get("effectiveDate"))}T12:00:00`).toISOString():null,requested_unit_id:requestedUnitId||null,status:"Submitted",is_test_record:profile.is_test_account}).select("request_number,routing_label,current_reviewer_label").single();
    setSubmitting(false);if(error||!data){setNotice(error?.message??"The request could not be submitted.");return;}
    setSelectedKind(null);setNotice(`RQ-${String(data.request_number).padStart(4,"0")} submitted.`);await loadRequests();window.setTimeout(()=>setNotice(""),4500);
  }

  return <section className="deputy-request-section" id="requests"><div className="portal-section-heading"><div><p>Self-service workflow</p><h2>Requests</h2></div><span>{openCount?`${openCount} in review`:"No open requests"}</span></div>
    <div className="deputy-request-grid">{createKinds.map((kind)=>{const item=requestTypes[kind];return <button key={kind} onClick={()=>setSelectedKind(kind)} type="button"><span>{item.short}</span><strong>{item.label}</strong><small>{item.description}</small><b>Begin request →</b></button>})}</div>
    {requests.length?<div className="deputy-request-history request-routing-history"><div className="portal-panel-heading"><div><p>Submitted requests</p><h2>Request status</h2></div><span>Live routing</span></div>{requests.map((request)=><article className="request-routing-card" key={request.id}><span>{request.kind==="legacy-promotion"?"PR":requestTypes[request.kind].short}</span><div className="request-routing-main"><strong>{request.label}</strong><small>{request.id} · Submitted {request.submitted}</small>{request.requestedUnitName?<small>Requested division: {request.requestedUnitName}</small>:null}<div className="request-routing-status"><div><span>Currently with</span><strong>{request.reviewerLabel}</strong></div><div><span>Routing stage</span><strong>{request.routingLabel}</strong></div><div><span>Next action</span><strong>{nextAction(request)}</strong></div></div>{request.events.length?<details className="request-route-events"><summary>Routing history <span>{request.events.length}</span></summary><div>{request.events.map((event)=><article key={event.id}><span>{event.eventType}</span><strong>{event.stageLabel}</strong><small>{formatWhen(event.createdAt)}{event.actorLabel?` · ${event.actorLabel}`:""}</small>{event.detail?<p>{event.detail}</p>:null}</article>)}</div></details>:null}</div><b>{request.status}</b></article>)}</div>:null}
    {selectedKind?<div className="portal-modal-backdrop" role="presentation" onMouseDown={(event)=>{if(event.currentTarget===event.target&&!submitting)setSelectedKind(null)}}><section className="portal-modal portal-modal--compact" role="dialog" aria-modal="true" aria-labelledby="request-form-title"><div className="portal-modal-heading"><div><span>{requestTypes[selectedKind].routing}</span><h2 id="request-form-title">{requestTypes[selectedKind].label}</h2></div><button onClick={()=>setSelectedKind(null)} type="button" aria-label="Close">×</button></div><form onSubmit={submitRequest}><label className="portal-call-sign-field">Request summary<textarea name="requestSummary" required rows={5} placeholder="Explain what you are requesting and why." /></label><div className="portal-form-grid"><label>Preferred effective date<input name="effectiveDate" type="date" /></label>{selectedKind==="transfer"?<label>Requested division<select name="requestedUnitId" required defaultValue=""><option value="" disabled>Select division</option>{divisions.map((division)=><option key={division.id} value={division.id}>{division.name}</option>)}</select></label>:<label>Routing<select disabled defaultValue="automatic"><option value="automatic">Automatic</option></select></label>}</div><div className="portal-modal-actions"><button className="portal-button portal-button--secondary" disabled={submitting} onClick={()=>setSelectedKind(null)} type="button">Cancel</button><button className="portal-button portal-button--primary" disabled={submitting} type="submit">{submitting?"Submitting…":"Submit Request"}</button></div></form></section></div>:null}
    {notice?<div className="portal-toast" role="status">{notice}</div>:null}
  </section>;
}
