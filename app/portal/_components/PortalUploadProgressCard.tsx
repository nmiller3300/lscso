"use client";

import styles from "./PortalUploadProgressCard.module.css";

export type PortalUploadState = "idle" | "uploading" | "complete" | "error";

type Props = {
  state: PortalUploadState;
  fileName?: string | null;
  fileSize?: string | null;
  progress?: number | null;
  label?: string;
};

export function PortalUploadProgressCard({
  state,
  fileName,
  fileSize,
  progress = null,
  label = "Release file",
}: Props) {
  if (state === "idle") return null;

  const safeProgress = progress == null ? null : Math.max(0, Math.min(100, Math.round(progress)));
  const status = state === "uploading"
    ? "Uploading"
    : state === "complete"
      ? "Upload complete"
      : "Upload failed";

  return (
    <div className={`${styles.card} ${styles[state]}`} role="status" aria-live="polite">
      <div className={styles.folder} aria-hidden="true">
        <span className={styles.folderBack} />
        <span className={styles.paper} />
        <span className={styles.folderFront} />
        <b>{label}</b>
      </div>

      <div className={styles.body}>
        <div className={styles.heading}>
          <div className={styles.statusLine}>
            <span className={styles.stateIcon} aria-hidden="true">
              {state === "complete" ? "✓" : state === "error" ? "!" : ""}
            </span>
            <div>
              <strong>{status}</strong>
              <small>{fileName || "Preparing file"}{fileSize ? ` · ${fileSize}` : ""}</small>
            </div>
          </div>
          <span className={styles.percent}>{safeProgress == null ? (state === "complete" ? "100%" : "—") : `${safeProgress}%`}</span>
        </div>

        <div className={`${styles.track} ${safeProgress == null && state === "uploading" ? styles.indeterminate : ""}`} aria-hidden="true">
          <span style={safeProgress == null ? undefined : { width: `${state === "complete" ? 100 : safeProgress}%` }} />
        </div>
      </div>
    </div>
  );
}
