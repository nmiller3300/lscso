import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { getActiveJailbirds } from "../../../lib/jailbirds";
import { JailbirdsManager } from "./JailbirdsUploader";
import "./jailbirds-admin.css";

export const dynamic = "force-dynamic";

export default async function PortalJailbirdsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/portal");

  const records = await getActiveJailbirds();

  return (
    <main className="jailbirds-admin-page">
      <div className="jailbirds-admin-shell">
        <header className="jailbirds-admin-header">
          <div>
            <span className="jailbirds-admin-kicker">Public Information</span>
            <h1>Jailbirds</h1>
            <p>Publish, edit, and manage recent arrest profiles shown on the public LSCSO website.</p>
          </div>
          <a href="/jailbirds" target="_blank" rel="noreferrer">View public page ↗</a>
        </header>

        <JailbirdsManager records={records.map((record) => ({
          id: record.id,
          full_name: record.full_name,
          booking_number: record.booking_number,
          charges: record.charges,
          arrested_at: record.arrested_at,
          expires_at: record.expires_at,
          imageUrl: record.imageUrl,
        }))} />
      </div>
    </main>
  );
}
