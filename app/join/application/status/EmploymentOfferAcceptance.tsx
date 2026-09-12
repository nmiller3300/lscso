"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LocalDateTime } from "./[token]/LocalDateTime";

export function EmploymentOfferAcceptance({
  trackingToken,
  offerId,
  status,
  title,
  rank,
  terms,
  issuedAt,
  expiresAt,
  acceptedAt,
  signatureName,
}: {
  trackingToken?: string;
  offerId: string;
  status: string;
  title: string;
  rank: string;
  terms: string;
  issuedAt: string;
  expiresAt?: string | null;
  acceptedAt?: string | null;
  signatureName?: string | null;
}) {
  const router = useRouter();
  const [signature, setSignature] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function acceptOffer() {
    if (!trackingToken || !accepted || !signature.trim() || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/applications/tracking/${encodeURIComponent(trackingToken)}/offer/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId, signatureName: signature.trim(), accepted: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The employment offer could not be accepted.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The employment offer could not be accepted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`application-status-offer application-status-offer--${status.toLowerCase()}`}>
      <div className="application-status-offer__heading">
        <div><span>Employment offer</span><h2>{title}</h2></div>
        <strong>{status}</strong>
      </div>
      <dl className="application-status-offer__meta">
        <div><dt>Position</dt><dd>{rank}</dd></div>
        <div><dt>Issued</dt><dd><LocalDateTime value={issuedAt} /></dd></div>
        {expiresAt ? <div><dt>Offer deadline</dt><dd><LocalDateTime value={expiresAt} /></dd></div> : null}
      </dl>
      <div className="application-status-offer__terms">{terms}</div>

      {status === "Accepted" ? (
        <div className="application-status-offer__accepted">
          <strong>Offer accepted and electronically signed.</strong>
          <span>{signatureName || "Applicant"}{acceptedAt ? <> · <LocalDateTime value={acceptedAt} /></> : null}</span>
        </div>
      ) : status === "Expired" ? (
        <div className="application-status-offer__closed"><strong>This employment offer has expired.</strong></div>
      ) : status === "Terminated" ? (
        <div className="application-status-offer__closed"><strong>This employment offer is no longer active.</strong></div>
      ) : trackingToken ? (
        <div className="application-status-offer__signature">
          <label>
            Electronic signature
            <input value={signature} onChange={(event) => setSignature(event.target.value)} placeholder="Enter your full name" autoComplete="name" />
          </label>
          <label className="application-status-offer__check">
            <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
            <span>I accept this employment offer and electronically sign it.</span>
          </label>
          {error ? <p className="application-error" role="alert">{error}</p> : null}
          <button className="button" type="button" disabled={busy || !accepted || !signature.trim()} onClick={() => void acceptOffer()}>
            {busy ? "Accepting…" : "Sign & Accept Offer"}
          </button>
        </div>
      ) : (
        <div className="application-status-offer__preview"><strong>Applicant signature pending.</strong></div>
      )}
    </section>
  );
}
