"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

function internalEmail(username: string) { return `${username.trim().toLowerCase()}@auth.lscso.internal`; }

export function ExecutiveMaintenanceAccess() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError("");
    const supabase = createClient() as any;
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email: internalEmail(username), password });
      if (signInError || !data.user) throw new Error("The username or password is incorrect.");
      const { data: profile } = await supabase.from("personnel_profiles").select("access_tier,status").eq("auth_user_id", data.user.id).maybeSingle();
      if (!profile || profile.access_tier !== "Executive" || !["Active", "Acting"].includes(profile.status)) {
        await supabase.auth.signOut({ scope: "local" });
        throw new Error("Executive maintenance access is restricted to active Sheriff or Undersheriff accounts.");
      }
      router.replace("/portal/command/administration/maintenance");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Executive access could not be verified.");
    } finally { setPending(false); }
  }

  return (
    <main className="maintenance-screen maintenance-screen--portal">
      <section className="maintenance-access-card">
        <span>Executive maintenance access</span>
        <h1>Maintain control during an outage.</h1>
        <p>This access path remains available during Portal maintenance so authorized Executive Command can review status or restore Personnel Operations.</p>
        <form onSubmit={submit}>
          <label>Assigned username<input autoCapitalize="none" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
          <label>Password<input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          {error ? <div className="portal-form-error" role="alert">{error}</div> : null}
          <button disabled={pending} type="submit">{pending ? "Verifying Executive authority…" : "Enter maintenance control"}</button>
        </form>
        <a href="/portal/maintenance">← Return to maintenance status</a>
      </section>
    </main>
  );
}
