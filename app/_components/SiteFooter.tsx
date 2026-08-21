import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-shell footer-main">
        <div className="footer-identity">
          <Image
            src="https://raw.githubusercontent.com/nmiller3300/lscso/main/public/images/lscso-patch-color.png"
            alt="Los Santos County Sheriff’s Office patch"
            width={100}
            height={100}
          />
          <div>
            <strong>Los Santos County</strong>
            <span>Sheriff’s Office</span>
            <small>Driven to Protect. Dedicated to Serve.</small>
          </div>
        </div>

        <div className="footer-navigation">
          <div>
            <span>Office</span>
            <Link href="/about">About LSCSO</Link>
            <Link href="/office-of-the-sheriff">Office of the Sheriff</Link>
            <Link href="/internal-affairs">Internal Affairs</Link>
            <Link href="/portal">Personnel Portal</Link>
          </div>
          <div>
            <span>Operations</span>
            <Link href="/patrol">Patrol Division</Link>
            <Link href="/training-recruitment">Training & Recruitment</Link>
          </div>
        </div>
      </div>
      <div className="site-shell footer-legal">
        <span>© 2026 Los Santos County Sheriff’s Office</span>
        <span>Established 1963 · State of San Andreas</span>
      </div>
    </footer>
  );
}
