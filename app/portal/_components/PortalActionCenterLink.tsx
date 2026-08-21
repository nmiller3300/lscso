"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePortalProfile } from "./PortalProfileProvider";

const DEPARTMENT_COMMAND_RANKS = new Set(["Sheriff", "Undersheriff", "Major", "Captain"]);

export function PortalActionCenterLink({ audience }: { audience: "command" | "deputy" }) {
  const profile = usePortalProfile();
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function refreshCount() {
      const supabase = createClient() as any;
      let total = 0;

      const personalResults = await Promise.all([
        supabase.from("guardian_records").select("id", { count: "exact", head: true }).eq("subject_profile_id", profile.id).eq("status", "Awaiting Acknowledgment"),
        supabase.from("personnel_requests").select("id", { count: "exact", head: true }).eq("requester_profile_id", profile.id).in("status", ["Submitted", "In Review"]),
        supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("profile_id", profile.id).in("status", ["Submitted", "In Review"]),
        supabase.from("certifications").select("id", { count: "exact", head: true }).eq("profile_id", profile.id).in("status", ["Requested", "Pending"]),
      ]);
      total += personalResults.reduce((sum, result) => sum + (result.count ?? 0), 0);

      if (audience === "command") {
        let scopedIds: string[] | null = null;
        if (!DEPARTMENT_COMMAND_RANKS.has(profile.rank)) {
          const { data, error } = await supabase.rpc("get_personnel_in_my_purview");
          if (!error) scopedIds = Array.from(new Set((data ?? []).map((row: any) => row.profile_id).filter(Boolean)));
        }

        const canQueryDepartment = DEPARTMENT_COMMAND_RANKS.has(profile.rank);
        if (canQueryDepartment || (scopedIds && scopedIds.length)) {
          const applyScope = (query: any, column: string) => canQueryDepartment ? query : query.in(column, scopedIds!);
          const now = new Date().toISOString();
          const [guardians, requests, leave, certs, followUps] = await Promise.all([
            applyScope(supabase.from("guardian_records").select("id", { count: "exact", head: true }).eq("status", "Pending Approval"), "subject_profile_id"),
            applyScope(supabase.from("personnel_requests").select("id", { count: "exact", head: true }).in("status", ["Submitted", "In Review"]), "requester_profile_id"),
            applyScope(supabase.from("leave_requests").select("id", { count: "exact", head: true }).in("status", ["Submitted", "In Review"]), "profile_id"),
            applyScope(supabase.from("certifications").select("id", { count: "exact", head: true }).in("status", ["Requested", "Pending"]), "profile_id"),
            applyScope(supabase.from("guardian_records").select("id", { count: "exact", head: true }).lte("follow_up_due_at", now).not("status", "in", "(Acknowledged,Closed)"), "subject_profile_id"),
          ]);
          total += [guardians, requests, leave, certs, followUps].reduce((sum, result) => sum + (result.count ?? 0), 0);
        }
      }

      if (!cancelled) setCount(total);
    }

    void refreshCount();
    const interval = window.setInterval(refreshCount, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [audience, profile.id, profile.rank]);

  return (
    <Link aria-label={`${count} items require action`} className="portal-action-center-button" href="/portal/notifications#action-required">
      <span aria-hidden="true">{String(count).padStart(2, "0")}</span>
      Action Center
    </Link>
  );
}
