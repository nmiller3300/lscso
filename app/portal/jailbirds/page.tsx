import { redirect } from "next/navigation";
import { createClient } from "../../../lib/supabase/server";
import { JailbirdsUploader } from "./JailbirdsUploader";
import "./jailbirds-admin.css";

export const dynamic = "force-dynamic";

export default async function PortalJailbirdsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/portal");

  return (
    <main className="jailbirds-admin-page">
      <div className="jailbirds-admin-shell">
        <header className="jailbirds-admin-header">
          <div>
            <span className="jailbirds-admin-kicker">Public Information</span>
            <h1>Jailbirds</h1>
            <p>Publish recent arrest photographs to the public LSCSO website.</p>
          </div>
          <a href="/jailbirds" target="_blank" rel="noreferrer">View public page ↗</a>
        </header>

        <section className="jailbirds-admin-panel">
          <div className="jailbirds-admin-panel__heading">
            <div>
              <span>New Release</span>
              <h2>Publish booking entry</h2>
            </div>
            <strong>72 HR</strong>
          </div>
          <JailbirdsUploader />
        </section>
      </div>
    </main>
  );
}
