"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PortalProfile } from "@/lib/supabase/portal-types";

export type PortalProfileContextValue = PortalProfile & {
  hiring_authority?: boolean;
};

const PortalProfileContext = createContext<PortalProfileContextValue | null>(null);

export function PortalProfileProvider({
  profile,
  children,
}: {
  profile: PortalProfileContextValue;
  children: ReactNode;
}) {
  return (
    <PortalProfileContext.Provider value={profile}>
      {children}
    </PortalProfileContext.Provider>
  );
}

export function usePortalProfile() {
  const profile = useContext(PortalProfileContext);
  if (!profile) throw new Error("Portal profile context is unavailable.");
  return profile;
}
