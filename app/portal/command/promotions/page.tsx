import { redirect } from "next/navigation";
import { PromotionCaseList, type PromotionCaseItem } from "../../_components/PromotionCaseList";
import { PromotionCreateForm, type PromotionCandidate } from "../../_components/PromotionCreateForm";
import { PortalShell } from "../../_components/PortalShell";
import { loadPersonnelPurview } from "@/lib/authorization/load-personnel-purview";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";

const WORKSPACE_TIERS=new Set(["Executive","Command","Supervisor","Preliminary"]);
const COMMAND_INITIATORS=new Set(["Sheriff","Undersheriff","Major","Captain"]);
const FINAL_DECIDERS=new Set(["Sheriff","Undersheriff","Major"]);

export default async function PromotionsPage(){
  const profile=await getCurrentPortalProfile();
  if(!profile||!WORKSPACE_TIERS.has(profile.access_tier))redirect("/portal/my-office");
  const supabase=await createClient() as any;
  const canInitiate=COMMAND_INITIATORS.has(profile.rank);
  const canDecide=FINAL_DECIDERS.has(profile.rank);

  let candidates:PromotionCandidate[]=[];
  if(canInitiate){
    const {data}=await supabase.from("personnel_profiles").select("id,personnel_id,display_name,rank,call_sign,status").in("status",["Active","Acting"]).neq("id",profile.id).neq("rank","Sheriff").order("display_name");
    candidates=(data??[]).map((row:any)=>({id:row.id,personnelId:row.personnel_id,displayName:row.display_name,rank:row.rank,callSign:row.call_sign}));
  }else{
    const purview=await loadPersonnelPurview(profile);
    const unique=new Map<string,PromotionCandidate>();
    for(const row of purview.rows){
      if(row.profileId===profile.id||!["Active","Acting"].includes(row.status)||row.rank==="Sheriff")continue;
      unique.set(row.profileId,{id:row.profileId,personnelId:row.personnelId,displayName:row.displayName,rank:row.rank,callSign:row.callSign});
    }
    candidates=Array.from(unique.values()).sort((a,b)=>a.displayName.localeCompare(b.displayName));
  }

  const [{data:caseRows},{data:evaluationRows}]=await Promise.all([
    supabase.from("promotion_cases").select("id,case_number,subject_profile_id,source_type,initiated_by_profile_id,current_rank,requested_rank,statement,status,decision_notes,effective_at,created_at").order("created_at",{ascending:false}),
    supabase.from("guardian_records").select("guardian_number,subject_profile_id,status,created_at,structured_fields").eq("record_type","Performance Evaluation").order("created_at",{ascending:false}),
  ]);
  const cases=caseRows??[];
  const profileIds=Array.from(new Set(cases.flatMap((row:any)=>[row.subject_profile_id,row.initiated_by_profile_id])));
  const [{data:names},{data:eventRows}]=await Promise.all([
    profileIds.length?supabase.from("personnel_profiles").select("id,personnel_id,display_name,call_sign").in("id",profileIds):Promise.resolve({data:[]}),
    cases.length?supabase.from("promotion_case_events").select("id,promotion_case_id,event_type,actor_label,detail,created_at").in("promotion_case_id",cases.map((row:any)=>row.id)).order("created_at",{ascending:true}):Promise.resolve({data:[]}),
  ]);
  const nameMap=new Map((names??[]).map((row:any)=>[row.id,row]));
  const eventsByCase=new Map<string,any[]>();
  for(const event of eventRows??[]){const list=eventsByCase.get(event.promotion_case_id)??[];list.push(event);eventsByCase.set(event.promotion_case_id,list);}

  const evaluationsBySubject=new Map<string,any[]>();
  for(const evaluation of evaluationRows??[]){
    const fields=evaluation.structured_fields&&typeof evaluation.structured_fields==="object"?evaluation.structured_fields:{};
    if(fields.lifecycle_state==="Scheduled"||evaluation.status==="Denied")continue;
    const list=evaluationsBySubject.get(evaluation.subject_profile_id)??[];
    list.push({...evaluation,fields});
    evaluationsBySubject.set(evaluation.subject_profile_id,list);
  }

  const items:PromotionCaseItem[]=cases.map((row:any)=>{
    const subject=nameMap.get(row.subject_profile_id) as any;
    const initiator=nameMap.get(row.initiated_by_profile_id) as any;
    const evaluationPool=evaluationsBySubject.get(row.subject_profile_id)??[];
    const latest=evaluationPool.find((evaluation:any)=>evaluation.fields.evaluation_kind==="Promotion Readiness")??evaluationPool[0]??null;
    const evaluation=latest?{guardianNumber:Number(latest.guardian_number),kind:String(latest.fields.evaluation_kind??"Performance"),average:Number(latest.fields.overall_average??0),rating:String(latest.fields.overall_rating??"Not rated"),status:latest.status,createdAt:latest.created_at,remediationRequired:latest.fields.remediation_required===true}:null;
    return {id:row.id,caseNumber:Number(row.case_number),subjectPersonnelId:subject?.personnel_id??"",subjectName:subject?.display_name??"Personnel",currentRank:row.current_rank,requestedRank:row.requested_rank,sourceType:row.source_type,initiatorName:initiator?.display_name??"Personnel",statement:row.statement,status:row.status,decisionNotes:row.decision_notes,createdAt:row.created_at,evaluation,events:(eventsByCase.get(row.id)??[]).map((event:any)=>({id:event.id,eventType:event.event_type,actorLabel:event.actor_label,detail:event.detail,createdAt:event.created_at}))};
  });
  const openCount=items.filter((item)=>["Submitted","Under Review"].includes(item.status)).length;

  return <PortalShell active="promotions" eyebrow="Career Progression" title="Promotion Review" actions={<PromotionCreateForm actorRank={profile.rank} canInitiate={canInitiate} candidates={candidates}/>}>
    <section className="portal-metric-grid" style={{marginBottom:16}}><article className="portal-metric portal-metric--gold"><span>Open reviews</span><strong>{openCount}</strong><small>Active promotion cases</small></article><article className="portal-metric"><span>Self requested</span><strong>{items.filter((item)=>item.sourceType==="Self Request"&&["Submitted","Under Review"].includes(item.status)).length}</strong><small>Member initiated</small></article><article className="portal-metric"><span>Supervisor recommended</span><strong>{items.filter((item)=>item.sourceType==="Supervisor Recommendation"&&["Submitted","Under Review"].includes(item.status)).length}</strong><small>Supervisor initiated</small></article><article className="portal-metric"><span>Command initiated</span><strong>{items.filter((item)=>item.sourceType==="Command Initiated"&&["Submitted","Under Review"].includes(item.status)).length}</strong><small>No request required</small></article></section>
    <PromotionCaseList initialCases={items} canBegin={canInitiate} canDecide={canDecide}/>
  </PortalShell>;
}
