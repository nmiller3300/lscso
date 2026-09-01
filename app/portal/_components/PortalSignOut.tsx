"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function PortalSignOut({ label, className = "portal-signout" }: { label: string; className?: string }) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.rpc("record_session_event", {
      session_event_type: "Sign Out",
      session_user_agent: navigator.userAgent,
    });
    await supabase.auth.signOut({ scope: "local" });
    router.replace("/portal");
    router.refresh();
  }

  return <button className={className} onClick={() => void signOut()} type="button">{label}</button>;
}
