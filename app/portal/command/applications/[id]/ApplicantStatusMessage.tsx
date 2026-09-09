"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ApplicantStatusMessage({
  applicationId,
  initialMessage,
  updatedAt,
  updatedBy,
}: {
  applicationId: string;
  initialMessage?: string | null;
  updatedAt?: string | null;
  updatedBy?: string | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState(initialMessage ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function save(content: string) {
    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch(`/api/portal/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "applicant_message", content }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The applicant status message could not be saved.");
      setMessage(content);
      setSaved(true);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The applicant status message could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="portal-panel recruitment-applicant-message">
      <div className="portal-panel-heading">
        <div><p>Candidate-facing communication</p><h2>Applicant status message</h2></div>
        <span>Visible on private tracking page</span>
      </div>
      <p className="recruitment-applicant-message__notice">Use this only for information the applicant should see. Internal notes, interview notes, and the documented denial reason remain private unless Command intentionally writes a separate message here.</p>
      <label className="recruitment-wide-label">
        Message to applicant
        <textarea
          rows={4}
          maxLength={2000}
          value={message}
          onChange={(event) => { setMessage(event.target.value); setSaved(false); }}
          placeholder="Optional. Leave blank to use the automatic status message."
        />
        <small>{message.length.toLocaleString()} / 2,000 characters</small>
      </label>
      {updatedAt ? <p className="recruitment-applicant-message__meta">Last saved {new Date(updatedAt).toLocaleString()}{updatedBy ? ` by ${updatedBy}` : ""}.</p> : null}
      {error ? <p className="application-error" role="alert">{error}</p> : null}
      {saved ? <p className="recruitment-applicant-message__saved">Applicant-facing status message saved.</p> : null}
      <div className="recruitment-applicant-message__actions">
        <button className="portal-button portal-button--primary" type="button" disabled={busy || message === (initialMessage ?? "")} onClick={() => void save(message.trim())}>{busy ? "Saving…" : "Save applicant message"}</button>
        <button className="portal-button portal-button--secondary" type="button" disabled={busy || !message.trim()} onClick={() => void save("")}>Clear custom message</button>
      </div>
    </section>
  );
}
