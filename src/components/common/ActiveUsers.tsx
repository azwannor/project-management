"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

interface ActiveUser {
  id: string;
  name: string;
  photo: string | null;
  lastActiveAt: string;
}

export default function ActiveUsers() {
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/login") return;

    const fetchPresence = async () => {
      try {
        const res = await fetch("/api/users/presence", { method: "POST" });
        if (res.ok) {
          const data = await res.json();
          setActiveUsers(data);
        }
      } catch (e) {
        console.error("Failed to fetch presence", e);
      }
    };

    fetchPresence();
    const interval = setInterval(fetchPresence, 30000);
    return () => clearInterval(interval);
  }, [pathname]);

  if (activeUsers.length === 0) return null;

  return (
    <div className="flex items-center justify-end">
      <div className="flex items-center gap-1 bg-[var(--bg-subtle)] p-1 rounded-full border border-[var(--border-subtle)]">
        {activeUsers.map((user, idx) => (
          <div
            key={user.id}
            className="w-7 h-7 rounded-full border-2 border-[var(--bg-surface)] bg-[var(--brand-tint)] flex items-center justify-center text-[11px] font-bold text-[var(--brand)] relative group cursor-pointer hover:z-50"
            style={{ zIndex: activeUsers.length - idx }}
          >
            {user.photo ? (
              <Image
                src={user.photo}
                alt={user.name}
                width={28}
                height={28}
                unoptimized
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              user.name.charAt(0).toUpperCase()
            )}

            <span className="absolute bottom-0 right-0 w-2 h-2 bg-[var(--ok)] border border-[var(--bg-surface)] rounded-full" />

            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-ink)] shadow-md text-[10px] font-medium px-2 py-1 rounded-md whitespace-nowrap pointer-events-none z-50">
              {user.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
