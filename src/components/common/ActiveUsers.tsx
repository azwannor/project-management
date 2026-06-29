"use client";

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
    // Don't run on login page
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

    // Fetch immediately
    fetchPresence();

    // Fetch every 30 seconds
    const interval = setInterval(fetchPresence, 30000);
    return () => clearInterval(interval);
  }, [pathname]);

  if (activeUsers.length === 0) return null;

  return (
    <div className="flex items-center justify-end">
      <div className="flex -space-x-2 hover:-space-x-1 transition-all duration-300 bg-white p-1 rounded-full shadow-sm border border-slate-200">
        {activeUsers.map((user, idx) => (
          <div 
            key={user.id}
            className="w-8 h-8 rounded-full border-2 border-white bg-gradient-to-tr from-indigo-100 to-blue-50 flex items-center justify-center text-xs font-bold text-blue-700 shadow-sm relative group cursor-pointer hover:z-50"
            style={{ zIndex: activeUsers.length - idx }}
          >
            {user.photo ? (
              <img src={user.photo} alt={user.name} className="w-full h-full object-cover rounded-full" />
            ) : (
              user.name.charAt(0).toUpperCase()
            )}
            
            {/* Online indicator dot */}
            <span className="absolute bottom-0 right-0 w-2 h-2 bg-emerald-500 border border-white rounded-full"></span>
            
            {/* Tooltip */}
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap pointer-events-none">
              {user.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
