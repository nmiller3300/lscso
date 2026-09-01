import { PortalNotificationCenter, type ActionCenterItem, type NotificationCenterItem } from "../_components/PortalNotificationCenter";
import { PortalShell } from "../_components/PortalShell";
import { classifyNotification, classifyNotificationPriority } from "@/lib/notifications/notification-meta";
import { loadPersonnelPurview } from "@/lib/authorization/load-personnel-purview";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

const DEPARTMENT_COMMAND_RANKS = new Set(["Sheriff", "Undersheriff", "Major", "Captain"]);

export default async function NotificationsPage() {
  const profile = await getCurrentPortalProfile();
  if (!profile) return null;

  const audience = profile.access_tier === "Deputy" ? "deputy" as const : "command" as const;
  const supabase = await createClient() as any;
  const now = new Date();
  const departmentAuthority = DEPARTMENT_COMMAND_RANKS.has(profile.rank);

  let notificationQuery = supabase
    .from("notifications")
    .select("id,notification_type,title,message,href,read_at,created_at")
    .eq("recipient_profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!departmentAuthority) notificationQuery = notificationQuery.neq("notification_type", "Guardian Approval");

  const { data: directNotifications } = await notificationQuery;

  const notifications: NotificationCenterItem[] = (directNotifications ?? []).map((item: any) => ({
    id: item.id,
    category: classifyNotification(item.notification_type, item.title, item.message),
    priority: classifyNotificationPriority(item.notification_type, item.title, item.message),
    title: item.title,
    detail: item.message,
    type: item.notification_type,
    href: item.href,
    createdAt: item.created_at,
    read: Boolean(item.read_at),
  }));

  const [guardiansResult, requestsResult, leaveResult, certificationsResult] = await Promise.all([
    supabase.from("guardian_records").select("id,guardian_number,title,record_type,status,subject_profile_id,follow_up_due_at,created_at").order("created_at", { ascending: false }),
    supabase.from("personnel_requests").select("id,request_number,request_type,subject,status,requester_profile_id,current_reviewer_profile_id,current_reviewer_label,routing_fallback,routing_stage,routing_label,created_at").order("created_at", { ascending: false }),
    supabase.from("leave_requests").select("id,request_number,leave_type,status,profile_id,starts_on,expected_return_on,created_at").order("created_at", { ascending: false }),
    supabase.from("certifications").select("id,name,status,profile_id,created_at").order("created_at", { ascending: false }),
  ]);

  const guardians = guardiansResult.data ?? [];
  const requests = requestsResult.data ?? [];
  const leave = leaveResult.data ?? [];
  const certifications = certificationsResult.data ?? [];
  const actionItems: ActionCenterItem[] = [];

  const own = (profileId: string | null | undefined) => profileId === profile.id;

  for (const item of guardians.filter((row: any) => own(row.subject_profile_id) && row.status === "Awaiting Acknowledgment")) {
    actionItems.push({
      id: `self-guardian-${item.id}`,
      category: "Guardians",
      priority: "High",
      title: `Acknowledge G-${String(item.guardian_number).padStart(4, "0")}`,
      detail: item.title,
      href: `/portal/my-office#documents`,
      createdAt: item.created_at,
      status: "Acknowledgment required",
    });
  }

  for (const item of requests.filter((row: any) => {
    if (!["Submitted", "In Review"].includes(row.status) || row.requester_profile_id === profile.id) return false;
    if (row.current_reviewer_profile_id === profile.id) return true;
    return Boolean(row.routing_fallback && ["Sheriff", "Undersheriff"].includes(profile.rank));
  })) {
    actionItems.push({
      id: `routed-request-${item.id}`,
      category: "Requests",
      priority: item.routing_fallback ? "High" : "Normal",
      title: `Review RQ-${String(item.request_number).padStart(4, "0")} · ${item.request_type}`,
      detail: `${item.subject} · ${item.routing_label ?? item.routing_stage ?? "Assigned review"}`,
      href: "/portal/command/approvals#personnel-requests",
      createdAt: item.created_at,
      status: item.current_reviewer_label ? `Assigned to ${item.current_reviewer_label}` : "Executive Command review",
    });
  }

  let scopeNotice: string | null = null;
  if (audience === "command") {
    const purview = departmentAuthority ? null : await loadPersonnelPurview(profile);
    const scopedIds = new Set((purview?.rows ?? []).map((row) => row.profileId));
    const allowed = (profileId: string | null | undefined) => departmentAuthority || Boolean(profileId && scopedIds.has(profileId));
    const allowedDecision = (profileId: string | null | undefined) => Boolean(profileId && profileId !== profile.id && allowed(profileId));

    if (!departmentAuthority && !purview?.structuredAuthorityAvailable) {
      scopeNotice = "Your personal and directly routed action items are shown. Supervisory queues populate only from structured authority; legacy supervisor text is not used to infer access.";
    } else if (!departmentAuthority) {
      scopeNotice = "Supervisory actions are limited to personnel currently inside your resolved purview. Personnel requests appear only when the routing system assigns them to you.";
    }

    for (const item of guardians.filter((row: any) => allowedDecision(row.subject_profile_id) && row.status === "Pending Approval")) {
      actionItems.push({
        id: `approval-guardian-${item.id}`,
        category: "Guardians",
        priority: ["Written Warning", "Write-Up"].includes(item.record_type) ? "High" : "Normal",
        title: `Review G-${String(item.guardian_number).padStart(4, "0")}`,
        detail: `${item.record_type} · ${item.title}`,
        href: `/portal/command/guardians/${item.guardian_number}`,
        createdAt: item.created_at,
        status: "Pending approval",
      });
    }

    for (const item of guardians.filter((row: any) => allowedDecision(row.subject_profile_id) && row.follow_up_due_at && new Date(row.follow_up_due_at) <= now && !["Acknowledged", "Closed"].includes(row.status))) {
      actionItems.push({ id: `followup-${item.id}`, category: "Guardians", priority: "High", title: `Guardian follow-up due`, detail: `G-${String(item.guardian_number).padStart(4, "0")} · ${item.title}`, href: `/portal/command/guardians/${item.guardian_number}`, createdAt: item.follow_up_due_at, status: "Follow-up due" });
    }

    for (const item of leave.filter((row: any) => allowedDecision(row.profile_id) && ["Submitted", "In Review"].includes(row.status))) {
      actionItems.push({ id: `approval-leave-${item.id}`, category: "Requests", priority: "Normal", title: `${item.leave_type} LOA request`, detail: `RQ-${String(item.request_number).padStart(4, "0")}`, href: "/portal/command/approvals#leave-requests", createdAt: item.created_at, status: item.status });
    }
    for (const item of certifications.filter((row: any) => allowedDecision(row.profile_id) && ["Requested", "Pending"].includes(row.status))) {
      actionItems.push({ id: `approval-cert-${item.id}`, category: "Training", priority: "Normal", title: item.name, detail: "Certification request awaiting Command action", href: "/portal/command/approvals#certification-requests", createdAt: item.created_at, status: item.status });
    }
  }

  const uniqueActions = Array.from(new Map(actionItems.map((item) => [item.id, item])).values());

  return (
    <PortalShell
      active="notifications"
      audience={audience}
      eyebrow="Personnel Operations"
      title="Notification & Action Center"
      description="Only work that actually requires something from you appears in Action Required. Submitted requests remain informational until they are routed to a reviewer."
    >
      <PortalNotificationCenter initialNotifications={notifications} actionItems={uniqueActions} scopeNotice={scopeNotice} />
    </PortalShell>
  );
}
