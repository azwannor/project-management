"use client";

import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { useRouter } from "next/navigation";

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  link?: string | null;
  createdAt: string;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    const loadNotifications = async () => {
      try {
        const res = await fetch("/api/notifications");
        if (res.ok && active) {
          const data = await res.json();
          setNotifications(data);
        }
      } catch (err) {
        console.error("Failed to fetch notifications", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadNotifications();
    const interval = setInterval(() => void loadNotifications(), 60000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      });
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch (err) {
      console.error(err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await fetch("/api/notifications", { method: "PATCH" });
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.isRead) {
      await markAsRead(notif.id);
    }
    setIsOpen(false);
    if (notif.link) {
      router.push(notif.link);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        className="relative p-2 text-[var(--text-ink2)] hover:text-[var(--text-ink)] hover:bg-[var(--bg-subtle)] rounded-full transition-colors"
      >
        <Bell className="w-[18px] h-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[var(--err)] rounded-full ring-2 ring-[var(--bg-surface)]" />
        )}
      </button>

      {isOpen && (
        <div className="absolute -right-[60px] md:right-0 mt-2 w-[300px] md:w-80 max-w-[calc(100vw-24px)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[80vh]">
          <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex justify-between items-center bg-[var(--bg-canvas)]">
            <h3 className="font-heading font-semibold text-[var(--text-ink)] text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-[var(--brand)] hover:underline font-medium"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-4 text-center text-sm text-[var(--text-muted)]">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-[var(--text-muted)] flex flex-col items-center">
                <Bell className="w-8 h-8 opacity-30 mb-2" />
                <p>No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--border-subtle)]">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => handleNotificationClick(notif)}
                    className={`p-3.5 hover:bg-[var(--bg-subtle)] cursor-pointer transition-colors flex gap-3 ${
                      !notif.isRead ? "bg-[var(--brand-tint)]/60" : ""
                    }`}
                  >
                    {!notif.isRead && (
                      <div className="w-2 h-2 bg-[var(--brand)] rounded-full mt-1.5 shrink-0" />
                    )}
                    <div className={notif.isRead ? "pl-2" : ""}>
                      <h4
                        className={`text-sm ${
                          !notif.isRead
                            ? "font-semibold text-[var(--text-ink)]"
                            : "font-medium text-[var(--text-ink2)]"
                        }`}
                      >
                        {notif.title}
                      </h4>
                      <p className="text-xs text-[var(--text-ink2)] mt-0.5 leading-relaxed">
                        {notif.message}
                      </p>
                      <span className="font-mono-code text-[10px] text-[var(--text-muted)] mt-1 block">
                        {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
