import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PersonnelDelegationManager } from "../../../../_components/PersonnelDelegationManager";
import { PersonnelIdentityManager } from "../../../../_components/PersonnelIdentityManager";
import { PersonnelRecordTabs } from "../../../../_components/PersonnelRecordTabs";
import { PortalShell } from "../../../../_components/PortalShell";
import { canAccessPersonnelRecord } from "@/lib/authorization/can-access-personnel-record";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

type PageProps = { params: Promise<{ personnelId: string }> };
const PERSONNEL_CHANGE_APPROVERS = new Set(["Sheriff", "Undersheriff", "Major"]);
const DELEGATION_MANAGERS = new Set(["Sheriff", "Undersheriff", "Major", "Captain"]);

export default async function PersonnelAdministrationPage({ params }: PageProps) {
  const profile = await getCurrentPortalProfile();
  if (!profile) redirect("/portal/login");
  const { personnelId } = await params;
  const access = await canAccessPersonnelRecord(profile, personnelId);
  if (!access.allowed) redirect("/portal/command/supervision");

  const supabase = await createClient() as any;
  const { data: member } = await supabase
    .from("personnel_profiles")
    .select("id,personnel_id,display_name,rank,access_tier,division,status")
    .eq("personnel_id", personnelId.toUpperCase())
    .maybeSingle();
  if (!member) notFound();

  const now = new Date();
  const nowIso = now.toISOString();
  const [flags, leave, requests, delegations, units] = await Promise.all([
    supabase.from("personnel_flags").select("id,flag_type,notes,active,created_at,resolved_at").eq("profile_id", member.id).order("created_at", { ascending: false }),
    supabase.from("leave_requests").select("id,request_number,leave_type,starts_on,expected_return_on,status,created_at").eq("profile_id", member.id).order("created_at", { ascending: false }),
    supabase.from("personnel_requests").select("id,request_number,request_type,status,subject,created_at").eq("requester_profile_id", member.id).order("created_at", { ascending: false }),
    supabase.from("personnel_delegations").select("id,delegation_type,organizational_unit_id,starts_at,expires_at,reason,revoked_at").eq("profile_id", member.id).is("revoked_at", null).lte("starts_at", nowIso).order("created_at", { ascending: false }),
    supabase.from("organizational_units").select("id,name,unit_type,active").eq("active", true).order("sort_order").order("name"),
  ]);

  const unitRows = (units.data ?? []).filter((item: any) => item.unit_type !== "Bureau");
  const unitNames = new Map(unitRows.map((item: any) => [item.id, item.name]));
  const activeDelegations = (delegations.data ?? []).filter((item: any) => !item.expires_at || new Date(item.expires_at) > now);

  const canApprovePersonnelChanges = PERSONNEL_CHANGE_APPROVERS.has(profile.rank) && profile.id !== member.id;
  const canManageDelegations = DELEGATION_MANAGERS.has(profile.rank) && profile.id !== member.id;
  const canGrantTemporaryCommand = ["Sheriff", "Undersheriff"].includes(profile.rank);

  return (
    <PortalShell
      active="personnel"
      eyebrow={`${member.personnel_id} · Administration`}
      title={`${member.display_name} · Administration`}
      description="Administrative flags, leave, personnel requests, delegated authority, and controlled personnel changes."
      actions={<Link className="portal-button portal-button--secondary" href={`/portal/command/personnel/${member.personnel_id}`}>Back to record</Link>}
    >
      <PersonnelRecordTabs personnelId={member.personnel_id} active="administration" />

      {canApprovePersonnelChanges ? (
        <PersonnelIdentityManager
          profileId={member.id}
          personnelId={member.personnel_id}
          displayName={member.display_name}
          currentRank={member.rank}
          currentStatus={member.status}
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
      ) : null}

      <div className="command-v2-workspace-grid">
        <section className="portal-panel">
          <div className="portal-panel-heading"><div><p>Personnel status</p><h2>Administrative flags</h2></div><span>{flags.data?.length ?? 0}</span></div>
          <div className="command-v2-mini-list">
            {(flags.data ?? []).length ? (flags.data ?? []).map((item:any) => <div key={item.id}><strong>{item.flag_type}</strong><span>{item.active ? "Active" : "Resolved"}</span>{item.notes ? <small>{item.notes}</small> : null}</div>) : <p className="command-v2-compact-copy">No administrative flags.</p>}
          </div>
        </section>

        <section className="portal-panel">
          <div className="portal-panel-heading"><div><p>Leave</p><h2>Leave history</h2></div><span>{leave.data?.length ?? 0}</span></div>
          <div className="command-v2-mini-list">
            {(leave.data ?? []).length ? (leave.data ?? []).map((item:any) => <div key={item.id}><strong>{item.leave_type} · RQ-{String(item.request_number).padStart(4, "0")}</strong><span>{item.status} · {new Date(`${item.starts_on}T12:00:00`).toLocaleDateString()} to {new Date(`${item.expected_return_on}T12:00:00`).toLocaleDateString()}</span></div>) : <p className="command-v2-compact-copy">No leave history.</p>}
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
