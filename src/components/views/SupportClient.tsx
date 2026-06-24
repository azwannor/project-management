"use client";

import { useState, useEffect } from "react";
import { Plus, Loader2, Trash2, Save, XCircle, Clock, CheckCircle2, PauseCircle, AlertCircle, Table2, Check, X, Download } from "lucide-react";
import { useRouter } from "next/navigation";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import ModernSelect from "../common/ModernSelect";
import { Paperclip, MessageSquare, Link as LinkIcon } from "lucide-react";
import CommentsDrawer from "../common/CommentsDrawer";
import dynamic from "next/dynamic";
import "react-quill-new/dist/quill.snow.css";

const ReactQuill = dynamic(() => import("react-quill-new"), { ssr: false });

export default function SupportClient({ tickets = [], currentUser, systemUsers = [] }: { tickets: any[], currentUser: any, systemUsers?: any[] }) {
  const [addingTicket, setAddingTicket] = useState(false);
  const [editingTicket, setEditingTicket] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'my-logs' | 'team-logs'>('my-logs');
  const [activeCommentTicket, setActiveCommentTicket] = useState<{id: string, title: string} | null>(null);
  
  const defaultTaskData = {
    ticketType: "DAILY_ACTIVITY",
    requesterName: "",
    executorIds: [] as string[],
    taskName: "",
    supportType: "User Admin",
    module: "Sistem AI",
    customModule: "",
    startDate: new Date(),
    endDate: new Date(new Date().getTime() + 60 * 60 * 1000), // +1 hour
    issue: "",
    solution: "",
    status: "Done",
    priority: "Normal",
    attachment: "",
    link: "",
    area: ""
  };

  const [newTaskData, setNewTaskData] = useState(defaultTaskData);
  const [editTaskData, setEditTaskData] = useState<any>(null);

  const router = useRouter();

  const handleAddTicket = async () => {
    if (!newTaskData.taskName.trim()) return;
    setIsSubmitting(true);
    
    const finalModule = newTaskData.module === "Lainnya" ? newTaskData.customModule : newTaskData.module;

    try {
      await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newTaskData,
          status: newTaskData.ticketType === "REQUEST" ? "Not Started" : newTaskData.status,
          module: finalModule,
          area: newTaskData.supportType === "Master Data" ? newTaskData.area : null
        })
      });
      setNewTaskData(defaultTaskData);
      setAddingTicket(false);
      router.refresh();
    } catch (error) { 
      console.error(error); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, isEditing: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) {
        if (isEditing) setEditTaskData({ ...editTaskData, attachment: data.url });
        else setNewTaskData({ ...newTaskData, attachment: data.url });
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error("Upload error", error);
      alert("Failed to upload file");
    }
  };

  const handleUpdateTicket = async () => {
    if (!editTaskData || !editTaskData.taskName.trim()) return;
    setIsSubmitting(true);
    
    const finalModule = editTaskData.module === "Lainnya" ? editTaskData.customModule : editTaskData.module;

    try {
      await fetch(`/api/support/${editTaskData.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskName: editTaskData.taskName,
          supportType: editTaskData.supportType,
          module: finalModule,
          startDate: editTaskData.startDate.toISOString(),
          endDate: editTaskData.endDate.toISOString(),
          issue: editTaskData.issue,
          solution: editTaskData.solution,
          status: editTaskData.status,
          priority: editTaskData.priority,
          attachment: editTaskData.attachment,
          ticketType: editTaskData.ticketType,
          requesterName: editTaskData.requesterName,
          executorIds: editTaskData.executors?.map((e: any) => e.id) || [],
          link: editTaskData.link,
          area: editTaskData.supportType === "Master Data" ? editTaskData.area : null
        })
      });
      setEditingTicket(null);
      setEditTaskData(null);
      router.refresh();
    } catch (error) { 
      console.error(error); 
    } finally { 
      setIsSubmitting(false); 
    }
  };

  const handleDeleteTicket = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this ticket?")) return;
    try { 
      await fetch(`/api/support/${taskId}`, { method: "DELETE" }); 
      router.refresh(); 
    } catch (error) { 
      console.error(error); 
    }
  };

  const openEditModal = (ticket: any) => {
    setEditingTicket(ticket);
    const isCustomModule = !(ticket.module in CATEGORY_MAP) && ticket.module !== "General IT / Lainnya...";
    setEditTaskData({
      ...ticket,
      startDate: new Date(ticket.startDate),
      endDate: new Date(ticket.endDate),
      module: isCustomModule ? "General IT / Lainnya..." : ticket.module,
      customModule: isCustomModule ? ticket.module : "",
      priority: ticket.priority || "Normal",
      attachment: ticket.attachment || "",
      ticketType: ticket.ticketType || "DAILY_ACTIVITY",
      requesterName: ticket.requesterName || "",
      executorIds: ticket.executors ? ticket.executors.map((e: any) => e.id) : [],
      link: ticket.link || "",
      area: ticket.area || ""
    });
  };

  const CATEGORY_MAP: Record<string, string[]> = {
    "Sistem AI": ["User Admin", "Master Data", "Proses Sales", "Bug Fixing & Error Handling", "New Feature / Development", "User Training & Guidance", "Maintenance & Server Check"],
    "Sistem PIC": ["User Admin", "Master Data", "Bug Fixing & Error Handling", "New Feature / Development", "User Training & Guidance", "Maintenance & Server Check"],
    "Sistem HRIS": ["User Admin", "Master Data", "Bug Fixing & Error Handling", "New Feature / Development", "User Training & Guidance", "Maintenance & Server Check"],
    "Factory Sistem": ["User Admin", "Master Data", "Bug Fixing & Error Handling", "New Feature / Development", "User Training & Guidance", "Maintenance & Server Check"],
    "Website / Portal": ["User Admin", "Master Data", "Bug Fixing & Error Handling", "New Feature / Development", "User Training & Guidance", "Maintenance & Server Check"],
    "Jaringan (Wi-Fi/LAN/Mikrotik)": ["Network Troubleshooting", "Instalasi & Relokasi Baru", "Maintenance & Monitoring", "Konfigurasi & Setting"],
    "Server & Data Center": ["Network Troubleshooting", "Instalasi & Relokasi Baru", "Maintenance & Monitoring", "Konfigurasi & Setting"],
    "CCTV & Security System": ["Network Troubleshooting", "Instalasi & Relokasi Baru", "Maintenance & Monitoring", "Konfigurasi & Setting"],
    "Telepon & PABX": ["Network Troubleshooting", "Instalasi & Relokasi Baru", "Maintenance & Monitoring", "Konfigurasi & Setting"],
    "PC / Laptop": ["Hardware Troubleshooting", "Instalasi & Setup Baru", "Maintenance & Consumable", "Penggantian Sparepart"],
    "Printer / Scanner": ["Hardware Troubleshooting", "Instalasi & Setup Baru", "Maintenance & Consumable", "Penggantian Sparepart"],
    "Perangkat Lain (UPS, Monitor, dll)": ["Hardware Troubleshooting", "Instalasi & Setup Baru", "Maintenance & Consumable", "Penggantian Sparepart"],
    "Email & Cloud (Google Workspace/AD)": ["User Admin", "Data Extraction & Query", "Pengadaan & Pembelian (Procurement)", "Peminjaman & Pengembalian Aset"],
    "Permintaan Data / Report": ["User Admin", "Data Extraction & Query", "Pengadaan & Pembelian (Procurement)", "Peminjaman & Pengembalian Aset"],
    "IT Asset Management": ["User Admin", "Data Extraction & Query", "Pengadaan & Pembelian (Procurement)", "Peminjaman & Pengembalian Aset"],
    "General IT / Lainnya...": ["Rapat & Diskusi Internal", "Koordinasi Vendor", "Lainnya..."]
  };

  const MODULE_GROUPS = [
    {
      label: "Enterprise Systems & Applications",
      options: ["Sistem AI", "Sistem PIC", "Sistem HRIS", "Factory Sistem", "Website / Portal"]
    },
    {
      label: "Infrastructure & Network",
      options: ["Jaringan (Wi-Fi/LAN/Mikrotik)", "Server & Data Center", "CCTV & Security System", "Telepon & PABX"]
    },
    {
      label: "Hardware & End-User Devices",
      options: ["PC / Laptop", "Printer / Scanner", "Perangkat Lain (UPS, Monitor, dll)"]
    },
    {
      label: "Data, Account & IT Management",
      options: ["Email & Cloud (Google Workspace/AD)", "Permintaan Data / Report", "IT Asset Management"]
    },
    {
      label: "General",
      options: ["General IT / Lainnya..."]
    }
  ];

  const AVAILABLE_AREAS = [
    "JATENG 1", "JATENG 2", "JATENG 3", "KALBAR", "KALTIM", "KALSELTENG", "DENPASAR", 
    "JAKARTA 1", "JAKARTA 2", "JAKARTA 3", "JAKARTA 4", "JAKARTA 5", "JAKARTA 6", "JAKARTA 7", 
    "KAM PROJECT", "MEDAN & ACEH RAYA", "TANGERANG", "SURABAYA 1", "SURABAYA 2", "MALANG", 
    "SULAWESI 1", "SULAWESI 2", "SULAWESI 3", "JAWA BARAT 1", "JAWA BARAT 2", "SUMBANGSEL 1", "SUMBANGSEL 2"
  ];

  const statusOptions = [
    { value: "Done", label: "Done" },
    { value: "Ongoing", label: "Ongoing" },
    { value: "Suspended", label: "Suspended" },
  ];

  const priorityOptions = [
    { value: "Low", label: "Low" },
    { value: "Normal", label: "Normal" },
    { value: "High", label: "High" },
    { value: "URGENT", label: "URGENT" }
  ];

  const renderPriority = (priority: string) => {
    switch (priority) {
      case "URGENT": return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold border border-red-200 animate-pulse">URGENT</span>;
      case "High": return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold border border-orange-200">High</span>;
      case "Low": return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold border border-slate-200">Low</span>;
      default: return <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 text-[10px] font-bold border border-blue-200">Normal</span>;
    }
  };

  const cleanHtmlText = (html: string | null) => {
    if (!html) return "-";
    return html
      .replace(/<[^>]*>?/gm, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  };

  const renderStatus = (status: string) => {
    switch (status) {
      case "Done":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200/60"><CheckCircle2 className="w-3 h-3" /> Done</span>;
      case "Ongoing":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold border border-blue-200/60"><Clock className="w-3 h-3" /> Ongoing</span>;
      case "Suspended":
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-semibold border border-amber-200/60"><PauseCircle className="w-3 h-3" /> Suspended</span>;
      default:
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-semibold border border-gray-200/60"><AlertCircle className="w-3 h-3" /> {status}</span>;
    }
  };

  const formatDate = (val: string | Date) => {
    if (!val) return "-";
    const d = new Date(val);
    return d.toLocaleString("en-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
  };

  const handleExportCSV = () => {
    // Generate CSV string from displayedTickets
    const headers = ["Start Time", "End Time", "Requester", "Executor", "Task Name", "Category", "Module", "Issue", "Solution", "Status"];
    const rows = displayedTickets.map(t => [
      new Date(t.startDate).toLocaleString(),
      new Date(t.endDate).toLocaleString(),
      `"${(t.requesterName || t.user?.name || "Unknown").replace(/"/g, '""')}"`,
      `"${(t.ticketType === "REQUEST" ? (t.executors?.map((e:any)=>e.name).join(", ") || "Belum ditentukan") : (t.user?.name || "Unknown")).replace(/"/g, '""')}"`,
      `"${(t.taskName || "").replace(/"/g, '""')}"`,
      `"${(t.supportType || "").replace(/"/g, '""')}"`,
      `"${(t.module || "").replace(/"/g, '""')}"`,
      `"${(t.issue || "").replace(/"/g, '""')}"`,
      `"${(t.solution || "").replace(/"/g, '""')}"`,
      t.status
    ]);
    
    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Support_Logs_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [filters, setFilters] = useState<{
    user: string;
    module: string;
    category: string;
    status: string;
    date: Date | null;
  }>({
    user: 'all',
    module: 'all',
    category: 'all',
    status: 'all',
    date: null
  });

  const displayedTickets = tickets.filter(ticket => {
    // Tab filter
    const isMyLog = ticket.userId === currentUser.id || ticket.executors?.some((e: any) => e.id === currentUser.id);
    if (activeTab === 'my-logs' && !isMyLog) return false;
    if (activeTab === 'team-logs' && isMyLog) return false;

    // Dropdown filters
    if (filters.user !== 'all') {
      const isCreator = ticket.userId === filters.user;
      const isExecutor = ticket.executors?.some((e: any) => e.id === filters.user);
      if (!isCreator && !isExecutor) return false;
    }
    if (filters.module !== 'all' && ticket.module !== filters.module) return false;
    if (filters.category !== 'all' && ticket.supportType !== filters.category) return false;
    if (filters.status !== 'all' && ticket.status !== filters.status) return false;

    // Date filter (matches the exact day)
    if (filters.date) {
      const ticketDate = new Date(ticket.startDate);
      const filterDate = new Date(filters.date);
      if (
        ticketDate.getFullYear() !== filterDate.getFullYear() ||
        ticketDate.getMonth() !== filterDate.getMonth() ||
        ticketDate.getDate() !== filterDate.getDate()
      ) {
        return false;
      }
    }

    return true;
  });

  // Extract unique options for filters from all tickets (excluding current user for team logs)
  const availableTickets = tickets.filter(t => activeTab === 'team-logs' ? t.userId !== currentUser.id : t.userId === currentUser.id);
  
  const allTeamUsersMap = new Map();
  tickets.forEach(t => {
    if (t.userId !== currentUser.id && t.user) {
      allTeamUsersMap.set(t.userId, t.user);
    }
    if (t.executors && t.executors.length > 0) {
      t.executors.forEach((e: any) => {
        if (e.id !== currentUser.id) {
          allTeamUsersMap.set(e.id, e);
        }
      });
    }
  });
  const uniqueUsers = Array.from(allTeamUsersMap.values());
  const uniqueModules = Array.from(new Set(availableTickets.map(t => t.module).filter(Boolean)));
  const uniqueCategories = Array.from(new Set(availableTickets.map(t => t.supportType).filter(Boolean)));

  const inputClass = "w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all";

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('my-logs')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${activeTab === 'my-logs' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            My Logs
          </button>
          {currentUser?.role === 'Admin' && (
            <button
              onClick={() => setActiveTab('team-logs')}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${activeTab === 'team-logs' ? 'bg-blue-100 text-blue-700' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              Team Logs
            </button>
          )}
        </div>
        
        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> Export to CSV
        </button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl border border-gray-200/60 shadow-sm">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider ml-1 mr-2">Filters:</span>
        
        {activeTab === 'team-logs' && (
          <select 
            value={filters.user} 
            onChange={(e) => setFilters({...filters, user: e.target.value})}
            className="bg-gray-50 border border-gray-200 text-gray-700 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-400"
          >
            <option value="all">All Users</option>
            {uniqueUsers.map((u: any) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        )}

        <select 
          value={filters.module} 
          onChange={(e) => setFilters({...filters, module: e.target.value})}
          className="bg-gray-50 border border-gray-200 text-gray-700 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-400 max-w-[150px]"
        >
          <option value="all">All Modules</option>
          {uniqueModules.map((m: any) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <select 
          value={filters.category} 
          onChange={(e) => setFilters({...filters, category: e.target.value})}
          className="bg-gray-50 border border-gray-200 text-gray-700 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-400 max-w-[180px]"
        >
          <option value="all">All Categories</option>
          {uniqueCategories.map((c: any) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select 
          value={filters.status} 
          onChange={(e) => setFilters({...filters, status: e.target.value})}
          className="bg-gray-50 border border-gray-200 text-gray-700 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-400"
        >
          <option value="all">All Status</option>
          <option value="Done">Done</option>
          <option value="Ongoing">Ongoing</option>
          <option value="Suspended">Suspended</option>
          <option value="Not Started">Not Started</option>
        </select>

        <div className="relative">
          <DatePicker 
            selected={filters.date} 
            onChange={(date: Date | null) => setFilters({...filters, date})} 
            dateFormat="dd MMM yyyy" 
            placeholderText="Filter by Date"
            isClearable
            className="bg-gray-50 border border-gray-200 text-gray-700 text-xs rounded-lg px-2.5 py-1.5 outline-none focus:border-blue-400 w-32"
          />
        </div>

        {(filters.user !== 'all' || filters.module !== 'all' || filters.category !== 'all' || filters.status !== 'all' || filters.date !== null) && (
          <button 
            onClick={() => setFilters({user: 'all', module: 'all', category: 'all', status: 'all', date: null})}
            className="ml-auto text-[10px] font-bold text-red-500 hover:text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1.5 rounded-md transition-colors"
          >
            Clear Filters
          </button>
        )}
      </div>

      <div className="overflow-hidden flex flex-col flex-1 bg-white rounded-xl shadow-sm border border-gray-200/60">
        <div className="overflow-x-auto flex-1 flex flex-col">
          <div className="min-w-[1200px] flex-1 flex flex-col">
            {/* Table Header */}
          <div className="grid gap-3 px-4 py-3.5 border-b-2 border-gray-200 bg-gray-50/90 text-[11px] uppercase tracking-wider font-bold text-gray-500 select-none sticky top-0 z-10"
            style={{ gridTemplateColumns: '1.2fr 1.2fr 1.5fr 1.5fr 1.5fr 1.2fr 1fr 2.5fr 2.5fr 0.8fr 0.8fr 0.5fr' }}>
            <div>Start Time</div>
            <div>End Time</div>
            <div>Requester</div>
            <div>Executor</div>
            <div>Task Name</div>
            <div>Category</div>
            <div>Module</div>
            <div>Issue</div>
            <div>Solution</div>
            <div>Status</div>
            <div>Priority</div>
            <div className="text-right"></div>
          </div>
          
          {/* Table Body */}
          <div className="flex-1 bg-white">
            {!addingTicket && (
              <div className="flex items-center gap-2 px-4 py-3 border-b border-dashed border-gray-200 hover:bg-blue-50/40 cursor-pointer text-gray-400 hover:text-blue-600 transition-all group"
                onClick={() => setAddingTicket(true)}>
                <div className="flex items-center gap-2 text-xs font-medium">
                  <div className="p-1 rounded-md bg-blue-50 text-blue-500 group-hover:bg-blue-100 transition-colors"><Plus className="w-3.5 h-3.5" /></div>
                  Add New Support Log
                </div>
              </div>
            )}
            
            {displayedTickets.length > 0 ? (
              displayedTickets.map((ticket, i) => (
                <div key={ticket.id} onClick={() => openEditModal(ticket)} className={`grid gap-3 items-center px-4 py-3 hover:bg-blue-50/30 transition-colors duration-150 border-b border-gray-100/80 cursor-pointer ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/20'}`}
                  style={{ gridTemplateColumns: '1.2fr 1.2fr 1.5fr 1.5fr 1.5fr 1.2fr 1fr 2.5fr 2.5fr 0.8fr 0.8fr 0.5fr' }}>
                  
                  <div className="text-xs text-gray-700 tabular-nums min-w-0">{formatDate(ticket.startDate)}</div>
                  <div className="text-xs text-gray-700 tabular-nums min-w-0">{formatDate(ticket.endDate)}</div>
                  
                  <div className="text-xs min-w-0">
                      <div className="font-semibold text-gray-800 text-[11px] truncate" title={ticket.requesterName || ticket.user?.name || "-"}>{ticket.requesterName || ticket.user?.name || "-"}</div>
                      {!ticket.requesterName && <div className="text-[10px] text-gray-500 truncate" title={ticket.user?.jobDesk || "-"}>{ticket.user?.jobDesk || "-"}</div>}
                    </div>
                    <div className="text-xs min-w-0">
                      <div className="font-semibold text-blue-700 text-[11px] truncate">
                        {ticket.ticketType === "REQUEST" 
                          ? (ticket.executors?.map((e:any) => e.name).join(", ") || "Belum ditentukan") 
                          : (ticket.user?.name || "-")}
                      </div>
                    </div>
                  
                  <div className="font-medium text-gray-800 text-xs min-w-0 flex items-center gap-1.5">
                    {ticket.ticketType === "REQUEST" && (
                      <span className="shrink-0 inline-block px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[9px] font-bold tracking-wider">REQ</span>
                    )}
                    <span className="truncate" title={ticket.taskName || "-"}>{ticket.taskName || "-"}</span>
                  </div>
                  <div className="text-xs text-gray-700 min-w-0 truncate" title={ticket.supportType || "-"}>{ticket.supportType || "-"}</div>
                  <div className="text-xs text-gray-700 min-w-0 truncate" title={ticket.module || "-"}>{ticket.module || "-"}</div>
                  <div className="text-xs text-gray-700 min-w-0 truncate" title={cleanHtmlText(ticket.issue)}>
                    {cleanHtmlText(ticket.issue).substring(0, 100) + (cleanHtmlText(ticket.issue).length > 100 ? "..." : "")}
                  </div>
                  <div className="text-xs text-gray-700 min-w-0 truncate" title={cleanHtmlText(ticket.solution)}>
                    {cleanHtmlText(ticket.solution).substring(0, 100) + (cleanHtmlText(ticket.solution).length > 100 ? "..." : "")}
                  </div>
                  <div className="min-w-0">{renderStatus(ticket.status)}</div>
                  <div className="min-w-0">{renderPriority(ticket.priority)}</div>

                  <div className="flex justify-end gap-1 opacity-0 hover:opacity-100 min-w-0">
                    <button 
                      onClick={(e) => { e.stopPropagation(); setActiveCommentTicket({id: ticket.id, title: ticket.taskName}); }} 
                      className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all relative" 
                      title="Diskusi Ticket"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      {ticket.comments?.[0] && (!ticket.commentReadStatuses?.[0] || new Date(ticket.comments[0].createdAt) > new Date(ticket.commentReadStatuses[0].lastReadAt)) && (
                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-pulse" />
                      )}
                    </button>
                    <button onClick={(e) => handleDeleteTicket(ticket.id, e)} className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-all" title="Delete Log">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-500 py-20">
                <div className="p-5 bg-gray-50 rounded-2xl mb-4"><Table2 className="w-10 h-10 text-gray-300" /></div>
                <p className="font-semibold text-gray-600 text-lg">No support logs yet</p>
                <p className="text-sm text-gray-400 mt-1">Click "+ Add New Support Log" above to start tracking.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Ticket Modal */}
      {addingTicket && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">New Support Log</h3>
                <p className="text-blue-100 text-xs">Record daily IT support activity</p>
              </div>
              <button onClick={() => setAddingTicket(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-4">
                <div className="flex gap-4 p-3 bg-gray-50 border border-gray-200 rounded-xl mb-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                    <input type="radio" name="ticketType" value="DAILY_ACTIVITY" 
                      checked={newTaskData.ticketType === "DAILY_ACTIVITY"} 
                      onChange={() => setNewTaskData({...newTaskData, ticketType: "DAILY_ACTIVITY"})} 
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300" />
                    📝 Kegiatan Harian IT (Daily Log)
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                    <input type="radio" name="ticketType" value="REQUEST" 
                      checked={newTaskData.ticketType === "REQUEST"} 
                      onChange={() => setNewTaskData({...newTaskData, ticketType: "REQUEST"})} 
                      className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300" />
                    🆘 Permintaan Bantuan (Request)
                  </label>
                </div>

                {newTaskData.ticketType === "REQUEST" && (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nama Pelapor (Requester) <span className="text-red-500">*</span></label>
                    <input type="text" placeholder="Contoh: Bpk Ruddin (Finance)" className={inputClass}
                      value={newTaskData.requesterName} onChange={(e) => setNewTaskData({...newTaskData, requesterName: e.target.value})} />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Task Name (Pekerjaan / Kendala) <span className="text-red-500">*</span></label>
                  <input autoFocus={newTaskData.ticketType !== "REQUEST"} type="text" placeholder={newTaskData.ticketType === "REQUEST" ? "Kendala yang dilaporkan..." : "Pekerjaan yang dilakukan..."} className={inputClass}
                    value={newTaskData.taskName} onChange={(e) => setNewTaskData({...newTaskData, taskName: e.target.value})}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddTicket(); if (e.key === 'Escape') setAddingTicket(false); }} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Module</label>
                    <select 
                      className={inputClass}
                      value={newTaskData.module}
                      onChange={(e) => {
                        const newModule = e.target.value;
                        const validCategories = CATEGORY_MAP[newModule] || ["Lainnya..."];
                        setNewTaskData({
                           ...newTaskData, 
                           module: newModule, 
                           supportType: validCategories[0]
                        });
                      }}
                    >
                      {MODULE_GROUPS.map(group => (
                        <optgroup key={group.label} label={group.label}>
                          {group.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </optgroup>
                      ))}
                    </select>
                    {newTaskData.module === "General IT / Lainnya..." && (
                      <input type="text" placeholder="Specify module..." className={`${inputClass} mt-2`}
                        value={newTaskData.customModule} onChange={(e) => setNewTaskData({...newTaskData, customModule: e.target.value})} />
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Category</label>
                    <select
                      className={inputClass}
                      value={newTaskData.supportType}
                      onChange={(e) => setNewTaskData({...newTaskData, supportType: e.target.value})}
                    >
                      {(CATEGORY_MAP[newTaskData.module] || ["Lainnya..."]).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {newTaskData.ticketType === "REQUEST" && (
                  <div>
                    {newTaskData.supportType === "Master Data" ? (
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Pilih Area <span className="text-red-500">*</span></label>
                        <select className={inputClass} value={newTaskData.area || ""} onChange={(e) => setNewTaskData({...newTaskData, area: e.target.value})}>
                          <option value="" disabled>Pilih Area...</option>
                          {AVAILABLE_AREAS.map(area => (
                            <option key={area} value={area}>{area}</option>
                          ))}
                        </select>
                        <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Executor akan di-assign otomatis berdasarkan area ini.</p>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Tugaskan Kepada (Executors) <span className="text-red-500">*</span></label>
                        <div className="flex flex-col gap-2 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-lg bg-gray-50">
                          {systemUsers.map(u => (
                            <label key={u.id} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                              <input type="checkbox" checked={newTaskData.executorIds.includes(u.id)} 
                                onChange={(e) => {
                                  const newIds = e.target.checked 
                                    ? [...newTaskData.executorIds, u.id] 
                                    : newTaskData.executorIds.filter(id => id !== u.id);
                                  setNewTaskData({...newTaskData, executorIds: newIds});
                                }}
                                className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300" />
                              {u.name} <span className="text-[10px] text-gray-400">({u.jobDesk})</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Start Time</label>
                    <DatePicker selected={newTaskData.startDate} onChange={(date: Date | null) => date && setNewTaskData({...newTaskData, startDate: date})} 
                      showTimeSelect timeFormat="HH:mm" timeIntervals={15} dateFormat="dd MMM yyyy, HH:mm" className={inputClass} wrapperClassName="w-full" />
                  </div>
                  {newTaskData.ticketType === "DAILY_ACTIVITY" && (
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">End Time</label>
                      <DatePicker selected={newTaskData.endDate} onChange={(date: Date | null) => date && setNewTaskData({...newTaskData, endDate: date})} 
                        showTimeSelect timeFormat="HH:mm" timeIntervals={15} dateFormat="dd MMM yyyy, HH:mm" minDate={newTaskData.startDate} className={inputClass} wrapperClassName="w-full" />
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Issue (Kendala)</label>
                  <ReactQuill theme="snow" value={newTaskData.issue} onChange={(val) => setNewTaskData({...newTaskData, issue: val})} className="bg-white rounded-lg [&_.ql-editor]:min-h-[100px]" />
                </div>
                
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Solution (Solusi)</label>
                  <ReactQuill theme="snow" value={newTaskData.solution} onChange={(val) => setNewTaskData({...newTaskData, solution: val})} className="bg-white rounded-lg [&_.ql-editor]:min-h-[100px]" />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Link / Tautan Rujukan</label>
                  <input type="url" placeholder="https://..." className={inputClass} value={newTaskData.link} onChange={(e) => setNewTaskData({...newTaskData, link: e.target.value})} />
                </div>
                
                <div className={`grid ${newTaskData.ticketType === "REQUEST" ? "grid-cols-1" : "grid-cols-2"} gap-4`}>
                  {newTaskData.ticketType !== "REQUEST" && (
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Status</label>
                      <ModernSelect options={statusOptions} value={newTaskData.status} onChange={(val) => setNewTaskData({...newTaskData, status: val})} className="w-full" />
                    </div>
                  )}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Priority</label>
                    <ModernSelect options={priorityOptions} value={newTaskData.priority} onChange={(val) => setNewTaskData({...newTaskData, priority: val})} className="w-full" />
                  </div>
                </div>
                
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Attachment (Bukti/Screenshot)</label>
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                      <Paperclip className="w-3.5 h-3.5" /> Choose File
                      <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, false)} accept="image/*,.pdf,.xlsx,.csv" />
                    </label>
                    {newTaskData.attachment && (
                      <a href={newTaskData.attachment} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline truncate max-w-[200px]">
                        {newTaskData.attachment.split("/").pop()}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setAddingTicket(false)} className="px-5 py-2.5 text-sm text-gray-600 font-medium hover:text-gray-900 hover:bg-gray-200 rounded-xl transition-all">
                Cancel
              </button>
              <button onClick={handleAddTicket} disabled={isSubmitting || !newTaskData.taskName.trim()}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 text-sm rounded-xl font-semibold hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/25 transition-all disabled:opacity-50 disabled:hover:shadow-none">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Ticket Modal */}
      {editingTicket && editTaskData && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold">Edit Support Log</h3>
                <p className="text-blue-100 text-xs">Update your daily IT support activity</p>
              </div>
              <button onClick={() => { setEditingTicket(null); setEditTaskData(null); }} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-4">
                <div className="flex gap-4 p-3 bg-gray-50 border border-gray-200 rounded-xl mb-2">
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                    <input type="radio" name="editTicketType" value="DAILY_ACTIVITY" 
                      checked={editTaskData.ticketType === "DAILY_ACTIVITY"} 
                      onChange={() => setEditTaskData({...editTaskData, ticketType: "DAILY_ACTIVITY"})} 
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300" />
                    📝 Kegiatan Harian IT (Daily Log)
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                    <input type="radio" name="editTicketType" value="REQUEST" 
                      checked={editTaskData.ticketType === "REQUEST"} 
                      onChange={() => setEditTaskData({...editTaskData, ticketType: "REQUEST"})} 
                      className="w-4 h-4 text-purple-600 focus:ring-purple-500 border-gray-300" />
                    🆘 Permintaan Bantuan (Request)
                  </label>
                </div>

                {editTaskData.ticketType === "REQUEST" && (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Nama Pelapor (Requester) <span className="text-red-500">*</span></label>
                    <input type="text" placeholder="Contoh: Bpk Ruddin (Finance)" className={inputClass}
                      value={editTaskData.requesterName} onChange={(e) => setEditTaskData({...editTaskData, requesterName: e.target.value})} />
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Task Name (Pekerjaan / Kendala) <span className="text-red-500">*</span></label>
                  <input autoFocus={editTaskData.ticketType !== "REQUEST"} type="text" placeholder={editTaskData.ticketType === "REQUEST" ? "Kendala yang dilaporkan..." : "Pekerjaan yang dilakukan..."} className={inputClass}
                    value={editTaskData.taskName} onChange={(e) => setEditTaskData({...editTaskData, taskName: e.target.value})}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleUpdateTicket(); if (e.key === 'Escape') { setEditingTicket(null); setEditTaskData(null); } }} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Module</label>
                    <select 
                      className={inputClass}
                      value={editTaskData.module}
                      onChange={(e) => {
                        const newModule = e.target.value;
                        const validCategories = CATEGORY_MAP[newModule] || ["Lainnya..."];
                        setEditTaskData({
                           ...editTaskData, 
                           module: newModule, 
                           supportType: validCategories[0]
                        });
                      }}
                    >
                      {MODULE_GROUPS.map(group => (
                        <optgroup key={group.label} label={group.label}>
                          {group.options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </optgroup>
                      ))}
                    </select>
                    {editTaskData.module === "General IT / Lainnya..." && (
                      <input type="text" placeholder="Specify module..." className={`${inputClass} mt-2`}
                        value={editTaskData.customModule} onChange={(e) => setEditTaskData({...editTaskData, customModule: e.target.value})} />
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Category</label>
                    <select
                      className={inputClass}
                      value={editTaskData.supportType}
                      onChange={(e) => setEditTaskData({...editTaskData, supportType: e.target.value})}
                    >
                      {(CATEGORY_MAP[editTaskData.module] || ["Lainnya..."]).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {editTaskData.ticketType === "REQUEST" && (
                  <div>
                    {editTaskData.supportType === "Master Data" ? (
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Pilih Area <span className="text-red-500">*</span></label>
                        <select className={inputClass} value={editTaskData.area || ""} onChange={(e) => setEditTaskData({...editTaskData, area: e.target.value})}>
                          <option value="" disabled>Pilih Area...</option>
                          {AVAILABLE_AREAS.map(area => (
                            <option key={area} value={area}>{area}</option>
                          ))}
                        </select>
                        <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Executor akan di-assign otomatis berdasarkan area ini.</p>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Tugaskan Kepada (Executors) <span className="text-red-500">*</span></label>
                        <div className="flex flex-col gap-2 max-h-32 overflow-y-auto p-2 border border-gray-200 rounded-lg bg-gray-50">
                          {systemUsers.map(u => (
                            <label key={u.id} className="flex items-center gap-2 text-xs text-gray-700 cursor-pointer">
                              <input type="checkbox" checked={editTaskData.executorIds?.includes(u.id)} 
                                onChange={(e) => {
                                  const newIds = e.target.checked 
                                    ? [...(editTaskData.executorIds || []), u.id] 
                                    : (editTaskData.executorIds || []).filter((id:string) => id !== u.id);
                                  setEditTaskData({...editTaskData, executorIds: newIds});
                                }}
                                className="w-3.5 h-3.5 text-blue-600 rounded border-gray-300" />
                              {u.name} <span className="text-[10px] text-gray-400">({u.jobDesk})</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Start Time</label>
                    <DatePicker selected={editTaskData.startDate} onChange={(date: Date | null) => date && setEditTaskData({...editTaskData, startDate: date})} 
                      showTimeSelect timeFormat="HH:mm" timeIntervals={15} dateFormat="dd MMM yyyy, HH:mm" className={inputClass} wrapperClassName="w-full" />
                  </div>
                  {editTaskData.ticketType === "DAILY_ACTIVITY" && (
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">End Time</label>
                      <DatePicker selected={editTaskData.endDate} onChange={(date: Date | null) => date && setEditTaskData({...editTaskData, endDate: date})} 
                        showTimeSelect timeFormat="HH:mm" timeIntervals={15} dateFormat="dd MMM yyyy, HH:mm" minDate={editTaskData.startDate} className={inputClass} wrapperClassName="w-full" />
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Issue (Kendala)</label>
                  <ReactQuill theme="snow" value={editTaskData.issue || ""} onChange={(val) => setEditTaskData({...editTaskData, issue: val})} className="bg-white rounded-lg [&_.ql-editor]:min-h-[100px]" />
                </div>
                
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Solution (Solusi)</label>
                  <ReactQuill theme="snow" value={editTaskData.solution || ""} onChange={(val) => setEditTaskData({...editTaskData, solution: val})} className="bg-white rounded-lg [&_.ql-editor]:min-h-[100px]" />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Link / Tautan Rujukan</label>
                  <input type="url" placeholder="https://..." className={inputClass} value={editTaskData.link || ""} onChange={(e) => setEditTaskData({...editTaskData, link: e.target.value})} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Status</label>
                    <ModernSelect options={statusOptions} value={editTaskData.status} onChange={(val) => setEditTaskData({...editTaskData, status: val})} className="w-full" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Priority</label>
                    <ModernSelect options={priorityOptions} value={editTaskData.priority} onChange={(val) => setEditTaskData({...editTaskData, priority: val})} className="w-full" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">Attachment (Bukti/Screenshot)</label>
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                      <Paperclip className="w-3.5 h-3.5" /> Choose File
                      <input type="file" className="hidden" onChange={(e) => handleFileUpload(e, true)} accept="image/*,.pdf,.xlsx,.csv" />
                    </label>
                    {editTaskData.attachment && (
                      <a href={editTaskData.attachment} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline truncate max-w-[200px]">
                        {editTaskData.attachment.split("/").pop()}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => { setEditingTicket(null); setEditTaskData(null); }} className="px-5 py-2.5 text-sm text-gray-600 font-medium hover:text-gray-900 hover:bg-gray-200 rounded-xl transition-all">
                Cancel
              </button>
              <button onClick={handleUpdateTicket} disabled={isSubmitting || !editTaskData.taskName.trim()}
                className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 text-sm rounded-xl font-semibold hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/25 transition-all disabled:opacity-50 disabled:hover:shadow-none">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {activeCommentTicket && (
        <CommentsDrawer 
          isOpen={!!activeCommentTicket} 
          onClose={() => setActiveCommentTicket(null)} 
          entityId={activeCommentTicket.id} 
          entityType="supportTicket" 
          entityTitle={activeCommentTicket.title} 
          currentUserId={currentUser?.id} 
        />
      )}
    </div>
    </div>
  );
}
