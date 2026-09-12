import { redirect } from "next/navigation";
import { PersonnelCommandOrders, type PersonnelOrderItem } from "../_components/PersonnelCommandOrders";
import { PortalShell } from "../_components/PortalShell";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";

export default async function PersonnelOrdersPage(){
  const profile=await getCurrentPortalProfile();
  if(!profile)redirect("/portal/login");
  const supabase=await createClient() as any;
  const [{data:orders},{data:acks},{data:issuers}]=await Promise.all([
    supabase.from("command_orders").select("id,order_number,title,body,issuing_profile_id,target_audience,acknowledgment_required,acknowledgment_due_at,effective_at,status").eq("status","Active").lte("effective_at",new Date().toISOString()).order("order_number",{ascending:false}),
    supabase.from("command_order_acknowledgments").select("command_order_id,acknowledged_at").eq("profile_id",profile.id),
    supabase.from("personnel_profiles").select("id,display_name,rank").in("access_tier",["Executive","Command"]),
  ]);
  const issuerMap=new Map((issuers??[]).map((row:any)=>[row.id,`${row.rank} ${row.display_name}`]));
  const ackMap=new Map((acks??[]).map((row:any)=>[row.command_order_id,row.acknowledged_at]));
  const items:PersonnelOrderItem[]=(orders??[]).map((row:any)=>({id:row.id,orderNumber:Number(row.order_number),title:row.title,body:row.body,issuer:issuerMap.get(row.issuing_profile_id)??"Command",targetAudience:row.target_audience,acknowledgmentRequired:row.acknowledgment_required,acknowledgmentDueAt:row.acknowledgment_due_at,effectiveAt:row.effective_at,acknowledgedAt:ackMap.get(row.id)??null}));
  return <PortalShell active="orders" audience="deputy" eyebrow="Department Directives" title="Command Orders"><PersonnelCommandOrders initialOrders={items}/></PortalShell>;
}
