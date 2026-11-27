export interface MaintUserOption {
  id: string;
  name: string;
  role: string;
  jobDesk: string | null;
  photo?: string | null;
  handledAreas: string[];
}

export interface AssetTypeOption {
  id: string;
  name: string;
  code?: string | null;
  _count?: { assets: number; templates: number };
}

export interface DivisionOption {
  id: string;
  name: string;
  code?: string | null;
  _count?: { assets: number };
}

export interface LocationOption {
  id: string;
  name: string;
  code?: string | null;
  _count?: { assets: number };
}

export interface AssetCustodyLogItem {
  id: string;
  assetId: string;
  previousPerson: string | null;
  newPerson: string | null;
  previousLocation: string | null;
  newLocation: string | null;
  previousDivision: string | null;
  newDivision: string | null;
  note: string | null;
  changedAt: string | Date;
  changedBy?: { id: string; name: string } | null;
}

export interface AssetTicketSummary {
  id: string;
  ticketNumber: string | null;
  taskName: string;
  status: string;
  priority: string;
  createdAt: string | Date;
}

export interface EnterpriseAssetItem {
  id: string;
  assetCode: string;
  assetName: string;
  assetTypeId: string;
  divisionId: string | null;
  locationId: string | null;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  person: string | null;
  assignedPerson: string | null;
  location: string | null;
  detailedLocation: string | null;
  status: "ACTIVE" | "IN_REPAIR" | "SPARE" | "INACTIVE" | "RETIRED" | "LOST" | string;
  purchaseDate: string | Date | null;
  purchasePrice: string | number | null;
  vendor: string | null;
  warrantyEndDate: string | Date | null;
  qrPrintedAt: string | Date | null;
  picUserId: string | null;
  notes: string | null;
  createdAt: string | Date;
  assetType?: { id: string; name: string } | null;
  division?: { id: string; name: string } | null;
  locationRef?: { id: string; name: string } | null;
  pic?: { id: string; name: string; photo?: string | null } | null;
  custodyLogs?: AssetCustodyLogItem[];
  supportTickets?: AssetTicketSummary[];
  _count?: { schedules: number; supportTickets?: number; custodyLogs?: number };
}

export interface ChecklistItemOption {
  id: string;
  itemText: string;
  order: number;
  isRequired: boolean;
}

export interface MaintenanceTemplateItem {
  id: string;
  templateName: string;
  assetTypeId: string;
  defaultFrequencyDays: number;
  reminderOffsetDays: number;
  assetType?: { id: string; name: string } | null;
  checklistItems: ChecklistItemOption[];
  _count?: { schedules: number };
}

export interface MaintenanceScheduleItem {
  id: string;
  scheduleType: "RECURRING" | "ADHOC" | string;
  assetId: string;
  templateId: string | null;
  frequencyDays: number | null;
  nextDueDate: string | Date;
  status: "UPCOMING" | "DUE" | "OVERDUE" | "DONE" | string;
  lastRemindedAt: string | Date | null;
  asset: {
    id: string;
    assetCode: string;
    assetName: string;
    location: string | null;
    detailedLocation?: string | null;
    division?: { id: string; name: string } | null;
    assetType?: { id: string; name: string } | null;
  };
  template?: {
    id: string;
    templateName: string;
    defaultFrequencyDays: number;
    reminderOffsetDays: number;
    checklistItems?: ChecklistItemOption[];
  } | null;
  assignedExecutors: Array<{ id: string; name: string; photo?: string | null }>;
  _count?: { logs: number };
}

export interface MaintenanceLogItem {
  id: string;
  scheduleId: string;
  executedById: string;
  executionDate: string | Date;
  overallCondition: "BAIK" | "PERLU_PERHATIAN" | "BERMASALAH" | string;
  findings: string | null;
  followUpNeeded: boolean;
  supportTicketId?: string | null;
  attachment: string | null;
  executedBy?: { id: string; name: string } | null;
  supportTicket?: { id: string; ticketNumber: string | null; status: string } | null;
  schedule?: {
    id: string;
    scheduleType: string;
    asset: {
      id: string;
      assetCode: string;
      assetName: string;
      location: string | null;
      division?: { id: string; name: string } | null;
    };
  } | null;
  checklistResults: Array<{
    id: string;
    itemText: string;
    checked: boolean;
    note: string | null;
  }>;
}

export interface MaintCurrentUser {
  id: string;
  name: string;
  jobDesk?: string | null;
  role: string;
  photo?: string | null;
  canManageMaintenance: boolean;
  handledAreas: string[];
}
