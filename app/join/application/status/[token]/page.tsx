import { createHash } from "node:crypto";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ApplicantDispositionView } from "../ApplicantDispositionView";
import { ApplicantStatusView, type ApplicantMessage, type ApplicantStatusRecord } from "../ApplicantStatusView";
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

  if (isFinalDisposition(record)) {
    return <ApplicantDispositionView record={record} applicantMessages={applicantMessages} />;
  }

  return <ApplicantStatusView record={record} applicantMessages={applicantMessages} trackingToken={rawToken} />;
}
