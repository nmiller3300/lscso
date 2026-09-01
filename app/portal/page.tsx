import Image from "next/image";
import Link from "next/link";
import { PortalLogin } from "./_components/PortalLogin";

export default function PortalEntryPage() {
  return (
    <main className="portal-gateway">
      <section className="portal-gateway__brand" aria-label="Los Santos County Sheriff’s Office Personnel Portal">
        <div className="portal-gateway__ambient" aria-hidden="true">
          <span className="portal-gateway__orb portal-gateway__orb--one" />
          <span className="portal-gateway__orb portal-gateway__orb--two" />
          <span className="portal-gateway__grid" />
        </div>

        <Image
          className="portal-gateway__watermark"
          src="/images/lscso-portal-patch.webp"
          alt=""
          width={768}
          height={768}
          aria-hidden="true"
          priority
        />

        <header className="portal-gateway__agency">
          <div className="portal-gateway__agency-mark">
            <Image
              src="/images/lscso-portal-patch.webp"
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
          <article>
            <span>01</span>
            <div><strong>Personnel Operations</strong><small>Records, assignments, credentials, and service history.</small></div>
          </article>
          <article>
            <span>02</span>
            <div><strong>Supervision & Training</strong><small>Guardians, FTO progression, certifications, and follow-up.</small></div>
          </article>
          <article>
            <span>03</span>
            <div><strong>Command Accountability</strong><small>Routed decisions, approvals, protected actions, and audit history.</small></div>
          </article>
        </div>

        <footer className="portal-gateway__brand-footer">
          <span><i /> Secure personnel network operational</span>
          <small>Restricted system · Authorized LSCSO personnel only</small>
        </footer>
      </section>

      <section className="portal-gateway__access" aria-label="Personnel portal sign in">
        <div className="portal-gateway__access-shell">
          <div className="portal-gateway__access-topline">
            <div className="portal-gateway__node-status"><span /> Secure access node</div>
            <div className="portal-gateway__classification">Personnel Restricted</div>
          </div>

          <div className="portal-gateway__mobile-mark">
            <Image
              src="/images/lscso-portal-patch.webp"
              alt="Los Santos County Sheriff’s Office patch"
              width={96}
              height={96}
              priority
            />
          </div>

          <div className="portal-gateway__access-heading">
            <span>LSCSO Personnel Operations</span>
            <h2>Welcome back.</h2>
            <p>Authenticate with the credentials assigned to your personnel account.</p>
          </div>

          <PortalLogin />

          <div className="portal-gateway__security-note">
            <span className="portal-gateway__security-icon" aria-hidden="true">S4</span>
            <div>
              <strong>Protected department system</strong>
              <p>Authentication, protected personnel actions, and account-security events are recorded for accountability.</p>
            </div>
          </div>

          <div className="portal-gateway__access-footer">
            <Link href="/">Return to public website</Link>
            <span>Need access? Contact LSCSO Command.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
