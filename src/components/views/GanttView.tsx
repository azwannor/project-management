"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import {
  ChevronRight, ChevronDown, Plus, Save, Loader2, X,
  CalendarDays, Pencil, CheckCircle2, Clock, AlertCircle,
  PauseCircle, UserCircle, ZoomIn, ZoomOut, Target,
  Folder, Link2, XCircle
} from "lucide-react";

// ─── Types ───
interface GanttTask {
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
  subTasks?: GanttTask[];
}

type VisibleItem = 
  | { type: 'project'; id: string; name: string }
  | { type: 'task'; task: GanttTask; level: number };

type ZoomLevel = "day" | "week" | "month";

// ─── Helpers ───
const DAY_MS = 86400000;

const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);
const diffDays = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY_MS);
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfWeek = (d: Date) => { const day = d.getDay(); return addDays(startOfDay(d), -day); };
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

const statusConfig: Record<string, { color: string; bg: string; border: string; icon: any }> = {
  "Not Started": { color: "text-slate-600", bg: "bg-slate-400", border: "border-slate-300", icon: AlertCircle },
  "Ongoing": { color: "text-blue-600", bg: "bg-blue-500", border: "border-blue-300", icon: Clock },
  "Suspended": { color: "text-amber-600", bg: "bg-amber-500", border: "border-amber-300", icon: PauseCircle },
  "Completed": { color: "text-emerald-600", bg: "bg-emerald-500", border: "border-emerald-300", icon: CheckCircle2 },
};

const barGradients: Record<string, string> = {
  "Not Started": "from-slate-300 to-slate-400",
  "Ongoing": "from-blue-400 to-indigo-500",
  "Suspended": "from-amber-400 to-orange-500",
  "Completed": "from-emerald-400 to-green-500",
};

const priorityColors: Record<string, string> = {
  "Normal": "bg-gray-100 text-gray-600 border-gray-200",
  "Butuh Cepat": "bg-red-50 text-red-600 border-red-200",
};

const inputClass = "w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all";

// ─── Main Component ───
interface GanttViewProps {
  tasks: any[];
  projects: any[];
  users?: any[];
}

export default function GanttView({ tasks, projects = [], users = [] }: GanttViewProps) {
  const router = useRouter();
  const timelineRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState<ZoomLevel>("day");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [selectedTask, setSelectedTask] = useState<GanttTask | null>(null);
  const [editData, setEditData] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskData, setNewTaskData] = useState({
    title: "", priority: "Normal", status: "Not Started", projectId: "", executor: "", documentation: "",
    startDate: new Date(), endDate: addDays(new Date(), 7)
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const safeTasks: GanttTask[] = tasks || [];
  const rootTasks = safeTasks.filter(t => !t.parentId);
  const getChildren = (parentId: string) => safeTasks.filter(t => t.parentId === parentId);

  // ─── Executor Options ───
  const getExecutorOptions = (projectId?: string | null) => {
    let rawOpts: { value: string; label: string }[] = [];
    if (!projectId) {
      rawOpts = users?.map((u: any) => ({ value: u.name, label: u.name })) || [];
    } else {
      const project = projects.find(p => p.id === projectId);
      if (project && project.members) {
        const validUserNames = users?.map((u: any) => u.name) || [];
        rawOpts = project.members
          .split(", ")
          .filter(Boolean)
          .filter((m: string) => validUserNames.includes(m))
          .map((m: string) => ({ value: m, label: m }));
      }
    }
    const seen = new Set<string>();
    return rawOpts.filter(o => { if (seen.has(o.value)) return false; seen.add(o.value); return true; });
  };

  // ─── Timeline Calculations ───
  const { timelineStart, timelineEnd, columnCount, cellWidth, columns } = useMemo(() => {
    const today = startOfDay(new Date());
    let minDate = today;
    let maxDate = addDays(today, 30);

    safeTasks.forEach(t => {
      const s = startOfDay(new Date(t.startDate));
      const e = startOfDay(new Date(t.endDate));
      if (s < minDate) minDate = s;
      if (e > maxDate) maxDate = e;
    });

    // Add padding
    minDate = addDays(minDate, -7);
    maxDate = addDays(maxDate, 14);

    let cellW: number;
    let cols: { date: Date; label: string; isToday: boolean; isWeekend: boolean; month?: string }[] = [];

    if (zoom === "day") {
      cellW = 40;
      const count = diffDays(minDate, maxDate) + 1;
      for (let i = 0; i < count; i++) {
        const d = addDays(minDate, i);
        const dayOfWeek = d.getDay();
        cols.push({
          date: d,
          label: d.getDate().toString(),
          isToday: d.getTime() === today.getTime(),
          isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
          month: d.getDate() === 1 || i === 0 ? d.toLocaleDateString("id-ID", { month: "short", year: "numeric" }) : undefined
        });
      }
      return { timelineStart: minDate, timelineEnd: maxDate, columnCount: count, cellWidth: cellW, columns: cols };
    } else if (zoom === "week") {
      cellW = 120;
      let current = startOfWeek(minDate);
      while (current <= maxDate) {
        const end = addDays(current, 6);
        cols.push({
          date: current,
          label: `${current.getDate()} - ${end.getDate()} ${end.toLocaleDateString("id-ID", { month: "short" })}`,
          isToday: today >= current && today <= end,
          isWeekend: false,
          month: current.getDate() <= 7 ? current.toLocaleDateString("id-ID", { month: "short", year: "numeric" }) : undefined
        });
        current = addDays(current, 7);
      }
      return { timelineStart: startOfWeek(minDate), timelineEnd: maxDate, columnCount: cols.length, cellWidth: cellW, columns: cols };
    } else {
      cellW = 160;
      let current = startOfMonth(minDate);
      while (current <= maxDate) {
        cols.push({
          date: current,
          label: current.toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
          isToday: today.getMonth() === current.getMonth() && today.getFullYear() === current.getFullYear(),
          isWeekend: false,
        });
        current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      }
      return { timelineStart: startOfMonth(minDate), timelineEnd: maxDate, columnCount: cols.length, cellWidth: cellW, columns: cols };
    }
  }, [safeTasks, zoom]);

  // ─── Bar Position Calculator ───
  const getBarStyle = (task: GanttTask) => {
    const start = startOfDay(new Date(task.startDate));
    const end = startOfDay(new Date(task.endDate));
    
    let leftPx: number, widthPx: number;

    if (zoom === "day") {
      const offsetDays = diffDays(timelineStart, start);
      const durationDays = Math.max(diffDays(start, end), 1);
      leftPx = offsetDays * cellWidth;
      widthPx = durationDays * cellWidth;
    } else if (zoom === "week") {
      const offsetDays = diffDays(timelineStart, start);
      const durationDays = Math.max(diffDays(start, end), 1);
      leftPx = (offsetDays / 7) * cellWidth;
      widthPx = (durationDays / 7) * cellWidth;
    } else {
      // month view: approximate
      const totalDays = diffDays(timelineStart, timelineEnd);
      const totalWidth = columnCount * cellWidth;
      const offsetDays = diffDays(timelineStart, start);
      const durationDays = Math.max(diffDays(start, end), 1);
      leftPx = (offsetDays / totalDays) * totalWidth;
      widthPx = (durationDays / totalDays) * totalWidth;
    }

    return { left: Math.max(leftPx, 0), width: Math.max(widthPx, 20) };
  };

  // ─── Today Line Position ───
  const todayLeft = useMemo(() => {
    const today = startOfDay(new Date());
    if (zoom === "day") return diffDays(timelineStart, today) * cellWidth + cellWidth / 2;
    if (zoom === "week") return (diffDays(timelineStart, today) / 7) * cellWidth;
    const totalDays = diffDays(timelineStart, timelineEnd) || 1;
    return (diffDays(timelineStart, today) / totalDays) * (columnCount * cellWidth);
  }, [timelineStart, timelineEnd, cellWidth, columnCount, zoom]);

  // ─── Scroll to Today on Mount ───
  useEffect(() => {
    if (bodyRef.current) {
      const scrollLeft = Math.max(todayLeft - bodyRef.current.clientWidth / 3, 0);
      bodyRef.current.scrollLeft = scrollLeft;
    }
  }, [zoom, todayLeft]);

  // Sync scroll
  const handleScroll = () => {
    if (bodyRef.current && headerRef.current) {
      headerRef.current.scrollLeft = bodyRef.current.scrollLeft;
    }
  };

  // ─── Toggle Row ───
  const toggleRow = (id: string) => setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));

  // ─── Open Edit Modal ───
  const openEditModal = (task: GanttTask) => {
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
  };

  // ─── Save Edit ───
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
    } catch (e) { console.error(e); }
    finally { setIsSaving(false); }
  };

  // ─── Add Task ───
  const handleAddTask = async () => {
    if (!newTaskData.title.trim()) return;
    setIsSubmitting(true);
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newTaskData,
          projectId: newTaskData.projectId || (projects[0]?.id || null),
          executor: newTaskData.executor || null,
          documentation: newTaskData.documentation || null,
          startDate: newTaskData.startDate.toISOString(),
          endDate: newTaskData.endDate.toISOString(),
        }),
      });
      setNewTaskData({ title: "", priority: "Normal", status: "Not Started", projectId: "", executor: "", documentation: "", startDate: new Date(), endDate: addDays(new Date(), 7) });
      setAddingTask(false);
      router.refresh();
    } catch (e) { console.error(e); }
    finally { setIsSubmitting(false); }
  };

  const totalWidth = columnCount * cellWidth;
  const ROW_HEIGHT = 44;

  const tasksByProject: Record<string, { projectName: string; tasks: GanttTask[] }> = {};
  rootTasks.forEach(task => {
    const projectId = task.projectId || "unassigned";
    const projectName = task.project?.name || "No Project";
    if (!tasksByProject[projectId]) tasksByProject[projectId] = { projectName, tasks: [] };
    tasksByProject[projectId].tasks.push(task);
  });

  // ─── Flatten visible tasks ───
  const flattenTasks = (): VisibleItem[] => {
    const result: VisibleItem[] = [];
    const traverse = (tasks: GanttTask[], level: number) => {
      tasks.forEach(t => {
        result.push({ type: 'task', task: t, level });
        if (expandedRows[t.id]) {
          traverse(getChildren(t.id), level + 1);
        }
      });
    };
    
    Object.entries(tasksByProject).forEach(([projectId, group]) => {
      result.push({ type: 'project', id: projectId, name: group.projectName });
      traverse(group.tasks, 0);
    });

    return result;
  };

  const visibleItems = flattenTasks();

  const projectOptions = projects.length === 0
    ? [{ value: "", label: "No project yet" }]
    : projects.map((p: any) => ({ value: p.id, label: p.name }));

  return (
    <div className="h-full flex flex-col bg-white rounded-xl shadow-sm border border-gray-200/60 overflow-hidden">
      {/* ═══ Toolbar ═══ */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50/90 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-2">Zoom</span>
          {(["day", "week", "month"] as ZoomLevel[]).map(z => (
            <button key={z} onClick={() => setZoom(z)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                zoom === z ? "bg-blue-600 text-white shadow-sm" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
              }`}>
              {z === "day" ? "Hari" : z === "week" ? "Minggu" : "Bulan"}
            </button>
          ))}
        </div>
        <button onClick={() => setAddingTask(true)}
          className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 text-xs rounded-lg font-semibold hover:shadow-lg hover:shadow-blue-500/25 hover:-translate-y-0.5 transition-all">
          <Plus className="w-3.5 h-3.5" /> Add Task
        </button>
      </div>

      {/* ═══ Chart Body ═══ */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Panel: Task List ── */}
        <div className="w-[280px] shrink-0 border-r border-gray-200 flex flex-col bg-white z-10">
          {/* Header */}
          <div className="h-[60px] flex items-center px-4 border-b-2 border-gray-200 bg-gray-50/90 shrink-0">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Task Name</span>
          </div>
          
          {/* Task Rows */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden" onScroll={(e) => {
            // Sync vertical scroll
            if (bodyRef.current) bodyRef.current.scrollTop = (e.target as HTMLDivElement).scrollTop;
          }}>
            {/* Add Task Inline */}
            {addingTask && (
              <div className="border-b-2 border-blue-200 bg-blue-50/60 p-3 space-y-2">
                <input autoFocus type="text" placeholder="Nama task..." className={inputClass}
                  value={newTaskData.title} onChange={(e) => setNewTaskData({...newTaskData, title: e.target.value})}
                  onKeyDown={(e) => { if (e.key === "Enter" && newTaskData.title.trim()) handleAddTask(); if (e.key === "Escape") setAddingTask(false); }}
                />
                {projects.length > 0 && (
                  <select className={inputClass} value={newTaskData.projectId} onChange={(e) => setNewTaskData({...newTaskData, projectId: e.target.value})}>
                    <option value="">— Project —</option>
                    {projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[9px] font-bold text-gray-400 uppercase mb-0.5">Start</label>
                    <DatePicker selected={newTaskData.startDate} onChange={(d: Date | null) => d && setNewTaskData({...newTaskData, startDate: d})}
                      dateFormat="dd MMM yy" className={`${inputClass} text-xs`} wrapperClassName="w-full" />
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-gray-400 uppercase mb-0.5">End</label>
                    <DatePicker selected={newTaskData.endDate} onChange={(d: Date | null) => d && setNewTaskData({...newTaskData, endDate: d})}
                      dateFormat="dd MMM yy" minDate={newTaskData.startDate} className={`${inputClass} text-xs`} wrapperClassName="w-full" />
                  </div>
                </div>
                <select className={inputClass} value={newTaskData.priority} onChange={(e) => setNewTaskData({...newTaskData, priority: e.target.value})}>
                  <option value="Normal">Normal</option>
                  <option value="Butuh Cepat">Butuh Cepat</option>
                </select>
                {/* Executor multi-select */}
                <div>
                  <label className="block text-[9px] font-bold text-gray-400 uppercase mb-0.5">Executor</label>
                  <div className="flex flex-wrap gap-1 bg-gray-50 border border-gray-200 rounded-xl px-2 py-1.5 min-h-[32px]">
                    {getExecutorOptions(newTaskData.projectId).map((opt: any) => {
                      const selected = (newTaskData.executor || "").split(", ").filter(Boolean);
                      const isChecked = selected.includes(opt.value);
                      return (
                        <label key={opt.value} className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full cursor-pointer transition-all border ${
                          isChecked ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-100"
                        }`}>
                          <input type="checkbox" checked={isChecked} className="hidden" onChange={() => {
                            const arr = selected.filter(Boolean);
                            const next = isChecked ? arr.filter((n: string) => n !== opt.value) : [...arr, opt.value];
                            setNewTaskData({...newTaskData, executor: next.join(", ")});
                          }} />
                          {opt.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddTask} disabled={isSubmitting || !newTaskData.title.trim()}
                    className="flex-1 flex justify-center items-center gap-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-3 py-2 text-xs rounded-lg font-semibold disabled:opacity-50 transition-all">
                    {isSubmitting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
                  </button>
                  <button onClick={() => setAddingTask(false)} className="px-3 py-2 text-xs text-gray-500 hover:bg-gray-100 rounded-lg font-medium transition-colors">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {visibleItems.map((item) => {
              if (item.type === 'project') {
                return (
                  <div key={`proj-${item.id}`} className="flex items-center px-4 bg-slate-50 border-y border-slate-200 font-bold text-slate-600 text-[10px] uppercase tracking-wider" style={{ height: ROW_HEIGHT }}>
                    <Folder className="w-3.5 h-3.5 mr-2 text-indigo-400" />
                    {item.name}
                  </div>
                );
              }

              const { task, level } = item;
              const children = getChildren(task.id);
              const hasChildren = children.length > 0;
              const isExpanded = expandedRows[task.id];
              const sc = statusConfig[task.status] || statusConfig["Not Started"];
              const StatusIcon = sc.icon;

              return (
                <div key={task.id}
                  className="flex items-center border-b border-gray-100 hover:bg-blue-50/40 transition-colors group cursor-pointer"
                  style={{ height: ROW_HEIGHT, paddingLeft: `${level * 20 + 16}px` }}
                  onClick={() => openEditModal(task)}
                >
                  {/* Expand/Collapse */}
                  <div className="w-5 shrink-0 flex items-center justify-center">
                    {hasChildren ? (
                      <button onClick={(e) => { e.stopPropagation(); toggleRow(task.id); }}
                        className="p-0.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors">
                        {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      </button>
                    ) : (
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                    )}
                  </div>

                  {/* Status Icon */}
                  <StatusIcon className={`w-3.5 h-3.5 ${sc.color} shrink-0 mx-1.5`} />

                  {/* Title */}
                  <span className="text-sm text-gray-800 font-medium truncate flex-1 group-hover:text-blue-700 transition-colors">
                    {task.title}
                  </span>

                  {/* Edit hint */}
                  <Pencil className="w-3 h-3 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity mr-2 shrink-0" />
                </div>
              );
            })}

            {visibleItems.length === 0 && !addingTask && (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <CalendarDays className="w-8 h-8 mb-2 opacity-40" />
                <span className="text-xs font-medium">Belum ada task</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Right Panel: Timeline ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Timeline Header */}
          <div ref={headerRef} className="h-[60px] overflow-hidden border-b-2 border-gray-200 bg-gray-50/90 shrink-0">
            <div style={{ width: totalWidth }} className="h-full flex flex-col">
              {/* Month Row */}
              {zoom === "day" && (
                <div className="flex h-[28px]">
                  {(() => {
                    const months: { label: string; span: number }[] = [];
                    let currentLabel = "";
                    columns.forEach(col => {
                      const ml = col.date.toLocaleDateString("id-ID", { month: "short", year: "numeric" });
                      if (ml !== currentLabel) {
                        months.push({ label: ml, span: 1 });
                        currentLabel = ml;
                      } else {
                        months[months.length - 1].span++;
                      }
                    });
                    return months.map((m, i) => (
                      <div key={i} style={{ width: m.span * cellWidth }}
                        className="border-r border-gray-200 flex items-center justify-center text-[10px] font-bold text-gray-500 uppercase tracking-wider bg-gray-100/60">
                        {m.label}
                      </div>
                    ));
                  })()}
                </div>
              )}
              {/* Day/Week/Month Cells */}
              <div className={`flex ${zoom === "day" ? "h-[32px]" : "h-full"}`}>
                {columns.map((col, i) => (
                  <div key={i} style={{ width: cellWidth, minWidth: cellWidth }}
                    className={`border-r flex items-center justify-center text-[10px] font-semibold shrink-0 select-none ${
                      col.isToday ? "bg-blue-100/80 text-blue-700 font-bold" :
                      col.isWeekend ? "bg-gray-100/60 text-gray-400" :
                      "text-gray-500 border-gray-200"
                    }`}>
                    {zoom === "day" ? (
                      <div className="flex flex-col items-center leading-tight">
                        <span className="text-[9px] text-gray-400">{col.date.toLocaleDateString("id-ID", { weekday: "narrow" })}</span>
                        <span>{col.label}</span>
                      </div>
                    ) : (
                      <span className="truncate px-1">{col.label}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Timeline Body */}
          <div ref={bodyRef} className="flex-1 overflow-auto" onScroll={handleScroll}>
            <div style={{ width: totalWidth, minHeight: "100%" }} className="relative">
              {/* Grid Lines */}
              <div className="absolute inset-0 flex pointer-events-none">
                {columns.map((col, i) => (
                  <div key={i} style={{ width: cellWidth, minWidth: cellWidth }}
                    className={`border-r shrink-0 h-full ${
                      col.isToday ? "bg-blue-50/40" :
                      col.isWeekend ? "bg-gray-50/60" :
                      "border-gray-100"
                    }`} />
                ))}
              </div>

              {/* Today Line */}
              {todayLeft > 0 && todayLeft < totalWidth && (
                <div className="absolute top-0 bottom-0 z-20 pointer-events-none" style={{ left: todayLeft }}>
                  <div className="w-0.5 h-full bg-red-400/60" />
                  <div className="absolute -top-0 -left-[14px] bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-b-md uppercase tracking-wider">
                    Hari ini
                  </div>
                </div>
              )}

              {/* Task Bars */}
              {visibleItems.map((item, idx) => {
                if (item.type === 'project') {
                  return (
                    <div key={`proj-${item.id}`} className="bg-slate-50/50 border-y border-slate-200/50" style={{ height: ROW_HEIGHT }}></div>
                  );
                }

                const { task } = item;
                const barStyle = getBarStyle(task);
                const sc = statusConfig[task.status] || statusConfig["Not Started"];
                const gradient = barGradients[task.status] || barGradients["Not Started"];
                const isOverdue = new Date(task.endDate) < new Date() && task.status !== "Completed";
                const durationDays = diffDays(new Date(task.startDate), new Date(task.endDate));

                return (
                  <div key={task.id} className="relative hover:z-50" style={{ height: ROW_HEIGHT }}>
                    {/* Row background stripe */}
                    <div className={`absolute inset-0 ${idx % 2 === 0 ? "" : "bg-gray-50/30"} border-b border-gray-100/60`} />
                    
                    {/* Bar */}
                    <div
                      className="absolute top-[8px] group/bar cursor-pointer z-10"
                      style={{ left: barStyle.left, width: barStyle.width }}
                      onClick={() => openEditModal(task)}
                    >
                      <div className={`h-[28px] rounded-lg bg-gradient-to-r ${gradient} shadow-sm hover:shadow-md hover:brightness-110 transition-all relative overflow-hidden flex items-center`}>
                        {/* Progress overlay for completed */}
                        {task.status === "Completed" && (
                          <div className="absolute inset-0 bg-white/10" />
                        )}
                        
                        {/* Overdue pattern */}
                        {isOverdue && (
                          <div className="absolute right-0 top-0 bottom-0 w-3 bg-gradient-to-l from-red-500/40 to-transparent" />
                        )}

                        {/* Bar Label */}
                        {barStyle.width > 60 && (
                          <span className="text-[10px] text-white font-semibold truncate px-2.5 drop-shadow-sm relative z-10">
                            {task.title}
                          </span>
                        )}
                      </div>

                      {/* Tooltip on hover */}
                      <div className="absolute left-0 top-full mt-1 bg-gray-900 text-white px-3 py-2 rounded-lg text-xs shadow-xl opacity-0 group-hover/bar:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap">
                        <div className="font-semibold mb-1">{task.title}</div>
                        <div className="text-gray-300">{new Date(task.startDate).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} — {new Date(task.endDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}</div>
                        <div className="text-gray-300">{durationDays} hari • {task.status}</div>
                        {task.executor && <div className="text-amber-300 mt-0.5">👤 {task.executor}</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════ Edit Task Modal ══════════ */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedTask(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            
            {/* Modal Header */}
            <div className="relative bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                  <Pencil className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Edit Task</h2>
                  <p className="text-blue-100 text-xs mt-0.5">Perbarui detail task dari Gantt Chart</p>
                </div>
              </div>
              <button onClick={() => setSelectedTask(null)} className="absolute top-4 right-4 p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white/80 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Title */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  <Target className="w-3.5 h-3.5" /> Nama Task
                </label>
                <input type="text" className={inputClass} value={editData.title || ""}
                  onChange={(e) => setEditData({...editData, title: e.target.value})} />
              </div>

              {/* Status & Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Status</label>
                  <select className={inputClass} value={editData.status} onChange={(e) => setEditData({...editData, status: e.target.value})}>
                    {["Not Started", "Ongoing", "Suspended", "Completed"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Prioritas</label>
                  <select className={inputClass} value={editData.priority} onChange={(e) => setEditData({...editData, priority: e.target.value})}>
                    <option value="Normal">Normal</option>
                    <option value="Butuh Cepat">Butuh Cepat</option>
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
                  <Link2 className="w-3.5 h-3.5" /> Link Dokumentasi
                </label>
                <input type="url" placeholder="https://..." className={inputClass}
                  value={editData.documentation || ""} onChange={(e) => setEditData({...editData, documentation: e.target.value})} />
              </div>

              {/* Executor */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  <UserCircle className="w-3.5 h-3.5" /> Penanggung Jawab
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
                  {getExecutorOptions(selectedTask.projectId).length === 0 && <span className="text-xs text-gray-500 col-span-2">Tidak ada anggota tim.</span>}
                </div>
              </div>

              {/* Project info */}
              {selectedTask.project?.name && (
                <div className="flex items-center gap-2 p-3 bg-indigo-50/60 rounded-xl border border-indigo-100">
                  <Folder className="w-4 h-4 text-indigo-500" />
                  <span className="text-sm font-medium text-indigo-700">Project: {selectedTask.project.name}</span>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-gray-50/80 border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
              <button onClick={() => setSelectedTask(null)}
                className="px-4 py-2.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl font-medium transition-all">
                Cancel
              </button>
              <button onClick={handleSaveEdit} disabled={!editData.title?.trim() || isSaving}
                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30 hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 flex items-center gap-2">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
