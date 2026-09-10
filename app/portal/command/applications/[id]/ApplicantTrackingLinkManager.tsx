"use client";

import { useEffect, useMemo, useState } from "react";

export function ApplicantTrackingLinkManager({ applicationId, applicantName }: { applicationId: string; applicantName: string }) {
  const [origin, setOrigin] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const trackingUrl = useMemo(() => token && origin
    ? `${origin}/join/application/status/${encodeURIComponent(token)}`
    : "", [origin, token]);

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

  async function reissue() {
    const confirmed = window.confirm("Reissue this tracking link? The applicant's old private link will stop working.");
    if (!confirmed || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/portal/applications/${applicationId}/tracking-link`, { method: "POST" });
      const data = await response.json();
      if (!response.ok || !data.tracking_token) throw new Error(data.error || "Tracking link could not be reissued.");
      setToken(data.tracking_token);
      setNotice("New tracking link issued.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Tracking link could not be reissued.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="portal-panel" id="tracking-link">
      <div className="portal-panel-heading">
        <div><p>Applicant access</p><h2>Private tracking link</h2></div>
        <span>{loading ? "Loading" : token ? "Available" : "Recovery needed"}</span>
      </div>

      {trackingUrl ? (
        <>
          <input aria-label="Applicant tracking link" readOnly value={trackingUrl} style={{ width: "100%" }} />
          <div className="portal-page-actions" style={{ marginTop: 12 }}>
            <a className="portal-button" href={trackingUrl} target="_blank" rel="noreferrer">Open link</a>
            <button className="portal-button portal-button--primary" type="button" onClick={() => void copy(trackingUrl, "Tracking link copied.")}>Copy link</button>
            <button className="portal-button" type="button" onClick={() => void copy(`Hi ${applicantName}, here is your private LSCSO application tracking link: ${trackingUrl}`, "Applicant message copied.")}>Copy message</button>
            <button className="portal-button portal-button--danger" disabled={busy} type="button" onClick={() => void reissue()}>{busy ? "Reissuing…" : "Reissue link"}</button>
          </div>
        </>
      ) : !loading ? (
        <button className="portal-button portal-button--primary" disabled={busy} type="button" onClick={() => void reissue()}>{busy ? "Generating…" : "Generate replacement link"}</button>
      ) : null}

      {error ? <p className="application-error" role="alert">{error}</p> : null}
      {notice ? <div className="portal-toast" role="status">{notice}</div> : null}
    </section>
  );
}
