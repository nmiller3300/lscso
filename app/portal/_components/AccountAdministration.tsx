"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { isStrongPassword, PASSWORD_MIN_LENGTH, PASSWORD_REQUIREMENT } from "@/lib/auth/password-policy";
import { invokePersonnelAdmin } from "@/lib/supabase/personnel-admin";
import { usePortalProfile } from "./PortalProfileProvider";
import { SheriffAccountTestAccess } from "./SheriffAccountTestAccess";

type ExistingAccount = {
  profileId: string;
  personnelId: string;
  displayName: string;
  username: string | null;
  callSign: string | null;
  rank: string;
  status: string;
};

type AccountAdministrationProps = {
  personnel: ExistingAccount[];
  divisionOptions: string[];
};

const STANDARD_CALL_SIGN = /^S-4[0-9]{2}$/;
const TEST_CALL_SIGN = /^TA-[0-9]{1,3}$/;
const ACCOUNT_SECURITY_RANKS = new Set(["Sheriff", "Undersheriff", "Major", "Captain"]);

const ranks = [
  "Sheriff",
  "Undersheriff",
  "Major",
  "Captain",
  "1st Lieutenant",
  "Lieutenant",
  "Sergeant",
  "Corporal",
  "Master Deputy",
  "Deputy III",
  "Deputy II",
  "Deputy",
  "Recruit",
] as const;

function getNextPersonnelId(personnel: ExistingAccount[], isTestAccount: boolean) {
  const prefix = isTestAccount ? "TA" : "LS";
  const pattern = isTestAccount ? /^TA-(\d{3})$/ : /^LS-(\d{3})$/;
  const highest = personnel.reduce((current, member) => {
    const match = member.personnelId.match(pattern);
    if (!match) return current;
    return Math.max(current, Number(match[1]));
  }, 0);
  const next = highest + 1;
  return next <= 999 ? `${prefix}-${String(next).padStart(3, "0")}` : null;
}

function suggestedUsername(displayName: string) {
  const parts = displayName
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s.-]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const base = parts.join(".").replace(/\.{2,}/g, ".").slice(0, 32);
  return /^[a-z0-9][a-z0-9._-]{2,31}$/.test(base) ? base : "";
}

export function AccountAdministration({ personnel, divisionOptions }: AccountAdministrationProps) {
  const router = useRouter();
  const profile = usePortalProfile();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [testAccount, setTestAccount] = useState(false);
  const executive = profile.rank === "Sheriff" || profile.rank === "Undersheriff";
  const canAssignCredentials = ACCOUNT_SECURITY_RANKS.has(profile.rank);

  const activeAccounts = useMemo(() => personnel.filter((member) => member.status !== "Deactivated"), [personnel]);
  const credentialedAccounts = useMemo(() => activeAccounts.filter((member) => member.username), [activeAccounts]);
  const uncredentialedAccounts = useMemo(() => activeAccounts.filter((member) => !member.username), [activeAccounts]);
  const nextPersonnelId = useMemo(() => getNextPersonnelId(personnel, testAccount), [personnel, testAccount]);

  const firstUncredentialed = uncredentialedAccounts[0] ?? null;
  const [credentialProfileId, setCredentialProfileId] = useState(firstUncredentialed?.profileId ?? "");
  const [credentialUsername, setCredentialUsername] = useState(firstUncredentialed ? suggestedUsername(firstUncredentialed.displayName) : "");
  const [credentialPending, setCredentialPending] = useState(false);
  const [credentialError, setCredentialError] = useState("");
  const [credentialNotice, setCredentialNotice] = useState("");

  const selectedCredentialAccount = uncredentialedAccounts.find((member) => member.profileId === credentialProfileId) ?? null;

  function selectCredentialProfile(profileId: string) {
    const member = uncredentialedAccounts.find((item) => item.profileId === profileId) ?? null;
    setCredentialProfileId(profileId);
    setCredentialUsername(member ? suggestedUsername(member.displayName) : "");
    setCredentialError("");
    setCredentialNotice("");
  }

  async function assignCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (credentialPending || !selectedCredentialAccount) return;

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const username = credentialUsername.trim().toLowerCase();
    const password = String(form.get("credentialPassword") ?? "");

    setCredentialError("");
    setCredentialNotice("");

    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
      return setCredentialError("Username must contain 3–32 lowercase letters, numbers, dots, underscores, or hyphens.");
    }
    if (!isStrongPassword(password)) return setCredentialError(PASSWORD_REQUIREMENT);
    if (personnel.some((member) => member.username === username)) return setCredentialError(`@${username} is already assigned.`);

    setCredentialPending(true);
    try {
      await invokePersonnelAdmin({
        operation: "assign_credentials",
        profile_id: selectedCredentialAccount.profileId,
        username,
        password,
      });
      setCredentialNotice(`${selectedCredentialAccount.personnelId} · ${selectedCredentialAccount.displayName} can now sign in as @${username}.`);
      setCredentialProfileId("");
      setCredentialUsername("");
      formElement.reset();
      router.refresh();
    } catch (reason) {
      setCredentialError(reason instanceof Error ? reason.message : "The portal credentials could not be assigned.");
    } finally {
      setCredentialPending(false);
    }
  }

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const displayName = String(form.get("displayName") ?? "").trim();
    const username = String(form.get("username") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const callSign = String(form.get("callSign") ?? "").trim().toUpperCase();
    const rank = String(form.get("rank") ?? "Deputy");
    const division = String(form.get("division") ?? "Patrol Division");
    const isTestAccount = form.get("isTestAccount") === "on";
    const personnelId = getNextPersonnelId(personnel, isTestAccount);

    setError("");
    setNotice("");

    if (displayName.length < 2) return setError("Enter the member's department display name.");
    if (!personnelId) return setError("No personnel IDs remain available in this numbering series.");
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) return setError("Username must contain 3–32 lowercase letters, numbers, dots, underscores, or hyphens.");
    if (!isStrongPassword(password)) return setError(PASSWORD_REQUIREMENT);
    if (isTestAccount ? !TEST_CALL_SIGN.test(callSign) : !STANDARD_CALL_SIGN.test(callSign)) {
      return setError(isTestAccount ? "Test call sign must use TA-#, such as TA-1." : "Call sign must use S-4##, such as S-417.");
    }
    if (!executive && (rank === "Sheriff" || rank === "Undersheriff")) return setError("Only Sheriff or Undersheriff may create an Executive account.");
    if (personnel.some((member) => member.username === username)) return setError(`@${username} is already assigned.`);
    if (activeAccounts.some((member) => member.callSign === callSign)) return setError(`${callSign} is currently assigned.`);

    setPending(true);
    try {
      await invokePersonnelAdmin({
        operation: "create_personnel",
        display_name: displayName,
        personnel_id: personnelId,
        username,
        password,
        call_sign: callSign,
        rank,
        division,
        is_test_account: isTestAccount,
      });
      formElement.reset();
      setTestAccount(false);
      setNotice(`${personnelId} · ${callSign} · ${displayName} was created.`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The personnel account could not be created.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="portal-account-admin">
      {canAssignCredentials ? (
        <section className="portal-panel" style={{ gridColumn: "1 / -1" }}>
          <div className="portal-panel-heading">
            <div><p>Existing personnel record</p><h2>Finish portal access</h2></div>
            <span>{uncredentialedAccounts.length} waiting</span>
          </div>
          <p className="portal-account-admin__intro">Use this for personnel created through Applications, Rehire, or another workflow that already created the personnel record. This adds the username and temporary password without creating a duplicate member.</p>

          {uncredentialedAccounts.length ? (
            <form onSubmit={assignCredentials}>
              <div className="portal-form-grid">
                <label>
                  Personnel member
                  <select value={credentialProfileId} onChange={(event) => selectCredentialProfile(event.target.value)} required>
                    <option value="">Select personnel</option>
                    {uncredentialedAccounts.map((member) => (
                      <option key={member.profileId} value={member.profileId}>{member.personnelId} · {member.displayName} · {member.rank}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Username
                  <input
                    value={credentialUsername}
                    onChange={(event) => setCredentialUsername(event.target.value.toLowerCase())}
                    required
                    autoComplete="off"
                    placeholder="first.last"
                  />
                </label>
                <label>
                  Temporary password
                  <input name="credentialPassword" required autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} placeholder="Minimum 8 characters" type="password" />
                </label>
                <label>
                  Personnel record
                  <input aria-readonly="true" readOnly tabIndex={-1} value={selectedCredentialAccount ? `${selectedCredentialAccount.personnelId} · ${selectedCredentialAccount.rank}` : "Select personnel"} />
                </label>
              </div>

              <div className="portal-form-protection" style={{ marginTop: 14 }}>
                <strong>Password change required on first sign-in</strong>
                <span>The personnel record, rank, and permanent ID stay exactly as they are. Only portal login credentials are added.</span>
              </div>

              {credentialError ? <div className="portal-form-error" role="alert">{credentialError}</div> : null}
              {credentialNotice ? <div className="portal-form-success" role="status"><strong>Portal access created</strong><span>{credentialNotice}</span></div> : null}

              <div className="command-v2-action-row portal-account-create__actions">
                <button className="portal-button portal-button--primary" disabled={credentialPending || !selectedCredentialAccount} type="submit">{credentialPending ? "Creating login…" : "Create username & temporary password"}</button>
              </div>
            </form>
          ) : (
            <div className="portal-empty-state"><strong>All active personnel currently have portal login credentials.</strong></div>
          )}
        </section>
      ) : null}

      <section className="portal-panel portal-account-create">
        <div className="portal-panel-heading">
          <div><p>Personnel accounts</p><h2>Create account</h2></div>
          <span>{credentialedAccounts.length} with login access</span>
        </div>
        <p className="portal-account-admin__intro">Create the personnel record and initial portal credentials together. Permanent IDs are assigned automatically.</p>

        <form onSubmit={createAccount}>
          <div className="portal-form-grid">
            <label>Display name<input name="displayName" required placeholder="Department display name" /></label>
            <label>
              Permanent personnel ID
              <input aria-readonly="true" readOnly tabIndex={-1} value={nextPersonnelId ?? "Unavailable"} />
              <small className="portal-field-help">Next available {testAccount ? "test-account" : "official"} personnel number.</small>
            </label>
            <label>Username<input name="username" required autoComplete="off" placeholder="first.last" /></label>
            <label>Temporary password<input name="password" required autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} placeholder="Minimum 8 characters" type="password" /></label>
            <label>Operational call sign<input defaultValue={testAccount ? "TA-" : "S-4"} key={testAccount ? "test" : "standard"} maxLength={6} name="callSign" pattern={testAccount ? "TA-[0-9]{1,3}" : "S-4[0-9]{2}"} required placeholder={testAccount ? "TA-1" : "S-4##"} /></label>
            <label>Rank<select defaultValue="Deputy" name="rank">{ranks.filter((rank) => executive || (rank !== "Sheriff" && rank !== "Undersheriff")).map((rank) => <option key={rank}>{rank}</option>)}</select></label>
            <label>Primary assignment<select defaultValue={divisionOptions.includes("Patrol Division") ? "Patrol Division" : divisionOptions[0]} name="division">{divisionOptions.map((division) => <option key={division}>{division}</option>)}</select></label>
          </div>

          <div className="portal-account-create__options">
            <label className="portal-checkbox-row portal-checkbox-row--test">
              <input checked={testAccount} name="isTestAccount" onChange={(event) => setTestAccount(event.target.checked)} type="checkbox" />
              <span><strong>Test account</strong><small>Uses TA numbering and stays out of official reporting.</small></span>
            </label>
            <div className="portal-form-protection">
              <strong>Password change required on first sign-in</strong>
              <span>The temporary password is only for initial access.</span>
            </div>
          </div>

          {error ? <div className="portal-form-error" role="alert">{error}</div> : null}
          {notice ? <div className="portal-form-success" role="status"><strong>Account created</strong><span>{notice}</span></div> : null}

          <div className="command-v2-action-row portal-account-create__actions">
            <button className="portal-button portal-button--primary" disabled={pending} type="submit">{pending ? "Creating…" : "Create personnel account"}</button>
          </div>
        </form>
      </section>

      <aside className="portal-panel portal-account-directory">
        <div className="portal-panel-heading"><div><p>Account status</p><h2>Department access</h2></div><span>{activeAccounts.length}</span></div>
        <p className="portal-account-admin__intro">A quick view of active personnel with portal credentials.</p>
        <div className="portal-account-list">
          {activeAccounts.slice(0, 10).map((member) => (
            <div key={member.profileId}>
              <span className="portal-account-list__avatar">{member.displayName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</span>
              <div><strong>{member.displayName}</strong><small>{member.callSign || member.personnelId} · {member.rank}</small></div>
              <b>{member.username ? `@${member.username}` : "Needs login"}</b>
            </div>
          ))}
        </div>
      </aside>

      {profile.rank === "Sheriff" ? <div className="portal-account-admin__sheriff"><SheriffAccountTestAccess accounts={personnel} /></div> : null}
    </div>
  );
}
