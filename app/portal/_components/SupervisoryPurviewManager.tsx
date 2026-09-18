"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type PurviewMember = {
  profileId: string;
  personnelId: string;
  displayName: string;
  rank: string;
  callSign: string;
  currentSupervisorId: string | null;
  currentSupervisorLabel: string | null;
};

type SupervisorOption = {
  profileId: string;
  personnelId: string;
  displayName: string;
  rank: string;
  callSign: string;
};

export function SupervisoryPurviewManager({
  members,
  supervisors,
}: {
  members: PurviewMember[];
  supervisors: SupervisorOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [memberId, setMemberId] = useState(members[0]?.profileId ?? "");
  const selectedMember = useMemo(
    () => members.find((member) => member.profileId === memberId) ?? members[0],
    [members, memberId],
  );
  const [supervisorId, setSupervisorId] = useState(selectedMember?.currentSupervisorId ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  if (!members.length || !supervisors.length) return null;

  function chooseMember(nextId: string) {
    const next = members.find((member) => member.profileId === nextId);
    setMemberId(nextId);
    setSupervisorId(next?.currentSupervisorId ?? "");
    setReason("");
    setError("");
    setNotice("");
  }

  async function save(action: "assign" | "remove") {
    if (!selectedMember || busy) return;
    setError("");
    setNotice("");

    if (action === "assign" && !supervisorId) {
      setError("Select the supervisor who will hold primary purview over this member.");
      return;
    }
    if (reason.trim().length < 4) {
      setError("Enter a short reason for the supervisory assignment change.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/portal/personnel/supervisory-purview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          subjectProfileId: selectedMember.profileId,
          supervisorProfileId: action === "assign" ? supervisorId : null,
          reason,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The supervisory assignment could not be updated.");

      const supervisor = supervisors.find((item) => item.profileId === supervisorId);
      setNotice(action === "assign"
        ? `${selectedMember.displayName} is now in ${supervisor?.rank ?? "the selected supervisor"} ${supervisor?.displayName ?? ""}'s primary purview.`
        : `${selectedMember.displayName} no longer has a primary supervisor assigned.`);
      setReason("");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The supervisory assignment could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save("assign");
  }

  return (
    <>
      <section className="portal-control-banner" style={{ marginBottom: 16 }}>
        <div>
          <span>Supervisor chain</span>
          <strong>Assign personnel to a supervisor&apos;s primary purview.</strong>
          <p>Primary purview controls who appears in a supervisor&apos;s My Personnel &amp; Supervision workspace and which personnel records they can access through their supervisory authority.</p>
        </div>
        <div className="portal-control-actions">
          <button className="portal-button portal-button--primary" onClick={() => setOpen(true)} type="button">Supervisor / Purview</button>
        </div>
      </section>

      {open && selectedMember ? (
        <div className="portal-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target && !busy) setOpen(false); }}>
          <section className="portal-modal" role="dialog" aria-modal="true" aria-labelledby="purview-manager-title">
            <div className="portal-modal-heading">
              <div><span>Personnel authority</span><h2 id="purview-manager-title">Supervisor / Purview</h2></div>
              <button disabled={busy} onClick={() => setOpen(false)} type="button" aria-label="Close supervisory purview manager">×</button>
            </div>

            <form onSubmit={submit}>
              <label className="portal-call-sign-field">
                Personnel member
                <select value={selectedMember.profileId} onChange={(event) => chooseMember(event.target.value)}>
                  {members.map((member) => (
                    <option key={member.profileId} value={member.profileId}>
                      {member.personnelId} · {member.rank} {member.displayName}{member.callSign ? ` · ${member.callSign}` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <div className="portal-call-sign-note" style={{ marginBottom: 14 }}>
                <strong style={{ display: "block", marginBottom: 4 }}>Current primary supervisor</strong>
                {selectedMember.currentSupervisorLabel || "No primary supervisor assigned"}
              </div>

              <label className="portal-call-sign-field">
                Primary supervisor
                <select value={supervisorId} onChange={(event) => setSupervisorId(event.target.value)} required>
                  <option value="">Select supervisor</option>
                  {supervisors
                    .filter((supervisor) => supervisor.profileId !== selectedMember.profileId)
                    .map((supervisor) => (
                      <option key={supervisor.profileId} value={supervisor.profileId}>
                        {supervisor.rank} {supervisor.displayName} · {supervisor.callSign || supervisor.personnelId}
                      </option>
                    ))}
                </select>
              </label>

              <label className="portal-call-sign-field">
                Assignment reason
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Patrol supervisory assignment, command reassignment, shift change, etc."
                  rows={3}
                  required
                />
              </label>

              <p className="portal-call-sign-note">A member can have one active primary supervisor at a time. Reassigning them automatically ends the previous primary relationship but keeps the prior record in the audit history.</p>

              {error ? <div className="portal-form-error" role="alert">{error}</div> : null}
              {notice ? <div className="portal-form-success" role="status"><strong>Purview updated</strong><span>{notice}</span></div> : null}

              <div className="portal-modal-actions">
                {selectedMember.currentSupervisorId ? (
                  <button className="portal-button portal-button--danger" disabled={busy || reason.trim().length < 4} onClick={() => void save("remove")} type="button">
                    {busy ? "Updating…" : "Remove primary supervisor"}
                  </button>
                ) : null}
                <button className="portal-button portal-button--secondary" disabled={busy} onClick={() => setOpen(false)} type="button">Close</button>
                <button className="portal-button portal-button--primary" disabled={busy || !supervisorId} type="submit">{busy ? "Updating…" : "Assign to purview"}</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
