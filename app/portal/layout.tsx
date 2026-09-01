import type { Metadata } from "next";
import type { ReactNode } from "react";
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

export const metadata: Metadata = {
  title: "Personnel Operations Portal",
  description: "LSCSO command and deputy personnel operations portal.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PortalLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <>
      <div className="portal-root" data-theme="light" id="lscso-portal-root" suppressHydrationWarning>
        {children}
      </div>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var t=localStorage.getItem("lscso.portal.theme:v1");if(t!=="dark"&&t!=="light"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}var e=document.getElementById("lscso-portal-root");if(e)e.dataset.theme=t}catch(e){}})();`,
        }}
      />
    </>
  );
}
