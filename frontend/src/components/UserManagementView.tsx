import React, { useState } from "react";
import { User, Cluster } from "../types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { ActionButton } from "./ui/action-button";
import Badge from "./ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableCell } from "./ui/table";
import { Plus, Search, ShieldCheck, UserCheck, X, Edit3, Lock, Trash2, KeyRound } from "lucide-react";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [addError, setAddError] = useState("");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editError, setEditError] = useState("");
  const [editRole, setEditRole] = useState<"Super Admin" | "Cluster Admin">("Cluster Admin");
  const [editClusterId, setEditClusterId] = useState("");

  const [resettingUser, setResettingUser] = useState<User | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.clusterName && u.clusterName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

  const handleCreateSuperAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddError("");
    const trimmedName = newName.trim();
    const trimmedEmail = newEmail.trim().toLowerCase();
    const trimmedPhone = newPhone.trim();

    if (!trimmedName || !trimmedEmail) {
      setAddError("Full name and email address are required.");
      return;
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      setAddError("Please enter a valid email address (e.g. name@tqi.org).");
      return;
    }

    let formattedPhone = "+91 90000 00000";
    if (trimmedPhone) {
      const digitsOnly = trimmedPhone.replace(/\D/g, '');
      let finalDigits = digitsOnly;
      if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
        finalDigits = digitsOnly.slice(2);
      } else if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
        finalDigits = digitsOnly.slice(1);
      }
      if (finalDigits.length !== 10) {
        setAddError("Phone number must be exactly 10 digits (e.g. 9876543210).");
        return;
      }
      formattedPhone = `+91 ${finalDigits}`;
    }

    setIsSubmitting(true);
    try {
      if (onAddUser) {
        const success = await onAddUser({
          name: trimmedName,
          email: trimmedEmail,
          role: "Super Admin",
          phone: formattedPhone,
          status: "Active",
        });

        if (success === false) {
          setIsSubmitting(false);
          return;
        }
      }

      setIsAddOpen(false);
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      setAddError("");
    } catch (err: any) {
      setAddError(err?.message || "Failed to create Super Admin account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
              User & Role Management
            </h1>
            <Badge color="primary" size="sm">
              {users.length} Authorized Accounts
            </Badge>
          </div>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Centrally manage Super Admins (State Coordinators) and Regional Cluster Admins across Tamil Nadu.
          </p>
        </div>

        <ActionButton
          onClick={() => {
            setIsAddOpen(true);
            setAddError("");
          }}
          size="sm"
          variant="primary"
          icon={<Plus size={15} />}
        >
          Add Super Admin
        </ActionButton>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="h-4 w-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, email, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:placeholder:text-gray-500"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableCell isHeader className="w-[280px]">User Details</TableCell>
              <TableCell isHeader>Role Designation</TableCell>
              <TableCell isHeader>Regional Scope</TableCell>
              <TableCell isHeader>Contact Phone</TableCell>
              <TableCell isHeader>Account Status</TableCell>
              <TableCell isHeader className="text-right">Actions</TableCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((u) => (
              <TableRow key={u.id} className="hover:bg-gray-50/80 dark:hover:bg-white/[0.02] transition-colors">
                <TableCell>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white text-xs">{u.name}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">{u.email}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-bold ${
                      u.role === "Super Admin"
                        ? "bg-purple-100 text-purple-900 border border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800"
                        : "bg-blue-100 text-blue-900 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800"
                    }`}
                  >
                    {u.role}
                  </span>
                </TableCell>
                <TableCell className="font-medium text-gray-700 dark:text-gray-300 text-xs">
                  {u.role === "Super Admin" ? (
                    <span className="text-purple-700 dark:text-purple-400 font-semibold">State Central Authority (All)</span>
                  ) : (
                    u.clusterName || "Assigned College Cluster"
                  )}
                </TableCell>
                <TableCell className="text-gray-500 dark:text-gray-400 font-mono text-xs">
                  {u.phone || "+91 90000 00000"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-block px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
                      {u.status}
                    </span>
                    {u.mustChangePassword && (
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800">
                        Pending Onboarding
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => {
                        setEditingUser(u);
                        setEditName(u.name);
                        setEditEmail(u.email);
                        setEditPhone(u.phone || "");
                        setEditRole(u.role);
                        setEditClusterId(u.clusterId || clusters[0]?.id || "");
                        setEditError("");
                      }}
                      className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-brand-500 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-brand-400 transition cursor-pointer"
                      title="Edit User"
                    >
                      <Edit3 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        setResettingUser(u);
                        setResetPassword("");
                        setResetPasswordConfirm("");
                      }}
                      className="rounded-lg p-1.5 text-gray-500 hover:bg-amber-50 hover:text-amber-600 dark:text-gray-400 dark:hover:bg-amber-500/10 dark:hover:text-amber-400 transition cursor-pointer"
                      title="Reset Password"
                    >
                      <KeyRound className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to deactivate ${u.name}?`)) {
                          onDeleteUser?.(u.id);
                        }
                      }}
                      className="rounded-lg p-1.5 text-gray-500 hover:bg-error-50 hover:text-error-600 dark:text-gray-400 dark:hover:bg-error-500/10 dark:hover:text-error-400 transition cursor-pointer"
                      title="Delete User"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add Super Admin Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-[99999] bg-gray-900/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md shadow-theme-xl overflow-hidden animate-in fade-in-0 zoom-in-95">
            <div className="p-5 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Add Central Super Admin</h3>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSuperAdmin} className="p-5 space-y-4 text-xs">
              {addError && (
                <div className="p-2.5 rounded-xl bg-error-50 border border-error-200 text-error-700 text-xs dark:bg-error-500/10 dark:border-error-500/20 dark:text-error-400">
                  {addError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. S. Anand"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-transparent px-3.5 py-2.5 text-xs text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Login Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. anand.s@tqi.org"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-transparent px-3.5 py-2.5 text-xs text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Contact Phone Number</label>
                <input
                  type="text"
                  placeholder="e.g. +91 96291 55672"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-transparent px-3.5 py-2.5 text-xs text-gray-800 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div className="p-3.5 bg-purple-50/70 dark:bg-purple-900/20 border border-purple-200/80 dark:border-purple-800/60 rounded-xl text-xs text-purple-900 dark:text-purple-300 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  Central Super Admin Authority
                </p>
                <p className="text-purple-800 dark:text-purple-300/80 text-[11px]">
                  This account will have statewide authority across all college clusters, panchayats, modules, and financial approvals.
                </p>
              </div>

              <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsAddOpen(false)}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-theme-xs hover:bg-brand-600 transition cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? "Creating Super Admin..." : "Create Super Admin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-[99999] bg-gray-900/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md shadow-theme-xl overflow-hidden animate-in fade-in-0 zoom-in-95">
            <div className="p-5 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Edit User Details</h3>
              <button
                onClick={() => setEditingUser(null)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-white p-1 rounded-lg transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setEditError("");
                const trimmedName = editName.trim();
                const trimmedEmail = editEmail.trim().toLowerCase();
                const trimmedPhone = editPhone.trim();

                if (!trimmedName || !trimmedEmail) {
                  setEditError("Full name and email address are required.");
                  return;
                }

                if (!EMAIL_REGEX.test(trimmedEmail)) {
                  setEditError("Please enter a valid email address.");
                  return;
                }

                let formattedPhone = "+91 90000 00000";
                if (trimmedPhone) {
                  const digitsOnly = trimmedPhone.replace(/\D/g, '');
                  let finalDigits = digitsOnly;
                  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
                    finalDigits = digitsOnly.slice(2);
                  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
                    finalDigits = digitsOnly.slice(1);
                  }
                  if (finalDigits.length !== 10) {
                    setEditError("Phone number must be exactly 10 digits.");
                    return;
                  }
                  formattedPhone = `+91 ${finalDigits}`;
                }

                const selectedCluster = clusters.find((cluster) => cluster.id === editClusterId);
                const updated = await onUpdateUser?.(editingUser.id, {
                  name: trimmedName,
                  email: trimmedEmail,
                  phone: formattedPhone,
                  role: editRole,
                  clusterId: editRole === "Cluster Admin" ? editClusterId : undefined,
                  clusterName: editRole === "Cluster Admin" ? selectedCluster?.name : undefined,
                });
                if (updated !== false) setEditingUser(null);
                else setEditError("Unable to save changes. Check the email or cluster assignment.");
              }}
              className="p-5 space-y-3.5 text-xs"
            >
              {editError && <div className="p-2.5 rounded-xl bg-error-50 border border-error-200 text-error-700 text-xs dark:bg-error-500/10 dark:border-error-500/20 dark:text-error-400">{editError}</div>}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Full Name *</label>
                <input required value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full rounded-xl border border-gray-300 bg-transparent px-3.5 py-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Email *</label>
                <input required type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} className="w-full rounded-xl border border-gray-300 bg-transparent px-3.5 py-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Phone</label>
                <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full rounded-xl border border-gray-300 bg-transparent px-3.5 py-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Role *</label>
                <Select
                  value={editRole}
                  onValueChange={(val: any) => setEditRole(val)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Select Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cluster Admin">Cluster Admin</SelectItem>
                    <SelectItem value="Super Admin">Super Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editRole === "Cluster Admin" && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Assigned College Cluster *</label>
                  <Select
                    value={editClusterId || (clusters[0]?.id ?? undefined)}
                    onValueChange={(val) => setEditClusterId(val)}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Select Cluster" />
                    </SelectTrigger>
                    <SelectContent>
                      {clusters.map((cluster) => (
                        <SelectItem key={cluster.id} value={cluster.id}>
                          {cluster.collegeName || cluster.name} ({cluster.district})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-theme-xs hover:bg-brand-600 transition cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resettingUser && (
        <div className="fixed inset-0 z-[99999] bg-gray-900/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl w-full max-w-md shadow-theme-xl overflow-hidden animate-in fade-in-0 zoom-in-95">
            <div className="p-5 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Reset User Password</h3>
              <button onClick={() => setResettingUser(null)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white p-1 rounded-lg transition cursor-pointer">
                <X className="h-4 w-4" />
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
              className="p-5 space-y-4 text-xs"
            >
              <p className="text-gray-600 dark:text-gray-400 text-xs">
                Set a new password for <strong className="text-gray-800 dark:text-white">{resettingUser.name}</strong> ({resettingUser.email}).
              </p>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">New Password *</label>
                <input required minLength={8} type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="Minimum 8 characters" className="w-full rounded-xl border border-gray-300 bg-transparent px-3.5 py-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Confirm Password *</label>
                <input required minLength={8} type="password" value={resetPasswordConfirm} onChange={(e) => setResetPasswordConfirm(e.target.value)} placeholder="Re-enter new password" className="w-full rounded-xl border border-gray-300 bg-transparent px-3.5 py-2.5 text-xs text-gray-800 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
              </div>
              {resetPasswordConfirm && resetPassword !== resetPasswordConfirm && (
                <p className="text-error-600 dark:text-error-400 font-semibold text-xs">Passwords do not match.</p>
              )}
              <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2.5">
                <button type="button" onClick={() => setResettingUser(null)} className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 transition cursor-pointer">Cancel</button>
                <button type="submit" disabled={resetLoading || resetPassword.length < 8 || resetPassword !== resetPasswordConfirm} className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-theme-xs hover:bg-brand-600 transition cursor-pointer disabled:opacity-50">
                  {resetLoading ? "Setting Password..." : "Set Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
