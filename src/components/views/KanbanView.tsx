"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { 
  Clock, 
  AlertCircle, 
  CheckCircle2, 
  ExternalLink, 
  CalendarDays, 
  Folder,
  GripVertical,
  MoreHorizontal,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Plus,
  Save,
  Loader2,
  Link2,
  Pencil,
  FileText,
  PauseCircle,
  X,
  UserCircle
} from "lucide-react";

interface KanbanTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  startDate: string;
  endDate: string;
  documentation?: string;
  project?: { id: string; name: string } | null;
  projectId?: string | null;
  parentId?: string | null;
  executor?: string | null;
}

const COLUMNS = [
  { 
    id: "Not Started", label: "Not Started", icon: AlertCircle, color: "gray",
    gradient: "from-slate-500 to-slate-600", bgLight: "bg-slate-50",
    borderColor: "border-slate-200", badgeBg: "bg-slate-100 text-slate-700", dotColor: "bg-slate-400"
  },
  { 
    id: "Ongoing", label: "Ongoing", icon: Clock, color: "blue",
    gradient: "from-blue-500 to-indigo-500", bgLight: "bg-blue-50/50",
    borderColor: "border-blue-200", badgeBg: "bg-blue-100 text-blue-700", dotColor: "bg-blue-500"
  },
  { 
    id: "Suspended", label: "Suspended", icon: PauseCircle, color: "amber",
    gradient: "from-amber-500 to-orange-500", bgLight: "bg-amber-50/50",
    borderColor: "border-amber-200", badgeBg: "bg-amber-100 text-amber-700", dotColor: "bg-amber-500"
  },
  { 
    id: "Completed", label: "Completed", icon: CheckCircle2, color: "green",
    gradient: "from-emerald-500 to-green-500", bgLight: "bg-emerald-50/50",
    borderColor: "border-emerald-200", badgeBg: "bg-emerald-100 text-emerald-700", dotColor: "bg-emerald-500"
  },
];

const PRIORITY_OPTIONS = [
  { value: "Normal", label: "Normal" },
  { value: "Urgent", label: "Urgent" },
];

const STATUS_OPTIONS = [
  { value: "Not Started", label: "Not Started" },
  { value: "Ongoing", label: "Ongoing" },
  { value: "Suspended", label: "Suspended" },
  { value: "Completed", label: "Completed" },
];

const inputClass = "w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all";

export default function KanbanView({ tasks, projects = [], users = [] }: { tasks: any[]; projects?: any[]; users?: any[] }) {
  const router = useRouter();
  const [draggedTask, setDraggedTask] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const dragCounter = useRef<Record<string, number>>({});

  // ─── Detail / Edit Modal State ───
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null);
  const [editData, setEditData] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);

  // ─── Add Task State ───
  const [addingToColumn, setAddingToColumn] = useState<string | null>(null);
  const [newTask, setNewTask] = useState({ title: "", priority: "Normal", projectId: "", documentation: "", executor: "", startDate: new Date(), endDate: new Date(Date.now() + 7 * 86400000) });
  const [isCreating, setIsCreating] = useState(false);

  const getExecutorOptions = (projectId?: string | null) => {
    let rawOpts: { value: string, label: string }[] = [];
    if (!projectId) {
      rawOpts = users?.map((u: any) => ({ value: u.name, label: u.name })) || [];
    } else {
      const project = projects.find(p => p.id === projectId);
      if (project && project.members) {
        rawOpts = project.members.split(", ").map((m: string) => ({ value: m, label: m }));
      }
    }
    const uniqueOpts = [];
    const seen = new Set();
    for (const o of rawOpts) {
      if (!seen.has(o.value)) {
        seen.add(o.value);
        uniqueOpts.push(o);
      }
    }
    return uniqueOpts;
  };

  const safeTasks: KanbanTask[] = tasks || [];

  const getTasksByStatus = (status: string) => safeTasks.filter(t => t.status === status);

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", { day: "numeric", month: "short" });
  };

  const formatDateLong = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" });
  };

  const isOverdue = (endDate: string) => endDate ? new Date(endDate) < new Date() : false;

  // ─── CRUD Handlers ───
  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    setUpdatingTaskId(taskId);
    try {
      await fetch(`/api/tasks/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
      router.refresh();
    } catch (e) { console.error(e); } finally { setUpdatingTaskId(null); }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Delete this task?")) return;
    try { await fetch(`/api/tasks/${taskId}`, { method: "DELETE" }); setSelectedTask(null); router.refresh(); } catch (e) { console.error(e); }
  };

  const openDetail = (task: KanbanTask) => {
    setSelectedTask(task);
    setEditData({
      title: task.title,
      priority: task.priority || "Normal",
      status: task.status,
      documentation: task.documentation || "",
      executor: task.executor || "",
      startDate: new Date(task.startDate),
      endDate: new Date(task.endDate),
    });
    setOpenMenuId(null);
  };

  const handleSaveEdit = async () => {
    if (!selectedTask) return;
    setIsSaving(true);
    try {
      await fetch(`/api/tasks/${selectedTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editData.title,
          priority: editData.priority,
          status: editData.status,
          documentation: editData.documentation,
          executor: editData.executor || null,
          startDate: editData.startDate.toISOString(),
          endDate: editData.endDate.toISOString(),
        }),
      });
      setSelectedTask(null);
      router.refresh();
    } catch (e) { console.error(e); } finally { setIsSaving(false); }
  };

  const handleCreateTask = async (status: string) => {
    if (!newTask.title.trim()) return;
    setIsCreating(true);
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTask.title,
          priority: newTask.priority,
          status,
          projectId: newTask.projectId || null,
          documentation: newTask.documentation || null,
          executor: newTask.executor || null,
          startDate: newTask.startDate.toISOString(),
          endDate: newTask.endDate.toISOString(),
        }),
      });
      setNewTask({ title: "", priority: "Normal", projectId: "", documentation: "", executor: "", startDate: new Date(), endDate: new Date(Date.now() + 7 * 86400000) });
      setAddingToColumn(null);
      router.refresh();
    } catch (e) { console.error(e); } finally { setIsCreating(false); }
  };

  // ─── Drag & Drop ───
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    setDraggedTask(taskId); e.dataTransfer.effectAllowed = "move";
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = "0.5";
  };
  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedTask(null); setDragOverColumn(null); dragCounter.current = {};
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.style.opacity = "1";
  };
  const handleDragEnter = (e: React.DragEvent, columnId: string) => {
    e.preventDefault(); dragCounter.current[columnId] = (dragCounter.current[columnId] || 0) + 1; setDragOverColumn(columnId);
  };
  const handleDragLeave = (e: React.DragEvent, columnId: string) => {
    e.preventDefault(); dragCounter.current[columnId] = (dragCounter.current[columnId] || 0) - 1;
    if (dragCounter.current[columnId] <= 0) { dragCounter.current[columnId] = 0; if (dragOverColumn === columnId) setDragOverColumn(null); }
  };
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };
  const handleDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault(); setDragOverColumn(null); dragCounter.current = {};
    if (draggedTask) { const task = safeTasks.find(t => t.id === draggedTask); if (task && task.status !== columnId) updateTaskStatus(draggedTask, columnId); }
    setDraggedTask(null);
  };

  const getNextStatus = (s: string) => { const o = ["Not Started","Ongoing","Suspended","Completed"]; const i = o.indexOf(s); return i < o.length - 1 ? o[i+1] : null; };
  const getPrevStatus = (s: string) => { const o = ["Not Started","Ongoing","Suspended","Completed"]; const i = o.indexOf(s); return i > 0 ? o[i-1] : null; };

  return (
    <div className="h-full flex flex-col">
      {/* ═══ Kanban Columns ═══ */}
      <div className="flex-1 flex gap-5 overflow-x-auto pb-4">
        {COLUMNS.map((column) => {
          const columnTasks = getTasksByStatus(column.id);
          const Icon = column.icon;
          const isDropTarget = dragOverColumn === column.id && draggedTask;
          const draggedTaskObj = draggedTask ? safeTasks.find(t => t.id === draggedTask) : null;
          const isDragFromDifferentCol = draggedTaskObj && draggedTaskObj.status !== column.id;

          return (
            <div key={column.id} className="flex-1 min-w-[300px] flex flex-col"
              onDragEnter={(e) => handleDragEnter(e, column.id)} onDragLeave={(e) => handleDragLeave(e, column.id)}
              onDragOver={handleDragOver} onDrop={(e) => handleDrop(e, column.id)}>
              
              {/* Column Header */}
              <div className={`flex items-center justify-between px-4 py-3 rounded-t-xl bg-gradient-to-r ${column.gradient}`}>
                <div className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 text-white/90" />
                  <span className="font-bold text-white text-sm">{column.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-white/80 bg-white/20 px-2.5 py-0.5 rounded-full backdrop-blur-sm">
                    {columnTasks.length}
                  </span>
                  <button 
                    onClick={() => setAddingToColumn(addingToColumn === column.id ? null : column.id)}
                    className="p-1 text-white/70 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
                    title={`Add task to ${column.label}`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Column Body */}
              <div className={`flex-1 rounded-b-xl border-2 border-t-0 p-3 space-y-3 transition-all duration-200 overflow-y-auto ${
                isDropTarget && isDragFromDifferentCol
                  ? `${column.bgLight} ${column.borderColor} ring-2 ring-offset-1 ring-${column.color}-300 scale-[1.01]`
                  : `bg-gray-50/50 border-gray-200/60`
              }`}>
                
                {/* ── Add Task Form (inline) ── */}
                {addingToColumn === column.id && (
                  <div className="bg-white rounded-xl border-2 border-dashed border-blue-300 p-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <input autoFocus type="text" placeholder="Task name..." className={inputClass}
                      value={newTask.title} onChange={(e) => setNewTask({...newTask, title: e.target.value})}
                      onKeyDown={(e) => { if (e.key === "Enter" && newTask.title.trim()) handleCreateTask(column.id); if (e.key === "Escape") setAddingToColumn(null); }} />
                    
                    {projects.length > 0 && (
                      <select className={inputClass} value={newTask.projectId} onChange={(e) => setNewTask({...newTask, projectId: e.target.value})}>
                        <option value="">— Select Project —</option>
                        {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Start</label>
                        <DatePicker selected={newTask.startDate} onChange={(d: Date | null) => d && setNewTask({...newTask, startDate: d})} dateFormat="dd MMM yyyy" className={inputClass} wrapperClassName="w-full" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">End</label>
                        <DatePicker selected={newTask.endDate} onChange={(d: Date | null) => d && setNewTask({...newTask, endDate: d})} dateFormat="dd MMM yyyy" minDate={newTask.startDate} className={inputClass} wrapperClassName="w-full" />
                      </div>
                    </div>

                    <select className={inputClass} value={newTask.priority} onChange={(e) => setNewTask({...newTask, priority: e.target.value})}>
                      {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>

                    <input type="url" placeholder="Docs link (optional)" className={inputClass}
                      value={newTask.documentation} onChange={(e) => setNewTask({...newTask, documentation: e.target.value})} />

                    <div>
                      <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Assignee</label>
                      <div className="flex flex-wrap gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2 py-1.5 min-h-[36px]">
                        {getExecutorOptions(newTask.projectId).map((opt: any) => {
                          const selected = (newTask.executor || "").split(", ").filter(Boolean);
                          const isChecked = selected.includes(opt.value);
                          return (
                            <label key={opt.value} className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full cursor-pointer transition-all border ${
                              isChecked ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-100"
                            }`}>
                              <input type="checkbox" checked={isChecked} className="hidden" onChange={() => {
                                const arr = selected.filter(Boolean);
                                const next = isChecked ? arr.filter(n => n !== opt.value) : [...arr, opt.value];
                                setNewTask({...newTask, executor: next.join(", ")});
                              }} />
                              {opt.label}
                            </label>
                          );
                        })}
                        {getExecutorOptions(newTask.projectId).length === 0 && <span className="text-xs text-gray-400 py-0.5">No members</span>}
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <button onClick={() => handleCreateTask(column.id)} disabled={isCreating || !newTask.title.trim()}
                        className="flex-1 flex justify-center items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 text-xs rounded-lg font-semibold hover:shadow-lg hover:shadow-blue-500/25 disabled:opacity-50 transition-all">
                        {isCreating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save
                      </button>
                      <button onClick={() => setAddingToColumn(null)}
                        className="px-4 py-2 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Drop hint */}
                {isDropTarget && isDragFromDifferentCol && (
                  <div className={`border-2 border-dashed ${column.borderColor} rounded-xl p-4 flex items-center justify-center text-sm font-medium ${column.badgeBg} bg-opacity-40`}>
                    <ArrowRight className="w-4 h-4 mr-2" /> Move to {column.label}
                  </div>
                )}

                {columnTasks.length === 0 && !isDropTarget && addingToColumn !== column.id && (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-300">
                    <Icon className="w-8 h-8 mb-2 opacity-40" />
                    <p className="text-xs font-medium">No tasks</p>
                  </div>
                )}

                {/* ── Task Cards ── */}
                {columnTasks.map((task) => {
                  const overdue = column.id !== "Completed" && isOverdue(task.endDate);
                  const isDragging = draggedTask === task.id;
                  const isUpdating = updatingTaskId === task.id;
                  const parentTask = task.parentId ? safeTasks.find(t => t.id === task.parentId) : null;

                  return (
                    <div key={task.id} draggable
                      onDragStart={(e) => handleDragStart(e, task.id)} onDragEnd={handleDragEnd}
                      onClick={() => openDetail(task)}
                      className={`group bg-white rounded-xl border shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer ${
                        isDragging ? 'opacity-50 scale-95 rotate-1' : 'opacity-100'
                      } ${isUpdating ? 'animate-pulse' : ''} ${
                        overdue ? 'border-red-200 bg-red-50/30' : 'border-gray-200/80 hover:border-blue-300'
                      }`}
                    >
                      {/* Card Top Bar */}
                      <div className="flex items-center justify-between px-3.5 pt-3 pb-1">
                        <div className="flex items-center gap-2">
                          <GripVertical className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-400 transition-colors cursor-grab" />
                          {task.priority === "Urgent" && (
                            <span className="text-[10px] font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">Urgent</span>
                          )}
                        </div>
                        <div className="relative" onClick={(e) => e.stopPropagation()}>
                          <button onClick={() => setOpenMenuId(openMenuId === task.id ? null : task.id)}
                            className="p-1 text-gray-300 hover:text-gray-500 rounded-md hover:bg-gray-100 transition-colors opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="w-4 h-4" />
                          </button>
                          {openMenuId === task.id && (
                            <div className="absolute right-0 top-7 z-50 w-44 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-100 origin-top-right">
                              <div className="p-1.5 space-y-0.5">
                                <button onClick={() => { openDetail(task); setOpenMenuId(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                                  <Pencil className="w-3.5 h-3.5" /> Edit Details
                                </button>
                                {getPrevStatus(task.status) && (
                                  <button onClick={() => { updateTaskStatus(task.id, getPrevStatus(task.status)!); setOpenMenuId(null); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                                    <ArrowLeft className="w-3.5 h-3.5" /> Move to {getPrevStatus(task.status)}
                                  </button>
                                )}
                                {getNextStatus(task.status) && (
                                  <button onClick={() => { updateTaskStatus(task.id, getNextStatus(task.status)!); setOpenMenuId(null); }}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
                                    <ArrowRight className="w-3.5 h-3.5" /> Move to {getNextStatus(task.status)}
                                  </button>
                                )}
                                <div className="border-t border-gray-100 my-1" />
                                <button onClick={() => { handleDeleteTask(task.id); setOpenMenuId(null); }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" /> Delete Task
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="px-3.5 pb-3">
                        {parentTask && (
                          <div className="flex items-center gap-1.5 mb-1 text-xs text-gray-400">
                            <div className="w-2 h-2 rounded-bl border-b border-l border-gray-300 -mt-1" />
                            <span className="truncate flex-1 font-medium">{parentTask.title}</span>
                          </div>
                        )}
                        <h4 className="text-sm font-semibold text-gray-900 leading-snug mb-2.5 line-clamp-2">{task.title}</h4>
                        
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          {task.project?.name && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                              <Folder className="w-2.5 h-2.5" /> {task.project.name}
                            </span>
                          )}
                          {task.executor && task.executor.split(", ").filter(Boolean).map((name: string) => (
                            <span key={name} className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                              <UserCircle className="w-2.5 h-2.5" /> {name.split(' ')[0]}
                            </span>
                          ))}
                          {task.documentation && (
                            <a href={task.documentation} target="_blank" rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 hover:bg-blue-100 transition-colors"
                              onClick={(e) => e.stopPropagation()}>
                              <ExternalLink className="w-2.5 h-2.5" /> Docs
                            </a>
                          )}
                        </div>

                        <div className={`flex items-center gap-1.5 text-[11px] font-medium ${overdue ? 'text-red-500' : 'text-gray-400'}`}>
                          <CalendarDays className="w-3 h-3" />
                          <span className="tabular-nums">{formatDate(task.startDate)} — {formatDate(task.endDate)}</span>
                          {overdue && <span className="text-[9px] font-bold uppercase tracking-wider bg-red-100 text-red-600 px-1.5 py-0.5 rounded ml-auto">Overdue</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══════════ Task Detail / Edit Modal ═══════════ */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedTask(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Task Details</h2>
                  <p className="text-blue-100 text-xs mt-0.5">Edit task information</p>
                </div>
              </div>
              <button onClick={() => setSelectedTask(null)} 
                className="absolute top-4 right-4 p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white/80 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
              {/* Title */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  <Pencil className="w-3.5 h-3.5" /> Task Name <span className="text-red-400">*</span>
                </label>
                <input type="text" className={inputClass} value={editData.title || ""}
                  onChange={(e) => setEditData({...editData, title: e.target.value})} />
              </div>

              {/* Status & Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    <Clock className="w-3.5 h-3.5" /> Status
                  </label>
                  <select className={inputClass} value={editData.status} onChange={(e) => setEditData({...editData, status: e.target.value})}>
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    <AlertCircle className="w-3.5 h-3.5" /> Priority
                  </label>
                  <select className={inputClass} value={editData.priority} onChange={(e) => setEditData({...editData, priority: e.target.value})}>
                    {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
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

              {/* Documentation */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  <Link2 className="w-3.5 h-3.5" /> Documentation Link
                </label>
                <input type="url" placeholder="https://..." className={inputClass}
                  value={editData.documentation || ""} onChange={(e) => setEditData({...editData, documentation: e.target.value})} />
              </div>

                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    <UserCircle className="w-3.5 h-3.5" /> Assignee
                  </label>
                  <div className="grid grid-cols-2 gap-2 mt-1 max-h-40 overflow-y-auto bg-gray-50 p-3 rounded-xl border border-gray-200">
                    {getExecutorOptions(selectedTask.projectId).map((opt: any) => {
                      const selected = (editData.executor || "").split(", ").filter(Boolean);
                      const isChecked = selected.includes(opt.value);
                      return (
                        <label key={opt.value} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer p-1.5 rounded hover:bg-gray-100 transition-colors">
                          <input type="checkbox" checked={isChecked} onChange={() => {
                            const arr = selected.filter(Boolean);
                            const next = isChecked ? arr.filter((n: string) => n !== opt.value) : [...arr, opt.value];
                            setEditData({...editData, executor: next.join(", ")});
                          }} className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4" />
                          <span className="truncate">{opt.label}</span>
                        </label>
                      );
                    })}
                    {getExecutorOptions(selectedTask.projectId).length === 0 && <span className="text-xs text-gray-500 col-span-2">No team members.</span>}
                  </div>
                </div>

              {/* Read-only info */}
              {selectedTask.project?.name && (
                <div className="flex items-center gap-2 p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                  <Folder className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm font-medium text-indigo-700">Project: {selectedTask.project.name}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between">
              <button onClick={() => handleDeleteTask(selectedTask.id)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
              <div className="flex items-center gap-3">
                <button onClick={() => setSelectedTask(null)} className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl font-medium transition-all">
                  Cancel
                </button>
                <button onClick={handleSaveEdit} disabled={isSaving || !editData.title?.trim()}
                  className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 flex items-center gap-2">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
