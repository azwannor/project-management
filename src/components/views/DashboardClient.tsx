"use client";

import { useMemo } from "react";
import { FolderKanban, CheckSquare, Headset, Users, Activity } from "lucide-react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

export default function DashboardClient({ 
  currentUser, projects, tasks, supportTickets, users 
}: { 
  currentUser: any, projects: any[], tasks: any[], supportTickets: any[], users: any[] 
}) {

  const stats = useMemo(() => {
    return {
      projects: projects.length,
      tasks: tasks.length,
      tickets: supportTickets.length,
      users: users.length,
    };
  }, [projects, tasks, supportTickets, users]);

  // Support Tickets by Module
  const ticketsByModule = useMemo(() => {
    const counts: Record<string, number> = {};
    supportTickets.forEach(t => {
      counts[t.module] = (counts[t.module] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [supportTickets]);

  // Ticket Status
  const ticketStatus = useMemo(() => {
    const counts = { Done: 0, Ongoing: 0, Suspended: 0 };
    supportTickets.forEach(t => {
      if (t.status === "Done") counts.Done++;
      else if (t.status === "Ongoing") counts.Ongoing++;
      else if (t.status === "Suspended") counts.Suspended++;
    });
    return [
      { name: 'Done', value: counts.Done, color: '#10B981' }, // Emerald
      { name: 'Ongoing', value: counts.Ongoing, color: '#3B82F6' }, // Blue
      { name: 'Suspended', value: counts.Suspended, color: '#F59E0B' }, // Amber
    ];
  }, [supportTickets]);

  // Task Status
  const taskStatus = useMemo(() => {
    const counts = { "Not Started": 0, "Ongoing": 0, "Completed": 0 };
    tasks.forEach(t => {
      if (t.status === "Completed") counts["Completed"]++;
      else if (t.status === "Ongoing") counts["Ongoing"]++;
      else counts["Not Started"]++;
    });
    return [
      { name: 'Not Started', value: counts["Not Started"], color: '#9CA3AF' },
      { name: 'Ongoing', value: counts["Ongoing"], color: '#3B82F6' },
      { name: 'Completed', value: counts["Completed"], color: '#10B981' },
    ];
  }, [tasks]);


  const StatCard = ({ title, value, icon: Icon, colorClass, bgClass }: any) => (
    <div className="bg-white p-6 rounded-2xl border border-gray-200/60 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow">
      <div className={`w-14 h-14 rounded-2xl ${bgClass} ${colorClass} flex items-center justify-center`}>
        <Icon className="w-7 h-7" />
      </div>
      <div>
        <p className="text-gray-500 font-medium text-sm">{title}</p>
        <h3 className="text-3xl font-bold text-gray-800">{value}</h3>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Total Projects" value={stats.projects} icon={FolderKanban} bgClass="bg-purple-50" colorClass="text-purple-600" />
        <StatCard title="Total Tasks" value={stats.tasks} icon={CheckSquare} bgClass="bg-blue-50" colorClass="text-blue-600" />
        <StatCard title="Support Logs" value={stats.tickets} icon={Headset} bgClass="bg-emerald-50" colorClass="text-emerald-600" />
        <StatCard title="Active Users" value={stats.users} icon={Users} bgClass="bg-orange-50" colorClass="text-orange-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Support Tickets by Module */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200/60 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-gray-400" />
            <h3 className="text-lg font-bold text-gray-800">Support Logs by Module</h3>
          </div>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ticketsByModule} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="name" tick={{fontSize: 12, fill: '#6B7280'}} axisLine={false} tickLine={false} />
                <YAxis tick={{fontSize: 12, fill: '#6B7280'}} axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: '#F3F4F6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} barSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-gray-200/60 shadow-sm flex flex-col md:flex-row gap-6 items-center">
          <div className="flex-1 w-full">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider text-center mb-2">Support Ticket Status</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={ticketStatus} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {ticketStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Legend iconType="circle" wrapperStyle={{fontSize: '12px'}} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="hidden md:block w-px h-48 bg-gray-100"></div>
          
          <div className="flex-1 w-full">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider text-center mb-2">Project Task Status</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={taskStatus} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {taskStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Legend iconType="circle" wrapperStyle={{fontSize: '12px'}} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
