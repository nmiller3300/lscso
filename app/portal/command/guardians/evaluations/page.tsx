import Link from "next/link";
import { redirect } from "next/navigation";
import { GuardianPerformanceEvaluationWorkspace } from "../../../_components/GuardianPerformanceEvaluationWorkspace";
import { PortalShell } from "../../../_components/PortalShell";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

export default async function GuardianPerformanceEvaluationsPage() {
  const profile = await getCurrentPortalProfile();
  if (!profile) redirect("/portal/login");
  if (!["Executive", "Command", "Supervisor", "Preliminary"].includes(profile.access_tier)) redirect("/portal/personnel");

  return (
    <PortalShell
      active="guardians"
      eyebrow="Supervision · Guardian"
      title="Performance Evaluations"
      description="Supervisor performance reviews retained in the permanent Guardian record."
      actions={<Link className="portal-button portal-button--secondary" href="/portal/command/guardians/manage">Guardian management</Link>}
    >
      <GuardianPerformanceEvaluationWorkspace />
    </PortalShell>
  );
}
