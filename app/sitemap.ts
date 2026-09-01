import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://lscsogov.vercel.app";
  // Department policy access is intentionally restricted to the authenticated Personnel Portal.
  const routes = [
    "",
    "/about",
    "/office-of-the-sheriff",
    "/patrol",
    "/internal-affairs",
    "/training-recruitment",
  ];

  return routes.map((route) => ({
    url: `${base}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.8,
  }));
}
