import { redirect } from "next/navigation";
import { PortalShell } from "../../../_components/PortalShell";
import { RehireReinstatementWorkspace } from "../../../_components/RehireReinstatementWorkspace";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

export default async function RehireReinstatementPage() {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Sheriff", "Undersheriff"].includes(profile.rank)) redirect("/portal/command/administration");

  const supabase = await createClient() as any;
  const { data, error } = await supabase.rpc("get_rehire_reinstatement_workspace");
  if (error) throw new Error(error.message);

  return (
    <PortalShell active="administration" eyebrow="Administration" title="Rehire & Reinstatement">
      <RehireReinstatementWorkspace
        actorRank={profile.rank}
        initialWorkspace={(data ?? { candidates: [], cases: [], reviewers: [] }) as any}
      />
    </PortalShell>
  );
}
