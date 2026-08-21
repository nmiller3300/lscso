import Image from "next/image";
import Link from "next/link";
import { PortalLogin } from "./_components/PortalLogin";
import { ThemeToggle } from "./_components/ThemeToggle";

export default function PortalEntryPage() {
  return (
    <div className="portal-entry">
      <section className="portal-entry-story">
        <div className="portal-entry-brand">
          <Image
            src="https://raw.githubusercontent.com/nmiller3300/lscso/main/public/images/lscso-patch-color.png"
            alt="Los Santos County Sheriff’s Office patch"
            width={94}
            height={94}
            priority
          />
          <div>
            <strong>LSCSO</strong>
            <span>Los Santos County Sheriff’s Office</span>
          </div>
        </div>
        <div className="portal-entry-copy">
          <p>Personnel Operations</p>
          <h1>One command view. Every personnel standard.</h1>
          <span>
            A structured internal workspace for credentials, Guardian records, certifications,
            assignments, training, approvals, and personnel accountability.
          </span>
        </div>
        <div className="portal-entry-principles">
          <article>
            <strong>Rank-aware</strong>
            <span>Every action follows the approved LSCSO chain of command.</span>
          </article>
          <article>
            <strong>Accountable</strong>
            <span>Decisions, acknowledgments, amendments, and sessions remain traceable.</span>
          </article>
          <article>
            <strong>Personnel-first</strong>
            <span>Deputies can understand their own record without exposing other members.</span>
          </article>
        </div>
        <small className="portal-entry-foot">Restricted system · Authorized personnel only</small>
      </section>

      <section className="portal-entry-access">
        <div className="portal-access-card">
          <div className="portal-entry-theme"><ThemeToggle /></div>
          <div className="portal-preview-flag">
            <span /> Production personnel system
          </div>
          <p>Secure portal access</p>
          <h2>Sign in with assigned credentials.</h2>
          <span className="portal-access-intro">
            Secure role-aware authentication is active for the Sheriff and one flagged personnel
            test account. Undersheriff credentials remain unassigned until the Sheriff creates them.
          </span>

          <PortalLogin />

          <div className="portal-review-divider"><span>Authorized access paths</span></div>
          <div className="portal-review-options">
            <Link href="#account-login">
              <span>Executive access</span>
              <strong>Executive Command</strong>
              <small>Sheriff access is active; Undersheriff credentials are assigned by the Sheriff.</small>
              <b aria-hidden="true">↑</b>
            </Link>
            <Link href="#account-login">
              <span>Test-subject access</span>
              <strong>Use Test Deputy sign-in</strong>
              <small>Exercises deputy workflows without touching official records.</small>
              <b aria-hidden="true">↑</b>
            </Link>
          </div>

          <div className="portal-protection-note">
            <strong>Approved account model</strong>
            <span>
              Command assigns usernames and passwords. Sheriff and Undersheriff are the only roles
              permitted to deactivate an account. Passwords are stored as one-way hashes by Supabase Auth
              and are never displayed by this site.
            </span>
          </div>
          <Link className="portal-return-link" href="/">
            ← Return to public website
          </Link>
        </div>
      </section>
    </div>
  );
}
