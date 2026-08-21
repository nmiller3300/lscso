import Link from "next/link";
import { PortalShell } from "../../_components/PortalShell";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

export default async function TrainingWorkspacePage() {
  const profile = await getCurrentPortalProfile();
  if (!profile) return null;

  return (
    <PortalShell
      active="training"
      eyebrow="Training"
      title="Training"
      description="Certifications, FTO activity, trainer oversight, and qualification status."
    >
      <div className="command-v2-workspace-grid">
        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>Qualifications</p><h2>Certifications</h2></div></div>
          <p className="command-v2-compact-copy">Issue, review, remove, and monitor LSCSO certifications.</p>
          <div className="command-v2-action-row">
            <Link className="portal-button portal-button--primary" href="/portal/command/certifications">Certification Center</Link>
          </div>
        </section>

        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>FTO</p><h2>Trainees</h2></div></div>
          <p className="command-v2-compact-copy">Assigned trainees, evaluations, phases, and remedial training will live here.</p>
        </section>

        <section className="portal-panel command-v2-launcher">
          <div className="portal-panel-heading"><div><p>Readiness</p><h2>Training attention</h2></div></div>
          <p className="command-v2-compact-copy">Expiring qualifications, pending requests, and overdue evaluations will surface here.</p>
        </section>
      </div>
    </PortalShell>
  );
}
