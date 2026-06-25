import re
import sys

def main():
    file_path = "src/components/views/MaintenanceClient.tsx"
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading file: {e}")
        return

    # 1. Update signature
    content = re.sub(
        r'export default function MaintenanceClient\(\{\s*currentUser, assetTypes, assets: initialAssets, templates: initialTemplates,\s*schedules: initialSchedules, logs: initialLogs, systemUsers\s*\}\: \{\s*currentUser: any; assetTypes: any\[\]; assets: any\[\]; templates: any\[\];\s*schedules: any\[\]; logs: any\[\]; systemUsers: any\[\];\s*\}\) \{',
        r'export default function MaintenanceClient({\n  currentUser, divisions, assetTypes, assets: initialAssets, templates: initialTemplates,\n  schedules: initialSchedules, logs: initialLogs, systemUsers\n}: {\n  currentUser: any; divisions: any[]; assetTypes: any[]; assets: any[]; templates: any[];\n  schedules: any[]; logs: any[]; systemUsers: any[];\n}) {',
        content
    )

    # 2. Pass divisions to AssetTab
    content = content.replace(
        '<AssetTab assets={initialAssets} assetTypes={assetTypes} systemUsers={systemUsers} isAdmin={isAdmin} router={router} />',
        '<AssetTab assets={initialAssets} divisions={divisions} assetTypes={assetTypes} systemUsers={systemUsers} isAdmin={isAdmin} router={router} />'
    )

    # 3. AssetTab signature & Division Modal State
    content = content.replace(
        'function AssetTab({ assets, assetTypes, systemUsers, isAdmin, router }: any) {',
        """function AssetTab({ assets, divisions, assetTypes, systemUsers, isAdmin, router }: any) {
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
  };"""
    )

    # 4. AVAILABLE_AREAS to AVAILABLE_LOCATIONS
    content = re.sub(
        r'const AVAILABLE_AREAS = \[.*?\];',
        'const AVAILABLE_LOCATIONS = ["HO Jakarta", "HO Makassar", "Pabrik", "Marketing"];',
        content,
        flags=re.DOTALL
    )

    # 5. AssetTab Filters
    content = content.replace(
        'const [filterArea, setFilterArea] = useState("");',
        'const [filterDivision, setFilterDivision] = useState("");'
    )
    content = content.replace(
        'if (filterArea && a.area !== filterArea) return false;',
        'if (filterDivision && a.divisionId !== filterDivision) return false;'
    )
    content = content.replace(
        'search, filterArea, filterStatus, filterType',
        'search, filterDivision, filterStatus, filterType'
    )
    content = content.replace(
        '<ModernSelect value={filterArea} onChange={setFilterArea} placeholder="All Areas"\n          options={[{ value: "", label: "All Areas" }, ...AVAILABLE_AREAS.map(a => ({ value: a, label: a }))]}',
        '<ModernSelect value={filterDivision} onChange={setFilterDivision} placeholder="All Divisions"\n          options={[{ value: "", label: "All Divisions" }, ...divisions.map((d: any) => ({ value: d.id, label: d.name }))]}'
    )

    # 6. FormData Initial
    content = content.replace(
        'serialNumber: "", area: "", location: "", status: "ACTIVE", purchaseDate: null,',
        'serialNumber: "", divisionId: "", person: "", location: "", detailedLocation: "", status: "ACTIVE", purchaseDate: null,'
    )
    
    # Edit mode formData
    content = content.replace(
        'area: asset.area, location: asset.location || "", status: asset.status,',
        'divisionId: asset.divisionId || "", person: asset.person || "", location: asset.location || "", detailedLocation: asset.detailedLocation || "", status: asset.status,'
    )

    # formData validation
    content = content.replace(
        'if (!formData.assetCode.trim() || !formData.assetName.trim() || !formData.assetTypeId || !formData.area) return;',
        'if (!formData.assetCode.trim() || !formData.assetName.trim() || !formData.assetTypeId || !formData.divisionId) return;'
    )

    # 7. Asset Table
    content = content.replace(
        '<th className="px-4 py-3 font-semibold">Area</th>',
        '<th className="px-4 py-3 font-semibold">Division</th>\n              <th className="px-4 py-3 font-semibold">User/Person</th>'
    )
    content = content.replace(
        '<td className="px-4 py-3 text-gray-500 text-xs">{asset.area}</td>',
        '<td className="px-4 py-3 text-gray-500 text-xs">{asset.division?.name || "-"}</td>\n                <td className="px-4 py-3 text-gray-500 text-xs">{asset.person || "-"}</td>'
    )

    # 8. Asset Form Fields
    area_field = """<div className="flex-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Area *</label>
                <ModernSelect value={formData.area} onChange={v => setFormData({ ...formData, area: v })}
                  options={AVAILABLE_AREAS.map(a => ({ value: a, label: a }))} placeholder="Select area..." />
              </div>"""
    
    division_field = """<div className="flex-1">
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
              </div>"""
    content = content.replace(area_field, division_field)

    location_field = """<div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Location</label>
                <input className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                  value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} placeholder="Ex: Ruang Server Lt.2" />
              </div>"""
    person_location_field = """<div>
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
              </div>"""
    content = content.replace(location_field, person_location_field)

    # 9. Detail Asset View
    content = content.replace(
        '<div><span className="text-gray-400 text-xs">Area</span><p>{detailAsset.area}</p></div>',
        '<div><span className="text-gray-400 text-xs">Division</span><p>{detailAsset.division?.name || "-"}</p></div>\n                <div><span className="text-gray-400 text-xs">Person</span><p>{detailAsset.person || "-"}</p></div>'
    )
    content = content.replace(
        '<div><span className="text-gray-400 text-xs">Location</span><p>{detailAsset.location || "-"}</p></div>',
        '<div><span className="text-gray-400 text-xs">Location</span><p>{detailAsset.location || "-"}</p></div>\n                <div><span className="text-gray-400 text-xs">Detailed Location</span><p>{detailAsset.detailedLocation || "-"}</p></div>'
    )

    # 10. Schedule Tab Area -> Location
    content = content.replace(
        'const [filterArea, setFilterArea] = useState("");',
        'const [filterLocation, setFilterLocation] = useState("");'
    )
    content = content.replace(
        'if (filterArea && s.asset?.area !== filterArea) return false;',
        'if (filterLocation && s.asset?.location !== filterLocation) return false;'
    )
    content = content.replace(
        '[schedules, filterStatus, filterArea]',
        '[schedules, filterStatus, filterLocation]'
    )
    content = content.replace(
        '<ModernSelect value={filterArea} onChange={setFilterArea} placeholder="All Areas"\n          options={[{ value: "", label: "All Areas" }, ...AVAILABLE_AREAS.map(a => ({ value: a, label: a }))]}',
        '<ModernSelect value={filterLocation} onChange={setFilterLocation} placeholder="All Locations"\n          options={[{ value: "", label: "All Locations" }, ...AVAILABLE_LOCATIONS.map(l => ({ value: l, label: l }))]}'
    )
    content = content.replace(
        '{s.asset?.assetCode} · {s.template?.templateName || "Ad-hoc"} · {s.asset?.area}',
        '{s.asset?.assetCode} · {s.template?.templateName || "Ad-hoc"} · {s.asset?.division?.name || s.asset?.location || "-"}'
    )
    content = content.replace(
        'ℹ️ Executor akan otomatis di-assign berdasarkan area: <strong>{selectedAsset.area}</strong>',
        'ℹ️ Executor akan otomatis di-assign berdasarkan location: <strong>{selectedAsset.location || "-"}</strong>'
    )

    # 11. Division Modal
    division_modal = """{/* Division Modal */}
      {showDivisionModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setShowDivisionModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 border border-gray-100" onClick={e => e.stopPropagation()}>
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

      {/* Type Modal */}"""
    content = content.replace('{/* Type Modal */}', division_modal)

    try:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        print("Success")
    except Exception as e:
        print(f"Error writing file: {e}")

if __name__ == "__main__":
    main()
