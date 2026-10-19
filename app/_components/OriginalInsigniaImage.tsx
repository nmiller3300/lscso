"use client";

import Image, { type ImageProps } from "next/image";
import { useSeasonalAppearance } from "./SeasonalExperience";

/** Original identity artwork while seasonal pages preserve their original images. */
export function OriginalInsigniaImage({
  legacySrc,
  ...props
}: Omit<ImageProps, "src"> & { legacySrc: string }) {
  const appearance = useSeasonalAppearance();
  const src = appearance.active_theme === "standard"
    ? "/images/lscso-original-main.webp"
    : legacySrc;
  return <Image {...props} src={src} />;
}
