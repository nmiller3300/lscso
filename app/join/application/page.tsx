import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getRecruitmentStatus } from "@/lib/recruitment/status";
import { getRecruitmentApplicationQuestions } from "@/lib/recruitment/questions.server";
import { ApplicationForm } from "./ApplicationForm";
import { DepartmentAttorneyApplicationForm } from "./DepartmentAttorneyApplicationForm";
import "./application.css";
import "./application-dynamic.css";
import "./application-closed.css";
import "./application-premium.css";
import "./application-role.css";

export const metadata: Metadata = {
  title: "LSCSO Career Application",
  description: "Apply for sworn service or Department Attorney with the Los Santos County Sheriff’s Office.",
};

export const revalidate = 0;

type RoleKey = "sworn" | "attorney";

function RoleSelection({ swornOpen, attorneyOpen, selectedClosed }: { swornOpen: boolean; attorneyOpen: boolean; selectedClosed?: string | null }) {
  return (
    <section className="application-role-select" aria-labelledby="application-role-heading">
      <div className="application-role-select__heading">
        <p>Career track</p>
        <h2 id="application-role-heading">What role are you applying for?</h2>
        <span>Select the position you want to pursue. Each role has its own application packet and can be opened or closed independently by Command.</span>
      </div>
      <div className="application-role-select__grid">
        <Link className={`application-role-card ${swornOpen ? "" : "is-closed"}`} href="/join/application?role=sworn" aria-disabled={!swornOpen}>
          <div className="application-role-card__top"><span>01</span><span className="application-role-card__status">{swornOpen ? "Open" : "Closed"}</span></div>
          <h3>Sworn Personnel</h3>
          <p>Apply for sworn service through the Deputy candidate selection, interview, offer, and appointment process.</p>
          <strong>{swornOpen ? "Open Sworn application →" : "Applications closed"}</strong>
        </Link>
        <Link className={`application-role-card ${attorneyOpen ? "" : "is-closed"}`} href="/join/application?role=attorney" aria-disabled={!attorneyOpen}>
          <div className="application-role-card__top"><span>02</span><span className="application-role-card__status">{attorneyOpen ? "Open" : "Closed"}</span></div>
          <h3>Department Attorney</h3>
          <p>Apply to provide legal counsel, policy review, records guidance, and legal support to the Sheriff&apos;s Office.</p>
          <strong>{attorneyOpen ? "Open Attorney application →" : "Applications closed"}</strong>
        </Link>
      </div>
      {selectedClosed ? <div className="application-role-select__notice">{selectedClosed} applications are currently closed. Choose another open role or check back later.</div> : null}
    </section>
  );
}

export default async function ApplicationPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const params = await searchParams;
  const requestedRole: RoleKey | null = params.role === "sworn" ? "sworn" : params.role === "attorney" ? "attorney" : null;
  const recruitment = await getRecruitmentStatus();

  if (!recruitment.isOpen) {
    return (
      <main className="application-page">
        <section className="application-page__hero application-page__hero--closed">
          <div className="site-shell application-closed">
            <p className="section-kicker">Careers & Recruitment</p>
            <span className="application-closed__status"><i /> Applications closed</span>
            <h1>Applications are not being accepted.</h1>
            <p className="intro-serif">LSCSO is not currently accepting applications for Sworn Personnel or Department Attorney.</p>
            <p>You can still review the Office, its standards, and available divisions before the next application period.</p>
            <div className="button-row">
              <Link className="button" href="/join">Return to Join LSCSO</Link>
              <Link className="button button--outline" href="/about">About the Office</Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const selectedTrack = requestedRole === "attorney" ? "Department Attorney" : requestedRole === "sworn" ? "Sworn Personnel" : null;
  const selectedOpen = requestedRole === "attorney"
    ? recruitment.departmentAttorneyApplicationsOpen
    : requestedRole === "sworn"
      ? recruitment.swornApplicationsOpen
      : false;

  const questions = selectedTrack && selectedOpen
    ? await getRecruitmentApplicationQuestions(false, selectedTrack)
    : [];
  const sectionCount = new Set(questions.map((question) => question.sectionTitle)).size + 1;

  return (
    <main className="application-page">
      <section className="application-page__hero">
        <div className="site-shell">
          <div className="application-page__masthead">
            <div>
              <p className="section-kicker">Careers & Recruitment</p>
              <span className="application-page__badge">Career Candidate Selection</span>
              <h1>Apply to serve the Sheriff&apos;s Office.</h1>
              <p className="intro-serif">Choose the role you are seeking, complete the correct candidate packet in your own words, and give Command a clear picture of your judgment, integrity, experience, and professional standards.</p>
              <div className="application-page__metrics" aria-label="Application overview">
                <article><strong>02</strong><span>Career Tracks</span></article>
                <article><strong>{selectedTrack ? String(questions.length).padStart(2, "0") : "—"}</strong><span>Application Questions</span></article>
                <article><strong>{selectedTrack ? String(sectionCount).padStart(2, "0") : "—"}</strong><span>Guided Sections</span></article>
              </div>
            </div>
            <aside className="application-page__seal" aria-label="Official recruitment packet">
              <Image src="/images/lscso-patch-color.png" alt="Los Santos County Sheriff's Office patch" width={180} height={180} priority />
              <div><span>Official Candidate Packet</span><strong>Los Santos County Sheriff&apos;s Office</strong><small>{selectedTrack ?? "Select a career track below"}</small></div>
            </aside>
          </div>

          {!selectedTrack || !selectedOpen ? (
            <RoleSelection
              swornOpen={recruitment.swornApplicationsOpen}
              attorneyOpen={recruitment.departmentAttorneyApplicationsOpen}
              selectedClosed={selectedTrack && !selectedOpen ? selectedTrack : null}
            />
          ) : (
            <>
              <div className="application-process-strip" aria-label="Selection process">
                <article><span>Step 01</span><strong>Submit Application</strong><small>Complete and electronically sign the correct candidate packet.</small></article>
                <article><span>Step 02</span><strong>Command Review</strong><small>Authorized Command staff review the full submission.</small></article>
                <article><span>Step 03</span><strong>Decision</strong><small>Command records a documented acceptance or denial.</small></article>
                <article><span>Step 04</span><strong>Next Stage</strong><small>{selectedTrack === "Department Attorney" ? "Selected Attorney candidates receive appointment and onboarding follow-up." : "Accepted sworn candidates continue through interview, offer, and appointment."}</small></article>
              </div>
              <div className="button-row" style={{ marginBlock: "18px" }}><Link className="button button--outline" href="/join/application">Change Role</Link></div>
              {questions.length ? (
                selectedTrack === "Department Attorney"
                  ? <DepartmentAttorneyApplicationForm questions={questions} />
                  : <ApplicationForm questions={questions} />
              ) : (
                <section className="application-success"><p className="application-success__eyebrow">Recruitment configuration</p><h2>This application is temporarily unavailable.</h2><p className="application-success__lead">Command has not published an active form for this role. Please check back later.</p></section>
              )}
            </>
          )}
        </div>
      </section>
    </main>
  );
}
