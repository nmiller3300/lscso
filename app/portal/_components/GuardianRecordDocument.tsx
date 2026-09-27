"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePortalProfile } from "./PortalProfileProvider";
import styles from "./GuardianRecordDocument.module.css";

type PersonSnapshot = {
  id: string;
  personnelId: string;
  displayName: string;
  rank: string;
  callSign: string | null;
};

type AcknowledgmentSnapshot = {
  fingerprintId: string;
  typedName: string | null;
  signatureMethod: string;
  acknowledgmentText: string;
  displayNameSnapshot: string;
  rankSnapshot: string;
  personnelIdSnapshot: string;
  callSignSnapshot: string | null;
  responseText: string | null;
  signedAt: string;
} | null;

type EvaluationRating = {
  key: string;
  label: string;
  value: number;
};

type EvaluationDetails = {
  kind: string;
  periodStart: string;
  periodEnd: string;
  overallAverage: string;
  overallRating: string;
  ratings: EvaluationRating[];
  supervisorSummary: string;
  strengths: string;
  improvementAreas: string;
  goals: string;
  remediationRequired: boolean;
  remediationPlan: string;
} | null;

type GuardianRecordDocumentProps = {
  guardianId: string;
  guardianNumber: string;
  referenceNumber: string;
  title: string;
  recordType: string;
  category: string;
  status: string;
  incidentDate: string;
  issuedDate: string;
  location: string;
  policyReference: string;
  relatedReference: string;
  pointsAssessed: number;
  observedConduct: string;
  operationalImpact: string;
  expectedStandard: string;
  supervisorContext: string;
  followUpPlan: string;
  followUpDate: string;
  responseWindow: string;
  allowResponse: boolean;
  memberResponse: string;
  acknowledgedAt: string;
  subject: PersonSnapshot;
  author: PersonSnapshot;
  acknowledgment: AcknowledgmentSnapshot;
  evaluation: EvaluationDetails;
};

function valueOrDash(value: string) {
  return value.trim() || "—";
}

function ratingLabel(value: number) {
  if (value === 1) return "Unsatisfactory";
  if (value === 2) return "Needs Improvement";
  if (value === 3) return "Meets Expectations";
  if (value === 4) return "Exceeds Expectations";
  if (value === 5) return "Exceptional";
  return "Not rated";
}

export function GuardianRecordDocument(props: GuardianRecordDocumentProps) {
  const profile = usePortalProfile();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const isSubject = profile.id === props.subject.id;
  const canAcknowledge = isSubject && !props.acknowledgedAt && ["Awaiting Acknowledgment", "Issued"].includes(props.status);
  const isCommendation = props.recordType === "Commendation";
  const isEvaluation = props.recordType === "Performance Evaluation" && props.evaluation;
  const signedName = props.acknowledgment?.typedName || props.acknowledgment?.displayNameSnapshot || (props.acknowledgedAt ? props.subject.displayName : "");

  async function acknowledge(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canAcknowledge || pending) return;
    const form = new FormData(event.currentTarget);
    const signatureName = String(form.get("signatureName") ?? "").trim();
    const responseText = String(form.get("responseText") ?? "").trim();
    if (!isCommendation && signatureName.length < 2) {
      setNotice("Type your name in the signature field before acknowledging this Guardian.");
      return;
    }

    setPending(true);
    setNotice("");
    const { error } = await (createClient() as any).rpc("acknowledge_guardian", {
      record_id: props.guardianId,
      signature_name: signatureName,
      response_text: responseText || null,
    });
    setPending(false);
    if (error) {
      setNotice(error.message);
      return;
    }
    setNotice("Guardian acknowledged. The signed receipt has been added to the permanent record.");
    router.refresh();
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <div>
          <strong>Official Guardian record</strong>
          <span>Print-ready personnel document</span>
        </div>
        <button className={styles.printButton} onClick={() => window.print()} type="button">
          Print / Save PDF
        </button>
      </div>

      <article className={styles.document} aria-label={`Guardian record ${props.referenceNumber}`}>
        <header className={styles.documentHeader}>
          <div className={styles.patchWrap}>
            <Image src="/images/lscso-portal-patch.webp" alt="LSCSO patch" width={92} height={92} priority />
          </div>
          <div className={styles.agencyHeading}>
            <span>Los Santos County Sheriff&apos;s Office</span>
            <h2>Guardian Personnel Record</h2>
            <p>Supervisory Documentation &amp; Personnel Accountability</p>
          </div>
          <div className={styles.documentControl}>
            <span>Document No.</span>
            <strong>{props.referenceNumber}</strong>
            <small>G-{props.guardianNumber}</small>
          </div>
        </header>

        <div className={styles.classificationBand}>
          <div><span>Record Type</span><strong>{props.recordType}</strong></div>
          <div><span>Category</span><strong>{valueOrDash(props.category)}</strong></div>
          <div><span>Status</span><strong>{props.status}</strong></div>
        </div>

        <section className={styles.section}>
          <div className={styles.sectionTitle}><span>01</span><h3>Record identification</h3></div>
          <div className={styles.infoGrid}>
            <div><span>Subject member</span><strong>{props.subject.displayName}</strong><small>{props.subject.rank}{props.subject.callSign ? ` · ${props.subject.callSign}` : ""}</small></div>
            <div><span>Personnel ID</span><strong>{valueOrDash(props.subject.personnelId)}</strong></div>
            <div><span>Issued by</span><strong>{props.author.displayName}</strong><small>{props.author.rank}{props.author.callSign ? ` · ${props.author.callSign}` : ""}</small></div>
            <div><span>Incident / evaluation date</span><strong>{props.incidentDate}</strong></div>
            <div><span>Issued date</span><strong>{props.issuedDate}</strong></div>
            <div><span>Location / division</span><strong>{valueOrDash(props.location)}</strong></div>
            <div><span>Policy / standard reference</span><strong>{valueOrDash(props.policyReference)}</strong></div>
            <div><span>Related reference</span><strong>{valueOrDash(props.relatedReference)}</strong></div>
          </div>
        </section>

        {isEvaluation ? (
          <>
            <section className={styles.section}>
              <div className={styles.sectionTitle}><span>02</span><h3>Performance evaluation summary</h3></div>
              <div className={styles.evaluationSummary}>
                <div><span>Evaluation type</span><strong>{props.evaluation!.kind}</strong></div>
                <div><span>Review period</span><strong>{props.evaluation!.periodStart} – {props.evaluation!.periodEnd}</strong></div>
                <div><span>Overall rating</span><strong>{props.evaluation!.overallAverage} · {props.evaluation!.overallRating}</strong></div>
                <div><span>Disciplinary points</span><strong>0 · Non-disciplinary</strong></div>
              </div>
              <div className={styles.ratingGrid}>
                {props.evaluation!.ratings.map((rating) => (
                  <div key={rating.key}>
                    <span>{rating.label}</span>
                    <strong>{rating.value || "—"} / 5</strong>
                    <small>{ratingLabel(rating.value)}</small>
                  </div>
                ))}
              </div>
            </section>
            <section className={styles.section}>
              <div className={styles.sectionTitle}><span>03</span><h3>Supervisor assessment</h3></div>
              <div className={styles.narrativeBlock}><span>Overall assessment</span><p>{valueOrDash(props.evaluation!.supervisorSummary)}</p></div>
              <div className={styles.narrativeBlock}><span>Strengths</span><p>{valueOrDash(props.evaluation!.strengths)}</p></div>
              <div className={styles.narrativeBlock}><span>Improvement areas</span><p>{valueOrDash(props.evaluation!.improvementAreas)}</p></div>
              <div className={styles.narrativeBlock}><span>Goals / next-period expectations</span><p>{valueOrDash(props.evaluation!.goals)}</p></div>
              {props.evaluation!.remediationRequired ? <div className={styles.narrativeBlock}><span>Required remediation / training</span><p>{valueOrDash(props.evaluation!.remediationPlan)}</p></div> : null}
            </section>
          </>
        ) : (
          <section className={styles.section}>
            <div className={styles.sectionTitle}><span>02</span><h3>Supervisory narrative</h3></div>
            <div className={styles.narrativeBlock}><span>Observed conduct or performance</span><p>{valueOrDash(props.observedConduct)}</p></div>
            <div className={styles.narrativeBlock}><span>Operational or professional impact</span><p>{valueOrDash(props.operationalImpact)}</p></div>
            <div className={styles.narrativeBlock}><span>Expected standard and corrective direction</span><p>{valueOrDash(props.expectedStandard)}</p></div>
            <div className={styles.narrativeBlock}><span>Supervisor context</span><p>{valueOrDash(props.supervisorContext)}</p></div>
          </section>
        )}

        <section className={styles.section}>
          <div className={styles.sectionTitle}><span>{isEvaluation ? "04" : "03"}</span><h3>Follow-up and disposition</h3></div>
          <div className={styles.infoGrid}>
            <div><span>Follow-up</span><strong>{valueOrDash(props.followUpPlan)}</strong></div>
            <div><span>Follow-up date</span><strong>{valueOrDash(props.followUpDate)}</strong></div>
            <div><span>Response window</span><strong>{valueOrDash(props.responseWindow)}</strong></div>
            <div><span>Points assessed</span><strong>{props.pointsAssessed}</strong></div>
          </div>
          {props.memberResponse ? <div className={styles.narrativeBlock}><span>Member response / rebuttal</span><p>{props.memberResponse}</p></div> : null}
        </section>

        <section className={`${styles.section} ${styles.acknowledgmentSection}`}>
          <div className={styles.sectionTitle}><span>{isEvaluation ? "05" : "04"}</span><h3>Member acknowledgment</h3></div>
          <p className={styles.acknowledgmentText}>
            {isCommendation
              ? "I acknowledge receipt of this commendation."
              : "I acknowledge that I have received and reviewed this Guardian record. My acknowledgment confirms receipt only and does not indicate agreement with its contents. This is an internal department acknowledgment and is not a legal signature."}
          </p>

          {props.acknowledgedAt ? (
            <div className={styles.signedBlock}>
              <div className={styles.signatureField}>
                <span>Member signature / digital acknowledgment</span>
                <strong className={styles.signatureName}>{signedName}</strong>
                <small>{props.acknowledgment?.signatureMethod || "Digital acknowledgment"}</small>
              </div>
              <div className={styles.signatureField}>
                <span>Date &amp; time</span>
                <strong>{props.acknowledgedAt}</strong>
                <small>Receipt recorded electronically</small>
              </div>
              <div className={styles.signatureField}>
                <span>Personnel ID</span>
                <strong>{props.acknowledgment?.personnelIdSnapshot || props.subject.personnelId}</strong>
                <small>{props.acknowledgment?.rankSnapshot || props.subject.rank}</small>
              </div>
              <div className={styles.signatureField}>
                <span>Verification fingerprint</span>
                <strong className={styles.fingerprint}>{props.acknowledgment?.fingerprintId || "Recorded in Guardian audit history"}</strong>
                <small>System-generated receipt identifier</small>
              </div>
            </div>
          ) : canAcknowledge ? (
            <form className={styles.signatureForm} onSubmit={acknowledge}>
              {!isCommendation ? (
                <label>
                  <span>Type your full name to acknowledge receipt</span>
                  <input autoComplete="name" name="signatureName" placeholder={props.subject.displayName} required />
                </label>
              ) : null}
              {props.allowResponse ? (
                <label className={styles.responseField}>
                  <span>Optional written response / rebuttal</span>
                  <textarea name="responseText" rows={5} placeholder="Your response is preserved beside the original Guardian and does not alter the issued record." />
                </label>
              ) : null}
              <div className={styles.formFooter}>
                <small>Submitting this acknowledgment records your identity, date/time, and a permanent verification fingerprint.</small>
                <button disabled={pending} type="submit">{pending ? "Recording acknowledgment…" : isCommendation ? "Acknowledge receipt" : "Sign & acknowledge"}</button>
              </div>
              {notice ? <div className={styles.notice} role="status">{notice}</div> : null}
            </form>
          ) : (
            <div className={styles.pendingSignature}>
              <div><span>Member signature / digital acknowledgment</span><strong>{isSubject ? "Acknowledgment unavailable in current status" : "Awaiting member acknowledgment"}</strong></div>
              <div><span>Date &amp; time</span><strong>Pending</strong></div>
            </div>
          )}

          <div className={styles.issuerCertification}>
            <div>
              <span>Issuing / evaluating supervisor</span>
              <strong>{props.author.displayName}</strong>
              <small>{props.author.rank}{props.author.callSign ? ` · ${props.author.callSign}` : ""}</small>
            </div>
            <div>
              <span>Document reference</span>
              <strong>{props.referenceNumber}</strong>
              <small>Permanent Guardian record</small>
            </div>
          </div>
        </section>

        <footer className={styles.documentFooter}>
          <span>Los Santos County Sheriff&apos;s Office · Personnel Operations</span>
          <span>Protected personnel record · {props.referenceNumber}</span>
        </footer>
      </article>
    </div>
  );
}
