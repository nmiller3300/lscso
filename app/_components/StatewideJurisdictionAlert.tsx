"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import styles from "./StatewideJurisdictionAlert.module.css";

type PublicPsa = {
  isActive: boolean;
  message: string;
};

export function StatewideJurisdictionAlert() {
  const pathname = usePathname();
  const [psa, setPsa] = useState<PublicPsa | null>(null);

  useEffect(() => {
    if (pathname !== "/") {
      setPsa(null);
      return;
    }

    const controller = new AbortController();
    fetch("/api/public/psa", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<PublicPsa>;
      })
      .then((body) => {
        if (body) setPsa(body);
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [pathname]);

  if (pathname !== "/" || !psa?.isActive || !psa.message.trim()) return null;

  const notice = psa.message.trim();
  const accessibleNotice = `PUBLIC SAFETY NOTICE — ${notice}`;

  return (
    <section
      className={styles.alert}
      aria-label={`Public safety notice: ${notice}`}
    >
      <span className={styles.screenReaderOnly}>{accessibleNotice}</span>
      <div className={styles.label} aria-hidden="true">
        <span className={styles.icon}>!</span>
        <strong>Public Safety Notice</strong>
      </div>
      <div className={styles.viewport} aria-hidden="true">
        <div className={styles.track}>
          <div className={styles.group}>
            <span>{notice}</span>
            <span>{notice}</span>
          </div>
          <div className={styles.group}>
            <span>{notice}</span>
            <span>{notice}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
