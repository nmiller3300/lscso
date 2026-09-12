import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalShell } from "../../_components/PortalShell";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { ApplicationsDirectory } from "./ApplicationsDirectory";
import { ApplicationAvailabilityControl } from "./ApplicationAvailabilityControl";

export default async function CommandApplicationsPage() {
  const profile = await getCurrentPortalProfile();
  if (!profile || !["Executive", "Command"].includes(profile.access_tier)) redirect("/portal/command/supervision");

  const supabase = await createClient() as any;
  const [applicationsResult, peopleResult, settingsResult, offersResult] = await Promise.all([
    supabase.from("recruitment_applications").select("id,application_number,full_name,discord_username,status,submitted_at,created_at,updated_at,reviewer_profile_id,interview_status,hired_profile_id,recruitment_closed_at").order("submitted_at", { ascending: false }).limit(250),
    supabase.from("personnel_profiles").select("id,display_name,rank,access_tier,status").in("access_tier", ["Executive", "Command"]).in("status", ["Active", "Acting"]).order("display_name"),
    supabase.from("recruitment_settings").select("applications_open,updated_at,updated_by_profile_id").eq("id", "applications").maybeSingle(),
    supabase.from("recruitment_employment_offers").select("application_id,status,expires_at,issued_at").order("issued_at", { ascending: false }),
  ]);

  const applications = applicationsResult.data ?? [];
  const people = peopleResult.data ?? [];
  const names = new Map(people.map((person: any) => [person.id, person.display_name]));
  const fullNames = new Map<string, string>(people.map((person: any): [string, string] => [person.id, `${person.rank} ${person.display_name}`]));
  const settings = settingsResult.data;
  const latestOfferByApplication = new Map<string, any>();
  for (const offer of offersResult.data ?? []) {
    if (!latestOfferByApplication.has(offer.application_id)) latestOfferByApplication.set(offer.application_id, offer);
  }
  const offerStatus = (applicationId: string) => {
    const offer = latestOfferByApplication.get(applicationId);
    if (!offer) return null;
    if (offer.status === "Pending" && offer.expires_at && new Date(offer.expires_at).getTime() <= Date.now()) return "Expired";
    return offer.status;
  };

  const newApplications = applications.filter((item: any) => item.status === "Submitted").length;
  const underReview = applications.filter((item: any) => item.status === "Under Review").length;
  const interviewsInProgress = applications.filter((item: any) => item.status === "Accepted" && !["Passed", "Failed"].includes(item.interview_status)).length;
  const offerStage = applications.filter((item: any) => item.status === "Accepted" && item.interview_status === "Passed" && offerStatus(item.id) !== "Accepted").length;
  const readyToAppoint = applications.filter((item: any) => item.status === "Accepted" && item.interview_status === "Passed" && offerStatus(item.id) === "Accepted" && !item.hired_profile_id).length;
  const closed = applications.filter((item: any) => ["Denied", "Withdrawn", "Archived", "Hired"].includes(item.status) || Boolean(item.hired_profile_id) || Boolean(item.recruitment_closed_at)).length;
  const canEditApplication = ["Sheriff", "Undersheriff"].includes(profile.rank);

  return (
    <PortalShell
      active="applications"
      eyebrow="Personnel · Recruitment"
      title="Recruitment"
      description="Applications, interviews, offers, and Recruit appointments."
      actions={canEditApplication ? <Link className="portal-button portal-button--secondary" href="/portal/command/applications/editor">Application Form Editor</Link> : undefined}
    >
      <div className="deputy-summary-grid recruitment-metrics">
        <article><span>New</span><strong>{String(newApplications).padStart(2, "0")}</strong><small>Awaiting review</small></article>
        <article><span>Under review</span><strong>{String(underReview).padStart(2, "0")}</strong><small>Screening</small></article>
        <article><span>Interview</span><strong>{String(interviewsInProgress).padStart(2, "0")}</strong><small>Interview stage</small></article>
        <article><span>Offer stage</span><strong>{String(offerStage).padStart(2, "0")}</strong><small>Issue / signature</small></article>
        <article><span>Ready to appoint</span><strong>{String(readyToAppoint).padStart(2, "0")}</strong><small>Offer accepted</small></article>
        <article><span>Closed</span><strong>{String(closed).padStart(2, "0")}</strong><small>Finalized</small></article>
      </div>

      <ApplicationsDirectory
        reviewers={people.map((person: any) => ({ id: person.id, name: person.display_name }))}
        items={applications.map((item: any) => ({
          id: item.id,
          applicationNumber: item.application_number,
          fullName: item.full_name,
          discord: item.discord_username,
          status: item.status,
          submittedAt: item.submitted_at ?? item.created_at,
          updatedAt: item.updated_at,
          reviewer: names.get(item.reviewer_profile_id) ?? null,
          reviewerId: item.reviewer_profile_id,
          interviewStatus: item.interview_status ?? null,
          offerStatus: offerStatus(item.id),
          closed: item.status === "Archived" || Boolean(item.recruitment_closed_at),
          hired: item.status === "Hired" || Boolean(item.hired_profile_id),
        }))}
      />

      <ApplicationAvailabilityControl
        initialIsOpen={settings?.applications_open === true}
        initialUpdatedAt={settings?.updated_at ?? null}
        initialUpdatedBy={settings?.updated_by_profile_id ? fullNames.get(settings.updated_by_profile_id) ?? null : null}
      />
    </PortalShell>
  );
}
