import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { PublicSiteFrame } from "./_components/PublicSiteFrame";
import { SeasonalExperience } from "./_components/SeasonalExperience";
import { getSeasonalSettings } from "@/lib/seasonal/server";
import "./globals.css";
import "./public-premium-system.css";
import "./public-header-glass-restore.css";
import "./maintenance.css";
import "./seasonal-experience.css";
import "./seasonal-surface-design.css";
import "./seasonal-public-navigation.css";
import "./original-brand.css";

const geist = localFont({
  src: "./fonts/Geist.woff2",
  variable: "--font-geist",
  display: "swap",
});

const siteUrl = "https://lscsogov.vercel.app";
const socialPreview = `${siteUrl}/api/social-card?v=20260822-1`;

const baseMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Los Santos County Sheriff’s Office",
    template: "%s | LSCSO",
  },
  description: "The official website of the Los Santos County Sheriff’s Office, serving Los Santos County since 1963.",
  icons: {
    icon: "/images/lscso-patch-color.png",
    apple: "/images/lscso-patch-color.png",
  },
  alternates: { canonical: siteUrl },
  openGraph: {
    title: "Los Santos County Sheriff’s Office",
    description: "Driven to Protect. Dedicated to Serve. Established 1963.",
    url: siteUrl,
    type: "website",
    siteName: "Los Santos County Sheriff’s Office",
    images: [{ url: socialPreview, width: 1200, height: 630, type: "image/png", alt: "Los Santos County Sheriff’s Office — Driven to Protect. Dedicated to Serve." }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Los Santos County Sheriff’s Office",
    description: "Driven to Protect. Dedicated to Serve. Established 1963.",
    images: [socialPreview],
  },
};

export async function generateMetadata(): Promise<Metadata> {
  const { active_theme } = await getSeasonalSettings();
  if (active_theme !== "standard") return baseMetadata;

  return {
    ...baseMetadata,
    icons: {
      icon: [{ url: "/images/lscso-original-main.webp", type: "image/webp" }],
      apple: [{ url: "/images/lscso-original-main.webp", type: "image/webp" }],
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#11110f",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const season = await getSeasonalSettings();
  return (
    <html lang="en" className={geist.variable} data-season={season.active_theme} data-season-intensity={season.intensity}>
      <body><SeasonalExperience initial={season}><PublicSiteFrame>{children}</PublicSiteFrame></SeasonalExperience></body>
    </html>
  );
}
