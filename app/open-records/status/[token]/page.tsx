import { createHash } from "node:crypto";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OpenRecordsStatusClient } from "./OpenRecordsStatusClient";
import "../../open-records.css";

export const metadata: Metadata = {
  title: "Open Records Request Status",
  description: "Private LSCSO Open Records Request status and electronic release page.",
  robots: { index: false, follow: false, noarchive: true },
};

export const dynamic = "force-dynamic";

export default async function OpenRecordsStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length < 32 || token.length > 256) notFound();

  const tokenHash = createHash("sha256").update(token).digest("hex");
  const supabase = await createClient() as any;
  const { data, error } = await supabase.rpc("get_open_records_request_status", { p_tracking_token_hash: tokenHash });
  if (error || !data || typeof data !== "object") notFound();

  return (
    <main className="open-records-status-page">
      <div className="site-shell">
        <OpenRecordsStatusClient request={data as any} />
      </div>
    </main>
  );
}
