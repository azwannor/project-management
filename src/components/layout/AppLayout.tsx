"use client";

import { useState } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, Sun, Moon } from "lucide-react";
import Sidebar from "@/components/common/Sidebar";
import MobilePwaNav from "@/components/layout/MobilePwaNav";
import ActiveUsers from "@/components/common/ActiveUsers";
import NotificationBell from "@/components/common/NotificationBell";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useBoardroom } from "@/components/providers/BoardroomProvider";
import { useI18n } from "@/i18n";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isFullscreenPublic = pathname === "/login" || pathname.startsWith("/assets/q/");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { isBoardroom } = useBoardroom();
  const { locale, setLocale, t } = useI18n();

  const isBoardroomActive =
    isBoardroom && (pathname === "/" || pathname.startsWith("/dashboard"));

  if (isFullscreenPublic || isBoardroomActive) {
    return <main className="flex-1 overflow-y-auto bg-[var(--bg-canvas)]">{children}</main>;
  }

  const getPageTitle = (path: string) => {
    if (path === "/" || path.startsWith("/dashboard")) {
      return { full: t.nav.overview, short: t.nav.overviewShort };
    }
    if (path.startsWith("/projects")) {
      return { full: t.nav.projects, short: t.nav.projectsShort };
    }
    if (path.startsWith("/support")) {
      return { full: t.nav.support, short: t.nav.supportShort };
    }
    if (path.startsWith("/maintenance") || path.startsWith("/assets")) {
      return { full: t.nav.assets, short: t.nav.assetsShort };
    }
    if (path.startsWith("/settings")) {
      return { full: t.nav.settings, short: t.nav.settings };
    }
    return { full: t.common.appName, short: t.common.appName };
  };

  const title = getPageTitle(pathname);

  return (
    <>
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />
      <div className="flex-1 flex flex-col h-screen overflow-hidden bg-[var(--bg-canvas)]">
        <header className="no-print h-14 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] flex items-center justify-between px-3 sm:px-5 md:px-6 shrink-0 z-30 relative gap-2">
          <div className="flex items-center gap-2 overflow-hidden min-w-0">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-1.5 -ml-1 text-[var(--text-ink2)] hover:bg-[var(--bg-subtle)] rounded-lg transition-colors shrink-0"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Image
              src="/brand/crown-rmp.png"
              alt="Royal Medica"
              width={22}
              height={18}
              className="sm:hidden w-5 h-4 object-contain shrink-0"
            />
            <h1 className="font-heading font-bold text-[var(--text-ink)] text-[15px] md:text-[17px] truncate">
              <span className="sm:hidden">{title.short}</span>
              <span className="hidden sm:inline">{title.full}</span>
            </h1>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 shrink-0">
            {/* EN | ID Switch */}
            <div className="flex items-center bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-full p-0.5">
              {(["en", "id"] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLocale(lang)}
                  className={`font-mono-code text-[10px] font-bold px-2 py-0.5 rounded-full transition-colors ${
                    locale === lang
                      ? "bg-[var(--bg-surface)] text-[var(--brand)] shadow-2xs"
                      : "text-[var(--text-muted)] hover:text-[var(--text-ink)]"
                  }`}
                >
                  {lang.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Light / Soft Charcoal Dark Switch */}
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center gap-1.5 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] hover:border-[var(--brand-stroke)] rounded-full px-2 sm:px-2.5 py-1 font-mono-code text-[10px] font-bold text-[var(--text-ink2)] transition-colors"
              title="Toggle theme"
            >
              {theme === "dark" ? (
                <>
                  <Moon className="w-3 h-3 text-[var(--brand)]" />
                  <span className="hidden sm:inline">{t.common.dark}</span>
                </>
              ) : (
                <>
                  <Sun className="w-3 h-3 text-[var(--warn)]" />
                  <span className="hidden sm:inline">{t.common.light}</span>
                </>
              )}
            </button>

            <NotificationBell />
            <div className="h-5 w-px bg-[var(--border-subtle)] hidden sm:block" />
            <div className="hidden sm:flex items-center">
              <ActiveUsers />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto relative flex flex-col pb-[74px] md:pb-0">
          {children}
        </main>
        <MobilePwaNav />
      </div>
    </>
  );
}
