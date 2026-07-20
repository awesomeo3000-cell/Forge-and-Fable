"use client";

import { useEffect, useState } from "react";
import { Bell, CheckCheck, Mail, Settings2, X } from "lucide-react";
import type { NotificationPreferences, UserNotification } from "@/lib/notificationStore";

export default function NotificationInbox() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<UserNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [prefs, setPrefs] = useState<NotificationPreferences>({ dmInboxEnabled: false, dmEmailEnabled: false });
  const [error, setError] = useState("");

  const load = async (): Promise<boolean> => {
    const response = await fetch("/api/notifications");
    if (!response.ok) {
      setError("Could not load notifications.");
      return false;
    }
    const data = await response.json() as { notifications: UserNotification[]; unreadCount: number; preferences: NotificationPreferences };
    setItems(data.notifications); setUnread(data.unreadCount); setPrefs(data.preferences);
    setError("");
    return true;
  };
  // Inline, cancel-guarded fetch on mount (matches HomeDashboard) so the
  // state updates land after an explicit await boundary — the shape
  // react-hooks/set-state-in-effect accepts — and never after unmount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await fetch("/api/notifications");
      if (!response.ok || cancelled) return;
      const data = await response.json() as { notifications: UserNotification[]; unreadCount: number; preferences: NotificationPreferences };
      if (cancelled) return;
      setItems(data.notifications); setUnread(data.unreadCount); setPrefs(data.preferences);
    })();
    return () => { cancelled = true; };
  }, []);

  const toggle = async (key: keyof NotificationPreferences) => {
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
    if (!response.ok) { setPrefs(prefs); setError("Could not save notification preferences."); }
  };
  const markRead = async (id: string) => {
    const item = items.find((candidate) => candidate.id === id);
    const response = await fetch(`/api/notifications/${encodeURIComponent(id)}`, { method: "PATCH" });
    if (!response.ok) {
      setError("Could not update notification.");
      return;
    }
    setItems((current) => current.map((item) => item.id === id ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item));
    setUnread((count) => Math.max(0, count - (item?.readAt ? 0 : 1)));
  };
  const markAllRead = async () => {
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    if (!response.ok) {
      setError("Could not clear notifications.");
      return;
    }
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
    setUnread(0);
    setError("");
  };

  return <div className="notification-inbox-wrap">
    <button type="button" className="glass-icon ink-action ao-header-action" onClick={() => {
      const nextOpen = !open;
      setOpen(nextOpen);
      if (nextOpen) void (async () => { if (await load()) await markAllRead(); })();
    }} aria-label="Notifications" aria-expanded={open}><Bell size={17} />{unread > 0 ? <span className="notification-badge">{unread > 99 ? "99+" : unread}</span> : null}</button>
    {open ? <section className="notification-popover" aria-label="Notifications">
      <header className="notification-popover-header"><div><span className="ao-dash-eyebrow">Signal desk</span><h3>Notifications</h3></div><div className="notification-header-actions"><span className="notification-unread-count">{unread ? `${unread} unread` : "All caught up"}</span><button type="button" onClick={() => setOpen(false)} aria-label="Close notifications"><X size={15} /></button></div></header>
      <div className="notification-preferences"><div className="notification-preferences-heading"><Settings2 size={14} aria-hidden="true" /><span>Delivery</span></div><label><input type="checkbox" checked={prefs.dmInboxEnabled} onChange={() => void toggle("dmInboxEnabled")} /><span><strong>In-app inbox</strong><small>Keep a campaign record here</small></span></label><label><input type="checkbox" checked={prefs.dmEmailEnabled} onChange={() => void toggle("dmEmailEnabled")} /><span><strong>Email alerts</strong><small>Send important DM activity by email</small></span></label></div>
      {error ? <p className="notification-error">{error}</p> : null}
      <div className="notification-list">{items.length === 0 ? <div className="notification-empty"><CheckCheck size={18} aria-hidden="true" /><p>No notifications yet.</p><small>DM activity will appear here when you opt in.</small></div> : items.map((item) => <button key={item.id} type="button" className={`notification-item${item.readAt ? " is-read" : ""}`} onClick={() => void markRead(item.id)}><span className="notification-item-icon"><Mail size={14} aria-hidden="true" /></span><span className="notification-item-copy"><strong>{item.title}</strong><span>{item.body}</span><time>{new Date(item.createdAt).toLocaleString()}</time></span><span className="notification-item-state">{item.readAt ? "Read" : "New"}</span></button>)}</div>
    </section> : null}
  </div>;
}
