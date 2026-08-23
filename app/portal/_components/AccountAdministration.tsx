"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { isStrongPassword, PASSWORD_MIN_LENGTH, PASSWORD_REQUIREMENT } from "@/lib/auth/password-policy";
import { invokePersonnelAdmin } from "@/lib/supabase/personnel-admin";
import { usePortalProfile } from "./PortalProfileProvider";

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

const CALL_SIGN_PATTERN = /^S-4\d{2}$/;
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

export function AccountAdministration({ personnel, divisionOptions }: AccountAdministrationProps) {
  const router = useRouter();
  const profile = usePortalProfile();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const executive = profile.rank === "Sheriff" || profile.rank === "Undersheriff";

  const activeAccounts = useMemo(() => personnel.filter((member) => member.status !== "Deactivated"), [personnel]);
  const credentialedAccounts = useMemo(() => activeAccounts.filter((member) => member.username), [activeAccounts]);

  async function createAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const displayName = String(form.get("displayName") ?? "").trim();
    const personnelId = String(form.get("personnelId") ?? "").trim().toUpperCase();
    const username = String(form.get("username") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const callSign = String(form.get("callSign") ?? "").trim().toUpperCase();
    const rank = String(form.get("rank") ?? "Deputy");
    const division = String(form.get("division") ?? "Patrol Division");
    const isTestAccount = form.get("isTestAccount") === "on";

    setError("");
    setNotice("");

    if (displayName.length < 2) return setError("Enter the member's department display name.");
    if (!/^LS-[0-9]{3}$/.test(personnelId)) return setError("Personnel ID must use the LS-000 format.");
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) return setError("Username must contain 3–32 lowercase letters, numbers, dots, underscores, or hyphens.");
    if (!isStrongPassword(password)) return setError(PASSWORD_REQUIREMENT);
    if (!CALL_SIGN_PATTERN.test(callSign)) return setError("Call sign must use the S-4## format, such as S-417.");
    if (!executive && (rank === "Sheriff" || rank === "Undersheriff")) return setError("Only Sheriff or Undersheriff may create an Executive account.");
    if (personnel.some((member) => member.personnelId === personnelId)) return setError(`${personnelId} is already assigned.`);
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
      setNotice(`${callSign} · ${displayName} was created and added to the department personnel system.`);
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The personnel account could not be created.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="command-v2-workspace-grid">
      <section className="portal-panel" style={{ gridColumn: "span 2" }}>
        <div className="portal-panel-heading">
          <div><p>Personnel accounts</p><h2>Create department account</h2></div>
          <span>{credentialedAccounts.length} credentialed</span>
        </div>
        <p className="command-v2-compact-copy">Create the personnel record and issued login together. Rank, call sign, and primary assignment are written into the shared personnel system during creation.</p>

        <form onSubmit={createAccount} style={{ marginTop: 18 }}>
          <div className="portal-form-grid">
            <label>Display name<input name="displayName" required placeholder="Department display name" /></label>
            <label>Permanent personnel ID<input name="personnelId" pattern="LS-[0-9]{3}" required placeholder="LS-000" /></label>
            <label>Username<input name="username" required autoComplete="off" placeholder="first.last" /></label>
            <label>Temporary password<input name="password" required autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} placeholder="Minimum 8 characters" type="password" /></label>
            <label>Operational call sign<input defaultValue="S-4" maxLength={5} name="callSign" pattern="S-4[0-9]{2}" required placeholder="S-4##" /></label>
            <label>Rank<select defaultValue="Deputy" name="rank">{ranks.filter((rank) => executive || (rank !== "Sheriff" && rank !== "Undersheriff")).map((rank) => <option key={rank}>{rank}</option>)}</select></label>
            <label>Primary assignment<select defaultValue={divisionOptions.includes("Patrol Division") ? "Patrol Division" : divisionOptions[0]} name="division">{divisionOptions.map((division) => <option key={division}>{division}</option>)}</select></label>
          </div>

          <div className="portal-form-protection" style={{ marginTop: 14 }}>
            <strong>First sign-in protection is required.</strong>
            <span>The temporary password must be changed by the member after secure sign-in.</span>
          </div>

          <label className="portal-checkbox-row portal-checkbox-row--test" style={{ marginTop: 14 }}>
            <input name="isTestAccount" type="checkbox" />
            <span><strong>Mark as a test account</strong><small>Test activity stays out of official personnel reporting.</small></span>
          </label>

          {error ? <div className="portal-form-error" role="alert" style={{ marginTop: 14 }}>{error}</div> : null}
          {notice ? <div className="portal-form-protection" role="status" style={{ marginTop: 14 }}><strong>Account created</strong><span>{notice}</span></div> : null}

          <div className="command-v2-action-row" style={{ marginTop: 4 }}>
            <button className="portal-button portal-button--primary" disabled={pending} type="submit">{pending ? "Creating…" : "Create personnel account"}</button>
          </div>
        </form>
      </section>

      <section className="portal-panel command-v2-launcher">
        <div className="portal-panel-heading"><div><p>Account state</p><h2>Department access</h2></div><span>{activeAccounts.length}</span></div>
        <p className="command-v2-compact-copy">Account creation lives here. Rank changes, assignments, training records, and personnel history remain in their own operational areas instead of being mixed into account setup.</p>
        <div className="command-v2-mini-list" style={{ marginTop: 14 }}>
          {activeAccounts.slice(0, 8).map((member) => (
            <div key={member.profileId} style={{ padding: "10px 0", borderBottom: "1px solid rgba(82,68,51,.1)" }}>
              <strong>{member.callSign || member.personnelId} · {member.displayName}</strong>
              <span>{member.rank} · {member.username ? `@${member.username}` : "Credentials not assigned"}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
