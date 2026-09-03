"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { NotificationCategory, NotificationPriority } from "@/lib/notifications/notification-meta";

export type NotificationCenterItem = { id: string; category: NotificationCategory; priority: NotificationPriority; title: string; detail: string; type: string; href: string | null; createdAt: string; read: boolean };
export type ActionCenterItem = { id: string; category: NotificationCategory; priority: NotificationPriority; title: string; detail: string; href: string; createdAt: string; status: string };
const categories: Array<NotificationCategory | "All"> = ["All", "Personnel", "Guardians", "Requests", "Training", "Recognition", "System"];
const priorityWeight: Record<NotificationPriority, number> = { Critical: 0, High: 1, Normal: 2, Low: 3 };
function formatWhen(value: string) { const date = new Date(value); if (Number.isNaN(date.getTime())) return ""; return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); }

export function PortalNotificationCenter({ initialNotifications, actionItems, scopeNotice }: { initialNotifications: NotificationCenterItem[]; actionItems: ActionCenterItem[]; scopeNotice?: string | null }) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [category, setCategory] = useState<NotificationCategory | "All">("All");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [notice, setNotice] = useState("");
  const filteredNotifications = useMemo(() => notifications.filter((item) => (category === "All" || item.category === category) && (!unreadOnly || !item.read)), [category, notifications, unreadOnly]);
  const groupedActions = useMemo(() => { const sorted = [...actionItems].sort((a,b) => priorityWeight[a.priority]-priorityWeight[b.priority] || new Date(a.createdAt).getTime()-new Date(b.createdAt).getTime()); const groups = new Map<NotificationCategory, ActionCenterItem[]>(); for (const item of sorted) groups.set(item.category,[...(groups.get(item.category)??[]),item]); return groups; }, [actionItems]);
  const unreadCount = notifications.filter((item) => !item.read).length;

  async function markRead(id: string) {
    const target = notifications.find((item) => item.id === id); if (!target || target.read) return;
    const { error } = await createClient().from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    if (error) { setNotice("That notification could not be updated. Please try again."); return; }
    setNotifications((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
  }
  async function markAllRead() {
    const ids = notifications.filter((item) => !item.read).map((item) => item.id); if (!ids.length) return;
    const { error } = await createClient().from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids);
    if (error) { setNotice("Notifications could not be marked as read. Please try again."); return; }
    setNotifications((current) => current.map((item) => ({ ...item, read: true }))); setNotice("Inbox marked as read."); window.setTimeout(() => setNotice(""), 2500);
  }

  return <div className="portal-notification-center">
    <section className="portal-panel portal-action-center" id="action-required"><div className="portal-panel-heading"><div><p>Action Center</p><h2>Needs your attention</h2></div><span>{actionItems.length ? `${actionItems.length} open` : "Caught up"}</span></div>{scopeNotice ? <div className="command-v2-inline-state"><strong>Your assigned review scope</strong><span>{scopeNotice}</span></div> : null}{actionItems.length ? <div className="portal-action-groups">{Array.from(groupedActions.entries()).map(([group,items]) => <section key={group}><div className="portal-action-group-head"><strong>{group}</strong><span>{items.length}</span></div><div className="portal-action-list">{items.map((item) => <Link className={`is-${item.priority.toLowerCase()}`} href={item.href} key={item.id}><span className="portal-action-priority">{item.priority}</span><div><strong>{item.title}</strong><p>{item.detail}</p><small>{item.status} · {formatWhen(item.createdAt)}</small></div><b>Open →</b></Link>)}</div></section>)}</div> : <div className="portal-empty-state"><strong>No pending actions require attention.</strong></div>}</section>
    <section className="portal-panel portal-inbox" id="inbox"><div className="portal-panel-heading portal-inbox-heading"><div><p>Inbox</p><h2>Notifications</h2></div><div className="portal-inbox-heading-actions"><span>{unreadCount ? `${unreadCount} unread` : "Caught up"}</span>{unreadCount ? <button className="portal-text-button" onClick={() => void markAllRead()} type="button">Mark all read</button> : null}</div></div><div className="portal-inbox-controls"><div className="command-v2-division-browser" aria-label="Notification categories">{categories.map((item) => <button className={category === item ? "is-active" : undefined} key={item} onClick={() => setCategory(item)} type="button"><strong>{item}</strong></button>)}</div><label className="portal-inbox-unread"><input checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} type="checkbox" /> Unread only</label></div><div className="portal-inbox-list">{filteredNotifications.map((item) => <article className={item.read ? "is-read" : ""} key={item.id}><span className={`portal-inbox-priority is-${item.priority.toLowerCase()}`}>{item.priority}</span><div><small>{item.category} · {item.type} · {formatWhen(item.createdAt)}</small><strong>{item.title}</strong><p>{item.detail}</p><div className="portal-activity-actions">{item.href ? <Link href={item.href} onClick={() => void markRead(item.id)}>Open</Link> : null}{!item.read ? <button onClick={() => void markRead(item.id)} type="button">Mark read</button> : null}</div></div><b>{item.read ? "Read" : "New"}</b></article>)}{!filteredNotifications.length ? <div className="portal-empty-state"><strong>No notifications match this view.</strong></div> : null}</div></section>
    {notice ? <div className="portal-toast" role="status">{notice}</div> : null}
  </div>;
}
