import { GuardianWorkspace } from "../../_components/GuardianWorkspace";
import { PortalShell } from "../../_components/PortalShell";

export default function GuardianCenterPage() {
  return (
    <PortalShell
      active="guardians"
      eyebrow="Personnel action records"
      title="Guardian Center"
      description="Create consistent, professional records with the right approvals, follow-ups, and protections built into the workflow."
    >
      <GuardianWorkspace />
    </PortalShell>
  );
}
