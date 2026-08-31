import Image from "next/image";
import Link from "next/link";

const primaryNavigation = [
  { href: "/about", label: "About" },
  { href: "/office-of-the-sheriff", label: "Office of the Sheriff" },
  { href: "/join/application", label: "Join LSCSO" },
  { href: "/portal", label: "Personnel Portal" },
];

const divisions = [
  { href: "/patrol", label: "Patrol" },
  { href: "/internal-affairs", label: "Internal Affairs" },
  { href: "/training-recruitment", label: "Training & Recruitment" },
];

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="utility-bar">
        <div className="site-shell utility-content">
          <span>Los Santos County, San Andreas</span>
          <span>Established 1963</span>
        </div>
      </div>

      <div className="site-shell nav-shell refined-nav-shell">
        <Link className="site-brand refined-site-brand" href="/" aria-label="LSCSO homepage">
          <Image src="/images/lscso-patch-color.png" alt="" width={72} height={72} priority />
          <span>
            <strong>LSCSO</strong>
            <small>Los Santos County Sheriff</small>
          </span>
        </Link>

        <nav className="desktop-navigation refined-desktop-navigation" aria-label="Primary navigation">
          <Link href="/about">About</Link>
          <Link href="/office-of-the-sheriff">Office of the Sheriff</Link>

          <details className="division-menu">
            <summary>
              <span>Divisions</span>
              <span className="division-chevron" aria-hidden="true">⌄</span>
            </summary>
            <div className="division-dropdown">
              <div className="division-dropdown-heading">
                <small>Operations</small>
                <strong>Department Divisions</strong>
              </div>
              {divisions.map((division) => (
                <Link href={division.href} key={division.href}>
                  <span>{division.label}</span>
                  <span aria-hidden="true">↗</span>
                </Link>
              ))}
            </div>
          </details>

          <Link href="/join/application">Join LSCSO</Link>
          <Link href="/portal">Personnel Portal</Link>
        </nav>

        <details className="mobile-navigation">
          <summary aria-label="Open site navigation"><span /><span /><span /></summary>
          <nav aria-label="Mobile navigation">
            <Link href="/">Home</Link>
            <Link href="/about">About</Link>
            <Link href="/office-of-the-sheriff">Office of the Sheriff</Link>

            <details className="mobile-division-menu">
              <summary>
                <span>Divisions</span>
                <span aria-hidden="true">⌄</span>
              </summary>
              <div>
                {divisions.map((division) => (
                  <Link href={division.href} key={division.href}>{division.label}</Link>
                ))}
              </div>
            </details>

            <Link href="/join/application">Join LSCSO</Link>
            <Link href="/portal">Personnel Portal</Link>
          </nav>
        </details>
      </div>

      <style>{`
        @media (min-width: 1061px) {
          .refined-nav-shell {
            height: 92px;
            gap: 34px;
          }

          .refined-site-brand {
            min-width: 250px;
          }

          .refined-site-brand img {
            width: 64px;
            height: 64px;
          }

          .refined-site-brand strong {
            font-size: 23px;
            letter-spacing: 0.15em;
          }

          .refined-site-brand small {
            font-size: 9px;
            letter-spacing: 0.12em;
            white-space: nowrap;
          }

          .refined-desktop-navigation {
            flex: 1 1 auto;
            justify-content: flex-end;
            gap: clamp(18px, 1.55vw, 28px);
            font-size: 11px;
            letter-spacing: 0.065em;
          }

          .refined-desktop-navigation > a,
          .division-menu > summary {
            flex: 0 0 auto;
            white-space: nowrap;
            padding-block: 14px;
          }

          .division-menu {
            position: relative;
          }

          .division-menu > summary {
            display: flex;
            align-items: center;
            gap: 7px;
            color: rgba(255, 255, 255, 0.78);
            cursor: pointer;
            list-style: none;
            transition: color 180ms ease;
          }

          .division-menu > summary::-webkit-details-marker {
            display: none;
          }

          .division-menu > summary:hover,
          .division-menu > summary:focus-visible,
          .division-menu[open] > summary {
            color: var(--white);
          }

          .division-chevron {
            margin-top: -2px;
            color: var(--gold-light);
            font-size: 15px;
            line-height: 1;
            transition: transform 180ms ease;
          }

          .division-menu[open] .division-chevron {
            transform: rotate(180deg);
          }

          .division-dropdown {
            position: absolute;
            top: calc(100% + 10px);
            right: -16px;
            width: 330px;
            padding: 14px;
            border: 1px solid rgba(187, 164, 95, 0.34);
            background: rgba(12, 12, 10, 0.98);
            box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(18px);
          }

          .division-dropdown-heading {
            padding: 12px 12px 16px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.11);
          }

          .division-dropdown-heading small,
          .division-dropdown-heading strong {
            display: block;
          }

          .division-dropdown-heading small {
            margin-bottom: 5px;
            color: var(--gold-light);
            font-size: 9px;
            font-weight: 760;
            letter-spacing: 0.15em;
            text-transform: uppercase;
          }

          .division-dropdown-heading strong {
            color: rgba(255, 255, 255, 0.9);
            font-size: 14px;
            font-weight: 680;
            letter-spacing: 0.02em;
            text-transform: none;
          }

          .division-dropdown > a {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            padding: 16px 12px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.08);
            color: rgba(255, 255, 255, 0.72);
            font-size: 12px;
            letter-spacing: 0.055em;
            text-transform: uppercase;
            transition: color 160ms ease, background 160ms ease, padding 160ms ease;
          }

          .division-dropdown > a:last-child {
            border-bottom: 0;
          }

          .division-dropdown > a::after {
            display: none;
          }

          .division-dropdown > a:hover,
          .division-dropdown > a:focus-visible {
            padding-left: 16px;
            background: rgba(187, 164, 95, 0.08);
            color: var(--white);
          }

          .division-dropdown > a span:last-child {
            color: var(--gold-light);
            font-size: 15px;
          }
        }

        @media (min-width: 1061px) and (max-width: 1240px) {
          .refined-site-brand {
            min-width: auto;
          }

          .refined-site-brand small {
            display: none;
          }

          .refined-desktop-navigation {
            gap: 15px;
            font-size: 10px;
            letter-spacing: 0.045em;
          }
        }

        .mobile-division-menu {
          border-bottom: 1px solid var(--line-dark);
        }

        .mobile-navigation nav .mobile-division-menu > summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 15px 2px;
          color: rgba(255, 255, 255, 0.78);
          cursor: pointer;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.08em;
          list-style: none;
          text-transform: uppercase;
        }

        .mobile-navigation nav .mobile-division-menu > summary::-webkit-details-marker {
          display: none;
        }

        .mobile-division-menu > summary span:last-child {
          color: var(--gold-light);
          transition: transform 180ms ease;
        }

        .mobile-division-menu[open] > summary span:last-child {
          transform: rotate(180deg);
        }

        .mobile-division-menu > div {
          padding: 0 0 8px 14px;
          border-left: 1px solid rgba(187, 164, 95, 0.34);
        }

        .mobile-navigation nav .mobile-division-menu > div a {
          padding: 13px 10px;
          border-bottom-color: rgba(255, 255, 255, 0.07);
          color: rgba(255, 255, 255, 0.62);
          font-size: 12px;
        }
      `}</style>
    </header>
  );
}
