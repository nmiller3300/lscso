"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ApplicantMessage = {
  id: string;
  content: string;
  created_at: string;
  author_profile_id: string | null;
};

export function ApplicantStatusMessage({
  applicationId,
  messages,
  names,
}: {
  applicationId: string;
  messages: ApplicantMessage[];
  names: Record<string, string>;
}) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  async function send() {
    const content = message.trim();
    if (!content) return;

    setBusy(true);
    setError("");
    setSaved(false);
    try {
      const response = await fetch(`/api/portal/applications/${applicationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The applicant message could not be sent.");
      setMessage("");
      setSaved(true);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The applicant message could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="portal-panel recruitment-applicant-message">
      <div className="portal-panel-heading">
        <div><p>Candidate-facing communication</p><h2>Recruitment communications</h2></div>
        <span>Visible on private tracking page</span>
      </div>
      <p className="recruitment-applicant-message__notice">Messages sent here are visible to the applicant and remain in their private communication history. Internal notes, interview notes, and documented decision reasoning stay private.</p>

      <div className="recruitment-applicant-message__history">
        {messages.length ? messages.map((item) => (
          <article key={item.id} className="recruitment-applicant-message__history-item">
            <div>
              <strong>LSCSO Recruitment</strong>
              <span>{new Date(item.created_at).toLocaleString()}{item.author_profile_id && names[item.author_profile_id] ? ` · ${names[item.author_profile_id]}` : ""}</span>
            </div>
            <p>{item.content}</p>
          </article>
        )) : (
          <div className="portal-empty-state"><strong>No applicant-facing messages have been sent yet.</strong></div>
        )}
      </div>

      <label className="recruitment-wide-label">
        New message to applicant
        <textarea
          rows={4}
          maxLength={2000}
          value={message}
          onChange={(event) => { setMessage(event.target.value); setSaved(false); }}
          placeholder="Write a message the applicant should see on their private tracking page."
        />
        <small>{message.length.toLocaleString()} / 2,000 characters</small>
      </label>
      {error ? <p className="application-error" role="alert">{error}</p> : null}
      {saved ? <p className="recruitment-applicant-message__saved">Message sent to the applicant communication history.</p> : null}
      <div className="recruitment-applicant-message__actions">
        <button className="portal-button portal-button--primary" type="button" disabled={busy || !message.trim()} onClick={() => void send()}>{busy ? "Sending…" : "Send message to applicant"}</button>
        <button className="portal-button portal-button--secondary" type="button" disabled={busy || !message} onClick={() => setMessage("")}>Clear draft</button>
      </div>
    </section>
  );
}
