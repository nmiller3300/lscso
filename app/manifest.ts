import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Los Santos County Sheriff’s Office",
    short_name: "LSCSO",
    description: "LSCSO public website and Personnel Operations portal.",
    start_url: "/portal",
    display: "standalone",
    background_color: "#11110f",
    theme_color: "#11110f",
    icons: [
      {
        src: "/images/lscso-patch-color.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
