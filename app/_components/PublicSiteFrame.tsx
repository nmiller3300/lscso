"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { MaintenanceNotice } from "./MaintenanceNotice";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { StatewideJurisdictionAlert } from "./StatewideJurisdictionAlert";

export function PublicSiteFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const portalRoute = pathname.startsWith("/portal");
  const maintenanceRoute = pathname === "/maintenance";

  if (portalRoute || maintenanceRoute) return <>{children}</>;

  return (
    <>
      <MaintenanceNotice scope="public_site" variant="public" />
      <SiteHeader />
      <StatewideJurisdictionAlert />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
