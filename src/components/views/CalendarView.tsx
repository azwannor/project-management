"use client";

import { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  CheckCircle2,
  Circle,
  AlertCircle,
  Zap,
  X,
  Folder,
  User,
  FileText,
} from "lucide-react";

interface CalendarViewProps {
  tasks: any[];
  projects?: any[];
}

// ─── Helpers ────────────────────────────────────────────────
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function isToday(d: Date) {
  return isSameDay(d, new Date());
}
function formatShort(d: Date) {
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; dot: string; icon: any }> = {
  "Not Started": {
    color: "text-slate-600",
    bg: "bg-slate-50",
    border: "border-slate-200",
    dot: "bg-slate-400",
    icon: Circle,
  },
  Ongoing: {
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    dot: "bg-blue-500",
    icon: Clock,
  },
  Completed: {
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
    icon: CheckCircle2,
  },
};

const PRIORITY_BADGE: Record<string, { bg: string; text: string }> = {
  "Butuh Cepat": { bg: "bg-red-50 border-red-200", text: "text-red-700" },
  Normal: { bg: "bg-gray-50 border-gray-200", text: "text-gray-600" },
};

// Curated colors for project timeline bars
const PROJECT_COLORS = [
  { bg: "bg-blue-500", light: "bg-blue-100", text: "text-blue-800", border: "border-blue-300" },
  { bg: "bg-indigo-500", light: "bg-indigo-100", text: "text-indigo-800", border: "border-indigo-300" },
  { bg: "bg-violet-500", light: "bg-violet-100", text: "text-violet-800", border: "border-violet-300" },
  { bg: "bg-emerald-500", light: "bg-emerald-100", text: "text-emerald-800", border: "border-emerald-300" },
  { bg: "bg-amber-500", light: "bg-amber-100", text: "text-amber-800", border: "border-amber-300" },
  { bg: "bg-rose-500", light: "bg-rose-100", text: "text-rose-800", border: "border-rose-300" },
  { bg: "bg-cyan-500", light: "bg-cyan-100", text: "text-cyan-800", border: "border-cyan-300" },
  { bg: "bg-orange-500", light: "bg-orange-100", text: "text-orange-800", border: "border-orange-300" },
];

const WEEKDAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

// ─── Main Component ─────────────────────────────────────────
export default function CalendarView({ tasks, projects = [] }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [detailTask, setDetailTask] = useState<any>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => { setCurrentDate(new Date()); setSelectedDate(new Date()); };

  // ─── Build calendar grid ───────────────────────────────
  const calendarDays = useMemo(() => {
    const firstDay = startOfMonth(currentDate);
    const lastDay = endOfMonth(currentDate);
    // Monday-based: getDay() returns 0=Sun, we want 0=Mon
    let startWeekday = firstDay.getDay() - 1;
    if (startWeekday < 0) startWeekday = 6; // Sunday becomes 6

    const days: { date: Date; isCurrentMonth: boolean }[] = [];

    // Fill leading days from previous month
    for (let i = startWeekday - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, isCurrentMonth: false });
    }
    // Current month
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ date: new Date(year, month, d), isCurrentMonth: true });
    }
    // Fill trailing days
    while (days.length % 7 !== 0) {
      const lastDate = days[days.length - 1].date;
      const next = new Date(lastDate);
      next.setDate(next.getDate() + 1);
      days.push({ date: next, isCurrentMonth: false });
    }

    return days;
  }, [currentDate, year, month]);

  // ─── Map tasks to dates ────────────────────────────────
  const tasksByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    tasks.forEach((task) => {
      const start = new Date(task.startDate);
      const end = new Date(task.endDate);
      // Add task to every day it spans
      const cursor = new Date(start);
      cursor.setHours(0, 0, 0, 0);
      const endNorm = new Date(end);
      endNorm.setHours(0, 0, 0, 0);
      while (cursor <= endNorm) {
        const key = `${cursor.getFullYear()}-${cursor.getMonth()}-${cursor.getDate()}`;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(task);
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return map;
  }, [tasks]);

  const getTasksForDate = (d: Date) => {
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    return tasksByDate.get(key) || [];
  };

  // ─── Deadline tasks (ending on date) ──────────────────
  const getDeadlinesForDate = (d: Date) => {
    return tasks.filter((t) => {
      const end = new Date(t.endDate);
      return isSameDay(end, d);
    });
  };

  // ─── Project color map ─────────────────────────────────
  const projectColorMap = useMemo(() => {
    const map = new Map<string, (typeof PROJECT_COLORS)[0]>();
    projects.forEach((p, i) => {
      map.set(p.id, PROJECT_COLORS[i % PROJECT_COLORS.length]);
    });
    return map;
  }, [projects]);

  // ─── Selected date tasks ──────────────────────────────
  const selectedTasks = selectedDate ? getTasksForDate(selectedDate) : [];
  const selectedDeadlines = selectedDate ? getDeadlinesForDate(selectedDate) : [];

  // ─── Month Stats ──────────────────────────────────────
  const monthStats = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    let totalInMonth = 0;
    let completedInMonth = 0;
    let overdueInMonth = 0;
    const now = new Date();

    tasks.forEach((t) => {
      const tStart = new Date(t.startDate);
      const tEnd = new Date(t.endDate);
      // Task overlaps this month
      if (tStart <= monthEnd && tEnd >= monthStart) {
        totalInMonth++;
        if (t.status === "Completed") completedInMonth++;
        if (t.status !== "Completed" && tEnd < now) overdueInMonth++;
      }
    });
    return { totalInMonth, completedInMonth, overdueInMonth };
  }, [tasks, currentDate]);

  const monthLabel = currentDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-[600px]">
      {/* ══════════════ LEFT: Calendar Grid ══════════════ */}
      <div className="flex-1 flex flex-col p-4 lg:p-6 overflow-auto">
        {/* Header / Navigation */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-bold text-gray-900 capitalize">{monthLabel}</h2>
            <div className="flex items-center gap-4 mt-1.5">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full">
                <CalendarIcon className="w-3 h-3" /> {monthStats.totalInMonth} Tasks
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full">
                <CheckCircle2 className="w-3 h-3" /> {monthStats.completedInMonth} Done
              </span>
              {monthStats.overdueInMonth > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                  <AlertCircle className="w-3 h-3" /> {monthStats.overdueInMonth} Overdue
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goToday}
              className="px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
            >
              Today
            </button>
            <button
              onClick={prevMonth}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={nextMonth}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map((day, i) => (
            <div
              key={day}
              className={`text-center text-[10px] font-bold uppercase tracking-widest py-2 ${
                i >= 5 ? "text-red-400" : "text-gray-400"
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 flex-1 border border-gray-200 rounded-xl overflow-hidden bg-white">
          {calendarDays.map((cell, idx) => {
            const dateTasks = getTasksForDate(cell.date);
            const deadlines = getDeadlinesForDate(cell.date);
            const isSelected = selectedDate && isSameDay(cell.date, selectedDate);
            const today = isToday(cell.date);
            const dayOfWeek = cell.date.getDay();
            const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

            return (
              <div
                key={idx}
                onClick={() => setSelectedDate(cell.date)}
                className={`
                  relative min-h-[90px] border-b border-r border-gray-100 p-1.5 cursor-pointer transition-all group
                  ${!cell.isCurrentMonth ? "bg-gray-50/70" : isWeekend ? "bg-orange-50/20" : "bg-white"}
                  ${isSelected ? "ring-2 ring-blue-500 ring-inset bg-blue-50/40 z-10" : ""}
                  ${!isSelected ? "hover:bg-blue-50/30" : ""}
                `}
              >
                {/* Date Number */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`
                      inline-flex items-center justify-center w-7 h-7 text-xs font-bold rounded-full transition-colors
                      ${today ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30" : ""}
                      ${!today && cell.isCurrentMonth ? "text-gray-800" : ""}
                      ${!today && !cell.isCurrentMonth ? "text-gray-300" : ""}
                    `}
                  >
                    {cell.date.getDate()}
                  </span>
                  {deadlines.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Deadline" />
                  )}
                </div>

                {/* Task Dots / Mini Bars */}
                <div className="space-y-0.5 overflow-hidden">
                  {dateTasks.slice(0, 3).map((task, i) => {
                    const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG["Not Started"];
                    const projColor = task.projectId
                      ? projectColorMap.get(task.projectId)
                      : null;
                    const isDeadline = isSameDay(new Date(task.endDate), cell.date);
                    const isStart = isSameDay(new Date(task.startDate), cell.date);

                    return (
                      <div
                        key={task.id + "-" + i}
                        onClick={(e) => { e.stopPropagation(); setDetailTask(task); setSelectedDate(cell.date); }}
                        className={`
                          flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium truncate cursor-pointer transition-all
                          ${projColor ? `${projColor.light} ${projColor.text} border ${projColor.border}` : `${cfg.bg} ${cfg.color} border ${cfg.border}`}
                          hover:opacity-80 hover:shadow-sm
                        `}
                        title={task.title}
                      >
                        {isStart && <span className="w-1 h-1 rounded-full bg-current shrink-0 opacity-60" />}
                        {isDeadline && <Zap className="w-2.5 h-2.5 text-red-500 shrink-0" />}
                        <span className="truncate">{task.title}</span>
                      </div>
                    );
                  })}
                  {dateTasks.length > 3 && (
                    <div className="text-[9px] text-gray-400 font-bold pl-1.5">
                      +{dateTasks.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Project Timeline Legend */}
        {projects.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {projects.map((p) => {
              const c = projectColorMap.get(p.id);
              if (!c) return null;
              return (
                <div key={p.id} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span className={`w-3 h-3 rounded ${c.bg}`} />
                  <span className="font-medium">{p.name}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══════════════ RIGHT: Detail Sidebar ══════════════ */}
      <div className="lg:w-80 xl:w-96 border-t lg:border-t-0 lg:border-l border-gray-200 bg-white flex flex-col overflow-hidden">
        {selectedDate ? (
          <>
            {/* Sidebar Header */}
            <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-slate-50 to-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Selected Date</p>
                  <h3 className="text-lg font-bold text-gray-900 mt-0.5">
                    {selectedDate.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </h3>
                </div>
                <button
                  onClick={() => { setSelectedDate(null); setDetailTask(null); }}
                  className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {isToday(selectedDate) && (
                <span className="inline-block mt-2 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Today
                </span>
              )}
            </div>

            {/* Task List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {selectedTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-14 h-14 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                    <CalendarIcon className="w-7 h-7 text-gray-300" />
                  </div>
                  <p className="text-sm font-semibold text-gray-500">No tasks on this date</p>
                  <p className="text-xs text-gray-400 mt-1">Select another date to see tasks</p>
                </div>
              ) : (
                selectedTasks.map((task) => {
                  const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG["Not Started"];
                  const StatusIcon = cfg.icon;
                  const priBadge = PRIORITY_BADGE[task.priority] || PRIORITY_BADGE["Normal"];
                  const projColor = task.projectId ? projectColorMap.get(task.projectId) : null;
                  const isActive = detailTask?.id === task.id;
                  const isDeadlineDay = isSameDay(new Date(task.endDate), selectedDate);
                  const isOverdue = task.status !== "Completed" && new Date(task.endDate) < new Date();

                  return (
                    <div
                      key={task.id}
                      onClick={() => setDetailTask(isActive ? null : task)}
                      className={`
                        rounded-xl border cursor-pointer transition-all duration-200
                        ${isActive 
                          ? `${projColor ? `${projColor.light} ${projColor.border}` : "bg-blue-50 border-blue-200"} shadow-sm` 
                          : "bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm"}
                      `}
                    >
                      {/* Task Card Header */}
                      <div className="p-3">
                        <div className="flex items-start gap-2.5">
                          {/* Status Icon */}
                          <div className={`mt-0.5 p-1 rounded-lg ${cfg.bg}`}>
                            <StatusIcon className={`w-3.5 h-3.5 ${cfg.color}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-bold text-gray-900 truncate">{task.title}</h4>
                              {isDeadlineDay && (
                                <span className="shrink-0 text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded-full uppercase">
                                  Deadline
                                </span>
                              )}
                              {isOverdue && (
                                <span className="shrink-0 text-[9px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full uppercase">
                                  Overdue
                                </span>
                              )}
                            </div>

                            {/* Meta line */}
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${priBadge.bg} ${priBadge.text}`}>
                                {task.priority === "Butuh Cepat" && <Zap className="w-2.5 h-2.5" />}
                                {task.priority}
                              </span>
                              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                {task.status}
                              </span>
                            </div>

                            {/* Date range */}
                            <div className="flex items-center gap-1.5 mt-2 text-[10px] text-gray-500 font-medium">
                              <Clock className="w-3 h-3" />
                              {formatShort(new Date(task.startDate))} — {formatShort(new Date(task.endDate))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Details */}
                      {isActive && (
                        <div className="px-3 pb-3 space-y-2 border-t border-gray-100/80 pt-2.5">
                          {task.project && (
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <Folder className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              <span className="font-medium">{task.project.name}</span>
                            </div>
                          )}
                          {task.executor && (
                            <div className="flex items-center gap-2 text-xs text-gray-600">
                              <User className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              <span>{task.executor}</span>
                            </div>
                          )}
                          {task.issue && (
                            <div className="flex items-start gap-2 text-xs text-gray-600">
                              <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                              <div>
                                <p className="font-semibold text-red-600 text-[10px] uppercase tracking-wider mb-0.5">Issue</p>
                                <p className="text-gray-700 leading-relaxed">{task.issue}</p>
                              </div>
                            </div>
                          )}
                          {task.solution && (
                            <div className="flex items-start gap-2 text-xs text-gray-600">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                              <div>
                                <p className="font-semibold text-emerald-600 text-[10px] uppercase tracking-wider mb-0.5">Solution</p>
                                <p className="text-gray-700 leading-relaxed">{task.solution}</p>
                              </div>
                            </div>
                          )}
                          {task.documentation && (
                            <div className="flex items-center gap-2 text-xs">
                              <FileText className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                              <a
                                href={task.documentation}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline truncate font-medium"
                              >
                                Documentation Link
                              </a>
                            </div>
                          )}
                          {/* Progress bar (visual days progress) */}
                          {(() => {
                            const start = new Date(task.startDate).getTime();
                            const end = new Date(task.endDate).getTime();
                            const now = new Date().getTime();
                            const totalDuration = end - start;
                            const elapsed = Math.min(now - start, totalDuration);
                            const pct = totalDuration > 0 ? Math.max(0, Math.round((elapsed / totalDuration) * 100)) : 0;
                            return (
                              <div className="pt-1">
                                <div className="flex items-center justify-between text-[10px] font-semibold text-gray-400 mb-1">
                                  <span>Timeline Progress</span>
                                  <span className={task.status === "Completed" ? "text-emerald-600" : "text-blue-600"}>{task.status === "Completed" ? "100" : pct}%</span>
                                </div>
                                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all duration-700 ${
                                      task.status === "Completed" ? "bg-emerald-500" : isOverdue ? "bg-red-500" : "bg-blue-500"
                                    }`}
                                    style={{ width: `${task.status === "Completed" ? 100 : pct}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Sidebar Footer Stats */}
            {selectedTasks.length > 0 && (
              <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500 font-medium">{selectedTasks.length} task(s)</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {selectedTasks.filter((t) => t.status === "Completed").length}
                    </span>
                    <span className="flex items-center gap-1 text-blue-600 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                      {selectedTasks.filter((t) => t.status === "Ongoing").length}
                    </span>
                    <span className="flex items-center gap-1 text-gray-500 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                      {selectedTasks.filter((t) => t.status === "Not Started").length}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Empty state when no date selected */
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
              <CalendarIcon className="w-8 h-8 text-blue-400" />
            </div>
            <h3 className="text-base font-bold text-gray-800">Select a Date</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-[200px] leading-relaxed">
              Click any day on the calendar to view tasks, deadlines, and project details.
            </p>

            {/* Quick upcoming deadlines */}
            {(() => {
              const now = new Date();
              now.setHours(0, 0, 0, 0);
              const upcoming = tasks
                .filter((t) => {
                  const end = new Date(t.endDate);
                  end.setHours(0, 0, 0, 0);
                  return t.status !== "Completed" && end >= now;
                })
                .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())
                .slice(0, 5);

              if (upcoming.length === 0) return null;

              return (
                <div className="mt-6 w-full text-left">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2.5 px-1">
                    Upcoming Deadlines
                  </p>
                  <div className="space-y-1.5">
                    {upcoming.map((t) => {
                      const end = new Date(t.endDate);
                      const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                      const cfg = STATUS_CONFIG[t.status] || STATUS_CONFIG["Not Started"];

                      return (
                        <div
                          key={t.id}
                          onClick={() => { setSelectedDate(end); setDetailTask(t); }}
                          className="flex items-center gap-2.5 p-2.5 bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm cursor-pointer transition-all"
                        >
                          <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">{t.title}</p>
                            <p className="text-[10px] text-gray-400 mt-0.5">{formatShort(end)}</p>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                            diff <= 2 ? "bg-red-50 text-red-600" : diff <= 7 ? "bg-amber-50 text-amber-600" : "bg-gray-50 text-gray-500"
                          }`}>
                            {diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : `${diff}d`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
