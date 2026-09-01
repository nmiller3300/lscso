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
  const [applicationsResult, peopleResult, settingsResult] = await Promise.all([
    supabase.from("recruitment_applications").select("id,application_number,full_name,discord_username,status,submitted_at,created_at,updated_at,reviewer_profile_id").order("submitted_at", { ascending: false }).limit(250),
    supabase.from("personnel_profiles").select("id,display_name,rank,access_tier,status").in("access_tier", ["Executive", "Command"]).in("status", ["Active", "Acting"]).order("display_name"),
    supabase.from("recruitment_settings").select("applications_open,updated_at,updated_by_profile_id").eq("id", "applications").maybeSingle(),
  ]);

  const applications = applicationsResult.data ?? [];
  const people = peopleResult.data ?? [];
  const names = new Map(people.map((person: any) => [person.id, person.display_name]));
  const fullNames = new Map<string, string>(people.map((person: any): [string, string] => [person.id, `${person.rank} ${person.display_name}`]));
  const settings = settingsResult.data;
  const counts = (status: string) => applications.filter((item: any) => item.status === status).length;

  return (
    <PortalShell active="applications" eyebrow="Personnel · Recruitment" title="Recruitment Applications" description="Control public application availability, review applicants, manage recruitment workflow, and make documented hiring decisions.">
      <ApplicationAvailabilityControl
        initialIsOpen={settings?.applications_open === true}
        initialUpdatedAt={settings?.updated_at ?? null}
        initialUpdatedBy={settings?.updated_by_profile_id ? fullNames.get(settings.updated_by_profile_id) ?? null : null}
      />

      <div className="deputy-summary-grid recruitment-metrics">
        <article><span>New applications</span><strong>{String(counts("Submitted")).padStart(2, "0")}</strong><small>Awaiting initial review</small></article>
        <article><span>Under review</span><strong>{String(counts("Under Review")).padStart(2, "0")}</strong><small>Active review queue</small></article>
        <article><span>Interviews</span><strong>{String(counts("Interview")).padStart(2, "0")}</strong><small>Interview-stage applicants</small></article>
        <article><span>Accepted</span><strong>{String(counts("Accepted")).padStart(2, "0")}</strong><small>Recorded decisions</small></article>
        <article><span>Denied</span><strong>{String(counts("Denied")).padStart(2, "0")}</strong><small>Recorded decisions</small></article>
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
        }))}
      />
    </PortalShell>
  );
}
