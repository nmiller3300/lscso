"use client";

import Link from "next/link";
import styles from "./PortalNotificationStack.module.css";

export type NotificationStackItem = {
  id: string;
  title: string;
  message: string;
  href: string | null;
  createdAt: string;
  type: string;
};

type Props = {
  actionCount: number;
  unreadCount: number;
  notifications: NotificationStackItem[];
  onDismiss: () => void;
};

function timeLabel(value: string) {
  const when = new Date(value);
  if (Number.isNaN(when.getTime())) return "New";
  const minutes = Math.max(0, Math.round((Date.now() - when.getTime()) / 60000));
  if (minutes < 1) return "Now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h` : when.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function PortalNotificationStack({ actionCount, unreadCount, notifications, onDismiss }: Props) {
  const availableSlots = actionCount > 0 ? 2 : 3;
  const cards: Array<{
    id: string;
    kicker: string;
    title: string;
    message: string;
    href: string;
    time: string;
    urgent?: boolean;
  }> = [];

  if (actionCount > 0) {
    cards.push({
      id: "action-required",
      kicker: "Action required",
      title: `${actionCount} item${actionCount === 1 ? "" : "s"} require${actionCount === 1 ? "s" : ""} review`,
      message: unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? " is" : "s are"} also waiting.` : "Open the Action Center for the pending workflow.",
      href: "/portal/notifications#action-required",
      time: "Now",
      urgent: true,
    });
  }

  for (const notification of notifications.slice(0, availableSlots)) {
    cards.push({
      id: notification.id,
      kicker: notification.type || "Portal notification",
      title: notification.title,
      message: notification.message,
      href: notification.href || "/portal/notifications",
      time: timeLabel(notification.createdAt),
    });
  }

  if (!cards.length) return null;

  return (
    <aside className={styles.stack} aria-label="New portal activity" aria-live="polite">
      <button className={styles.dismiss} type="button" onClick={onDismiss} aria-label="Dismiss portal activity stack">×</button>
      <div className={styles.cards}>
        {cards.map((card, index) => (
          <Link
            key={card.id}
            className={`${styles.card} ${card.urgent ? styles.urgent : ""}`}
            href={card.href}
          >
            <div className={styles.icon} aria-hidden="true">{card.urgent ? "!" : String(index + 1).padStart(2, "0")}</div>
            <div className={styles.copy}>
              <div className={styles.meta}><span>{card.kicker}</span><time>{card.time}</time></div>
              <strong>{card.title}</strong>
              <p>{card.message}</p>
            </div>
          </Link>
        ))}
      </div>
      <Link className={styles.review} href="/portal/notifications">Notification &amp; Action Center →</Link>
    </aside>
  );
}
