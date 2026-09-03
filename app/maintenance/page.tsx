import type { Metadata } from "next";
import { MaintenanceScreen } from "../_components/MaintenanceScreen";

export const metadata: Metadata = { title: "Website Maintenance | LSCSO", robots: { index: false, follow: false } };

export default function PublicMaintenancePage() {
  return <MaintenanceScreen scope="public_site" />;
}
