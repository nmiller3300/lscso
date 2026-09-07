"use client";

import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-shell footer-main">
        <div className="footer-identity">
          <Image src="/images/lscso-patch-color.png" alt="Los Santos County Sheriff’s Office patch" width={100} height={100} />
          <div><strong>Los Santos County</strong><span>Sheriff’s Office</span><small>Driven to Protect. Dedicated to Serve.</small></div>
        </div>
        <div className="footer-navigation">
          <div><span>Office</span><Link href="/about">About LSCSO</Link><Link href="/office-of-the-sheriff">Office of the Sheriff</Link><Link href="/internal-affairs">Internal Affairs</Link><Link href="/portal">Personnel Portal</Link></div>
          <div><span>Operations</span><Link href="/patrol">Patrol Division</Link><Link href="/training-recruitment">Training & Recruitment</Link></div>
        </div>
      </div>
      <div className="site-shell footer-legal">
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <Image
            src="/images/bright-rp-logo.png"
            alt="Bright RP logo"
            width={24}
            height={24}
            style={{ width: 24, height: 24, objectFit: "contain", opacity: 0.82, flex: "0 0 auto" }}
          />
          <span>© 2026 Los Santos County Sheriff’s Office | A Development of Bright Roleplay</span>
        </div>
        <span>Established 1963 · State of San Andreas</span>
      </div>
    </footer>
  );
}
