"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSeasonalAppearance, SeasonalLogo } from "./SeasonalExperience";
import { OriginalAgencyRail } from "./OriginalAgencyRail";

const publicOffices = [
  { number: "01", label: "Executive direction", title: "Office of the Sheriff", href: "/office-of-the-sheriff", description: "Leadership, accountability and the standards guiding county operations." },
  { number: "02", label: "Field services", title: "Patrol Division", href: "/patrol", description: "The deputies responsible for frontline law enforcement throughout the county." },
  { number: "03", label: "Professional standards", title: "Internal Affairs", href: "/internal-affairs", description: "Impartial review, department accountability and organizational integrity." },
  { number: "04", label: "Public services", title: "Open Records", href: "/open-records", description: "Request official records and follow the status of your submission." },
];

/**
 * Keep the original and Halloween homepages independent. The seasonal branch
 * can continue using its established homepage structure unchanged.
 */
export function OriginalHomeExperience({ legacy }: { legacy: ReactNode }) {
  const season = useSeasonalAppearance();
  if (season.active_theme !== "standard") return <>{legacy}</>;

  return (
    <>
      <section className="agency-home-hero" aria-labelledby="agency-home-title">
        <Image
          className="agency-home-hero__photo"
          src="/images/patrol-vehicle.png"
          alt="Los Santos County Sheriff's Office patrol vehicle"
          fill priority sizes="100vw"
        />
        <div className="agency-home-hero__wash" aria-hidden="true" />
        <div className="site-shell agency-home-hero__inner">
          <div className="agency-home-hero__copy">
            <p className="agency-home-overline"><span aria-hidden="true" /> Los Santos County Sheriff's Office · Established 1963</p>
            <h1 id="agency-home-title">Driven to protect.<span>Dedicated to serve.</span></h1>
            <p className="agency-home-hero__intro">
              Professional law enforcement founded on integrity, sound judgment,
              accountability and respect for the communities we serve.
            </p>
            <div className="agency-home-hero__actions">
              <Link href="/about" className="agency-home-button agency-home-button--gold">About the Office <span aria-hidden="true">↗</span></Link>
              <Link href="/join" className="agency-home-button agency-home-button--outline">Join the LSCSO <span aria-hidden="true">↗</span></Link>
            </div>
          </div>
          <aside className="agency-home-hero__seal" aria-label="LSCSO identity">
            <SeasonalLogo width={164} height={164} alt="Los Santos County Sheriff's Office official insignia" />
            <div><strong>LOS SANTOS COUNTY</strong><span>SHERIFF'S OFFICE</span><small>Serving Since 1963</small></div>
          </aside>
        </div>
      </section>

      <OriginalAgencyRail />

      <section className="agency-home-mission" aria-labelledby="agency-mission-title">
        <div className="site-shell agency-home-mission__grid">
          <div>
            <p className="agency-home-overline agency-home-overline--dark">Our Mission</p>
            <h2 id="agency-mission-title">Service measured by the trust we earn.</h2>
          </div>
          <div className="agency-home-mission__text">
            <p className="agency-home-mission__lead">One office. One standard of public service.</p>
            <p>The Los Santos County Sheriff's Office provides professional, fair and accountable law enforcement services while protecting life and property, developing our personnel and maintaining the highest standards of integrity.</p>
            <Link href="/about">Learn about the Office <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
      </section>

      <section className="agency-home-directory" aria-labelledby="agency-directory-title">
        <div className="site-shell">
          <header className="agency-home-directory__heading">
            <div>
              <p className="agency-home-overline">Department Directory</p>
              <h2 id="agency-directory-title">Explore the Office</h2>
            </div>
            <p>Access the department's leadership, frontline operations and public services.</p>
          </header>
          <div className="agency-home-directory__items">
            {publicOffices.map((office) => (
              <Link key={office.href} href={office.href} className="agency-home-directory__item">
                <span className="agency-home-directory__number">{office.number}</span>
                <div className="agency-home-directory__name"><small>{office.label}</small><strong>{office.title}</strong></div>
                <p>{office.description}</p>
                <span aria-hidden="true" className="agency-home-directory__arrow">↗</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="agency-home-recruitment" aria-labelledby="agency-recruitment-title">
        <div className="agency-home-recruitment__image">
          <Image src="/images/deputy-gray-uniform.png" alt="LSCSO deputy in uniform" fill sizes="(max-width: 850px) 100vw, 44vw" />
        </div>
        <div className="agency-home-recruitment__content">
          <p className="agency-home-overline">Careers · Service · Leadership</p>
          <h2 id="agency-recruitment-title">The standard begins before the badge is earned.</h2>
          <p>Learn what it takes to join the Los Santos County Sheriff's Office and serve our communities.</p>
          <Link className="agency-home-button agency-home-button--gold" href="/training-recruitment">
            Training & Recruitment <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>
    </>
  );
}
