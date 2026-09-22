import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PortalShell } from "../../../_components/PortalShell";
import { getHiringAuthorityPersonnel, hasHiringAuthority } from "@/lib/authorization/hiring-authority";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { applicationLabel } from "@/lib/recruitment/application";
import { ApplicationReview } from "./ApplicationReview";
import { DepartmentAttorneyReview } from "./DepartmentAttorneyReview";
import { ApplicantTrackingLinkManager } from "./ApplicantTrackingLinkManager";
import { ApplicationClosureControl } from "./ApplicationClosureControl";
import { DeleteApplicationButton } from "./DeleteApplicationButton";
import { RecruitmentCaseHeader } from "./RecruitmentCaseHeader";
import { DepartmentAttorneyCaseHeader } from "./DepartmentAttorneyCaseHeader";
import "./communications.css";
import "./recruitment-premium.css";

export default async function ApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentPortalProfile();
  if (!profile || !(await hasHiringAuthority(profile))) redirect("/portal");
  const { id } = await params;
  const supabase = await createClient() as any;
  const [{ data: application }, { data: notes }, { data: history }, { data: applicantMessages }, { data: offers }, people] = await Promise.all([
    supabase.from("recruitment_applications").select("*").eq("id", id).maybeSingle(),
    supabase.from("recruitment_application_notes").select("*").eq("application_id", id).order("created_at", { ascending: false }),
    supabase.from("recruitment_application_history").select("*").eq("application_id", id).order("created_at", { ascending: false }),
    supabase.from("recruitment_applicant_messages").select("id,application_id,author_profile_id,content,created_at").eq("application_id", id).order("created_at", { ascending: true }),
    supabase.from("recruitment_employment_offers").select("*").eq("application_id", id).order("issued_at", { ascending: false }),
    getHiringAuthorityPersonnel(),
  ]);
  if (!application) notFound();

  const reviewerList = (people ?? []).map((person: any) => ({ id: person.id, name: person.display_name }));
  const names = Object.fromEntries(reviewerList.map((person: any) => [person.id, person.name]));
  const attorney = application.application_track === "Department Attorney";
  const canDeleteApplication = ["Sheriff", "Undersheriff"].includes(profile.rank) && !application.hired_profile_id && application.status !== "Hired";
  const label = applicationLabel(application.application_number);
  const closed = application.status === "Archived" || Boolean(application.recruitment_closed_at);
  const isHired = application.status === "Hired" || Boolean(application.hired_profile_id);
  const alreadyFinalWithoutClosure = ["Denied", "Withdrawn"].includes(application.status);
  const latestOffer = attorney ? null : offers?.[0] ?? null;

  return (
    <PortalShell
      active="applications"
      eyebrow="Personnel · Recruitment"
      title={label}
      description={attorney ? "Department Attorney application review and selection workflow." : "Sworn application review and recruitment workflow."}
    >
      <div className="portal-page-actions">
        <Link href="/portal/command/applications" className="portal-button">Back to applications</Link>
      </div>

      {attorney
        ? <DepartmentAttorneyCaseHeader application={application} />
        : <RecruitmentCaseHeader application={application} latestOffer={latestOffer} />}

      <ApplicantTrackingLinkManager
        applicationId={application.id}
        applicantName={application.full_name}
        initialExpiresAt={application.applicant_tracking_expires_at}
      />

      <ApplicationClosureControl
        applicationId={application.id}
        applicantName={application.full_name}
        closed={closed}
        hired={isHired || alreadyFinalWithoutClosure}
        closureCode={application.recruitment_closure_code}
        closureReason={application.recruitment_closure_reason}
        closedAt={application.recruitment_closed_at}
      />

      {canDeleteApplication ? (
        <section className="portal-panel recruitment-admin-cleanup">
          <div className="portal-panel-heading">
            <div><p>Administrative cleanup</p><h2>Test / invalid application cleanup</h2></div>
            <span>Sheriff / Undersheriff</span>
          </div>
          <DeleteApplicationButton applicationId={application.id} applicationNumber={label} applicantName={application.full_name} />
        </section>
      ) : null}

      {attorney ? (
        <DepartmentAttorneyReview
          application={application}
          reviewers={reviewerList}
          names={names}
          notes={notes ?? []}
          history={history ?? []}
          applicantMessages={applicantMessages ?? []}
        />
      ) : (
        <ApplicationReview
          application={{ ...application, latest_offer: latestOffer }}
          reviewers={reviewerList}
          names={names}
          notes={notes ?? []}
          history={history ?? []}
          applicantMessages={applicantMessages ?? []}
        />
      )}
    </PortalShell>
  );
}
