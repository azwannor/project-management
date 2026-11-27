export interface SettingsUser {
  id: string;
  name: string;
  email: string;
  jobDesk: string;
  role: string;
  photo: string | null;
  telegramUsername: string | null;
  telegramChatId: string | null;
  handledAreas: string[];
  canViewTeamLogs: boolean;
  canManageMaintenance: boolean;
  preferredLocale: string;
  preferredTheme: string;
  isActive: boolean;
  createdAt?: string | Date;
}

export interface MasterDivision {
  id: string;
  name: string;
  code: string | null;
  _count?: { assets: number };
}

export interface MasterLocation {
  id: string;
  name: string;
  code: string | null;
  address: string | null;
  _count?: { assets: number };
}

export interface MasterAssetType {
  id: string;
  name: string;
  code: string | null;
  _count?: { assets: number; templates: number };
}

export interface MasterRegionalArea {
  id: string;
  name: string;
  isActive: boolean;
}

export interface MasterSupportCategory {
  id: string;
  moduleId: string;
  name: string;
  requiresArea: boolean;
}

export interface MasterSupportModule {
  id: string;
  groupName: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
  categories: MasterSupportCategory[];
}

export interface MasterSlaPolicy {
  id: string;
  priority: string;
  firstResponseMinutes: number;
  targetMinutes: number;
  reminderThresholdPercent: number;
}

export interface MaskedExternalKey {
  id: string;
  name: string;
  sourceApp: string;
  keyPrefix: string;
  isActive: boolean;
  lastUsedAt: string | Date | null;
  createdAt: string | Date;
}

export interface IntegrationDiagnostics {
  telegram: {
    tokenConfigured: boolean;
    chatIdConfigured: boolean;
    webhookSecretConfigured: boolean;
    webhookUrl: string | null;
    suggestedWebhookUrl: string;
    pendingUpdateCount: number | null;
    webhookCheckError: string | null;
  };
  cron: {
    secretConfigured: boolean;
    overdueSchedules: number;
    dueSchedules: number;
    openTickets: number;
  };
  storage: {
    backend: string;
    bucket: string;
    endpointConfigured: boolean;
  };
  recentAudits: Array<{
    id: string;
    entityType: string;
    entityId: string;
    action: string;
    createdAt: string;
    actor?: { name: string; email: string } | null;
  }>;
}
