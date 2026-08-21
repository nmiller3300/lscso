"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePortalProfile } from "./PortalProfileProvider";

const DEPARTMENT_COMMAND_RANKS = new Set(["Sheriff", "Undersheriff", "Major", "Captain"]);

export function PortalNotificationLink({ audience: _audience }: { audience: "command" | "deputy" }) {
  const profile = usePortalProfile();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function refreshCount() {
      const supabase = createClient();
      let query = supabase.from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_profile_id", profile.id)
        .is("read_at", null);

      // The legacy DB trigger broadcasts Guardian Approval notices to the entire
      // Command access tier. 1st Lieutenant is scoped in V2, so suppress those
      // legacy broadcasts until structured recipient routing replaces the trigger.
      if (!DEPARTMENT_COMMAND_RANKS.has(profile.rank)) {
        query = query.neq("notification_type", "Guardian Approval");
      }

      const { count } = await query;
      if (!cancelled) setUnreadCount(count ?? 0);
    }

    void refreshCount();
    const interval = window.setInterval(refreshCount, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [profile.id, profile.rank]);

  return (
    <Link aria-label={`${unreadCount} unread portal notifications`} className="portal-notification-button" href="/portal/notifications#inbox">
      <span aria-hidden="true">{String(unreadCount).padStart(2, "0")}</span>
      Notifications
    </Link>
  );
}
