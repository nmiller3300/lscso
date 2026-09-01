import styles from "./StatewideJurisdictionAlert.module.css";

const notice = "PUBLIC SAFETY NOTICE — LSCSO HAS TEMPORARY STATEWIDE JURISDICTION BY ORDER OF THE GOVERNOR";

export function StatewideJurisdictionAlert() {
  return (
    <section
      className={styles.alert}
      aria-label="Public safety notice: LSCSO has temporary statewide jurisdiction by order of the Governor."
    >
      <span className={styles.screenReaderOnly}>{notice}</span>
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
