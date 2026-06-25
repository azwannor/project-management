const fs = require('fs');

const file = 'c:/Users/azwan/OneDrive/Documents/Project/Project Management/it-tracker-app/src/components/views/MaintenanceClient.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replacements
const replacements = [
  {
    search: `export default function MaintenanceClient({ currentUser, assetTypes, assets: initialAssets, templates: initialTemplates, schedules: initialSchedules, logs: initialLogs, systemUsers }: { currentUser: any; assetTypes: any[]; assets: any[]; templates: any[]; schedules: any[]; logs: any[]; systemUsers: any[] }) {`,
    replace: `export default function MaintenanceClient({ currentUser, divisions, assetTypes, assets: initialAssets, templates: initialTemplates, schedules: initialSchedules, logs: initialLogs, systemUsers }: { currentUser: any; divisions: any[]; assetTypes: any[]; assets: any[]; templates: any[]; schedules: any[]; logs: any[]; systemUsers: any[] }) {`
  },
  {
    search: `<AssetTab assets={initialAssets} assetTypes={assetTypes} systemUsers={systemUsers} isAdmin={isAdmin} router={router} />`,
    replace: `<AssetTab assets={initialAssets} divisions={divisions} assetTypes={assetTypes} systemUsers={systemUsers} isAdmin={isAdmin} router={router} />`
  },
  {
    search: `function AssetTab({ assets, assetTypes, systemUsers, isAdmin, router }: any) {`,
    replace: `function AssetTab({ assets, divisions, assetTypes, systemUsers, isAdmin, router }: any) {
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
  };`
  },
  {
    search: `const AVAILABLE_AREAS = [
  "HO Jakarta",
  "HO Makassar",
  "Pabrik",
  "Marketing",
  "Auditor",
  "IT",
  "Designer",
  "BD",
  "PE",
  "Admin",
  "HR",
  "Finance",
];`,
    replace: `const AVAILABLE_LOCATIONS = ["HO Jakarta", "HO Makassar", "Pabrik", "Marketing"];`
  },
  {
    search: `const [filterArea, setFilterArea] = useState("");`,
    replace: `const [filterDivision, setFilterDivision] = useState("");`
  },
  {
    search: `if (filterArea && a.area !== filterArea) return false;`,
    replace: `if (filterDivision && a.divisionId !== filterDivision) return false;`
  },
  {
    search: `serialNumber: "", area: "", location: "", status: "ACTIVE", purchaseDate: null,`,
    replace: `serialNumber: "", divisionId: "", person: "", location: "", detailedLocation: "", status: "ACTIVE", purchaseDate: null,`
  },
  {
    search: `serialNumber: "", area: "", location: "", status: "ACTIVE", purchaseDate: null,`,
    replace: `serialNumber: "", divisionId: "", person: "", location: "", detailedLocation: "", status: "ACTIVE", purchaseDate: null,`
  },
  {
    search: `area: asset.area, location: asset.location || "", status: asset.status,`,
    replace: `divisionId: asset.divisionId || "", person: asset.person || "", location: asset.location || "", detailedLocation: asset.detailedLocation || "", status: asset.status,`
  },
  {
    search: `if (!formData.assetCode.trim() || !formData.assetName.trim() || !formData.assetTypeId || !formData.area) return;`,
    replace: `if (!formData.assetCode.trim() || !formData.assetName.trim() || !formData.assetTypeId || !formData.divisionId) return;`
  },
  {
    search: `<ModernSelect value={filterArea} onChange={setFilterArea} placeholder="All Areas"
          options={[{ value: "", label: "All Areas" }, ...AVAILABLE_AREAS.map(a => ({ value: a, label: a }))]}
          className="w-40" />`,
    replace: `<ModernSelect value={filterDivision} onChange={setFilterDivision} placeholder="All Divisions"
          options={[{ value: "", label: "All Divisions" }, ...divisions.map((d: any) => ({ value: d.id, label: d.name }))]}
          className="w-40" />`
  },
  {
    search: `<th className="px-4 py-3 font-semibold">Area</th>`,
    replace: `<th className="px-4 py-3 font-semibold">Division</th>
              <th className="px-4 py-3 font-semibold">Person</th>`
  },
  {
    search: `<td className="px-4 py-3 text-gray-500 text-xs">{asset.area}</td>`,
    replace: `<td className="px-4 py-3 text-gray-500 text-xs">{asset.division?.name || "-"}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{asset.person || "-"}</td>`
  },
  {
    search: `<div className="flex-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Area *</label>
                <ModernSelect value={formData.area} onChange={v => setFormData({ ...formData, area: v })}
                  options={AVAILABLE_AREAS.map(a => ({ value: a, label: a }))} placeholder="Select area..." />
              </div>`,
    replace: `<div className="flex-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Division *</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <ModernSelect value={formData.divisionId} onChange={v => setFormData({ ...formData, divisionId: v })}
                      options={divisions.map((d: any) => ({ value: d.id, label: d.name }))} placeholder="Select division..." />
                  </div>
                  <button onClick={() => setShowDivisionModal(true)} className="px-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl border border-gray-200" title="Add Division">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>`
  },
  {
    search: `<div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Location</label>
                <input className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} placeholder="Ex: Ruang Server Lt.2" />
              </div>`,
    replace: `<div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Person Using Asset</label>
                <input className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={formData.person} onChange={e => setFormData({ ...formData, person: e.target.value })} placeholder="Ex: John Doe" />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Location</label>
                  <ModernSelect value={formData.location} onChange={v => setFormData({ ...formData, location: v })}
                    options={AVAILABLE_LOCATIONS.map(l => ({ value: l, label: l }))} placeholder="Select location..." />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Detailed Location</label>
                  <input className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    value={formData.detailedLocation} onChange={e => setFormData({ ...formData, detailedLocation: e.target.value })} placeholder="Ex: Ruang Server Lt.2" />
                </div>
              </div>`
  },
  {
    search: `<div><span className="text-gray-400 text-xs">Area</span><p>{detailAsset.area}</p></div>`,
    replace: `<div><span className="text-gray-400 text-xs">Division</span><p>{detailAsset.division?.name || "-"}</p></div>
                <div><span className="text-gray-400 text-xs">Person</span><p>{detailAsset.person || "-"}</p></div>`
  },
  {
    search: `<div><span className="text-gray-400 text-xs">Location</span><p>{detailAsset.location || "-"}</p></div>`,
    replace: `<div><span className="text-gray-400 text-xs">Location</span><p>{detailAsset.location || "-"}</p></div>
                <div><span className="text-gray-400 text-xs">Detailed Location</span><p>{detailAsset.detailedLocation || "-"}</p></div>`
  },
  {
    search: `const [filterArea, setFilterArea] = useState("");`,
    replace: `const [filterLocation, setFilterLocation] = useState("");`
  },
  {
    search: `if (filterArea && s.asset?.area !== filterArea) return false;`,
    replace: `if (filterLocation && s.asset?.location !== filterLocation) return false;`
  },
  {
    search: `[schedules, filterStatus, filterArea]`,
    replace: `[schedules, filterStatus, filterLocation]`
  },
  {
    search: `<ModernSelect value={filterArea} onChange={setFilterArea} placeholder="All Areas"
          options={[{ value: "", label: "All Areas" }, ...AVAILABLE_AREAS.map(a => ({ value: a, label: a }))]}
          className="w-40" />`,
    replace: `<ModernSelect value={filterLocation} onChange={setFilterLocation} placeholder="All Locations"
          options={[{ value: "", label: "All Locations" }, ...AVAILABLE_LOCATIONS.map(l => ({ value: l, label: l }))]}
          className="w-40" />`
  },
  {
    search: `{s.asset?.assetCode} · {s.template?.templateName || "Ad-hoc"} · {s.asset?.area}`,
    replace: `{s.asset?.assetCode} · {s.template?.templateName || "Ad-hoc"} · {s.asset?.division?.name || s.asset?.location || "-"}`
  },
  {
    search: `ℹ️ Executor akan otomatis di-assign berdasarkan area: <strong>{selectedAsset.area}</strong>`,
    replace: `ℹ️ Executor akan otomatis di-assign berdasarkan location: <strong>{selectedAsset.location || "-"}</strong>`
  },
  {
    search: `{/* Type Modal */}`,
    replace: `{/* Division Modal */}
      {showDivisionModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Add New Division</h3>
            <div className="mb-6">
              <label className="block text-xs font-semibold text-gray-600 mb-2">Division Name *</label>
              <input type="text" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                value={newDivisionName} onChange={e => setNewDivisionName(e.target.value)} placeholder="e.g. Marketing" />
            </div>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowDivisionModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl font-medium transition-colors">Cancel</button>
              <button onClick={handleAddDivision} disabled={isSubmittingDivision || !newDivisionName.trim()}
                className="flex items-center justify-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md">
                {isSubmittingDivision ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Type Modal */}`
  }
];

let success = true;
for (const req of replacements) {
  if (content.includes(req.search)) {
    content = content.replace(req.search, req.replace);
  } else {
    console.error("NOT FOUND:", req.search.substring(0, 50));
    success = false;
  }
}

if (success) {
  fs.writeFileSync(file, content);
  console.log("Successfully updated MaintenanceClient.tsx");
} else {
  console.log("Some replacements failed. No changes written.");
}
