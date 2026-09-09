import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PortalShell } from "../../../_components/PortalShell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { applicationLabel } from "@/lib/recruitment/application";
import { ApplicationReview } from "./ApplicationReview";
import { ApplicationDynamicAnswers } from "./ApplicationDynamicAnswers";
import { ApplicantStatusMessage } from "./ApplicantStatusMessage";
import { DeleteApplicationButton } from "./DeleteApplicationButton";
import "./communications.css";

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) redirect("/portal/command/supervision");
  const { id } = await params;
  const supabase = await createClient() as any;
  const [{ data: application }, { data: people }, { data: notes }, { data: history }, { data: applicantMessages }] = await Promise.all([
    supabase.from("recruitment_applications").select("*").eq("id", id).maybeSingle(),
    supabase.from("personnel_profiles").select("id,display_name,access_tier,status").in("access_tier", ["Executive", "Command"]).in("status", ["Active", "Acting"]).order("display_name"),
    supabase.from("recruitment_application_notes").select("*").eq("application_id", id).order("created_at", { ascending: false }),
    supabase.from("recruitment_application_history").select("*").eq("application_id", id).order("created_at", { ascending: false }),
    supabase.from("recruitment_applicant_messages").select("id,application_id,author_profile_id,content,created_at").eq("application_id", id).order("created_at", { ascending: true }),
  ]);
  if (!application) notFound();
  const reviewerList = (people ?? []).map((person: any) => ({ id: person.id, name: person.display_name }));
  const names = Object.fromEntries(reviewerList.map((person: any) => [person.id, person.name]));
  const canDeleteApplication = ["Sheriff", "Undersheriff"].includes(profile.rank) && !application.hired_profile_id && application.status !== "Hired";
  const label = applicationLabel(application.application_number);

  return (
    <PortalShell active="applications" eyebrow="Personnel · Recruitment" title={label} description="Review the submitted application and record each Command action.">
      <div className="portal-page-actions">
        <Link href="/portal/command/applications" className="portal-button">Back to applications</Link>
      </div>

      {canDeleteApplication ? (
        <section className="portal-panel recruitment-admin-cleanup">
          <div className="portal-panel-heading">
            <div>
              <p>Administrative cleanup</p>
              <h2>Test / invalid application cleanup</h2>
            </div>
            <span>Sheriff / Undersheriff</span>
          </div>
          <p>
            You can safely test this application through Accepted and the interview stages, then permanently delete it afterward.
            Deletion remains available until a Recruit/personnel record is actually created.
          </p>
          <DeleteApplicationButton applicationId={application.id} applicationNumber={label} applicantName={application.full_name} />
        </section>
      ) : null}

      <ApplicationReview application={application} reviewers={reviewerList} names={names} notes={notes ?? []} history={history ?? []} />
      <ApplicantStatusMessage
        applicationId={application.id}
        messages={applicantMessages ?? []}
        names={names}
      />
      <ApplicationDynamicAnswers application={application} />
    </PortalShell>
  );
}
