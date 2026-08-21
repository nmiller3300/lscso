"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePortalProfile } from "./PortalProfileProvider";

export function PortalNotificationLink({ audience: _audience }: { audience: "command" | "deputy" }) {
  const profile = usePortalProfile();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function refreshCount() {
      const supabase = createClient();
      const { count } = await supabase.from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_profile_id", profile.id)
        .is("read_at", null);

      if (!cancelled) setUnreadCount(count ?? 0);
    }

    void refreshCount();
    const interval = window.setInterval(refreshCount, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [profile.id]);

  return (
    <Link aria-label={`${unreadCount} unread portal notifications`} className="portal-notification-button" href="/portal/notifications#inbox">
      <span aria-hidden="true">{String(unreadCount).padStart(2, "0")}</span>
      Notifications
    </Link>
  );
}
