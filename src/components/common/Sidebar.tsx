"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import {
  LayoutGrid,
  FolderKanban,
  Headset,
  QrCode,
  Wrench,
  Settings,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { Suspense, useState, useEffect } from "react";
import { useI18n } from "@/i18n";
import { useUiPref } from "@/lib/ui-prefs";

function SidebarContent({
  isOpen,
  setIsOpen,
}: {
  isOpen?: boolean;
  setIsOpen?: (val: boolean) => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useI18n();
  const [collapsedPref, setCollapsedPref] = useUiPref("sidebar_collapsed", "false");
  const isCollapsed = collapsedPref === "true";

  const toggleCollapse = () => {
    setCollapsedPref(isCollapsed ? "false" : "true");
  };

  useEffect(() => {
    if (setIsOpen) setIsOpen(false);
  }, [pathname, searchParams, setIsOpen]);

  const menuItems = [
    { key: "overview", name: t.nav.overview, href: "/dashboard", icon: LayoutGrid },
    { key: "projects", name: t.nav.projects, href: "/projects", icon: FolderKanban },
    { key: "support", name: t.nav.support, href: "/support", icon: Headset },
    { key: "assets", name: t.nav.assets, href: "/maintenance", icon: QrCode },
    { key: "maint", name: t.nav.maintenance, href: "/maintenance?tab=schedules", icon: Wrench },
    { key: "settings", name: t.nav.settings, href: "/settings", icon: Settings },
  ];

  const isNavActive = (item: (typeof menuItems)[number]) => {
    if (item.key === "maint") {
      return pathname.startsWith("/maintenance") && searchParams.get("tab") === "schedules";
    }
    if (item.key === "assets") {
      return (
        (pathname.startsWith("/maintenance") && searchParams.get("tab") !== "schedules") ||
        pathname.startsWith("/assets")
      );
    }
    return pathname.startsWith(item.href);
  };

  return (
    <>
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-40 transition-opacity"
          onClick={() => setIsOpen && setIsOpen(false)}
        />
      )}

      {/* Desktop 240px (or 68px collapsed icon rail) & Tablet 68px Icon Rail */}
      <aside
        className={`no-print fixed md:relative inset-y-0 left-0 z-50 w-60 md:w-[68px] ${
          isCollapsed ? "lg:w-[68px]" : "lg:w-60"
        } h-screen flex flex-col bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] shrink-0 transform transition-all duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        }`}
      >
        {/* Desktop Collapse / Expand Rail Button */}
        <button
          type="button"
          onClick={toggleCollapse}
          aria-label={isCollapsed ? t.nav.expandMenu : t.nav.collapseMenu}
          title={isCollapsed ? t.nav.expandMenu : t.nav.collapseMenu}
          className="hidden lg:flex items-center justify-center absolute -right-3 top-[16px] w-6 h-6 rounded-full bg-[var(--bg-surface)] border border-[var(--border-strong)] shadow-sm text-[var(--text-ink2)] hover:text-[var(--brand)] hover:border-[var(--brand)] transition-colors z-50 cursor-pointer"
        >
          {isCollapsed ? (
            <PanelLeftOpen className="w-3.5 h-3.5" />
          ) : (
            <PanelLeftClose className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Brand Header */}
        <div
          className={`h-14 px-4 md:px-0 ${
            isCollapsed ? "lg:px-0 lg:justify-center" : "lg:px-5 lg:justify-between"
          } flex items-center justify-between md:justify-center border-b border-[var(--border-subtle)] shrink-0`}
        >
          <Link href="/dashboard" className="flex items-center gap-2.5" title={t.common.appName}>
            <Image
              src="/brand/crown-rmp.png"
              alt="Royal Medica"
              width={28}
              height={28}
              className="w-7 h-7 object-contain shrink-0"
              priority
            />
            <div
              className={`md:hidden ${isCollapsed ? "lg:hidden" : "lg:flex"} flex flex-col leading-none`}
            >
              <span className="font-mono-code text-[9px] font-bold tracking-[0.22em] text-[var(--brand)]">
                {t.common.brandTag}
              </span>
              <span className="font-heading text-[15px] font-bold tracking-tight text-[var(--text-ink)]">
                {t.common.appName}
              </span>
            </div>
          </Link>
          <button
            className="md:hidden p-1.5 text-[var(--text-muted)] hover:text-[var(--text-ink)] rounded-lg"
            onClick={() => setIsOpen && setIsOpen(false)}
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Primary Navigation */}
        <nav
          className={`flex-1 py-4 px-3 md:px-2 ${
            isCollapsed ? "lg:px-2" : "lg:px-3"
          } flex flex-col gap-1 overflow-y-auto`}
        >
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isNavActive(item);

            return (
              <div key={item.key}>
                <Link
                  href={item.href}
                  title={item.name}
                  className={`flex items-center md:justify-center ${
                    isCollapsed ? "lg:justify-center lg:px-0" : "lg:justify-start lg:px-3"
                  } gap-3 px-3 md:px-0 py-2.5 rounded-xl transition-colors text-[13px] ${
                    active
                      ? "bg-[var(--brand-tint)] text-[var(--brand)] border border-[var(--brand-stroke)] font-semibold"
                      : "text-[var(--text-ink2)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-ink)] font-medium border border-transparent"
                  }`}
                >
                  <Icon className="w-[18px] h-[18px] shrink-0" />
                  <span
                    className={`md:hidden ${isCollapsed ? "lg:hidden" : "lg:inline"} truncate`}
                  >
                    {item.name}
                  </span>
                </Link>

                {item.key === "projects" && pathname.startsWith("/projects") && !isCollapsed && (
                  <div className="hidden lg:block ml-7 mt-1 space-y-1 border-l border-[var(--border-subtle)] pl-3">
                    <Link
                      href="/projects?module=project"
                      className={`block px-2.5 py-1.5 text-xs rounded-lg transition-colors ${
                        searchParams.get("module") !== "task"
                          ? "bg-[var(--brand-tint)] text-[var(--brand)] font-semibold"
                          : "text-[var(--text-muted)] hover:text-[var(--text-ink)]"
                      }`}
                    >
                      {t.nav.projectsShort}
                    </Link>
                    <Link
                      href="/projects?module=task"
                      className={`block px-2.5 py-1.5 text-xs rounded-lg transition-colors ${
                        searchParams.get("module") === "task"
                          ? "bg-[var(--brand-tint)] text-[var(--brand)] font-semibold"
                          : "text-[var(--text-muted)] hover:text-[var(--text-ink)]"
                      }`}
                    >
                      {t.nav.tasks}
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom User Profile & Sign Out */}
        <div
          className={`p-3 md:p-2 ${isCollapsed ? "lg:p-2" : "lg:p-3"} border-t border-[var(--border-subtle)]`}
        >
          <UserMenu isCollapsed={isCollapsed} />
        </div>
      </aside>
    </>
  );
}

interface SessionUser {
  userId?: string;
  name: string;
  role: string;
  photo?: string | null;
}

function UserMenu({ isCollapsed }: { isCollapsed: boolean }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(console.error);
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error(err);
    }
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "IT";

  return (
    <div className="space-y-2">
      {user && (
        <Link
          href="/settings"
          title={user.name}
          className={`flex items-center md:justify-center ${
            isCollapsed
              ? "lg:justify-center lg:px-1.5"
              : "lg:justify-start lg:px-2.5"
          } gap-2.5 px-2.5 md:px-1.5 py-2 bg-[var(--bg-canvas)] rounded-xl border border-[var(--border-subtle)] hover:border-[var(--brand-stroke)] transition-colors`}
        >
          <div className="w-8 h-8 rounded-full bg-[var(--brand)] text-white dark:text-[#161A26] flex items-center justify-center font-mono-code font-bold text-[11px] overflow-hidden shrink-0">
            {user.photo ? (
              <img src={user.photo} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>
          <div
            className={`md:hidden ${isCollapsed ? "lg:hidden" : "lg:block"} flex-1 min-w-0`}
          >
            <p className="text-xs font-semibold text-[var(--text-ink)] truncate">{user.name}</p>
            <p className="font-mono-code text-[9px] font-bold uppercase tracking-wider text-[var(--brand)] truncate">
              {user.role}
            </p>
          </div>
        </Link>
      )}

      {isConfirming ? (
        <div className="p-2 bg-[var(--err-bg)] border border-[var(--err-stroke)] rounded-xl space-y-1.5">
          <p
            className={`text-[11px] font-semibold text-[var(--err)] text-center md:hidden ${
              isCollapsed ? "lg:hidden" : "lg:block"
            }`}
          >
            {t.auth.signOut}?
          </p>
          <div className="flex gap-1.5">
            <button
              onClick={handleLogout}
              className="flex-1 py-1 bg-[var(--err)] text-white dark:text-[#161A26] text-[11px] font-semibold rounded-lg"
            >
              {t.common.yes}
            </button>
            <button
              onClick={() => setIsConfirming(false)}
              className="flex-1 py-1 bg-[var(--bg-surface)] text-[var(--text-ink2)] text-[11px] font-semibold rounded-lg border border-[var(--border-subtle)]"
            >
              {t.common.no}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsConfirming(true)}
          title={t.auth.signOut}
          className={`w-full flex items-center md:justify-center ${
            isCollapsed ? "lg:justify-center lg:px-0" : "lg:justify-start lg:px-3"
          } gap-2.5 px-3 md:px-0 py-2 text-[var(--err)] hover:bg-[var(--err-bg)] rounded-xl transition-colors text-xs font-semibold cursor-pointer`}
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span className={`md:hidden ${isCollapsed ? "lg:hidden" : "lg:inline"}`}>
            {t.auth.signOut}
          </span>
        </button>
      )}
    </div>
  );
}

export default function Sidebar(props: { isOpen?: boolean; setIsOpen?: (val: boolean) => void }) {
  return (
    <Suspense
      fallback={
        <div className="hidden md:block w-[68px] lg:w-60 h-screen bg-[var(--bg-surface)] border-r border-[var(--border-subtle)]" />
      }
    >
      <SidebarContent {...props} />
    </Suspense>
  );
}
