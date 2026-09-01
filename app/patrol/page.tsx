import type { Metadata } from "next";
import Image from "next/image";
import { PageHero } from "../_components/PageHero";
import { RouteLink } from "../_components/RouteLink";

export const metadata: Metadata = {
  title: "Patrol Division",
  description:
    "Learn about Patrol Division operations and deputy responsibilities within the Los Santos County Sheriff’s Office.",
};

const responsibilities = [
  "Responding to emergency and non-emergency calls for service",
  "Proactive patrol and visible community protection",
  "Traffic enforcement and roadway safety",
  "Initial criminal investigations and scene management",
  "Coordination with partner agencies during major incidents",
  "Accurate reporting, evidence handling, and case documentation",
];

export default function PatrolPage() {
  return (
    <>
      <PageHero
        eyebrow="Primary Operations"
        title="Patrol Division"
        description="The first response, the visible presence, and the operational foundation of the Los Santos County Sheriff’s Office."
        image="/images/patrol-vehicle.png"
        imageAlt="LSCSO Patrol Division vehicle"
        imagePosition="center 55%"
      />

      <section className="content-section content-section--light">
        <div className="site-shell two-column-editorial">
          <div>
            <p className="section-kicker section-kicker--dark">The Patrol Mission</p>
            <h2>Present when the county needs us most.</h2>
          </div>
          <div className="reading-column">
            <p className="intro-serif">
              Patrol is the active operational division of LSCSO and the primary
              entry point for sworn personnel.
            </p>
            <p>
              Deputies answer calls for service, enforce traffic and criminal
              law, respond to emergencies, conduct preliminary investigations,
              and maintain a visible law enforcement presence throughout Los
              Santos County.
            </p>
            <p>
              Patrol work requires initiative, restraint, communication, and the
              ability to make sound decisions under changing circumstances.
            </p>
          </div>
        </div>
      </section>

      <section className="patrol-responsibilities">
        <div className="patrol-photo">
          <Image
            src="/images/deputy-brown-uniform.png"
            alt="LSCSO patrol deputy"
            fill
            sizes="(max-width: 850px) 100vw, 48vw"
          />
        </div>
        <div className="patrol-responsibility-copy">
          <p className="section-kicker">Deputy Responsibilities</p>
          <h2>Professional response. Complete follow-through.</h2>
          <ul>
            {responsibilities.map((responsibility) => (
              <li key={responsibility}>{responsibility}</li>
            ))}
          </ul>
          <div className="page-actions">
            <RouteLink href="/join/application">Begin an Application</RouteLink>
            <RouteLink href="/training-recruitment" variant="outline">Recruitment & Training</RouteLink>
          </div>
        </div>
      </section>
    </>
  );
}
