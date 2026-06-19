"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { 
  CheckCircle2, Users, Target, Clock, Activity, Folder, 
  X, Save, Loader2, Type, Pencil, Trash2, CalendarDays
} from "lucide-react";

interface ProjectCardProps {
  project: any;
  users: any[];
  onRefresh: () => void;
}

function ProjectCard({ project, users, onRefresh }: ProjectCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editData, setEditData] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const totalTasks = project.tasks?.length || 0;
  const completedTasks = project.tasks?.filter((t: any) => t.status === "Completed").length || 0;
  const ratio = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

  const statusColors: Record<string, string> = {
    "Not Started": "bg-slate-50 text-slate-700 border-slate-200",
    "Ongoing": "bg-blue-50 text-blue-700 border-blue-100",
    "Completed": "bg-emerald-50 text-emerald-700 border-emerald-100",
  };

  const accentColors: Record<string, string> = {
    "Not Started": "from-slate-400 to-slate-500",
    "Ongoing": "from-blue-500 to-indigo-500",
    "Completed": "from-emerald-500 to-green-500",
  };

  const validUserNames = users?.map(u => u.name) || [];
  const validMembers = (project.members || "").split(", ").filter(Boolean).filter((name: string) => validUserNames.includes(name)).join(", ");

  const openModal = () => {
    setEditData({
      name: project.name,
      objective: project.objective || "",
      members: validMembers,
      status: project.status,
      startDate: new Date(project.startDate),
      endDate: new Date(project.endDate),
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editData.name,
          objective: editData.objective,
          members: editData.members,
          status: editData.status,
          startDate: editData.startDate.toISOString(),
          endDate: editData.endDate.toISOString(),
        }),
      });
      setIsModalOpen(false);
      router.refresh();
    } catch (e) { console.error(e); } 
    finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete project "${project.name}"? All tasks inside will also be deleted.`)) return;
    setIsDeleting(true);
    try {
      await fetch(`/api/projects/${project.id}`, { method: "DELETE" });
      setIsModalOpen(false);
      router.refresh();
    } catch (e) { console.error(e); } 
    finally { setIsDeleting(false); }
  };

  const toggleMember = (userName: string) => {
    const currentMembers = editData.members ? editData.members.split(", ").filter(Boolean) : [];
    if (currentMembers.includes(userName)) {
      setEditData({ ...editData, members: currentMembers.filter((n: string) => n !== userName).join(", ") });
    } else {
      setEditData({ ...editData, members: [...currentMembers, userName].join(", ") });
    }
  };

  const inputClass = "w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all";
  const statusOptions = ["Not Started", "Ongoing", "Completed"];

  return (
    <>
      {/* Card */}
      <div 
        onClick={openModal}
        className="bg-white border border-gray-200/60 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col group relative overflow-hidden cursor-pointer"
      >
        {/* Top Accent */}
        <div className={`h-1 bg-gradient-to-r ${accentColors[project.status] || "from-blue-500 to-indigo-500"} w-full`} />

        <div className="p-6 flex-1 flex flex-col">
          {/* Edit hint */}
          <div className="absolute top-5 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="p-2 text-blue-500 bg-blue-50 rounded-lg">
              <Pencil className="w-3.5 h-3.5" />
            </div>
          </div>

          <div className="mb-4 pr-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 bg-blue-50 rounded-lg">
                <Folder className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${statusColors[project.status] || "bg-blue-50 text-blue-700 border-blue-100"}`}>
                {project.status}
              </span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 leading-tight">{project.name}</h3>
          </div>

          <div className="space-y-2.5 mb-6 flex-1">
            {project.objective && (
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <Target className="w-4 h-4 mt-0.5 text-orange-500 shrink-0" />
                <p className="line-clamp-2 leading-relaxed">{project.objective}</p>
              </div>
            )}
            
            {validMembers && (
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <Users className="w-4 h-4 mt-0.5 text-indigo-500 shrink-0" />
                <p className="line-clamp-1">{validMembers}</p>
              </div>
            )}

            <div className="flex items-start gap-2 text-sm text-gray-500">
              <Clock className="w-4 h-4 mt-0.5 text-emerald-500 shrink-0" />
              <p className="tabular-nums">{new Date(project.startDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })} — {new Date(project.endDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</p>
            </div>
          </div>

          {/* Progress Section */}
          <div className="pt-4 border-t border-gray-100">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Progress</span>
              <span className="text-sm font-bold text-blue-600">{ratio}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div 
                className={`bg-gradient-to-r ${accentColors[project.status] || "from-blue-500 to-indigo-500"} h-2 rounded-full transition-all duration-1000 ease-out`}
                style={{ width: `${ratio}%` }}
              ></div>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                <span className="font-medium">{completedTasks} / {totalTasks} Tasks</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════ Edit Modal ══════════ */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setIsModalOpen(false)}>
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col" 
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Pencil className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Edit Project</h2>
                  <p className="text-blue-100 text-xs mt-0.5">Update project details</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="absolute top-4 right-4 p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white/80 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              {/* Project Name */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  <Type className="w-3.5 h-3.5" /> Project Name <span className="text-red-400">*</span>
                </label>
                <input 
                  type="text" className={inputClass}
                  value={editData.name}
                  onChange={e => setEditData({...editData, name: e.target.value})}
                />
              </div>

              {/* Objective */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  <Target className="w-3.5 h-3.5" /> Project Goal
                </label>
                <textarea 
                  className={`${inputClass} resize-none`}
                  value={editData.objective}
                  onChange={e => setEditData({...editData, objective: e.target.value})}
                  rows={3}
                />
              </div>

              {/* Status */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  <Activity className="w-3.5 h-3.5" /> Status
                </label>
                <select className={inputClass} value={editData.status} onChange={e => setEditData({...editData, status: e.target.value})}>
                  {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    <CalendarDays className="w-3.5 h-3.5" /> Start Date
                  </label>
                  <DatePicker selected={editData.startDate} onChange={(d: Date | null) => d && setEditData({...editData, startDate: d})} 
                    dateFormat="dd MMM yyyy" className={inputClass} wrapperClassName="w-full" />
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    <CalendarDays className="w-3.5 h-3.5" /> End Date
                  </label>
                  <DatePicker selected={editData.endDate} onChange={(d: Date | null) => d && setEditData({...editData, endDate: d})}
                    dateFormat="dd MMM yyyy" minDate={editData.startDate} className={inputClass} wrapperClassName="w-full" />
                </div>
              </div>

              {/* Members */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  <Users className="w-3.5 h-3.5" /> Anggota Tim
                </label>
                <div className="grid grid-cols-2 gap-2 mt-1 max-h-40 overflow-y-auto bg-gray-50 p-3 rounded-xl border border-gray-200">
                  {users.map((user: any) => {
                    const currentMembers = editData.members ? editData.members.split(", ").filter(Boolean) : [];
                    const isChecked = currentMembers.includes(user.name);
                    return (
                      <label key={user.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer p-1.5 rounded hover:bg-gray-100 transition-colors">
                        <input type="checkbox" checked={isChecked} onChange={() => toggleMember(user.name)} className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4" />
                        <span className="truncate">{user.name}</span>
                      </label>
                    );
                  })}
                  {users.length === 0 && <span className="text-xs text-gray-500 col-span-2">Belum ada user terdaftar.</span>}
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between shrink-0">
              <button 
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg font-medium transition-all"
              >
                {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete
              </button>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl font-medium transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSave}
                  disabled={!editData.name?.trim() || isSaving}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center gap-2"
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function ProjectListView({ projects, users = [] }: { projects: any[]; users?: any[] }) {
  const router = useRouter();

  if (!projects || projects.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500">
        <div className="p-5 bg-gray-50 rounded-2xl mb-4">
          <Activity className="w-10 h-10 text-gray-300" />
        </div>
        <h2 className="text-xl font-semibold mb-2 text-gray-600">No project yet</h2>
        <p className="text-sm text-gray-400">Please create a new project using the "+ New Project" button.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-2">
      {projects.map((project: any) => (
        <ProjectCard key={project.id} project={project} users={users} onRefresh={() => router.refresh()} />
      ))}
    </div>
  );
}
