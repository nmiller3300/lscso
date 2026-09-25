import { createHash } from "node:crypto";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PortalResponsiveCinematicBackdrop } from "../../../../portal/_components/PortalResponsiveCinematicBackdrop";
import { ApplicantStatusView, type ApplicantMessage, type ApplicantStatusRecord } from "../ApplicantStatusView";
import { DepartmentAttorneyStatusView } from "../DepartmentAttorneyStatusView";
import { ForensicsSpecialistStatusView } from "../ForensicsSpecialistStatusView";
import { ApplicantStatusLiveRefresh } from "./ApplicantStatusLiveRefresh";
import "../../../../portal/portal-login-responsive-cinematic.css";
import "../../application.css";
import "./status.css";
import "./communications.css";
import "./offer.css";
import "./attorney-status.css";
import "../../candidate-experience.css";
import "./candidate-status-experience.css";

export const metadata: Metadata = {
  title: "Application Status",
  description: "Private LSCSO recruitment candidate status portal.",
  robots: { index: false, follow: false },
};

export const revalidate = 0;
export const dynamic = "force-dynamic";

type TrackedApplication = ApplicantStatusRecord & { application_track?: string | null };

function buildVersion(record: TrackedApplication, messages: ApplicantMessage[]) {
  const lastMessage = messages.length ? messages[messages.length - 1] : null;
  return JSON.stringify({
    applicationTrack: record.application_track ?? null,
    updatedAt: record.updated_at ?? null,
    status: record.status ?? null,
    interviewStatus: record.interview_status ?? null,
    interviewScheduledAt: record.interview_scheduled_at ?? null,
    applicantTimeZone: record.applicant_timezone ?? null,
    interviewTimeZone: record.interview_timezone ?? null,
    applicantStatusMessage: record.applicant_status_message ?? null,
    hired: Boolean(record.hired),
    closureCode: record.closure_code ?? null,
    closureReason: record.closure_reason ?? null,
    offerId: record.offer_id ?? null,
    offerStatus: record.offer_status ?? null,
    offerIssuedAt: record.offer_issued_at ?? null,
    offerExpiresAt: record.offer_expires_at ?? null,
    offerAcceptedAt: record.offer_accepted_at ?? null,
    offerSignatureName: record.offer_signature_name ?? null,
    messageCount: messages.length,
    lastMessageId: lastMessage?.id ?? null,
    lastMessageSentAt: lastMessage?.sent_at ?? null,
  });
}

export default async function ApplicantStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rawToken = String(token ?? "").trim();
  const tokenHash = rawToken.length >= 32 && rawToken.length <= 160
    ? createHash("sha256").update(rawToken).digest("hex")
    : "";

  const supabase = await createClient() as any;
  const { data, error } = tokenHash
    ? await supabase.rpc("get_recruitment_application_status", { p_tracking_token_hash: tokenHash }).maybeSingle()
    : { data: null, error: null };

  const record = !error && data ? data as TrackedApplication : null;
  if (!record) {
    return (
      <main className="application-status-page">
        <section className="application-status-hero">
          <div className="site-shell application-status-invalid">
            <Image src="/images/lscso-patch-color.png" alt="Los Santos County Sheriff's Office patch" width={140} height={140} priority />
            <p>LSCSO Recruitment</p>
            <h1>Private status link unavailable.</h1>
            <span>This tracking link is invalid, expired, incomplete, or no longer associated with an applicant record.</span>
            <Link className="button" href="/join">Return to Join LSCSO</Link>
          </div>
        </section>
      </main>
    );
  }

  const { data: messageData } = await supabase.rpc("get_recruitment_application_messages", {
    p_tracking_token_hash: tokenHash,
  });
  const applicantMessages = (Array.isArray(messageData) ? messageData : []) as ApplicantMessage[];
  const liveVersion = buildVersion(record, applicantMessages);
  const liveRefresh = <ApplicantStatusLiveRefresh token={rawToken} initialVersion={liveVersion} />;
  const openNoShow = record.status === "Accepted"
    && record.interview_status === "No Show"
    && !String(record.closure_code ?? "").trim();
  const candidateView = record.application_track === "Department Attorney"
    ? <DepartmentAttorneyStatusView record={record} applicantMessages={applicantMessages} />
    : record.application_track === "Forensics Specialist"
      ? <ForensicsSpecialistStatusView record={record} applicantMessages={applicantMessages} />
      : <ApplicantStatusView record={record} applicantMessages={applicantMessages} trackingToken={rawToken} />;

  return (
    <>
      {liveRefresh}
      <div className="candidate-record-portal candidate-status-experience">
        <PortalResponsiveCinematicBackdrop />
        <div className="candidate-intake-ambient" aria-hidden="true"><span /><span /><span /></div>
        <Image
          className="candidate-status-watermark"
          src="/images/lscso-patch-color.png"
          alt=""
          width={840}
          height={840}
          aria-hidden="true"
          priority
        />
        {openNoShow ? (
          <aside className="candidate-no-show-notice" aria-label="Interview no-show next steps">
            <div className="candidate-no-show-notice__mark" aria-hidden="true">↻</div>
            <div>
              <p>Interview attendance · candidate record remains open</p>
              <strong>You may still be considered for another interview.</strong>
              <span>If you want another opportunity to interview, contact LSCSO Recruitment or Command through Discord. They can review the circumstances and may offer another interview.</span>
            </div>
            <em>A second interview is not automatic or guaranteed. Continue monitoring this private record for any new scheduled time.</em>
          </aside>
        ) : null}
        {candidateView}
      </div>
    </>
  );
}
