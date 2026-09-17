import { redirect } from "next/navigation";
import { CommandOrdersManager, type CommandOrderItem } from "../../_components/CommandOrdersManager";
import { PortalShell } from "../../_components/PortalShell";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";

const audienceIncludes = (audience: string, accessTier: string) =>
  audience === "All Personnel"
  || (audience === "Command Only" && ["Executive", "Command"].includes(accessTier))
  || (audience === "Supervisors & Command" && ["Executive", "Command", "Supervisor", "Preliminary"].includes(accessTier));

export default async function CommandOrdersPage() {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) redirect("/portal/my-office");

  const supabase = await createClient() as any;
  const [{ data: orders }, { data: acks }, { data: profiles }] = await Promise.all([
    supabase
      .from("command_orders")
      .select("id,order_number,title,body,issuing_profile_id,target_audience,acknowledgment_required,acknowledgment_due_at,effective_at,status,created_at")
      .order("order_number", { ascending: false }),
    supabase
      .from("command_order_acknowledgments")
      .select("command_order_id,profile_id,acknowledged_at"),
    supabase
      .from("personnel_profiles")
      .select("id,display_name,rank,access_tier,status")
      .in("status", ["Active", "Acting"]),
  ]);

  const people = profiles ?? [];
  const names = new Map(people.map((row: any) => [row.id, `${row.rank} ${row.display_name}`]));
  const acknowledgmentMap = new Map<string, Map<string, string>>();
  for (const acknowledgment of acks ?? []) {
    const current = acknowledgmentMap.get(acknowledgment.command_order_id) ?? new Map<string, string>();
    current.set(acknowledgment.profile_id, acknowledgment.acknowledged_at);
    acknowledgmentMap.set(acknowledgment.command_order_id, current);
  }

  const items: CommandOrderItem[] = (orders ?? []).map((row: any) => {
    const orderAcknowledgments = acknowledgmentMap.get(row.id) ?? new Map<string, string>();
    const recipients = people
      .filter((person: any) => audienceIncludes(row.target_audience, person.access_tier))
      .map((person: any) => ({
        profileId: person.id,
        name: `${person.rank} ${person.display_name}`,
        acknowledgedAt: orderAcknowledgments.get(person.id) ?? null,
      }));

    return {
      id: row.id,
      orderNumber: Number(row.order_number),
      title: row.title,
      body: row.body,
      issuer: names.get(row.issuing_profile_id) ?? "Command",
      targetAudience: row.target_audience,
      acknowledgmentRequired: row.acknowledgment_required,
      acknowledgmentDueAt: row.acknowledgment_due_at,
      effectiveAt: row.effective_at,
      status: row.status,
      createdAt: row.created_at,
      acknowledgedCount: recipients.filter((recipient: any) => recipient.acknowledgedAt).length,
      targetCount: recipients.length,
      recipients,
    };
  });

  return (
    <PortalShell active="orders" eyebrow="Department Governance" title="Command Orders">
      <CommandOrdersManager initialOrders={items} />
    </PortalShell>
  );
}
