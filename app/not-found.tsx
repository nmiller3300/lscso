import Link from "next/link";
import styles from "./not-found.module.css";

function Animated404Face() {
  return (
    <svg
      className={styles.face}
      viewBox="0 0 320 380"
      width="320"
      height="380"
      aria-hidden="true"
      focusable="false"
    >
      <g
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="25"
      >
        <g className={styles.eyes} transform="translate(0, 112.5)">
          <g transform="translate(15, 0)">
            <polyline className={styles.eyeLid} points="37,0 0,120 75,120" />
            <polyline
              className={styles.pupil}
              points="55,120 55,155"
              strokeDasharray="35 35"
            />
          </g>
          <g transform="translate(230, 0)">
            <polyline className={styles.eyeLid} points="37,0 0,120 75,120" />
            <polyline
              className={styles.pupil}
              points="55,120 55,155"
              strokeDasharray="35 35"
            />
          </g>
        </g>

        <rect
          className={styles.nose}
          rx="4"
          ry="4"
          x="132.5"
          y="112.5"
          width="55"
          height="155"
        />

        <g strokeDasharray="102 102" transform="translate(65, 334)">
          <path
            className={styles.mouthLeft}
            d="M 0 30 C 0 30 40 0 95 0"
            strokeDashoffset="-102"
          />
          <path
            className={styles.mouthRight}
            d="M 95 0 C 150 0 190 30 190 30"
            strokeDashoffset="102"
          />
        </g>
      </g>
    </svg>
  );
}

export default function NotFound() {
  return (
    <section className={styles.page}>
      <div className={styles.shell}>
        <div className={styles.animationWrap}>
          <Animated404Face />
        </div>

        <div className={styles.copy}>
          <p className={styles.kicker}>404 · Page Not Found</p>
          <h1>This page is outside our jurisdiction.</h1>
          <p>
            The address may have changed, the record may have moved, or the page may no longer be available.
          </p>
          <div className={styles.actions}>
            <Link className={styles.homeLink} href="/">
              Return to LSCSO Home <span aria-hidden="true">→</span>
            </Link>
            <Link className={styles.backLink} href="/about">
              About the Office
            </Link>
          </div>
          <div className={styles.agencyMark}>Los Santos County Sheriff&apos;s Office · Established 1963</div>
        </div>
      </div>
    </section>
  );
}
