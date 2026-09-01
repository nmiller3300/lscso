"use client";

import { useEffect, useMemo, useState } from "react";
import {
  invokeSheriffAccountTest,
  type SheriffCredentialActivity,
} from "@/lib/supabase/sheriff-account-test";
import { usePortalProfile } from "./PortalProfileProvider";

type TestableAccount = {
  profileId: string;
  personnelId: string;
  displayName: string;
  username: string | null;
  callSign: string | null;
  rank: string;
  status: string;
};

function formatDate(value: string | null) {
  if (!value) return "No recorded activity";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No recorded activity";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function credentialEventLabel(value: string | null) {
  if (value === "ACCOUNT_PASSWORD_CHANGED") return "Password changed by member";
  if (value === "ACCOUNT_PASSWORD_RESET") return "Password reset by Command";
  if (value === "ACCOUNT_CREDENTIALS_ASSIGNED") return "Credentials assigned";
  return "No credential event recorded";
}

export function SheriffAccountTestAccess({ accounts }: { accounts: TestableAccount[] }) {
  const profile = usePortalProfile();
  const isSheriff = profile.rank === "Sheriff";
  const [selectedProfileId, setSelectedProfileId] = useState("");
  const [activity, setActivity] = useState<SheriffCredentialActivity[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [secureLink, setSecureLink] = useState("");
  const [linkTarget, setLinkTarget] = useState("");

  const testable = useMemo(
    () => accounts.filter((account) =>
      account.profileId !== profile.id &&
      Boolean(account.username) &&
      ["Active", "Acting"].includes(account.status),
    ),
    [accounts, profile.id],
  );

  useEffect(() => {
    if (!isSheriff) return;
    let cancelled = false;

    async function load() {
      setLoadingActivity(true);
      try {
        const result = await invokeSheriffAccountTest({ operation: "list_security_activity" });
        if (!cancelled) setActivity(result.accounts ?? []);
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Credential activity could not be loaded.");
      } finally {
        if (!cancelled) setLoadingActivity(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [isSheriff]);

  if (!isSheriff) return null;

  async function generateTestLogin() {
    if (!selectedProfileId || pending) return;
    setPending(true);
    setError("");
    setNotice("");
    setSecureLink("");
    setLinkTarget("");

    try {
      const redirectTo = `${window.location.origin}/portal`;
      const result = await invokeSheriffAccountTest({
        operation: "generate_test_login",
        profile_id: selectedProfileId,
        redirect_to: redirectTo,
      });

      if (!result.action_link || !result.target) throw new Error("The secure test login was not returned.");
      setSecureLink(result.action_link);
      setLinkTarget(`${result.target.personnel_id} · ${result.target.display_name}`);
      setNotice("One-time account test access generated. Use it immediately in a Private/Incognito window.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "A secure test login could not be generated.");
    } finally {
      setPending(false);
    }
  }

  async function copySecureLink() {
    if (!secureLink) return;
    try {
      await navigator.clipboard.writeText(secureLink);
      setNotice(`Secure test link copied for ${linkTarget}. Paste it into a Private/Incognito window.`);
    } catch {
      setError("Your browser blocked clipboard access. Select and copy the secure link manually.");
    }
  }

  return (
    <section className="portal-panel portal-sheriff-security">
      <div className="portal-panel-heading">
        <div><p>Sheriff restricted</p><h2>Account Security & Testing</h2></div>
        <span>Sheriff only</span>
      </div>
      <p className="portal-sheriff-security__intro">Test personnel access and review credential activity without exposing or resetting member passwords.</p>

      <div className="portal-sheriff-security__grid">
        <div className="portal-sheriff-security__test">
          <div className="portal-subheading"><span>Account testing</span><strong>Login as a personnel account</strong></div>
          <p>Create a one-time passwordless test login. Generation is recorded in the department audit log.</p>
          <label>
            Personnel account
            <select value={selectedProfileId} onChange={(event) => setSelectedProfileId(event.target.value)}>
              <option value="">Select an active account</option>
              {testable.map((account) => (
                <option key={account.profileId} value={account.profileId}>
                  {account.callSign || account.personnelId} · {account.displayName} · {account.rank}
                </option>
              ))}
            </select>
          </label>
          <button className="portal-button portal-button--primary" disabled={!selectedProfileId || pending} onClick={() => void generateTestLogin()} type="button">
            {pending ? "Generating secure access…" : "Generate test login"}
          </button>

          {secureLink ? (
            <div className="portal-secure-link-result">
              <strong>{linkTarget}</strong>
              <span>Copy this into a Private/Incognito window so your Sheriff session stays isolated.</span>
              <input aria-label="One-time account test login link" onFocus={(event) => event.currentTarget.select()} readOnly value={secureLink} />
              <div className="command-v2-action-row">
                <button className="portal-button" onClick={() => void copySecureLink()} type="button">Copy link</button>
                <button className="portal-button" onClick={() => { setSecureLink(""); setLinkTarget(""); setNotice(""); }} type="button">Clear</button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="portal-sheriff-security__activity">
          <div className="portal-subheading"><span>Credential oversight</span><strong>Security activity</strong><b>{loadingActivity ? "Loading…" : `${activity.length} accounts`}</b></div>
          <p>Password values are never available. This records credential assignment/change events and the latest recorded sign-in.</p>
          <div className="portal-security-activity-list">
            {activity.map((account) => (
              <div key={account.profile_id}>
                <div><strong>{account.display_name}</strong><span>{account.call_sign || account.personnel_id} · {account.rank}</span></div>
                <div><small>{account.credentials_assigned ? credentialEventLabel(account.last_credential_event) : "Credentials not assigned"}</small><span>{formatDate(account.last_credential_at)}</span></div>
                <div><small>Last sign-in</small><span>{formatDate(account.last_sign_in_at)}</span></div>
              </div>
            ))}
            {!loadingActivity && !activity.length ? <div className="portal-empty-state"><strong>No credential activity is available.</strong></div> : null}
          </div>
        </div>
      </div>

      {error ? <div className="portal-form-error" role="alert">{error}</div> : null}
      {notice ? <div className="portal-form-success" role="status"><strong>Account test access</strong><span>{notice}</span></div> : null}
    </section>
  );
}
