"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LIVE_TABLES = [
  "notifications",
  "command_orders",
  "command_order_acknowledgments",
  "open_records_requests",
  "recruitment_applications",
  "recruitment_employment_offers",
  "personnel_requests",
  "guardian_records",
  "leave_requests",
  "certifications",
  "personnel_profiles",
  "training_progress",
  "promotion_cases",
] as const;

export function PortalRealtimeRefresh() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient() as any;
    const channel = supabase.channel(`portal-live-${Math.random().toString(36).slice(2)}`);
    let timer: number | null = null;

    const refreshSoon = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = null;
        if (document.visibilityState === "visible") router.refresh();
      }, 180);
    };

    for (const table of LIVE_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        refreshSoon,
      );
    }

    channel.subscribe((status: string) => {
      if (status === "SUBSCRIBED") refreshSoon();
    });

    const fallback = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshSoon();
    };
    const onFocus = () => refreshSoon();
    const onOnline = () => refreshSoon();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    return () => {
      if (timer !== null) window.clearTimeout(timer);
      window.clearInterval(fallback);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return null;
}
