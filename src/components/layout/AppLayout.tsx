"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/common/Sidebar";
import ActiveUsers from "@/components/common/ActiveUsers";
import NotificationBell from "@/components/common/NotificationBell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";

  if (isLoginPage) {
    return <main className="flex-1">{children}</main>;
  }

  return (
    <>
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-end px-6 shrink-0 z-10 shadow-sm">
          <div className="flex items-center gap-4">
            <NotificationBell />
            <div className="h-6 w-px bg-slate-200"></div>
            <ActiveUsers />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto relative">
          {children}
        </main>
      </div>
    </>
  );
}
