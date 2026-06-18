"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronRight, ChevronDown, Clock, AlertCircle, CheckCircle2, Table2, ExternalLink, Plus, Loader2, Trash2, Save, XCircle, Link2, CalendarDays, Pencil, Check, X, PauseCircle, UserCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import ModernSelect from "../common/ModernSelect";

// ─── Inline Editable Cell Components ───

function EditableText({ value, taskId, field, onSave }: { value: string; taskId: string; field: string; onSave: (id: string, field: string, val: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);
  useEffect(() => { setLocalVal(value); }, [value]);

  const commit = () => {
    if (localVal.trim() && localVal !== value) {
      onSave(taskId, field, localVal.trim());
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setLocalVal(value); setEditing(false); } }}
        className="w-full bg-white border border-blue-400 rounded-lg px-2 py-1 text-sm outline-none ring-4 ring-blue-500/10 transition-all"
      />
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className="cursor-pointer hover:bg-blue-50 hover:text-blue-700 px-1 py-0.5 rounded-md transition-colors block w-full whitespace-normal break-words"
      title={value ? `${value} (Click to edit)` : "Click to edit"}
    >
      {value || "-"}
    </span>
  );
}

function EditableDate({ value, taskId, field, onSave, minDate }: { value: string | Date; taskId: string; field: string; onSave: (id: string, field: string, val: string) => void; minDate?: Date }) {
  const [editing, setEditing] = useState(false);
  const dateVal = value ? new Date(value) : new Date();

  if (editing) {
    return (
      <div className="relative z-20">
        <DatePicker
          selected={dateVal}
          onChange={(date: Date | null) => {
            if (date) {
              onSave(taskId, field, date.toISOString());
              setEditing(false);
            }
          }}
          dateFormat="dd MMM yyyy"
          minDate={minDate}
          className="w-full bg-white border border-blue-400 rounded-lg px-2 py-1 text-xs outline-none ring-4 ring-blue-500/10 transition-all"
          autoFocus
          onClickOutside={() => setEditing(false)}
          open
          popperClassName="datepicker-popper"
        />
      </div>
    );
  }

  const formatted = dateVal.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  return (
    <span
      onClick={() => setEditing(true)}
      className="cursor-pointer hover:bg-blue-50 hover:text-blue-700 px-1 py-0.5 rounded-md transition-colors text-xs tabular-nums"
      title="Click to change date"
    >
      {formatted}
    </span>
  );
}

function EditableSelect({ value, taskId, field, options, onSave, renderDisplay }: { 
  value: string; taskId: string; field: string; 
  options: { value: string; label: string }[]; 
  onSave: (id: string, field: string, val: string) => void;
  renderDisplay?: (val: string) => React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  useEffect(() => {
    if (!editing) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setEditing(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [editing]);

  const openDropdown = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // Check if dropdown would go below viewport
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = options.length * 36 + 16; // approximate
      const top = spaceBelow < dropdownHeight ? rect.top - dropdownHeight : rect.bottom + 4;
      setPos({ top, left: rect.left });
    }
    setEditing(true);
  };

  return (
    <>
      <div ref={triggerRef} onClick={openDropdown} className="cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded-md inline-block max-w-full truncate" title="Click to change">
        {renderDisplay ? renderDisplay(value) : (value || "-")}
      </div>
      {editing && (
        <div 
          ref={dropdownRef}
          className="fixed z-[9999] min-w-[160px] bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="p-1.5 space-y-0.5">
            {options.map((opt) => (
              <div
                key={opt.value}
                className={`flex items-center justify-between px-3 py-2.5 text-xs rounded-lg cursor-pointer transition-all ${
                  value === opt.value ? "bg-blue-50 text-blue-700 font-semibold" : "text-gray-600 hover:bg-gray-50 font-medium"
                }`}
                onClick={() => {
                  if (opt.value !== value) onSave(taskId, field, opt.value);
                  setEditing(false);
                }}
              >
                <span>{opt.label}</span>
                {value === opt.value && <Check className="w-3.5 h-3.5 text-blue-600 ml-2" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Multi-Select for Executor ───
function EditableMultiSelect({ value, taskId, field, options, onSave }: {
  value: string; taskId: string; field: string;
  options: { value: string; label: string }[];
  onSave: (id: string, field: string, val: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [localVal, setLocalVal] = useState(value);

  useEffect(() => { setLocalVal(value); }, [value]);

  useEffect(() => {
    if (!editing) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        if (localVal !== value) onSave(taskId, field, localVal);
        setEditing(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [editing, localVal, value, taskId, field, onSave]);

  const openDropdown = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const dropdownHeight = options.length * 36 + 48;
      const top = spaceBelow < dropdownHeight ? rect.top - dropdownHeight : rect.bottom + 4;
      setPos({ top, left: rect.left });
    }
    setEditing(true);
  };

  const selectedNames = localVal ? localVal.split(", ").filter(Boolean) : [];

  const toggleName = (name: string) => {
    if (selectedNames.includes(name)) {
      setLocalVal(selectedNames.filter(n => n !== name).join(", "));
    } else {
      setLocalVal([...selectedNames, name].join(", "));
    }
  };

  const handleDone = () => {
    if (localVal !== value) onSave(taskId, field, localVal);
    setEditing(false);
  };

  return (
    <>
      <div ref={triggerRef} onClick={openDropdown} className="cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded-md inline-block max-w-full" title="Click to change">
        {selectedNames.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {selectedNames.map(n => (
              <span key={n} className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">
                <UserCircle className="w-2.5 h-2.5" />{n.split(' ')[0]}
              </span>
            ))}
          </div>
        ) : (
          <span className="text-gray-400 text-sm">-</span>
        )}
      </div>
      {editing && (
        <div
          ref={dropdownRef}
          className="fixed z-[9999] min-w-[200px] bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          style={{ top: pos.top, left: pos.left }}
        >
          <div className="p-2 space-y-0.5 max-h-48 overflow-y-auto">
            {options.filter(o => o.value).map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-2 px-3 py-2 text-xs rounded-lg cursor-pointer transition-all ${
                  selectedNames.includes(opt.value) ? "bg-amber-50 text-amber-800 font-semibold" : "text-gray-600 hover:bg-gray-50 font-medium"
                }`}
              >
                <input type="checkbox" checked={selectedNames.includes(opt.value)} onChange={() => toggleName(opt.value)}
                  className="rounded text-amber-600 focus:ring-amber-500 w-3.5 h-3.5" />
                <span>{opt.label}</span>
              </label>
            ))}
            {options.filter(o => o.value).length === 0 && <span className="text-xs text-gray-400 px-3 py-2 block">No members</span>}
          </div>
          <div className="border-t border-gray-100 p-2">
            <button onClick={handleDone}
              className="w-full text-center text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-2 rounded-lg hover:shadow-md transition-all">
              Done
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function EditableUrl({ value, taskId, onSave }: { value: string; taskId: string; onSave: (id: string, field: string, val: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(value || "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);
  useEffect(() => { setLocalVal(value || ""); }, [value]);

  const commit = () => {
    if (localVal !== (value || "")) {
      onSave(taskId, "documentation", localVal);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={localVal}
          onChange={(e) => setLocalVal(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setLocalVal(value || ""); setEditing(false); } }}
          placeholder="https://..."
          className="w-full bg-white border border-blue-400 rounded-lg px-2 py-1 text-xs outline-none ring-4 ring-blue-500/10 transition-all"
        />
      </div>
    );
  }

  if (value) {
    return (
      <div className="flex items-center gap-1.5">
        <a href={value} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 bg-blue-50 p-1.5 rounded-lg border border-blue-100 transition-colors hover:shadow-sm" title="Open document">
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
        <button onClick={() => setEditing(true)} className="p-1 text-gray-300 hover:text-gray-500 rounded-md hover:bg-gray-100 transition-colors" title="Edit URL">
          <Pencil className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => setEditing(true)} className="text-gray-300 hover:text-blue-500 p-1.5 rounded-lg hover:bg-blue-50 transition-colors" title="Add docs link">
      <Link2 className="w-3.5 h-3.5" />
    </button>
  );
}

// ─── Main TableView ───

export default function TableView({ tasks, projects = [], selectedProjectId = "all", users = [] }: { tasks: any[], projects?: any[], selectedProjectId?: string, users?: any[] }) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [addingSubtask, setAddingSubtask] = useState<string | null>(null);
  const [addingRootTask, setAddingRootTask] = useState(false);
  const [newTaskData, setNewTaskData] = useState<{
    title: string;
    startDate: Date;
    endDate: Date;
    priority: string;
    status: string;
    documentation: string;
    projectId?: string;
    executor?: string;
  }>({
    title: "",
    startDate: new Date(),
    endDate: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000),
    priority: "Normal",
    status: "Not Started",
    documentation: "",
    projectId: "",
    executor: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const toggleRow = (taskId: string) => {
    setExpandedRows(prev => ({ ...prev, [taskId]: !prev[taskId] }));
  };

  // ─── Inline Update Handler ───
  const handleInlineUpdate = async (taskId: string, field: string, value: string) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value })
      });
      router.refresh();
    } catch (error) {
      console.error("Update failed:", error);
    }
  };

  const handleAddSubtask = async (parentId: string, projectId: string | null) => {
    if (!newTaskData.title.trim()) return;
    setIsSubmitting(true);
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newTaskData, parentId, projectId })
      });
      setNewTaskData({ title: "", startDate: new Date(), endDate: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000), priority: "Normal", status: "Not Started", documentation: "" });
      setAddingSubtask(null);
      setExpandedRows(prev => ({ ...prev, [parentId]: true }));
      router.refresh();
    } catch (error) { console.error(error); } finally { setIsSubmitting(false); }
  };

  const handleAddRootTask = async () => {
    if (!newTaskData.title.trim()) return;
    setIsSubmitting(true);
    let finalProjectId = newTaskData.projectId || (selectedProjectId !== "all" ? selectedProjectId : projects[0]?.id || "");
    if (!finalProjectId && projects.length > 0) { setIsSubmitting(false); return; }
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newTaskData, projectId: finalProjectId || null, parentId: null })
      });
      setNewTaskData({ title: "", startDate: new Date(), endDate: new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000), priority: "Normal", status: "Not Started", documentation: "", projectId: "" });
      setAddingRootTask(false);
      router.refresh();
    } catch (error) { console.error(error); } finally { setIsSubmitting(false); }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Are you sure you want to delete this task?")) return;
    try { await fetch(`/api/tasks/${taskId}`, { method: "DELETE" }); router.refresh(); } catch (error) { console.error(error); }
  };

  const priorityOptions = [
    { value: "Normal", label: "Normal" },
    { value: "Urgent", label: "Urgent" }
  ];

  const statusOptions = [
    { value: "Not Started", label: "Not Started" },
    { value: "Ongoing", label: "Ongoing" },
    { value: "Suspended", label: "Suspended" },
    { value: "Completed", label: "Completed" }
  ];

  const projectOptions = projects.length === 0 
    ? [{ value: "", label: "No project yet" }]
    : projects.map((p: any) => ({ value: p.id, label: p.name }));

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

  const safeTasks = tasks || [];
  const rootTasks = safeTasks.filter(t => !t.parentId);
  
  const tasksByProject: Record<string, { projectName: string; tasks: any[] }> = {};
  rootTasks.forEach(task => {
    const projectId = task.projectId || "unassigned";
    const projectName = task.project?.name || "No Project";
    if (!tasksByProject[projectId]) tasksByProject[projectId] = { projectName, tasks: [] };
    tasksByProject[projectId].tasks.push(task);
  });
  
  const getChildren = (parentId: string) => safeTasks.filter(t => t.parentId === parentId);

  const inputClass = "w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-800 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all";

  const renderStatus = (status: string) => {
    switch (status) {
      case "Completed":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200/60"><CheckCircle2 className="w-3 h-3" /> Completed</span>;
      case "Ongoing":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-200/60"><Clock className="w-3 h-3" /> Ongoing</span>;
      case "Suspended":
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold border border-amber-200/60"><PauseCircle className="w-3 h-3" /> Suspended</span>;
      default:
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold border border-gray-200/60"><AlertCircle className="w-3 h-3" /> Not Started</span>;
    }
  };

  const renderPriority = (priority: string) => {
    if (priority === "Urgent") {
      return <span className="text-red-700 font-semibold text-xs bg-red-50 px-2.5 py-1 rounded-full border border-red-200/60">{priority}</span>;
    }
    return <span className="text-gray-600 font-medium text-xs bg-gray-50 px-2.5 py-1 rounded-full border border-gray-200/60">{priority || "Normal"}</span>;
  };

  const renderRow = (task: any, level: number = 0) => {
    const children = getChildren(task.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedRows[task.id];

    return (
      <div key={task.id}>
        <div 
          className={`grid gap-3 items-center px-4 py-3 border-b border-gray-100/80 hover:bg-blue-50/30 transition-colors duration-150 ${level === 0 ? 'bg-white' : 'bg-gray-50/20'}`} 
          style={{ gridTemplateColumns: 'minmax(220px, 4fr) 2fr 2fr 2fr 2fr 2fr 1.5fr 2fr' }}
        >
          {/* Task Name - Editable */}
          <div className="flex items-center gap-2 group min-w-0">
            <div style={{ width: `${level * 1.5}rem` }} className="shrink-0" />
            {hasChildren ? (
              <button onClick={() => toggleRow(task.id)} className="p-1 hover:bg-gray-200/80 rounded-md text-gray-400 hover:text-gray-600 transition-colors shrink-0">
                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            ) : (
              <div className="w-6 shrink-0" />
            )}
            <div className={`flex-1 min-w-0 ${level === 0 ? 'font-semibold text-gray-900 text-sm' : 'font-medium text-gray-700 text-xs'}`}>
              <EditableText value={task.title} taskId={task.id} field="title" onSave={handleInlineUpdate} />
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button onClick={() => setAddingSubtask(task.id)} className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-all" title="Add Subtask">
                <Plus className="w-3 h-3" />
              </button>
              <button onClick={() => handleDeleteTask(task.id)} className="p-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-all" title="Delete Task">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>
          
          {/* Project */}
          <div className="text-xs text-gray-500 truncate" title={task.project?.name || "-"}>
            {task.project?.name || "-"}
          </div>

          {/* Start Date - Editable */}
          <div>
            <EditableDate value={task.startDate} taskId={task.id} field="startDate" onSave={handleInlineUpdate} />
          </div>
          
          {/* End Date - Editable */}
          <div>
            <EditableDate value={task.endDate} taskId={task.id} field="endDate" onSave={handleInlineUpdate} minDate={new Date(task.startDate)} />
          </div>

          {/* Priority - Editable */}
          <div className="flex items-center">
            <EditableSelect 
              value={task.priority || "Normal"} 
              taskId={task.id} 
              field="priority" 
              options={priorityOptions} 
              onSave={handleInlineUpdate} 
              renderDisplay={renderPriority} 
            />
          </div>

          {/* Executor - Editable (Multi) */}
          <div className="flex items-center">
            <EditableMultiSelect 
              value={task.executor || ""} 
              taskId={task.id} 
              field="executor" 
              options={getExecutorOptions(task.projectId)} 
              onSave={handleInlineUpdate} 
            />
          </div>

          {/* Docs - Editable */}
          <div className="flex items-center justify-center">
            <EditableUrl value={task.documentation} taskId={task.id} onSave={handleInlineUpdate} />
          </div>

          {/* Status - Editable */}
          <div className="flex items-center justify-end">
            <EditableSelect 
              value={task.status} 
              taskId={task.id} 
              field="status" 
              options={statusOptions} 
              onSave={handleInlineUpdate} 
              renderDisplay={renderStatus} 
            />
          </div>
        </div>
        
        {/* ── Inline Subtask Form ── */}
        {addingSubtask === task.id && (
          <div className="border-b border-blue-100 bg-gradient-to-r from-blue-50/60 to-indigo-50/40 px-4 py-3">
            <div className="flex items-center gap-2 mb-3">
              <div style={{ width: `${(level + 1) * 1.5}rem` }} className="shrink-0" />
              <div className="w-4 shrink-0 border-l-2 border-b-2 border-blue-300 rounded-bl-md h-4 -mt-2" />
              <input autoFocus type="text" placeholder="Sub-task name..." className={`flex-1 ${inputClass}`}
                value={newTaskData.title} onChange={(e) => setNewTaskData({...newTaskData, title: e.target.value})}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubtask(task.id, task.projectId); if (e.key === 'Escape') setAddingSubtask(null); }}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2 ml-0 md:ml-12">
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Start</label>
                <DatePicker selected={newTaskData.startDate} onChange={(date: Date | null) => date && setNewTaskData({...newTaskData, startDate: date})} dateFormat="dd MMM yyyy" className={inputClass} wrapperClassName="w-full" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">End</label>
                <DatePicker selected={newTaskData.endDate} onChange={(date: Date | null) => date && setNewTaskData({...newTaskData, endDate: date})} dateFormat="dd MMM yyyy" minDate={newTaskData.startDate} className={inputClass} wrapperClassName="w-full" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Priority</label>
                <ModernSelect options={priorityOptions} value={newTaskData.priority} onChange={(val) => setNewTaskData({...newTaskData, priority: val})} className="w-full" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Docs URL</label>
                <input type="url" placeholder="https://..." className={inputClass} value={newTaskData.documentation} onChange={(e) => setNewTaskData({...newTaskData, documentation: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Status</label>
                <ModernSelect options={statusOptions} value={newTaskData.status} onChange={(val) => setNewTaskData({...newTaskData, status: val})} className="w-full" />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Executor</label>
                <div className="flex flex-wrap gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2 py-1.5 min-h-[36px]">
                  {getExecutorOptions(task.projectId).map((opt: any) => {
                    const selected = (newTaskData.executor || "").split(", ").filter(Boolean);
                    const isChecked = selected.includes(opt.value);
                    return (
                      <label key={opt.value} className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full cursor-pointer transition-all border ${
                        isChecked ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-100"
                      }`}>
                        <input type="checkbox" checked={isChecked} className="hidden" onChange={() => {
                          const arr = selected.filter(Boolean);
                          const next = isChecked ? arr.filter(n => n !== opt.value) : [...arr, opt.value];
                          setNewTaskData({...newTaskData, executor: next.join(", ")});
                        }} />
                        {opt.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-3 pt-3 border-t border-blue-100/60">
              <button onClick={() => setAddingSubtask(null)} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs text-gray-500 font-medium hover:text-gray-700 hover:bg-white rounded-lg transition-all">
                <XCircle className="w-3.5 h-3.5" /> Cancel
              </button>
              <button onClick={() => handleAddSubtask(task.id, task.projectId)} disabled={isSubmitting || !newTaskData.title.trim()}
                className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-5 py-2 text-xs rounded-lg font-semibold hover:shadow-lg hover:shadow-blue-500/25 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 transition-all">
                {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save Sub-task
              </button>
            </div>
          </div>
        )}

        {/* Render Children */}
        {hasChildren && isExpanded && (
          <div className="animate-in slide-in-from-top-2 duration-200">
            {children.map(child => renderRow(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="overflow-hidden flex flex-col h-full bg-white rounded-xl shadow-sm border border-gray-200/60">
      <div className="overflow-x-auto flex-1 flex flex-col">
        <div className="min-w-[1000px] flex-1 flex flex-col">
          {/* ═══ Table Header ═══ */}
          <div className="grid gap-3 px-4 py-3.5 border-b-2 border-gray-200 bg-gray-50/90 text-[11px] uppercase tracking-wider font-bold text-gray-500 select-none sticky top-0 z-10"
            style={{ gridTemplateColumns: 'minmax(220px, 4fr) 2fr 2fr 2fr 2fr 2fr 1.5fr 2fr' }}>
            <div className="pl-8">Task Name</div>
            <div>Project</div>
            <div>Start Date</div>
            <div>End Date</div>
            <div>Priority</div>
            <div>Executor</div>
            <div className="text-center">Docs</div>
            <div className="text-right">Status</div>
          </div>
          
          {/* Table Body */}
          <div className="flex-1 bg-white">
            {/* ── Add New Task Row ── */}
            {!addingRootTask && (
              <div className="flex items-center gap-2 px-4 py-3 border-b border-dashed border-gray-200 hover:bg-blue-50/40 cursor-pointer text-gray-400 hover:text-blue-600 transition-all group"
                onClick={() => setAddingRootTask(true)}>
                <div className="pl-8 flex items-center gap-2 text-xs font-medium">
                  <div className="p-1 rounded-md bg-blue-50 text-blue-500 group-hover:bg-blue-100 transition-colors"><Plus className="w-3.5 h-3.5" /></div>
                  Add New Task
                </div>
              </div>
            )}
            
            {/* ── Inline Root Task Form ── */}
            {addingRootTask && (
              <div className="border-b-2 border-blue-200 bg-gradient-to-r from-blue-50/70 to-indigo-50/50 px-4 py-4">
                <div className="flex items-start gap-3 mb-3">
                  <div className="flex-[3]">
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Task Name</label>
                    <input autoFocus type="text" placeholder="Enter task name..." className={inputClass}
                      value={newTaskData.title} onChange={(e) => setNewTaskData({...newTaskData, title: e.target.value})}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleAddRootTask(); if (e.key === 'Escape') setAddingRootTask(false); }} />
                  </div>
                  <div className="flex-[2]">
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Project</label>
                    <ModernSelect options={projectOptions} value={newTaskData.projectId || (selectedProjectId !== "all" ? selectedProjectId : projects[0]?.id || "")}
                      onChange={(val) => setNewTaskData({...newTaskData, projectId: val})} className="w-full" />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5"><CalendarDays className="w-3 h-3 inline mr-1 -mt-0.5" />Start</label>
                    <DatePicker selected={newTaskData.startDate} onChange={(date: Date | null) => date && setNewTaskData({...newTaskData, startDate: date})} dateFormat="dd MMM yyyy" className={inputClass} wrapperClassName="w-full" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5"><CalendarDays className="w-3 h-3 inline mr-1 -mt-0.5" />End</label>
                    <DatePicker selected={newTaskData.endDate} onChange={(date: Date | null) => date && setNewTaskData({...newTaskData, endDate: date})} dateFormat="dd MMM yyyy" minDate={newTaskData.startDate} className={inputClass} wrapperClassName="w-full" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Priority</label>
                    <ModernSelect options={priorityOptions} value={newTaskData.priority} onChange={(val) => setNewTaskData({...newTaskData, priority: val})} className="w-full" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5"><Link2 className="w-3 h-3 inline mr-1 -mt-0.5" />Docs URL</label>
                    <input type="url" placeholder="https://..." className={inputClass} value={newTaskData.documentation} onChange={(e) => setNewTaskData({...newTaskData, documentation: e.target.value})} />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Status</label>
                    <ModernSelect options={statusOptions} value={newTaskData.status} onChange={(val) => setNewTaskData({...newTaskData, status: val})} className="w-full" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Executor</label>
                    <div className="flex flex-wrap gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-2 py-1.5 min-h-[36px]">
                      {getExecutorOptions(newTaskData.projectId).map((opt: any) => {
                        const selected = (newTaskData.executor || "").split(", ").filter(Boolean);
                        const isChecked = selected.includes(opt.value);
                        return (
                          <label key={opt.value} className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-full cursor-pointer transition-all border ${
                            isChecked ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-white text-gray-500 border-gray-200 hover:bg-gray-100"
                          }`}>
                            <input type="checkbox" checked={isChecked} className="hidden" onChange={() => {
                              const arr = selected.filter(Boolean);
                              const next = isChecked ? arr.filter(n => n !== opt.value) : [...arr, opt.value];
                              setNewTaskData({...newTaskData, executor: next.join(", ")});
                            }} />
                            {opt.label}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-blue-100/60">
                  <button onClick={() => setAddingRootTask(false)} className="inline-flex items-center gap-1.5 px-4 py-2 text-xs text-gray-500 font-medium hover:text-gray-700 hover:bg-white rounded-lg transition-all">
                    <XCircle className="w-3.5 h-3.5" /> Cancel
                  </button>
                  <button onClick={handleAddRootTask} disabled={isSubmitting || !newTaskData.title.trim()}
                    className="inline-flex items-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2 text-xs rounded-lg font-semibold hover:shadow-lg hover:shadow-blue-500/25 hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0 transition-all">
                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save Task
                  </button>
                </div>
              </div>
            )}
            
            {rootTasks.length > 0 ? (
              Object.values(tasksByProject).map((group, idx) => (
                <div key={group.projectName}>
                  <div className={`flex items-center gap-3 px-5 py-2.5 bg-slate-50 border-b border-slate-200 ${idx > 0 ? 'border-t-2 border-t-slate-200 mt-1' : ''}`}>
                    <div className="w-1 h-5 rounded-full bg-gradient-to-b from-blue-500 to-indigo-500" />
                    <span className="font-semibold text-slate-700 text-sm">{group.projectName}</span>
                    <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-200 shadow-sm uppercase tracking-wider">
                      {group.tasks.length} task{group.tasks.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  {group.tasks.map(task => renderRow(task, 0))}
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center text-gray-500 py-20">
                <div className="p-5 bg-gray-50 rounded-2xl mb-4"><Table2 className="w-10 h-10 text-gray-300" /></div>
                <p className="font-semibold text-gray-600 text-lg">No task data yet</p>
                <p className="text-sm text-gray-400 mt-1">Click "+ Add New Task" above to start.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
