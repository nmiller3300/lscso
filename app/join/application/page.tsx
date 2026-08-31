import type { Metadata } from "next";
import { ApplicationForm } from "./ApplicationForm";
import "./application.css";

export const metadata: Metadata = { title: "LSCSO Application", description: "Apply to join the Los Santos County Sheriff’s Office." };

export default function ApplicationPage() {
  return <main className="application-page"><section className="application-page__hero"><div className="site-shell"><div className="two-column-editorial"><div><p className="section-kicker">Careers & Recruitment</p><h1>LSCSO Application</h1></div><div className="reading-column"><p className="intro-serif">Tell us who you are, how you roleplay, and why you want to serve with LSCSO.</p><p>Answer every question honestly and thoughtfully. Your application may be reviewed by LSCSO Command and Training & Recruitment personnel.</p></div></div><ApplicationForm /></div></section></main>;
}
