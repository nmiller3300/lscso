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

export const metadata: Metadata = {
  metadataBase: new URL("https://lscsogov.vercel.app"),
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
  openGraph: {
    title: "Los Santos County Sheriff’s Office",
    description: "Driven to Protect. Dedicated to Serve. Established 1963.",
    type: "website",
    siteName: "Los Santos County Sheriff’s Office",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Los Santos County Sheriff’s Office — Driven to Protect. Dedicated to Serve.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Los Santos County Sheriff’s Office",
    description: "Driven to Protect. Dedicated to Serve. Established 1963.",
    images: ["/opengraph-image"],
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
