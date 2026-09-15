import Image from "next/image";
import { applicationLabel, applicationStatusLabel } from "@/lib/recruitment/application";

type Check = {
  label: string;
  detail: string;
  ready: boolean;
};

function currentStage(application: any, offer: any) {
  const hired = application.status === "Hired" || Boolean(application.hired_profile_id);
  const closed = application.status === "Archived" || Boolean(application.recruitment_closed_at) || ["Denied", "Withdrawn"].includes(application.status);
  if (hired) return 4;
  if (closed) return 5;
  if (offer?.status === "Accepted") return 4;
  if (offer || application.interview_status === "Passed") return 3;
  if (application.status === "Accepted" || ["Scheduled", "Completed", "Failed", "No Show"].includes(application.interview_status)) return 2;
  if (["Under Review", "Interview"].includes(application.status) || application.reviewer_profile_id) return 1;
  return 0;
}

export function RecruitmentCaseHeader({ application, latestOffer }: { application: any; latestOffer: any }) {
  const stage = currentStage(application, latestOffer);
  const hired = application.status === "Hired" || Boolean(application.hired_profile_id);
  const closed = stage === 5;
  const stages = [
    ["01", "Intake", "Candidate packet received"],
    ["02", "Review", "Command screening & decision"],
    ["03", "Interview", "Scheduling, panel & result"],
    ["04", "Offer", "Employment offer & signature"],
    ["05", "Appointment", "Recruit hiring handoff"],
    ["06", "Disposition", "Final closed-case record"],
  ];

  const checks: Check[] = [
    {
      label: "Applicant identity",
      detail: application.full_name && application.discord_username ? "Name and Discord contact recorded" : "Identity/contact information needs review",
      ready: Boolean(application.full_name && application.discord_username),
    },
    {
      label: "Electronic signature",
      detail: application.applicant_signature_name && application.applicant_signed_at ? "Signed candidate certification retained" : "Signature record is incomplete",
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
  const status = hired ? "Recruit appointment complete" : closed ? "Final disposition" : applicationStatusLabel(application.status);

  return (
    <section className={`recruitment-case ${closed ? "is-closed" : ""} ${hired ? "is-hired" : ""}`}>
      <div className="recruitment-case__glow" aria-hidden="true" />
      <header className="recruitment-case__masthead">
        <div className="recruitment-case__identity">
          <Image src="/images/lscso-patch-color.png" alt="" aria-hidden="true" width={84} height={84} priority />
          <div>
            <p>LSCSO Recruitment Case</p>
            <h2>{application.full_name}</h2>
            <span>{applicationLabel(application.application_number)} · {status}</span>
          </div>
        </div>
        <div className="recruitment-case__classification">
          <span>{hired ? "Completed recruitment record" : closed ? "Closed candidate record" : "Active candidate record"}</span>
          <strong>{applicationLabel(application.application_number)}</strong>
          <small>{application.reviewer_profile_id ? "Command reviewer assigned" : "Reviewer assignment pending"}</small>
        </div>
      </header>

      <div className="recruitment-case__rail" aria-label="Recruitment case stages">
        {stages.map(([number, title, description], index) => {
          const complete = hired ? index <= 4 : closed ? index < 5 : index < stage;
          const current = index === stage;
          return (
            <article key={number} className={`${complete ? "is-complete" : ""} ${current ? "is-current" : ""}`}>
              <div className="recruitment-case__node"><span>{complete && !current ? "✓" : number}</span></div>
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
        <p className="recruitment-case__screening-copy">These are record-completeness checks only. They do not score writing quality, judgment, character, or applicant suitability. Those decisions remain with Command.</p>
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
