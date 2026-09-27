import type { Metadata } from "next";
import Image from "next/image";
import { PageHero } from "../_components/PageHero";
import { RouteLink } from "../_components/RouteLink";
import { createClient } from "@/lib/supabase/server";
import "./office-of-the-sheriff.css";

export const metadata: Metadata = {
  title: "Office of the Sheriff",
  description: "Executive leadership, authority, command structure, and organizational direction of the Los Santos County Sheriff’s Office.",
};

export const dynamic = "force-dynamic";

type PublicLeader = {
  id: string;
  display_name: string;
  rank: string;
  position_title: string;
  call_sign: string | null;
  portrait_url: string | null;
  public_bio: string | null;
  responsibilities: string[] | null;
  appointment_status: string;
  display_order: number;
};

const fallbackLeadership: PublicLeader[] = [
  { id: "fallback-sheriff", display_name: "Nicholas Miller", rank: "Sheriff", position_title: "Executive head of the Sheriff’s Office", call_sign: "S-401", portrait_url: null, appointment_status: "Permanent", display_order: 10, public_bio: "The Sheriff establishes department-wide direction, sets the standard expected of the organization, and holds final executive authority over LSCSO operations, personnel, policy, and command decisions.", responsibilities: ["Sets agency priorities, executive policy, and organizational standards", "Exercises final authority on command appointments and major personnel decisions", "Directs department-wide operations, structure, and long-term development", "Represents the Sheriff’s Office in executive and interagency matters"] },
  { id: "fallback-undersheriff", display_name: "Michael White", rank: "Undersheriff", position_title: "Second in command", call_sign: "S-402", portrait_url: null, appointment_status: "Permanent", display_order: 20, public_bio: "The Undersheriff turns executive direction into coordinated action, maintains continuity across command functions, and acts with the authority of the Sheriff when assigned or required.", responsibilities: ["Coordinates command staff and department-wide implementation", "Maintains executive oversight of readiness, staffing, and accountability", "Resolves cross-division issues that require senior command action", "Assumes executive authority when acting on behalf of the Sheriff"] },
];

const responsibilities = [
  { number: "01", title: "Executive Direction", description: "Defines the priorities, standards, and operating expectations that guide every division and level of command within LSCSO." },
  { number: "02", title: "Command Accountability", description: "Ensures authority is exercised responsibly, supervisors remain accountable for their decisions, and command actions support the long-term health of the Office." },
  { number: "03", title: "Personnel Stewardship", description: "Oversees senior appointments, organizational placement, leadership development, and major personnel decisions affecting the department." },
  { number: "04", title: "Operational Readiness", description: "Maintains department-wide readiness through clear command relationships, coordinated resources, policy oversight, and practical supervision." },
  { number: "05", title: "Agency Integrity", description: "Protects the credibility of the Sheriff’s Office by setting expectations for ethics, documentation, professional conduct, and transparent internal accountability." },
  { number: "06", title: "External Coordination", description: "Represents LSCSO in matters requiring executive-level coordination with county partners, public-safety agencies, and other authorized organizations." },
];

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "LS";
}

async function getLeadership(): Promise<PublicLeader[]> {
  try {
    const supabase = await createClient() as any;
    const { data, error } = await supabase.rpc("get_public_current_administration");
    if (error || !Array.isArray(data) || !data.length) return fallbackLeadership;
    return data as PublicLeader[];
  } catch {
    return fallbackLeadership;
  }
}

export default async function OfficeOfTheSheriffPage() {
  const executiveLeadership = await getLeadership();
  return (
    <>
      <PageHero eyebrow="Executive Leadership" title="Office of the Sheriff" description="The executive office responsible for the direction, accountability, readiness, and professional standard of the Los Santos County Sheriff’s Office." image="/images/command-uniform.png" imageAlt="LSCSO command staff member" imagePosition="center 42%" />

      <section className="sheriff-office-intro">
        <div className="site-shell sheriff-office-intro-grid">
          <div className="sheriff-office-seal" aria-hidden="true"><Image src="/images/lscso-patch-color.png" alt="" width={250} height={250} priority /></div>
          <div className="sheriff-office-intro-copy">
            <p className="section-kicker">Executive Office</p>
            <h2>The Office sets the standard for the entire agency.</h2>
            <p className="sheriff-office-lead">The Office of the Sheriff is more than a leadership title. It is the executive center of LSCSO and carries responsibility for how the department is organized, supervised, developed, and held accountable.</p>
            <p>The Sheriff and the members of the current administration establish department-wide priorities, resolve issues that cross normal divisional boundaries, oversee the command structure, and ensure policy and operational decisions remain practical, defensible, and consistent with the mission of the Office.</p>
          </div>
        </div>
      </section>

      <section className="executive-administration-section">
        <div className="site-shell">
          <div className="executive-section-heading">
            <div><p className="section-kicker section-kicker--dark">Current Administration</p><h2>Executive command.</h2></div>
            <p>The current administration brings together the executive and senior command personnel responsible for carrying the Sheriff’s direction across the department.</p>
          </div>

          <div className="executive-leadership-grid" aria-label="LSCSO current administration">
            {executiveLeadership.map((leader, index) => {
              const duties = Array.isArray(leader.responsibilities) ? leader.responsibilities : [];
              const rankClass = leader.rank === "Sheriff" ? " is-sheriff" : leader.rank === "Undersheriff" ? " is-undersheriff" : "";
              return (
                <article className={`executive-leader-card${rankClass}`} key={leader.id}>
                  <div className="executive-leader-portrait" role="img" aria-label={`${leader.rank} ${leader.display_name}`} style={leader.portrait_url ? { backgroundImage: `url(${leader.portrait_url})` } : undefined}>
                    {!leader.portrait_url ? <span className="executive-leader-monogram">{initials(leader.display_name)}</span> : null}
                    <span className="executive-leader-portrait-mark">Office of the Sheriff</span>
                  </div>
                  <div className="executive-leader-body">
                    <div className="executive-leader-card-top">
                      <span className="executive-leader-order">{String(index + 1).padStart(2, "0")}</span>
                      <div className="executive-leader-call"><span>Call sign</span><strong>{leader.call_sign || "—"}</strong></div>
                    </div>
                    <div className="executive-leader-identity">
                      <span>{leader.rank}{leader.appointment_status === "Acting" ? <em>Acting</em> : null}</span>
                      <h3>{leader.display_name}</h3>
                      <p>{leader.position_title}</p>
                    </div>
                    {leader.public_bio ? <p className="executive-leader-summary">{leader.public_bio}</p> : null}
                    {duties.length ? <div className="executive-leader-duties"><span>Leadership responsibilities</span><ul>{duties.map((duty) => <li key={duty}>{duty}</li>)}</ul></div> : null}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="command-framework-section">
        <div className="site-shell command-framework-grid">
          <div className="command-framework-heading"><p className="section-kicker">Command Framework</p><h2>Authority should always have a clear purpose.</h2></div>
          <div className="command-framework-copy">
            <p className="command-framework-lead">Executive command exists to make the department easier to lead, not harder to operate.</p>
            <p>The Sheriff retains final executive authority. The Undersheriff serves as second in command and may exercise executive authority when acting for the Sheriff. Majors and other command personnel carry that direction into their assigned operational areas while remaining accountable to the executive office.</p>
            <p>LSCSO is intentionally structured so legitimate command action is not trapped by unnecessary administrative barriers. Senior command may address cross-division matters when the needs of the Office require it, while lower supervisory authority remains tied more closely to actual assignments, responsibilities, and established scope.</p>
          </div>
        </div>
      </section>

      <section className="executive-responsibilities-section">
        <div className="site-shell">
          <div className="executive-section-heading executive-section-heading--dark"><div><p className="section-kicker">Office Responsibilities</p><h2>What executive leadership is responsible for.</h2></div><p>These functions sit above individual divisions and help keep the Sheriff’s Office working as one organization rather than a collection of disconnected units.</p></div>
          <div className="executive-responsibility-grid">{responsibilities.map((item) => <article key={item.title}><span>{item.number}</span><h3>{item.title}</h3><p>{item.description}</p></article>)}</div>
        </div>
      </section>

      <section className="executive-closing-section">
        <div className="site-shell executive-closing-grid">
          <div><p className="section-kicker">Leadership Standard</p><h2>Rank carries responsibility before privilege.</h2></div>
          <div><p>The Office of the Sheriff expects leaders to make decisions that are fair, practical, documented when necessary, and consistent with the standards expected from every other member of LSCSO.</p><div className="page-actions"><RouteLink href="/about#history" variant="outline">Department History</RouteLink><RouteLink href="/internal-affairs" variant="outline">Internal Affairs</RouteLink></div></div>
        </div>
      </section>
    </>
  );
}
