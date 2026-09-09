import type { Metadata } from "next";
import Link from "next/link";
import { getRecruitmentStatus } from "@/lib/recruitment/status";
import { getRecruitmentApplicationQuestions } from "@/lib/recruitment/questions.server";
import { ApplicationForm } from "./ApplicationForm";
import "./application.css";
import "./application-closed.css";

export const metadata: Metadata = {
  title: "LSCSO Deputy Application",
  description: "Apply to join the Los Santos County Sheriff’s Office and begin the deputy candidate selection process.",
};

export const revalidate = 0;

export default async function ApplicationPage() {
  const [recruitment, questions] = await Promise.all([
    getRecruitmentStatus(),
    getRecruitmentApplicationQuestions(false),
  ]);

  if (!recruitment.isOpen) {
    return (
      <main className="application-page">
        <section className="application-page__hero application-page__hero--closed">
          <div className="site-shell application-closed">
            <p className="section-kicker">Careers & Recruitment</p>
            <span className="application-closed__status"><i /> Applications closed</span>
            <h1>Applications are not being accepted.</h1>
            <p className="intro-serif">LSCSO recruitment is currently closed. The application form and submission system will remain unavailable until Command reopens recruitment.</p>
            <p>You can still review the Office’s expectations, recruitment process, and Patrol Division responsibilities before the next application period.</p>
            <div className="button-row">
              <Link className="button" href="/join">Return to Join LSCSO</Link>
              <Link className="button button--outline" href="/patrol">Explore Patrol Division</Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const sectionCount = new Set(questions.map((question) => question.sectionTitle)).size + 1;

  return (
    <main className="application-page">
      <section className="application-page__hero">
        <div className="site-shell">
          <div className="application-page__masthead">
            <div>
              <p className="section-kicker">Careers & Recruitment</p>
              <span className="application-page__badge">Deputy Candidate Selection</span>
              <h1>Earn your place in the Sheriff&apos;s Office.</h1>
              <p className="intro-serif">This is your formal candidate packet for the Los Santos County Sheriff&apos;s Office. Take your time, answer in your own words, and give Command a clear picture of your judgment, integrity, and roleplay standards.</p>
              <div className="application-page__metrics" aria-label="Application overview">
                <article><strong>{String(questions.length).padStart(2, "0")}</strong><span>Application Questions</span></article>
                <article><strong>{String(sectionCount).padStart(2, "0")}</strong><span>Guided Sections</span></article>
                <article><strong>01</strong><span>Required Interview</span></article>
              </div>
            </div>
            <aside className="application-page__seal" aria-label="Official recruitment packet">
              <img src="/images/lscso-portal-patch.webp" alt="Los Santos County Sheriff's Office patch" />
              <div><span>Official Candidate Packet</span><strong>Los Santos County Sheriff&apos;s Office</strong><small>Patrol Division · Recruit Selection Process</small></div>
            </aside>
          </div>

          <div className="application-process-strip" aria-label="Recruitment process">
            <article><span>Step 01</span><strong>Submit Application</strong><small>Complete and electronically sign your candidate packet.</small></article>
            <article><span>Step 02</span><strong>Command Review</strong><small>Captain+ staff screen the application and record a decision.</small></article>
            <article><span>Step 03</span><strong>Interview</strong><small>Accepted applicants are contacted on Discord to schedule an interview.</small></article>
            <article><span>Step 04</span><strong>Recruit Onboarding</strong><small>A passed interview clears the applicant for the hiring handoff.</small></article>
          </div>

          {questions.length ? <ApplicationForm questions={questions} /> : (
            <section className="application-success"><p className="application-success__eyebrow">Recruitment configuration</p><h2>The application is temporarily unavailable.</h2><p className="application-success__lead">Command has not published an active application form. Please check back later.</p></section>
          )}
        </div>
      </section>
    </main>
  );
}
