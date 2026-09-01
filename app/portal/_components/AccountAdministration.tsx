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

export function AccountAdministration({ personnel, divisionOptions }: AccountAdministrationProps) {
  const router = useRouter();
  const profile = usePortalProfile();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [testAccount, setTestAccount] = useState(false);
  const executive = profile.rank === "Sheriff" || profile.rank === "Undersheriff";

  const activeAccounts = useMemo(() => personnel.filter((member) => member.status !== "Deactivated"), [personnel]);
  const credentialedAccounts = useMemo(() => activeAccounts.filter((member) => member.username), [activeAccounts]);
  const nextPersonnelId = useMemo(() => getNextPersonnelId(personnel, testAccount), [personnel, testAccount]);

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
    <div className="command-v2-workspace-grid account-admin-workspace">
      <section className="portal-panel account-admin-create">
        <div className="portal-panel-heading">
          <div><p>Personnel accounts</p><h2>Create account</h2></div>
          <span>{credentialedAccounts.length} with login access</span>
        </div>

        <form className="account-admin-form" onSubmit={createAccount}>
          <div className="portal-form-grid">
            <label>Display name<input name="displayName" required placeholder="Department display name" /></label>
            <label>
              Permanent personnel ID
              <input aria-readonly="true" readOnly tabIndex={-1} value={nextPersonnelId ?? "Unavailable"} />
              <small className="portal-field-help">Assigned automatically from the next available {testAccount ? "TA" : "LS"} number.</small>
            </label>
            <label>Username<input name="username" required autoComplete="off" placeholder="first.last" /></label>
            <label>Temporary password<input name="password" required autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} placeholder="Minimum 8 characters" type="password" /></label>
            <label>Operational call sign<input defaultValue={testAccount ? "TA-" : "S-4"} key={testAccount ? "test" : "standard"} maxLength={6} name="callSign" pattern={testAccount ? "TA-[0-9]{1,3}" : "S-4[0-9]{2}"} required placeholder={testAccount ? "TA-1" : "S-4##"} /></label>
            <label>Rank<select defaultValue="Deputy" name="rank">{ranks.filter((rank) => executive || (rank !== "Sheriff" && rank !== "Undersheriff")).map((rank) => <option key={rank}>{rank}</option>)}</select></label>
            <label>Primary assignment<select defaultValue={divisionOptions.includes("Patrol Division") ? "Patrol Division" : divisionOptions[0]} name="division">{divisionOptions.map((division) => <option key={division}>{division}</option>)}</select></label>
          </div>

          <label className="portal-checkbox-row portal-checkbox-row--test account-admin-test-toggle">
            <input checked={testAccount} name="isTestAccount" onChange={(event) => setTestAccount(event.target.checked)} type="checkbox" />
            <span><strong>Test account</strong><small>Uses TA personnel IDs and TA call signs and stays out of official reporting.</small></span>
          </label>

          <div className="portal-form-protection">
            <strong>Password change required on first sign-in</strong>
            <span>The temporary password is only for initial access.</span>
          </div>

          {error ? <div className="portal-form-error" role="alert">{error}</div> : null}
          {notice ? <div className="portal-form-success" role="status"><strong>Account created.</strong> {notice}</div> : null}

          <div className="command-v2-action-row account-admin-submit">
            <button className="portal-button portal-button--primary" disabled={pending} type="submit">{pending ? "Creating…" : "Create personnel account"}</button>
          </div>
        </form>
      </section>

      <section className="portal-panel command-v2-launcher account-admin-access-list">
        <div className="portal-panel-heading"><div><p>Account status</p><h2>Department access</h2></div><span>{activeAccounts.length}</span></div>
        <div className="command-v2-mini-list">
          {activeAccounts.slice(0, 8).map((member) => (
            <div key={member.profileId}>
              <strong>{member.callSign || member.personnelId} · {member.displayName}</strong>
              <span>{member.rank} · {member.username ? `@${member.username}` : "Credentials not assigned"}</span>
            </div>
          ))}
        </div>
      </section>

      {profile.rank === "Sheriff" ? <SheriffAccountTestAccess accounts={personnel} /> : null}
    </div>
  );
}
