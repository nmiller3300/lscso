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
    background_color: original ? "#181818" : "#11110f",
    theme_color: original ? "#181818" : "#11110f",
    icons: [
      {
        src: original ? "/images/lscso-original-main.webp" : "/images/lscso-patch-color.png",
        sizes: original ? "140x160" : "512x512",
        type: original ? "image/webp" : "image/png",
      },
    ],
  };
}
