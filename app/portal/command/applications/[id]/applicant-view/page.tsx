import { notFound, redirect } from "next/navigation";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { createClient } from "@/lib/supabase/server";
import { ApplicantStatusView, type ApplicantMessage, type ApplicantStatusRecord } from "@/app/join/application/status/ApplicantStatusView";
import "../../../../../join/application/application.css";
import "../../../../../join/application/status/[token]/status.css";
import "../../../../../join/application/status/[token]/communications.css";

export const revalidate = 0;
export const dynamic = "force-dynamic";

export default async function CommandApplicantPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) redirect("/portal/command/supervision");

  const { id } = await params;
  const supabase = await createClient() as any;
  const [{ data: application }, { data: messages }] = await Promise.all([
    supabase.from("recruitment_applications")
      .select("application_number,full_name,status,interview_status,submitted_at,updated_at,interview_scheduled_at,applicant_status_message,hired_profile_id")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("recruitment_applicant_messages")
      .select("id,content,created_at")
      .eq("application_id", id)
      .order("created_at", { ascending: true }),
  ]);

  if (!application) notFound();

  const record: ApplicantStatusRecord = {
    application_number: application.application_number,
    applicant_name: application.full_name,
    status: application.status,
    interview_status: application.interview_status ?? "Not Scheduled",
    submitted_at: application.submitted_at,
    updated_at: application.updated_at,
    interview_scheduled_at: application.interview_scheduled_at,
    applicant_status_message: application.applicant_status_message,
    hired: application.status === "Hired" || Boolean(application.hired_profile_id),
  };
  const applicantMessages: ApplicantMessage[] = (messages ?? []).map((item: any) => ({
    id: item.id,
    content: item.content,
    sent_at: item.created_at,
  }));

  return <ApplicantStatusView record={record} applicantMessages={applicantMessages} />;
}
