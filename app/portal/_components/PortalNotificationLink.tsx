"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePortalProfile } from "./PortalProfileProvider";

export function PortalNotificationLink({ audience }: { audience: "command" | "deputy" }) {
  const profile = usePortalProfile();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function refreshCount() {
      const supabase = createClient();
      const { count: directCount } = await supabase.from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_profile_id", profile.id)
        .is("read_at", null);

      let actionCount = 0;
      if (audience === "command") {
        if (["Executive", "Command"].includes(profile.access_tier)) {
          const [{ count: guardianCount }, { count: requestCount }] = await Promise.all([
            supabase.from("guardian_records").select("id", { count: "exact", head: true }).eq("status", "Pending Approval"),
            supabase.from("personnel_requests").select("id", { count: "exact", head: true }).in("status", ["Submitted", "In Review"]),
          ]);
          actionCount = (guardianCount ?? 0) + (requestCount ?? 0);
        } else {
          const { count } = await supabase.from("guardian_records")
            .select("id", { count: "exact", head: true })
            .eq("author_profile_id", profile.id)
            .eq("status", "Approved");
          actionCount = count ?? 0;
        }
      } else {
        const { count } = await supabase.from("guardian_records")
          .select("id", { count: "exact", head: true })
          .eq("subject_profile_id", profile.id)
          .eq("status", "Awaiting Acknowledgment");
        actionCount = count ?? 0;
      }

      if (!cancelled) setUnreadCount((directCount ?? 0) + actionCount);
    }

    void refreshCount();
    const interval = window.setInterval(refreshCount, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [audience, profile.access_tier, profile.id]);

  const destination = audience === "command"
    ? ["Executive", "Command"].includes(profile.access_tier)
      ? "/portal/command#notifications"
      : "/portal/command/guardians"
    : "/portal/personnel#notifications";
  return (
    <Link aria-label={`${unreadCount} portal notifications`} className="portal-notification-button" href={destination}>
      <span aria-hidden="true">{String(unreadCount).padStart(2, "0")}</span>
      Notifications
    </Link>
  );
}
