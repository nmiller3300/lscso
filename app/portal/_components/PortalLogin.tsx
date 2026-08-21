"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ActiveProfile = { display_name: string; access_tier: string };

function toInternalEmail(username: string) {
  return `${username.trim().toLowerCase()}@auth.lscso.internal`;
}

function homeFor(accessTier: string) {
  return accessTier === "Deputy" ? "/portal/personnel" : "/portal/command";
}

export function PortalLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [activeProfile, setActiveProfile] = useState<ActiveProfile | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;

      const { data: profile } = await supabase
        .from("personnel_profiles")
        .select("display_name,access_tier,status")
        .eq("auth_user_id", data.user.id)
        .maybeSingle();

      if (!cancelled && profile && ["Active", "Acting"].includes(profile.status)) {
        setActiveProfile(profile);
      }
    }

    void loadSession();
    return () => { cancelled = true; };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);

    try {
      const supabase = createClient();
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: toInternalEmail(username),
        password,
      });

      if (signInError || !data.user) {
        setError("The username or password is incorrect, or this account is not active.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("personnel_profiles")
        .select("display_name,access_tier,status")
        .eq("auth_user_id", data.user.id)
        .maybeSingle();

      if (profileError || !profile || !["Active", "Acting"].includes(profile.status)) {
        await supabase.auth.signOut({ scope: "local" });
        setError("This account does not have an active LSCSO personnel profile.");
        return;
      }

      await supabase.rpc("record_session_event", {
        session_event_type: "Sign In",
        session_user_agent: navigator.userAgent,
      });
      setActiveProfile(profile);
      router.push(homeFor(profile.access_tier));
      router.refresh();
    } catch {
      setError("The secure sign-in service could not be reached. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="portal-login-block" id="account-login">
      <form className="portal-login-preview" onSubmit={handleSubmit} aria-label="LSCSO account sign-in">
        <label>
          Assigned username
          <input
            autoCapitalize="none"
            autoComplete="username"
            name="username"
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Username assigned by Command"
            required
            spellCheck={false}
            value={username}
          />
        </label>
        <label>
          Password
          <input
            autoComplete="current-password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Enter assigned password"
            required
            type="password"
            value={password}
          />
        </label>
        {error ? <p className="portal-login-error" role="alert">{error}</p> : null}
        <button disabled={pending} type="submit">{pending ? "Verifying…" : "Sign in"}</button>
      </form>

      {activeProfile ? (
        <button className="portal-continue-session" onClick={() => router.push(homeFor(activeProfile.access_tier))} type="button">
          Continue {activeProfile.display_name} session →
        </button>
      ) : null}
    </div>
  );
}
