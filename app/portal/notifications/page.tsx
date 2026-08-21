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

  const { data: directNotifications } = await supabase
    .from("notifications")
    .select("id,notification_type,title,message,href,read_at,created_at")
    .eq("recipient_profile_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(100);

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
    supabase.from("personnel_requests").select("id,request_number,request_type,subject,status,requester_profile_id,created_at").order("created_at", { ascending: false }),
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
      href: `/portal/my-office#guardians`,
      createdAt: item.created_at,
      status: "Acknowledgment required",
    });
  }

  for (const item of requests.filter((row: any) => own(row.requester_profile_id) && ["Submitted", "In Review"].includes(row.status))) {
    actionItems.push({ id: `self-request-${item.id}`, category: "Requests", priority: "Normal", title: `${item.request_type} request`, detail: item.subject, href: "/portal/my-office#requests", createdAt: item.created_at, status: item.status });
  }
  for (const item of leave.filter((row: any) => own(row.profile_id) && ["Submitted", "In Review"].includes(row.status))) {
    actionItems.push({ id: `self-leave-${item.id}`, category: "Requests", priority: "Normal", title: `${item.leave_type} leave request`, detail: `RQ-${String(item.request_number).padStart(4, "0")}`, href: "/portal/my-office#requests", createdAt: item.created_at, status: item.status });
  }
  for (const item of certifications.filter((row: any) => own(row.profile_id) && ["Requested", "Pending"].includes(row.status))) {
    actionItems.push({ id: `self-cert-${item.id}`, category: "Training", priority: "Normal", title: item.name, detail: "Certification request awaiting action", href: "/portal/my-office#certifications", createdAt: item.created_at, status: item.status });
  }

  let scopeNotice: string | null = null;
  if (audience === "command") {
    const departmentAuthority = DEPARTMENT_COMMAND_RANKS.has(profile.rank);
    const purview = departmentAuthority ? null : await loadPersonnelPurview(profile);
    const scopedIds = new Set((purview?.rows ?? []).map((row) => row.profileId));
    const allowed = (profileId: string | null | undefined) => departmentAuthority || Boolean(profileId && scopedIds.has(profileId));

    if (!departmentAuthority && !purview?.structuredAuthorityAvailable) {
      scopeNotice = "Your personal action items are shown. Supervisory action queues will populate when structured purview is active; legacy supervisor text is not used to infer access.";
    } else if (!departmentAuthority) {
      scopeNotice = "Supervisory actions are limited to personnel currently inside your resolved purview.";
    }

    for (const item of guardians.filter((row: any) => allowed(row.subject_profile_id) && row.status === "Pending Approval")) {
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

    for (const item of guardians.filter((row: any) => allowed(row.subject_profile_id) && row.follow_up_due_at && new Date(row.follow_up_due_at) <= now && !["Acknowledged", "Closed"].includes(row.status))) {
      actionItems.push({ id: `followup-${item.id}`, category: "Guardians", priority: "High", title: `Guardian follow-up due`, detail: `G-${String(item.guardian_number).padStart(4, "0")} · ${item.title}`, href: `/portal/command/guardians/${item.guardian_number}`, createdAt: item.follow_up_due_at, status: "Follow-up due" });
    }

    for (const item of requests.filter((row: any) => allowed(row.requester_profile_id) && ["Submitted", "In Review"].includes(row.status))) {
      actionItems.push({ id: `approval-request-${item.id}`, category: "Requests", priority: "Normal", title: `${item.request_type} request`, detail: `${item.subject} · RQ-${String(item.request_number).padStart(4, "0")}`, href: "/portal/command/approvals#personnel-requests", createdAt: item.created_at, status: item.status });
    }
    for (const item of leave.filter((row: any) => allowed(row.profile_id) && ["Submitted", "In Review"].includes(row.status))) {
      actionItems.push({ id: `approval-leave-${item.id}`, category: "Requests", priority: "Normal", title: `${item.leave_type} LOA request`, detail: `RQ-${String(item.request_number).padStart(4, "0")}`, href: "/portal/command/approvals#leave-requests", createdAt: item.created_at, status: item.status });
    }
    for (const item of certifications.filter((row: any) => allowed(row.profile_id) && ["Requested", "Pending"].includes(row.status))) {
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
      description="Actionable work is separated from informational notifications so important items do not disappear in a busy feed."
    >
      <PortalNotificationCenter initialNotifications={notifications} actionItems={uniqueActions} scopeNotice={scopeNotice} />
    </PortalShell>
  );
}
