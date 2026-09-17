"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export function ApplicantStatusLiveRefresh({ token, initialVersion }: { token: string; initialVersion: string }) {
  const router = useRouter();
  const versionRef = useRef(initialVersion);
  const refreshingRef = useRef(false);

  useEffect(() => {
    versionRef.current = initialVersion;
  }, [initialVersion]);

  useEffect(() => {
    let cancelled = false;

    async function checkForChanges() {
      if (cancelled || refreshingRef.current || document.visibilityState === "hidden") return;
      refreshingRef.current = true;
      try {
        const response = await fetch(`/api/applications/tracking/${encodeURIComponent(token)}`, {
          method: "GET",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });

        if (cancelled) return;
        if (response.status === 404) {
          router.refresh();
          return;
        }
        if (!response.ok) return;

        const data = await response.json();
        const nextVersion = typeof data?.version === "string" ? data.version : "";
        if (nextVersion && nextVersion !== versionRef.current) {
          versionRef.current = nextVersion;
          router.refresh();
        }
      } catch {
        // A temporary network interruption should not break the applicant page.
      } finally {
        refreshingRef.current = false;
      }
    }

    const interval = window.setInterval(() => void checkForChanges(), 5000);
    const onFocus = () => void checkForChanges();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void checkForChanges();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, token]);

  return null;
}
