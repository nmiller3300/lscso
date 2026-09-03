import type { Metadata } from "next";
import type { ReactNode } from "react";
import { MaintenanceNotice } from "../_components/MaintenanceNotice";
import "./portal.css";
import "./medals.css";
import "./certifications.css";
import "./command-v2.css";
import "./quick-find.css";
import "./home-v2.css";
import "./supervision-v2.css";
import "./structure-v2.css";
import "./timeline-v2.css";
import "./notifications-v2.css";
import "./request-routing.css";
import "./notification-attention.css";
import "./midnight.css";
import "./midnight-pages.css";
import "./midnight-polish.css";
import "./midnight-operations.css";
import "./midnight-gateway.css";
import "./portal-mobile-menu.css";
import "./portal-primitives.css";
import "./portal-ux-overhaul.css";
import "./portal-ux-integrations.css";
import "./portal-legacy-dialog-bridge.css";

export const metadata: Metadata={title:"Personnel Operations Portal",description:"LSCSO command and deputy personnel operations portal.",robots:{index:false,follow:false}};
export default function PortalLayout({children}:Readonly<{children:ReactNode}>){return <div className="portal-root" data-theme="dark" id="lscso-portal-root"><MaintenanceNotice scope="personnel_portal" variant="portal"/>{children}</div>}
