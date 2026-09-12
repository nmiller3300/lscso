import { redirect } from "next/navigation";
import { CommandOrdersManager, type CommandOrderItem } from "../../_components/CommandOrdersManager";
import { PortalShell } from "../../_components/PortalShell";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";

export default async function CommandOrdersPage(){
  const profile=await getCurrentPortalProfile();
  if(!profile||!["Executive","Command"].includes(profile.access_tier))redirect("/portal/my-office");
  const supabase=await createClient() as any;
  const [{data:orders},{data:acks},{data:profiles}]=await Promise.all([
    supabase.from("command_orders").select("id,order_number,title,body,issuing_profile_id,target_audience,acknowledgment_required,acknowledgment_due_at,effective_at,status,created_at").order("order_number",{ascending:false}),
    supabase.from("command_order_acknowledgments").select("command_order_id,profile_id"),
    supabase.from("personnel_profiles").select("id,display_name,rank,access_tier,status").in("status",["Active","Acting"]),
  ]);
  const people=profiles??[];
  const names=new Map(people.map((row:any)=>[row.id,`${row.rank} ${row.display_name}`]));
  const countTarget=(audience:string)=>people.filter((row:any)=>audience==="All Personnel"||audience==="Command Only"&&["Executive","Command"].includes(row.access_tier)||audience==="Supervisors & Command"&&["Executive","Command","Supervisor","Preliminary"].includes(row.access_tier)).length;
  const items:CommandOrderItem[]=(orders??[]).map((row:any)=>({id:row.id,orderNumber:Number(row.order_number),title:row.title,body:row.body,issuer:names.get(row.issuing_profile_id)??"Command",targetAudience:row.target_audience,acknowledgmentRequired:row.acknowledgment_required,acknowledgmentDueAt:row.acknowledgment_due_at,effectiveAt:row.effective_at,status:row.status,createdAt:row.created_at,acknowledgedCount:(acks??[]).filter((ack:any)=>ack.command_order_id===row.id).length,targetCount:countTarget(row.target_audience)}));
  return <PortalShell active="orders" eyebrow="Department Governance" title="Command Orders"><CommandOrdersManager initialOrders={items}/></PortalShell>;
}
