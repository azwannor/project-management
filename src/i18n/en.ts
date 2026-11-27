export interface I18nDict {
  readonly common: {
    readonly appName: string;
    readonly brandTag: string;
    readonly searchPlaceholder: string;
    readonly save: string;
    readonly cancel: string;
    readonly delete: string;
    readonly edit: string;
    readonly actions: string;
    readonly loading: string;
    readonly exportXlsx: string;
    readonly light: string;
    readonly dark: string;
    readonly yes: string;
    readonly no: string;
  };
  readonly nav: {
    readonly overview: string;
    readonly overviewShort: string;
    readonly projects: string;
    readonly projectsShort: string;
    readonly tasks: string;
    readonly support: string;
    readonly supportShort: string;
    readonly assets: string;
    readonly assetsShort: string;
    readonly maintenance: string;
    readonly settings: string;
    readonly more: string;
    readonly collapseMenu: string;
    readonly expandMenu: string;
  };
  readonly auth: {
    readonly title: string;
    readonly subtitle: string;
    readonly email: string;
    readonly password: string;
    readonly signIn: string;
    readonly signOut: string;
    readonly invalidCredentials: string;
    readonly sessionMeta: string;
    readonly serverError: string;
    readonly showPassword: string;
    readonly hidePassword: string;
    readonly cardProjectsTitle: string;
    readonly cardProjectsDesc: string;
    readonly cardSupportTitle: string;
    readonly cardSupportDesc: string;
    readonly cardAssetsTitle: string;
    readonly cardAssetsDesc: string;
  };
  readonly support: {
    readonly queueTab: string;
    readonly dailyTab: string;
    readonly allTab: string;
    readonly myScope: string;
    readonly teamScope: string;
    readonly newTicket: string;
    readonly newLog: string;
    readonly editTicket: string;
    readonly exportCsv: string;
    readonly searchPlaceholder: string;
    readonly allUsers: string;
    readonly allModules: string;
    readonly allCategories: string;
    readonly allStatuses: string;
    readonly allPriorities: string;
    readonly filterDatePlaceholder: string;
    readonly clearFilters: string;
    readonly kpiOpenQueue: string;
    readonly kpiSlaHealth: string;
    readonly kpiDailyActivity: string;
    readonly kpiAvgMttr: string;
    readonly slaOnTrack: string;
    readonly slaAtRisk: string;
    readonly slaBreached: string;
    readonly slaMet: string;
    readonly slaMissed: string;
    readonly slaFilterAll: string;
    readonly slaFilterAlert: string;
    readonly slaFilterUrgent: string;
    readonly ticketTypeLabel: string;
    readonly requestLabel: string;
    readonly dailyLogLabel: string;
    readonly titleLabel: string;
    readonly requesterLabel: string;
    readonly requesterEmailLabel: string;
    readonly moduleLabel: string;
    readonly categoryLabel: string;
    readonly customModulePlaceholder: string;
    readonly regionalAreaLabel: string;
    readonly autoAssignHint: string;
    readonly executorsLabel: string;
    readonly linkedAssetLabel: string;
    readonly noAssetLinked: string;
    readonly startTimeLabel: string;
    readonly endTimeLabel: string;
    readonly referenceLinkLabel: string;
    readonly promoteTask: string;
    readonly promoteChooseProject: string;
    readonly promoteSuccess: string;
    readonly promotedBadge: string;
    readonly remindTelegram: string;
    readonly remindSent: string;
    readonly remindFailed: string;
    readonly emptyTitle: string;
    readonly emptyDesc: string;
    readonly deleteConfirm: string;
    readonly showMore: string;
    readonly sourceLabel: string;
    readonly slaRemainingPrefix: string;
    readonly slaOverduePrefix: string;
    readonly colTicketMode: string;
    readonly colSubjectContext: string;
    readonly colModuleCategory: string;
    readonly colRequesterStaff: string;
    readonly colScheduleSla: string;
    readonly colStatusPriority: string;
  };
  readonly assets: {
    readonly registryTab: string;
    readonly qrStudioTab: string;
    readonly schedulesTab: string;
    readonly execTab: string;
    readonly templatesTab: string;
    readonly kpiTotalAssets: string;
    readonly kpiInRepair: string;
    readonly kpiWarrantyAlert: string;
    readonly kpiPendingSched: string;
    readonly newAsset: string;
    readonly editAsset: string;
    readonly importExcel: string;
    readonly newSchedule: string;
    readonly newTemplate: string;
    readonly searchPlaceholder: string;
    readonly allDivisions: string;
    readonly allTypes: string;
    readonly allStatuses: string;
    readonly printStickers: string;
    readonly markPrinted: string;
    readonly thermalPreset: string;
    readonly a4Preset: string;
    readonly selectAll: string;
    readonly selectUnprinted: string;
    readonly custodyHistory: string;
    readonly custodyNotePlaceholder: string;
    readonly handoverMoved: string;
    readonly scanPreview: string;
    readonly openScanPage: string;
    readonly reportIssue: string;
    readonly executeNow: string;
    readonly overallCondition: string;
    readonly conditionGood: string;
    readonly conditionAttention: string;
    readonly conditionProblem: string;
    readonly findingsLabel: string;
    readonly followUpNeeded: string;
    readonly createTicketAuto: string;
    readonly submitLog: string;
    readonly remindTelegram: string;
    readonly retireAssetConfirm: string;
    readonly warrantyActive: string;
    readonly warrantyExpiring: string;
    readonly warrantyExpired: string;
    readonly noWarranty: string;
    readonly qrPrintedLabel: string;
    readonly qrNotPrinted: string;
    readonly duplicateTemplate: string;
    readonly pendingQueueTitle: string;
    readonly recentLogsTitle: string;
    readonly noPendingSchedules: string;
  };
  readonly dashboard: {
    readonly boardroomOn: string;
    readonly boardroomOff: string;
    readonly printPdf: string;
    readonly allMembers: string;
    readonly periodThisMonth: string;
    readonly periodThisQuarter: string;
    readonly periodThisYear: string;
    readonly periodAllTime: string;
    readonly periodCustom: string;
    readonly kpiOnTime: string;
    readonly kpiSla: string;
    readonly kpiMaint: string;
    readonly kpiWorkload: string;
    readonly vsPrevPeriod: string;
    readonly noBaseline: string;
    readonly atRiskLabel: string;
    readonly delayedLabel: string;
    readonly onTrackLabel: string;
    readonly completedLabel: string;
    readonly openReqLabel: string;
    readonly breachedLabel: string;
    readonly mttrLabel: string;
    readonly activeAssetsLabel: string;
    readonly due7DaysLabel: string;
    readonly avgPerStaffLabel: string;
    readonly roadmapTitle: string;
    readonly todayMarker: string;
    readonly teamMatrixTitle: string;
    readonly viewSummary: string;
    readonly viewTimeline: string;
    readonly memberCol: string;
    readonly tasksDoneCol: string;
    readonly ticketsCol: string;
    readonly mttrCol: string;
    readonly maintCol: string;
    readonly hoursCol: string;
    readonly openWorkCol: string;
    readonly effortTitle: string;
    readonly effortModeHours: string;
    readonly effortModeOps: string;
    readonly effortProject: string;
    readonly effortSupport: string;
    readonly effortMaint: string;
    readonly blockerTitle: string;
    readonly noBlockers: string;
    readonly supportVolTitle: string;
    readonly volRequest: string;
    readonly volDaily: string;
    readonly assetUpcomingTitle: string;
    readonly actionQueueTitle: string;
    readonly noActionQueue: string;
    readonly overdueTag: string;
    readonly dueTag: string;
    readonly expandTasks: string;
    readonly noProjectsMatch: string;
    readonly projectsTag: string;
    readonly mainTaskCol: string;
    readonly picCol: string;
    readonly statusCol: string;
    readonly subtasksCol: string;
    readonly targetActualCol: string;
    readonly openWorkspace: string;
    readonly noRootTasks: string;
    readonly noSupportRecords: string;
    readonly noSchedules7d: string;
    readonly activeTag: string;
    readonly inRepairTag: string;
    readonly otherTag: string;
    readonly pendingTag: string;
    readonly itemsUnit: string;
    readonly activeCountTag: string;
    readonly tasksShort: string;
    readonly ticketsShort: string;
    readonly kpiEffort: string;
    readonly alertsLabel: string;
    readonly briefingTitle: string;
    readonly liveBadge: string;
    readonly slaMetBadge: string;
    readonly healthyBadge: string;
    readonly reqVsLogBadge: string;
    readonly upcomingDeliverables: string;
    readonly assetMaintHealthTitle: string;
    readonly activeInRepairLabel: string;
    readonly qrStickeredLabel: string;
    readonly dueNext7DaysLabel: string;
    readonly membersBadge: string;
    readonly teamWorkloadHeading: string;
    readonly roadmapColumnLabel: string;
    readonly dueInPrefix: string;
    readonly breachLabel: string;
    readonly ongoingLabel: string;
  };
  readonly projects: {
    readonly viewPortfolio: string;
    readonly viewTable: string;
    readonly viewKanban: string;
    readonly viewTimeline: string;
    readonly viewCalendar: string;
    readonly newProject: string;
    readonly editProject: string;
    readonly newTask: string;
    readonly editTask: string;
    readonly allProjects: string;
    readonly allStatuses: string;
    readonly searchTasksPlaceholder: string;
    readonly liveTimer: string;
    readonly dragToReparent: string;
    readonly dropHereToPromote: string;
    readonly addInlinePlaceholder: string;
    readonly enterToSave: string;
    readonly projectObjective: string;
    readonly teamMembers: string;
    readonly projectTasksTitle: string;
    readonly scheduleVariance: string;
    readonly hybridTimeTracker: string;
    readonly startTimer: string;
    readonly pauseTimer: string;
    readonly logManualTime: string;
    readonly docsAndUpload: string;
    readonly uploadFile: string;
    readonly commentsLabel: string;
    readonly unreadLabel: string;
    readonly issueLabel: string;
    readonly solutionLabel: string;
    readonly remindTelegram: string;
    readonly addSubtask: string;
    readonly confirmDeleteTitle: string;
    readonly minutesLabel: string;
    readonly noteOptional: string;
    readonly zoomIn: string;
    readonly zoomOut: string;
    readonly resetZoom: string;
    readonly expandAllProjects: string;
    readonly collapseAllProjects: string;
    readonly unassignedProject: string;
    readonly dropAbove: string;
    readonly dropBelow: string;
    readonly dropInside: string;
    readonly dropToProject: string;
    readonly swimlanesMode: string;
    readonly singleBoardMode: string;
    readonly mainTasksOnly: string;
    readonly allTasksMode: string;
    readonly allExecutors: string;
    readonly subtasksCount: string;
    readonly moveCardTo: string;
    readonly scaleWeek: string;
    readonly scaleMonth: string;
    readonly scaleQuarter: string;
    readonly jumpToToday: string;
    readonly overdueLabel: string;
    readonly addCard: string;
    readonly progressLabel: string;
    readonly calendarSpan: string;
    readonly calendarDeadlines: string;
    readonly selectedDateTitle: string;
    readonly noTasksOnDate: string;
    readonly calDay: string;
    readonly calWeek: string;
    readonly calMonth: string;
    readonly calTeam: string;
    readonly calActiveSchedule: string;
  };
  readonly settings: {
    readonly tabProfile: string;
    readonly tabProfileShort: string;
    readonly tabUsers: string;
    readonly tabUsersShort: string;
    readonly tabMaster: string;
    readonly tabMasterShort: string;
    readonly profileTitle: string;
    readonly profileSynced: string;
    readonly changePhoto: string;
    readonly uploadingPhoto: string;
    readonly fullName: string;
    readonly email: string;
    readonly telegramUsername: string;
    readonly telegramUsernameHint: string;
    readonly telegramChatId: string;
    readonly telegramSyncBanner: string;
    readonly changePassword: string;
    readonly changePasswordOpt: string;
    readonly oldPassword: string;
    readonly newPassword: string;
    readonly permissionsTitle: string;
    readonly saveChanges: string;
    readonly workspacePrefsTitle: string;
    readonly languageLabel: string;
    readonly appearanceLabel: string;
    readonly themeLight: string;
    readonly themeDark: string;
    readonly notificationsTitle: string;
    readonly prefSlaSound: string;
    readonly prefSlaSoundDesc: string;
    readonly prefDesktopAlert: string;
    readonly prefDesktopAlertDesc: string;
    readonly prefCompactDensity: string;
    readonly prefCompactDensityDesc: string;
    readonly signOutActive: string;
    readonly teamRosterTitle: string;
    readonly addUser: string;
    readonly editUser: string;
    readonly createUser: string;
    readonly jobDesk: string;
    readonly roleLabel: string;
    readonly accessFlagsLabel: string;
    readonly canViewTeamLogsLabel: string;
    readonly canViewTeamLogsDesc: string;
    readonly canManageMaintLabel: string;
    readonly canManageMaintDesc: string;
    readonly activeAccountLabel: string;
    readonly activeAccountDesc: string;
    readonly handledAreasLabel: string;
    readonly selectAll: string;
    readonly clearAll: string;
    readonly updateUser: string;
    readonly deleteUserConfirm: string;
    readonly masterDataTitle: string;
    readonly noHardcodedBadge: string;
    readonly subDivisions: string;
    readonly subLocations: string;
    readonly subAssetTypes: string;
    readonly subAreas: string;
    readonly subSupportSla: string;
    readonly addItem: string;
    readonly codeOptional: string;
    readonly addressOptional: string;
    readonly slaPoliciesTitle: string;
    readonly firstResponseMin: string;
    readonly targetMinutes: string;
    readonly reminderPercent: string;
    readonly updateSla: string;
    readonly integrationsTitle: string;
    readonly telegramEngineTitle: string;
    readonly testBotMessage: string;
    readonly syncWebhook: string;
    readonly cronDiagnosticsTitle: string;
    readonly runRemindersCron: string;
    readonly runMaintCron: string;
    readonly storageRuntimeTitle: string;
    readonly externalApiKeysTitle: string;
    readonly generateApiKey: string;
    readonly copyKeyWarning: string;
    readonly keyNameLabel: string;
    readonly sourceAppLabel: string;
    readonly revokeKey: string;
    readonly activateKey: string;
  };
}

export const en = {
  common: {
    appName: "IT Tracker",
    brandTag: "ROYAL MEDICA",
    searchPlaceholder: "Search...",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    actions: "Actions",
    loading: "Loading...",
    exportXlsx: "Export .xlsx",
    light: "LIGHT",
    dark: "DARK",
    yes: "Yes",
    no: "No",
  },
  nav: {
    overview: "Executive Overview",
    overviewShort: "Overview",
    projects: "Projects & Tasks",
    projectsShort: "Projects",
    tasks: "Tasks",
    support: "Support Queue",
    supportShort: "Support",
    assets: "Assets & QR",
    assetsShort: "Assets",
    maintenance: "Maintenance",
    settings: "Settings",
    more: "More",
    collapseMenu: "Collapse sidebar",
    expandMenu: "Expand sidebar",
  },
  auth: {
    title: "IT Command Center",
    subtitle: "PT. Royal Medicalink Pharmalab Internal Operations",
    email: "Email",
    password: "Password",
    signIn: "Sign in to System",
    signOut: "Sign Out",
    invalidCredentials: "Invalid email or password",
    sessionMeta: "JWT Rolling Session · EN / ID · Light & Dark",
    serverError: "Server error occurred. Please try again.",
    showPassword: "Show password",
    hidePassword: "Hide password",
    cardProjectsTitle: "Roadmap & Time Log",
    cardProjectsDesc: "Project Gantt, Kanban & automatic session telemetry",
    cardSupportTitle: "Support SLA Engine",
    cardSupportDesc: "Regional auto-assign & Telegram inline quick-resolve",
    cardAssetsTitle: "Assets & QR Maintenance",
    cardAssetsDesc: "Thermal/A4 stickers & mobile tap-to-check field scan",
  },
  support: {
    queueTab: "Support Queue",
    dailyTab: "Daily Activity",
    allTab: "All Records",
    myScope: "My Queue & Logs",
    teamScope: "Team Operations",
    newTicket: "New Ticket",
    newLog: "Log Activity",
    editTicket: "Ticket Detail",
    exportCsv: "Export CSV",
    searchPlaceholder: "Search ticket #, subject, requester, area...",
    allUsers: "All IT Staff",
    allModules: "All Modules",
    allCategories: "All Categories",
    allStatuses: "All Statuses",
    allPriorities: "All Priorities",
    filterDatePlaceholder: "Filter by date",
    clearFilters: "Clear Filters",
    kpiOpenQueue: "Open Support Queue",
    kpiSlaHealth: "SLA Compliance",
    kpiDailyActivity: "Daily Ops & Hours",
    kpiAvgMttr: "Avg Resolution (MTTR)",
    slaOnTrack: "SLA ON TRACK",
    slaAtRisk: "SLA AT RISK",
    slaBreached: "SLA BREACHED",
    slaMet: "SLA MET",
    slaMissed: "SLA MISSED",
    slaFilterAll: "All Tickets",
    slaFilterAlert: "At Risk / Breached",
    slaFilterUrgent: "Urgent & High",
    ticketTypeLabel: "Record Mode",
    requestLabel: "Support Request (SLA)",
    dailyLogLabel: "Daily IT Activity",
    titleLabel: "Subject / Activity Title",
    requesterLabel: "Requester",
    requesterEmailLabel: "Requester Email (optional)",
    moduleLabel: "Module / System",
    categoryLabel: "Category",
    customModulePlaceholder: "Specify custom module...",
    regionalAreaLabel: "Regional Area",
    autoAssignHint: "Regional staff are auto-assigned when an area is chosen.",
    executorsLabel: "Assigned IT Staff",
    linkedAssetLabel: "Linked Enterprise Asset",
    noAssetLinked: "No asset linked",
    startTimeLabel: "Start Time",
    endTimeLabel: "End Time",
    referenceLinkLabel: "Reference Link / URL",
    promoteTask: "Promote to Project Task",
    promoteChooseProject: "Select target project",
    promoteSuccess: "Ticket promoted to Project Task",
    promotedBadge: "PROMOTED",
    remindTelegram: "Remind via Telegram",
    remindSent: "Reminder sent to Telegram & in-app notifications.",
    remindFailed: "Failed to send reminder.",
    emptyTitle: "No support tickets match these filters",
    emptyDesc: "Create a Support Request or Daily Activity log, or clear active filters.",
    deleteConfirm: "Delete this support ticket? Associated sessions and comments will also be removed.",
    showMore: "Load More Records",
    sourceLabel: "Source",
    slaRemainingPrefix: "SLA left",
    slaOverduePrefix: "SLA overdue",
    colTicketMode: "Ticket & Mode",
    colSubjectContext: "Subject & Context",
    colModuleCategory: "Module / Category",
    colRequesterStaff: "Requester & IT Staff",
    colScheduleSla: "Schedule / SLA",
    colStatusPriority: "Status & Priority",
  },
  assets: {
    registryTab: "Registry",
    qrStudioTab: "QR & Custody",
    schedulesTab: "Schedules",
    execTab: "Execute Maint",
    templatesTab: "Templates",
    kpiTotalAssets: "Enterprise Assets",
    kpiInRepair: "In Repair / Issues",
    kpiWarrantyAlert: "Warranty Alerts",
    kpiPendingSched: "Pending Schedules",
    newAsset: "New Asset",
    editAsset: "Asset Detail & Custody",
    importExcel: "Import Excel",
    newSchedule: "New Schedule",
    newTemplate: "New Template",
    searchPlaceholder: "Search code, asset name, SN, holder...",
    allDivisions: "All Divisions",
    allTypes: "All Asset Types",
    allStatuses: "All Statuses",
    printStickers: "Print Stickers",
    markPrinted: "Mark QR Printed",
    thermalPreset: "Thermal 50×30mm",
    a4Preset: "A4 Sticker Sheet",
    selectAll: "Select All",
    selectUnprinted: "Select Unprinted",
    custodyHistory: "Custody Handover Audit",
    custodyNotePlaceholder: "Reason for handover or relocation (optional)...",
    handoverMoved: "Custody transfer logged automatically on save.",
    scanPreview: "Field Scan Link",
    openScanPage: "Open Field Scan",
    reportIssue: "Report Asset Issue (Ticket)",
    executeNow: "Execute Maint",
    overallCondition: "Overall Condition",
    conditionGood: "Good",
    conditionAttention: "Needs Attention",
    conditionProblem: "Issue / Problem",
    findingsLabel: "Inspection Findings & Notes",
    followUpNeeded: "Needs follow-up repair / support",
    createTicketAuto: "Also create Support Request Ticket automatically",
    submitLog: "Submit Maintenance Log",
    remindTelegram: "Remind Telegram",
    retireAssetConfirm: "Retire this asset? It will remain in custody and maintenance history.",
    warrantyActive: "Warranty OK",
    warrantyExpiring: "Expiring Soon",
    warrantyExpired: "Expired",
    noWarranty: "No Warranty",
    qrPrintedLabel: "QR Printed",
    qrNotPrinted: "Unprinted",
    duplicateTemplate: "Duplicate",
    pendingQueueTitle: "Select Pending Schedule to Execute",
    recentLogsTitle: "Maintenance Inspection Logs",
    noPendingSchedules: "All maintenance schedules are up to date!",
  },
  dashboard: {
    boardroomOn: "Boardroom Mode",
    boardroomOff: "Exit Boardroom",
    printPdf: "Print / PDF",
    allMembers: "All IT Staff",
    periodThisMonth: "This Month",
    periodThisQuarter: "This Quarter",
    periodThisYear: "This Year",
    periodAllTime: "All Time",
    periodCustom: "Custom Range",
    kpiOnTime: "Project On-Time Rate",
    kpiSla: "Support SLA & MTTR",
    kpiMaint: "Maint Compliance & Health",
    kpiWorkload: "Active Workload",
    vsPrevPeriod: "vs prev period",
    noBaseline: "Cumulative total",
    atRiskLabel: "At Risk",
    delayedLabel: "Delayed",
    onTrackLabel: "On Track",
    completedLabel: "Completed",
    openReqLabel: "Open Requests",
    breachedLabel: "SLA Breached",
    mttrLabel: "Avg MTTR",
    activeAssetsLabel: "Active Assets",
    due7DaysLabel: "Due 7D",
    avgPerStaffLabel: "Avg / member",
    roadmapTitle: "Master Project Roadmap",
    todayMarker: "TODAY",
    teamMatrixTitle: "Team Performance Matrix",
    viewSummary: "Summary",
    viewTimeline: "Tasks & Timeline",
    memberCol: "Team Member",
    tasksDoneCol: "Tasks Done",
    ticketsCol: "Tickets Resolved",
    mttrCol: "MTTR",
    maintCol: "Maint",
    hoursCol: "Logged Time",
    openWorkCol: "Active Queue",
    effortTitle: "Effort Distribution Split",
    effortModeHours: "TimeLog Telemetry",
    effortModeOps: "Activity Volume Mix",
    effortProject: "Project Development",
    effortSupport: "Support Queue",
    effortMaint: "Preventive Maintenance",
    blockerTitle: "Blocker & Escalation Radar",
    noBlockers: "No active blockers or SLA breaches in the current scope.",
    supportVolTitle: "Support Volume by Module",
    volRequest: "SLA Requests",
    volDaily: "Daily Activity",
    assetUpcomingTitle: "Asset Health & Upcoming 7D",
    actionQueueTitle: "My Action Queue",
    noActionQueue: "No pending tasks, requests, or maintenance schedules assigned.",
    overdueTag: "OVERDUE",
    dueTag: "DUE",
    expandTasks: "main tasks",
    noProjectsMatch: "No projects match the selected scope.",
    projectsTag: "PROJECTS",
    mainTaskCol: "Main Task",
    picCol: "PIC",
    statusCol: "Status",
    subtasksCol: "Subtasks",
    targetActualCol: "Target → Actual",
    openWorkspace: "Open Project Workspace",
    noRootTasks: "No root tasks recorded yet.",
    noSupportRecords: "No support records in selected period.",
    noSchedules7d: "No schedules due within 7 days.",
    activeTag: "ACTIVE",
    inRepairTag: "IN REPAIR",
    otherTag: "OTHER",
    pendingTag: "PENDING",
    itemsUnit: "items",
    activeCountTag: "active",
    tasksShort: "TASKS",
    ticketsShort: "TICKETS",
    kpiEffort: "Effort Allocation",
    alertsLabel: "ALERTS",
    briefingTitle: "IT Executive Briefing",
    liveBadge: "LIVE",
    slaMetBadge: "SLA MET",
    healthyBadge: "HEALTHY",
    reqVsLogBadge: "REQ vs LOG",
    upcomingDeliverables: "UPCOMING DELIVERABLES (14D)",
    assetMaintHealthTitle: "Asset & Maintenance Health",
    activeInRepairLabel: "ACTIVE / IN REPAIR",
    qrStickeredLabel: "QR STICKERED",
    dueNext7DaysLabel: "DUE NEXT 7 DAYS",
    membersBadge: "MEMBERS",
    teamWorkloadHeading: "Team Member Workload & Active Task Timelines",
    roadmapColumnLabel: "PROJECT / MAIN TASKS",
    dueInPrefix: "DUE",
    breachLabel: "BREACH",
    ongoingLabel: "ONGOING",
  },
  projects: {
    viewPortfolio: "Portfolio",
    viewTable: "Table",
    viewKanban: "Kanban",
    viewTimeline: "Timeline",
    viewCalendar: "Calendar",
    newProject: "New Project",
    editProject: "Edit Project",
    newTask: "New Task",
    editTask: "Task Detail",
    allProjects: "All Projects",
    allStatuses: "All Statuses",
    searchTasksPlaceholder: "Search tasks or executors...",
    liveTimer: "LIVE TIMER",
    dragToReparent: "DRAG: EDGE = REORDER · CENTER = SUBTASK",
    dropHereToPromote: "Drop here to move task to Root Level",
    addInlinePlaceholder: "+ Add quick task in selected project (press Enter to save)",
    enterToSave: "ENTER TO SAVE",
    projectObjective: "Objective",
    teamMembers: "Team Members",
    projectTasksTitle: "Tasks in This Project",
    scheduleVariance: "Schedule Variance (Planned vs Actual End Date)",
    hybridTimeTracker: "Hybrid Time Tracker",
    startTimer: "Start Timer",
    pauseTimer: "Pause Timer",
    logManualTime: "Log Manual Time",
    docsAndUpload: "Task Docs & MinIO Upload",
    uploadFile: "Upload File",
    commentsLabel: "Comments",
    unreadLabel: "UNREAD",
    issueLabel: "Issue / Blocker",
    solutionLabel: "Solution / Notes",
    remindTelegram: "Remind via Telegram",
    addSubtask: "Add Subtask",
    confirmDeleteTitle: "Confirm delete",
    minutesLabel: "Minutes",
    noteOptional: "Session note (optional)",
    zoomIn: "Zoom in table",
    zoomOut: "Zoom out table",
    resetZoom: "Reset table zoom to 100%",
    expandAllProjects: "Expand all",
    collapseAllProjects: "Collapse all",
    unassignedProject: "General / Unassigned",
    dropAbove: "Move above",
    dropBelow: "Move below",
    dropInside: "Nest as subtask",
    dropToProject: "Move to project root",
    swimlanesMode: "Swimlanes",
    singleBoardMode: "Combined",
    mainTasksOnly: "Main Tasks",
    allTasksMode: "All Tasks",
    allExecutors: "All Executors",
    subtasksCount: "subtasks",
    moveCardTo: "Move to",
    scaleWeek: "Week",
    scaleMonth: "Month",
    scaleQuarter: "Fit All",
    jumpToToday: "Today",
    overdueLabel: "Overdue",
    addCard: "Add Task",
    progressLabel: "Progress",
    calendarSpan: "Active Span",
    calendarDeadlines: "Due Dates",
    selectedDateTitle: "Selected Date",
    noTasksOnDate: "No tasks scheduled on this date.",
    calDay: "Day",
    calWeek: "Week",
    calMonth: "Month",
    calTeam: "Team",
    calActiveSchedule: "Daily Schedule & Tasks",
  },
  settings: {
    tabProfile: "My Profile",
    tabProfileShort: "Profile",
    tabUsers: "Users",
    tabUsersShort: "Users",
    tabMaster: "Master & API",
    tabMasterShort: "Master",
    profileTitle: "Personal Information",
    profileSynced: "PROFILE SYNCED · JWT ACTIVE",
    changePhoto: "Upload Photo",
    uploadingPhoto: "Uploading...",
    fullName: "Full Name",
    email: "Email",
    telegramUsername: "Telegram Username",
    telegramUsernameHint: "(Without @)",
    telegramChatId: "Telegram Chat ID",
    telegramSyncBanner: "Send /start to your IT Tracker Telegram Bot to retrieve your Chat ID for DM alerts & inline quick-resolve.",
    changePassword: "Change Password",
    changePasswordOpt: "(Optional)",
    oldPassword: "Old Password",
    newPassword: "New Password (min 6 chars)",
    permissionsTitle: "Assigned Role Permissions & Handled Areas",
    saveChanges: "Save Changes",
    workspacePrefsTitle: "Workspace Preferences",
    languageLabel: "LANGUAGE / BAHASA (BILINGUAL)",
    appearanceLabel: "APPEARANCE THEME",
    themeLight: "Light Clean",
    themeDark: "Soft Charcoal Dark",
    notificationsTitle: "CLIENT PREFERENCES & UI ALERTS",
    prefSlaSound: "SLA Alert Sound",
    prefSlaSoundDesc: "Play subtle chime when tickets enter SLA Risk (<30m)",
    prefDesktopAlert: "Inline Notification Badges",
    prefDesktopAlertDesc: "Highlight unread comments & assignments in header bell",
    prefCompactDensity: "Compact Table Density",
    prefCompactDensityDesc: "Tighter row spacing on dense data tables",
    signOutActive: "Sign Out Active Session",
    teamRosterTitle: "IT Team Roster",
    addUser: "+ Add User",
    editUser: "Edit User",
    createUser: "Create User",
    jobDesk: "Job Desk",
    roleLabel: "Role",
    accessFlagsLabel: "GRANULAR ACCESS FLAGS",
    canViewTeamLogsLabel: "Can View Team Logs",
    canViewTeamLogsDesc: "Allow viewing all team support tickets & daily logs even as Staff.",
    canManageMaintLabel: "Can Manage Maintenance",
    canManageMaintDesc: "Allow Assets, Divisions, Templates & Batch QR administration.",
    activeAccountLabel: "Account Active",
    activeAccountDesc: "Disable to revoke login access without deleting historical logs.",
    handledAreasLabel: "HANDLED AREAS (AUTO-ASSIGN MASTER DATA)",
    selectAll: "Select All",
    clearAll: "Clear",
    updateUser: "Update User",
    deleteUserConfirm: "Delete user account",
    masterDataTitle: "Master Data Manager",
    noHardcodedBadge: "DB-BACKED · ZERO HARDCODE",
    subDivisions: "Divisions",
    subLocations: "Locations",
    subAssetTypes: "Asset Types",
    subAreas: "Areas",
    subSupportSla: "Support & SLA",
    addItem: "+ Add",
    codeOptional: "Code (optional)",
    addressOptional: "Address (optional)",
    slaPoliciesTitle: "SLA Response & Resolution Policies",
    firstResponseMin: "First Resp (m)",
    targetMinutes: "Resolution (m)",
    reminderPercent: "Warn %",
    updateSla: "Save SLA",
    integrationsTitle: "Integrations & Infrastructure",
    telegramEngineTitle: "Telegram Bot & Webhook Engine",
    testBotMessage: "Test Bot Message",
    syncWebhook: "Sync Webhook",
    cronDiagnosticsTitle: "Cron Jobs & Queue Radar",
    runRemindersCron: "Run Reminders Check",
    runMaintCron: "Run Maint Check",
    storageRuntimeTitle: "Storage & Runtime Status",
    externalApiKeysTitle: "ExternalApiKey · Ticket Ingestion",
    generateApiKey: "+ Generate Key",
    copyKeyWarning: "Copy this raw API key now — it will never be shown again:",
    keyNameLabel: "Key Label (e.g. Sistem AI Prod)",
    sourceAppLabel: "Source App (e.g. Sistem AI)",
    revokeKey: "Revoke",
    activateKey: "Activate",
  },
} as const satisfies I18nDict;
