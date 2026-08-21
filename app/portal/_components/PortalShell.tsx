import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { PortalNotificationLink } from "./PortalNotificationLink";
import { PasswordChangeDialog } from "./PasswordChangeDialog";
import { PortalSessionIdentity } from "./PortalSessionIdentity";
import { PortalSignOut } from "./PortalSignOut";
import { ThemeToggle } from "./ThemeToggle";

type PortalShellProps = {
  active: "overview" | "personnel" | "guardians" | "record";
  audience?: "command" | "deputy";
  eyebrow: string;
  title: ReactNode;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
};

const commandNavigation = [
  { id: "overview", href: "/portal/command", label: "Command overview", glyph: "CO" },
  { id: "personnel", href: "/portal/command/personnel", label: "Personnel roster", glyph: "PR" },
  { id: "guardians", href: "/portal/command/guardians", label: "Guardian center", glyph: "GC" },
  { id: "approvals", href: "/portal/command#approvals", label: "Approvals", glyph: "AP" },
  { id: "activity", href: "/portal/command#notifications", label: "Recent activity", glyph: "RA" },
] as const;

const deputyNavigation = [
  { id: "record", href: "/portal/personnel", label: "My record", glyph: "MR" },
  { id: "certifications", href: "/portal/personnel#certifications", label: "Certifications", glyph: "CE" },
  { id: "assignments", href: "/portal/personnel#assignments", label: "Assignments", glyph: "AS" },
  { id: "guardians", href: "/portal/personnel#guardians", label: "My Guardians", glyph: "MG" },
  { id: "requests", href: "/portal/personnel#requests", label: "Requests", glyph: "RQ" },
] as const;

export function PortalShell({
  active,
  audience = "command",
  eyebrow,
  title,
  description,
  actions,
  children,
}: PortalShellProps) {
  const navigation = audience === "command" ? commandNavigation : deputyNavigation;

  return (
    <div className="portal-app">
      <aside className="portal-sidebar">
        <Link className="portal-brand" href="/portal" aria-label="LSCSO portal entry">
          <Image
            src="https://raw.githubusercontent.com/nmiller3300/lscso/main/public/images/lscso-patch-color.png"
            alt=""
            width={58}
            height={58}
            priority
          />
          <span>
            <strong>LSCSO</strong>
            <small>Personnel Operations</small>
          </span>
        </Link>

        <div className="portal-sidebar-label">
          {audience === "command" ? "Command workspace" : "Deputy workspace"}
        </div>
        <nav className="portal-navigation" aria-label={`${audience} portal navigation`}>
          {navigation.map((item) => (
            <Link
              className={item.id === active ? "is-active" : undefined}
              href={item.href}
              key={`${item.id}-${item.href}`}
            >
              <span aria-hidden="true">{item.glyph}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="portal-sidebar-foot">
          <span className="portal-security-pulse" aria-hidden="true" />
          <div>
            <strong>Restricted access</strong>
            <small>Protected department records</small>
          </div>
        </div>
      </aside>

      <section className="portal-workspace">
        <header className="portal-topbar">
          <div className="portal-environment">
            <span>Internal</span>
            <strong>{audience === "command" ? "Executive Command" : "Personnel Access"}</strong>
          </div>
          <div className="portal-topbar-actions">
            <ThemeToggle compact />
            <PortalNotificationLink audience={audience} />
            <PortalSessionIdentity />
            <PasswordChangeDialog />
            <PortalSignOut label="Sign out" />
          </div>
        </header>

        <main className="portal-content">
          <div className="portal-page-heading">
            <div>
              <p>{eyebrow}</p>
              <h1>{title}</h1>
              <span>{description}</span>
            </div>
            {actions ? <div className="portal-page-actions">{actions}</div> : null}
          </div>
          {children}
        </main>
      </section>
    </div>
  );
}
