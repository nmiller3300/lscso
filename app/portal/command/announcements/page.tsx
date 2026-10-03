import { redirect } from "next/navigation";
import { hasStandingDepartmentAuthority, type LscsoRank } from "@/lib/authorization/lscso-authority";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { DiscordAnnouncementComposer } from "../../_components/DiscordAnnouncementComposer";
import { PortalShell } from "../../_components/PortalShell";

export default async function CommandAnnouncementsPage() {
  const profile = await getCurrentPortalProfile();
  if (!profile || !hasStandingDepartmentAuthority(profile.rank as LscsoRank)) {
    redirect("/portal/command/home");
  }

  return (
    <PortalShell
      active="announcements"
      eyebrow="Department · Communications"
      title="Department Announcements"
      description="Publish official LSCSO notices, add an optional image, and retain a permanent Command history."
    >
      <DiscordAnnouncementComposer />
    </PortalShell>
  );
}
