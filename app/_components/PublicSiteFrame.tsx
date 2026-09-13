"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AgencyHistoryNav } from "./AgencyHistoryNav";
import { MaintenanceNotice } from "./MaintenanceNotice";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { StatewideJurisdictionAlert } from "./StatewideJurisdictionAlert";

export function PublicSiteFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const portalRoute = pathname.startsWith("/portal");
  const maintenanceRoute = pathname === "/maintenance";
  const archiveRoute = pathname.startsWith("/archives");

  if (portalRoute || maintenanceRoute || archiveRoute) return <>{children}</>;

  return (
    <>
      <MaintenanceNotice scope="public_site" variant="public" />
      <SiteHeader />
      <AgencyHistoryNav />
      <StatewideJurisdictionAlert />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
