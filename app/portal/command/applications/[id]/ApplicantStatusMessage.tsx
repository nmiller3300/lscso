"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ApplicantMessage = {
  id: string;
  content: string;
  created_at: string;
  author_profile_id: string | null;
};

const messageStarters = [
  {
    id: "received",
    label: "Application received",
    content: "Your application has been received by the Los Santos County Sheriff's Office and is awaiting Command review. No selection decision has been made at this time.",
  },
  {
    id: "interview",
    label: "Advance to interview",
    content: "Your written application has been accepted to continue in the LSCSO recruitment process. Recruitment staff will contact you to coordinate the required interview.",
  },
  {
    id: "reminder",
    label: "Interview reminder",
    content: "This is a reminder regarding your scheduled LSCSO recruitment interview. Please be available and ready before the scheduled time. If you believe you cannot attend, contact Recruitment as soon as possible.",
  },
  {
    id: "update",
    label: "General status update",
    content: "There has been an update to your LSCSO recruitment case. Please review your private applicant page for the current status and any required next action.",
  },
];

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
  const [copied, setCopied] = useState(false);

  function loadStarter(content: string) {
    setMessage(content);
    setSaved(false);
    setCopied(false);
    setError("");
  }

  async function copyForDiscord() {
    const content = message.trim();
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setError("The draft could not be copied. Select the text manually and copy it instead.");
    }
  }

  async function send() {
    const content = message.trim();
    if (!content) return;

    setBusy(true);
    setError("");
    setSaved(false);
    setCopied(false);
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
        <span>Permanent applicant record</span>
      </div>
      <p className="recruitment-applicant-message__notice">Messages sent here are visible on the applicant&apos;s private page and remain in the recruitment record. Internal notes, panel notes, and protected decision reasoning stay private.</p>

      <div className="recruitment-message-starters" aria-label="Message starters">
        <div className="recruitment-message-starters__heading">
          <div><span>Message starters</span><strong>Start with approved recruitment language</strong></div>
          <small>Always review and edit before sending.</small>
        </div>
        <div className="recruitment-message-starters__buttons">
          {messageStarters.map((starter) => (
            <button key={starter.id} className="recruitment-message-starter" type="button" disabled={busy} onClick={() => loadStarter(starter.content)}>
              <span>{starter.label}</span><b aria-hidden="true">↗</b>
            </button>
          ))}
        </div>
      </div>

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

      <label className="recruitment-wide-label recruitment-message-composer">
        Applicant message draft
        <textarea
          rows={5}
          maxLength={2000}
          value={message}
          onChange={(event) => { setMessage(event.target.value); setSaved(false); setCopied(false); }}
          placeholder="Write the communication that should become part of the applicant's private recruitment record."
        />
        <small>{message.length.toLocaleString()} / 2,000 characters</small>
      </label>
      {error ? <p className="application-error" role="alert">{error}</p> : null}
      {saved ? <p className="recruitment-applicant-message__saved">Message added to the applicant&apos;s permanent communication history.</p> : null}
      {copied ? <p className="recruitment-applicant-message__copied">Draft copied for Discord.</p> : null}
      <div className="recruitment-applicant-message__actions">
        <button className="portal-button portal-button--primary" type="button" disabled={busy || !message.trim()} onClick={() => void send()}>{busy ? "Sending…" : "Send & record message"}</button>
        <button className="portal-button" type="button" disabled={busy || !message.trim()} onClick={() => void copyForDiscord()}>{copied ? "Copied for Discord" : "Copy draft for Discord"}</button>
        <button className="portal-button portal-button--secondary" type="button" disabled={busy || !message} onClick={() => { setMessage(""); setCopied(false); }}>Clear draft</button>
      </div>
    </section>
  );
}
