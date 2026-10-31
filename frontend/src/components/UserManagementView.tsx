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
import { apiUrl } from '../utils/api';

interface UserManagementViewProps {
  users: User[];
  clusters: Cluster[];
  authToken?: string;
  onAddUser?: (user: Partial<User>) => Promise<boolean> | void;
  onUpdateUser?: (id: string, user: Partial<User>) => Promise<boolean>;
  onDeleteUser?: (id: string) => Promise<void>;
  onResetPassword?: (id: string) => Promise<{ temporaryPassword: string; user: User }>;
  onChangePassword?: (id: string, password: string) => Promise<void>;
}

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  users = [],
  clusters = [],
  authToken = '',
  onAddUser,
  onUpdateUser,
  onDeleteUser,
  onResetPassword,
  onChangePassword,
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

  const [securityUser, setSecurityUser] = useState<User | null>(null);
  const [securityHistory, setSecurityHistory] = useState<any[]>([]);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [securityError, setSecurityError] = useState('');
  const [resetConfirm, setResetConfirm] = useState(false);
  const [oneTimePassword, setOneTimePassword] = useState('');
  const [changedPassword, setChangedPassword] = useState('');
  const [confirmChangedPassword, setConfirmChangedPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);

  const closeSecurity = () => {
    setSecurityUser(null);
    setSecurityHistory([]);
    setSecurityError('');
    setResetConfirm(false);
    setOneTimePassword('');
    setChangedPassword('');
    setConfirmChangedPassword('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
  };

  const openSecurity = async (user: User) => {
    setSecurityUser(user);
    setSecurityHistory([]);
    setSecurityError('');
    setResetConfirm(false);
    setOneTimePassword('');
    setSecurityLoading(true);
    try {
      const response = await fetch(apiUrl(`/api/users/${encodeURIComponent(user.id)}/password-security`), {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        cache: 'no-store',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to load password status.');
      setSecurityHistory(Array.isArray(data.history) ? data.history : []);
      setSecurityUser({ ...user, passwordStatus: data.status, passwordCreatedAt: data.passwordCreatedAt, passwordChangedAt: data.passwordChangedAt, passwordResetAt: data.passwordResetAt, passwordResetBy: data.passwordResetBy });
    } catch (error) {
      setSecurityError(error instanceof Error ? error.message : 'Unable to load password status.');
    } finally {
      setSecurityLoading(false);
    }
  };

  const passwordIsStrong = (value: string) => value.length >= 8 && /[A-Z]/.test(value) && /[a-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);

  const downloadCredentials = () => {
    if (!securityUser || !oneTimePassword) return;
    const content = [
      'TALENT QUEST FOR INDIA', '', 'USER LOGIN CREDENTIALS', '----------------------------------------',
      `Name: ${securityUser.name}`, `Email: ${securityUser.email}`, `Role: ${securityUser.role}`,
      `Temporary Password: ${oneTimePassword}`, `Login URL: ${window.location.origin}`,
      'Password Status: Temporary Password', `Generated On: ${new Date().toLocaleString()}`,
      '', 'Please change your password after first login.', '',
    ].join('\n');
    const blobUrl = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `TQI_Credentials_${securityUser.email.replace(/[^a-z0-9.-]/gi, '_')}.txt`;
    link.click();
    URL.revokeObjectURL(blobUrl);
  };

  const getUserClusterName = (user: User) => {
    if (user.role === 'Super Admin') return 'State Central Authority (All)';
    const assignedCluster = clusters.find((cluster) => cluster.id === user.clusterId);
    if (assignedCluster?.name) return assignedCluster.name;

    const serializedName = user.clusterName?.trim();
    if (serializedName && serializedName !== `${user.clusterId} Cluster`) return serializedName;

    const readableId = String(user.clusterId || '')
      .replace(/-[a-f\d]{8}-[a-f\d]{8}$/i, '')
      .replace(/[-_]+/g, ' ')
      .trim()
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
    return readableId || 'Cluster not assigned';
  };

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getUserClusterName(u).toLowerCase().includes(searchTerm.toLowerCase())
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
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableCell isHeader className="w-[280px]">User Details</TableCell>
              <TableCell isHeader>Role Designation</TableCell>
              <TableCell isHeader>Regional Scope</TableCell>
              <TableCell isHeader>Contact Phone</TableCell>
              <TableCell isHeader>Password Status</TableCell>
              <TableCell isHeader>Last Password Change</TableCell>
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
                  {getUserClusterName(u)}
                </TableCell>
                <TableCell className="text-gray-500 dark:text-gray-400 font-mono text-xs">
                  {u.phone || "+91 90000 00000"}
                </TableCell>
                <TableCell>
                  <span className={`inline-block rounded-full px-2 py-1 text-[10px] font-bold ${u.mustChangePassword || u.passwordStatus === 'TEMPORARY' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'}`}>
                    {u.mustChangePassword || u.passwordStatus === 'TEMPORARY' ? 'Temporary Password' : 'Password Set'}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap text-[11px] text-gray-600 dark:text-gray-300">
                  {u.passwordChangedAt ? new Date(u.passwordChangedAt).toLocaleString() : u.passwordCreatedAt ? new Date(u.passwordCreatedAt).toLocaleString() : 'Not available'}
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
                      onClick={() => void openSecurity(u)}
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

      {securityUser && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-gray-950/70 p-4" role="dialog" aria-modal="true" aria-labelledby="password-security-title">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
            <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-900">
              <div><h3 id="password-security-title" className="text-base font-bold text-gray-900 dark:text-white">Security / Password</h3><p className="mt-1 text-xs text-gray-500">{securityUser.name} · {securityUser.email}</p></div>
              <button type="button" onClick={closeSecurity} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Close password security"><X className="h-4 w-4" /></button>
            </div>

            <div className="space-y-5 p-5 text-xs">
              {securityError && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{securityError}</div>}
              {securityLoading ? <p className="py-5 text-center text-gray-500">Loading password status…</p> : oneTimePassword ? (
                <section className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <div><h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">New Temporary Password</h4><p className="mt-1 text-emerald-800 dark:text-emerald-300">This password is shown only now. Closing this window clears it.</p></div>
                  <div className="rounded-lg border border-emerald-200 bg-white p-3 font-mono text-base font-bold tracking-wider text-gray-900 dark:border-emerald-800 dark:bg-gray-900 dark:text-white">{oneTimePassword}</div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void navigator.clipboard.writeText(oneTimePassword)} className="rounded-lg border border-emerald-300 px-3 py-2 font-semibold text-emerald-900 dark:text-emerald-200">Copy Password</button>
                    <button type="button" onClick={downloadCredentials} className="rounded-lg bg-emerald-700 px-3 py-2 font-semibold text-white">Download Credentials</button>
                    <button type="button" onClick={closeSecurity} className="rounded-lg border border-gray-300 px-3 py-2 font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">Done</button>
                  </div>
                </section>
              ) : (
                <>
                  <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                    <h4 className="mb-3 font-bold text-gray-900 dark:text-white">Password Status</h4>
                    <dl className="grid grid-cols-[150px_1fr] gap-y-2 text-xs">
                      <dt className="text-gray-500">Status</dt><dd className={securityUser.mustChangePassword ? 'font-bold text-amber-700' : 'font-bold text-emerald-700'}>{securityUser.mustChangePassword ? '🟡 Temporary Password' : '🟢 Password Set'}</dd>
                      <dt className="text-gray-500">Password</dt><dd className="font-mono tracking-widest text-gray-700 dark:text-gray-300">•••••••• <span className="font-sans tracking-normal text-gray-500">(not retrievable)</span></dd>
                      <dt className="text-gray-500">Last changed</dt><dd>{securityUser.passwordChangedAt ? new Date(securityUser.passwordChangedAt).toLocaleString() : securityUser.passwordCreatedAt ? new Date(securityUser.passwordCreatedAt).toLocaleString() : 'Not available'}</dd>
                      {securityUser.passwordResetAt && <><dt className="text-gray-500">Last reset</dt><dd>{new Date(securityUser.passwordResetAt).toLocaleString()}</dd><dt className="text-gray-500">Reset by</dt><dd>{securityUser.passwordResetBy || 'Super Admin'}</dd></>}
                    </dl>
                    <p className="mt-3 text-[11px] text-gray-500">For security reasons, the current password cannot be displayed or downloaded.</p>
                  </section>

                  {!resetConfirm ? <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => { setChangedPassword(''); setConfirmChangedPassword(''); setResetConfirm(false); setSecurityError(''); }} className="rounded-lg bg-blue-700 px-3 py-2 font-semibold text-white">Change Password</button>
                    <button type="button" onClick={() => { setResetConfirm(true); setSecurityError(''); }} className="rounded-lg bg-red-700 px-3 py-2 font-semibold text-white">Reset Password</button>
                  </div> : (
                    <section className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/20">
                      <h4 className="font-bold text-red-900 dark:text-red-200">Reset User Password</h4>
                      <p className="text-gray-700 dark:text-gray-300">The current password cannot be retrieved. A new cryptographically secure temporary password will be generated, shown once, and require change at next login.</p>
                      <div className="flex justify-end gap-2"><button type="button" onClick={() => setResetConfirm(false)} className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-700">Cancel</button><button type="button" disabled={resetLoading} onClick={async () => {
                        setResetLoading(true); setSecurityError('');
                        try { const result = await onResetPassword?.(securityUser.id); if (!result?.temporaryPassword) throw new Error('The temporary password was not returned.'); setOneTimePassword(result.temporaryPassword); setSecurityUser(result.user); setResetConfirm(false); }
                        catch (error) { setSecurityError(error instanceof Error ? error.message : 'Unable to reset the password.'); }
                        finally { setResetLoading(false); }
                      }} className="rounded-lg bg-red-700 px-3 py-2 font-semibold text-white disabled:opacity-50">{resetLoading ? 'Generating…' : 'Generate New Password'}</button></div>
                    </section>
                  )}

                  {!resetConfirm && <form className="space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-700" onSubmit={async (event) => {
                    event.preventDefault(); setSecurityError('');
                    if (!passwordIsStrong(changedPassword)) { setSecurityError('Password must have at least 8 characters, uppercase and lowercase letters, a number, and a special character.'); return; }
                    if (changedPassword !== confirmChangedPassword) { setSecurityError('Passwords do not match.'); return; }
                    setResetLoading(true);
                    try { await onChangePassword?.(securityUser.id, changedPassword); setSecurityUser({ ...securityUser, mustChangePassword: false, passwordStatus: 'SET', passwordChangedAt: new Date().toISOString() }); setChangedPassword(''); setConfirmChangedPassword(''); }
                    catch (error) { setSecurityError(error instanceof Error ? error.message : 'Unable to change password.'); }
                    finally { setResetLoading(false); }
                  }}>
                    <h4 className="font-bold text-gray-900 dark:text-white">Change Password</h4>
                    <p className="text-[11px] text-gray-500">Minimum 8 characters, uppercase, lowercase, number, and special character.</p>
                    <label className="block font-semibold">New Password<input required autoComplete="new-password" type={showNewPassword ? 'text' : 'password'} value={changedPassword} onChange={(event) => setChangedPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 dark:border-gray-700" /></label>
                    <button type="button" onClick={() => setShowNewPassword((value) => !value)} className="text-[11px] text-blue-700">{showNewPassword ? 'Hide password' : 'Show password'}</button>
                    <label className="block font-semibold">Confirm Password<input required autoComplete="new-password" type={showConfirmPassword ? 'text' : 'password'} value={confirmChangedPassword} onChange={(event) => setConfirmChangedPassword(event.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 dark:border-gray-700" /></label>
                    <button type="button" onClick={() => setShowConfirmPassword((value) => !value)} className="text-[11px] text-blue-700">{showConfirmPassword ? 'Hide password' : 'Show password'}</button>
                    <div><button type="submit" disabled={resetLoading || !passwordIsStrong(changedPassword) || changedPassword !== confirmChangedPassword} className="rounded-lg bg-blue-700 px-3 py-2 font-semibold text-white disabled:opacity-50">{resetLoading ? 'Changing…' : 'Change Password'}</button></div>
                  </form>}
                </>
              )}

              {securityHistory.length > 0 && !oneTimePassword && <section className="rounded-xl border border-gray-200 p-4 dark:border-gray-700"><h4 className="mb-3 font-bold">Password History</h4><ul className="space-y-2">{securityHistory.map((item, index) => <li key={`${item.created_at}-${index}`} className="flex justify-between gap-3"><span>{String(item.action).replaceAll('_', ' ')} by {item.changed_by_name || 'User'}</span><time className="shrink-0 text-gray-500">{new Date(item.created_at).toLocaleString()}</time></li>)}</ul></section>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
