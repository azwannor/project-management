"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, FolderKanban, Headset, QrCode, Settings } from "lucide-react";
import { useI18n } from "@/i18n";

export default function MobilePwaNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  const tabs = [
    { key: "overview", label: t.nav.overviewShort, href: "/dashboard", matchPrefix: ["/dashboard"], icon: LayoutGrid },
    { key: "projects", label: t.nav.projectsShort, href: "/projects", matchPrefix: ["/projects"], icon: FolderKanban },
    { key: "support", label: t.nav.supportShort, href: "/support", matchPrefix: ["/support"], icon: Headset },
    { key: "assets", label: t.nav.assetsShort, href: "/maintenance", matchPrefix: ["/maintenance", "/assets"], icon: QrCode },
    { key: "more", label: t.nav.more, href: "/settings", matchPrefix: ["/settings"], icon: Settings },
  ];

  const isActive = (prefixes: string[]) => prefixes.some((p) => pathname.startsWith(p));

  return (
    <nav className="no-print md:hidden fixed bottom-0 inset-x-0 z-30 h-[70px] bg-[var(--bg-surface)] border-t border-[var(--border-subtle)] px-2 pb-1 flex items-center justify-around">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = isActive(tab.matchPrefix);
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className="flex flex-col items-center justify-center gap-1 min-w-[56px] py-1"
          >
            <div
              className={`px-3 py-1 rounded-full transition-colors ${
                active
                  ? "bg-[var(--brand-tint)] text-[var(--brand)] border border-[var(--brand-stroke)]"
                  : "text-[var(--text-muted)]"
              }`}
            >
              <Icon className="w-[18px] h-[18px]" />
            </div>
            <span
              className={`text-[10px] font-semibold ${
                active ? "text-[var(--brand)]" : "text-[var(--text-muted)]"
              }`}
            >
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
