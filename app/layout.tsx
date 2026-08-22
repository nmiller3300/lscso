import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { SiteFooter } from "./_components/SiteFooter";
import { SiteHeader } from "./_components/SiteHeader";
import "./globals.css";

const geist = localFont({
  src: "./fonts/Geist.woff2",
  variable: "--font-geist",
  display: "swap",
});

const siteUrl = "https://lscsogov.vercel.app";
const socialPreview = `${siteUrl}/images/lscso-patch-color.png?v=discord-20260821`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Los Santos County Sheriff’s Office",
    template: "%s | LSCSO",
  },
  description:
    "The official website of the Los Santos County Sheriff’s Office, serving Los Santos County since 1963.",
  icons: {
    icon: "/images/lscso-patch-color.png",
    apple: "/images/lscso-patch-color.png",
  },
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    title: "Los Santos County Sheriff’s Office",
    description: "Driven to Protect. Dedicated to Serve. Established 1963.",
    url: siteUrl,
    type: "website",
    siteName: "Los Santos County Sheriff’s Office",
    images: [
      {
        url: socialPreview,
        width: 2048,
        height: 2048,
        type: "image/png",
        alt: "Los Santos County Sheriff’s Office patch",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Los Santos County Sheriff’s Office",
    description: "Driven to Protect. Dedicated to Serve. Established 1963.",
    images: [socialPreview],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#11110f",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={geist.variable}>
      <body>
        <SiteHeader />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
