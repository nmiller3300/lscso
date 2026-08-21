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
          <p>Personnel Portal</p>
          <h1>Secure access. Clear accountability.</h1>
          <span>
            A restricted workspace for authorized members of the Los Santos County
            Sheriff’s Office.
          </span>
        </div>
        <div className="portal-entry-principles">
          <article>
            <strong>Protected</strong>
            <span>Access is limited to personnel with assigned credentials.</span>
          </article>
          <article>
            <strong>Role-based</strong>
            <span>Permissions follow each member’s authorized responsibilities.</span>
          </article>
          <article>
            <strong>Accountable</strong>
            <span>Authorized activity is recorded within the protected system.</span>
          </article>
        </div>
        <small className="portal-entry-foot">Restricted system · Authorized personnel only</small>
      </section>

      <section className="portal-entry-access">
        <div className="portal-access-card">
          <div className="portal-entry-theme"><ThemeToggle /></div>
          <div className="portal-preview-flag">
            <span /> Restricted LSCSO system
          </div>
          <p>Personnel Portal</p>
          <h2>Authorized personnel sign-in.</h2>
          <span className="portal-access-intro">
            Enter the username and password issued to you by LSCSO Command.
          </span>

          <PortalLogin />
          <Link className="portal-return-link" href="/">
            ← Return to public website
          </Link>
        </div>
      </section>
    </div>
  );
}
