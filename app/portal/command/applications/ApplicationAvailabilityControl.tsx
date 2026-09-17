"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GlassBlobToggle } from "../../_components/GlassBlobToggle";
import type { ApplicationTrack } from "@/lib/recruitment/application";

type Props = {
  initialSwornOpen: boolean;
  initialAttorneyOpen: boolean;
  initialUpdatedAt: string | null;
  initialUpdatedBy: string | null;
};

export function ApplicationAvailabilityControl({
  initialSwornOpen,
  initialAttorneyOpen,
  initialUpdatedAt,
  initialUpdatedBy,
}: Props) {
  const router = useRouter();
  const [swornOpen, setSwornOpen] = useState(initialSwornOpen);
  const [attorneyOpen, setAttorneyOpen] = useState(initialAttorneyOpen);
  const [savedSwornOpen, setSavedSwornOpen] = useState(initialSwornOpen);
  const [savedAttorneyOpen, setSavedAttorneyOpen] = useState(initialAttorneyOpen);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [updatedBy, setUpdatedBy] = useState(initialUpdatedBy);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function updateTrack(track: ApplicationTrack, isOpen: boolean) {
    const response = await fetch("/api/portal/application-status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track, isOpen }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Application availability could not be updated.");
    return body;
  }

  async function save() {
    if (pending) return;
    const swornChanged = swornOpen !== savedSwornOpen;
    const attorneyChanged = attorneyOpen !== savedAttorneyOpen;
    if (!swornChanged && !attorneyChanged) return;

    setPending(true);
    setError("");
    setNotice("");
    try {
      let latest: any = null;
      if (swornChanged) latest = await updateTrack("Sworn Personnel", swornOpen);
      if (attorneyChanged) latest = await updateTrack("Department Attorney", attorneyOpen);
      setSavedSwornOpen(swornOpen);
      setSavedAttorneyOpen(attorneyOpen);
      if (latest) {
        setUpdatedAt(latest.updatedAt);
        setUpdatedBy(latest.updatedBy);
      }
      setNotice("Public application availability has been updated for both career tracks.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Application availability could not be updated.");
      setSwornOpen(savedSwornOpen);
      setAttorneyOpen(savedAttorneyOpen);
    } finally {
      setPending(false);
    }
  }

  const hasChanges = swornOpen !== savedSwornOpen || attorneyOpen !== savedAttorneyOpen;
  const openCount = Number(savedSwornOpen) + Number(savedAttorneyOpen);

  return (
    <section className={`portal-panel recruitment-availability recruitment-availability--${openCount ? "open" : "closed"}`}>
      <div className="portal-panel-heading">
        <div><p>Public recruitment control</p><h2>Application availability</h2></div>
        <b className={`recruitment-availability__badge recruitment-availability__badge--${openCount ? "open" : "closed"}`}>
          {openCount === 2 ? "2 tracks open" : openCount === 1 ? "1 track open" : "Applications closed"}
        </b>
      </div>

      <div className="recruitment-availability__layout">
        <div>
          <strong>Control each public application independently.</strong>
          <p>
            These settings control the career choices shown on <Link href="/join/application" target="_blank">/join/application</Link> and whether the submission system accepts each role.
          </p>
          <small>
            Last updated {updatedAt ? new Date(updatedAt).toLocaleString() : "when the system was created"}
            {updatedBy ? ` by ${updatedBy}` : ""}.
          </small>
        </div>

        <div className="recruitment-availability__controls">
          <div className="portal-glass-setting-row portal-glass-setting-row--compact">
            <div><strong>Sworn Personnel applications</strong><small>Deputy candidate application, interview, employment offer, and appointment workflow.</small></div>
            <GlassBlobToggle checked={swornOpen} disabled={pending} label="Accept Sworn Personnel applications" onChange={setSwornOpen} />
          </div>
          <div className="portal-glass-setting-row portal-glass-setting-row--compact">
            <div><strong>Department Attorney applications</strong><small>Legal-counsel application and Command selection workflow. This track is independent from sworn recruitment.</small></div>
            <GlassBlobToggle checked={attorneyOpen} disabled={pending} label="Accept Department Attorney applications" onChange={setAttorneyOpen} />
          </div>
          <button className="portal-button portal-button--primary" disabled={pending || !hasChanges} onClick={save} type="button">
            {pending ? "Updating…" : hasChanges ? "Save application availability" : "Status saved"}
          </button>
        </div>
      </div>

      {error ? <div className="portal-form-error" role="alert">{error}</div> : null}
      {notice ? <div className="portal-form-protection" role="status"><strong>Recruitment updated</strong><span>{notice}</span></div> : null}
    </section>
  );
}
