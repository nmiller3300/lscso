import { NextResponse } from "next/server";
import { canAccessPersonnelRecord } from "@/lib/authorization/can-access-personnel-record";
import { buildPersonnelRecordPdf } from "@/lib/pdf/simple-personnel-pdf";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";

const allowedTiers=new Set(["Executive","Command"]);
const validSections=new Set(["career","assignments","certifications","training","awards","guardians","administrative"]);

function date(value:string|null|undefined){return value?new Date(value.length===10?`${value}T12:00:00`:value).toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"}):"Not recorded";}
function text(value:unknown){return String(value??"").trim();}
function linesFromPairs(rows:Array<[string,string]>){return rows.map(([label,value])=>({text:`${label}: ${value}`,spaceAfter:1}));}

export async function GET(request:Request,{params}:{params:Promise<{personnelId:string}>}){
  const actor=await getCurrentPortalProfile();
  if(!actor||!allowedTiers.has(actor.access_tier))return NextResponse.json({error:"Command authority required."},{status:403});
  const {personnelId}=await params;
  const access=await canAccessPersonnelRecord(actor,personnelId);
  if(!access.allowed)return NextResponse.json({error:"You do not have permission to export this personnel record."},{status:403});

  const url=new URL(request.url);
  const purpose=text(url.searchParams.get("purpose")).slice(0,180);
  if(purpose.length<3)return NextResponse.json({error:"A release purpose is required."},{status:400});
  const requested=(url.searchParams.get("sections")??"").split(",").map((value)=>value.trim()).filter((value)=>validSections.has(value));
  const sections=requested.length?requested:Array.from(validSections);
  const supabase=await createClient() as any;

  const {data:member,error:memberError}=await supabase.from("personnel_profiles").select("id,personnel_id,display_name,rank,call_sign,division,supervisor_label,status,access_tier,probation_started_at,probation_ends_at,created_at").eq("personnel_id",personnelId.toUpperCase()).maybeSingle();
  if(memberError||!member)return NextResponse.json({error:"Personnel record not found."},{status:404});

  const jobs:Array<PromiseLike<any>>=[];
  const keys:string[]=[];
  const add=(key:string,promise:PromiseLike<any>)=>{keys.push(key);jobs.push(promise)};
  if(sections.includes("career"))add("career",supabase.from("personnel_career_events").select("event_type,effective_at,from_rank,to_rank,title,notes").eq("profile_id",member.id).order("effective_at",{ascending:true}));
  if(sections.includes("assignments"))add("assignments",supabase.from("personnel_unit_assignments").select("assignment_type,starts_at,ends_at,notes,organizational_units(name,unit_type)").eq("profile_id",member.id).order("starts_at",{ascending:true}));
  if(sections.includes("certifications"))add("certifications",supabase.from("certifications").select("name,issuer,status,issued_on,expires_on,notes").eq("profile_id",member.id).order("created_at",{ascending:true}));
  if(sections.includes("training"))add("training",supabase.from("personnel_training_records").select("record_type,category,title,provider,completed_on,verification_status,notes,created_at").eq("profile_id",member.id).order("completed_on",{ascending:true,nullsFirst:false}));
  if(sections.includes("awards"))add("awards",supabase.from("personnel_awards").select("award_name,awarded_on,citation,awarded_by").eq("profile_id",member.id).order("awarded_on",{ascending:true}));
  if(sections.includes("guardians"))add("guardians",supabase.from("guardian_records").select("guardian_number,record_type,status,title,incident_at,location,policy_reference,observed_behavior,expected_standard,action_taken,follow_up_plan,employee_response,points_assessed,issued_at,acknowledged_at,closed_at").eq("subject_profile_id",member.id).order("created_at",{ascending:true}));
  if(sections.includes("administrative"))add("administrative",supabase.from("personnel_flags").select("flag_type,notes,active,created_at,resolved_at").eq("profile_id",member.id).order("created_at",{ascending:true}));

  const settled=await Promise.all(jobs);
  const data=new Map<string,any[]>();
  for(let index=0;index<keys.length;index+=1){if(settled[index]?.error)return NextResponse.json({error:`Unable to load ${keys[index]} records.`},{status:500});data.set(keys[index],settled[index]?.data??[]);}

  const pdfSections:any[]=[];
  pdfSections.push({title:"Service Summary",lines:linesFromPairs([
    ["Personnel ID",member.personnel_id],["Name",member.display_name],["Rank",member.rank],["Call Sign",member.call_sign??"Not assigned"],["Status",member.status],["Division",member.division??"Not recorded"],["Supervisor",member.supervisor_label??"Not recorded"],["Portal Classification",member.access_tier],["Probation Start",date(member.probation_started_at)],["Probation End",date(member.probation_ends_at)]
  ])});

  if(data.has("career"))pdfSections.push({title:"Career / Service History",lines:data.get("career")!.flatMap((row:any)=>[
    {text:`${date(row.effective_at)} - ${text(row.title)||text(row.event_type)}`,bold:true,spaceAfter:1},
    ...(row.from_rank||row.to_rank?[{text:`Rank: ${row.from_rank??"-"} -> ${row.to_rank??"-"}`,indent:12,spaceAfter:1}]:[]),
    ...(row.notes?[{text:text(row.notes),indent:12,spaceAfter:4}]:[])
  ])});
  if(data.has("assignments"))pdfSections.push({title:"Assignments",lines:data.get("assignments")!.flatMap((row:any)=>{const unit=Array.isArray(row.organizational_units)?row.organizational_units[0]:row.organizational_units;return [{text:`${unit?.name??"Unknown unit"} - ${row.assignment_type}`,bold:true,spaceAfter:1},{text:`${date(row.starts_at)} to ${row.ends_at?date(row.ends_at):"Current"}${row.notes?` - ${row.notes}`:""}`,indent:12,spaceAfter:4}]} )});
  if(data.has("certifications"))pdfSections.push({title:"Certifications",lines:data.get("certifications")!.flatMap((row:any)=>[{text:`${row.name} - ${row.status}`,bold:true,spaceAfter:1},{text:`Issuer: ${row.issuer??"Not recorded"} | Issued: ${date(row.issued_on)} | Expires: ${row.expires_on?date(row.expires_on):"No expiration"}`,indent:12,spaceAfter:1},...(row.notes?[{text:text(row.notes),indent:12,spaceAfter:4}]:[])] )});
  if(data.has("training"))pdfSections.push({title:"Training Record",lines:data.get("training")!.flatMap((row:any)=>[{text:`${row.title} - ${row.record_type}${row.category?` / ${row.category}`:""}`,bold:true,spaceAfter:1},{text:`Provider: ${row.provider??"LSCSO"} | Completed: ${date(row.completed_on)} | ${row.verification_status??"Recorded"}`,indent:12,spaceAfter:1},...(row.notes?[{text:text(row.notes),indent:12,spaceAfter:4}]:[])] )});
  if(data.has("awards"))pdfSections.push({title:"Awards / Recognition",lines:data.get("awards")!.flatMap((row:any)=>[{text:`${row.award_name} - ${date(row.awarded_on)}`,bold:true,spaceAfter:1},...(row.citation?[{text:text(row.citation),indent:12,spaceAfter:4}]:[])] )});
  if(data.has("guardians"))pdfSections.push({title:"Guardian Record",lines:data.get("guardians")!.flatMap((row:any)=>{
    const detail=[row.observed_behavior,row.expected_standard?`Expected standard: ${row.expected_standard}`:null,row.action_taken?`Action: ${row.action_taken}`:null,row.follow_up_plan?`Follow-up: ${row.follow_up_plan}`:null,row.employee_response?`Employee response: ${row.employee_response}`:null].filter(Boolean).map((value)=>({text:text(value),indent:12,spaceAfter:2}));
    return [{text:`G-${String(row.guardian_number).padStart(4,"0")} - ${row.record_type} - ${row.status}`,bold:true,spaceAfter:1},{text:`${row.title} | Incident: ${date(row.incident_at)}${row.location?` | ${row.location}`:""}${row.points_assessed?` | Points: ${row.points_assessed}`:""}`,indent:12,spaceAfter:2},...detail];
  })});
  if(data.has("administrative"))pdfSections.push({title:"Administrative Flags",lines:data.get("administrative")!.flatMap((row:any)=>[{text:`${row.flag_type} - ${row.active?"Active":"Resolved"}`,bold:true,spaceAfter:1},{text:`Opened: ${date(row.created_at)}${row.resolved_at?` | Resolved: ${date(row.resolved_at)}`:""}${row.notes?` | ${row.notes}`:""}`,indent:12,spaceAfter:4}])});

  const generatedAt=new Date().toLocaleString("en-US",{year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit",timeZoneName:"short"});
  const generatedBy=`${actor.rank} ${actor.display_name}`;
  const pdf=buildPersonnelRecordPdf({departmentName:"LOS SANTOS COUNTY SHERIFF'S OFFICE",title:`Personnel Record - ${member.display_name}`,subtitle:`${member.rank} | ${member.personnel_id} | ${member.call_sign??"No call sign"}`,generatedAt,generatedBy,purpose,sections:pdfSections});

  const {error:auditError}=await supabase.rpc("record_personnel_record_export",{p_subject_profile_id:member.id,p_purpose:purpose,p_sections:sections});
  if(auditError)console.error("[Personnel Record Export Audit]",auditError);

  const filename=`LSCSO-${member.personnel_id}-${member.display_name.replace(/[^A-Za-z0-9]+/g,"-").replace(/^-|-$/g,"")}-Personnel-Record.pdf`;
  return new NextResponse(pdf,{status:200,headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="${filename}"`,"Cache-Control":"no-store, private"}});
}
