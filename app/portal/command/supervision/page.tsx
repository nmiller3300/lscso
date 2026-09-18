import Link from "next/link";
import { PortalShell } from "../../_components/PortalShell";
import { SupervisoryPurviewManager } from "../../_components/SupervisoryPurviewManager";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { loadPersonnelPurview } from "@/lib/authorization/load-personnel-purview";

const SUPERVISORY_RANKS = new Set([
  "Sheriff",
  "Undersheriff",
  "Major",
  "Captain",
  "1st Lieutenant",
  "Lieutenant",
  "Sergeant",
  "Corporal",
]);

const DIVISION_DRIVEN_SUPERVISORS = new Set([
  "1st Lieutenant",
  "Lieutenant",
  "Sergeant",
  "Corporal",
]);

export default async function SupervisionWorkspacePage() {
  const profile = await getCurrentPortalProfile();
  if (!profile) return null;

  const purview = await loadPersonnelPurview(profile);
  const supabase = await createClient() as any;
  const canManagePurview = ["Executive", "Command"].includes(profile.access_tier);
  const divisionDrivenSupervisor = DIVISION_DRIVEN_SUPERVISORS.has(profile.rank);

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

  const [{ data: guardianDataRaw }, managementData] = await Promise.all([
    guardianQuery,
    canManagePurview
      ? Promise.all([
          supabase
            .from("personnel_profiles")
            .select("id,personnel_id,display_name,rank,call_sign,status,is_test_account")
            .neq("status", "Deactivated")
            .order("display_name"),
          supabase
            .from("supervisory_authorities")
            .select("id,supervisor_profile_id,subject_profile_id,authority_type,starts_at")
            .eq("authority_type", "Primary")
            .is("ends_at", null)
            .order("starts_at", { ascending: false }),
        ])
      : Promise.resolve(null),
  ]);

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
    const authorityLabel = row.authorityType === "Unit"
      ? "Division scope"
      : row.authorityType === "Primary"
        ? "Individual exception"
        : row.authorityType;
    const path = purview.standingDepartmentAuthority
      ? ([row.unitName, row.assignmentType].filter(Boolean).join(" · ") || "Department personnel")
      : ([row.unitName, authorityLabel].filter(Boolean).join(" · ") || row.scope);
    if (!existing.paths.includes(path)) existing.paths.push(path);
    grouped.set(row.profileId, existing);
  }

  const people = Array.from(grouped.values());
  const now = new Date();
  const followUps = guardianData
    .filter((record:any) => record.follow_up_due_at && new Date(record.follow_up_due_at) <= now && !["Acknowledged", "Closed"].includes(record.status))
    .slice(0, 5);
  const recentGuardians = guardianData.slice(0, 5);

  let managementMembers: Array<{
    profileId: string;
    personnelId: string;
    displayName: string;
    rank: string;
    callSign: string;
    currentSupervisorId: string | null;
    currentSupervisorLabel: string | null;
  }> = [];
  let managementSupervisors: Array<{
    profileId: string;
    personnelId: string;
    displayName: string;
    rank: string;
    callSign: string;
  }> = [];

  if (managementData) {
    const [{ data: profilesRaw }, { data: primaryAuthoritiesRaw }] = managementData as any;
    const profiles = profilesRaw ?? [];
    const primaryAuthorities = primaryAuthoritiesRaw ?? [];
    const profileById = new Map(profiles.map((member:any) => [member.id, member]));
    const primaryBySubject = new Map<string, any>();

    for (const authority of primaryAuthorities) {
      if (!authority.subject_profile_id || primaryBySubject.has(authority.subject_profile_id)) continue;
      primaryBySubject.set(authority.subject_profile_id, authority);
    }

    managementSupervisors = profiles
      .filter((member:any) => SUPERVISORY_RANKS.has(member.rank) && ["Active", "Acting"].includes(member.status))
      .map((member:any) => ({
        profileId: member.id,
        personnelId: member.personnel_id,
        displayName: member.display_name,
        rank: member.rank,
        callSign: member.call_sign ?? "",
      }));

    managementMembers = profiles
      .filter((member:any) => member.rank !== "Department Attorney" && member.rank !== "Sheriff")
      .map((member:any) => {
        const activePrimary = primaryBySubject.get(member.id);
        const supervisor = activePrimary ? profileById.get(activePrimary.supervisor_profile_id) as any : null;
        return {
          profileId: member.id,
          personnelId: member.personnel_id,
          displayName: member.display_name,
          rank: member.rank,
          callSign: member.call_sign ?? "",
          currentSupervisorId: activePrimary?.supervisor_profile_id ?? null,
          currentSupervisorLabel: supervisor ? `${supervisor.rank} ${supervisor.display_name}` : null,
        };
      });
  }

  return (
    <PortalShell
      active="supervision"
      eyebrow="Supervision"
      title="Supervision"
      description="Division-driven personnel oversight, exception authority, Guardians, and follow-up."
    >
      {canManagePurview ? (
        <SupervisoryPurviewManager members={managementMembers} supervisors={managementSupervisors} />
      ) : null}

      <div className="command-v2-supervision-layout">
        <section className="portal-panel command-v2-purview-panel">
          <div className="portal-panel-heading"><div><p>My scope</p><h2>Personnel under my purview</h2></div>{purview.standingDepartmentAuthority ? <span>Department-wide authority</span> : divisionDrivenSupervisor ? <span>Division-driven</span> : null}</div>
          {purview.standingDepartmentAuthority ? <p className="command-v2-compact-copy">Your rank carries standing department-wide supervisory access. Individual rows below show personnel assignment context, not separate command grants.</p> : null}
          {divisionDrivenSupervisor ? <p className="command-v2-compact-copy">Your active Primary division assignment is the default source of supervisory purview. Lower-ranked personnel assigned to that division appear here automatically; documented individual exceptions can add direct scope when needed.</p> : null}

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
            <div className="command-v2-inline-state"><strong>No active supervisory scope is available.</strong><span>For Corporal through 1st Lieutenant, verify the member has an active Primary division assignment. Individual exception authority can be added by Command when needed.</span></div>
          ) : null}

          {purview.structuredAuthorityAvailable && !people.length ? <div className="portal-empty-state"><strong>No lower-ranked personnel are currently within your division-based purview.</strong><span>Your Primary division assignment drives the normal scope automatically. Command can add a documented individual exception when necessary.</span></div> : null}
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
