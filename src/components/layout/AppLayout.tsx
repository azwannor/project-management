"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import Sidebar from "@/components/common/Sidebar";
import ActiveUsers from "@/components/common/ActiveUsers";
import NotificationBell from "@/components/common/NotificationBell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === "/login";
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  if (isLoginPage) {
    return <main className="flex-1">{children}</main>;
  }

  const getPageTitle = (path: string) => {
    if (path === '/') return 'Dashboard';
    if (path.startsWith('/projects')) return 'Project Management';
    if (path.startsWith('/support')) return 'Support & Operasional';
    if (path.startsWith('/maintenance')) return 'Maintenance';
    if (path.startsWith('/settings')) return 'Settings';
    return '';
  };

  return (
    <>
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-50">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-3 md:px-6 shrink-0 z-50 relative shadow-sm gap-2">
          <div className="flex items-center gap-2 overflow-hidden min-w-0">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-1.5 -ml-1 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="font-bold text-slate-800 text-base md:text-lg truncate">
              {getPageTitle(pathname)}
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <NotificationBell />
            <div className="h-6 w-px bg-slate-200 hidden md:block"></div>
            <ActiveUsers />
          </div>
        </header>
        <main className="flex-1 overflow-x-hidden overflow-y-auto relative flex flex-col">
          {children}
        </main>
      </div>
    </>
  );
}
