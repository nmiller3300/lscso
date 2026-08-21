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

export function DeputyNotificationCenter({ notifications }: { notifications: PortalNotificationItem[] }) {
  const unread = notifications.filter((item) => !item.read);
  const latest = unread[0] ?? notifications[0] ?? null;

  return (
    <section className="deputy-notification-summary" id="notifications" aria-label="Personnel notifications">
      <div>
        <span>Notifications</span>
        <strong>{unread.length ? `${unread.length} unread notification${unread.length === 1 ? "" : "s"}` : "No unread notifications"}</strong>
        <small>{latest ? `${latest.title} · ${latest.time}` : "Your notification inbox is caught up."}</small>
      </div>
      <div>
        <Link className="portal-button portal-button--primary" href="/portal/notifications#action-required">Action Center</Link>
        <Link className="portal-button portal-button--secondary" href="/portal/notifications#inbox">Open inbox</Link>
      </div>
    </section>
  );
}
