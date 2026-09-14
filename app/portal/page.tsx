import Image from "next/image";
import Link from "next/link";
import { PortalCinematicBackdrop } from "./_components/PortalCinematicBackdrop";
import { PortalResponsiveCinematicBackdrop } from "./_components/PortalResponsiveCinematicBackdrop";
import { PortalLogin } from "./_components/PortalLogin";

export default function PortalEntryPage() {
  return (
    <main className="portal-gateway portal-gateway--glow-login">
      <PortalCinematicBackdrop />
      <PortalResponsiveCinematicBackdrop />

      <section className="portal-gateway__brand" aria-label="Los Santos County Sheriff’s Office Personnel Portal">
        <div className="portal-gateway__ambient" aria-hidden="true">
          <span className="portal-gateway__orb portal-gateway__orb--one" />
          <span className="portal-gateway__orb portal-gateway__orb--two" />
          <span className="portal-gateway__grid" />
        </div>

        <Image
          className="portal-gateway__watermark"
          src="/images/lscso-patch-color.png"
          alt=""
          width={768}
          height={768}
          aria-hidden="true"
          priority
        />

        <header className="portal-gateway__agency">
          <div className="portal-gateway__agency-mark">
            <Image
              src="/images/lscso-patch-color.png"
              alt="Los Santos County Sheriff’s Office patch"
              width={84}
              height={84}
              priority
            />
          </div>
          <div>
            <span>Los Santos County</span>
            <strong>Sheriff’s Office</strong>
            <small>State of San Andreas · Established 1963</small>
          </div>
        </header>

        <div className="portal-gateway__hero">
          <div className="portal-gateway__eyebrow">
            <span className="portal-gateway__live-dot" />
            Personnel Operations Portal
          </div>
          <h1>
            One secure system for the people who <em>run the department.</em>
          </h1>
          <p>
            Personnel records, supervision, training, certifications, recruitment,
            requests, and Command decisions — protected behind one accountable workspace.
          </p>
        </div>

        <div className="portal-gateway__capabilities" aria-label="Portal capabilities">
          <article className="portal-glass-card">
            <span>01</span>
            <div><strong>Personnel Operations</strong><small>Records, assignments, credentials, and service history.</small></div>
          </article>
          <article className="portal-glass-card">
            <span>02</span>
            <div><strong>Supervision & Training</strong><small>Guardians, FTO progression, certifications, and follow-up.</small></div>
          </article>
          <article className="portal-glass-card">
            <span>03</span>
            <div><strong>Command Accountability</strong><small>Routed decisions, approvals, protected actions, and audit history.</small></div>
          </article>
        </div>

        <footer className="portal-gateway__brand-footer">
          <span><i /> Secure personnel network operational</span>
          <small>Restricted system · Authorized LSCSO personnel only</small>
        </footer>
      </section>

      <section className="portal-gateway__access portal-glow-login" aria-label="Personnel portal sign in">
        <div className="portal-glow-login__background" aria-hidden="true">
          <span className="portal-glow-login__wave portal-glow-login__wave--one" />
          <span className="portal-glow-login__wave portal-glow-login__wave--two" />
          <span className="portal-glow-login__halo portal-glow-login__halo--gold" />
          <span className="portal-glow-login__halo portal-glow-login__halo--olive" />
        </div>

        <div className="portal-glow-login__stage">
          <div className="portal-glow-login__status portal-glow-login__status--node">
            <span /> Secure access node
          </div>
          <div className="portal-glow-login__status portal-glow-login__status--class">
            Personnel Restricted
          </div>

          <div className="portal-glow-login__card">
            <div className="portal-glow-login__content">
              <div className="portal-glow-login__mark">
                <Image
                  src="/images/lscso-patch-color.png"
                  alt="Los Santos County Sheriff’s Office patch"
                  width={76}
                  height={76}
                  priority
                />
              </div>

              <header className="portal-glow-login__heading">
                <span>LSCSO Personnel Operations</span>
                <h2>Secure Sign In</h2>
                <p>Authenticate with the credentials assigned to your personnel account.</p>
              </header>

              <PortalLogin />
            </div>
          </div>

          <div className="portal-glow-login__below">
            <div className="portal-glow-login__security">
              <span aria-hidden="true">S4</span>
              <div>
                <strong>Protected department system</strong>
                <small>Authentication and protected personnel actions are recorded for accountability.</small>
              </div>
            </div>

            <div className="portal-glow-login__footer">
              <Link href="/">Return to public website</Link>
              <span>Need access? Contact LSCSO Command.</span>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
