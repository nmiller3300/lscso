"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type ActiveLeave = {
  id: string;
  leaveType: string;
  startsOn: string;
  expectedReturnOn: string;
} | null;

type Props = {
  profileId: string;
  personnelId: string;
  displayName: string;
  activeLeave: ActiveLeave;
};

const leaveTypes = ["Personal", "Medical", "Military", "Family", "Paternity", "Maternity", "Administrative", "Other"];
const OPEN_ENDED_RETURN = "9999-12-31";

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString();
}

function leaveWindow(activeLeave: NonNullable<ActiveLeave>) {
  return activeLeave.expectedReturnOn === OPEN_ENDED_RETURN
    ? `${formatDate(activeLeave.startsOn)} · open-ended until manually ended`
    : `${formatDate(activeLeave.startsOn)} through ${formatDate(activeLeave.expectedReturnOn)}`;
}

export function PersonnelLoaManager({ profileId, personnelId, displayName, activeLeave }: Props) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [leaveType, setLeaveType] = useState("Personal");
  const [startsOn, setStartsOn] = useState(today);
  const [expectedReturnOn, setExpectedReturnOn] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function recordLeave() {
    if (pending) return;
    setError("");
    setNotice("");
    if (!startsOn) {
      setError("Enter the LOA start date.");
      return;
    }
    if (expectedReturnOn && expectedReturnOn < startsOn) {
      setError("Expected return date must be on or after the LOA start date.");
      return;
    }

    setPending(true);
    const { error: rpcError } = await (createClient() as any).rpc("roster_record_personnel_leave", {
      p_profile_id: profileId,
      p_leave_type: leaveType,
      p_starts_on: startsOn,
      p_expected_return_on: expectedReturnOn || null,
      p_notes: notes.trim() || null,
    });
    setPending(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setNotice(expectedReturnOn
      ? `${displayName} now has an approved LOA record through ${formatDate(expectedReturnOn)}.`
      : `${displayName} now has an open-ended approved LOA and will remain LOA until you manually end it.`);
    setNotes("");
    setExpectedReturnOn("");
    router.refresh();
  }

  async function endLeave() {
    if (pending || !activeLeave) return;
    setPending(true);
    setError("");
    setNotice("");

    const { error: rpcError } = await (createClient() as any).rpc("roster_end_personnel_leave", {
      p_profile_id: profileId,
      p_notes: notes.trim() || null,
    });
    setPending(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setNotice(`${displayName}'s active or upcoming LOA was ended. Their roster status will refresh immediately.`);
    setNotes("");
    router.refresh();
  }

  return (
    <section className="portal-panel personnel-admin-control personnel-admin-control--identity">
      <div className="portal-panel-heading">
        <div><p>Personnel administration</p><h2>Leave of Absence</h2></div>
        <span>{personnelId}</span>
      </div>
      <p className="personnel-admin-control__intro">Record an approved LOA directly for this member. The expected return date is optional; leave it blank for an open-ended LOA that stays active until Command manually ends it.</p>

      {activeLeave ? (
        <div className="portal-form-success" role="status">
          <strong>Approved LOA on file</strong>
          <span>{activeLeave.leaveType} · {leaveWindow(activeLeave)}</span>
        </div>
      ) : null}

      <div className="personnel-admin-fields personnel-admin-fields--identity">
        <label><span>Leave type</span><select value={leaveType} onChange={(event) => setLeaveType(event.target.value)} disabled={pending}>{leaveTypes.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>Starts on</span><input type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} disabled={pending} /></label>
        <label><span>Expected return <small style={{ opacity: .65 }}>(optional)</small></span><input type="date" value={expectedReturnOn} min={startsOn || undefined} onChange={(event) => setExpectedReturnOn(event.target.value)} disabled={pending} /></label>
      </div>

      <label className="portal-call-sign-field">
        Administrative notes <span style={{ opacity: .65 }}>(optional)</span>
        <textarea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Reason or command note for this LOA record" disabled={pending} />
      </label>

      <div className="personnel-admin-actions">
        <span>{activeLeave ? "Current / upcoming approved LOA detected" : expectedReturnOn ? "LOA will use the selected expected return date" : "No return date set · LOA will stay active until ended"}</span>
        <div className="portal-control-actions">
          {activeLeave ? <button className="portal-button portal-button--danger" disabled={pending} onClick={() => void endLeave()} type="button">{pending ? "Saving…" : "End / Cancel LOA"}</button> : null}
          <button className="portal-button portal-button--primary" disabled={pending || !startsOn} onClick={() => void recordLeave()} type="button">{pending ? "Saving…" : "Record LOA"}</button>
        </div>
      </div>

      {error ? <div className="portal-form-error" role="alert">{error}</div> : null}
      {notice ? <div className="portal-form-success" role="status"><strong>LOA updated</strong><span>{notice}</span></div> : null}
    </section>
  );
}
