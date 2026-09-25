import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CinematicOrb } from "../../_components/CinematicOrb";
import { PortalResponsiveCinematicBackdrop } from "../../portal/_components/PortalResponsiveCinematicBackdrop";
import { getRecruitmentStatus } from "@/lib/recruitment/status";
import { getRecruitmentApplicationQuestions } from "@/lib/recruitment/questions.server";
import { ApplicationForm } from "./ApplicationForm";
import { DepartmentAttorneyApplicationForm } from "./DepartmentAttorneyApplicationForm";
import { ForensicsSpecialistApplicationForm } from "./ForensicsSpecialistApplicationForm";
import "../../portal/portal-glow-login.css";
import "../../portal/portal-glow-login-polish.css";
import "../../portal/portal-login-responsive-cinematic.css";
import "./application.css";
import "./application-dynamic.css";
import "./application-closed.css";
import "./application-premium.css";
import "./application-role.css";
import "./candidate-experience.css";
import "./candidate-portal-bridge.css";

export const metadata: Metadata = {
  title: "LSCSO Candidate Intake",
  description: "Begin a Sworn Personnel, Forensics Specialist, or Department Attorney candidate record with the Los Santos County Sheriff’s Office.",
};

export const revalidate = 0;

type RoleKey = "sworn" | "forensics" | "attorney";

function RoleSelection({ swornOpen, forensicsOpen, attorneyOpen, selectedClosed }: { swornOpen: boolean; forensicsOpen: boolean; attorneyOpen: boolean; selectedClosed?: string | null }) {
  return (
    <section className="application-role-select candidate-role-select" aria-labelledby="application-role-heading">
      <div className="application-role-select__heading">
        <p>Candidate pathway</p>
        <h2 id="application-role-heading">Choose the record you intend to build.</h2>
        <span>Your selection determines the questions, review path, interview process, and appointment workflow used for this candidate record.</span>
      </div>
      <div className="application-role-select__grid">
        <Link className={`application-role-card application-role-card--sworn ${swornOpen ? "" : "is-closed"}`} href="/join/application?role=sworn" aria-disabled={!swornOpen}>
          <div className="application-role-card__top"><span>01 / SWORN</span><span className="application-role-card__status">{swornOpen ? "Intake Open" : "Intake Closed"}</span></div>
          <div className="application-role-card__mark" aria-hidden="true">S</div>
          <div><small>Operational Service</small><h3>Sworn Personnel</h3><p>Build a Deputy candidate record for Command review, interview, employment offer, appointment, and field development.</p></div>
          <strong>{swornOpen ? "Enter Sworn candidate intake →" : "Candidate intake unavailable"}</strong>
        </Link>
        <Link className={`application-role-card application-role-card--forensics ${forensicsOpen ? "" : "is-closed"}`} href="/join/application?role=forensics" aria-disabled={!forensicsOpen}>
          <div className="application-role-card__top"><span>02 / FORENSICS</span><span className="application-role-card__status">{forensicsOpen ? "Intake Open" : "Intake Closed"}</span></div>
          <div className="application-role-card__mark" aria-hidden="true">F</div>
          <div><small>Forensic Services</small><h3>Forensics Specialist</h3><p>Build a specialist candidate record focused on evidence integrity, scene processing, technical judgment, and investigative support.</p></div>
          <strong>{forensicsOpen ? "Enter Forensics candidate intake →" : "Candidate intake unavailable"}</strong>
        </Link>
        <Link className={`application-role-card application-role-card--attorney ${attorneyOpen ? "" : "is-closed"}`} href="/join/application?role=attorney" aria-disabled={!attorneyOpen}>
          <div className="application-role-card__top"><span>03 / COUNSEL</span><span className="application-role-card__status">{attorneyOpen ? "Intake Open" : "Intake Closed"}</span></div>
          <div className="application-role-card__mark" aria-hidden="true">A</div>
          <div><small>Department Counsel</small><h3>Department Attorney</h3><p>Build a legal-counsel candidate record for Command screening, interview, selection decision, and final appointment.</p></div>
          <strong>{attorneyOpen ? "Enter Attorney candidate intake →" : "Candidate intake unavailable"}</strong>
        </Link>
      </div>
      {selectedClosed ? <div className="application-role-select__notice">{selectedClosed} candidate intake is currently closed. Choose another open pathway or return when Command reopens the track.</div> : null}
    </section>
  );
}

function CandidateIntakeOrb({ selectedTrack }: { selectedTrack: string | null }) {
  return (
    <aside className="candidate-intake-orb-shell" aria-label="Official LSCSO candidate record">
      <CinematicOrb className="portal-glow-login__card candidate-intake-orb" contentClassName="portal-glow-login__content candidate-intake-orb__content">
        <div className="candidate-intake-orb__status"><i /> Intake authenticated</div>
        <div className="portal-glow-login__mark candidate-intake-orb__mark"><Image src="/images/lscso-patch-color.png" alt="Los Santos County Sheriff’s Office patch" width={76} height={76} priority /></div>
        <header className="portal-glow-login__heading candidate-intake-orb__heading"><span>Los Santos County Sheriff&apos;s Office</span><h2>Candidate Selection</h2><p>{selectedTrack ?? "Choose a pathway to begin your candidate record."}</p></header>
        <div className="candidate-intake-orb__trust" aria-label="Candidate record protections"><span>Secure submission</span><span>Private tracking</span></div>
      </CinematicOrb>
    </aside>
  );
}

export default async function ApplicationPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const params = await searchParams;
  const requestedRole: RoleKey | null = params.role === "sworn" ? "sworn" : params.role === "forensics" ? "forensics" : params.role === "attorney" ? "attorney" : null;
  const recruitment = await getRecruitmentStatus();

  if (!recruitment.isOpen) {
    return (
      <main className="application-page candidate-intake-page">
        <section className="application-page__hero application-page__hero--closed candidate-intake-hero">
          <PortalResponsiveCinematicBackdrop />
          <div className="candidate-intake-ambient" aria-hidden="true"><span /><span /><span /></div>
          <Image className="candidate-intake-watermark" src="/images/lscso-patch-color.png" alt="" width={760} height={760} aria-hidden="true" priority />
          <div className="site-shell application-closed candidate-intake-closed">
            <p className="section-kicker">LSCSO Candidate Selection</p>
            <span className="application-closed__status"><i /> Candidate intake standby</span>
            <h1>No candidate records are being accepted right now.</h1>
            <p className="intro-serif">The selection system remains available for information, but Command has paused new Sworn Personnel, Forensics Specialist, and Department Attorney submissions.</p>
            <div className="button-row"><Link className="button" href="/join">Return to Join LSCSO</Link><Link className="button button--outline" href="/training-recruitment">Training & Recruitment</Link></div>
          </div>
        </section>
      </main>
    );
  }

  const selectedTrack = requestedRole === "attorney" ? "Department Attorney" : requestedRole === "forensics" ? "Forensics Specialist" : requestedRole === "sworn" ? "Sworn Personnel" : null;
  const selectedOpen = requestedRole === "attorney"
    ? recruitment.departmentAttorneyApplicationsOpen
    : requestedRole === "forensics"
      ? recruitment.forensicsSpecialistApplicationsOpen
      : requestedRole === "sworn"
        ? recruitment.swornApplicationsOpen
        : false;

  const questions = selectedTrack && selectedOpen ? await getRecruitmentApplicationQuestions(false, selectedTrack) : [];
  const sectionCount = new Set(questions.map((question) => question.sectionTitle)).size + 1;
  const trackCode = selectedTrack === "Department Attorney" ? "COUNSEL" : selectedTrack === "Forensics Specialist" ? "FORENSICS" : selectedTrack === "Sworn Personnel" ? "SWORN" : "SELECT";

  const process = selectedTrack === "Department Attorney"
    ? [["01", "Candidate Record", "Complete and sign the Department Attorney candidate packet."],["02", "Command Review", "Command screens the complete legal-counsel record."],["03", "Interview", "Selected candidates advance to a scheduled Department Attorney interview."],["04", "Decision", "Command records the interview selection decision."],["05", "Appointment", "A selected candidate receives final personnel appointment and onboarding."]]
    : selectedTrack === "Forensics Specialist"
      ? [["01", "Candidate Record", "Complete and sign the Forensics Specialist candidate packet."],["02", "Command Review", "Command screens the complete specialist record."],["03", "Interview", "Selected candidates advance to the required Forensic Services interview."],["04", "Selection", "Command records the interview selection decision."],["05", "Appointment", "A selected candidate receives a Forensics Specialist personnel appointment and portal onboarding."]]
      : [["01", "Candidate Record", "Complete and sign the Sworn Personnel candidate packet."],["02", "Command Review", "Command screens the complete written application."],["03", "Interview", "Selected candidates advance to the required LSCSO interview."],["04", "Employment Offer", "A passed interview may advance to a formal offer."],["05", "Appointment", "Command records the personnel appointment and onboarding begins."]];

  return (
    <main className={`application-page candidate-intake-page candidate-intake-page--${requestedRole ?? "select"}`}>
      <section className="application-page__hero candidate-intake-hero">
        <PortalResponsiveCinematicBackdrop />
        <div className="candidate-intake-ambient" aria-hidden="true"><span /><span /><span /></div>
        <Image className="candidate-intake-watermark" src="/images/lscso-patch-color.png" alt="" width={840} height={840} aria-hidden="true" priority />
        <div className="site-shell">
          <div className="application-page__masthead candidate-intake-masthead">
            <div className="candidate-intake-masthead__copy">
              <div className="candidate-intake-signal"><i /> LSCSO Candidate Intake / {trackCode}</div>
              <p className="section-kicker">Careers & Recruitment</p><span className="application-page__badge">Private Candidate Record</span>
              <h1>{selectedTrack ? `Build your ${selectedTrack} candidate record.` : "Choose the record you want to put your name on."}</h1>
              <p className="intro-serif">{selectedTrack ? "This is not a quick signup. It is the first permanent record in your LSCSO selection process — take your time, answer in your own words, and make the record worth reading." : "Select the role you actually intend to serve in. Each pathway has its own questions, interview process, and final appointment logic."}</p>
              <div className="application-page__metrics" aria-label="Candidate intake overview"><article><strong>{selectedTrack ? trackCode : "03"}</strong><span>{selectedTrack ? "Candidate Track" : "Career Tracks"}</span></article><article><strong>{selectedTrack ? String(questions.length).padStart(2, "0") : "—"}</strong><span>Record Questions</span></article><article><strong>{selectedTrack ? String(sectionCount).padStart(2, "0") : "—"}</strong><span>Guided Sections</span></article></div>
            </div>
            <CandidateIntakeOrb selectedTrack={selectedTrack} />
          </div>

          {!selectedTrack || !selectedOpen ? (
            <RoleSelection swornOpen={recruitment.swornApplicationsOpen} forensicsOpen={recruitment.forensicsSpecialistApplicationsOpen} attorneyOpen={recruitment.departmentAttorneyApplicationsOpen} selectedClosed={selectedTrack && !selectedOpen ? selectedTrack : null} />
          ) : (
            <>
              <div className="application-process-strip candidate-process-strip" aria-label={`${selectedTrack} selection process`}>{process.map(([number, title, description]) => <article key={number}><span>{number}</span><strong>{title}</strong><small>{description}</small></article>)}</div>
              <div className="candidate-intake-switch"><Link href="/join/application">← Change candidate pathway</Link><span>{selectedTrack} / candidate record</span></div>
              {questions.length ? (
                selectedTrack === "Department Attorney" ? <DepartmentAttorneyApplicationForm questions={questions} /> : selectedTrack === "Forensics Specialist" ? <ForensicsSpecialistApplicationForm questions={questions} /> : <ApplicationForm questions={questions} />
              ) : <section className="application-success"><p className="application-success__eyebrow">Candidate intake configuration</p><h2>This pathway is temporarily unavailable.</h2><p className="application-success__lead">Command has not published an active candidate packet for this role. Please check back later.</p></section>}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
