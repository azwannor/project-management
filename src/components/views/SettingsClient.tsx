"use client";

import { useState } from "react";
import { User as UserIcon, Users, Database } from "lucide-react";
import { useI18n } from "@/i18n";
import ProfilePreferencesTab from "./settings/ProfilePreferencesTab";
import UserManagementTab from "./settings/UserManagementTab";
import MasterAndApiTab from "./settings/MasterAndApiTab";
import type {
  MaskedExternalKey,
  MasterAssetType,
  MasterDivision,
  MasterLocation,
  MasterRegionalArea,
  MasterSlaPolicy,
  MasterSupportModule,
  SettingsUser,
} from "./settings/types";

interface SettingsClientProps {
  initialCurrentUser: SettingsUser;
  initialUsers: SettingsUser[];
  initialDivisions: MasterDivision[];
  initialLocations: MasterLocation[];
  initialAssetTypes: MasterAssetType[];
  initialRegionalAreas: MasterRegionalArea[];
  initialSupportModules: MasterSupportModule[];
  initialSlaPolicies: MasterSlaPolicy[];
  initialExternalKeys: MaskedExternalKey[];
}

export default function SettingsClient({
  initialCurrentUser,
  initialUsers,
  initialDivisions,
  initialLocations,
  initialAssetTypes,
  initialRegionalAreas,
  initialSupportModules,
  initialSlaPolicies,
  initialExternalKeys,
}: SettingsClientProps) {
  const { t } = useI18n();
  const isAdmin = initialCurrentUser.role?.toLowerCase() === "admin";

  const [activeTab, setActiveTab] = useState<"profile" | "users" | "master">("profile");
  const [currentUser, setCurrentUser] = useState<SettingsUser>(initialCurrentUser);
  const [users, setUsers] = useState<SettingsUser[]>(initialUsers);
  const [divisions, setDivisions] = useState<MasterDivision[]>(initialDivisions);
  const [locations, setLocations] = useState<MasterLocation[]>(initialLocations);
  const [assetTypes, setAssetTypes] = useState<MasterAssetType[]>(initialAssetTypes);
  const [regionalAreas, setRegionalAreas] = useState<MasterRegionalArea[]>(initialRegionalAreas);
  const [supportModules, setSupportModules] = useState<MasterSupportModule[]>(initialSupportModules);
  const [slaPolicies, setSlaPolicies] = useState<MasterSlaPolicy[]>(initialSlaPolicies);
  const [externalKeys, setExternalKeys] = useState<MaskedExternalKey[]>(initialExternalKeys);

  const tabs = [
    {
      id: "profile" as const,
      label: t.settings.tabProfile,
      shortLabel: t.settings.tabProfileShort,
      icon: UserIcon,
    },
    ...(isAdmin
      ? [
          {
            id: "users" as const,
            label: `${t.settings.tabUsers} (${users.length})`,
            shortLabel: t.settings.tabUsersShort,
            icon: Users,
          },
          {
            id: "master" as const,
            label: t.settings.tabMaster,
            shortLabel: t.settings.tabMasterShort,
            icon: Database,
          },
        ]
      : []),
  ];

  return (
    <div className="p-3 sm:p-5 lg:p-6 max-w-[1440px] w-full mx-auto space-y-5 overflow-x-hidden">
      {/* Top Pill Switcher Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl px-3.5 py-2.5 shadow-xs">
        <div
          className={`grid gap-1 bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-full p-1 ${
            isAdmin ? "grid-cols-3 w-full sm:w-auto" : "grid-cols-1 w-auto"
          }`}
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center justify-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                  active
                    ? "bg-[var(--bg-surface)] text-[var(--brand)] shadow-xs"
                    : "text-[var(--text-muted)] hover:text-[var(--text-ink)]"
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="sm:hidden">{tab.shortLabel}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>

        <span className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-full bg-[var(--brand-tint)] border border-[var(--brand-stroke)] font-mono-code text-[10px] font-bold text-[var(--brand)] uppercase">
          {isAdmin ? "ADMIN ACCESS" : "STAFF PROFILE"}
        </span>
      </div>

      {activeTab === "profile" && (
        <ProfilePreferencesTab
          currentUser={currentUser}
          onUserUpdated={(updated) => {
            setCurrentUser(updated);
            setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
          }}
        />
      )}

      {activeTab === "users" && isAdmin && (
        <UserManagementTab
          currentUserId={currentUser.id}
          users={users}
          regionalAreas={regionalAreas}
          onUsersChange={setUsers}
        />
      )}

      {activeTab === "master" && isAdmin && (
        <MasterAndApiTab
          divisions={divisions}
          locations={locations}
          assetTypes={assetTypes}
          regionalAreas={regionalAreas}
          supportModules={supportModules}
          slaPolicies={slaPolicies}
          externalKeys={externalKeys}
          onDivisionsChange={setDivisions}
          onLocationsChange={setLocations}
          onAssetTypesChange={setAssetTypes}
          onAreasChange={setRegionalAreas}
          onModulesChange={setSupportModules}
          onSlaChange={setSlaPolicies}
          onKeysChange={setExternalKeys}
        />
      )}
    </div>
  );
}
