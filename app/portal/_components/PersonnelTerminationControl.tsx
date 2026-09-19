"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { terminatePersonnel } from "@/lib/supabase/personnel-termination";

type Props = {
  profileId: string;
  personnelId: string;
  displayName: string;
  rank: string;
};

export function PersonnelTerminationControl({ profileId, personnelId, displayName, rank }: Props) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function terminate() {
    if (pending || !acknowledged || reason.trim().length < 4) return;
    setPending(true);
    setError("");
    try {
      await terminatePersonnel(profileId, reason.trim());
      router.push("/portal/command/personnel");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The termination could not be completed.");
      setPending(false);
    }
  }

  return (
    <section className="portal-panel personnel-admin-control">
      <div className="portal-panel-heading">
        <div><p>Executive Command</p><h2>Personnel termination</h2></div>
        <span>{personnelId}</span>
      </div>

      <p className="command-v2-compact-copy">
        Terminating {rank} {displayName} removes the member from the active roster, closes active assignments and delegated authority, releases the call sign, revokes applicable training/FTO authority and portal access, and preserves the personnel record in Separated Personnel.
      </p>

      <div className="personnel-admin-fields">
        <label style={{ gridColumn: "1 / -1" }}>
          <span>Termination reason</span>
          <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} maxLength={500} placeholder="Document the Executive Command reason for termination." />
        </label>
      </div>

      <label className="portal-checkbox-row" style={{ marginTop: 14 }}>
        <input checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} type="checkbox" />
        <span><strong>Confirm department termination</strong><small>This is a separation from active service, not a suspension or temporary status change.</small></span>
      </label>

      {error ? <div className="portal-form-error" role="alert">{error}</div> : null}

      <div className="personnel-admin-actions">
        <span>The retained record remains available for audit, history, and future return review.</span>
        <button className="portal-button portal-button--primary" disabled={pending || !acknowledged || reason.trim().length < 4} onClick={() => void terminate()} type="button">
          {pending ? "Terminating…" : "Terminate personnel"}
        </button>
      </div>
    </section>
  );
}
