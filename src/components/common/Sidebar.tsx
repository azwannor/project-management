"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { LayoutDashboard, Headset, Settings, LogOut, Menu, X, Activity, Wrench } from "lucide-react";
import { Suspense, useState, useEffect } from "react";

function SidebarContent({ isOpen, setIsOpen }: { isOpen?: boolean, setIsOpen?: (val: boolean) => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Close sidebar on route change on mobile
  useEffect(() => {
    if (setIsOpen) setIsOpen(false);
  }, [pathname, searchParams, setIsOpen]);

  const menuItems = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: Activity,
    },
    {
      name: "Project Management",
      href: "/projects",
      icon: LayoutDashboard,
    },
    {
      name: "Support & Operasional",
      href: "/support",
      icon: Headset,
    },
    {
      name: "Maintenance",
      href: "/maintenance",
      icon: Wrench,
    },
  ];

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity" 
          onClick={() => setIsOpen && setIsOpen(false)} 
        />
      )}

      {/* Sidebar Container */}
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-64 h-screen flex flex-col bg-white border-r border-slate-200 shrink-0 transform transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} shadow-2xl md:shadow-none`}>
        <div className="p-6 flex items-center justify-between border-b border-white/20">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-blue-500/20 text-xs">
              IT
            </div>
            <h2 className="font-bold text-gray-800 text-lg tracking-tight">IT Tracker</h2>
          </div>
          <button 
            className="md:hidden p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white/40 rounded-lg transition-colors"
            onClick={() => setIsOpen && setIsOpen(false)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

      <nav className="flex-1 py-6 px-4 flex flex-col gap-1.5">
        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 px-3">Main Menu</div>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.startsWith(item.href);
          
          return (
            <div key={item.href}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "bg-white/70 text-blue-800 shadow-sm border border-white/60 font-semibold"
                    : "text-gray-600 hover:bg-white/40 hover:text-gray-800 font-medium"
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? "text-blue-700" : "text-gray-400"}`} />
                <span className="text-sm">{item.name}</span>
              </Link>
              
              {item.name === "Project Management" && isActive && (
                <div className="ml-8 mt-1.5 space-y-1 border-l-2 border-blue-200/60 pl-3">
                  <Link 
                    href="/projects?module=project" 
                    className={`block px-3 py-2 text-sm rounded-lg transition-all ${searchParams.get("module") !== "task" ? "bg-white/70 text-blue-800 font-bold shadow-sm" : "text-gray-500 hover:bg-white/30 hover:text-gray-700 font-medium"}`}
                  >
                    Project
                  </Link>
                  <Link 
                    href="/projects?module=task" 
                    className={`block px-3 py-2 text-sm rounded-lg transition-all ${searchParams.get("module") === "task" ? "bg-white/70 text-blue-800 font-bold shadow-sm" : "text-gray-500 hover:bg-white/30 hover:text-gray-700 font-medium"}`}
                  >
                    Task
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/20 space-y-1">
        <UserMenu />
      </div>
    </aside>
    </>
  );
}

import { useRouter } from 'next/navigation';

function UserMenu() {
  const [user, setUser] = useState<any>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const router = useRouter();
  
  useEffect(() => {
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.user) setUser(data.user);
      })
      .catch(console.error);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-3">
      {user && (
        <div className="flex items-center gap-3 px-3 py-2 bg-white/50 rounded-xl border border-white/60 shadow-sm">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-100 to-indigo-100 flex items-center justify-center text-blue-600 font-bold text-sm overflow-hidden shrink-0">
            {user.photo ? <img src={user.photo} alt={user.name} className="w-full h-full object-cover" /> : user.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-800 truncate">{user.name}</p>
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">{user.role}</p>
          </div>
        </div>
      )}
      <div className="space-y-1 relative">
        <Link href="/settings" className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-gray-600 hover:bg-white/60 hover:text-gray-800 transition-all font-medium text-sm">
          <Settings className="w-4 h-4 text-gray-400" />
          Settings
        </Link>
        
        {isConfirming ? (
          <div className="absolute bottom-full left-0 w-full mb-2 p-3 bg-white border border-gray-200 shadow-xl rounded-xl z-50">
            <p className="text-xs font-bold text-gray-800 mb-2 text-center">Yakin ingin logout?</p>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsConfirming(false)} 
                className="flex-1 py-1.5 px-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium rounded-lg transition-colors"
              >
                Batal
              </button>
              <button 
                onClick={handleLogout} 
                className="flex-1 py-1.5 px-2 bg-red-500 hover:bg-red-600 text-white text-xs font-medium rounded-lg transition-colors"
              >
                Ya, Logout
              </button>
            </div>
          </div>
        ) : null}

        <button 
          onClick={() => setIsConfirming(true)} 
          className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-red-500 hover:bg-red-50/80 hover:text-red-600 transition-all font-medium text-sm"
        >
          <LogOut className="w-4 h-4 opacity-80" />
          Logout
        </button>
      </div>
    </div>
  );
}

export default function Sidebar({ isOpen, setIsOpen }: { isOpen?: boolean, setIsOpen?: (val: boolean) => void }) {
  return (
    <Suspense fallback={<div className="w-64 h-screen bg-white/20" />}>
      <SidebarContent isOpen={isOpen} setIsOpen={setIsOpen} />
    </Suspense>
  );
}
