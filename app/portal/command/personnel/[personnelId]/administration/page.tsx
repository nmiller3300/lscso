import { notFound, redirect } from "next/navigation";
import { PersonnelAssignmentManager } from "../../../../_components/PersonnelAssignmentManager";
import { PersonnelDelegationManager } from "../../../../_components/PersonnelDelegationManager";
import { PersonnelIdentityManager } from "../../../../_components/PersonnelIdentityManager";
import { PersonnelLoaManager } from "../../../../_components/PersonnelLoaManager";
import { PersonnelRecordHeader } from "../../../../_components/PersonnelRecordHeader";
import { PortalShell } from "../../../../_components/PortalShell";
import { canAccessPersonnelRecord } from "@/lib/authorization/can-access-personnel-record";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

type PageProps = { params: Promise<{ personnelId: string }> };
const PERSONNEL_CHANGE_APPROVERS = new Set(["Sheriff", "Undersheriff", "Major"]);
const DELEGATION_MANAGERS = new Set(["Sheriff", "Undersheriff", "Major", "Captain"]);
const OPEN_ENDED_RETURN = "9999-12-31";

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString();
}

function formatLeaveWindow(item: { starts_on: string; expected_return_on: string }) {
  return item.expected_return_on === OPEN_ENDED_RETURN
    ? `${formatDate(item.starts_on)} to Open-ended`
    : `${formatDate(item.starts_on)} to ${formatDate(item.expected_return_on)}`;
}

export default async function PersonnelAdministrationPage({ params }: PageProps) {
  const profile = await getCurrentPortalProfile();
  if (!profile) redirect("/portal/login");
  const { personnelId } = await params;
  const access = await canAccessPersonnelRecord(profile, personnelId);
  if (!access.allowed) redirect("/portal/command/supervision");

  const supabase = await createClient() as any;
  const { data: member } = await supabase
    .from("personnel_profiles")
    .select("id,personnel_id,display_name,rank,call_sign,access_tier,division,status")
    .eq("personnel_id", personnelId.toUpperCase())
    .maybeSingle();
  if (!member) notFound();

  const now = new Date();
  const nowIso = now.toISOString();
  const today = nowIso.slice(0, 10);
  const [flags, leave, requests, delegations, units, assignments] = await Promise.all([
    supabase.from("personnel_flags").select("id,flag_type,notes,active,created_at,resolved_at").eq("profile_id", member.id).order("created_at", { ascending: false }),
    supabase.from("leave_requests").select("id,request_number,leave_type,starts_on,expected_return_on,status,created_at").eq("profile_id", member.id).order("created_at", { ascending: false }),
    supabase.from("personnel_requests").select("id,request_number,request_type,status,subject,created_at").eq("requester_profile_id", member.id).order("created_at", { ascending: false }),
    supabase.from("personnel_delegations").select("id,delegation_type,organizational_unit_id,starts_at,expires_at,reason,revoked_at").eq("profile_id", member.id).is("revoked_at", null).lte("starts_at", nowIso).order("created_at", { ascending: false }),
    supabase.from("organizational_units").select("id,name,unit_type,active").eq("active", true).order("sort_order").order("name"),
    supabase.from("personnel_unit_assignments").select("id,organizational_unit_id,assignment_type,starts_at,notes,organizational_units(name,unit_type)").eq("profile_id", member.id).is("ends_at", null).order("starts_at", { ascending: true }),
  ]);

  const unitRows = (units.data ?? []).filter((item: any) => item.unit_type !== "Bureau");
  const unitNames = new Map(unitRows.map((item: any) => [item.id, item.name]));
  const activeDelegations = (delegations.data ?? []).filter((item: any) => !item.expires_at || new Date(item.expires_at) > now);
  const activeOrUpcomingLeave = (leave.data ?? [])
    .filter((item: any) => item.status === "Approved" && item.expected_return_on >= today)
    .sort((a: any, b: any) => {
      const aActive = a.starts_on <= today && a.expected_return_on >= today ? 0 : 1;
      const bActive = b.starts_on <= today && b.expected_return_on >= today ? 0 : 1;
      return aActive - bActive || String(a.starts_on).localeCompare(String(b.starts_on));
    })[0] ?? null;

  const canApprovePersonnelChanges = PERSONNEL_CHANGE_APPROVERS.has(profile.rank) && profile.id !== member.id;
  const canManageLoa = PERSONNEL_CHANGE_APPROVERS.has(profile.rank);
  const canManageDelegations = DELEGATION_MANAGERS.has(profile.rank) && profile.id !== member.id;
  const canGrantTemporaryCommand = ["Sheriff", "Undersheriff"].includes(profile.rank);
  const canManageAssignments = ["Executive", "Command"].includes(profile.access_tier);
  const administrationDisplayStatus = member.status === "Suspended"
    ? "Suspended"
    : activeOrUpcomingLeave && activeOrUpcomingLeave.starts_on <= today
      ? "LOA"
      : member.status;
  const assignmentRows = (assignments.data ?? []).map((item: any) => {
    const unit = Array.isArray(item.organizational_units) ? item.organizational_units[0] : item.organizational_units;
    return { id: item.id, unitId: item.organizational_unit_id, unitName: unit?.name ?? "Unknown unit", unitType: unit?.unit_type ?? "Unit", assignmentType: item.assignment_type, startsAt: item.starts_at, notes: item.notes };
  });

  return (
    <PortalShell
      active="personnel"
      eyebrow={`${member.personnel_id} · Administration`}
      title={`${member.display_name} · Administration`}
      description="Administrative flags, leave, personnel requests, delegated authority, and controlled personnel changes."
    >
      <PersonnelRecordHeader personnelId={member.personnel_id} displayName={member.display_name} rank={member.rank} callSign={member.call_sign} assignment={member.division} status={administrationDisplayStatus} active="administration" />

      <PersonnelAssignmentManager
        profileId={member.id}
        displayName={member.display_name}
        canManage={canManageAssignments}
        units={unitRows.map((item: any) => ({ id: item.id, name: item.name, unitType: item.unit_type }))}
        assignments={assignmentRows}
      />

      {canApprovePersonnelChanges ? (
        <PersonnelIdentityManager
          profileId={member.id}
          personnelId={member.personnel_id}
          displayName={member.display_name}
          currentRank={member.rank}
          currentStatus={member.status}
        />
      ) : null}

      {canManageLoa ? (
        <PersonnelLoaManager
          profileId={member.id}
          personnelId={member.personnel_id}
          displayName={member.display_name}
          activeLeave={activeOrUpcomingLeave ? {
            id: activeOrUpcomingLeave.id,
            leaveType: activeOrUpcomingLeave.leave_type,
            startsOn: activeOrUpcomingLeave.starts_on,
            expectedReturnOn: activeOrUpcomingLeave.expected_return_on,
          } : null}
        />
      ) : null}

      {canManageDelegations ? (
        <PersonnelDelegationManager
          profileId={member.id}
          displayName={member.display_name}
          canGrantTemporaryCommand={canGrantTemporaryCommand}
          units={unitRows.map((item: any) => ({ id: item.id, name: item.name, unitType: item.unit_type }))}
          delegations={activeDelegations.map((item: any) => ({
            id: item.id,
            delegationType: item.delegation_type,
            unitId: item.organizational_unit_id,
            unitName: item.organizational_unit_id ? String(unitNames.get(item.organizational_unit_id) ?? "Organizational area") : null,
            expiresAt: item.expires_at,
            reason: item.reason,
          }))}
        />
      ) : (
        <section className="portal-panel">
          <div className="portal-panel-heading"><div><p>Delegated authority</p><h2>Administrative responsibility</h2></div><span>{activeDelegations.length} active</span></div>
          <div className="command-v2-mini-list">
            {activeDelegations.length ? activeDelegations.map((item: any) => (
              <div key={item.id}>
                <strong>{item.delegation_type}</strong>
                <span>{item.organizational_unit_id ? `${String(unitNames.get(item.organizational_unit_id) ?? "Organizational area")} · ` : ""}{item.expires_at ? `Expires ${new Date(item.expires_at).toLocaleString()}` : "No expiration"}</span>
                {item.reason ? <small>{item.reason}</small> : null}
              </div>
            )) : <p className="command-v2-compact-copy">No delegated authority is currently active.</p>}
          </div>
        </section>
      )}

      <div className="personnel-record-two-column">
        <section className="portal-panel">
          <div className="portal-panel-heading"><div><p>Personnel status</p><h2>Administrative flags</h2></div><span>{flags.data?.length ?? 0}</span></div>
          <div className="command-v2-mini-list">
            {(flags.data ?? []).length ? (flags.data ?? []).map((item:any) => <div key={item.id}><strong>{item.flag_type}</strong><span>{item.active ? "Active" : "Resolved"}</span>{item.notes ? <small>{item.notes}</small> : null}</div>) : <p className="command-v2-compact-copy">No administrative flags.</p>}
          </div>
        </section>

        <section className="portal-panel">
          <div className="portal-panel-heading"><div><p>Leave</p><h2>Leave history</h2></div><span>{leave.data?.length ?? 0}</span></div>
          <div className="command-v2-mini-list">
            {(leave.data ?? []).length ? (leave.data ?? []).map((item:any) => <div key={item.id}><strong>{item.leave_type} · RQ-{String(item.request_number).padStart(4, "0")}</strong><span>{item.status} · {formatLeaveWindow(item)}</span></div>) : <p className="command-v2-compact-copy">No leave history.</p>}
          </div>
        </section>

        <section className="portal-panel">
          <div className="portal-panel-heading"><div><p>Requests</p><h2>Personnel requests</h2></div><span>{requests.data?.length ?? 0}</span></div>
          <div className="command-v2-mini-list">
            {(requests.data ?? []).length ? (requests.data ?? []).map((item:any) => <div key={item.id}><strong>{item.request_type} · {item.subject}</strong><span>RQ-{String(item.request_number).padStart(4, "0")} · {item.status}</span></div>) : <p className="command-v2-compact-copy">No personnel requests.</p>}
          </div>
        </section>
      </div>
    </PortalShell>
  );
}
