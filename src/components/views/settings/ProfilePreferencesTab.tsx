"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Camera,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LogOut,
  Save,
  Shield,
  Moon,
  Sun,
  Globe,
  Bell,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { useTheme } from "@/components/providers/ThemeProvider";
import { useUiPref } from "@/lib/ui-prefs";
import type { SettingsUser } from "./types";

interface ProfilePreferencesTabProps {
  currentUser: SettingsUser;
  onUserUpdated: (user: SettingsUser) => void;
}

export default function ProfilePreferencesTab({
  currentUser,
  onUserUpdated,
}: ProfilePreferencesTabProps) {
  const router = useRouter();
  const { locale, setLocale, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [slaSoundPref, setSlaSoundPref] = useUiPref("pref_sla_sound", "true");
  const [desktopBadgePref, setDesktopBadgePref] = useUiPref("pref_desktop_badges", "true");
  const [compactDensityPref, setCompactDensityPref] = useUiPref("pref_compact_density", "false");

  const [form, setForm] = useState({
    name: currentUser.name || "",
    email: currentUser.email || "",
    photo: currentUser.photo || "",
    telegramUsername: currentUser.telegramUsername || "",
    telegramChatId: currentUser.telegramChatId || "",
    oldPassword: "",
    newPassword: "",
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const initials = (form.name || currentUser.name || "IT")
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setBanner(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "avatars");
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setForm((prev) => ({ ...prev, photo: data.url }));
      setBanner({ type: "success", text: "Avatar uploaded. Click Save Changes to persist." });
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to upload photo",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setBanner(null);
    try {
      const res = await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          preferredLocale: locale,
          preferredTheme: theme,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile");

      setForm((prev) => ({ ...prev, oldPassword: "", newPassword: "" }));
      onUserUpdated({ ...currentUser, ...data.user });
      setBanner({ type: "success", text: t.settings.profileSynced });
      router.refresh();
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Server error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSwitchLocale = async (next: "en" | "id") => {
    setLocale(next);
    try {
      await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredLocale: next }),
      });
    } catch {
      // Cookie already updated locally
    }
  };

  const handleSwitchTheme = async (next: "light" | "dark") => {
    setTheme(next);
    try {
      await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredTheme: next }),
      });
    } catch {
      // Cookie already updated locally
    }
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      setIsSigningOut(false);
    }
  };

  const inputClass =
    "w-full h-10 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-xl px-3.5 text-[13px] text-[var(--text-ink)] placeholder:text-[var(--text-muted)] outline-none focus:bg-[var(--bg-surface)] focus:border-[var(--brand)] transition-colors";

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-5 items-start">
      {/* Left Card: Personal Information */}
      <form
        onSubmit={handleSave}
        className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[22px] p-5 sm:p-6 shadow-xs space-y-5 min-w-0"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-[var(--border-subtle)]">
          <h2 className="font-heading font-bold text-[17px] text-[var(--text-ink)]">
            {t.settings.profileTitle}
          </h2>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--ok-bg)] border border-[var(--ok-st)] font-mono-code text-[10px] font-bold text-[var(--ok)]">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--ok)]" />
            {t.settings.profileSynced}
          </span>
        </div>

        {banner && (
          <div
            className={`px-3.5 py-2.5 rounded-xl border flex items-center gap-2 text-xs font-medium ${
              banner.type === "error"
                ? "bg-[var(--err-bg)] border-[var(--err-st)] text-[var(--err)]"
                : "bg-[var(--ok-bg)] border-[var(--ok-st)] text-[var(--ok)]"
            }`}
          >
            {banner.type === "error" ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            )}
            <span>{banner.text}</span>
          </div>
        )}

        {/* Avatar Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="w-14 h-14 rounded-full bg-[var(--brand)] text-white dark:text-[#161A26] font-mono-code font-bold text-base flex items-center justify-center shrink-0 overflow-hidden border-2 border-[var(--bg-surface)] shadow-xs">
              {form.photo ? (
                <Image
                  src={form.photo}
                  alt={form.name}
                  width={56}
                  height={56}
                  unoptimized
                  className="w-full h-full object-cover"
                />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0">
              <div className="font-heading font-bold text-[15px] text-[var(--text-ink)] truncate">
                {form.name || currentUser.name}
              </div>
              <div className="text-xs text-[var(--text-ink2)] truncate">
                {form.email} · {currentUser.jobDesk}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            <button
              type="button"
              disabled={isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[var(--bg-surface)] border border-[var(--border-strong)] hover:border-[var(--brand)] text-xs font-semibold text-[var(--text-ink)] transition-colors disabled:opacity-60"
            >
              {isUploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Camera className="w-3.5 h-3.5 text-[var(--brand)]" />
              )}
              {isUploading ? t.settings.uploadingPhoto : t.settings.changePhoto}
            </button>
          </div>
        </div>

        {/* Form Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
              {t.settings.fullName} *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
              {t.settings.email} *
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className={inputClass}
              required
            />
          </div>
          <div>
            <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
              {t.settings.telegramUsername}{" "}
              <span className="font-normal lowercase text-[var(--text-muted)]">
                {t.settings.telegramUsernameHint}
              </span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)] font-mono-code">
                @
              </span>
              <input
                type="text"
                value={form.telegramUsername}
                onChange={(e) =>
                  setForm({ ...form, telegramUsername: e.target.value.replace(/^@+/, "") })
                }
                placeholder="username_telegram"
                className={`${inputClass} pl-7 font-mono-code`}
              />
            </div>
          </div>
          <div>
            <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
              {t.settings.telegramChatId}
            </label>
            <input
              type="text"
              value={form.telegramChatId}
              onChange={(e) => setForm({ ...form, telegramChatId: e.target.value })}
              placeholder="e.g. 1096141596"
              className={`${inputClass} font-mono-code`}
            />
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[var(--brand-tint)] border border-[var(--brand-stroke)] text-xs text-[var(--brand)] leading-relaxed">
          {t.settings.telegramSyncBanner}
        </div>

        {/* Password Change */}
        <div className="pt-4 border-t border-[var(--border-subtle)] space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[var(--text-ink)]">
              {t.settings.changePassword}
            </h3>
            <span className="text-xs text-[var(--text-muted)]">{t.settings.changePasswordOpt}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                {t.settings.oldPassword}
              </label>
              <input
                type="password"
                value={form.oldPassword}
                onChange={(e) => setForm({ ...form, oldPassword: e.target.value })}
                placeholder="••••••••"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
                {t.settings.newPassword}
              </label>
              <input
                type="password"
                value={form.newPassword}
                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                placeholder="••••••••"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Assigned Permissions & Regional Areas */}
        <div className="pt-4 border-t border-[var(--border-subtle)] space-y-2.5">
          <div className="flex items-center gap-1.5 font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            <Shield className="w-3.5 h-3.5 text-[var(--brand)]" />
            <span>
              {t.settings.permissionsTitle} ({currentUser.handledAreas?.length || 0})
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="px-2.5 py-1 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-subtle)] font-mono-code text-[10px] font-bold text-[var(--text-ink2)] uppercase">
              ROLE: {currentUser.role}
            </span>
            <span
              className={`px-2.5 py-1 rounded-full border font-mono-code text-[10px] font-bold ${
                currentUser.canManageMaintenance || currentUser.role?.toLowerCase() === "admin"
                  ? "bg-[var(--ok-bg)] border-[var(--ok-st)] text-[var(--ok)]"
                  : "bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-muted)]"
              }`}
            >
              canManageMaintenance:{" "}
              {currentUser.canManageMaintenance || currentUser.role?.toLowerCase() === "admin"
                ? "ON"
                : "OFF"}
            </span>
            <span
              className={`px-2.5 py-1 rounded-full border font-mono-code text-[10px] font-bold ${
                currentUser.canViewTeamLogs || currentUser.role?.toLowerCase() === "admin"
                  ? "bg-[var(--ok-bg)] border-[var(--ok-st)] text-[var(--ok)]"
                  : "bg-[var(--bg-subtle)] border-[var(--border-subtle)] text-[var(--text-muted)]"
              }`}
            >
              canViewTeamLogs:{" "}
              {currentUser.canViewTeamLogs || currentUser.role?.toLowerCase() === "admin"
                ? "ON"
                : "OFF"}
            </span>
          </div>
          {currentUser.handledAreas && currentUser.handledAreas.length > 0 && (
            <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)]">
              {currentUser.handledAreas.map((area) => (
                <span
                  key={area}
                  className="px-2.5 py-1 rounded-full bg-[var(--bg-surface)] border border-[var(--brand-stroke)] font-mono-code text-[10px] font-semibold text-[var(--brand)]"
                >
                  {area}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white dark:text-[#161A26] font-semibold text-[13px] transition-colors disabled:opacity-60 w-full sm:w-auto"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t.settings.saveChanges}
          </button>
        </div>
      </form>

      {/* Right Card: Workspace Preferences */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[22px] p-5 sm:p-6 shadow-xs space-y-5 min-w-0">
        <div className="pb-4 border-b border-[var(--border-subtle)]">
          <h2 className="font-heading font-bold text-[17px] text-[var(--text-ink)]">
            {t.settings.workspacePrefsTitle}
          </h2>
        </div>

        {/* Bilingual Language Switch */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            <Globe className="w-3.5 h-3.5" />
            <span>{t.settings.languageLabel}</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {(
              [
                { code: "en", label: "English (EN)" },
                { code: "id", label: "Bahasa Indonesia (ID)" },
              ] as const
            ).map((opt) => {
              const active = locale === opt.code;
              return (
                <button
                  key={opt.code}
                  type="button"
                  onClick={() => handleSwitchLocale(opt.code)}
                  className={`px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                    active
                      ? "bg-[var(--brand-tint)] border-[var(--brand)] text-[var(--brand)]"
                      : "bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-ink2)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Appearance Theme */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            {theme === "dark" ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
            <span>{t.settings.appearanceLabel}</span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {(
              [
                { mode: "light", label: t.settings.themeLight, Icon: Sun },
                { mode: "dark", label: t.settings.themeDark, Icon: Moon },
              ] as const
            ).map(({ mode, label, Icon }) => {
              const active = theme === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleSwitchTheme(mode)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-semibold transition-colors ${
                    active
                      ? "bg-[var(--brand-tint)] border-[var(--brand)] text-[var(--brand)]"
                      : "bg-[var(--bg-canvas)] border-[var(--border-subtle)] text-[var(--text-ink2)] hover:border-[var(--border-strong)]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* UI Preferences Toggles */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-1.5 font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
            <Bell className="w-3.5 h-3.5" />
            <span>{t.settings.notificationsTitle}</span>
          </div>
          {[
            {
              key: "sla",
              title: t.settings.prefSlaSound,
              desc: t.settings.prefSlaSoundDesc,
              checked: slaSoundPref === "true",
              onToggle: () => setSlaSoundPref(slaSoundPref === "true" ? "false" : "true"),
            },
            {
              key: "badge",
              title: t.settings.prefDesktopAlert,
              desc: t.settings.prefDesktopAlertDesc,
              checked: desktopBadgePref === "true",
              onToggle: () => setDesktopBadgePref(desktopBadgePref === "true" ? "false" : "true"),
            },
            {
              key: "density",
              title: t.settings.prefCompactDensity,
              desc: t.settings.prefCompactDensityDesc,
              checked: compactDensityPref === "true",
              onToggle: () => setCompactDensityPref(compactDensityPref === "true" ? "false" : "true"),
            },
          ].map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={item.onToggle}
              className="w-full flex items-center justify-between gap-3 p-3.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] text-left hover:border-[var(--border-strong)] transition-colors"
            >
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-[var(--text-ink)]">{item.title}</div>
                <div className="text-[11px] text-[var(--text-muted)] leading-snug mt-0.5">
                  {item.desc}
                </div>
              </div>
              <span
                className={`w-10 h-6 rounded-full p-0.5 transition-colors shrink-0 flex items-center ${
                  item.checked ? "bg-[var(--ok)] justify-end" : "bg-[var(--border-strong)] justify-start"
                }`}
              >
                <span className="w-5 h-5 rounded-full bg-white shadow-xs" />
              </span>
            </button>
          ))}
        </div>

        {/* Sign Out */}
        <div className="pt-2">
          <button
            type="button"
            disabled={isSigningOut}
            onClick={handleSignOut}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-full bg-[var(--err-bg)] border border-[var(--err-st)] hover:bg-[var(--err)] hover:text-white dark:hover:text-[#161A26] text-[var(--err)] font-semibold text-[13px] transition-colors disabled:opacity-60"
          >
            {isSigningOut ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
            {t.settings.signOutActive}
          </button>
        </div>
      </div>
    </div>
  );
}
