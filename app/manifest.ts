import type { MetadataRoute } from "next";
import { getSeasonalSettings } from "@/lib/seasonal/server";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const original = (await getSeasonalSettings()).active_theme === "standard";
  return {
    name: "Los Santos County Sheriff’s Office",
    short_name: "LSCSO",
    description: "LSCSO public website and Personnel Operations portal.",
    start_url: "/portal",
    display: "standalone",
    background_color: "#181818",
    theme_color: "#181818",
    icons: [
      {
        src: original ? "/images/lscso-original-main.webp" : "/images/lscso-patch-color.png",
        sizes: original ? "140x160" : "512x512",
        type: original ? "image/webp" : "image/png",
      },
    ],
  };
}
