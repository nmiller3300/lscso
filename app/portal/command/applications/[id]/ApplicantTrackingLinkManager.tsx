"use client";

import { useEffect, useMemo, useState } from "react";

export function ApplicantTrackingLinkManager({ applicationId, applicantName }: { applicationId: string; applicantName: string }) {
  const [origin, setOrigin] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const trackingUrl = useMemo(() => token && origin
    ? `${origin}/join/application/status/${encodeURIComponent(token)}`
    : "", [origin, token]);
  const previewUrl = `/portal/command/applications/${applicationId}/applicant-view`;

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

  return (
    <section className="portal-panel" id="tracking-link">
      <div className="portal-panel-heading">
        <div><p>Applicant access</p><h2>Private tracking link</h2></div>
        <span>{loading ? "Loading" : token ? "Original link" : "Legacy application"}</span>
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
        <p className="command-v2-compact-copy">This application was submitted before original tracking-link recovery was enabled.</p>
      ) : null}

      <div className="portal-page-actions" style={{ marginTop: 12 }}>
        <a className="portal-button" href={previewUrl} target="_blank" rel="noreferrer">Preview applicant tracking page</a>
      </div>

      {error ? <p className="application-error" role="alert">{error}</p> : null}
      {notice ? <div className="portal-toast" role="status">{notice}</div> : null}
    </section>
  );
}
