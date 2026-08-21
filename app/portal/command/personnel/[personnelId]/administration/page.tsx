import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PersonnelRecordTabs } from "../../../../_components/PersonnelRecordTabs";
import { PortalShell } from "../../../../_components/PortalShell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

type PageProps = { params: Promise<{ personnelId: string }> };

export default async function PersonnelAdministrationPage({ params }: PageProps) {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) redirect("/portal/command/supervision");
  const { personnelId } = await params;
  const supabase = await createClient() as any;
  const { data: member } = await supabase.from("personnel_profiles").select("id,personnel_id,display_name,rank,division,status").eq("personnel_id", personnelId.toUpperCase()).maybeSingle();
  if (!member) notFound();

  const [flags, leave, requests] = await Promise.all([
    supabase.from("personnel_flags").select("id,flag_type,notes,active,created_at,resolved_at").eq("profile_id", member.id).order("created_at", { ascending: false }),
    supabase.from("leave_requests").select("id,request_number,leave_type,starts_on,expected_return_on,status,created_at").eq("profile_id", member.id).order("created_at", { ascending: false }),
    supabase.from("personnel_requests").select("id,request_number,request_type,status,subject,created_at").eq("requester_profile_id", member.id).order("created_at", { ascending: false }),
  ]);

  return (
    <PortalShell active="personnel" eyebrow={`${member.personnel_id} · Administration`} title={`${member.display_name} · Administration`} description="Administrative flags, leave, and personnel requests." actions={<Link className="portal-button portal-button--secondary" href={`/portal/command/personnel/${member.personnel_id}`}>Back to record</Link>}>
      <PersonnelRecordTabs personnelId={member.personnel_id} active="administration" />
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
