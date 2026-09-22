import Link from "next/link";
import { redirect } from "next/navigation";
import { PortalShell } from "../../../_components/PortalShell";
import { hasHiringAuthority } from "@/lib/authorization/hiring-authority";
import { getCurrentPortalProfile } from "@/lib/supabase/portal-profile";
import { getRecruitmentApplicationQuestions } from "@/lib/recruitment/questions.server";
import { ApplicationEditor } from "./ApplicationEditor";

export default async function RecruitmentApplicationEditorPage() {
  const profile = await getCurrentPortalProfile();
  if (!profile || !(await hasHiringAuthority(profile))) redirect("/portal/command/applications");

  const questions = await getRecruitmentApplicationQuestions(true);

  return (
    <PortalShell
      active="applications"
      eyebrow="Personnel · Recruitment · Administration"
      title="Application Editor"
      description="Build and maintain the public Deputy candidate application without changing code. Changes affect future submissions only; submitted applications retain the exact questions they answered."
    >
      <div className="portal-page-actions"><Link href="/portal/command/applications" className="portal-button">Back to applications</Link></div>
      <ApplicationEditor initialQuestions={questions} />
    </PortalShell>
  );
}
