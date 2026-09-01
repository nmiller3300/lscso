"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ActiveProfile = { display_name: string; access_tier: string };

const DEACTIVATED_MESSAGE = "This LSCSO account has been deactivated. If you believe this is a mistake, contact your system administrator.";

function toInternalEmail(username: string) {
  return `${username.trim().toLowerCase()}@auth.lscso.internal`;
}

function homeFor(accessTier: string) {
  if (accessTier === "Deputy") return "/portal/personnel";
  if (["Supervisor", "Preliminary"].includes(accessTier)) return "/portal/command/guardians";
  return "/portal/command";
}

export function PortalLogin() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  async function accountStateFor(usernameValue: string) {
    const supabase = createClient() as any;
    const { data } = await supabase.rpc("get_login_account_state", {
      p_username: usernameValue.trim().toLowerCase(),
    });
    return data === "Deactivated" ? "Deactivated" : "Other";
  }

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
        const accountState = await accountStateFor(username).catch(() => "Other");
        setError(accountState === "Deactivated" ? DEACTIVATED_MESSAGE : "The username or password is incorrect, or this account is not active.");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("personnel_profiles")
        .select("display_name,access_tier,status")
        .eq("auth_user_id", data.user.id)
        .maybeSingle();

      if (profileError || !profile || !["Active", "Acting"].includes(profile.status)) {
        await supabase.auth.signOut({ scope: "local" });
        setError(profile?.status === "Deactivated" ? DEACTIVATED_MESSAGE : "This account does not have an active LSCSO personnel profile.");
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
    <div className="portal-auth" id="account-login">
      {activeProfile ? (
        <button className="portal-auth__resume" onClick={() => router.push(homeFor(activeProfile.access_tier))} type="button">
          <span className="portal-auth__resume-dot" />
          <div>
            <small>Active secure session detected</small>
            <strong>Continue as {activeProfile.display_name}</strong>
          </div>
          <b aria-hidden="true">→</b>
        </button>
      ) : null}

      <form className="portal-auth__form" onSubmit={handleSubmit} aria-label="LSCSO account sign-in">
        <label className="portal-auth__field">
          <span className="portal-auth__field-label">Assigned username</span>
          <div className="portal-auth__input-shell">
            <span className="portal-auth__input-icon" aria-hidden="true">ID</span>
            <input
              autoCapitalize="none"
              autoComplete="username"
              name="username"
              onChange={(event) => setUsername(event.target.value)}
              placeholder="first.last"
              required
              spellCheck={false}
              value={username}
            />
          </div>
        </label>

        <label className="portal-auth__field">
          <span className="portal-auth__field-label">Password</span>
          <div className="portal-auth__input-shell portal-auth__input-shell--password">
            <span className="portal-auth__input-icon" aria-hidden="true">KY</span>
            <input
              autoComplete="current-password"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter secure password"
              required
              type={showPassword ? "text" : "password"}
              value={password}
            />
            <button
              className="portal-auth__password-toggle"
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        {error ? (
          <div className="portal-auth__error" role="alert">
            <span aria-hidden="true">!</span>
            <p>{error}</p>
          </div>
        ) : null}

        <button className="portal-auth__submit" disabled={pending} type="submit">
          <span>{pending ? "Authenticating secure session…" : "Enter Personnel Portal"}</span>
          <b aria-hidden="true">→</b>
        </button>
      </form>

      <div className="portal-auth__trust-row" aria-label="Authentication protections">
        <span><i /> Encrypted authentication</span>
        <span><i /> Role-based access</span>
        <span><i /> Audited activity</span>
      </div>
    </div>
  );
}
