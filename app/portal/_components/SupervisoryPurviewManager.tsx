"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PortalDialog } from "./PortalDialog";

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

const rankLevel: Record<string, number> = {
  Sheriff: 130,
  Undersheriff: 120,
  Major: 110,
  Captain: 100,
  "1st Lieutenant": 90,
  Lieutenant: 80,
  Sergeant: 70,
  Corporal: 60,
  "Master Deputy": 50,
  "Deputy III": 40,
  "Deputy II": 30,
  Deputy: 20,
  Recruit: 10,
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

  const eligibleSupervisors = useMemo(() => {
    if (!selectedMember) return [];
    const subjectLevel = rankLevel[selectedMember.rank] ?? 0;
    return supervisors.filter((supervisor) =>
      supervisor.profileId !== selectedMember.profileId &&
      (rankLevel[supervisor.rank] ?? 0) > subjectLevel,
    );
  }, [selectedMember, supervisors]);

  if (!members.length || !supervisors.length) return null;

  function chooseMember(nextId: string) {
    const next = members.find((member) => member.profileId === nextId);
    setMemberId(nextId);
    setSupervisorId(next?.currentSupervisorId ?? "");
    setReason("");
    setError("");
    setNotice("");
  }

  function close() {
    if (busy) return;
    setOpen(false);
    setError("");
    setNotice("");
    setReason("");
  }

  async function save(action: "assign" | "remove") {
    if (!selectedMember || busy) return;
    setError("");
    setNotice("");

    if (action === "assign" && !supervisorId) {
      setError("Select the supervisor who will hold direct purview over this member.");
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
        ? `${selectedMember.displayName} now has direct individual purview assigned to ${supervisor?.rank ?? "the selected supervisor"} ${supervisor?.displayName ?? ""}.`
        : `${selectedMember.displayName} no longer has an individual purview exception assigned.`);
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
          <span>Exception authority</span>
          <strong>Assign direct individual purview when division-based supervision is not enough.</strong>
          <p>Normal supervisor scope follows the supervisor&apos;s active Primary division assignment. Use this tool only for a specific individual exception, special detail, temporary arrangement, probation oversight, or other documented need.</p>
        </div>
        <div className="portal-control-actions">
          <button className="portal-button portal-button--primary" onClick={() => setOpen(true)} type="button">Individual Purview Exception</button>
        </div>
      </section>

      <PortalDialog
        open={open && Boolean(selectedMember)}
        onClose={close}
        eyebrow="Exception authority"
        title="Individual Purview Exception"
        description="Create a direct person-to-person supervisory relationship outside the normal division-driven scope. Division assignments remain the default source of supervisory purview."
        dismissOnBackdrop={!busy}
        footer={
          <>
            {selectedMember?.currentSupervisorId ? (
              <button className="portal-button portal-button--danger" disabled={busy || reason.trim().length < 4} onClick={() => void save("remove")} type="button">
                {busy ? "Updating…" : "Remove individual exception"}
              </button>
            ) : null}
            <button className="portal-button portal-button--secondary" disabled={busy} onClick={close} type="button">Close</button>
            <button className="portal-button portal-button--primary" disabled={busy || !supervisorId || !eligibleSupervisors.some((item) => item.profileId === supervisorId)} form="supervisory-purview-form" type="submit">
              {busy ? "Updating…" : "Assign individual purview"}
            </button>
          </>
        }
      >
        {selectedMember ? (
          <form id="supervisory-purview-form" onSubmit={submit}>
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
              <strong style={{ display: "block", marginBottom: 4 }}>Current individual supervisor exception</strong>
              {selectedMember.currentSupervisorLabel || "No individual exception assigned"}
            </div>

            <label className="portal-call-sign-field">
              Direct supervisor
              <select value={supervisorId} onChange={(event) => setSupervisorId(event.target.value)} required>
                <option value="">Select supervisor</option>
                {eligibleSupervisors.map((supervisor) => (
                  <option key={supervisor.profileId} value={supervisor.profileId}>
                    {supervisor.rank} {supervisor.displayName} · {supervisor.callSign || supervisor.personnelId}
                  </option>
                ))}
              </select>
            </label>

            {!eligibleSupervisors.length ? (
              <div className="portal-form-error" role="status">No active supervisor currently outranks this member.</div>
            ) : null}

            <label className="portal-call-sign-field">
              Exception reason
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Probation oversight, special detail, temporary command arrangement, conflict reassignment, etc."
                rows={3}
                required
              />
            </label>

            <p className="portal-call-sign-note">Division assignment remains the normal supervisory chain. This creates one direct individual relationship and retains previous relationships in the audit history when reassigned or removed.</p>

            {error ? <div className="portal-form-error" role="alert">{error}</div> : null}
            {notice ? <div className="portal-form-success" role="status"><strong>Purview updated</strong><span>{notice}</span></div> : null}
          </form>
        ) : null}
      </PortalDialog>
    </>
  );
}
