"use client";

import { useMemo, useState } from "react";
import { FolderKanban, CheckSquare, Headset, Users, Activity, Clock, BarChart3, TrendingUp, Calendar, AlertCircle, Wrench } from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { startOfDay, startOfWeek, startOfMonth, formatDistanceToNow, format } from "date-fns";

export default function DashboardClient({ 
  currentUser, projects, tasks, supportTickets, users, maintenanceSchedules = [], assets = [] 
}: { 
  currentUser: any, projects: any[], tasks: any[], supportTickets: any[], users: any[],
  maintenanceSchedules?: any[], assets?: any[]
}) {
  const [timeRange, setTimeRange] = useState("ALL"); // ALL, TODAY, WEEK, MONTH

  const filterByDate = (items: any[], dateField: string = "createdAt") => {
    if (timeRange === "ALL") return items;
    const now = new Date();
    
    return items.filter(item => {
      const itemDate = new Date(item[dateField] || item.updatedAt);
      if (timeRange === "TODAY") return itemDate >= startOfDay(now);
      if (timeRange === "WEEK") return itemDate >= startOfWeek(now, { weekStartsOn: 1 });
      if (timeRange === "MONTH") return itemDate >= startOfMonth(now);
      return true;
    });
  }

  const filteredProjects = useMemo(() => filterByDate(projects, "createdAt"), [projects, timeRange]);
  const filteredTasks = useMemo(() => filterByDate(tasks, "createdAt"), [tasks, timeRange]);
  const filteredTickets = useMemo(() => filterByDate(supportTickets, "createdAt"), [supportTickets, timeRange]);

  const stats = useMemo(() => {
    return {
      projects: filteredProjects.length,
      tasks: filteredTasks.length,
      tickets: filteredTickets.length,
      users: users.length,
    };
  }, [filteredProjects, filteredTasks, filteredTickets, users]);

  // Support Tickets by Category
  const ticketsByCategory = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredTickets.forEach(t => {
      // Use supportType as category
      const category = t.supportType || "Uncategorized";
      counts[category] = (counts[category] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredTickets]);

  // Agent Performance (Tickets completed per user)
  const agentPerformance = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredTickets.forEach(t => {
      if (t.status === "Done" || t.status === "Completed") {
        if (t.executors && Array.isArray(t.executors) && t.executors.length > 0) {
           t.executors.forEach((ex: any) => {
             counts[ex.name] = (counts[ex.name] || 0) + 1;
           });
        } else {
           // Fallback to creator if no executor assigned (though rare for 'Done' tickets)
           const user = users.find(u => u.id === t.userId);
           if (user) counts[user.name] = (counts[user.name] || 0) + 1;
        }
      }
    });
    return Object.entries(counts).map(([name, completed]) => ({ name, completed })).sort((a, b) => b.completed - a.completed).slice(0, 5);
  }, [filteredTickets, users]);

  // Resource Allocation (Active Tasks per user)
  const resourceAllocation = useMemo(() => {
     const counts: Record<string, number> = {};
     filteredTasks.forEach(t => {
       if (t.status !== "Completed") {
         const user = users.find(u => u.id === t.userId);
         if (user) counts[user.name] = (counts[user.name] || 0) + 1;
       }
     });
     return Object.entries(counts).map(([name, activeTasks]) => ({ name, activeTasks })).sort((a, b) => b.activeTasks - a.activeTasks).slice(0, 5);
  }, [filteredTasks, users]);

  // Recent Activity Stream
  const recentActivities = useMemo(() => {
    const allTasks = filteredTasks.map(t => ({ 
      id: t.id, 
      type: 'Task', 
      time: new Date(t.updatedAt || t.createdAt), 
      titleStr: t.title,
      status: t.status,
      priority: t.priority
    }));
    const allTickets = filteredTickets.map(t => ({ 
      id: t.id, 
      type: 'Ticket', 
      time: new Date(t.updatedAt || t.createdAt), 
      titleStr: t.taskName || t.issue || "Support Ticket",
      status: t.status,
      priority: t.priority
    }));
    
    return [...allTasks, ...allTickets]
      .sort((a, b) => b.time.getTime() - a.time.getTime())
      .slice(0, 8);
  }, [filteredTasks, filteredTickets]);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  const StatCard = ({ title, value, icon: Icon, trend }: any) => (
    <div className="bg-white border border-slate-200 p-5 flex flex-col gap-3 rounded-xl shadow-sm hover:border-slate-300 hover:shadow-md transition-all">
      <div className="flex justify-between items-start">
        <p className="text-slate-500 font-medium text-xs tracking-wider uppercase">{title}</p>
        <div className="p-2 bg-slate-50 rounded-lg">
          <Icon className="w-5 h-5 text-slate-500" />
        </div>
      </div>
      <div className="flex items-end gap-3">
        <h3 className="text-3xl font-bold text-slate-800 font-mono">{value}</h3>
        {trend && <span className="text-emerald-500 text-xs font-semibold mb-1 flex items-center"><TrendingUp className="w-3 h-3 mr-1"/>{trend}</span>}
      </div>
    </div>
  );

  return (
    <div className="text-slate-800 -m-6 md:-m-10 p-6 md:p-8 font-sans">
      
      {/* Filter */}
      <div className="flex justify-end mb-6">
        <div className="flex items-center bg-white p-1.5 rounded-xl border border-slate-200 shadow-sm">
          {["ALL", "MONTH", "WEEK", "TODAY"].map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                timeRange === range 
                  ? "bg-slate-100 text-slate-900 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Total Projects" value={stats.projects} icon={FolderKanban} trend="+2%" />
        <StatCard title="Active Tasks" value={stats.tasks} icon={CheckSquare} trend="+12%" />
        <StatCard title="Support Logs" value={stats.tickets} icon={Headset} trend="+5%" />
        <StatCard title="Team Members" value={stats.users} icon={Users} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* LEFT COL: PROJECT & TASKS */}
        <div className="lg:col-span-2 space-y-6">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Resource Allocation */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-6 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                Task Allocation (Workload)
              </h3>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={resourceAllocation} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
                    <XAxis type="number" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} width={80} />
                    <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                    <Bar dataKey="activeTasks" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Agent Performance */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-6 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Support Performance
              </h3>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={agentPerformance} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                    <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                    <Bar dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Tickets By Category */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-6 flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-500" />
              Support Issues by Category
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ticketsByCategory} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                  <RechartsTooltip contentStyle={{backgroundColor: '#ffffff', borderColor: '#e2e8f0', color: '#0f172a', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Area type="monotone" dataKey="value" stroke="#8b5cf6" fillOpacity={1} fill="url(#colorValue)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* RIGHT COL: ACTIVITY STREAM & NOTIFS */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col h-full">
            <div className="p-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4 text-orange-500" />
                Live Activity Stream
              </h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-2">
              {recentActivities.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-sm">No recent activity found.</div>
              ) : (
                <div className="space-y-1">
                  {recentActivities.map((activity, idx) => (
                    <div key={`${activity.id}-${idx}`} className="p-3 hover:bg-slate-50 rounded-lg transition-colors flex gap-3 group border border-transparent hover:border-slate-100">
                      <div className="mt-1">
                        {activity.type === 'Task' ? (
                          <div className="p-1.5 bg-blue-50 text-blue-500 rounded-md">
                            <CheckSquare className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="p-1.5 bg-emerald-50 text-emerald-500 rounded-md">
                            <Headset className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border uppercase tracking-wider ${
                            activity.type === 'Task' ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          }`}>
                            {activity.type}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap">
                            {formatDistanceToNow(activity.time, { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm text-slate-700 truncate font-semibold group-hover:text-slate-900 transition-colors">{activity.titleStr}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              activity.status === 'Completed' || activity.status === 'Done' ? 'bg-emerald-500' :
                              activity.status === 'Ongoing' ? 'bg-blue-500' : 'bg-slate-300'
                            }`}></span>
                            {activity.status}
                          </span>
                          {activity.priority && (
                            <span className="text-[10px] font-bold uppercase text-slate-400 border border-slate-200 px-1.5 py-0.5 rounded-md">
                              {activity.priority}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* Maintenance Section */}
      {maintenanceSchedules.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-blue-600" /> Maintenance Overview
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Compliance Rate */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Compliance Rate</p>
              {(() => {
                const done = maintenanceSchedules.filter((s: any) => s.status === "DONE");
                const onTime = done.filter((s: any) => {
                  const log = s.logs?.[0];
                  if (!log) return false;
                  return new Date(log.executionDate) <= new Date(s.nextDueDate);
                });
                const rate = done.length > 0 ? Math.round((onTime.length / done.length) * 100) : 0;
                return (
                  <div>
                    <div className="flex items-end gap-2 mb-3">
                      <span className="text-4xl font-bold text-slate-800 font-mono">{rate}%</span>
                      <span className="text-xs text-slate-400 mb-1">{onTime.length}/{done.length} tepat waktu</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5">
                      <div className="bg-emerald-500 h-2.5 rounded-full transition-all" style={{ width: `${rate}%` }}></div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Upcoming Maintenance */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Upcoming (7 Hari)</p>
              {(() => {
                const now = new Date();
                const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                const upcoming = maintenanceSchedules.filter((s: any) =>
                  s.status !== "DONE" && new Date(s.nextDueDate) <= in7
                ).sort((a: any, b: any) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime()).slice(0, 5);
                return upcoming.length === 0 ? (
                  <p className="text-sm text-slate-400">Tidak ada jadwal dalam 7 hari ke depan</p>
                ) : (
                  <div className="space-y-2">
                    {upcoming.map((s: any) => (
                      <div key={s.id} className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{s.asset?.assetName}</p>
                          <p className="text-[10px] text-slate-400">{s.template?.templateName || "Ad-hoc"}</p>
                        </div>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          s.status === "OVERDUE" ? "bg-red-100 text-red-700 border-red-200" :
                          s.status === "DUE" ? "bg-amber-100 text-amber-700 border-amber-200" :
                          "bg-blue-100 text-blue-700 border-blue-200"
                        }`}>
                          {new Date(s.nextDueDate).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                        </span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            {/* Asset Status */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Aset per Status</p>
              {(() => {
                const counts: Record<string, number> = { ACTIVE: 0, IN_REPAIR: 0, INACTIVE: 0, RETIRED: 0 };
                assets.forEach((a: any) => { counts[a.status] = (counts[a.status] || 0) + 1; });
                const colors: Record<string, string> = { ACTIVE: "bg-emerald-500", IN_REPAIR: "bg-amber-500", INACTIVE: "bg-slate-400", RETIRED: "bg-red-500" };
                const total = assets.length || 1;
                return (
                  <div className="space-y-2">
                    {Object.entries(counts).map(([status, count]) => (
                      <div key={status}>
                        <div className="flex justify-between text-xs mb-0.5">
                          <span className="font-medium text-slate-600">{status}</span>
                          <span className="font-bold text-slate-800">{count}</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5">
                          <div className={`${colors[status]} h-1.5 rounded-full transition-all`} style={{ width: `${(count / total) * 100}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
