import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { RouteLink } from "./_components/RouteLink";
import { StatewideJurisdictionAlert } from "./_components/StatewideJurisdictionAlert";

export const metadata: Metadata = {
  title: "Los Santos County Sheriff’s Office",
  description:
    "Driven to Protect. Dedicated to Serve. Learn about the Los Santos County Sheriff’s Office and opportunities to serve.",
};

const gateways = [
  {
    index: "01",
    label: "Executive Direction",
    title: "Office of the Sheriff",
    description: "Leadership, standards, and organizational direction for the entire Office.",
    href: "/office-of-the-sheriff",
  },
  {
    index: "02",
    label: "Field Operations",
    title: "Patrol Division",
    description: "The primary law enforcement presence serving communities across the county.",
    href: "/patrol",
  },
  {
    index: "03",
    label: "Professional Standards",
    title: "Internal Affairs",
    description: "Impartial review, accountability, and protection of organizational integrity.",
    href: "/internal-affairs",
  },
  {
    index: "04",
    label: "Personnel Development",
    title: "Training & Recruitment",
    description: "Selection, preparation, certification, and continued professional growth.",
    href: "/training-recruitment",
  },
];

export default function HomePage() {
  return (
    <>
      <StatewideJurisdictionAlert />
      <section className="home-hero">
        <Image
          src="/images/patrol-vehicle.png"
          alt="Los Santos County Sheriff’s Office patrol vehicle"
          fill
          priority
          sizes="100vw"
          className="home-hero-image"
        />
        <div className="home-hero-overlay" />
        <div className="site-shell home-hero-content">
          <div className="home-hero-copy">
            <p className="section-kicker">Los Santos County Sheriff’s Office</p>
            <h1>
              Driven to protect.
              <span>Dedicated to serve.</span>
            </h1>
            <p>
              Professional law enforcement grounded in integrity, accountability,
              sound judgment, and respect for the communities we serve.
            </p>
            <div className="hero-actions">
              <RouteLink href="/about">About the Office</RouteLink>
              <RouteLink href="/training-recruitment" variant="outline">
                Explore Recruitment
              </RouteLink>
            </div>
          </div>
          <div className="established-mark">
            <Image
              src="/images/lscso-patch-color.png"
              alt="Los Santos County Sheriff’s Office patch"
              width={160}
              height={160}
            />
            <div>
              <span>Established</span>
              <strong>1963</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="home-introduction content-section content-section--light">
        <div className="site-shell introduction-grid">
          <div>
            <p className="section-kicker section-kicker--dark">Our Mission</p>
            <h2>Service measured by the trust we earn.</h2>
          </div>
          <div className="reading-column">
            <p className="intro-serif">
              The Los Santos County Sheriff’s Office serves the residents,
              visitors, and communities of Los Santos County.
            </p>
            <p>
              We provide professional, fair, and accountable law enforcement
              services while protecting life and property, exercising sound
              judgment, developing our personnel, and maintaining the highest
              standards of integrity.
            </p>
            <RouteLink href="/about" variant="text">
              Read our Scope & Mission
            </RouteLink>
          </div>
        </div>
      </section>

      <section className="gateway-section content-section">
        <div className="site-shell">
          <div className="section-heading-row">
            <div>
              <p className="section-kicker">Explore LSCSO</p>
              <h2>One office. One standard.</h2>
            </div>
            <p>
              Navigate directly to the office, division, or professional-standard
              function you need.
            </p>
          </div>
          <div className="gateway-list">
            {gateways.map((gateway) => (
              <Link className="gateway-item" href={gateway.href} key={gateway.href}>
                <span className="gateway-index">{gateway.index}</span>
                <span className="gateway-title">
                  <small>{gateway.label}</small>
                  <strong>{gateway.title}</strong>
                </span>
                <span className="gateway-description">{gateway.description}</span>
                <span className="gateway-arrow" aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="home-feature">
        <div className="home-feature-media">
          <Image
            src="/images/command-uniform.png"
            alt="LSCSO command staff member"
            fill
            sizes="(max-width: 800px) 100vw, 50vw"
          />
        </div>
        <div className="home-feature-copy">
          <p className="section-kicker">Office of the Sheriff</p>
          <h2>Leadership with purpose and accountability.</h2>
          <p>
            The Office of the Sheriff establishes department standards, directs
            organizational priorities, and ensures every function remains aligned
            with the mission of service to Los Santos County.
          </p>
          <RouteLink href="/office-of-the-sheriff" variant="outline">
            Enter the Office
          </RouteLink>
        </div>
      </section>

      <section className="recruitment-banner">
        <div className="recruitment-banner-media">
          <Image
            src="/images/deputy-gray-uniform.png"
            alt="LSCSO deputy in uniform"
            fill
            sizes="100vw"
          />
        </div>
        <div className="recruitment-banner-overlay" />
        <div className="site-shell recruitment-banner-content">
          <div>
            <p className="section-kicker">Training & Recruitment</p>
            <h2>The standard begins before the badge is earned.</h2>
          </div>
          <div>
            <p>
              Patrol is currently accepting applicants prepared to serve with
              maturity, discipline, and sound judgment.
            </p>
            <RouteLink href="/training-recruitment">
              View Recruitment
            </RouteLink>
          </div>
        </div>
      </section>
    </>
  );
}
