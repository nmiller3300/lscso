"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePortalProfile } from "./PortalProfileProvider";

const DEPARTMENT_COMMAND_RANKS = new Set(["Sheriff", "Undersheriff", "Major", "Captain"]);

export function PortalNotificationLink({ audience }: { audience: "command" | "deputy" }) {
  const profile = usePortalProfile();
  const [unreadCount, setUnreadCount] = useState(0);
  const [actionCount, setActionCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function refreshCounts() {
      const supabase = createClient() as any;

      let notificationQuery = supabase.from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_profile_id", profile.id)
        .is("read_at", null);

      if (!DEPARTMENT_COMMAND_RANKS.has(profile.rank)) {
        notificationQuery = notificationQuery.neq("notification_type", "Guardian Approval");
      }

      const [notificationResult, ...personalResults] = await Promise.all([
        notificationQuery,
        supabase.from("guardian_records").select("id", { count: "exact", head: true }).eq("subject_profile_id", profile.id).eq("status", "Awaiting Acknowledgment"),
        supabase.from("personnel_requests").select("id", { count: "exact", head: true }).eq("requester_profile_id", profile.id).in("status", ["Submitted", "In Review"]),
        supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("profile_id", profile.id).in("status", ["Submitted", "In Review"]),
        supabase.from("certifications").select("id", { count: "exact", head: true }).eq("profile_id", profile.id).in("status", ["Requested", "Pending"]),
      ]);

      let nextActionCount = personalResults.reduce((sum, result) => sum + (result.count ?? 0), 0);

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
            applyScope(supabase.from("personnel_requests").select("id", { count: "exact", head: true }).in("status", ["Submitted", "In Review"]), "requester_profile_id"),
            applyScope(supabase.from("leave_requests").select("id", { count: "exact", head: true }).in("status", ["Submitted", "In Review"]), "profile_id"),
            applyScope(supabase.from("certifications").select("id", { count: "exact", head: true }).in("status", ["Requested", "Pending"]), "profile_id"),
            applyScope(supabase.from("guardian_records").select("id", { count: "exact", head: true }).lte("follow_up_due_at", now).not("status", "in", "(Acknowledged,Closed)"), "subject_profile_id"),
          ]);
          nextActionCount += departmentResults.reduce((sum, result) => sum + (result.count ?? 0), 0);
        }
      }

      if (!cancelled) {
        setUnreadCount(notificationResult.count ?? 0);
        setActionCount(nextActionCount);
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
  }, [audience, profile.id, profile.rank]);

  const badgeCount = actionCount > 0 ? actionCount : unreadCount;
  const ariaLabel = actionCount > 0
    ? `${actionCount} items require action and ${unreadCount} unread notifications`
    : `${unreadCount} unread portal notifications`;

  return (
    <Link
      aria-label={ariaLabel}
      className={`portal-notification-button${actionCount > 0 ? " has-actions" : ""}`}
      href="/portal/notifications"
      title={actionCount > 0 ? `${actionCount} action-required item${actionCount === 1 ? "" : "s"} · ${unreadCount} unread` : "Notifications"}
    >
      <span aria-hidden="true">{String(badgeCount).padStart(2, "0")}</span>
      Notifications
    </Link>
  );
}
