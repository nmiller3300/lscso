import Image from "next/image";
import { applicationLabel, applicationStatusLabel } from "@/lib/recruitment/application";

type Check = {
  label: string;
  detail: string;
  ready: boolean;
};

function currentStage(application: any) {
  if (application.status === "Archived" || application.recruitment_closed_at || ["Denied", "Withdrawn"].includes(application.status)) return 3;
  if (application.status === "Accepted") return 2;
  if (application.status === "Under Review" || application.reviewer_profile_id) return 1;
  return 0;
}

export function DepartmentAttorneyCaseHeader({ application }: { application: any }) {
  const stage = currentStage(application);
  const closed = stage === 3;
  const selected = application.status === "Accepted" && !closed;
  const stages = [
    ["01", "Intake", "Department Attorney packet received"],
    ["02", "Review", "Command legal-counsel screening"],
    ["03", "Selection", "Acceptance or documented denial"],
    ["04", "Disposition", "Appointment follow-up or closed record"],
  ];

  const checks: Check[] = [
    {
      label: "Applicant identity",
      detail: application.full_name && application.discord_username ? "Name and Discord contact recorded" : "Identity/contact information needs review",
      ready: Boolean(application.full_name && application.discord_username),
    },
    {
      label: "Electronic signature",
      detail: application.applicant_signature_name && application.applicant_signed_at ? "Signed applicant certification retained" : "Signature record is incomplete",
      ready: Boolean(application.applicant_signature_name && application.applicant_signed_at),
    },
    {
      label: "AI policy acknowledgement",
      detail: application.ai_policy_acknowledged ? "Applicant acknowledgement retained" : "Acknowledgement not recorded",
      ready: Boolean(application.ai_policy_acknowledged),
    },
    {
      label: "Private applicant access",
      detail: application.applicant_tracking_token_hash ? "Private tracking credential issued" : "Tracking credential is not present",
      ready: Boolean(application.applicant_tracking_token_hash),
    },
  ];

  const checksReady = checks.filter((item) => item.ready).length;
  const status = closed ? "Final disposition" : selected ? "Department Attorney selected" : applicationStatusLabel(application.status);

  return (
    <section className={`recruitment-case ${closed ? "is-closed" : ""} ${selected ? "is-hired" : ""}`}>
      <div className="recruitment-case__glow" aria-hidden="true" />
      <header className="recruitment-case__masthead">
        <div className="recruitment-case__identity">
          <Image src="/images/lscso-patch-color.png" alt="" aria-hidden="true" width={84} height={84} priority />
          <div>
            <p>LSCSO Department Attorney Case</p>
            <h2>{application.full_name}</h2>
            <span>{applicationLabel(application.application_number)} · {status}</span>
          </div>
        </div>
        <div className="recruitment-case__classification">
          <span>{closed ? "Closed legal-counsel candidate record" : selected ? "Selected legal-counsel candidate" : "Active legal-counsel candidate"}</span>
          <strong>{applicationLabel(application.application_number)}</strong>
          <small>{application.reviewer_profile_id ? "Command reviewer assigned" : "Reviewer assignment pending"}</small>
        </div>
      </header>

      <div className="recruitment-case__rail" aria-label="Department Attorney application stages">
        {stages.map(([number, title, description], index) => {
          const complete = closed ? index < 3 : index < stage;
          const current = index === stage;
          return (
            <article key={number} className={`${complete ? "is-complete" : ""} ${current ? "is-current" : ""}`}>
              <div className="recruitment-case__node"><span>{complete ? "✓" : number}</span></div>
              <div><strong>{title}</strong><small>{description}</small></div>
            </article>
          );
        })}
      </div>

      <div className="recruitment-case__screening">
        <div className="recruitment-case__screening-heading">
          <div><span>Objective intake screening</span><h3>System integrity checks</h3></div>
          <strong>{checksReady} / {checks.length} clear</strong>
        </div>
        <p className="recruitment-case__screening-copy">These checks confirm the application record is complete. Legal judgment, ethics, writing, and suitability remain Command decisions.</p>
        <div className="recruitment-case__checks">
          {checks.map((check) => (
            <article key={check.label} className={check.ready ? "is-ready" : "is-attention"}>
              <span aria-hidden="true">{check.ready ? "✓" : "!"}</span>
              <div><strong>{check.label}</strong><small>{check.detail}</small></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
