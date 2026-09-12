"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

function toLocalInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ApplicantTrackingLinkManager({
  applicationId,
  applicantName,
  initialExpiresAt,
}: {
  applicationId: string;
  applicantName: string;
  initialExpiresAt?: string | null;
}) {
  const router = useRouter();
  const [origin, setOrigin] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [expiresAt, setExpiresAt] = useState(toLocalInput(initialExpiresAt));

  const trackingUrl = useMemo(() => token && origin
    ? `${origin}/join/application/status/${encodeURIComponent(token)}`
    : "", [origin, token]);
  const previewUrl = `/portal/command/applications/${applicationId}/applicant-view`;
  const expired = Boolean(initialExpiresAt && new Date(initialExpiresAt).getTime() <= Date.now());

  useEffect(() => {
    setOrigin(window.location.origin);
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch(`/api/portal/applications/${applicationId}/tracking-link`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Tracking link unavailable.");
        if (!cancelled) setToken(data.tracking_token ?? null);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Tracking link unavailable.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [applicationId]);

  async function copy(value: string, message: string) {
    await navigator.clipboard.writeText(value);
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2200);
  }

  async function share() {
    if (!trackingUrl) return;
    const text = `Hi ${applicantName}, here is your private LSCSO application tracking link:`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "LSCSO Application Tracking", text, url: trackingUrl });
        return;
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") return;
      }
    }
    await copy(`${text} ${trackingUrl}`, "Applicant message copied.");
  }

  async function saveExpiration(value: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/portal/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "tracking_expiration", expiresAt: value ? new Date(value).toISOString() : "" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Tracking-link expiration could not be updated.");
      setNotice(value ? "Tracking-link expiration saved." : "Tracking-link expiration removed.");
      window.setTimeout(() => setNotice(""), 2200);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Tracking-link expiration could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="portal-panel" id="tracking-link">
      <div className="portal-panel-heading">
        <div><p>Applicant access</p><h2>Private tracking link</h2></div>
        <span>{expired ? "Expired" : loading ? "Loading" : token ? "Active" : "Legacy application"}</span>
      </div>

      {trackingUrl ? (
        <>
          <input aria-label="Applicant tracking link" readOnly value={trackingUrl} style={{ width: "100%" }} />
          <div className="portal-page-actions" style={{ marginTop: 12 }}>
            <a className="portal-button portal-button--primary" href={trackingUrl} target="_blank" rel="noreferrer">Open applicant link</a>
            <button className="portal-button" type="button" onClick={() => void share()}>Share to applicant</button>
            <button className="portal-button" type="button" onClick={() => void copy(trackingUrl, "Tracking link copied.")}>Copy link</button>
          </div>
        </>
      ) : !loading ? (
        <p className="command-v2-compact-copy">Original link unavailable for this legacy application.</p>
      ) : null}

      <div className="recruitment-control-grid" style={{ marginTop: 18 }}>
        <label>
          Tracking link expiration <em>Optional</em>
          <input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
        </label>
        <div className="recruitment-final-decision" style={{ alignSelf: "end" }}>
          <div>
            <button className="portal-button" type="button" disabled={busy} onClick={() => void saveExpiration(expiresAt)}>{busy ? "Saving…" : "Save expiration"}</button>
            {initialExpiresAt ? <button className="portal-button portal-button--secondary" type="button" disabled={busy} onClick={() => { setExpiresAt(""); void saveExpiration(""); }}>Remove expiration</button> : null}
          </div>
        </div>
      </div>
      {initialExpiresAt ? <p className="command-v2-compact-copy">Applicant access {expired ? "expired" : "expires"} {new Date(initialExpiresAt).toLocaleString()}.</p> : null}

      <div className="portal-page-actions" style={{ marginTop: 12 }}>
        <a className="portal-button" href={previewUrl} target="_blank" rel="noreferrer">Preview applicant tracking page</a>
      </div>

      {error ? <p className="application-error" role="alert">{error}</p> : null}
      {notice ? <div className="portal-toast" role="status">{notice}</div> : null}
    </section>
  );
}
