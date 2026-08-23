import { redirect } from "next/navigation";
import { AccountAdministration } from "../../../_components/AccountAdministration";
import { PortalShell } from "../../../_components/PortalShell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

const STANDING_ACCOUNT_ADMIN = new Set(["Sheriff", "Undersheriff", "Major", "Captain"]);

export default async function AccountAdministrationPage() {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) {
    redirect("/portal/command/supervision");
  }

  const supabase = await createClient() as any;
  const { data: accessRows } = await supabase.rpc("get_my_roster_access");
  const access = accessRows?.[0];
  const delegations = new Set<string>(access?.active_delegations ?? []);
  const canManageAccounts = STANDING_ACCOUNT_ADMIN.has(profile.rank)
    || delegations.has("Personnel Administration")
    || delegations.has("Temporary Command Authority");

  if (!canManageAccounts) redirect("/portal/command/administration");

  const [{ data: personnel }, { data: units }] = await Promise.all([
    supabase
      .from("personnel_profiles")
      .select("id,personnel_id,display_name,username,call_sign,rank,status")
      .order("personnel_id"),
    supabase
      .from("organizational_units")
      .select("name,unit_type,sort_order")
      .eq("active", true)
      .neq("unit_type", "Bureau")
      .order("sort_order")
      .order("name"),
  ]);

  const divisionOptions = Array.from(new Set((units ?? []).map((unit:any) => String(unit.name))));
  if (!divisionOptions.length) divisionOptions.push("Patrol Division");

  return (
    <PortalShell
      active="administration"
      eyebrow="Administration"
      title="Personnel Accounts"
      description="Create department accounts and issue initial credentials."
    >
      <AccountAdministration
        personnel={(personnel ?? []).map((member:any) => ({
          profileId: member.id,
          personnelId: member.personnel_id,
          displayName: member.display_name,
          username: member.username,
          callSign: member.call_sign,
          rank: member.rank,
          status: member.status,
        }))}
        divisionOptions={divisionOptions}
      />
    </PortalShell>
  );
}
