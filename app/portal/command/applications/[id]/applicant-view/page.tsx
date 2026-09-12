import { notFound, redirect } from "next/navigation";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";
import { ApplicantStatusView, type ApplicantMessage, type ApplicantStatusRecord } from "@/app/join/application/status/ApplicantStatusView";
import "../../../../../join/application/application.css";
import "../../../../../join/application/status/[token]/status.css";
import "../../../../../join/application/status/[token]/communications.css";
import "../../../../../join/application/status/[token]/offer.css";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export default async function CommandApplicantPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) redirect("/portal/command/supervision");

  const { id } = await params;
  const supabase = await createClient() as any;
  const [{ data: application }, { data: messages }, { data: offers }] = await Promise.all([
    supabase.from("recruitment_applications")
      .select("application_number,full_name,status,interview_status,submitted_at,updated_at,interview_scheduled_at,applicant_status_message,hired_profile_id,recruitment_closure_code,recruitment_closure_reason")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("recruitment_applicant_messages")
      .select("id,content,created_at")
      .eq("application_id", id)
      .order("created_at", { ascending: true }),
    supabase.from("recruitment_employment_offers")
      .select("id,status,title,offered_rank,terms,issued_at,expires_at,accepted_at,accepted_signature_name,updated_at")
      .eq("application_id", id)
      .order("issued_at", { ascending: false })
      .limit(1),
  ]);

  if (!application) notFound();
  const offer = offers?.[0] ?? null;
  const effectiveOfferStatus = offer?.status === "Pending" && offer?.expires_at && new Date(offer.expires_at).getTime() <= Date.now()
    ? "Expired"
    : offer?.status ?? null;

  const record: ApplicantStatusRecord = {
    application_number: application.application_number,
    applicant_name: application.full_name,
    status: application.status,
    interview_status: application.interview_status ?? "Not Scheduled",
    submitted_at: application.submitted_at,
    updated_at: offer?.updated_at && new Date(offer.updated_at) > new Date(application.updated_at) ? offer.updated_at : application.updated_at,
    interview_scheduled_at: application.interview_scheduled_at,
    applicant_status_message: application.applicant_status_message,
    hired: application.status === "Hired" || Boolean(application.hired_profile_id),
    closure_code: application.recruitment_closure_code,
    closure_reason: application.recruitment_closure_reason,
    offer_id: offer?.id ?? null,
    offer_status: effectiveOfferStatus,
    offer_title: offer?.title ?? null,
    offer_terms: offer?.terms ?? null,
    offer_rank: offer?.offered_rank ?? null,
    offer_issued_at: offer?.issued_at ?? null,
    offer_expires_at: offer?.expires_at ?? null,
    offer_accepted_at: offer?.accepted_at ?? null,
    offer_signature_name: offer?.accepted_signature_name ?? null,
  };
  const applicantMessages: ApplicantMessage[] = (messages ?? []).map((item: any) => ({
    id: item.id,
    content: item.content,
    sent_at: item.created_at,
  }));

  return <ApplicantStatusView record={record} applicantMessages={applicantMessages} />;
}
