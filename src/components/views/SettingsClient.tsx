"use client";

import { useState } from "react";
import { User, Lock, Mail, Camera, Shield, Users, Plus, Save, Loader2, AlertCircle, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SettingsClient({ currentUser, allUsers }: { currentUser: any, allUsers: any[] }) {
  const [activeTab, setActiveTab] = useState("profile");
  const [profileData, setProfileData] = useState({
    name: currentUser.name || "",
    email: currentUser.email || "",
    photo: currentUser.photo || "",
    oldPassword: "",
    newPassword: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const router = useRouter();

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/users/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileData),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || "Failed to save profile" });
      } else {
        setMessage({ type: 'success', text: "Profile updated successfully!" });
        setProfileData(prev => ({ ...prev, oldPassword: "", newPassword: "" }));
        router.refresh();
      }
    } catch (error) {
      setMessage({ type: 'error', text: "Server error occurred" });
    } finally {
      setIsSaving(false);
    }
  };

  const inputClass = "w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all";

  return (
    <div className="p-8 max-w-5xl mx-auto h-full overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Settings</h1>
        <p className="text-slate-500 mt-1">Manage your profile and account preferences</p>
      </div>

      {currentUser.role === "Admin" && (
        <div className="flex border-b border-gray-200 mb-6 gap-6">
          <button
            onClick={() => setActiveTab("profile")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-all ${activeTab === "profile" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            My Profile
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`pb-3 text-sm font-semibold border-b-2 transition-all ${activeTab === "users" ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            User Management
          </button>
        </div>
      )}

      {activeTab === "profile" && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60 overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
            <h2 className="text-lg font-semibold text-slate-800">Personal Information</h2>
          </div>
          
          <div className="p-6">
            {message && (
              <div className={`mb-6 px-4 py-3 rounded-lg border flex items-center ${message.type === 'error' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'}`}>
                <AlertCircle className="w-4 h-4 mr-2 shrink-0" />
                <span className="text-sm font-medium">{message.text}</span>
              </div>
            )}

            <form onSubmit={handleProfileUpdate} className="space-y-6">
              <div className="flex flex-col md:flex-row gap-8">
                {/* Photo Upload Simulation */}
                <div className="flex flex-col items-center gap-3">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-100 to-indigo-100 flex items-center justify-center text-blue-500 border-4 border-white shadow-md relative overflow-hidden">
                    {profileData.photo ? (
                      <img src={profileData.photo} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-10 h-10 opacity-50" />
                    )}
                  </div>
                  <label className="cursor-pointer bg-white border border-gray-200 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-gray-50 transition-colors flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5" /> Change Photo
                    <input type="text" placeholder="URL Foto" className="hidden" 
                      onChange={(e) => {
                        const url = prompt("Enter Photo URL:");
                        if (url) setProfileData({...profileData, photo: url});
                      }} 
                    />
                  </label>
                </div>

                <div className="flex-1 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Full Name</label>
                      <input type="text" value={profileData.name} onChange={e => setProfileData({...profileData, name: e.target.value})} className={inputClass} required />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Email</label>
                      <input type="email" value={profileData.email} onChange={e => setProfileData({...profileData, email: e.target.value})} className={inputClass} required />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100">
                    <h3 className="text-sm font-semibold text-slate-800 mb-4">Change Password <span className="text-xs font-normal text-gray-400">(Optional)</span></h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Old Password</label>
                        <input type="password" value={profileData.oldPassword} onChange={e => setProfileData({...profileData, oldPassword: e.target.value})} className={inputClass} placeholder="••••••••" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">New Password</label>
                        <input type="password" value={profileData.newPassword} onChange={e => setProfileData({...profileData, newPassword: e.target.value})} className={inputClass} placeholder="••••••••" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-4">
                <button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold text-sm shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-70 disabled:hover:translate-y-0">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === "users" && currentUser.role === "Admin" && (
        <UserManagement users={allUsers} inputClass={inputClass} />
      )}
    </div>
  );
}

function UserManagement({ users, inputClass }: { users: any[], inputClass: string }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [formData, setFormData] = useState({ name: "", email: "", password: "", jobDesk: "", role: "Staff" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmitUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const method = editingUser ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIsAdding(false);
      setEditingUser(null);
      setFormData({ name: "", email: "", password: "", jobDesk: "", role: "Staff" });
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete user ${name}?`)) return;
    try {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200/60 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
        <h2 className="text-lg font-semibold text-slate-800">User List</h2>
        <button onClick={() => { setIsAdding(!isAdding); setEditingUser(null); setFormData({ name: "", email: "", password: "", jobDesk: "", role: "Staff" }); }} className="bg-white border border-gray-200 text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add User
        </button>
      </div>

      {(isAdding || editingUser) && (
        <div className="p-6 bg-blue-50/30 border-b border-gray-100">
          <form onSubmit={handleSubmitUser} className="space-y-4">
            {error && <div className="text-red-500 text-xs font-semibold">{error}</div>}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Name</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className={inputClass} required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Email</label>
                <input type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className={inputClass} required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Password {editingUser && "(Leave blank to keep)"}</label>
                <input type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} className={inputClass} required={!editingUser} />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Job Desk</label>
                <input type="text" value={formData.jobDesk} onChange={e => setFormData({...formData, jobDesk: e.target.value})} className={inputClass} required />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Role</label>
                <select value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})} className={inputClass}>
                  <option value="Staff">Staff</option>
                  <option value="Admin">Admin</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setIsAdding(false); setEditingUser(null); }} className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg">Cancel</button>
              <button type="submit" disabled={loading} className="px-4 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center">
                {loading && <Loader2 className="w-3 h-3 animate-spin mr-1.5" />} {editingUser ? "Update" : "Save"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
            <tr>
              <th className="px-6 py-3">User</th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Job Desk</th>
              <th className="px-6 py-3">Role</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50/50">
                <td className="px-6 py-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-100 to-indigo-100 flex items-center justify-center text-blue-600 text-xs font-bold shadow-inner">
                    {u.photo ? <img src={u.photo} alt={u.name} className="w-full h-full rounded-full object-cover" /> : u.name.charAt(0)}
                  </div>
                  <span className="font-semibold text-gray-800">{u.name}</span>
                </td>
                <td className="px-6 py-3 text-gray-600">{u.email}</td>
                <td className="px-6 py-3 text-gray-600">{u.jobDesk}</td>
                <td className="px-6 py-3">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${u.role === 'Admin' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-6 py-3 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setEditingUser(u); setFormData({ name: u.name, email: u.email, password: "", jobDesk: u.jobDesk || "", role: u.role }); setIsAdding(false); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDeleteUser(u.id, u.name)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
