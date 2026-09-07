"use client";

import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-shell footer-main">
        <div className="footer-identity" style={{ flexWrap: "wrap", rowGap: 18 }}>
          <Image src="/images/lscso-patch-color.png" alt="Los Santos County Sheriff’s Office patch" width={100} height={100} />
          <div><strong>Los Santos County</strong><span>Sheriff’s Office</span><small>Driven to Protect. Dedicated to Serve.</small></div>

          <span
            aria-hidden="true"
            style={{
              width: 1,
              height: 70,
              marginInline: 8,
              flex: "0 0 auto",
              background: "linear-gradient(to bottom, transparent, var(--gold-light), transparent)",
              opacity: 0.78,
            }}
          />

          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 11,
              flex: "0 0 auto",
            }}
          >
            <Image
              src="/images/bright-rp-logo.png"
              alt="Bright RP logo"
              width={48}
              height={48}
              style={{ width: 48, height: 48, objectFit: "contain", opacity: 0.9, flex: "0 0 auto" }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <small
                style={{
                  marginTop: 0,
                  color: "rgba(255,255,255,0.42)",
                  fontSize: 9,
                  letterSpacing: "0.12em",
                  lineHeight: 1.2,
                }}
              >
                A Development of
              </small>
              <span
                style={{
                  color: "var(--gold-light)",
                  fontSize: 13,
                  fontWeight: 720,
                  letterSpacing: "0.08em",
                  lineHeight: 1.15,
                  textTransform: "uppercase",
                }}
              >
                Bright Roleplay
              </span>
            </div>
          </div>
        </div>
        <div className="footer-navigation">
          <div><span>Office</span><Link href="/about">About LSCSO</Link><Link href="/office-of-the-sheriff">Office of the Sheriff</Link><Link href="/internal-affairs">Internal Affairs</Link><Link href="/portal">Personnel Portal</Link></div>
          <div><span>Operations</span><Link href="/patrol">Patrol Division</Link><Link href="/training-recruitment">Training & Recruitment</Link></div>
        </div>
      </div>
      <div className="site-shell footer-legal"><span>© 2026 Los Santos County Sheriff’s Office</span><span>Established 1963 · State of San Andreas</span></div>
    </footer>
  );
}
