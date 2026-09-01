import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrowserPushControl } from "./BrowserPushControl";
import { CommandQuickFind } from "./CommandQuickFind";
import { PortalAccountMenu } from "./PortalAccountMenu";
import { PortalNavigation } from "./PortalNavigation";
import { PortalNotificationLink } from "./PortalNotificationLink";
import { PortalPolicyDirectory } from "./PortalPolicyDirectory";

type PortalShellProps = {
  active:
    | "overview"
    | "personnel"
    | "supervision"
    | "training"
    | "administration"
    | "guardians"
    | "record"
    | "approvals"
    | "activity"
    | "certifications"
    | "awards"
    | "notifications"
    | "applications"
    | "psa";
  audience?: "command" | "deputy";
  eyebrow: string;
  title: ReactNode;
  description: string;
  children: ReactNode;
  actions?: ReactNode;
};

export function PortalShell({ active, audience = "command", eyebrow, title, description, actions, children }: PortalShellProps) {
  return (
    <div className="portal-app">
      <aside className="portal-sidebar">
        <Link className="portal-brand" href="/portal" aria-label="LSCSO portal entry">
          <Image src="/images/lscso-patch-color.png" alt="" width={58} height={58} priority />
          <span><strong>LSCSO</strong><small>Personnel Operations</small></span>
        </Link>
        <div className="portal-sidebar-label">{audience === "command" ? "Command workspace" : "Personnel workspace"}</div>
        <PortalNavigation active={active} audience={audience} />
        <div className="portal-sidebar-foot">
          <span className="portal-security-pulse" aria-hidden="true" />
          <div><strong>Restricted access</strong><small>Protected department records</small></div>
        </div>
      </aside>

      <section className="portal-workspace">
        <header className="portal-topbar">
          <div className="portal-environment"><span>Internal</span><strong>{audience === "command" ? "Executive Command" : "Personnel Access"}</strong></div>
          <div className="portal-topbar-actions">
            {audience === "command" ? <CommandQuickFind /> : null}
            <PortalNotificationLink audience={audience} />
            <PortalAccountMenu />
          </div>
        </header>
        <main className="portal-content">
          <div className="portal-page-heading">
            <div><p>{eyebrow}</p><h1>{title}</h1><span>{description}</span></div>
            {actions ? <div className="portal-page-actions">{actions}</div> : null}
          </div>
          {active === "notifications" ? <BrowserPushControl /> : null}
          {active === "record" && audience === "deputy" ? <PortalPolicyDirectory /> : null}
          {children}
        </main>
      </section>
    </div>
  );
}
