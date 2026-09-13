"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePortalProfile } from "./PortalProfileProvider";
import { PortalNotificationStack, type NotificationStackItem } from "./PortalNotificationStack";

const DEPARTMENT_COMMAND_RANKS = new Set(["Sheriff", "Undersheriff", "Major", "Captain"]);
const DISMISS_KEY = "lscso.portal.notification-attention:v3";

export function PortalNotificationLink({ audience }: { audience: "command" | "deputy" }) {
  const profile = usePortalProfile();
  const [unreadCount, setUnreadCount] = useState(0);
  const [actionCount, setActionCount] = useState(0);
  const [latestNotifications, setLatestNotifications] = useState<NotificationStackItem[]>([]);
  const [dismissedSignature, setDismissedSignature] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function refreshCounts() {
      const supabase = createClient() as any;
      const fullCommandAccess = ["Executive", "Command"].includes(profile.access_tier);

      let notificationQuery = supabase.from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_profile_id", profile.id)
        .is("read_at", null);

      let latestNotificationQuery = supabase.from("notifications")
        .select("id,notification_type,title,message,href,created_at")
        .eq("recipient_profile_id", profile.id)
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(3);

      if (!DEPARTMENT_COMMAND_RANKS.has(profile.rank)) {
        notificationQuery = notificationQuery.neq("notification_type", "Guardian Approval");
        latestNotificationQuery = latestNotificationQuery.neq("notification_type", "Guardian Approval");
      }

      const assignedRequestQuery = supabase.from("personnel_requests")
        .select("id", { count: "exact", head: true })
        .eq("current_reviewer_profile_id", profile.id)
        .in("status", ["Submitted", "In Review"]);

      const fallbackRequestQuery = ["Sheriff", "Undersheriff"].includes(profile.rank)
        ? supabase.from("personnel_requests").select("id", { count: "exact", head: true }).eq("routing_fallback", true).is("current_reviewer_profile_id", null).in("status", ["Submitted", "In Review"]).neq("requester_profile_id", profile.id)
        : Promise.resolve({ count: 0 });

      const [notificationResult, latestNotificationResult, guardianAckResult, assignedRequestResult, fallbackRequestResult] = await Promise.all([
        notificationQuery,
        latestNotificationQuery,
        supabase.from("guardian_records").select("id", { count: "exact", head: true }).eq("subject_profile_id", profile.id).eq("status", "Awaiting Acknowledgment"),
        assignedRequestQuery,
        fallbackRequestQuery,
      ]);

      let nextActionCount = (guardianAckResult.count ?? 0) + (assignedRequestResult.count ?? 0) + (fallbackRequestResult.count ?? 0);

      if (audience === "command") {
        let scopedIds: string[] | null = null;
        if (!DEPARTMENT_COMMAND_RANKS.has(profile.rank)) {
          const { data, error } = await supabase.rpc("get_personnel_in_my_purview");
          if (!error) {
            scopedIds = Array.from(new Set((data ?? []).map((row: any) => row.profile_id).filter((id: string) => Boolean(id) && id !== profile.id))) as string[];
          }
        }

        const canQueryDepartment = DEPARTMENT_COMMAND_RANKS.has(profile.rank);
        if (canQueryDepartment || (scopedIds && scopedIds.length)) {
          const applyScope = (query: any, column: string) => canQueryDepartment ? query.neq(column, profile.id) : query.in(column, scopedIds!);
          const now = new Date().toISOString();
          const departmentResults = await Promise.all([
            applyScope(supabase.from("guardian_records").select("id", { count: "exact", head: true }).eq("status", "Pending Approval"), "subject_profile_id"),
            fullCommandAccess
              ? applyScope(supabase.from("leave_requests").select("id", { count: "exact", head: true }).in("status", ["Submitted", "In Review"]), "profile_id")
              : Promise.resolve({ count: 0 }),
            fullCommandAccess
              ? applyScope(supabase.from("certifications").select("id", { count: "exact", head: true }).in("status", ["Requested", "Pending"]), "profile_id")
              : Promise.resolve({ count: 0 }),
            applyScope(supabase.from("guardian_records").select("id", { count: "exact", head: true }).lte("follow_up_due_at", now).not("status", "in", "(Acknowledged,Closed)"), "subject_profile_id"),
          ]);
          nextActionCount += departmentResults.reduce((sum, result) => sum + (result.count ?? 0), 0);
        }
      }

      if (!cancelled) {
        setUnreadCount(notificationResult.count ?? 0);
        setActionCount(nextActionCount);
        setLatestNotifications((latestNotificationResult.data ?? []).map((item: any) => ({
          id: String(item.id),
          title: String(item.title || "Portal notification"),
          message: String(item.message || "Open the Notification Center for details."),
          href: item.href ? String(item.href) : null,
          createdAt: String(item.created_at || ""),
          type: String(item.notification_type || "Portal notification"),
        })));
      }
    }

    void refreshCounts();
    const interval = window.setInterval(refreshCounts, 15_000);
    const onFocus = () => void refreshCounts();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [audience, profile.access_tier, profile.id, profile.rank]);

  const latestSignature = useMemo(() => latestNotifications.map((item) => item.id).join(","), [latestNotifications]);
  const attentionSignature = useMemo(() => `${profile.id}:${actionCount}:${unreadCount}:${latestSignature}`, [profile.id, actionCount, unreadCount, latestSignature]);

  useEffect(() => {
    if (!actionCount && !unreadCount) {
      setDismissedSignature("");
      return;
    }
    try {
      const stored = window.sessionStorage.getItem(DISMISS_KEY) ?? "";
      setDismissedSignature(stored === attentionSignature ? attentionSignature : "");
    } catch {
      setDismissedSignature("");
    }
  }, [actionCount, attentionSignature, unreadCount]);

  function dismissAttention() {
    setDismissedSignature(attentionSignature);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, attentionSignature);
    } catch {
      // Session storage is optional; visual dismissal still works.
    }
  }

  const badgeCount = actionCount > 0 ? actionCount : unreadCount;
  const ariaLabel = actionCount > 0
    ? `${actionCount} items require action and ${unreadCount} unread notifications`
    : `${unreadCount} unread portal notifications`;
  const hasAttention = actionCount > 0 || unreadCount > 0;
  const showAttentionStack = hasAttention && dismissedSignature !== attentionSignature;

  return (
    <>
      <Link
        aria-label={ariaLabel}
        className={`portal-notification-button${actionCount > 0 ? " has-actions" : unreadCount > 0 ? " has-unread" : ""}`}
        href="/portal/notifications"
        title={actionCount > 0 ? `${actionCount} action-required item${actionCount === 1 ? "" : "s"} · ${unreadCount} unread` : unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}` : "Notifications"}
      >
        <span aria-hidden="true">{String(badgeCount).padStart(2, "0")}</span>
        {actionCount > 0 ? "Action required" : "Notifications"}
      </Link>

      {showAttentionStack ? (
        <PortalNotificationStack
          actionCount={actionCount}
          unreadCount={unreadCount}
          notifications={latestNotifications}
          onDismiss={dismissAttention}
        />
      ) : null}
    </>
  );
}
