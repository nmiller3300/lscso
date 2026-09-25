import Image from "next/image";
import { applicationLabel, applicationStatusLabel } from "@/lib/recruitment/application";

function currentStage(application: any) {
  const hired = application.status === "Hired" || Boolean(application.hired_profile_id);
  const closed = application.status === "Archived" || Boolean(application.recruitment_closed_at) || ["Denied", "Withdrawn"].includes(application.status);
  if (hired || closed) return 4;
  if (application.interview_status === "Passed") return 3;
  if (application.status === "Accepted" || ["Scheduled", "Completed", "Failed", "No Show"].includes(application.interview_status)) return 2;
  if (["Under Review", "Interview"].includes(application.status) || application.reviewer_profile_id) return 1;
  return 0;
}

export function ForensicsSpecialistCaseHeader({ application }: { application: any }) {
  const stage = currentStage(application);
  const hired = application.status === "Hired" || Boolean(application.hired_profile_id);
  const closed = application.status === "Archived" || Boolean(application.recruitment_closed_at) || ["Denied", "Withdrawn"].includes(application.status);
  const stages = [
    ["01", "Intake", "Specialist candidate packet received"],
    ["02", "Review", "Command screening & application decision"],
    ["03", "Interview", "Forensic Services interview & result"],
    ["04", "Appointment", "Forensics Specialist personnel appointment"],
    ["05", "Record", "Final candidate and personnel record"],
  ];

  const checks = [
    ["Applicant identity", Boolean(application.full_name && application.discord_username), "Name and Discord contact recorded"],
    ["Electronic signature", Boolean(application.applicant_signature_name && application.applicant_signed_at), "Signed candidate certification retained"],
    ["AI policy acknowledgement", Boolean(application.ai_policy_acknowledged), "Applicant acknowledgement retained"],
    ["Private applicant access", Boolean(application.applicant_tracking_token_hash), "Private tracking credential issued"],
  ] as const;
  const checksReady = checks.filter(([, ready]) => ready).length;
  const status = hired ? "Forensics Specialist appointment complete" : closed ? "Final disposition" : applicationStatusLabel(application.status);

  return (
    <section className={`recruitment-case ${closed ? "is-closed" : ""} ${hired ? "is-hired" : ""}`}>
      <div className="recruitment-case__glow" aria-hidden="true" />
      <header className="recruitment-case__masthead">
        <div className="recruitment-case__identity">
          <Image src="/images/lscso-patch-color.png" alt="" aria-hidden="true" width={84} height={84} priority />
          <div><p>LSCSO Forensic Services Candidate Case</p><h2>{application.full_name}</h2><span>{applicationLabel(application.application_number)} · {status}</span></div>
        </div>
        <div className="recruitment-case__classification">
          <span>{hired ? "Completed specialist appointment" : closed ? "Closed specialist candidate record" : "Active Forensics candidate record"}</span>
          <strong>{applicationLabel(application.application_number)}</strong>
          <small>{application.reviewer_profile_id ? "Command reviewer assigned" : "Reviewer assignment pending"}</small>
        </div>
      </header>

      <div className="recruitment-case__rail" aria-label="Forensics Specialist candidate stages">
        {stages.map(([number, title, description], index) => {
          const complete = hired ? index < 4 : closed ? index < stage : index < stage;
          const current = index === stage;
          return <article key={number} className={`${complete ? "is-complete" : ""} ${current ? "is-current" : ""}`}><div className="recruitment-case__node"><span>{complete ? "✓" : number}</span></div><div><strong>{title}</strong><small>{description}</small></div></article>;
        })}
      </div>

      <div className="recruitment-case__screening">
        <div className="recruitment-case__screening-heading"><div><span>Objective intake screening</span><h3>System integrity checks</h3></div><strong>{checksReady} / {checks.length} clear</strong></div>
        <p className="recruitment-case__screening-copy">These checks confirm record completeness only. Command makes the actual selection decision based on the candidate record and interview.</p>
        <div className="recruitment-case__checks">
          {checks.map(([label, ready, detail]) => <article key={label} className={ready ? "is-ready" : "is-attention"}><span aria-hidden="true">{ready ? "✓" : "!"}</span><div><strong>{label}</strong><small>{ready ? detail : `${label} needs review`}</small></div></article>)}
        </div>
      </div>
    </section>
  );
}
