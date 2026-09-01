import type { Metadata } from "next";
import Link from "next/link";
import { getRecruitmentStatus } from "@/lib/recruitment/status";
import { ApplicationForm } from "./ApplicationForm";
import "./application.css";
import "./application-closed.css";

export const metadata: Metadata = {
  title: "LSCSO Application",
  description: "Apply to join the Los Santos County Sheriff’s Office.",
};

export const revalidate = 0;

export default async function ApplicationPage() {
  const recruitment = await getRecruitmentStatus();

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

  return (
    <main className="application-page">
      <section className="application-page__hero">
        <div className="site-shell">
          <div className="two-column-editorial">
            <div><p className="section-kicker">Careers & Recruitment</p><h1>LSCSO Application</h1></div>
            <div className="reading-column">
              <p className="intro-serif">Tell us who you are, how you roleplay, and why you want to serve with LSCSO.</p>
              <p>Answer every question honestly and thoughtfully. Your application may be reviewed by LSCSO Command and Training & Recruitment personnel.</p>
            </div>
          </div>
          <ApplicationForm />
        </div>
      </section>
    </main>
  );
}
