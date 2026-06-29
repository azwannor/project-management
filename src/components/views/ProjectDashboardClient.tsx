"use client";

import { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  Table2, 
  KanbanSquare, 
  GanttChartSquare, 
  CalendarDays,
  Plus,
  X,
  FolderPlus,
  Target,
  Users,
  Loader2
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import TableView from "./TableView";
import KanbanView from "./KanbanView";
import ProjectListView from "./ProjectListView";
import GanttView from "./GanttView";
import CalendarView from "./CalendarView";

export default function ProjectDashboardClient({ initialData }: { initialData: any }) {
  const searchParams = useSearchParams();
  const activeModule = searchParams.get("module") || "project";
  const [activeTab, setActiveTab] = useState(activeModule === "project" ? "project" : "table");

  useEffect(() => {
    if (activeModule === "project") {
      setActiveTab("project");
    } else if (activeTab === "project") {
      setActiveTab("table"); // Default task tab
    }
  }, [activeModule]);
  const [selectedProjectId, setSelectedProjectId] = useState("all");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", objective: "", members: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const projects = initialData.projects || [];
  const allTasks = initialData.tasks || [];
  const users = initialData.users || [];
  const currentUser = initialData.currentUser || {};

  const filteredTasks = selectedProjectId === "all" 
    ? allTasks 
    : allTasks.filter((t: any) => t.projectId === selectedProjectId);

  const handleCreateProject = async () => {
    if (!newProject.name.trim()) return;
    setIsSubmitting(true);
    try {
      await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProject.name,
          objective: newProject.objective,
          members: newProject.members,
          startDate: new Date().toISOString(),
          endDate: new Date(new Date().getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          status: "Not Started"
        }),
      });
      setNewProject({ name: "", objective: "", members: "" });
      setIsCreatingProject(false);
      router.refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleMember = (userName: string) => {
    const currentMembers = newProject.members ? newProject.members.split(", ").filter(Boolean) : [];
    if (currentMembers.includes(userName)) {
      setNewProject({ ...newProject, members: currentMembers.filter((n: string) => n !== userName).join(", ") });
    } else {
      setNewProject({ ...newProject, members: [...currentMembers, userName].join(", ") });
    }
  };

  const tabs = activeModule === "project" 
    ? [ { id: "project", name: "Project List", icon: FolderPlus } ]
    : [
        { id: "table", name: "Table View", icon: Table2 },
        { id: "kanban", name: "Kanban Board", icon: KanbanSquare },
        { id: "gantt", name: "Gantt Chart", icon: GanttChartSquare },
        { id: "calendar", name: "Calendar", icon: CalendarDays }
      ];

  return (
    <div className="flex flex-col h-full gap-4 p-4 md:p-6 bg-slate-50 min-h-screen">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-200 p-2 gap-2">
          <div className="flex overflow-x-auto gap-1">
            {tabs.map((tab) => {

            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  isActive ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.name}
              </button>
            );
          })}
          </div>
          {activeTab === "project" && (
            <div className="flex items-center gap-3 px-2 md:px-0">
              {projects.length > 0 && (
                <select
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none"
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                >
                  <option value="all">All Projects</option>
                  {projects.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
              <button 
                onClick={() => setIsCreatingProject(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all shadow-sm shadow-blue-600/20 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" /> New Project
              </button>
            </div>
          )}
        </div>
        
        <div className="flex-1 overflow-auto bg-slate-50/50">
          {activeTab === "project" && <ProjectListView projects={projects} users={users} />}
          {activeTab === "table" && <TableView tasks={filteredTasks} users={users} projects={projects} currentUser={currentUser} />}
          {activeTab === "kanban" && <KanbanView tasks={filteredTasks} users={users} projects={projects} currentUser={currentUser} />}
          {activeTab === "gantt" && <GanttView tasks={filteredTasks} projects={projects} users={users} />}
          {activeTab === "calendar" && <CalendarView tasks={filteredTasks} projects={projects} />}
        </div>
      </div>

      {isCreatingProject && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex justify-between items-center">
              <div>
                <h3 className="font-bold text-lg">Create New Project</h3>
                <p className="text-blue-100 text-xs">Setup a new project space</p>
              </div>
              <button onClick={() => setIsCreatingProject(false)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4 max-h-[70vh] overflow-auto">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Project Name <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  value={newProject.name}
                  onChange={(e) => setNewProject({...newProject, name: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="Enter project name..."
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Objective</label>
                <textarea 
                  value={newProject.objective}
                  onChange={(e) => setNewProject({...newProject, objective: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all resize-none"
                  placeholder="What is the goal of this project?"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Team Members</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200 max-h-48 overflow-y-auto">
                  {users.map((user: any) => {
                    const isChecked = newProject.members.includes(user.name);
                    return (
                      <label key={user.id} className="flex items-center gap-2 cursor-pointer p-1 hover:bg-slate-100 rounded text-sm text-slate-700">
                        <input 
                          type="checkbox" 
                          checked={isChecked}
                          onChange={() => toggleMember(user.name)}
                          className="rounded text-blue-600 focus:ring-blue-500"
                        />
                        <span className="truncate">{user.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setIsCreatingProject(false)}
                className="px-4 py-2 font-medium text-slate-600 hover:bg-slate-200 rounded-xl transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateProject}
                disabled={!newProject.name.trim() || isSubmitting}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Project
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
