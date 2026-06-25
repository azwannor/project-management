"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Package, ClipboardList, CalendarClock, FileText, Plus, Search, Loader2,
  Trash2, Save, X, Copy, ChevronDown, ChevronUp, GripVertical, CheckCircle2,
  AlertTriangle, XCircle, Clock, AlertCircle, Eye, Upload, RotateCcw, UploadCloud, FileSpreadsheet
} from "lucide-react";
import ModernSelect from "../common/ModernSelect";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const AVAILABLE_LOCATIONS = ["HO Jakarta", "HO Makassar", "Pabrik", "Marketing"];

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700 border-green-200",
  IN_REPAIR: "bg-amber-100 text-amber-700 border-amber-200",
  INACTIVE: "bg-gray-100 text-gray-600 border-gray-200",
  RETIRED: "bg-red-100 text-red-700 border-red-200",
};

const SCHEDULE_STATUS_COLORS: Record<string, string> = {
  UPCOMING: "bg-blue-100 text-blue-700 border-blue-200",
  DUE: "bg-amber-100 text-amber-700 border-amber-200",
  OVERDUE: "bg-red-100 text-red-700 border-red-200",
  DONE: "bg-green-100 text-green-700 border-green-200",
};

const CONDITION_COLORS: Record<string, string> = {
  BAIK: "bg-green-100 text-green-700 border-green-200",
  PERLU_PERHATIAN: "bg-amber-100 text-amber-700 border-amber-200",
  BERMASALAH: "bg-red-100 text-red-700 border-red-200",
};

const CONDITION_LABELS: Record<string, string> = {
  BAIK: "Good",
  PERLU_PERHATIAN: "Needs Attention",
  BERMASALAH: "Issue/Problem",
};

type Tab = "assets" | "templates" | "schedules" | "logs";

export default function MaintenanceClient({
  currentUser, divisions, assetTypes, assets: initialAssets, templates: initialTemplates,
  schedules: initialSchedules, logs: initialLogs, systemUsers
}: {
  currentUser: any; divisions: any[]; assetTypes: any[]; assets: any[]; templates: any[];
  schedules: any[]; logs: any[]; systemUsers: any[];
}) {
  const [activeTab, setActiveTab] = useState<Tab>("assets");
  const router = useRouter();
  const isAdmin = currentUser?.role === "Admin";

  const tabs = [
    { id: "assets" as Tab, label: "Asset Registry", icon: Package, count: initialAssets.length },
    { id: "templates" as Tab, label: "Templates", icon: ClipboardList, count: initialTemplates.length, adminOnly: true },
    { id: "schedules" as Tab, label: "Schedules", icon: CalendarClock, count: initialSchedules.filter((s: any) => s.status !== "DONE").length },
    { id: "logs" as Tab, label: "Logs", icon: FileText, count: initialLogs.length },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200/60 pb-4">
        {tabs.map(tab => {
          if (tab.adminOnly && !isAdmin) return null;
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                  : "bg-white/60 text-gray-600 hover:bg-white/80 hover:text-gray-800 border border-gray-200/60"
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              <span className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
              }`}>{tab.count}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "assets" && (
        <AssetTab assets={initialAssets} divisions={divisions} assetTypes={assetTypes} systemUsers={systemUsers} isAdmin={isAdmin} router={router} />
      )}
      {activeTab === "templates" && isAdmin && (
        <TemplateTab templates={initialTemplates} assetTypes={assetTypes} router={router} />
      )}
      {activeTab === "schedules" && (
        <ScheduleTab schedules={initialSchedules} assets={initialAssets} templates={initialTemplates} assetTypes={assetTypes} isAdmin={isAdmin} currentUser={currentUser} router={router} />
      )}
      {activeTab === "logs" && (
        <LogTab logs={initialLogs} schedules={initialSchedules} currentUser={currentUser} isAdmin={isAdmin} router={router} />
      )}
    </div>
  );
}

/* ============================================================
   TAB 1: ASSET REGISTRY
   ============================================================ */
function AssetTab({ assets, divisions, assetTypes, systemUsers, isAdmin, router }: any) {
  const [showDivisionModal, setShowDivisionModal] = useState(false);
  const [newDivisionName, setNewDivisionName] = useState("");
  const [isSubmittingDivision, setIsSubmittingDivision] = useState(false);

  const handleAddDivision = async () => {
    if (!newDivisionName.trim()) return;
    setIsSubmittingDivision(true);
    try {
      const res = await fetch("/api/divisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newDivisionName.trim() }),
      });
      if (res.ok) {
        setNewDivisionName("");
        setShowDivisionModal(false);
        router.refresh();
      } else {
        alert("Failed to add division");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmittingDivision(false);
    }
  };
  const [search, setSearch] = useState("");
  const [filterDivision, setFilterDivision] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterType, setFilterType] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState<any>(null);
  const [detailAsset, setDetailAsset] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    assetCode: "", assetName: "", assetTypeId: "", brand: "", model: "",
    serialNumber: "", area: "", location: "", status: "ACTIVE",
    purchaseDate: null as Date | null, warrantyEndDate: null as Date | null,
    picUserId: "", notes: ""
  });

  const filtered = useMemo(() => {
    return assets.filter((a: any) => {
      if (search && !a.assetCode.toLowerCase().includes(search.toLowerCase()) &&
          !a.assetName.toLowerCase().includes(search.toLowerCase()) &&
          !(a.brand || "").toLowerCase().includes(search.toLowerCase())) return false;
      if (filterDivision && a.divisionId !== filterDivision) return false;
      if (filterStatus && a.status !== filterStatus) return false;
      if (filterType && a.assetTypeId !== filterType) return false;
      return true;
    });
  }, [assets, search, filterDivision, filterStatus, filterType]);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const resetForm = () => {
    setFormData({
      assetCode: "", assetName: "", assetTypeId: "", brand: "", model: "",
      serialNumber: "", divisionId: "", person: "", location: "", detailedLocation: "", status: "ACTIVE", purchaseDate: null,
      warrantyEndDate: null, picUserId: "", notes: ""
    });
  };

  const openEdit = (asset: any) => {
    setEditingAsset(asset);
    setFormData({
      assetCode: asset.assetCode, assetName: asset.assetName, assetTypeId: asset.assetTypeId,
      brand: asset.brand || "", model: asset.model || "", serialNumber: asset.serialNumber || "",
      divisionId: asset.divisionId || "", person: asset.person || "", location: asset.location || "", detailedLocation: asset.detailedLocation || "", status: asset.status,
      purchaseDate: asset.purchaseDate ? new Date(asset.purchaseDate) : null,
      warrantyEndDate: asset.warrantyEndDate ? new Date(asset.warrantyEndDate) : null,
      picUserId: asset.picUserId || "", notes: asset.notes || ""
    });
    setShowForm(true);
  };

  const handleImportSubmit = async () => {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const form = new FormData();
      form.append("file", importFile);
      const res = await fetch("/api/assets/import", {
        method: "POST",
        body: form
      });
      const data = await res.json();
      setImportResult(data);
      if (data.success) {
        router.refresh();
      }
    } catch (e: any) {
      setImportResult({ success: false, error: e.message || "Upload failed" });
    } finally {
      setImporting(false);
    }
  };

  const downloadImportTemplate = () => {
    const csvContent = "Asset Code,Asset Name,Asset Type,Area,Location,Serial Number,Purchase Date\n"
      + "SRV-001,Server Database Utama,Server,Ruang Server,Rack A1,SN123456,2024-01-01\n"
      + "NET-005,Router MikroTik Core,Network,Ruang Server,Rack A2,SN98765,2024-01-15\n";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "Template_Import_Asset.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async () => {
    if (!formData.assetCode.trim() || !formData.assetName.trim() || !formData.assetTypeId || !formData.divisionId) return;
    setIsSubmitting(true);
    try {
      const url = editingAsset ? `/api/assets/${editingAsset.id}` : "/api/assets";
      const method = editingAsset ? "PATCH" : "POST";
      const res = await fetch(url, {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) { const err = await res.json(); alert(err.error); return; }
      setShowForm(false); setEditingAsset(null); resetForm(); router.refresh();
    } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
  };

  const handleRetire = async (id: string) => {
    if (!confirm("Are you sure you want to retire this asset?")) return;
    try {
      await fetch(`/api/assets/${id}`, { method: "DELETE" });
      router.refresh();
    } catch (e) { console.error(e); }
  };

  const fetchDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/assets/${id}`);
      const data = await res.json();
      setDetailAsset(data);
    } catch (e) { console.error(e); }
  };

  return (
    <div>
      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text" placeholder="Search code, name, brand..."
            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        <ModernSelect value={filterDivision} onChange={setFilterDivision} placeholder="All Divisions"
          options={[{ value: "", label: "All Divisions" }, ...divisions.map((d: any) => ({ value: d.id, label: d.name }))]}
          className="w-44" />
        <ModernSelect value={filterStatus} onChange={setFilterStatus} placeholder="All Status"
          options={[{ value: "", label: "All Status" }, ...(["ACTIVE", "IN_REPAIR", "INACTIVE", "RETIRED"].map(s => ({ value: s, label: s })))]}
          className="w-40" />
        <ModernSelect value={filterType} onChange={setFilterType} placeholder="All Types"
          options={[{ value: "", label: "All Types" }, ...assetTypes.map((t: any) => ({ value: t.id, label: t.name }))]}
          className="w-48" />
        {isAdmin && (
          <div className="flex gap-2">
            <button onClick={() => { setShowImportModal(true); setImportFile(null); setImportResult(null); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-500/20">
              <FileSpreadsheet className="w-4 h-4" /> Import Excel
            </button>
            <button onClick={() => { resetForm(); setEditingAsset(null); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20">
              <Plus className="w-4 h-4" /> Add Asset
            </button>
          </div>
        )}
      </div>

      {/* Asset Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/80 text-gray-600 text-left">
              <th className="px-4 py-3 font-semibold">Code</th>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Type</th>
              <th className="px-4 py-3 font-semibold">Division</th>
              <th className="px-4 py-3 font-semibold">User/Person</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">PIC</th>
              {isAdmin && <th className="px-4 py-3 font-semibold text-right">Action</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Tidak ada assets ditemukan</td></tr>
            ) : filtered.map((asset: any) => (
              <tr key={asset.id} className="hover:bg-blue-50/30 transition-colors cursor-pointer" onClick={() => fetchDetail(asset.id)}>
                <td className="px-4 py-3 font-mono text-xs font-bold text-blue-700">{asset.assetCode}</td>
                <td className="px-4 py-3 font-medium">{asset.assetName}</td>
                <td className="px-4 py-3 text-gray-500">{asset.assetType?.name}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{asset.division?.name || "-"}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{asset.person || "-"}</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_COLORS[asset.status] || ""}`}>
                    {asset.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">{asset.pic?.name || "-"}</td>
                {isAdmin && (
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEdit(asset)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors mr-1">
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                    {asset.status !== "RETIRED" && (
                      <button onClick={() => handleRetire(asset.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-2">{filtered.length} of {assets.length} assets</p>

      {/* Create/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setShowForm(false); setEditingAsset(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{editingAsset ? "Edit Asset" : "Add New Asset"}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Asset Code *</label>
                <input className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={formData.assetCode} onChange={e => setFormData({ ...formData, assetCode: e.target.value })} placeholder="SRV-SBY1-001" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Asset Name *</label>
                <input className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={formData.assetName} onChange={e => setFormData({ ...formData, assetName: e.target.value })} placeholder="Server Database Surabaya 1" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Asset Type *</label>
                <ModernSelect value={formData.assetTypeId} onChange={v => setFormData({ ...formData, assetTypeId: v })}
                  options={assetTypes.map((t: any) => ({ value: t.id, label: t.name }))} placeholder="Select type..." />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Area *</label>
                <ModernSelect value={formData.area} onChange={v => setFormData({ ...formData, area: v })}
                  options={AVAILABLE_AREAS.map(a => ({ value: a, label: a }))} placeholder="Select area..." />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Brand</label>
                <input className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={formData.brand} onChange={e => setFormData({ ...formData, brand: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Model</label>
                <input className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={formData.model} onChange={e => setFormData({ ...formData, model: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Serial Number</label>
                <input className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={formData.serialNumber} onChange={e => setFormData({ ...formData, serialNumber: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Location</label>
                <input className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} placeholder="Ruang Server Lt.2" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Status</label>
                <ModernSelect value={formData.status} onChange={v => setFormData({ ...formData, status: v })}
                  options={["ACTIVE", "IN_REPAIR", "INACTIVE", "RETIRED"].map(s => ({ value: s, label: s }))} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">PIC</label>
                <ModernSelect value={formData.picUserId} onChange={v => setFormData({ ...formData, picUserId: v })}
                  options={[{ value: "", label: "None" }, ...systemUsers.map((u: any) => ({ value: u.id, label: u.name }))]} placeholder="Select PIC..." />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Purchase Date</label>
                <DatePicker selected={formData.purchaseDate} onChange={(d: Date | null) => setFormData({ ...formData, purchaseDate: d })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none" dateFormat="dd/MM/yyyy" placeholderText="Select date..." />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Warranty Until</label>
                <DatePicker selected={formData.warrantyEndDate} onChange={(d: Date | null) => setFormData({ ...formData, warrantyEndDate: d })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none" dateFormat="dd/MM/yyyy" placeholderText="Select date..." />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                <textarea className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                  rows={2} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <button onClick={() => { setShowForm(false); setEditingAsset(null); }}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-md">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingAsset ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      {detailAsset && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex justify-end" onClick={() => setDetailAsset(null)}>
          <div className="bg-white w-full max-w-lg h-full overflow-y-auto shadow-2xl p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold">Detail Aset</h3>
              <button onClick={() => setDetailAsset(null)} className="p-1.5 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-400 text-xs">Code</span><p className="font-mono font-bold text-blue-700">{detailAsset.assetCode}</p></div>
                <div><span className="text-gray-400 text-xs">Status</span><p><span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_COLORS[detailAsset.status]}`}>{detailAsset.status}</span></p></div>
                <div><span className="text-gray-400 text-xs">Name</span><p className="font-medium">{detailAsset.assetName}</p></div>
                <div><span className="text-gray-400 text-xs">Type</span><p>{detailAsset.assetType?.name}</p></div>
                <div><span className="text-gray-400 text-xs">Division</span><p>{detailAsset.division?.name || "-"}</p></div>
                <div><span className="text-gray-400 text-xs">Person</span><p>{detailAsset.person || "-"}</p></div>
                <div><span className="text-gray-400 text-xs">Location</span><p>{detailAsset.location || "-"}</p></div>
                <div><span className="text-gray-400 text-xs">Detailed Location</span><p>{detailAsset.detailedLocation || "-"}</p></div>
                <div><span className="text-gray-400 text-xs">Brand / Model</span><p>{detailAsset.brand || "-"} {detailAsset.model || ""}</p></div>
                <div><span className="text-gray-400 text-xs">Serial Number</span><p className="font-mono text-xs">{detailAsset.serialNumber || "-"}</p></div>
                <div><span className="text-gray-400 text-xs">PIC</span><p>{detailAsset.pic?.name || "-"}</p></div>
                <div><span className="text-gray-400 text-xs">Pembelian</span><p>{detailAsset.purchaseDate ? new Date(detailAsset.purchaseDate).toLocaleDateString("id-ID") : "-"}</p></div>
              </div>
              {detailAsset.notes && <div className="text-sm"><span className="text-gray-400 text-xs">Notes</span><p className="mt-1 text-gray-600">{detailAsset.notes}</p></div>}

              {/* Riwayat Maintenance */}
              <div className="mt-6 pt-4 border-t border-gray-100">
                <h4 className="font-bold text-sm mb-3 flex items-center gap-2"><CalendarClock className="w-4 h-4 text-blue-600" />Riwayat Maintenance</h4>
                {detailAsset.schedules?.length === 0 ? (
                  <p className="text-xs text-gray-400">Belum ada jadwal maintenance.</p>
                ) : (
                  <div className="space-y-3">
                    {detailAsset.schedules?.map((s: any) => (
                      <div key={s.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-xs">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold">{s.template?.templateName || "Ad-hoc"}</span>
                          <span className={`px-2 py-0.5 rounded-full font-bold border ${SCHEDULE_STATUS_COLORS[s.status]}`}>{s.status}</span>
                        </div>
                        <p className="text-gray-500">Due: {new Date(s.nextDueDate).toLocaleDateString("id-ID")}</p>
                        {s.logs?.map((log: any) => (
                          <div key={log.id} className="mt-2 p-2 bg-white rounded-lg border border-gray-100">
                            <div className="flex items-center justify-between">
                              <span className="text-gray-600">Oleh: {log.executedBy?.name}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${CONDITION_COLORS[log.overallCondition]}`}>
                                {CONDITION_LABELS[log.overallCondition]}
                              </span>
                            </div>
                            <p className="text-gray-400 mt-0.5">{new Date(log.executionDate).toLocaleDateString("id-ID")}</p>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   TAB 2: TEMPLATES (Admin only)
   ============================================================ */
function TemplateTab({ templates, assetTypes, router }: any) {
  const [filterType, setFilterType] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingItems, setEditingItems] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    templateName: "", assetTypeId: "", defaultFrequencyDays: 30, reminderOffsetDays: 3,
    checklistItems: [{ itemText: "", order: 1, isRequired: true }] as any[]
  });

  const filtered = useMemo(() => {
    if (!filterType) return templates;
    return templates.filter((t: any) => t.assetTypeId === filterType);
  }, [templates, filterType]);

  const toggleExpand = (template: any) => {
    if (expandedId === template.id) {
      setExpandedId(null);
    } else {
      setExpandedId(template.id);
      setEditingItems(template.checklistItems.map((item: any) => ({ ...item })));
    }
  };

  const saveChecklist = async (templateId: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/maintenance-templates/${templateId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklistItems: editingItems }),
      });
      if (!res.ok) { const err = await res.json(); alert(err.error); return; }
      setExpandedId(null); router.refresh();
    } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
  };

  const handleDuplicate = async (templateId: string) => {
    try {
      const res = await fetch(`/api/maintenance-templates/${templateId}/duplicate`, { method: "POST" });
      if (!res.ok) { const err = await res.json(); alert(err.error); return; }
      router.refresh();
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm("Are you sure you want to delete this template?")) return;
    try {
      const res = await fetch(`/api/maintenance-templates/${templateId}`, { method: "DELETE" });
      if (!res.ok) { const err = await res.json(); alert(err.error); return; }
      router.refresh();
    } catch (e) { console.error(e); }
  };

  const handleCreate = async () => {
    if (!newTemplate.templateName.trim() || !newTemplate.assetTypeId) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/maintenance-templates", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newTemplate,
          checklistItems: newTemplate.checklistItems.filter(i => i.itemText.trim()),
        }),
      });
      if (!res.ok) { const err = await res.json(); alert(err.error); return; }
      setShowCreateForm(false);
      setNewTemplate({ templateName: "", assetTypeId: "", defaultFrequencyDays: 30, reminderOffsetDays: 3, checklistItems: [{ itemText: "", order: 1, isRequired: true }] });
      router.refresh();
    } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <ModernSelect value={filterType} onChange={setFilterType} placeholder="All Asset Types"
          options={[{ value: "", label: "All Asset Types" }, ...assetTypes.map((t: any) => ({ value: t.id, label: t.name }))]}
          className="w-52" />
        <button onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20 ml-auto">
          <Plus className="w-4 h-4" /> Buat Template
        </button>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-8">Tidak ada template</p>
        ) : filtered.map((template: any) => (
          <div key={template.id} className="bg-white/60 rounded-xl border border-gray-200/60 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-gray-50/50 transition-colors" onClick={() => toggleExpand(template)}>
              <div className="flex items-center gap-3">
                <ClipboardList className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="font-semibold text-sm">{template.templateName}</p>
                  <p className="text-xs text-gray-400">{template.assetType?.name} · {template.defaultFrequencyDays} hari · {template.checklistItems.length} item</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={e => { e.stopPropagation(); handleDuplicate(template.id); }}
                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Duplicate">
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button onClick={e => { e.stopPropagation(); handleDelete(template.id); }}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                {expandedId === template.id ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
            </div>

            {expandedId === template.id && (
              <div className="px-4 pb-4 border-t border-gray-100">
                <div className="mt-3 space-y-2">
                  {editingItems.map((item, idx) => (
                    <div key={item.id || `new-${idx}`} className="flex items-center gap-2 group">
                      <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
                      <span className="text-xs text-gray-400 w-6 shrink-0">{idx + 1}.</span>
                      <input className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        value={item.itemText} onChange={e => {
                          const updated = [...editingItems]; updated[idx].itemText = e.target.value; setEditingItems(updated);
                        }} />
                      <label className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
                        <input type="checkbox" checked={item.isRequired} onChange={e => {
                          const updated = [...editingItems]; updated[idx].isRequired = e.target.checked; setEditingItems(updated);
                        }} className="rounded" /> Wajib
                      </label>
                      <button onClick={() => setEditingItems(editingItems.filter((_, i) => i !== idx))}
                        className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => setEditingItems([...editingItems, { itemText: "", order: editingItems.length + 1, isRequired: true }])}
                    className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium mt-1">
                    <Plus className="w-3 h-3" /> Add Item
                  </button>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button onClick={() => setExpandedId(null)} className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button>
                  <button onClick={() => saveChecklist(template.id)} disabled={isSubmitting}
                    className="flex items-center gap-1 px-4 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                    {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Simpan
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create Template Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCreateForm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Buat Template Baru</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Template Name *</label>
                <input className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={newTemplate.templateName} onChange={e => setNewTemplate({ ...newTemplate, templateName: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Asset Type *</label>
                  <ModernSelect value={newTemplate.assetTypeId} onChange={v => setNewTemplate({ ...newTemplate, assetTypeId: v })}
                    options={assetTypes.map((t: any) => ({ value: t.id, label: t.name }))} placeholder="Select type..." />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Frequency (days)</label>
                  <input type="number" min={1} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none"
                    value={newTemplate.defaultFrequencyDays} onChange={e => setNewTemplate({ ...newTemplate, defaultFrequencyDays: parseInt(e.target.value) || 1 })} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Checklist Items</label>
                <div className="space-y-2">
                  {newTemplate.checklistItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-xs text-gray-400 w-5">{idx + 1}.</span>
                      <input className="flex-1 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none"
                        value={item.itemText} placeholder="Checklist item..."
                        onChange={e => {
                          const items = [...newTemplate.checklistItems]; items[idx].itemText = e.target.value;
                          setNewTemplate({ ...newTemplate, checklistItems: items });
                        }} />
                      <button onClick={() => setNewTemplate({ ...newTemplate, checklistItems: newTemplate.checklistItems.filter((_, i) => i !== idx) })}
                        className="p-1 text-gray-300 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                  <button onClick={() => setNewTemplate({
                    ...newTemplate,
                    checklistItems: [...newTemplate.checklistItems, { itemText: "", order: newTemplate.checklistItems.length + 1, isRequired: true }]
                  })} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
                    <Plus className="w-3 h-3" /> Add Item
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
              <button onClick={handleCreate} disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 shadow-md">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   TAB 3: SCHEDULES
   ============================================================ */
function ScheduleTab({ schedules, assets, templates, assetTypes, isAdmin, currentUser, router }: any) {
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDivision, setFilterDivision] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    scheduleType: "RECURRING", assetId: "", templateId: "", frequencyDays: 0, nextDueDate: null as Date | null
  });

  const filtered = useMemo(() => {
    return schedules.filter((s: any) => {
      if (filterStatus && s.status !== filterStatus) return false;
      if (filterLocation && s.asset?.location !== filterLocation) return false;
      return true;
    });
  }, [schedules, filterStatus, filterLocation]);

  const selectedAsset = assets.find((a: any) => a.id === formData.assetId);
  const matchingTemplates = templates.filter((t: any) => selectedAsset && t.assetTypeId === selectedAsset.assetTypeId);

  const handleCreate = async () => {
    if (!formData.assetId || !formData.nextDueDate) return;
    if (formData.scheduleType === "RECURRING" && !formData.templateId) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/maintenance-schedules", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          frequencyDays: formData.frequencyDays || undefined,
          templateId: formData.templateId || undefined,
        }),
      });
      if (!res.ok) { const err = await res.json(); alert(err.error); return; }
      setShowCreate(false); router.refresh();
    } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
  };

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { UPCOMING: 0, DUE: 0, OVERDUE: 0, DONE: 0 };
    schedules.forEach((s: any) => { counts[s.status] = (counts[s.status] || 0) + 1; });
    return counts;
  }, [schedules]);

  return (
    <div>
      {/* Status Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {(["UPCOMING", "DUE", "OVERDUE", "DONE"] as const).map(status => {
          const icons: Record<string, any> = { UPCOMING: Clock, DUE: AlertCircle, OVERDUE: AlertTriangle, DONE: CheckCircle2 };
          const Icon = icons[status];
          return (
            <button key={status} onClick={() => setFilterStatus(filterStatus === status ? "" : status)}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                filterStatus === status ? "ring-2 ring-blue-400 border-blue-300 bg-blue-50/50" : "bg-white/60 border-gray-200/60 hover:bg-white/80"
              }`}>
              <div className={`p-2 rounded-lg ${SCHEDULE_STATUS_COLORS[status]}`}><Icon className="w-4 h-4" /></div>
              <div className="text-left">
                <p className="text-lg font-bold">{statusCounts[status]}</p>
                <p className="text-[10px] font-semibold text-gray-500 uppercase">{status}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <ModernSelect value={filterDivision} onChange={setFilterDivision} placeholder="All Divisions"
          options={[{ value: "", label: "All Divisions" }, ...divisions.map((d: any) => ({ value: d.id, label: d.name }))]}
          className="w-44" />
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20 ml-auto">
          <Plus className="w-4 h-4" /> Buat Jadwal
        </button>
      </div>

      {/* Schedule List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-8">Tidak ada jadwal</p>
        ) : filtered.map((s: any) => (
          <div key={s.id} className="flex items-center justify-between px-4 py-3 bg-white/60 rounded-xl border border-gray-200/60 hover:bg-white/80 transition-colors">
            <div className="flex items-center gap-3 min-w-0">
              <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border ${SCHEDULE_STATUS_COLORS[s.status]}`}>{s.status}</span>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate">{s.asset?.assetName}</p>
                <p className="text-xs text-gray-400 truncate">
                  {s.asset?.assetCode} · {s.template?.templateName || "Ad-hoc"} · {s.asset?.division?.name || s.asset?.location || "-"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                <p className="text-sm font-semibold">{new Date(s.nextDueDate).toLocaleDateString("id-ID")}</p>
                <p className="text-[10px] text-gray-400">
                  {s.assignedExecutors?.map((e: any) => e.name).join(", ") || "No executors assigned"}
                </p>
              </div>
              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${s.scheduleType === "RECURRING" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
                {s.scheduleType}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Create Schedule Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">Buat Jadwal Maintenance</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tipe Jadwal</label>
                <div className="flex gap-2">
                  {["RECURRING", "ADHOC"].map(type => (
                    <button key={type} onClick={() => setFormData({ ...formData, scheduleType: type })}
                      className={`flex-1 py-2 text-sm font-semibold rounded-xl border transition-all ${
                        formData.scheduleType === type ? "bg-blue-600 text-white border-blue-600" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                      }`}>{type === "RECURRING" ? "Recurring" : "Ad-hoc"}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Aset *</label>
                <ModernSelect value={formData.assetId} onChange={v => setFormData({ ...formData, assetId: v, templateId: "" })}
                  options={assets.filter((a: any) => a.status === "ACTIVE").map((a: any) => ({ value: a.id, label: `${a.assetCode} - ${a.assetName}` }))}
                  placeholder="Select asset..." />
              </div>
              {formData.scheduleType === "RECURRING" && (
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Template *</label>
                  <ModernSelect value={formData.templateId} onChange={v => setFormData({ ...formData, templateId: v })}
                    options={matchingTemplates.map((t: any) => ({ value: t.id, label: t.templateName }))}
                    placeholder={selectedAsset ? "Select template..." : "Pilih assets dulu"} />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Tanggal Jatuh Tempo *</label>
                <DatePicker selected={formData.nextDueDate} onChange={(d: Date | null) => setFormData({ ...formData, nextDueDate: d })}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none" dateFormat="dd/MM/yyyy" />
              </div>
              {selectedAsset && (
                <p className="text-xs text-gray-400 bg-gray-50 p-2 rounded-lg">
                  ℹ️ Executor akan otomatis di-assign berdasarkan location: <strong>{selectedAsset.location || "-"}</strong>
                </p>
              )}
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
              <button onClick={handleCreate} disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 shadow-md">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Buat Jadwal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   TAB 4: LOGS
   ============================================================ */
function LogTab({ logs, schedules, currentUser, isAdmin, router }: any) {
  const [showLogForm, setShowLogForm] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<any>(null);
  const [filterCondition, setFilterCondition] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logForm, setLogForm] = useState({
    checklistResults: [] as { itemText: string; checked: boolean; note: string }[],
    overallCondition: "BAIK",
    findings: "",
    followUpNeeded: false,
    attachment: "",
  });

  const actionableSchedules = schedules.filter((s: any) =>
    s.status !== "DONE" && (isAdmin || s.assignedExecutors?.some((e: any) => e.id === currentUser.id))
  );

  const filteredLogs = useMemo(() => {
    if (!filterCondition) return logs;
    return logs.filter((l: any) => l.overallCondition === filterCondition);
  }, [logs, filterCondition]);

  const openLogForm = (schedule: any) => {
    setSelectedSchedule(schedule);
    const checklistItems = schedule.template?.checklistItems || [];
    setLogForm({
      checklistResults: checklistItems.map((item: any) => ({ itemText: item.itemText, checked: false, note: "" })),
      overallCondition: "BAIK",
      findings: "",
      followUpNeeded: false,
      attachment: "",
    });
    setShowLogForm(true);
  };

  const handleSubmitLog = async () => {
    if (!selectedSchedule) return;
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/maintenance-logs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId: selectedSchedule.id,
          ...logForm,
        }),
      });
      if (!res.ok) { const err = await res.json(); alert(err.error); return; }
      const result = await res.json();
      setShowLogForm(false); setSelectedSchedule(null);
      if (result.followUp) {
        alert(`✅ Log tersimpan!\n\n⚠️ Follow-up diperlukan.\nSilakan buat Support Ticket dengan judul:\n"${result.followUp.suggestedTicket.taskName}"`);
      }
      router.refresh();
    } catch (e) { console.error(e); } finally { setIsSubmitting(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) setLogForm({ ...logForm, attachment: data.url });
      else alert(data.error);
    } catch { alert("Upload gagal"); }
  };

  return (
    <div>
      {/* Actionable Schedules */}
      {actionableSchedules.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" /> Jadwal yang perlu dikerjakan ({actionableSchedules.length})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {actionableSchedules.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between p-3 bg-amber-50/50 rounded-xl border border-amber-200/60">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{s.asset?.assetName}</p>
                  <p className="text-xs text-gray-500">{s.template?.templateName || "Ad-hoc"} · Due: {new Date(s.nextDueDate).toLocaleDateString("id-ID")}</p>
                </div>
                <button onClick={() => openLogForm(s)}
                  className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Mulai
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-3 mb-4">
        <ModernSelect value={filterCondition} onChange={setFilterCondition} placeholder="Semua Kondisi"
          options={[{ value: "", label: "Semua Kondisi" }, ...Object.entries(CONDITION_LABELS).map(([v, l]) => ({ value: v, label: l }))]}
          className="w-48" />
      </div>

      {/* Log List */}
      <div className="space-y-2">
        {filteredLogs.length === 0 ? (
          <p className="text-center text-gray-400 py-8">Belum ada log maintenance</p>
        ) : filteredLogs.map((log: any) => (
          <div key={log.id} className="px-4 py-3 bg-white/60 rounded-xl border border-gray-200/60">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{log.schedule?.asset?.assetName} <span className="font-mono text-xs text-gray-400">({log.schedule?.asset?.assetCode})</span></p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Oleh: {log.executedBy?.name} · {new Date(log.executionDate).toLocaleDateString("id-ID")} · {log.checklistResults?.length || 0} checklist
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${CONDITION_COLORS[log.overallCondition]}`}>
                  {CONDITION_LABELS[log.overallCondition]}
                </span>
                {log.followUpNeeded && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200">Follow-up</span>
                )}
              </div>
            </div>
            {log.findings && <p className="text-xs text-gray-500 mt-2 bg-gray-50 p-2 rounded-lg">{log.findings}</p>}
          </div>
        ))}
      </div>

      {/* Log Submit Modal */}
      {showLogForm && selectedSchedule && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => { setShowLogForm(false); setSelectedSchedule(null); }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-1">Submit Maintenance Log</h3>
            <p className="text-sm text-gray-500 mb-4">{selectedSchedule.asset?.assetName} — {selectedSchedule.template?.templateName || "Ad-hoc"}</p>

            {/* Checklist */}
            {logForm.checklistResults.length > 0 && (
              <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-600 mb-2">Checklist ({logForm.checklistResults.filter(c => c.checked).length}/{logForm.checklistResults.length} selesai)</label>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {logForm.checklistResults.map((item, idx) => (
                    <div key={idx} className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${item.checked ? "bg-green-50/50 border-green-200/60" : "bg-gray-50 border-gray-200/60"}`}>
                      <input type="checkbox" checked={item.checked} onChange={e => {
                        const items = [...logForm.checklistResults]; items[idx].checked = e.target.checked;
                        setLogForm({ ...logForm, checklistResults: items });
                      }} className="mt-0.5 rounded" />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm ${item.checked ? "line-through text-gray-400" : "text-gray-700"}`}>{item.itemText}</p>
                        <input placeholder="Catatan (opsional)..." className="mt-1 w-full px-2 py-1 bg-white border border-gray-200 rounded-lg text-xs focus:outline-none"
                          value={item.note} onChange={e => {
                            const items = [...logForm.checklistResults]; items[idx].note = e.target.value;
                            setLogForm({ ...logForm, checklistResults: items });
                          }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Overall Condition */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-600 mb-2">Kondisi Keseluruhan *</label>
              <div className="flex gap-2">
                {(["BAIK", "PERLU_PERHATIAN", "BERMASALAH"] as const).map(cond => (
                  <button key={cond} onClick={() => setLogForm({ ...logForm, overallCondition: cond })}
                    className={`flex-1 py-2.5 text-sm font-semibold rounded-xl border transition-all ${
                      logForm.overallCondition === cond
                        ? `${CONDITION_COLORS[cond]} ring-2 ring-current/20`
                        : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                    }`}>{CONDITION_LABELS[cond]}</button>
                ))}
              </div>
            </div>

            {/* Findings */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Findings / Notes</label>
              <textarea rows={3} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none resize-none"
                value={logForm.findings} onChange={e => setLogForm({ ...logForm, findings: e.target.value })} placeholder="Deskripsikan temuan selama maintenance..." />
            </div>

            {/* Attachment */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Foto / Lampiran</label>
              {logForm.attachment ? (
                <div className="flex items-center gap-2 p-2 bg-green-50 rounded-xl border border-green-200">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="text-xs text-green-700 truncate flex-1">{logForm.attachment}</span>
                  <button onClick={() => setLogForm({ ...logForm, attachment: "" })} className="text-gray-400 hover:text-red-500"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors">
                  <Upload className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-500">Klik untuk upload</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
                </label>
              )}
            </div>

            {/* Follow-up */}
            <label className="flex items-center gap-2 mb-4 p-3 bg-amber-50/50 rounded-xl border border-amber-200/60 cursor-pointer">
              <input type="checkbox" checked={logForm.followUpNeeded} onChange={e => setLogForm({ ...logForm, followUpNeeded: e.target.checked })} className="rounded" />
              <div>
                <p className="text-sm font-semibold text-amber-800">Perlu Follow-up</p>
                <p className="text-xs text-amber-600">Akan menyiapkan data untuk buat Support Ticket</p>
              </div>
            </label>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
              <button onClick={() => { setShowLogForm(false); setSelectedSchedule(null); }} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
              <button onClick={handleSubmitLog} disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 shadow-md">
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Submit Log
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
