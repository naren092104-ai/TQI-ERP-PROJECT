import React, { useState } from 'react';
import { User, Cluster } from '../types';

interface UserManagementViewProps {
  users: User[];
  clusters: Cluster[];
  onAddUser?: (user: Partial<User>) => Promise<boolean> | void;
  onUpdateUser?: (id: string, user: Partial<User>) => Promise<boolean>;
  onDeleteUser?: (id: string) => Promise<void>;
  onResetPassword?: (id: string, password: string) => Promise<void>;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  users = [],
  clusters = [],
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onResetPassword,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editError, setEditError] = useState('');
  const [editRole, setEditRole] = useState<'Super Admin' | 'Cluster Admin'>('Cluster Admin');
  const [editClusterId, setEditClusterId] = useState('');

  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.clusterName && u.clusterName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleCreateSuperAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError('');
    if (!newName.trim() || !newEmail.trim()) {
      setAddError('Full name and email address are required.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (onAddUser) {
        const success = await onAddUser({
          name: newName.trim(),
          email: newEmail.trim(),
          role: 'Super Admin',
          phone: newPhone.trim() || '+91 90000 00000',
          status: 'Active',
        });

        if (success === false) {
          setIsSubmitting(false);
          return;
        }
      }

      setIsAddOpen(false);
      setNewName('');
      setNewEmail('');
      setNewPhone('');
      setAddError('');
    } catch (err: any) {
      setAddError(err?.message || 'Failed to create Super Admin account.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white border border-[#c4c6d3]/80 rounded-md p-4 md:p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-[#002869] text-white flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">manage_accounts</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-[#002869] tracking-tight">
              User & Role Management
            </h1>
            <span className="bg-[#002869]/10 text-[#002869] text-[11px] font-bold px-2 py-0.5 rounded-full">
              {users.length} Authorized Accounts
            </span>
          </div>
          <p className="text-xs text-[#747783] mt-1">
            Centrally manage Super Admins (State Coordinators) and Regional Cluster Admins across Tamil Nadu.
          </p>
        </div>

        <button
          onClick={() => {
            setIsAddOpen(true);
            setAddError('');
          }}
          className="bg-[#002869] hover:bg-[#001f52] text-white px-3.5 py-2 rounded-md text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <span className="material-symbols-outlined text-[16px]">person_add</span>
          Add Super Admin
        </button>
      </div>

      {/* Table */}
      <div className="bg-white border border-[#c4c6d3]/80 rounded-md overflow-hidden shadow-xs">
        <div className="p-3 border-b border-slate-200 flex justify-between items-center">
          <div className="relative w-full max-w-xs">
            <span className="material-symbols-outlined absolute left-2.5 top-2 text-[18px] text-slate-400">
              search
            </span>
            <input
              type="text"
              placeholder="Search by name, email, or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#f8fafc] border border-slate-300 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#002869]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#f8fafc] text-[#002869] font-bold border-b border-slate-200">
                <th className="py-3 px-4">User Details</th>
                <th className="py-3 px-4">Role Designation</th>
                <th className="py-3 px-4">Regional Scope</th>
                <th className="py-3 px-4">Contact Phone</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#002869] text-white flex items-center justify-center font-bold text-xs">
                        {u.name.substring(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{u.name}</p>
                        <p className="text-[11px] text-slate-500 font-mono">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <span
                      className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-bold ${
                        u.role === 'Super Admin'
                          ? 'bg-purple-100 text-purple-900 border border-purple-200'
                          : 'bg-blue-100 text-blue-900 border border-blue-200'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap font-medium text-slate-700">
                    {u.role === 'Super Admin' ? (
                      <span className="text-purple-900 font-semibold">State Central Authority (All)</span>
                    ) : (
                      u.clusterName || 'Assigned College Cluster'
                    )}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 font-mono text-[11px]">
                    {u.phone || '+91 90000 00000'}
                  </td>
                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800">
                        {u.status}
                      </span>
                      {u.mustChangePassword && (
                        <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          Pending Onboarding
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <button
                      onClick={() => {
                        setEditingUser(u);
                        setEditName(u.name);
                        setEditEmail(u.email);
                        setEditPhone(u.phone || '');
                        setEditRole(u.role);
                        setEditClusterId(u.clusterId || clusters[0]?.id || '');
                        setEditError('');
                      }}
                      className="text-[#002869] hover:bg-slate-100 p-1.5 rounded-md transition-colors cursor-pointer mr-1"
                      title="Edit User"
                    >
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                    <button
                      onClick={() => {
                        setResettingUser(u);
                        setResetPassword('');
                        setResetPasswordConfirm('');
                      }}
                      className="text-amber-700 hover:bg-amber-50 p-1.5 rounded-md transition-colors cursor-pointer mr-1"
                      title="Reset Password"
                    >
                      <span className="material-symbols-outlined text-[16px]">lock_reset</span>
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to deactivate ${u.name}?`)) {
                          onDeleteUser?.(u.id);
                        }
                      }}
                      className="text-red-700 hover:bg-red-50 p-1.5 rounded-md transition-colors cursor-pointer"
                      title="Delete User"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Super Admin Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#c4c6d3] rounded-md w-full max-w-md shadow-lg overflow-hidden">
            <div className="bg-[#002869] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">person_add</span>
                <h3 className="text-base font-bold">Add Central Super Admin</h3>
              </div>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-full cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateSuperAdmin} className="p-5 space-y-3.5 text-xs">
              {addError && (
                <div className="p-2.5 rounded bg-red-50 border border-red-200 text-red-700 text-[11.5px]">
                  {addError}
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. S. Anand"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-slate-300 rounded-md p-2 text-xs focus:outline-none focus:border-[#002869]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Login Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. anand.s@tqi.org"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-slate-300 rounded-md p-2 text-xs focus:outline-none focus:border-[#002869]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. +91 96291 55672"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-[#f8fafc] border border-slate-300 rounded-md p-2 text-xs focus:outline-none focus:border-[#002869]"
                />
              </div>

              <div className="p-3 bg-purple-50/70 border border-purple-200/80 rounded-md text-[11px] text-purple-900 space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">shield_person</span>
                  Central Super Admin Authority
                </p>
                <p className="text-purple-800">
                  This account will have statewide authority across all college clusters, panchayats, modules, and financial approvals.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsAddOpen(false)}
                  className="px-3 py-1.5 text-slate-600 hover:bg-slate-100 rounded-md font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-[#002869] hover:bg-[#001f52] text-white rounded-md font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating Super Admin...' : 'Create Super Admin & Send Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#c4c6d3] rounded-md w-full max-w-md shadow-lg overflow-hidden">
            <div className="bg-[#002869] text-white p-4 flex items-center justify-between">
              <h3 className="text-base font-bold">Edit User Details</h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-white/80 hover:text-white p-1 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const selectedCluster = clusters.find((cluster) => cluster.id === editClusterId);
                const updated = await onUpdateUser?.(editingUser.id, {
                  name: editName.trim(),
                  email: editEmail.trim(),
                  phone: editPhone.trim(),
                  role: editRole,
                  clusterId: editRole === 'Cluster Admin' ? editClusterId : undefined,
                  clusterName: editRole === 'Cluster Admin' ? selectedCluster?.name : undefined,
                });
                if (updated !== false) setEditingUser(null);
                else setEditError('Unable to save changes. Check the email or cluster assignment.');
              }}
              className="p-5 space-y-3 text-xs"
            >
              {editError && <div className="p-2 rounded bg-red-50 border border-red-200 text-red-700">{editError}</div>}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
                <input required value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-[#f8fafc] border border-slate-300 rounded-md p-2" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email *</label>
                <input required type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="w-full bg-[#f8fafc] border border-slate-300 rounded-md p-2" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone</label>
                <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full bg-[#f8fafc] border border-slate-300 rounded-md p-2" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Role *</label>
                <select value={editRole} onChange={(e) => setEditRole(e.target.value as 'Super Admin' | 'Cluster Admin')} className="w-full bg-[#f8fafc] border border-slate-300 rounded-md p-2">
                  <option>Cluster Admin</option>
                  <option>Super Admin</option>
                </select>
              </div>
              {editRole === 'Cluster Admin' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned College Cluster *</label>
                  <select required value={editClusterId} onChange={(e) => setEditClusterId(e.target.value)} className="w-full bg-[#f8fafc] border border-slate-300 rounded-md p-2">
                    {clusters.map((cluster) => (
                      <option key={cluster.id} value={cluster.id}>{cluster.collegeName || cluster.name} ({cluster.district})</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button type="button" onClick={() => setEditingUser(null)} className="px-3 py-1.5 text-slate-600 rounded-md font-semibold cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-1.5 bg-[#002869] text-white rounded-md font-bold cursor-pointer">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resettingUser && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#c4c6d3] rounded-md w-full max-w-md shadow-lg overflow-hidden">
            <div className="bg-[#002869] text-white p-4 flex items-center justify-between">
              <h3 className="text-base font-bold">Reset User Password</h3>
              <button onClick={() => setResettingUser(null)} className="text-white/80 hover:text-white p-1 cursor-pointer">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (resetPassword.length < 8 || resetPassword !== resetPasswordConfirm) return;
                setResetLoading(true);
                try {
                  await onResetPassword?.(resettingUser.id, resetPassword);
                  setResettingUser(null);
                } finally {
                  setResetLoading(false);
                }
              }}
              className="p-5 space-y-3 text-xs"
            >
              <p className="text-slate-600">
                Set a new password for <strong>{resettingUser.name}</strong> ({resettingUser.email}).
              </p>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">New Password *</label>
                <input required minLength={8} type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="Minimum 8 characters" className="w-full bg-[#f8fafc] border border-slate-300 rounded-md p-2" />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Confirm Password *</label>
                <input required minLength={8} type="password" value={resetPasswordConfirm} onChange={(e) => setResetPasswordConfirm(e.target.value)} placeholder="Re-enter new password" className="w-full bg-[#f8fafc] border border-slate-300 rounded-md p-2" />
              </div>
              {resetPasswordConfirm && resetPassword !== resetPasswordConfirm && (
                <p className="text-red-600 font-semibold">Passwords do not match.</p>
              )}
              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button type="button" onClick={() => setResettingUser(null)} className="px-3 py-1.5 text-slate-600 rounded-md font-semibold cursor-pointer">Cancel</button>
                <button type="submit" disabled={resetLoading || resetPassword.length < 8 || resetPassword !== resetPasswordConfirm} className="px-4 py-1.5 bg-[#002869] text-white rounded-md font-bold disabled:opacity-50 cursor-pointer">
                  {resetLoading ? 'Setting Password...' : 'Set Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
