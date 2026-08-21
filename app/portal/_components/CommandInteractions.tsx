"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type PortalNotificationItem = {
  id: string;
  time: string;
  title: string;
  detail: string;
  type: string;
  href: string | null;
  read: boolean;
};

async function persistRead(id: string) {
  return createClient().from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
}

export function CommandActivity({ notifications: initialNotifications }: { notifications: PortalNotificationItem[] }) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [notice, setNotice] = useState("");

  async function markRead(id: string) {
    const item = notifications.find((candidate) => candidate.id === id);
    if (!item || item.read || id.startsWith("activity-")) return;
    const { error } = await persistRead(id);
    if (error) {
      setNotice(error.message);
      return;
    }
    setNotifications((current) => current.map((candidate) => candidate.id === id ? { ...candidate, read: true } : candidate));
  }

  async function markAllRead() {
    const unreadIds = notifications.filter((item) => !item.read && !item.id.startsWith("activity-")).map((item) => item.id);
    if (!unreadIds.length) return;
    const { error } = await createClient().from("notifications").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
    if (error) {
      setNotice(error.message);
      return;
    }
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
    setNotice("Notifications marked as read.");
    window.setTimeout(() => setNotice(""), 3000);
  }

  const unreadCount = notifications.filter((item) => !item.read).length;

  return (
    <section className="portal-panel portal-activity" id="notifications">
      <span aria-hidden="true" id="audit" />
      <div className="portal-panel-heading">
        <div><p>Notification center</p><h2>Recent activity</h2></div>
        <span>{unreadCount ? `${unreadCount} unread` : "Caught up"}</span>
      </div>
      <div className="portal-activity-list">
        {notifications.map((item) => (
          <div className={`portal-activity-item${item.read ? " is-read" : ""}`} key={item.id}>
            <span />
            <div>
              <small>{item.type} · {item.time}</small>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
              <div className="portal-activity-actions">
                {item.href ? <Link href={item.href} onClick={() => void markRead(item.id)}>Open</Link> : null}
                {!item.read && !item.id.startsWith("activity-") ? <button onClick={() => void markRead(item.id)} type="button">Mark read</button> : null}
              </div>
            </div>
            <b>{item.read ? "Read" : "New"}</b>
          </div>
        ))}
        {notifications.length === 0 ? (
          <div className="portal-empty-state"><strong>No recent personnel activity.</strong></div>
        ) : null}
      </div>
      {unreadCount ? <button className="portal-text-button" onClick={() => void markAllRead()} type="button">Mark all read</button> : null}
      {notice ? <div className="portal-toast" role="status">{notice}</div> : null}
    </section>
  );
}

export function DeputyNotificationCenter({ notifications: initialNotifications }: { notifications: PortalNotificationItem[] }) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [notice, setNotice] = useState("");

  async function markRead(id: string) {
    const { error } = await persistRead(id);
    if (error) {
      setNotice(error.message);
      return;
    }
    setNotifications((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
  }

  if (!notifications.length) return <span id="notifications" />;

  return (
    <>
      <section className="deputy-alert-row" id="notifications" aria-label="Personnel notifications">
        {notifications.map((notification, index) => (
          <article className={notification.read ? "is-read" : undefined} key={notification.id}>
            <span>{String(index + 1).padStart(2, "0")}</span>
            <div><strong>{notification.title}</strong><p>{notification.detail}</p></div>
            <small>{notification.time}</small>
            {!notification.read ? <button onClick={() => void markRead(notification.id)} type="button">Mark read</button> : <b>Read</b>}
          </article>
        ))}
      </section>
      {notice ? <div className="portal-toast" role="status">{notice}</div> : null}
    </>
  );
}
