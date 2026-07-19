"use client";

import { useEffect, useState } from "react";
import { Bell, X } from "lucide-react";
import type { NotificationPreferences, UserNotification } from "@/lib/notificationStore";

export default function NotificationInbox() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<UserNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [prefs, setPrefs] = useState<NotificationPreferences>({ dmInboxEnabled: false, dmEmailEnabled: false });
  const [error, setError] = useState("");

  const load = async () => {
    const response = await fetch("/api/notifications");
    if (!response.ok) return;
    const data = await response.json() as { notifications: UserNotification[]; unreadCount: number; preferences: NotificationPreferences };
    setItems(data.notifications); setUnread(data.unreadCount); setPrefs(data.preferences);
  };
  useEffect(() => { void load(); }, []);

  const toggle = async (key: keyof NotificationPreferences) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
    if (!response.ok) { setPrefs(prefs); setError("Could not save notification preferences."); }
  };
  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${encodeURIComponent(id)}`, { method: "PATCH" });
    setItems((current) => current.map((item) => item.id === id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item));
    setUnread((count) => Math.max(0, count - (items.find((item) => item.id === id)?.readAt ? 0 : 1)));
  };

  return <div className="notification-inbox-wrap">
    <button type="button" className="glass-icon ink-action ao-header-action" onClick={() => { setOpen((value) => !value); if (!open) void load(); }} aria-label="Notifications" aria-expanded={open}><Bell size={17} />{unread > 0 ? <span className="notification-badge">{unread > 99 ? "99+" : unread}</span> : null}</button>
    {open ? <section className="notification-popover" aria-label="Notifications">
      <header><div><span className="ledger-eyebrow">Inbox</span><h3>DM notifications</h3></div><button type="button" onClick={() => setOpen(false)} aria-label="Close notifications"><X size={15} /></button></header>
      <div className="notification-preferences"><label><input type="checkbox" checked={prefs.dmInboxEnabled} onChange={() => void toggle("dmInboxEnabled")} /> In-app inbox</label><label><input type="checkbox" checked={prefs.dmEmailEnabled} onChange={() => void toggle("dmEmailEnabled")} /> Email alerts</label></div>
      {error ? <p className="notification-error">{error}</p> : null}
      <div className="notification-list">{items.length === 0 ? <p className="notification-empty">No notifications yet.</p> : items.map((item) => <button key={item.id} type="button" className={`notification-item${item.readAt ? " is-read" : ""}`} onClick={() => void markRead(item.id)}><strong>{item.title}</strong><span>{item.body}</span><time>{new Date(item.createdAt).toLocaleString()}</time></button>)}</div>
    </section> : null}
  </div>;
}
