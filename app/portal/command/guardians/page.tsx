import { GuardianDirectory } from "../../_components/GuardianDirectory";
import { PortalShell } from "../../_components/PortalShell";
import { createClient } from "@/lib/supabase/server";

type GuardianDirectoryPerson = {
  id: string;
  personnel_id: string;
  display_name: string;
};

export default async function GuardianCenterPage() {
  const supabase = await createClient() as any;
  const [{ data: guardians }, { data: personnel }] = await Promise.all([
    supabase.from("guardian_records")
      .select("id,guardian_number,record_type,status,title,subject_profile_id,author_profile_id,created_at,follow_up_due_at")
      .order("created_at", { ascending: false }),
    supabase.from("personnel_profiles").select("id,personnel_id,display_name"),
  ]);

  const names = new Map<string, GuardianDirectoryPerson>(
    ((personnel ?? []) as GuardianDirectoryPerson[]).map((member) => [member.id, member]),
  );

  return (
    <PortalShell
      active="guardians"
      eyebrow="Supervision"
      title="Guardians"
      description="Find, review, and create authorized Guardian records."
    >
      <GuardianDirectory records={(guardians ?? []).map((record:any) => ({
        id: record.id,
        guardianNumber: Number(record.guardian_number),
        recordType: record.record_type,
        status: record.status,
        title: record.title,
        subjectName: names.get(record.subject_profile_id)?.display_name ?? "Restricted personnel",
        subjectPersonnelId: names.get(record.subject_profile_id)?.personnel_id ?? "",
        authorName: names.get(record.author_profile_id)?.display_name ?? "Command",
        createdAt: record.created_at,
        followUpDueAt: record.follow_up_due_at,
      }))} />
    </PortalShell>
  );
}
