import { createHash } from "node:crypto";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ApplicantDispositionView } from "../ApplicantDispositionView";
import { ApplicantStatusView, type ApplicantMessage, type ApplicantStatusRecord } from "../ApplicantStatusView";
import { ApplicantStatusLiveRefresh } from "./ApplicantStatusLiveRefresh";
import "../../application.css";
import "./status.css";
import "./communications.css";
import "./offer.css";
import "./disposition.css";

export const metadata: Metadata = {
  title: "Application Status & Disposition",
  description: "Private LSCSO recruitment application status and disposition record.",
  robots: { index: false, follow: false },
};

export const revalidate = 0;
export const dynamic = "force-dynamic";

function isFinalDisposition(record: ApplicantStatusRecord) {
  if (record.hired || record.status === "Hired") return false;
  if (String(record.closure_code ?? "").trim()) return true;
  if (["Denied", "Withdrawn", "Archived"].includes(record.status)) return true;
  if (["Failed", "No Show"].includes(record.interview_status)) return true;
  if (["Expired", "Terminated"].includes(String(record.offer_status ?? ""))) return true;
  return false;
}

function buildVersion(record: ApplicantStatusRecord, messages: ApplicantMessage[]) {
  const lastMessage = messages.length ? messages[messages.length - 1] : null;
  return JSON.stringify({
    updatedAt: record.updated_at ?? null,
    status: record.status ?? null,
    interviewStatus: record.interview_status ?? null,
    interviewScheduledAt: record.interview_scheduled_at ?? null,
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

  const record = !error && data ? data as ApplicantStatusRecord : null;
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

  if (isFinalDisposition(record)) {
    return <>{liveRefresh}<ApplicantDispositionView record={record} applicantMessages={applicantMessages} /></>;
  }

  return <>{liveRefresh}<ApplicantStatusView record={record} applicantMessages={applicantMessages} trackingToken={rawToken} /></>;
}
