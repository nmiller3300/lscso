import type { Metadata } from "next";
import { MaintenanceScreen } from "../../_components/MaintenanceScreen";

export const metadata: Metadata = { title: "Personnel Operations Maintenance", robots: { index: false, follow: false } };

export default function PortalMaintenancePage() {
  return <MaintenanceScreen scope="personnel_portal" />;
}
