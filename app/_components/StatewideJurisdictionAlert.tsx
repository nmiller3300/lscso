"use client";

import { usePathname } from "next/navigation";
import styles from "./StatewideJurisdictionAlert.module.css";

const notice = "LSCSO HAS TEMPORARY STATEWIDE JURISDICTION BY ORDER OF THE GOVERNOR";
const accessibleNotice = `PUBLIC SAFETY NOTICE — ${notice}`;

export function StatewideJurisdictionAlert() {
  const pathname = usePathname();

  if (pathname !== "/") return null;

  return (
    <section
      className={styles.alert}
      aria-label="Public safety notice: LSCSO has temporary statewide jurisdiction by order of the Governor."
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
