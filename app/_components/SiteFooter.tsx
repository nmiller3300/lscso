"use client";

import Image from "next/image";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-shell footer-main" style={{ gap: 36 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            flex: "1 1 auto",
            minWidth: 0,
            flexWrap: "wrap",
          }}
        >
          <div className="footer-identity" style={{ flex: "0 1 auto", minWidth: 0 }}>
            <Image
              src="/images/lscso-patch-color.png"
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

          <span
            aria-hidden="true"
            style={{
              width: 1,
              height: 82,
              flex: "0 0 auto",
              background: "linear-gradient(to bottom, transparent, var(--gold-light), transparent)",
              opacity: 0.82,
            }}
          />

          <div
            aria-label="Bright Roleplay affiliation"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 13,
              flex: "0 0 auto",
              minWidth: 0,
            }}
          >
            <img
              src="/images/bright-rp-logo-footer.svg"
              alt="Bright RP logo"
              width={64}
              height={64}
              style={{
                width: 64,
                height: 64,
                objectFit: "contain",
                display: "block",
                flex: "0 0 auto",
                filter: "drop-shadow(0 5px 12px rgba(0,0,0,0.28))",
              }}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
              <small
                style={{
                  margin: 0,
                  color: "rgba(255,255,255,0.42)",
                  fontSize: 9,
                  fontWeight: 680,
                  letterSpacing: "0.12em",
                  lineHeight: 1.2,
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}
              >
                A Development of
              </small>
              <span
                style={{
                  color: "var(--gold-light)",
                  fontSize: 13,
                  fontWeight: 760,
                  letterSpacing: "0.08em",
                  lineHeight: 1.15,
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}
              >
                Bright Roleplay
              </span>
            </div>
          </div>
        </div>

        <div
          className="footer-navigation"
          style={{
            minWidth: 330,
            width: 360,
            flex: "0 1 360px",
            gap: 42,
            gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          }}
        >
          <div>
            <span>Office</span>
            <Link href="/about">About LSCSO</Link>
            <Link href="/office-of-the-sheriff">Office of the Sheriff</Link>
            <Link href="/internal-affairs">Internal Affairs</Link>
            <Link href="/open-records">Open Records Request</Link>
            <Link href="/portal">Personnel Portal</Link>
          </div>
          <div>
            <span>Operations</span>
            <Link href="/patrol">Patrol Division</Link>
            <Link href="/training-recruitment">Training &amp; Recruitment</Link>
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
