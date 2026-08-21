"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PortalProfile } from "@/lib/supabase/portal-types";

const PortalProfileContext = createContext<PortalProfile | null>(null);

export function PortalProfileProvider({
  profile,
  children,
}: {
  profile: PortalProfile;
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
