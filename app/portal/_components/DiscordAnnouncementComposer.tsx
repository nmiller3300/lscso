"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { usePortalProfile } from "./PortalProfileProvider";
import styles from "./DiscordAnnouncementComposer.module.css";

type AnnouncementHistoryItem = {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  discord_message_id: string | null;
  issued_by_display_name: string;
  issued_by_rank: string;
  sent_at: string;
};

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export function DiscordAnnouncementComposer() {
  const profile = usePortalProfile();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [history, setHistory] = useState<AnnouncementHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const response = await fetch("/api/portal/announcements", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Announcement history could not be loaded.");
      setHistory(Array.isArray(body.announcements) ? body.announcements : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Announcement history could not be loaded.");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(imageFile);
    setImagePreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [imageFile]);

  const canSend = title.trim().length > 0 && message.trim().length > 0 && !pending;
  const formattedIssuer = `${profile.rank} ${profile.display_name}`;
  const previewMessage = useMemo(() => message.trim() || "Your announcement message will appear here.", [message]);

  function chooseImage(file: File | null) {
    setError("");
    if (!file) {
      setImageFile(null);
      return;
    }
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
      setImageFile(null);
      setError("Images must be PNG, JPG, or WebP.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageFile(null);
      setError("Announcement images must be 4 MB or smaller.");
      return;
    }
    setImageFile(file);
  }

  async function sendAnnouncement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) return;

    setError("");
    setNotice("");

    const approved = window.confirm(
      "Send this announcement to the LSCSO Discord and notify the @LSCSO role? This action will be recorded in the Command announcement history.",
    );
    if (!approved) return;

    setPending(true);
    try {
      const form = new FormData();
      form.set("title", title.trim());
      form.set("message", message.trim());
      if (imageFile) form.set("image", imageFile);

      const response = await fetch("/api/portal/announcements", {
        method: "POST",
        body: form,
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "The announcement could not be sent.");

      setTitle("");
      setMessage("");
      setImageFile(null);
      setNotice("Announcement sent to Discord and the LSCSO role was notified.");
      await loadHistory();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "The announcement could not be sent.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.workspace}>
      <form className={styles.composer} onSubmit={sendAnnouncement}>
        <section className={`portal-panel ${styles.panel}`}>
          <div className="portal-panel-heading">
            <div><p>Command communications</p><h2>Compose announcement</h2></div>
            <span>CAPTAIN+</span>
          </div>

          <div className={styles.authorityNotice}>
            <div className={styles.authoritySeal}>LS</div>
            <div>
              <strong>Official department broadcast</strong>
              <span>Sending publishes directly to the configured LSCSO Discord channel and pings the LSCSO role. The webhook never leaves the server.</span>
            </div>
          </div>

          <div className={styles.formStack}>
            <label>
              Announcement title
              <input
                maxLength={256}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Command Staff Announcement"
                value={title}
              />
              <small>{title.length}/256 characters</small>
            </label>

            <label>
              Message
              <textarea
                maxLength={3900}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Write the announcement exactly as personnel should receive it…"
                rows={9}
                value={message}
              />
              <small>{message.length}/3900 characters · Discord formatting such as **bold** and links is supported.</small>
            </label>

            <div className={styles.imageField}>
              <div>
                <strong>Announcement image <span>optional</span></strong>
                <small>PNG, JPG, or WebP · maximum 4 MB · displayed full-width inside the Discord embed.</small>
              </div>
              <label className={styles.fileButton}>
                {imageFile ? "Replace image" : "Choose image"}
                <input
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => chooseImage(event.target.files?.[0] ?? null)}
                  type="file"
                />
              </label>
            </div>

            {imageFile ? (
              <div className={styles.selectedImage}>
                <span>{imageFile.name}</span>
                <small>{(imageFile.size / 1024 / 1024).toFixed(2)} MB</small>
                <button onClick={() => setImageFile(null)} type="button">Remove</button>
              </div>
            ) : null}
          </div>

          {error ? <div className="portal-form-error" role="alert">{error}</div> : null}
          {notice ? (
            <div className={`portal-form-protection ${styles.success}`} role="status">
              <strong>Announcement delivered</strong>
              <span>{notice}</span>
            </div>
          ) : null}

          <div className={styles.sendRow}>
            <div>
              <span className={styles.rolePing}>@LSCSO</span>
              <small>Role ID 1540544832597135481 will be notified.</small>
            </div>
            <button className="portal-button portal-button--primary" disabled={!canSend} type="submit">
              {pending ? "Sending to Discord…" : "Send announcement"}
            </button>
          </div>
        </section>
      </form>

      <section className={`portal-panel ${styles.previewPanel}`}>
        <div className="portal-panel-heading">
          <div><p>Live preview</p><h2>Discord presentation</h2></div>
          <span>PREVIEW</span>
        </div>

        <div className={styles.discordCanvas}>
          <div className={styles.discordPing}>@LSCSO</div>
          <article className={styles.discordEmbed}>
            <div className={styles.embedAccent} />
            <div className={styles.embedBody}>
              <div className={styles.embedAuthor}>
                <Image alt="" height={24} src="/images/lscso-patch-color.png" width={24} />
                <span>LOS SANTOS COUNTY SHERIFF&apos;S OFFICE · COMMAND</span>
              </div>
              <h3>{title.trim() || "Announcement title"}</h3>
              <p>{previewMessage}</p>
              <div className={styles.embedFields}>
                <div><span>ISSUED BY</span><strong>{formattedIssuer}</strong></div>
                <div><span>OFFICIAL NOTICE</span><strong>Los Santos County Sheriff&apos;s Office</strong></div>
              </div>
              {imagePreview ? (
                <Image
                  alt="Announcement preview"
                  className={styles.embedImage}
                  height={500}
                  src={imagePreview}
                  unoptimized
                  width={900}
                />
              ) : null}
              <div className={styles.embedFooter}>
                <Image alt="" height={18} src="/images/lscso-patch-color.png" width={18} />
                <span>LSCSO Command Announcement · Sent when published</span>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className={`portal-panel ${styles.historyPanel}`}>
        <div className="portal-panel-heading">
          <div><p>Permanent activity</p><h2>Recent announcements</h2></div>
          <span>{history.length} RECORDS</span>
        </div>

        {historyLoading ? (
          <div className="portal-empty-state"><strong>Loading announcement history…</strong></div>
        ) : history.length === 0 ? (
          <div className="portal-empty-state"><strong>No Command announcements have been sent yet.</strong></div>
        ) : (
          <div className={styles.historyList}>
            {history.map((item) => (
              <article className={styles.historyItem} key={item.id}>
                <div className={styles.historyMark}>LS</div>
                <div className={styles.historyCopy}>
                  <div><strong>{item.title}</strong><time>{new Date(item.sent_at).toLocaleString()}</time></div>
                  <p>{item.body}</p>
                  <small>Issued by {item.issued_by_rank} {item.issued_by_display_name}{item.image_url ? " · Image attached" : ""}</small>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
