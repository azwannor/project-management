export interface SupportUserItem {
  id: string;
  name: string;
  jobDesk: string | null;
  role: string;
  photo: string | null;
  handledAreas: string[];
}

export interface SupportTimeLogItem {
  id: string;
  supportTicketId?: string | null;
  userId: string;
  startTime: string | Date;
  endTime: string | Date | null;
  duration?: number | null;
  durationSeconds?: number | null;
  source: "AUTO" | "MANUAL" | "ADJUSTED";
  note?: string | null;
  user?: { id: string; name: string; photo?: string | null } | null;
}

export interface SupportPromotedTaskItem {
  id: string;
  title: string;
  status: string;
  project?: { id: string; name: string } | null;
}

export interface SupportAssetOption {
  id: string;
  assetCode: string;
  assetName: string;
  location: string | null;
}

export interface SupportProjectOption {
  id: string;
  name: string;
  status: string;
}

export interface SupportCategoryOption {
  id: string;
  moduleId: string;
  name: string;
  requiresArea: boolean;
}

export interface SupportModuleOption {
  id: string;
  groupName: string;
  name: string;
  sortOrder: number;
  categories: SupportCategoryOption[];
}

export interface SupportSlaPolicyItem {
  id: string;
  priority: string;
  firstResponseMinutes: number;
  targetMinutes: number;
  reminderThresholdPercent: number;
}

export interface SupportTicketItem {
  id: string;
  ticketNumber?: string | null;
  userId: string;
  taskName: string;
  supportType: string;
  module: string;
  area?: string | null;
  startDate: string | Date;
  startedAt?: string | Date | null;
  endDate?: string | Date | null;
  slaTargetMinutes?: number | null;
  slaDueAt?: string | Date | null;
  issue?: string | null;
  solution?: string | null;
  status: string;
  priority: string;
  attachment?: string | null;
  attachmentKey?: string | null;
  ticketType: "REQUEST" | "DAILY_ACTIVITY" | string;
  requesterName?: string | null;
  requesterEmail?: string | null;
  sourceType?: "MANUAL" | "EXTERNAL_APP" | "QR_SCAN" | "MAINTENANCE" | string;
  sourceApp?: string | null;
  sourceMenu?: string | null;
  sourceUrl?: string | null;
  assetId?: string | null;
  link?: string | null;
  createdAt: string | Date;
  updatedAt?: string | Date;
  user?: { id: string; name: string; jobDesk?: string | null; photo?: string | null } | null;
  executors?: Array<{ id: string; name: string; jobDesk?: string | null; photo?: string | null }>;
  asset?: SupportAssetOption | null;
  timeLogs?: SupportTimeLogItem[];
  promotedTasks?: SupportPromotedTaskItem[];
  comments?: Array<{ id: string; createdAt: string | Date }>;
  commentReadStatuses?: Array<{ userId: string; lastReadAt: string | Date }>;
}

export interface SupportCurrentUser {
  id: string;
  name: string;
  jobDesk?: string | null;
  role: string;
  photo?: string | null;
  canViewTeamLogs: boolean;
}
