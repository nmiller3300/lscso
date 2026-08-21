import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: "/portal" },
    sitemap: "https://lscsogov.vercel.app/sitemap.xml",
  };
}
