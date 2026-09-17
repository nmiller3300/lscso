"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PortalDialog } from "../../../_components/PortalDialog";

export type RecruitmentOffer = {
  id: string;
  status: "Pending" | "Accepted" | "Terminated";
  title: string;
  offered_rank: string;
  terms: string;
  issued_at: string;
  expires_at: string | null;
  accepted_at: string | null;
  accepted_signature_name: string | null;
  terminated_at: string | null;
  termination_reason: string | null;
};

const OFFER_RANKS = [
  "Recruit",
  "Deputy Sheriff",
  "Senior Deputy Sheriff",
  "Corporal",
  "Sergeant",
  "Lieutenant",
  "Captain",
  "Undersheriff",
  "Sheriff",
] as const;

function defaultTerms(rank: string) {
  return `The Los Santos County Sheriff's Office offers you appointment as ${rank === "Sheriff" || rank === "Undersheriff" ? rank : `a ${rank}`}, contingent upon completion of any department onboarding, training, certification, and administrative requirements applicable to the appointment. By accepting this offer, you confirm your intent to serve in accordance with LSCSO policies, standards, and lawful orders.`;
}

export function EmploymentOfferManager({
  applicationId,
  applicantName,
  interviewPassed,
  hired,
  offer,
}: {
  applicationId: string;
  applicantName: string;
  interviewPassed: boolean;
  hired: boolean;
  offer: RecruitmentOffer | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rank, setRank] = useState<(typeof OFFER_RANKS)[number]>("Recruit");
  const [terms, setTerms] = useState(() => defaultTerms("Recruit"));
  const [expiresAt, setExpiresAt] = useState("");
  const [terminateOpen, setTerminateOpen] = useState(false);
  const [terminationReason, setTerminationReason] = useState("");
  const generatedTerms = useMemo(() => defaultTerms(rank), [rank]);

  if ((!interviewPassed && !offer) || hired) return null;

  async function action(payload: Record<string, unknown>) {
    if (busy) return false;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/portal/applications/${applicationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The employment offer could not be updated.");
      router.refresh();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The employment offer could not be updated.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function changeRank(nextRank: (typeof OFFER_RANKS)[number]) {
    const previousGenerated = generatedTerms;
    setRank(nextRank);
    setTerms((current) => current === previousGenerated ? defaultTerms(nextRank) : current);
  }

  async function issueOffer() {
    await action({
      action: "issue_offer",
      title: "Offer of Employment",
      rank,
      terms: terms.trim(),
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : "",
    });
  }

  async function terminateOffer() {
    if (!offer || terminationReason.trim().length < 4) return;
    const ok = await action({ action: "terminate_offer", offerId: offer.id, reason: terminationReason.trim() });
    if (ok) {
      setTerminateOpen(false);
      setTerminationReason("");
    }
  }

  if (!offer) {
    return (
      <section className="portal-panel recruitment-offer-panel">
        <div className="portal-panel-heading">
          <div><p>Employment offer</p><h2>Issue employment offer</h2></div>
          <span>Interview passed</span>
        </div>
        <div className="recruitment-control-grid">
          <label>
            Offered rank
            <select value={rank} onChange={(event) => changeRank(event.target.value as (typeof OFFER_RANKS)[number])}>
              {OFFER_RANKS.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          <label>Offer expiration <em>Optional</em><input type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></label>
        </div>
        <label className="recruitment-wide-label">Offer terms<textarea rows={6} value={terms} onChange={(event) => setTerms(event.target.value)} /></label>
        {error ? <p className="application-error" role="alert">{error}</p> : null}
        <button className="portal-button portal-button--primary" type="button" disabled={busy || terms.trim().length < 10} onClick={() => void issueOffer()}>
          {busy ? "Issuing…" : `Issue ${rank} Offer`}
        </button>
      </section>
    );
  }

  const expired = offer.status === "Pending" && Boolean(offer.expires_at) && new Date(offer.expires_at!).getTime() <= Date.now();
  const displayStatus = expired ? "Expired" : offer.status;

  return (
    <>
      <section className="portal-panel recruitment-offer-panel">
        <div className="portal-panel-heading">
          <div><p>Employment offer</p><h2>{offer.title}</h2></div>
          <b className={`recruitment-status recruitment-status--${displayStatus.toLowerCase()}`}>{displayStatus}</b>
        </div>
        <dl className="recruitment-offer-record">
          <div><dt>Position</dt><dd>{offer.offered_rank}</dd></div>
          <div><dt>Issued</dt><dd>{new Date(offer.issued_at).toLocaleString()}</dd></div>
          <div><dt>Expires</dt><dd>{offer.expires_at ? new Date(offer.expires_at).toLocaleString() : "No expiration"}</dd></div>
          <div><dt>Applicant signature</dt><dd>{offer.accepted_signature_name || "Pending"}</dd></div>
          <div><dt>Accepted</dt><dd>{offer.accepted_at ? new Date(offer.accepted_at).toLocaleString() : "Not accepted"}</dd></div>
        </dl>
        <div className="recruitment-offer-terms"><span>Offer terms</span><p>{offer.terms}</p></div>
        {offer.status === "Accepted" ? <p className="recruitment-offer-success">✓ Applicant signed and accepted the employment offer. Appointment is unlocked below.</p> : null}
        {error ? <p className="application-error" role="alert">{error}</p> : null}
        {offer.status === "Pending" || offer.status === "Accepted" ? (
          <button className="portal-button portal-button--danger" type="button" disabled={busy} onClick={() => { setError(""); setTerminateOpen(true); }}>
            Terminate Employment Offer
          </button>
        ) : null}
      </section>

      <PortalDialog
        open={terminateOpen}
        onClose={() => { if (!busy) setTerminateOpen(false); }}
        eyebrow="Employment offer"
        title={`Terminate ${applicantName}'s offer?`}
        description="Terminating the offer closes this recruitment process. The applicant will see the reason on their tracking page."
        dismissOnBackdrop={!busy}
        footer={
          <>
            <button className="portal-button portal-button--secondary" type="button" disabled={busy} onClick={() => setTerminateOpen(false)}>Cancel</button>
            <button className="portal-button portal-button--danger" type="button" disabled={busy || terminationReason.trim().length < 4} onClick={() => void terminateOffer()}>
              {busy ? "Terminating…" : "Terminate Offer & Close Process"}
            </button>
          </>
        }
      >
        <label className="recruitment-wide-label">Reason <em>Shown to applicant</em><textarea rows={5} value={terminationReason} onChange={(event) => setTerminationReason(event.target.value)} placeholder="Why is this employment offer being terminated?" /></label>
      </PortalDialog>
    </>
  );
}
