import Link from "next/link";
import { GuardianWorkspace } from "../../../_components/GuardianWorkspace";
import { PortalShell } from "../../../_components/PortalShell";

export default function GuardianManagementPage() {
  return (
    <PortalShell
      active="guardians"
      eyebrow="Supervision · Guardians"
      title="Guardian management"
      description="Create and manage Guardian records."
      actions={<Link className="portal-button portal-button--secondary" href="/portal/command/guardians/evaluations">Performance Evaluations</Link>}
    >
      <GuardianWorkspace />
    </PortalShell>
  );
}