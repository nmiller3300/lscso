import { notFound, redirect } from "next/navigation";
import { PersonnelRecordHeader } from "../../../../_components/PersonnelRecordHeader";
import { PortalShell } from "../../../../_components/PortalShell";
import { WelcomeLetterComposer } from "../../../../_components/WelcomeLetterComposer";
import { canAccessPersonnelRecord } from "@/lib/authorization/can-access-personnel-record";
import { createClient } from "@/lib/supabase/server";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";

type PageProps = { params: Promise<{ personnelId: string }> };

export default async function PersonnelDocumentsPage({ params }: PageProps) {
  const profile = await getCurrentPortalProfile();
  if (!profile) redirect("/portal/login");
  const { personnelId } = await params;
  const access = await canAccessPersonnelRecord(profile, personnelId);
  if (!access.allowed) redirect("/portal/command/supervision");

  const supabase = await createClient() as any;
  const { data: member } = await supabase
    .from("personnel_profiles")
    .select("id,personnel_id,display_name,rank,call_sign,division,status")
    .eq("personnel_id", personnelId.toUpperCase())
    .maybeSingle();
  if (!member) notFound();

  const { data: correspondence } = await supabase
    .from("personnel_correspondence")
    .select("id,subject,body,sent_at,author:personnel_profiles!personnel_correspondence_author_profile_id_fkey(display_name,rank)")
    .eq("recipient_profile_id", member.id)
    .is("archived_at", null)
    .order("sent_at", { ascending: false });

  const letters = (correspondence ?? []).map((item: any) => {
    const author = Array.isArray(item.author) ? item.author[0] : item.author;
    return { id: item.id, subject: item.subject, body: item.body, sentAt: item.sent_at, authorName: author?.display_name ?? "Command", authorRank: author?.rank ?? "Command" };
  });

  return (
    <PortalShell active="personnel" eyebrow="Personnel · Documents & letters" title={`${member.display_name} · Documents`} description="Create command correspondence and review material delivered to this personnel file.">
      <PersonnelRecordHeader personnelId={member.personnel_id} displayName={member.display_name} rank={member.rank} callSign={member.call_sign} assignment={member.division} status={member.status} active="documents" />
      <WelcomeLetterComposer profileId={member.id} displayName={member.display_name} letters={letters} canSend={["Executive", "Command"].includes(profile.access_tier)} />
      <section className="portal-panel personnel-vault-note">
        <div className="portal-panel-heading"><div><p>Supporting files</p><h2>Personnel document vault</h2></div><span>Coming next</span></div>
        <p className="personnel-section-intro">Welcome letters are live now. Secure file uploads will appear here after the protected document-storage policy is activated.</p>
      </section>
    </PortalShell>
  );
}
