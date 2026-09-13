"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GlassBlobToggle } from "../../_components/GlassBlobToggle";

type Props = {
  initialIsOpen: boolean;
  initialUpdatedAt: string | null;
  initialUpdatedBy: string | null;
};

export function ApplicationAvailabilityControl({
  initialIsOpen,
  initialUpdatedAt,
  initialUpdatedBy,
}: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(initialIsOpen);
  const [savedIsOpen, setSavedIsOpen] = useState(initialIsOpen);
  const [updatedAt, setUpdatedAt] = useState(initialUpdatedAt);
  const [updatedBy, setUpdatedBy] = useState(initialUpdatedBy);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function save() {
    if (pending || isOpen === savedIsOpen) return;
    setPending(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/portal/application-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOpen }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Application availability could not be updated.");

      setSavedIsOpen(body.isOpen);
      setIsOpen(body.isOpen);
      setUpdatedAt(body.updatedAt);
      setUpdatedBy(body.updatedBy);
      setNotice(body.isOpen ? "Applications are now open to the public." : "Applications are now closed to the public.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Application availability could not be updated.");
      setIsOpen(savedIsOpen);
    } finally {
      setPending(false);
    }
  }

  const hasChanges = isOpen !== savedIsOpen;

  return (
    <section className={`portal-panel recruitment-availability recruitment-availability--${savedIsOpen ? "open" : "closed"}`}>
      <div className="portal-panel-heading">
        <div><p>Public recruitment control</p><h2>Application availability</h2></div>
        <b className={`recruitment-availability__badge recruitment-availability__badge--${savedIsOpen ? "open" : "closed"}`}>
          {savedIsOpen ? "Applications open" : "Applications closed"}
        </b>
      </div>

      <div className="recruitment-availability__layout">
        <div>
          <strong>{savedIsOpen ? "The public application is accepting submissions." : "The public application is unavailable."}</strong>
          <p>
            This setting controls the recruitment status shown on <Link href="/join" target="_blank">/join</Link>, access to the application form, and whether the submission endpoint accepts new applications.
          </p>
          <small>
            Last updated {updatedAt ? new Date(updatedAt).toLocaleString() : "when the system was created"}
            {updatedBy ? ` by ${updatedBy}` : ""}.
          </small>
        </div>

        <div className="recruitment-availability__controls">
          <div className="portal-glass-setting-row portal-glass-setting-row--compact">
            <div>
              <strong>Accept new applications</strong>
              <small>Turning this off immediately blocks the form and all new submissions after you save.</small>
            </div>
            <GlassBlobToggle
              checked={isOpen}
              disabled={pending}
              label="Accept new applications"
              onChange={setIsOpen}
            />
          </div>
          <button className="portal-button portal-button--primary" disabled={pending || !hasChanges} onClick={save} type="button">
            {pending ? "Updating…" : hasChanges ? (isOpen ? "Open applications" : "Close applications") : "Status saved"}
          </button>
        </div>
      </div>

      {error ? <div className="portal-form-error" role="alert">{error}</div> : null}
      {notice ? <div className="portal-form-protection" role="status"><strong>Recruitment updated</strong><span>{notice}</span></div> : null}
    </section>
  );
}
