import Image from "next/image";
import Link from "next/link";

const navigation = [
  { href: "/about", label: "About" },
  { href: "/office-of-the-sheriff", label: "Office of the Sheriff" },
  { href: "/patrol", label: "Patrol" },
  { href: "/internal-affairs", label: "Internal Affairs" },
  { href: "/training-recruitment", label: "Training & Recruitment" },
  { href: "/portal", label: "Personnel Portal" },
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
      <div className="site-shell nav-shell">
        <Link className="site-brand" href="/" aria-label="LSCSO homepage">
          <Image
            src="/images/lscso-patch-color.png"
            alt=""
            width={72}
            height={72}
            priority
          />
          <span>
            <strong>LSCSO</strong>
            <small>Los Santos County Sheriff</small>
          </span>
        </Link>

        <nav className="desktop-navigation" aria-label="Primary navigation">
          {navigation.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>

        <details className="mobile-navigation">
          <summary aria-label="Open site navigation">
            <span />
            <span />
            <span />
          </summary>
          <nav aria-label="Mobile navigation">
            <Link href="/">Home</Link>
            {navigation.map((item) => (
              <Link href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
        </details>
      </div>
    </header>
  );
}
