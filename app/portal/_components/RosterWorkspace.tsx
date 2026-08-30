"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { isStrongPassword, PASSWORD_MIN_LENGTH, PASSWORD_REQUIREMENT } from "@/lib/auth/password-policy";
import { invokePersonnelAdmin } from "@/lib/supabase/personnel-admin";
import { usePortalProfile } from "./PortalProfileProvider";
import type { AccessTier, PersonnelRecord, PersonnelStatus } from "../_data/model";

type RosterWorkspaceProps = {
  personnel: PersonnelRecord[];
};

type ConfirmAction = "suspend" | "reinstate" | "deactivate";

const CALL_SIGN_PATTERN = /^S-4\d{2}$/;

const accessOptions: Array<AccessTier | "All"> = [
  "All",
  "Executive",
  "Command",
  "Supervisor",
  "Preliminary",
  "Deputy",
];

const rankAccess: Record<string, AccessTier> = {
  Sheriff: "Executive",
  Undersheriff: "Executive",
  Major: "Command",
  Captain: "Command",
  "1st Lieutenant": "Command",
  Lieutenant: "Supervisor",
  Sergeant: "Supervisor",
  Corporal: "Preliminary",
  "Master Deputy": "Deputy",
  "Deputy III": "Deputy",
  "Deputy II": "Deputy",
  Deputy: "Deputy",
  Recruit: "Deputy",
};

function normalizeCallSign(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().toUpperCase();
}

function getNextPersonnelId(personnel: PersonnelRecord[], isTestAccount: boolean) {
  const prefix = isTestAccount ? "TA" : "LS";
  const pattern = isTestAccount ? /^TA-(\d{3})$/ : /^LS-(\d{3})$/;
  const highest = personnel.reduce((current, member) => {
    const match = member.id.match(pattern);
    if (!match) return current;
    return Math.max(current, Number(match[1]));
  }, 0);
  const next = highest + 1;
  return next <= 999 ? `${prefix}-${String(next).padStart(3, "0")}` : null;
}

function appendHistory(member: PersonnelRecord, releasedCallSign: string) {
  if (!releasedCallSign) return member.callSignHistory ?? [];
  return Array.from(new Set([...(member.callSignHistory ?? []), releasedCallSign]));
}

export function RosterWorkspace({ personnel: initialPersonnel }: RosterWorkspaceProps) {
  const router = useRouter();
  const currentProfile = usePortalProfile();
  const [personnel, setPersonnel] = useState(initialPersonnel);
  const [query, setQuery] = useState("");
  const [access, setAccess] = useState<AccessTier | "All">("All");
  const [selectedId, setSelectedId] = useState(initialPersonnel[0]?.id ?? "");
  const [showCreate, setShowCreate] = useState(false);
  const [showCallSignEditor, setShowCallSignEditor] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [credentialEditor, setCredentialEditor] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [commandReason, setCommandReason] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  useEffect(() => {
    setPersonnel(initialPersonnel);
    setSelectedId((current) => initialPersonnel.some((member) => member.id === current) ? current : initialPersonnel[0]?.id ?? "");
  }, [initialPersonnel]);

  async function runPersonnelAction(body: Record<string, unknown>) {
    return invokePersonnelAdmin(body);
  }

  const filteredPersonnel = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return personnel.filter((member) => {
      const matchesQuery =
        !normalizedQuery ||
        [member.displayName, member.username, member.callSign, member.rank, member.id, member.division, member.isTestAccount ? "test account" : "department personnel"]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesAccess = access === "All" || member.access === access;

      return matchesQuery && matchesAccess;
    });
  }, [access, personnel, query]);

  const selected = personnel.find((member) => member.id === selectedId) ?? personnel[0];
  const isExecutiveCaller = currentProfile.access_tier === "Executive";
  const selectedRequiresExecutive = selected?.access === "Executive";
  const canManageSelected = !selectedRequiresExecutive || isExecutiveCaller;
  const isSelectedSelf = selected?.profileId === currentProfile.id;
  const canDeactivateSelected = isExecutiveCaller && !isSelectedSelf;

  function callSignIsReserved(callSign: string, exceptId?: string) {
    return personnel.some(
      (member) => member.id !== exceptId && member.status !== "Deactivated" && member.callSign === callSign,
    );
  }

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3600);
  }

  function selectMember(id: string) {
    setSelectedId(id);
    if (window.matchMedia("(max-width: 620px)").matches) {
      window.requestAnimationFrame(() => {
        document.getElementById("portal-member-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  function closeCreate() {
    setShowCreate(false);
    setFormError("");
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const displayName = String(form.get("displayName") ?? "").trim();
    const username = String(form.get("username") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const callSign = normalizeCallSign(form.get("callSign"));
    const rank = String(form.get("rank") ?? "Deputy");
    const division = String(form.get("division") ?? "Patrol Division");
    const isTestAccount = form.get("isTestAccount") === "on";
    const id = getNextPersonnelId(personnel, isTestAccount);

    if (!id) {
      setFormError("No personnel IDs remain available in this numbering series.");
      return;
    }

    if (rankAccess[rank] === "Executive" && !isExecutiveCaller) {
      setFormError("Only Sheriff or Undersheriff may create an Executive account.");
      return;
    }

    if (!CALL_SIGN_PATTERN.test(callSign)) {
      setFormError("Call sign must use the S-4## format, such as S-417.");
      return;
    }
    if (callSignIsReserved(callSign)) {
      setFormError(`${callSign} is currently assigned. Only released call signs may be recycled.`);
      return;
    }
    if (personnel.some((member) => member.username === username)) {
      setFormError(`@${username} is already assigned and cannot be reused.`);
      return;
    }
    if (!isStrongPassword(password)) {
      setFormError(PASSWORD_REQUIREMENT);
      return;
    }

    let result: Record<string, unknown>;
    setPendingAction("create");
    try {
      result = await runPersonnelAction({
        operation: "create_personnel",
        display_name: displayName,
        personnel_id: id,
        username,
        password,
        call_sign: callSign,
        rank,
        division,
        is_test_account: isTestAccount,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The account could not be created.");
      return;
    } finally {
      setPendingAction(null);
    }

    const newMember: PersonnelRecord = {
      profileId: String(result.profile_id ?? ""),
      id,
      displayName,
      username,
      callSign,
      callSignHistory: [],
      rank,
      access: rankAccess[rank] ?? "Deputy",
      division,
      supervisor: rank === "Sheriff" ? "County Electorate" : "Pending command assignment",
      status: "Active",
      certifications: 0,
      guardianOpen: 0,
      lastSession: "Never · New account",
      isTestAccount,
      credentialsAssigned: true,
    };

    setPersonnel((current) => [...current, newMember]);
    setSelectedId(id);
    closeCreate();
    showNotice(`${id} created. ${callSign} assigned to ${displayName}.`);
    router.refresh();
  }

  async function handleCallSignAssignment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const form = new FormData(event.currentTarget);
    const nextCallSign = normalizeCallSign(form.get("callSign"));

    if (!CALL_SIGN_PATTERN.test(nextCallSign)) {
      setFormError("Call sign must use the S-4## format, such as S-417.");
      return;
    }
    if (callSignIsReserved(nextCallSign, selected.id)) {
      setFormError(`${nextCallSign} is currently assigned to another active account.`);
      return;
    }

    if (!selected.profileId) {
      setFormError("This personnel record is not linked to the department system.");
      return;
    }

    if (!canManageSelected || selected.status === "Deactivated") {
      setFormError(selected.status === "Deactivated"
        ? "Deactivated personnel records are retained for audit and cannot be reactivated."
        : "Executive personnel changes require Sheriff or Undersheriff authority.");
      return;
    }

    const assignmentReason = String(form.get("assignmentReason") ?? "").trim();
    if (assignmentReason.length < 4) {
      setFormError("Enter a short command reason for the call-sign assignment.");
      return;
    }

    setPendingAction("call-sign");
    try {
      await runPersonnelAction({
        operation: "assign_call_sign",
        profile_id: selected.profileId,
        call_sign: nextCallSign,
        reason: assignmentReason,
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The call sign could not be assigned.");
      return;
    } finally {
      setPendingAction(null);
    }

    const releasedCallSign = selected.callSign;
    setPersonnel((current) => current.map((member) => member.id === selected.id ? {
      ...member,
      callSign: nextCallSign,
      callSignHistory: releasedCallSign === nextCallSign ? member.callSignHistory : appendHistory(member, releasedCallSign),
    } : member));
    setShowCallSignEditor(false);
    setFormError("");
    showNotice(
      releasedCallSign && releasedCallSign !== nextCallSign
        ? `${nextCallSign} assigned. ${releasedCallSign} returned to the available call-sign pool.`
        : `${nextCallSign} assigned to ${selected.displayName}.`,
    );
    router.refresh();
  }

  async function applyConfirmedAction() {
    if (!selected || !confirmAction || !selected.profileId) return;
    const reason = commandReason.trim();
    if (reason.length < 4) {
      setFormError("Enter a short command reason before confirming this action.");
      return;
    }
    if (!canManageSelected || (confirmAction === "deactivate" && !canDeactivateSelected)) {
      setConfirmAction(null);
      setFormError(confirmAction === "deactivate"
        ? "Only Sheriff or Undersheriff may deactivate another account."
        : "Executive personnel changes require Sheriff or Undersheriff authority.");
      return;
    }
    let nextStatus: PersonnelStatus = selected.status;
    let message = "";

    setPendingAction(confirmAction);
    try {
      await runPersonnelAction(
        confirmAction === "deactivate"
          ? { operation: "deactivate", profile_id: selected.profileId, reason }
          : {
              operation: "set_status",
              profile_id: selected.profileId,
              status: confirmAction === "suspend" ? "Suspended" : "Active",
              reason,
            },
      );
    } catch (error) {
      setConfirmAction(null);
      setFormError(error instanceof Error ? error.message : "The account action failed.");
      return;
    } finally {
      setPendingAction(null);
    }

    if (confirmAction === "suspend") {
      nextStatus = "Suspended";
      message = `${selected.displayName} was suspended. ${selected.callSign} remains reserved.`;
    } else if (confirmAction === "reinstate") {
      nextStatus = "Active";
      message = `${selected.displayName} was returned to active status with ${selected.callSign}.`;
    } else {
      nextStatus = "Deactivated";
      message = `${selected.displayName} was deactivated. ${selected.callSign} is now available for reassignment.`;
    }

    setPersonnel((current) => current.map((member) => member.id === selected.id ? {
      ...member,
      status: nextStatus,
      callSignHistory: confirmAction === "deactivate" ? appendHistory(member, member.callSign) : member.callSignHistory,
      callSign: confirmAction === "deactivate" ? "" : member.callSign,
    } : member));
    setConfirmAction(null);
    setCommandReason("");
    setFormError("");
    showNotice(message);
    router.refresh();
  }

  function resetCredentials() {
    if (!selected || !canManageSelected || selected.status === "Deactivated") return;
    setFormError("");
    setCredentialEditor(true);
  }

  async function handleCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected?.profileId) return;

    const form = new FormData(event.currentTarget);
    const username = String(form.get("credentialUsername") ?? selected.username ?? "").trim().toLowerCase();
    const password = String(form.get("credentialPassword") ?? "");

    if (!selected.credentialsAssigned && !/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) {
      setFormError("Assign a username containing 3–32 lowercase letters, numbers, dots, underscores, or hyphens.");
      return;
    }
    if (!isStrongPassword(password)) {
      setFormError(PASSWORD_REQUIREMENT);
      return;
    }

    setPendingAction("credentials");
    try {
      await runPersonnelAction(
        selected.credentialsAssigned
          ? { operation: "reset_password", profile_id: selected.profileId, password }
          : { operation: "assign_credentials", profile_id: selected.profileId, username, password },
      );
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Credentials could not be updated.");
      return;
    } finally {
      setPendingAction(null);
    }

    setPersonnel((current) => current.map((member) => member.id === selected.id ? {
      ...member,
      username: selected.credentialsAssigned ? member.username : username,
      credentialsAssigned: true,
    } : member));
    setCredentialEditor(false);
    setFormError("");
    showNotice(
      selected.credentialsAssigned
        ? `${selected.displayName} received a temporary password and must change it after sign-in.`
        : `Credentials assigned to ${selected.displayName}. The password will not be shown again.`,
    );
    router.refresh();
  }

  return (
    <>
      <section className="portal-control-banner">
        <div>
          <span>Executive protection</span>
          <strong>Account deactivation is restricted to Sheriff and Undersheriff.</strong>
          <p>Call signs are recycled operational assignments. Suspension reserves the call sign; deactivation releases it while preserving assignment history.</p>
        </div>
        <div className="portal-control-actions">
          <button className="portal-button portal-button--primary" onClick={() => { setFormError(""); setShowCreate(true); }} type="button">+ Create account</button>
        </div>
      </section>

      {formError && !showCreate && !showCallSignEditor && !confirmAction && !credentialEditor ? (
        <div className="portal-form-error portal-operation-error" role="alert">{formError}</div>
      ) : null}

      <div className="portal-roster-layout">
        <section className="portal-panel portal-roster-panel">
          <div className="portal-roster-toolbar">
            <label className="portal-search-field">
              <span>Search department</span>
              <input
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Name, username, call sign, badge ID, rank, or division"
                type="search"
                value={query}
              />
            </label>
            <label className="portal-filter-field">
              <span>Access tier</span>
              <select onChange={(event) => setAccess(event.target.value as AccessTier | "All")} value={access}>
                {accessOptions.map((option) => <option key={option}>{option}</option>)}
              </select>
            </label>
            <div className="portal-result-count">
              <strong>{filteredPersonnel.length}</strong>
              <span>{filteredPersonnel.filter((member) => member.isTestAccount).length} test · {filteredPersonnel.filter((member) => !member.isTestAccount).length} personnel</span>
            </div>
          </div>

          <div className="portal-table-scroll">
            <table className="portal-roster-table">
              <thead>
                <tr>
                  <th>Member / call sign</th><th>Rank / access</th><th>Assignment</th><th>Status</th><th>Open Guardians</th>
                  <th><span className="portal-sr-only">Open record</span></th>
                </tr>
              </thead>
              <tbody>
                {filteredPersonnel.map((member) => (
                  <tr className={member.id === selected?.id ? "is-selected" : undefined} key={member.id}>
                    <td data-label="Member">
                      <button className="portal-member-link" onClick={() => selectMember(member.id)} type="button">
                        <span>{member.callSign ? member.callSign.slice(-2) : "—"}</span>
                        <div>
                          <div className="portal-member-name-line">
                            <strong>{member.displayName}</strong>
                            {member.isTestAccount ? <b className="portal-test-badge">Test account</b> : null}
                          </div>
                          <small>{member.callSign || "Call sign released"} · {member.id} · {member.username ? `@${member.username}` : "Credentials not assigned"}</small>
                        </div>
                      </button>
                    </td>
                    <td data-label="Rank / access"><strong>{member.rank}</strong><span>{member.access}</span></td>
                    <td data-label="Assignment"><strong>{member.division}</strong><span>Reports to {member.supervisor}</span></td>
                    <td data-label="Status"><span className={`portal-status portal-status--${member.status.toLowerCase()}`}>{member.status}</span></td>
                    <td data-label="Open Guardians"><strong className={member.guardianOpen ? "portal-open-count" : undefined}>{member.guardianOpen}</strong></td>
                    <td data-label="Open record"><button className="portal-row-arrow" onClick={() => selectMember(member.id)} type="button" aria-label={`Open ${member.displayName} record`}>→</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredPersonnel.length === 0 ? (
            <div className="portal-empty-state">
              <strong>No personnel match those filters.</strong>
              <button onClick={() => { setQuery(""); setAccess("All"); }} type="button">Clear filters</button>
            </div>
          ) : null}
        </section>

        {selected ? (
          <aside className="portal-member-card" id="portal-member-detail">
            <div className="portal-member-card-head">
              <span>{selected.callSign ? selected.callSign.slice(-2) : "—"}</span>
              <div>
                <small>{selected.callSign || "Call sign released"} · {selected.id}</small>
                <h2>{selected.displayName}</h2>
                {selected.isTestAccount ? <b className="portal-test-badge">Test account</b> : null}
                <p>{selected.rank} · {selected.division}</p>
              </div>
            </div>
            <div className="portal-member-facts">
              <div><span>Call sign</span><strong>{selected.callSign || "Available for recycling"}</strong></div>
              <div><span>Username</span><strong>{selected.username ? `@${selected.username}` : "Not assigned by Sheriff"}</strong></div>
              <div><span>Credentials</span><strong>{selected.credentialsAssigned ? "Assigned" : "Not assigned"}</strong></div>
              <div><span>Access</span><strong>{selected.access}</strong></div>
              <div><span>Supervisor</span><strong>{selected.supervisor}</strong></div>
              <div><span>Last session</span><strong>{selected.lastSession}</strong></div>
              <div><span>Call-sign history</span><strong>{selected.callSignHistory?.length ? selected.callSignHistory.join(" · ") : "No prior assignments"}</strong></div>
              <div><span>Certifications</span><strong>{selected.certifications} active</strong></div>
              <div><span>Guardian follow-ups</span><strong>{selected.guardianOpen} open</strong></div>
              <div><span>Account type</span><strong>{selected.isTestAccount ? "Testing · Excluded from official reports" : "Department personnel"}</strong></div>
            </div>
            <div className="portal-member-actions">
              <button disabled={selected.status === "Deactivated" || !canManageSelected || pendingAction !== null} onClick={() => { setFormError(""); setShowCallSignEditor(true); }} type="button">
                Reassign call sign
              </button>
              <button disabled={selected.status === "Deactivated" || !canManageSelected || isSelectedSelf || pendingAction !== null} onClick={resetCredentials} type="button">
                {selected.credentialsAssigned ? "Reset password" : "Assign credentials"}
              </button>
              {selected.status === "Suspended" ? (
                <button disabled={!canManageSelected || isSelectedSelf || pendingAction !== null} onClick={() => { setCommandReason(""); setFormError(""); setConfirmAction("reinstate"); }} type="button">Reinstate access</button>
              ) : (
                <button disabled={selected.status === "Deactivated" || !canManageSelected || isSelectedSelf || pendingAction !== null} onClick={() => { setCommandReason(""); setFormError(""); setConfirmAction("suspend"); }} type="button">Suspend access</button>
              )}
              <button
                className="portal-danger-action"
                disabled={selected.status === "Deactivated" || !canDeactivateSelected || pendingAction !== null}
                onClick={() => { setCommandReason(""); setFormError(""); setConfirmAction("deactivate"); }}
                type="button"
              >
                Deactivate account
              </button>
            </div>
            {!canManageSelected ? (
              <div className="portal-member-protection portal-member-protection--restricted">
                <strong>Executive profile protected</strong>
                <span>Only Sheriff or Undersheriff may change credentials, call signs, or access for an Executive account.</span>
              </div>
            ) : null}
            {isSelectedSelf ? (
              <div className="portal-member-protection">
                <strong>Current signed-in account</strong>
                <span>Use My account to change your own password. Self-suspension and self-deactivation are blocked to prevent an accidental lockout.</span>
              </div>
            ) : null}
            <div className="portal-member-protection">
              <strong>Recyclable call-sign model</strong>
              <span>The permanent personnel ID and audit history remain. Only the operational call sign returns to the pool after deactivation.</span>
            </div>
          </aside>
        ) : null}
      </div>

      {showCreate ? (
        <div className="portal-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) closeCreate(); }}>
          <section className="portal-modal" role="dialog" aria-modal="true" aria-labelledby="create-account-title">
            <div className="portal-modal-heading">
              <div><span>Command credential assignment</span><h2 id="create-account-title">Create personnel account</h2></div>
              <button onClick={closeCreate} type="button" aria-label="Close account form">×</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="portal-form-grid">
                <label>Display name<input name="displayName" required placeholder="Department display name" /></label>
                <label>Assigned username<input name="username" required autoComplete="off" placeholder="first.last" /></label>
                <label>Temporary password<input name="password" required autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} placeholder="Minimum 8 characters" type="password" /></label>
                <label>
                  Operational call sign
                  <input defaultValue="S-4" maxLength={5} name="callSign" pattern="S-4[0-9]{2}" required placeholder="S-4##" />
                  <small className="portal-field-help">Type the final two digits. Released call signs may be recycled.</small>
                </label>
                <label>Rank<select defaultValue="Deputy" name="rank">{isExecutiveCaller ? <><option>Sheriff</option><option>Undersheriff</option></> : null}<option>Major</option><option>Captain</option><option>1st Lieutenant</option><option>Lieutenant</option><option>Sergeant</option><option>Corporal</option><option>Master Deputy</option><option>Deputy III</option><option>Deputy II</option><option>Deputy</option><option>Recruit</option></select></label>
                <label>Primary division<select defaultValue="Patrol Division" name="division"><option>Office of the Sheriff</option><option>Field Operations</option><option>Patrol Division</option><option>Training & FTO</option><option>Internal Affairs</option><option>Academy</option></select></label>
              </div>
              <div className="portal-form-protection"><strong>Personnel ID is automatic.</strong><span>The system assigns the next available LS-### number when the account is created. Permanent personnel IDs are never manually tracked or recycled.</span></div>
              <div className="portal-form-protection"><strong>First sign-in protection is required.</strong><span>Every new or reset credential must be changed by the member after secure sign-in.</span></div>
              <label className="portal-checkbox-row portal-checkbox-row--test"><input name="isTestAccount" type="checkbox" /><span><strong>Mark as a test account</strong><small>Clearly labels the profile and excludes its activity from official personnel reporting.</small></span></label>
              {formError ? <div className="portal-form-error" role="alert">{formError}</div> : null}
              <div className="portal-form-protection"><strong>Call signs are not permanent identifiers.</strong><span>The permanent LS personnel ID remains with the member. Deactivation releases the call sign for future assignment while retaining the history.</span></div>
              <div className="portal-modal-actions"><button className="portal-button portal-button--secondary" disabled={pendingAction === "create"} onClick={closeCreate} type="button">Cancel</button><button className="portal-button portal-button--primary" disabled={pendingAction === "create"} type="submit">{pendingAction === "create" ? "Creating…" : "Create credential"}</button></div>
            </form>
          </section>
        </div>
      ) : null}

      {showCallSignEditor && selected ? (
        <div className="portal-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setShowCallSignEditor(false); }}>
          <section className="portal-modal portal-modal--compact" role="dialog" aria-modal="true" aria-labelledby="call-sign-title">
            <div className="portal-modal-heading">
              <div><span>Operational assignment</span><h2 id="call-sign-title">Reassign call sign</h2></div>
              <button onClick={() => setShowCallSignEditor(false)} type="button" aria-label="Close call sign form">×</button>
            </div>
            <form onSubmit={handleCallSignAssignment}>
              <div className="portal-call-sign-summary"><span>Personnel member</span><strong>{selected.displayName}</strong><small>{selected.id} · {selected.rank}</small></div>
              <label className="portal-call-sign-field">New call sign<input autoFocus defaultValue={selected.callSign || "S-4"} maxLength={5} name="callSign" pattern="S-4[0-9]{2}" required /></label>
              <label className="portal-call-sign-field">Assignment reason<textarea name="assignmentReason" placeholder="Brief operational reason for the audit history..." required rows={3} /></label>
              <p className="portal-call-sign-note">Suspension does not release a call sign. Reassignment or deactivation does. Every assignment retains its effective history.</p>
              {formError ? <div className="portal-form-error" role="alert">{formError}</div> : null}
              <div className="portal-modal-actions"><button className="portal-button portal-button--secondary" disabled={pendingAction === "call-sign"} onClick={() => setShowCallSignEditor(false)} type="button">Cancel</button><button className="portal-button portal-button--primary" disabled={pendingAction === "call-sign"} type="submit">{pendingAction === "call-sign" ? "Assigning…" : "Assign call sign"}</button></div>
            </form>
          </section>
        </div>
      ) : null}

      {confirmAction && selected ? (
        <div className="portal-modal-backdrop" role="presentation">
          <section className="portal-modal portal-modal--confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-action-title">
            <div className="portal-confirm-icon">{confirmAction === "deactivate" ? "!" : "✓"}</div>
            <span>{confirmAction === "deactivate" ? "Executive confirmation" : "Command confirmation"}</span>
            <h2 id="confirm-action-title">{confirmAction === "deactivate" ? "Deactivate this account?" : confirmAction === "suspend" ? "Suspend this account?" : "Reinstate this account?"}</h2>
            <p>
              {confirmAction === "deactivate"
                ? `${selected.callSign} will be released for recycling. ${selected.id} and the assignment history will remain.`
                : confirmAction === "suspend"
                  ? `${selected.callSign} will remain reserved while access is suspended.`
                  : `${selected.callSign} will remain assigned as access returns to active status.`}
            </p>
            <label>Command reason<textarea autoFocus onChange={(event) => setCommandReason(event.target.value)} placeholder="Required audit reason" required rows={3} value={commandReason} /></label>
            {formError ? <div className="portal-form-error" role="alert">{formError}</div> : null}
            <div className="portal-modal-actions"><button className="portal-button portal-button--secondary" disabled={pendingAction !== null} onClick={() => { setConfirmAction(null); setCommandReason(""); setFormError(""); }} type="button">Cancel</button><button className={`portal-button ${confirmAction === "deactivate" ? "portal-button--danger" : "portal-button--primary"}`} disabled={pendingAction !== null || commandReason.trim().length < 4} onClick={applyConfirmedAction} type="button">{pendingAction ? "Applying…" : "Confirm action"}</button></div>
          </section>
        </div>
      ) : null}

      {credentialEditor && selected ? (
        <div className="portal-modal-backdrop" role="presentation">
          <section className="portal-modal portal-modal--compact" role="dialog" aria-modal="true" aria-labelledby="credential-reset-title">
            <div className="portal-modal-heading">
              <div><span>Private credential assignment</span><h2 id="credential-reset-title">{selected.credentialsAssigned ? "Reset password" : `Assign credentials to ${selected.displayName}`}</h2></div>
              <button onClick={() => setCredentialEditor(false)} type="button" aria-label="Close credential form">×</button>
            </div>
            <form onSubmit={handleCredentials}>
              <label>
                Assigned username
                <input autoComplete="off" defaultValue={selected.username ?? ""} disabled={selected.credentialsAssigned} name="credentialUsername" placeholder="first.last" required />
              </label>
              <label>
                Temporary password
                <input autoComplete="new-password" minLength={PASSWORD_MIN_LENGTH} name="credentialPassword" placeholder="Minimum 8 characters" required type="password" />
              </label>
              <small className="portal-field-help">{PASSWORD_REQUIREMENT} The password is sent directly to the secure authentication service and is not stored in the personnel profile.</small>
              {formError ? <div className="portal-form-error" role="alert">{formError}</div> : null}
              <div className="portal-modal-actions"><button className="portal-button portal-button--secondary" disabled={pendingAction === "credentials"} onClick={() => setCredentialEditor(false)} type="button">Cancel</button><button className="portal-button portal-button--primary" disabled={pendingAction === "credentials"} type="submit">{pendingAction === "credentials" ? "Saving…" : selected.credentialsAssigned ? "Set temporary password" : "Assign credentials"}</button></div>
            </form>
          </section>
        </div>
      ) : null}

      {notice ? <div className="portal-toast" role="status">{notice}</div> : null}
    </>
  );
}
