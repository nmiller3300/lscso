import Link from "next/link";
import { PortalShell } from "../../_components/PortalShell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { loadPersonnelPurview } from "@/lib/authorization/load-personnel-purview";

export default async function SupervisionWorkspacePage() {
  const profile = await getCurrentPortalProfile();
  if (!profile) return null;

  const purview = await loadPersonnelPurview(profile);
  const supabase = await createClient() as any;
  let guardianQuery = supabase
    .from("guardian_records")
    .select("id,guardian_number,subject_profile_id,title,status,follow_up_due_at,created_at")
    .order("created_at", { ascending: false });

  const scopedProfileIds = Array.from(new Set(purview.rows.map((row) => row.profileId)));
  if (!purview.standingDepartmentAuthority) {
    if (!purview.structuredAuthorityAvailable || !scopedProfileIds.length) {
      guardianQuery = guardianQuery.limit(0);
    } else {
      guardianQuery = guardianQuery.in("subject_profile_id", scopedProfileIds);
    }
  }

  const { data: guardianDataRaw } = await guardianQuery;
  const guardianData = guardianDataRaw ?? [];

  const grouped = new Map<string, { personnelId:string; displayName:string; rank:string; callSign:string|null; status:string; paths:string[] }>();
  for (const row of purview.rows) {
    const existing = grouped.get(row.profileId) ?? {
      personnelId: row.personnelId,
      displayName: row.displayName,
      rank: row.rank,
      callSign: row.callSign,
      status: row.status,
      paths: [],
    };
    const path = [row.unitName, row.authorityType].filter(Boolean).join(" · ") || row.scope;
    if (!existing.paths.includes(path)) existing.paths.push(path);
    grouped.set(row.profileId, existing);
  }

  const people = Array.from(grouped.values());
  const now = new Date();
  const followUps = guardianData
    .filter((record:any) => record.follow_up_due_at && new Date(record.follow_up_due_at) <= now && !["Acknowledged", "Closed"].includes(record.status))
    .slice(0, 5);
  const recentGuardians = guardianData.slice(0, 5);

  return (
    <PortalShell
      active="supervision"
      eyebrow="Supervision"
      title="Supervision"
      description="Personnel oversight, Guardians, and follow-up."
    >
      <div className="command-v2-supervision-layout">
        <section className="portal-panel command-v2-purview-panel">
          <div className="portal-panel-heading"><div><p>My scope</p><h2>Personnel under my purview</h2></div>{purview.standingDepartmentAuthority ? <span>Department authority</span> : null}</div>

          {purview.structuredAuthorityAvailable && people.length ? (
            <div className="command-v2-purview-list">
              {people.map((member) => (
                <Link href={`/portal/command/personnel/${member.personnelId}`} key={member.personnelId}>
                  <div><strong>{member.displayName}</strong><span>{member.rank} · {member.callSign ?? member.personnelId}</span></div>
                  <div>{member.paths.map((path) => <small key={path}>{path}</small>)}</div>
                </Link>
              ))}
            </div>
          ) : null}

          {!purview.structuredAuthorityAvailable && purview.standingDepartmentAuthority ? (
            <div className="command-v2-inline-state"><strong>Department-wide personnel access</strong><span>Use Personnel or Quick Find. Assigned command groups will appear here when structured assignments are activated.</span></div>
          ) : null}

          {!purview.structuredAuthorityAvailable && !purview.standingDepartmentAuthority ? (
            <div className="command-v2-inline-state"><strong>No structured purview is active yet.</strong><span>No personnel or Guardian activity is inferred from legacy supervisor text.</span></div>
          ) : null}

          {purview.structuredAuthorityAvailable && !people.length ? <div className="portal-empty-state"><strong>No personnel are currently assigned within your purview.</strong></div> : null}
        </section>

        <div className="command-v2-supervision-side">
          <section className="portal-panel command-v2-launcher">
            <div className="portal-panel-heading"><div><p>Guardians</p><h2>Find or create</h2></div></div>
            <p className="command-v2-compact-copy">Search existing records or open Guardian management.</p>
            <div className="command-v2-action-row"><Link className="portal-button portal-button--primary" href="/portal/command/guardians">Open Guardians</Link></div>
          </section>

          <section className="portal-panel command-v2-launcher">
            <div className="portal-panel-heading"><div><p>Follow-up</p><h2>Needs attention</h2></div><span>{followUps.length}</span></div>
            {followUps.length ? <div className="command-v2-mini-list">{followUps.map((record:any) => <Link href={`/portal/command/guardians/${record.guardian_number}`} key={record.id}><strong>G-{String(record.guardian_number).padStart(4,"0")}</strong><span>{record.title}</span></Link>)}</div> : <div className="portal-empty-state"><strong>No Guardian follow-ups due.</strong></div>}
          </section>
        </div>
      </div>

      <section className="portal-panel command-v2-recent-supervision">
        <div className="portal-panel-heading"><div><p>Recent</p><h2>Guardian activity</h2></div><Link href="/portal/command/guardians">View Guardians</Link></div>
        {recentGuardians.length ? <div className="command-v2-mini-list">{recentGuardians.map((record:any) => <Link href={`/portal/command/guardians/${record.guardian_number}`} key={record.id}><strong>G-{String(record.guardian_number).padStart(4,"0")} · {record.title}</strong><span>{record.status}</span></Link>)}</div> : <div className="portal-empty-state"><strong>No Guardian records found in your current scope.</strong></div>}
      </section>
    </PortalShell>
  );
}
