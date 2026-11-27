"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  X,
  Check,
  ShieldCheck,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { ThemedSelect } from "@/components/ui/ThemedSelect";
import type { MasterRegionalArea, SettingsUser } from "./types";

interface UserManagementTabProps {
  currentUserId: string;
  users: SettingsUser[];
  regionalAreas: MasterRegionalArea[];
  onUsersChange: (users: SettingsUser[]) => void;
}

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  jobDesk: "",
  role: "Staff",
  telegramUsername: "",
  telegramChatId: "",
  handledAreas: [] as string[],
  canViewTeamLogs: false,
  canManageMaintenance: false,
  isActive: true,
};

export default function UserManagementTab({
  currentUserId,
  users,
  regionalAreas,
  onUsersChange,
}: UserManagementTabProps) {
  const router = useRouter();
  const { t } = useI18n();

  const [mode, setMode] = useState<"idle" | "create" | "edit">("idle");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const availableAreaNames = regionalAreas.filter((a) => a.isActive).map((a) => a.name);

  const openCreate = () => {
    setMode("create");
    setEditingId(null);
    setForm(EMPTY_FORM);
    setBanner(null);
  };

  const openEdit = (u: SettingsUser) => {
    setMode("edit");
    setEditingId(u.id);
    setForm({
      name: u.name || "",
      email: u.email || "",
      password: "",
      jobDesk: u.jobDesk || "",
      role: u.role === "Admin" ? "Admin" : "Staff",
      telegramUsername: u.telegramUsername || "",
      telegramChatId: u.telegramChatId || "",
      handledAreas: Array.isArray(u.handledAreas) ? u.handledAreas : [],
      canViewTeamLogs: Boolean(u.canViewTeamLogs),
      canManageMaintenance: Boolean(u.canManageMaintenance),
      isActive: u.isActive !== false,
    });
    setBanner(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setBanner(null);
    try {
      const isEdit = mode === "edit" && editingId;
      const url = isEdit ? `/api/users/${editingId}` : "/api/users";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save user");

      if (isEdit) {
        onUsersChange(users.map((u) => (u.id === editingId ? data : u)));
        setBanner({ type: "success", text: `Updated ${data.name}` });
      } else {
        onUsersChange([...users, data.user].sort((a, b) => a.name.localeCompare(b.name)));
        setBanner({ type: "success", text: `Created ${data.user.name}` });
      }
      setMode("idle");
      setEditingId(null);
      setForm(EMPTY_FORM);
      router.refresh();
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save user",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: SettingsUser) => {
    setDeletingId(u.id);
    setBanner(null);
    try {
      const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete user");
      onUsersChange(users.filter((item) => item.id !== u.id));
      if (editingId === u.id) {
        setMode("idle");
        setEditingId(null);
      }
      setConfirmDeleteId(null);
      setBanner({ type: "success", text: `Deleted ${u.name}` });
      router.refresh();
    } catch (err) {
      setBanner({
        type: "error",
        text: err instanceof Error ? err.message : "Delete failed",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const toggleArea = (area: string) => {
    setForm((prev) => ({
      ...prev,
      handledAreas: prev.handledAreas.includes(area)
        ? prev.handledAreas.filter((a) => a !== area)
        : [...prev.handledAreas, area],
    }));
  };

  const inputClass =
    "w-full h-9.5 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-xl px-3 text-[13px] text-[var(--text-ink)] placeholder:text-[var(--text-muted)] outline-none focus:bg-[var(--bg-surface)] focus:border-[var(--brand)] transition-colors";

  const editorOpen = mode !== "idle";

  return (
    <div
      className={`grid gap-5 items-start ${
        editorOpen
          ? "grid-cols-1 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]"
          : "grid-cols-1"
      }`}
    >
      {/* Left: Roster List */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[22px] p-5 sm:p-6 shadow-xs space-y-4 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-heading font-bold text-[17px] text-[var(--text-ink)]">
              {t.settings.teamRosterTitle} ({users.length})
            </h2>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white dark:text-[#161A26] font-semibold text-xs transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {t.settings.addUser.replace(/^\+\s*/, "")}
          </button>
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

        {/* Desktop / Tablet Roster */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                <th className="py-2.5 pr-3">User & Telegram</th>
                <th className="py-2.5 px-3">{t.settings.roleLabel}</th>
                <th className="py-2.5 px-3">Flags / Areas</th>
                <th className="py-2.5 pl-3 text-right">{t.common.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {users.map((u) => {
                const isSelected = editingId === u.id && mode === "edit";
                return (
                  <tr
                    key={u.id}
                    className={`transition-colors ${
                      isSelected ? "bg-[var(--brand-tint)]/50" : "hover:bg-[var(--bg-canvas)]/70"
                    }`}
                  >
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[var(--brand-tint)] border border-[var(--brand-stroke)] text-[var(--brand)] font-mono-code text-xs font-bold flex items-center justify-center shrink-0 overflow-hidden">
                          {u.photo ? (
                            <Image
                              src={u.photo}
                              alt={u.name}
                              width={32}
                              height={32}
                              unoptimized
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            u.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-[13px] text-[var(--text-ink)] truncate">
                              {u.name}
                            </span>
                            {!u.isActive && (
                              <span className="px-1.5 py-0.5 rounded bg-[var(--err-bg)] text-[var(--err)] font-mono-code text-[9px] font-bold">
                                INACTIVE
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)] truncate">
                            {u.telegramUsername ? `@${u.telegramUsername} · ` : ""}
                            {u.jobDesk}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex px-2.5 py-0.5 rounded-full font-mono-code text-[10px] font-bold uppercase ${
                          u.role?.toLowerCase() === "admin"
                            ? "bg-[var(--warn-bg)] border border-[var(--warn-st)] text-[var(--warn)]"
                            : "bg-[var(--brand-tint)] border border-[var(--brand-stroke)] text-[var(--brand)]"
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-xs text-[var(--text-ink2)]">
                      {u.role?.toLowerCase() === "admin" ? (
                        "Full System Access"
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {u.canManageMaintenance && (
                            <span className="px-1.5 py-0.5 rounded bg-[var(--ok-bg)] text-[var(--ok)] font-mono-code text-[9.5px] font-bold">
                              MaintMgr
                            </span>
                          )}
                          {u.canViewTeamLogs && (
                            <span className="px-1.5 py-0.5 rounded bg-[var(--brand-tint)] text-[var(--brand)] font-mono-code text-[9.5px] font-bold">
                              TeamLogs
                            </span>
                          )}
                          <span className="font-mono-code text-[11px] text-[var(--text-muted)]">
                            {u.handledAreas?.length || 0} Areas
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="py-3 pl-3 text-right">
                      {confirmDeleteId === u.id ? (
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            disabled={deletingId === u.id}
                            onClick={() => handleDelete(u)}
                            className="px-2.5 py-1 rounded-lg bg-[var(--err)] text-white dark:text-[#161A26] font-mono-code text-[10px] font-bold"
                          >
                            {deletingId === u.id ? "..." : t.common.yes}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2 py-1 rounded-lg bg-[var(--bg-subtle)] text-[var(--text-ink2)] font-mono-code text-[10px]"
                          >
                            {t.common.no}
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openEdit(u)}
                            title={t.common.edit}
                            className="p-1.5 rounded-lg bg-[var(--brand-tint)] border border-[var(--brand-stroke)] text-[var(--brand)] hover:opacity-80 transition-opacity"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {u.id !== currentUserId && (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(u.id)}
                              title={t.common.delete}
                              className="p-1.5 rounded-lg bg-[var(--err-bg)] border border-[var(--err-st)] text-[var(--err)] hover:opacity-80 transition-opacity"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Cards (< md) matching FigCraft 06C-2 */}
        <div className="md:hidden space-y-2.5">
          {users.map((u) => (
            <div
              key={u.id}
              className="p-3.5 rounded-2xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] space-y-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-heading font-bold text-sm text-[var(--text-ink)] truncate">
                    {u.name}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] truncate">
                    {u.telegramUsername ? `@${u.telegramUsername} · ` : ""}
                    {u.jobDesk}
                  </div>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full font-mono-code text-[9.5px] font-bold uppercase shrink-0 ${
                    u.role?.toLowerCase() === "admin"
                      ? "bg-[var(--warn-bg)] border border-[var(--warn-st)] text-[var(--warn)]"
                      : "bg-[var(--brand-tint)] border border-[var(--brand-stroke)] text-[var(--brand)]"
                  }`}
                >
                  {u.role}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={() => openEdit(u)}
                  className="text-xs font-semibold text-[var(--brand)]"
                >
                  Edit Areas & Permissions →
                </button>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEdit(u)}
                    className="p-1.5 rounded-lg bg-[var(--brand-tint)] border border-[var(--brand-stroke)] text-[var(--brand)]"
                    aria-label={t.common.edit}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {u.id !== currentUserId &&
                    (confirmDeleteId === u.id ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(u)}
                        className="px-2 py-1 rounded-lg bg-[var(--err)] text-white dark:text-[#161A26] font-mono-code text-[10px] font-bold"
                      >
                        {t.common.delete}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteId(u.id)}
                        className="p-1.5 rounded-lg bg-[var(--err-bg)] border border-[var(--err-st)] text-[var(--err)]"
                        aria-label={t.common.delete}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Editor Panel */}
      {editorOpen && (
        <form
          onSubmit={handleSubmit}
          className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[22px] p-5 sm:p-6 shadow-xs space-y-4 min-w-0"
        >
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2 min-w-0">
              <ShieldCheck className="w-4 h-4 text-[var(--brand)] shrink-0" />
              <h3 className="font-heading font-bold text-[15px] text-[var(--text-ink)] truncate">
                {mode === "edit" ? `${t.settings.editUser} · ${form.name}` : t.settings.createUser}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => {
                setMode("idle");
                setEditingId(null);
              }}
              className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-subtle)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
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
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
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
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                {t.settings.jobDesk} *
              </label>
              <input
                type="text"
                value={form.jobDesk}
                onChange={(e) => setForm({ ...form, jobDesk: e.target.value })}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                {t.settings.roleLabel}
              </label>
              <ThemedSelect
                value={form.role}
                onChange={(val) => setForm({ ...form, role: val })}
                options={[
                  { value: "Staff", label: "Staff" },
                  { value: "Admin", label: "Admin" },
                ]}
              />
            </div>
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                {t.settings.telegramUsername}
              </label>
              <input
                type="text"
                value={form.telegramUsername}
                onChange={(e) =>
                  setForm({ ...form, telegramUsername: e.target.value.replace(/^@+/, "") })
                }
                placeholder="username"
                className={`${inputClass} font-mono-code`}
              />
            </div>
            <div>
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                {t.settings.telegramChatId}
              </label>
              <input
                type="text"
                value={form.telegramChatId}
                onChange={(e) => setForm({ ...form, telegramChatId: e.target.value })}
                placeholder="1096141596"
                className={`${inputClass} font-mono-code`}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                Password {mode === "edit" ? "(Leave blank to keep)" : "*"}
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••"
                required={mode === "create"}
                className={inputClass}
              />
            </div>
          </div>

          {/* Granular Access Flags */}
          <div className="space-y-2 pt-1">
            <div className="font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t.settings.accessFlagsLabel}
            </div>
            {[
              {
                key: "canViewTeamLogs",
                title: t.settings.canViewTeamLogsLabel,
                desc: t.settings.canViewTeamLogsDesc,
                checked: form.canViewTeamLogs,
                toggle: () => setForm({ ...form, canViewTeamLogs: !form.canViewTeamLogs }),
              },
              {
                key: "canManageMaintenance",
                title: t.settings.canManageMaintLabel,
                desc: t.settings.canManageMaintDesc,
                checked: form.canManageMaintenance,
                toggle: () => setForm({ ...form, canManageMaintenance: !form.canManageMaintenance }),
              },
              {
                key: "isActive",
                title: t.settings.activeAccountLabel,
                desc: t.settings.activeAccountDesc,
                checked: form.isActive,
                toggle: () => setForm({ ...form, isActive: !form.isActive }),
              },
            ].map((flag) => (
              <button
                key={flag.key}
                type="button"
                onClick={flag.toggle}
                className={`w-full flex items-center justify-between gap-3 p-3 rounded-xl border text-left transition-colors ${
                  flag.checked
                    ? "bg-[var(--ok-bg)]/60 border-[var(--ok-st)]"
                    : "bg-[var(--bg-canvas)] border-[var(--border-subtle)]"
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[var(--text-ink)]">{flag.title}</div>
                  <div className="text-[11px] text-[var(--text-muted)]">{flag.desc}</div>
                </div>
                <span
                  className={`w-9 h-5 rounded-full p-0.5 transition-colors shrink-0 flex items-center ${
                    flag.checked ? "bg-[var(--ok)] justify-end" : "bg-[var(--border-strong)] justify-start"
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-white shadow-xs" />
                </span>
              </button>
            ))}
          </div>

          {/* Handled Areas Matrix (DB-backed RegionalArea) */}
          <div className="space-y-2 pt-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono-code text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {t.settings.handledAreasLabel} ({form.handledAreas.length}/{availableAreaNames.length})
              </span>
              <div className="flex items-center gap-2 font-mono-code text-[10px]">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, handledAreas: [...availableAreaNames] })}
                  className="text-[var(--brand)] font-bold hover:underline"
                >
                  {t.settings.selectAll}
                </button>
                <span className="text-[var(--border-strong)]">·</span>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, handledAreas: [] })}
                  className="text-[var(--text-muted)] hover:text-[var(--text-ink)]"
                >
                  {t.settings.clearAll}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 p-2.5 rounded-xl bg-[var(--bg-canvas)] border border-[var(--border-subtle)] max-h-52 overflow-y-auto">
              {availableAreaNames.map((area) => {
                const selected = form.handledAreas.includes(area);
                return (
                  <button
                    key={area}
                    type="button"
                    onClick={() => toggleArea(area)}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-left font-mono-code text-[10px] font-semibold transition-colors ${
                      selected
                        ? "bg-[var(--brand-tint)] border-[var(--brand)] text-[var(--brand)]"
                        : "bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-ink)]"
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border ${
                        selected
                          ? "bg-[var(--brand)] border-[var(--brand)] text-white dark:text-[#161A26]"
                          : "border-[var(--border-strong)]"
                      }`}
                    >
                      {selected && <Check className="w-2.5 h-2.5" />}
                    </span>
                    <span className="truncate">{area}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setMode("idle");
                setEditingId(null);
              }}
              className="px-4 py-2 rounded-full bg-[var(--bg-subtle)] text-[var(--text-ink2)] text-xs font-semibold hover:opacity-80"
            >
              {t.common.cancel}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full bg-[var(--brand)] hover:bg-[var(--brand-hover)] text-white dark:text-[#161A26] text-xs font-semibold transition-colors disabled:opacity-60"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {mode === "edit" ? t.settings.updateUser : t.common.save}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
