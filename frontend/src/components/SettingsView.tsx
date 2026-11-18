import React, { useEffect, useState } from "react";
import {
  Check,
  X,
  Pencil,
  Plus,
  Mail,
  Phone,
  MapPin,
  ShieldCheck,
  UserCircle,
  Gear,
  Database,
  Receipt,
  Warning,
  Clock,
  DownloadSimple,
  RefreshCw,
  Info,
} from "./ui/icons";
import { InputField, TextAreaField } from "./ui/Field";
import { apiUrl } from "../utils/api";

interface SettingsViewProps {
  currentUser?: {
    name: string;
    email: string;
    role?: string;
    phone?: string;
    region?: string;
    language?: string;
    mailingAddress?: string;
  };
  onUpdateProfile?: (updated: any) => void;
  financeOfficerName?: string;
  canManageFinanceSettings?: boolean;
  onSaveFinanceOfficerName?: (name: string) => Promise<void>;
  authToken?: string;
  canResetData?: boolean;
  maintenance?: { enabled: boolean; title: string; message: string; expectedCompletion: string | null; showCountdown: boolean; autoDisable: boolean } | null;
  onMaintenanceRefresh?: () => void;
  resetHistoryVersion?: number;
  onOpenResetData?: () => void;
  onBackupRestored?: () => void;
}

const toLocalDateTimeInputValue = (value: string | null): string => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  onUpdateProfile,
  financeOfficerName = "TQI Finance Team",
  canManageFinanceSettings = false,
  onSaveFinanceOfficerName,
  authToken = "",
  canResetData = false,
  maintenance = null,
  onMaintenanceRefresh,
  resetHistoryVersion = 0,
  onOpenResetData,
  onBackupRestored,
}) => {
  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem("tqi_personal_settings");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        /* fall through to defaults */
      }
    }
    return {
      name: currentUser?.name || "MITHUN P",
      region: "India",
      language: "English",
      email: currentUser?.email || "mithunmithun71548@gmail.com",
      emailVerified: true,
      phone: currentUser?.phone || "",
      mailingAddress: "",
    };
  });

  const [activeCategory, setActiveCategory] = useState<'personal' | 'maintenance' | 'backups' | 'finance' | 'reset' | 'history'>('personal');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Edit states for in-place Tesla-style editing
  const [isEditingBasic, setIsEditingBasic] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);

  const [basicForm, setBasicForm] = useState({
    name: profile.name,
    region: profile.region,
    language: profile.language,
  });
  const [emailForm, setEmailForm] = useState(profile.email);
  const [phoneForm, setPhoneForm] = useState(profile.phone);
  const [addressForm, setAddressForm] = useState(profile.mailingAddress);
  const [financeOfficerForm, setFinanceOfficerForm] = useState(financeOfficerName);
  const [isSavingFinanceOfficer, setIsSavingFinanceOfficer] = useState(false);
  const [resetHistory, setResetHistory] = useState<any[]>([]);
  const [resetHistoryError, setResetHistoryError] = useState("");
  const [expandedResetId, setExpandedResetId] = useState<string | null>(null);
  const [backups, setBackups] = useState<any[]>([]);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');
  const [backupError, setBackupError] = useState('');
  const [restoreTarget, setRestoreTarget] = useState<any | null>(null);
  const [restoreConfirmation, setRestoreConfirmation] = useState('');
  const [maintenanceForm, setMaintenanceForm] = useState({
    title: 'Website Under Maintenance',
    message: 'We are currently performing scheduled maintenance and system improvements. Please check back shortly.',
    expectedCompletion: '',
    showCountdown: true,
    autoDisable: false,
  });
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [maintenanceDraftOpen, setMaintenanceDraftOpen] = useState(false);

  useEffect(() => {
    if (!maintenance) return;
    setMaintenanceForm({
      title: maintenance.title || 'Website Under Maintenance',
      message: maintenance.message || 'We are currently performing scheduled maintenance and system improvements. Please check back shortly.',
      expectedCompletion: toLocalDateTimeInputValue(maintenance.expectedCompletion),
      showCountdown: Boolean(maintenance.showCountdown),
      autoDisable: Boolean(maintenance.autoDisable),
    });
  }, [maintenance]);

  useEffect(() => {
    if (!canResetData || !authToken) return;
    const controller = new AbortController();
    fetch(apiUrl('/api/admin/data-reset/history'), {
      headers: { Authorization: `Bearer ${authToken}` },
      cache: 'no-store',
      signal: controller.signal,
    }).then(async (response) => {
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to load reset history.');
      setResetHistory(Array.isArray(data.history) ? data.history : []);
      setResetHistoryError("");
    }).catch((error) => {
      if (!controller.signal.aborted) setResetHistoryError(error instanceof Error ? error.message : 'Unable to load reset history.');
    });
    return () => controller.abort();
  }, [canResetData, authToken, resetHistoryVersion]);

  const loadBackups = async () => {
    if (!canResetData || !authToken) return;
    const response = await fetch(apiUrl('/api/admin/backups'), { headers: { Authorization: `Bearer ${authToken}` }, cache: 'no-store' });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to load backups.');
    setBackups(Array.isArray(data.backups) ? data.backups : []);
  };

  useEffect(() => {
    if (!canResetData) return;
    void loadBackups().catch((error) => setBackupError(error instanceof Error ? error.message : 'Unable to load backups.'));
  }, [canResetData, authToken, resetHistoryVersion]);

  const createBackupNow = async () => {
    setBackupBusy(true); setBackupError(''); setBackupMessage('');
    try {
      const response = await fetch(apiUrl('/api/admin/backups'), { method: 'POST', headers: { Authorization: `Bearer ${authToken}` } });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to create backup.');
      setBackupMessage(`Backup created: ${data.backup.id}`);
      await loadBackups();
    } catch (error) { setBackupError(error instanceof Error ? error.message : 'Unable to create backup.'); }
    finally { setBackupBusy(false); }
  };

  const downloadBackup = async (backup: any) => {
    setBackupError('');
    try {
      const response = await fetch(apiUrl(`/api/admin/backups/${encodeURIComponent(backup.id)}/download`), { headers: { Authorization: `Bearer ${authToken}` } });
      if (!response.ok) throw new Error('Unable to download this backup.');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a'); link.href = url; link.download = `${backup.id}.zip`; link.click(); URL.revokeObjectURL(url);
    } catch (error) { setBackupError(error instanceof Error ? error.message : 'Unable to download backup.'); }
  };

  const restoreBackup = async () => {
    if (!restoreTarget || restoreConfirmation !== 'RESTORE') return;
    setBackupBusy(true); setBackupError(''); setBackupMessage('');
    try {
      const response = await fetch(apiUrl(`/api/admin/backups/${encodeURIComponent(restoreTarget.id)}/restore`), {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` }, body: JSON.stringify({ confirmation: restoreConfirmation }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to restore backup.');
      setBackupMessage(`Backup ${restoreTarget.id} restored. A safety backup (${data.safetyBackupId}) was created first.`);
      setRestoreTarget(null); setRestoreConfirmation(''); onBackupRestored?.(); await loadBackups();
    } catch (error) { setBackupError(error instanceof Error ? error.message : 'Unable to restore backup.'); }
    finally { setBackupBusy(false); }
  };

  useEffect(() => setFinanceOfficerForm(financeOfficerName), [financeOfficerName]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const saveProfile = (newProfile: typeof profile) => {
    setProfile(newProfile);
    localStorage.setItem("tqi_personal_settings", JSON.stringify(newProfile));
    onUpdateProfile?.(newProfile);
  };

  const handleMaintenanceAction = async (mode: 'enable' | 'disable' | 'update') => {
    if (!authToken || !currentUser || currentUser.role !== 'Super Admin') {
      showToast('Only Super Admin can manage maintenance mode.');
      return;
    }
    if (mode !== 'disable') {
      const endTime = new Date(maintenanceForm.expectedCompletion).getTime();
      if (!maintenanceForm.expectedCompletion || !Number.isFinite(endTime) || endTime <= Date.now()) {
        showToast('Set a future maintenance end date and time.');
        return;
      }
    }
    setMaintenanceBusy(true);
    try {
      const payload = {
        title: maintenanceForm.title,
        message: maintenanceForm.message,
        expectedCompletion: maintenanceForm.expectedCompletion ? new Date(maintenanceForm.expectedCompletion).toISOString() : null,
        showCountdown: maintenanceForm.showCountdown,
        autoDisable: maintenanceForm.autoDisable,
      };
      const response = await fetch(apiUrl(mode === 'disable' ? '/api/system/maintenance/disable' : mode === 'enable' ? '/api/system/maintenance/enable' : '/api/system/maintenance'), {
        method: mode === 'update' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to update maintenance settings.');
      onMaintenanceRefresh?.();
      showToast(data.message || 'Maintenance settings updated.');
      setMaintenanceDialogOpen(false);
      setMaintenanceDraftOpen(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to update maintenance settings.');
    } finally {
      setMaintenanceBusy(false);
    }
  };

  const handleSaveBasic = (e: React.FormEvent) => {
    e.preventDefault();
    saveProfile({
      ...profile,
      name: basicForm.name.trim() || profile.name,
      region: basicForm.region.trim() || profile.region,
      language: basicForm.language.trim() || profile.language,
    });
    setIsEditingBasic(false);
    showToast("Basic information updated");
  };

  const handleSaveEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailForm.trim()) return;
    saveProfile({ ...profile, email: emailForm.trim(), emailVerified: true });
    setIsEditingEmail(false);
    showToast("Email address updated");
  };

  const handleSavePhone = (e: React.FormEvent) => {
    e.preventDefault();
    saveProfile({ ...profile, phone: phoneForm.trim() });
    setIsEditingPhone(false);
    showToast(phoneForm.trim() ? "Phone number saved" : "Phone number removed");
  };

  const handleSaveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    saveProfile({ ...profile, mailingAddress: addressForm.trim() });
    setIsEditingAddress(false);
    showToast(addressForm.trim() ? "Mailing address saved" : "Mailing address removed");
  };

  const handleSaveFinanceOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = financeOfficerForm.trim().replace(/\s+/g, " ");
    if (!value || !onSaveFinanceOfficerName) return;
    setIsSavingFinanceOfficer(true);
    try {
      await onSaveFinanceOfficerName(value);
      showToast("Finance officer name updated");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to save finance settings");
    } finally {
      setIsSavingFinanceOfficer(false);
    }
  };

  // ERP Settings Domains with Lottie/Duotone styling
  const navItems = [
    { id: 'personal' as const, label: 'Personal Information', icon: UserCircle },
    ...(canResetData ? [
      { id: 'maintenance' as const, label: 'Website Maintenance', icon: Gear },
      { id: 'backups' as const, label: 'Backups & Snapshots', icon: Database },
    ] : []),
    ...(canManageFinanceSettings ? [
      { id: 'finance' as const, label: 'Finance Setup', icon: Receipt },
    ] : []),
    ...(canResetData ? [
      { id: 'reset' as const, label: 'Data Management', icon: Warning },
      { id: 'history' as const, label: 'Reset Audit History', icon: Clock },
    ] : []),
  ];

  return (
    <div className="w-full min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 py-6 px-4 sm:px-8 max-w-6xl mx-auto font-sans animate-in fade-in-0 duration-150">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[99999] flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-900 text-white px-4 py-3 text-xs font-medium shadow-xl dark:border-slate-800 dark:bg-white dark:text-slate-900">
          <ShieldCheck size={16} weight="duotone" className="text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
          <button type="button" onClick={() => setToastMessage(null)} className="ml-2 opacity-60 hover:opacity-100">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Two-Column Tesla Layout (Navigation + Content) */}
      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8 lg:gap-16 items-start pt-2">
        {/* Left Navigation: Account Settings */}
        <aside className="w-full shrink-0">
          <h2 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-4 px-2">
            Account Settings
          </h2>
          <nav className="flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0">
            {navItems.map((item) => {
              const IconComp = item.icon;
              const isActive = activeCategory === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveCategory(item.id)}
                  className={`flex items-center gap-3 px-3 py-2.5 text-xs text-left transition-colors whitespace-nowrap rounded-lg ${
                    isActive
                      ? 'font-bold text-slate-950 dark:text-white bg-slate-100 dark:bg-slate-900'
                      : 'font-medium text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-900/50'
                  }`}
                >
                  <IconComp size={18} weight="duotone" className={isActive ? 'text-[#1a73e8]' : 'text-slate-400'} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Center Main Content Area (Clean Tesla Whitespace-Driven Layout) */}
        <main className="min-w-0 max-w-2xl">
          {/* TAB 1: PERSONAL INFORMATION */}
          {activeCategory === 'personal' && (
            <div className="space-y-10 animate-in fade-in-0 duration-150">
              {/* Header */}
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Personal Information
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Manage your basic information, contact methods, and addresses
                </p>
              </div>

              {/* Basic Information Section */}
              <section className="space-y-4">
                <div className="flex items-center justify-between border-b border-transparent pb-1">
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Basic Information
                  </h2>
                  {!isEditingBasic ? (
                    <button
                      type="button"
                      onClick={() => {
                        setBasicForm({
                          name: profile.name,
                          region: profile.region,
                          language: profile.language,
                        });
                        setIsEditingBasic(true);
                      }}
                      className="text-xs font-normal text-slate-700 dark:text-slate-300 underline underline-offset-2 hover:text-[#1a73e8] dark:hover:text-white transition-colors cursor-pointer"
                    >
                      Edit
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditingBasic(false)}
                      className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                {!isEditingBasic ? (
                  <div className="space-y-4 text-xs">
                    <div>
                      <div className="text-slate-500 dark:text-slate-400">Name</div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                        {profile.name}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 dark:text-slate-400">Region</div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                        {profile.region}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-500 dark:text-slate-400">Language</div>
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                        {profile.language}
                      </div>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSaveBasic} className="space-y-3 max-w-md pt-1">
                    <InputField
                      label="Name"
                      required
                      value={basicForm.name}
                      onChange={(e) => setBasicForm({ ...basicForm, name: e.target.value })}
                    />
                    <InputField
                      label="Region"
                      required
                      value={basicForm.region}
                      onChange={(e) => setBasicForm({ ...basicForm, region: e.target.value })}
                    />
                    <InputField
                      label="Language"
                      required
                      value={basicForm.language}
                      onChange={(e) => setBasicForm({ ...basicForm, language: e.target.value })}
                    />
                    <div className="flex items-center gap-2.5 pt-1">
                      <button
                        type="submit"
                        className="rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-medium px-4 py-2 shadow-xs transition-colors cursor-pointer"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingBasic(false)}
                        className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                )}
              </section>

              {/* Contact Information Section */}
              <section className="space-y-4 pt-2">
                <div className="flex items-center justify-between border-b border-transparent pb-1">
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Contact Information
                  </h2>
                  {!isEditingEmail && !isEditingPhone ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEmailForm(profile.email);
                        setIsEditingEmail(true);
                      }}
                      className="text-xs font-normal text-slate-700 dark:text-slate-300 underline underline-offset-2 hover:text-[#1a73e8] dark:hover:text-white transition-colors cursor-pointer"
                    >
                      Edit
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingEmail(false);
                        setIsEditingPhone(false);
                      }}
                      className="text-xs text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      Cancel
                    </button>
                  )}
                </div>

                <div className="space-y-5 text-xs">
                  {/* Primary Email */}
                  <div>
                    <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                      <span>Primary Email</span>
                      <Info size={13} className="text-slate-400" />
                    </div>
                    {!isEditingEmail ? (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {profile.email}
                        </span>
                        {profile.emailVerified && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/80 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                            <Check size={11} weight="bold" /> Verified
                          </span>
                        )}
                      </div>
                    ) : (
                      <form onSubmit={handleSaveEmail} className="space-y-2 max-w-sm mt-1.5">
                        <InputField
                          type="email"
                          required
                          value={emailForm}
                          onChange={(e) => setEmailForm(e.target.value)}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="submit"
                            className="rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-medium px-3.5 py-1.5 shadow-xs transition-colors cursor-pointer"
                          >
                            Save email
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditingEmail(false)}
                            className="text-xs text-slate-500 px-2 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  {/* Primary Phone Number */}
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                        <span>Primary Phone Number</span>
                        <Info size={13} className="text-slate-400" />
                      </div>
                      {!isEditingPhone && (
                        <button
                          type="button"
                          onClick={() => {
                            setPhoneForm(profile.phone);
                            setIsEditingPhone(true);
                          }}
                          className="text-xs font-normal text-slate-700 dark:text-slate-300 underline underline-offset-2 hover:text-[#1a73e8] dark:hover:text-white cursor-pointer"
                        >
                          {profile.phone ? 'Edit' : 'Add'}
                        </button>
                      )}
                    </div>

                    {!isEditingPhone ? (
                      <div className="text-sm text-slate-700 dark:text-slate-300 mt-0.5 font-medium">
                        {profile.phone || 'No phone number added'}
                      </div>
                    ) : (
                      <form onSubmit={handleSavePhone} className="space-y-2 max-w-sm mt-1.5">
                        <InputField
                          type="tel"
                          placeholder="+91 98765 43210"
                          value={phoneForm}
                          onChange={(e) => setPhoneForm(e.target.value)}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="submit"
                            className="rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-medium px-3.5 py-1.5 shadow-xs transition-colors cursor-pointer"
                          >
                            Save phone
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditingPhone(false)}
                            className="text-xs text-slate-500 px-2 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              </section>

              {/* Addresses Section */}
              <section className="space-y-4 pt-2">
                <div className="flex items-center justify-between border-b border-transparent pb-1">
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Addresses
                  </h2>
                  {!isEditingAddress && (
                    <button
                      type="button"
                      onClick={() => {
                        setAddressForm(profile.mailingAddress);
                        setIsEditingAddress(true);
                      }}
                      className="text-xs font-normal text-slate-700 dark:text-slate-300 underline underline-offset-2 hover:text-[#1a73e8] dark:hover:text-white transition-colors cursor-pointer"
                    >
                      {profile.mailingAddress ? 'Edit' : 'Add'}
                    </button>
                  )}
                </div>

                <div className="space-y-4 text-xs">
                  <div>
                    <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400">
                      <span>Mailing</span>
                      <Info size={13} className="text-slate-400" />
                    </div>
                    {!isEditingAddress ? (
                      <div className="text-sm text-slate-700 dark:text-slate-300 mt-0.5 font-medium whitespace-pre-line">
                        {profile.mailingAddress || 'No mailing address added'}
                      </div>
                    ) : (
                      <form onSubmit={handleSaveAddress} className="space-y-2 max-w-md mt-1.5">
                        <TextAreaField
                          rows={3}
                          placeholder="e.g. 12/45, Gandhi Street, Dharmapuri, Tamil Nadu - 636701"
                          value={addressForm}
                          onChange={(e) => setAddressForm(e.target.value)}
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="submit"
                            className="rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-medium px-3.5 py-1.5 shadow-xs transition-colors cursor-pointer"
                          >
                            Save address
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsEditingAddress(false)}
                            className="text-xs text-slate-500 px-2 cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>
              </section>

              {/* Google-Style Security Checkup Card */}
              <section className="pt-4">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
                  <div className="space-y-1">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      Security Checkup
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Complete these steps to protect and be able to recover your account
                    </p>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-4 space-y-1.5">
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-[#1a73e8] h-full rounded-full transition-all duration-300 w-1/4" />
                    </div>
                    <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      1 of 4 completed
                    </p>
                  </div>

                  {/* Accordion / List of Security Items */}
                  <div className="mt-5 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                    {/* Item 1: Multi-Factor Authentication */}
                    <div className="py-3 flex items-start justify-between gap-3 group cursor-pointer">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-slate-700 dark:border-slate-300">
                          <div className="h-2 w-2 rounded-full bg-slate-800 dark:bg-slate-200" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            Set Up Multi-Factor Authentication
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Use authenticator app or SMS verification code for elevated portal security.
                          </div>
                        </div>
                      </div>
                      <span className="text-slate-400 text-xs mt-0.5 group-hover:text-slate-600">⌵</span>
                    </div>

                    {/* Item 2: Add Recovery Email */}
                    <div className="py-3 flex items-start justify-between gap-3 group cursor-pointer">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 h-4 w-4 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            Add Recovery Email
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            Alternative email to restore credentials if you lose primary mailbox access.
                          </div>
                        </div>
                      </div>
                      <span className="text-slate-400 text-xs mt-0.5 group-hover:text-slate-600">⌵</span>
                    </div>

                    {/* Item 3: Set Up Passkey */}
                    <div className="py-3 flex items-start justify-between gap-3 group cursor-pointer">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 h-4 w-4 rounded-full border-2 border-slate-300 dark:border-slate-600" />
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            Set Up Passkey
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            FIDO2 passkey for passwordless biometrics.
                          </p>
                        </div>
                      </div>
                      <span className="text-slate-400 text-xs mt-0.5 group-hover:text-slate-600">∧</span>
                    </div>

                    {/* Item 4: Email Verified */}
                    <div className="py-3 flex items-start justify-between gap-3 group cursor-pointer">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-4 w-4 items-center justify-center text-emerald-600 dark:text-emerald-400">
                          <Check size={14} weight="bold" />
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            Email Verified
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono">
                            {profile.email}
                          </div>
                        </div>
                      </div>
                      <span className="text-slate-400 text-xs mt-0.5 group-hover:text-slate-600">⌵</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* TAB 2: WEBSITE MAINTENANCE */}
          {activeCategory === 'maintenance' && canResetData && (
            <div className="space-y-8 animate-in fade-in-0 duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    Website Maintenance
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Control public visitor access and system deployment countdowns
                  </p>
                </div>
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                  maintenance?.enabled
                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                }`}>
                  <span className={`h-2 w-2 rounded-full ${maintenance?.enabled ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  {maintenance?.enabled ? 'Maintenance Active' : 'System Live'}
                </span>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 bg-white dark:bg-slate-900">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Maintenance Mode Switch
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {maintenance?.enabled
                        ? 'Non-admin users are blocked and shown the maintenance screen.'
                        : 'Normal users have full access to the portal.'}
                    </div>
                  </div>

                  {/* Tesla Capsule Toggle */}
                  <button
                    type="button"
                    onClick={() => maintenance?.enabled ? void handleMaintenanceAction('disable') : setMaintenanceDialogOpen(true)}
                    disabled={maintenanceBusy}
                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      maintenance?.enabled ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                        maintenance?.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {maintenance?.enabled && (
                  <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 grid gap-3 sm:grid-cols-2 text-xs">
                    <div>
                      <div className="text-slate-400">Scheduled End Time</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        {maintenance.expectedCompletion ? new Date(maintenance.expectedCompletion).toLocaleString() : 'Not configured'}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400">Auto Disable</div>
                      <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">
                        {maintenance.autoDisable ? 'Enabled' : 'Disabled'}
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-2 flex gap-2.5">
                  {maintenance?.enabled ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void handleMaintenanceAction('disable')}
                        disabled={maintenanceBusy}
                        className="rounded-lg bg-slate-900 text-white text-xs font-semibold px-4 py-2 hover:bg-black cursor-pointer"
                      >
                        {maintenanceBusy ? 'Updating…' : 'Disable Maintenance'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMaintenanceDraftOpen(true)}
                        className="rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 px-4 py-2 hover:bg-slate-50 cursor-pointer"
                      >
                        Edit Settings
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setMaintenanceDialogOpen(true)}
                      className="rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-semibold px-4 py-2 shadow-xs transition-colors cursor-pointer"
                    >
                      Schedule Maintenance
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BACKUPS & SNAPSHOTS */}
          {activeCategory === 'backups' && canResetData && (
            <div className="space-y-8 animate-in fade-in-0 duration-150">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    Backups &amp; Snapshots
                  </h1>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Automated snapshots preserve operational databases and uploaded files
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void createBackupNow()}
                  disabled={backupBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-semibold px-4 py-2 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw size={13} className={backupBusy ? 'animate-spin' : ''} />
                  {backupBusy ? 'Creating…' : 'Create Snapshot'}
                </button>
              </div>

              {backupMessage && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3.5 py-2 text-xs text-emerald-800">
                  {backupMessage}
                </div>
              )}
              {backupError && (
                <div className="rounded-lg bg-rose-50 border border-rose-200 px-3.5 py-2 text-xs text-rose-800">
                  {backupError}
                </div>
              )}

              {backups.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No snapshots recorded. Automated snapshots occur at startup.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-semibold text-slate-400 tracking-wider bg-slate-50 dark:bg-slate-900">
                        <th className="py-2.5 px-3">Created</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Size</th>
                        <th className="py-2.5 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {backups.map((backup) => (
                        <tr key={backup.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/50 transition-colors">
                          <td className="py-3 px-3 font-medium text-slate-800 dark:text-slate-200">
                            {new Date(backup.createdAt).toLocaleString()}
                          </td>
                          <td className="py-3 px-3 capitalize text-slate-600 dark:text-slate-400">
                            {backup.kind}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-400">
                            {(Number(backup.bytes || 0) / 1024 / 1024).toFixed(2)} MB
                          </td>
                          <td className="py-3 px-3 text-right">
                            <div className="inline-flex gap-2">
                              <button
                                type="button"
                                onClick={() => void downloadBackup(backup)}
                                className="rounded border border-slate-300 dark:border-slate-700 px-2.5 py-1 text-[11px] font-medium hover:bg-slate-50 cursor-pointer"
                              >
                                Download
                              </button>
                              <button
                                type="button"
                                onClick={() => { setRestoreTarget(backup); setRestoreConfirmation(''); setBackupError(''); }}
                                className="rounded border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 hover:bg-amber-100 cursor-pointer"
                              >
                                Restore
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: FINANCE SETUP */}
          {activeCategory === 'finance' && canManageFinanceSettings && (
            <div className="space-y-8 animate-in fade-in-0 duration-150">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Finance Setup
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Configure finance officer signature and export titles
                </p>
              </div>

              <form onSubmit={(event) => void handleSaveFinanceOfficer(event)} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                    Finance Officer Name
                  </label>
                  <input
                    required
                    value={financeOfficerForm}
                    onChange={(event) => setFinanceOfficerForm(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 px-3.5 py-2 text-xs text-slate-800 dark:text-slate-100 outline-none focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/20"
                    placeholder="e.g. TQI Finance Operations"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSavingFinanceOfficer || !financeOfficerForm.trim()}
                  className="rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white text-xs font-semibold px-4 py-2 shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSavingFinanceOfficer ? 'Saving…' : 'Save Finance Setup'}
                </button>
              </form>
            </div>
          )}

          {/* TAB 5: DATA RESET */}
          {activeCategory === 'reset' && canResetData && (
            <div className="space-y-8 animate-in fade-in-0 duration-150">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Data Management
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Manage operational data purge controls and academic cycle wipe
                </p>
              </div>

              <div className="rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-900 p-6 space-y-3">
                <div className="text-sm font-bold text-rose-800 dark:text-rose-400">
                  Scoped Data Reset
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 max-w-xl">
                  Selectively reset module records (attendance, session curriculum, finance expenses) for specific cycles.
                  Protected admin accounts and audit trails are never purged.
                </p>
                <button
                  type="button"
                  onClick={onOpenResetData}
                  className="rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold px-4 py-2 shadow-xs cursor-pointer"
                >
                  Open Reset Console
                </button>
              </div>
            </div>
          )}

          {/* TAB 6: AUDIT HISTORY */}
          {activeCategory === 'history' && canResetData && (
            <div className="space-y-8 animate-in fade-in-0 duration-150">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Audit History
                </h1>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Immutable record of administrative operations
                </p>
              </div>

              {resetHistory.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No operations recorded in this cycle.
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-slate-800 text-[10px] uppercase font-semibold text-slate-400 bg-slate-50 dark:bg-slate-900">
                        <th className="py-2.5 px-3">Timestamp</th>
                        <th className="py-2.5 px-3">Admin</th>
                        <th className="py-2.5 px-3">Module</th>
                        <th className="py-2.5 px-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {resetHistory.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-850/50 transition-colors">
                          <td className="py-2.5 px-3 text-slate-800 dark:text-slate-200">
                            {item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                            {item.adminName || 'Super Admin'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">
                            {item.moduleLabel || item.module || '—'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="text-[10px] font-semibold text-emerald-700">
                              {item.status || 'SUCCESS'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="mt-20 pt-8 border-t border-slate-100 dark:border-slate-900 text-center text-xs text-slate-400">
        TQI ERP &copy; 2026 &nbsp;&nbsp; Privacy &amp; Legal
      </footer>

      {/* Maintenance Dialog Modal */}
      {maintenanceDialogOpen && (
        <div className="fixed inset-0 z-[100002] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900 p-6 shadow-2xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Enable Maintenance Mode
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Temporarily restricts access for non-super-admin users.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMaintenanceDialogOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Maintenance Title
                </label>
                <input
                  value={maintenanceForm.title}
                  onChange={(event) => setMaintenanceForm((prev) => ({ ...prev, title: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 px-3 py-2 text-xs outline-none focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/20"
                  placeholder="Website Under Maintenance"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Maintenance Message
                </label>
                <textarea
                  value={maintenanceForm.message}
                  onChange={(event) => setMaintenanceForm((prev) => ({ ...prev, message: event.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 px-3 py-2 text-xs outline-none focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/20"
                  placeholder="We are currently performing scheduled maintenance."
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Expected Completion Time
                </label>
                <input
                  type="datetime-local"
                  value={maintenanceForm.expectedCompletion}
                  onChange={(event) => setMaintenanceForm((prev) => ({ ...prev, expectedCompletion: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 px-3 py-2 text-xs outline-none focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/20"
                />
              </div>

              <div className="space-y-2 pt-1 text-slate-600 dark:text-slate-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={maintenanceForm.showCountdown}
                    onChange={(event) => setMaintenanceForm((prev) => ({ ...prev, showCountdown: event.target.checked }))}
                    className="rounded border-slate-300 text-[#1a73e8] focus:ring-[#1a73e8]"
                  />
                  <span>Display countdown clock to visitors</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={maintenanceForm.autoDisable}
                    onChange={(event) => setMaintenanceForm((prev) => ({ ...prev, autoDisable: event.target.checked }))}
                    className="rounded border-slate-300 text-[#1a73e8] focus:ring-[#1a73e8]"
                  />
                  <span>Automatically restore normal access upon completion</span>
                </label>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2.5 border-t border-slate-100 pt-3.5 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setMaintenanceDialogOpen(false)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={maintenanceBusy}
                onClick={() => void handleMaintenanceAction('enable')}
                className="rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white px-4 py-2 text-xs font-medium shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {maintenanceBusy ? 'Enabling…' : 'Enable Maintenance'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Maintenance Settings Modal */}
      {maintenanceDraftOpen && (
        <div className="fixed inset-0 z-[100002] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900 p-6 shadow-2xl animate-in fade-in-0 zoom-in-95">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  Edit Maintenance Settings
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update the live maintenance notice and timer.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMaintenanceDraftOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              >
                <X size={15} />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Maintenance Title
                </label>
                <input
                  value={maintenanceForm.title}
                  onChange={(event) => setMaintenanceForm((prev) => ({ ...prev, title: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 px-3 py-2 text-xs outline-none focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/20"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Maintenance Message
                </label>
                <textarea
                  value={maintenanceForm.message}
                  onChange={(event) => setMaintenanceForm((prev) => ({ ...prev, message: event.target.value }))}
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 px-3 py-2 text-xs outline-none focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/20"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Expected Completion Time
                </label>
                <input
                  type="datetime-local"
                  value={maintenanceForm.expectedCompletion}
                  onChange={(event) => setMaintenanceForm((prev) => ({ ...prev, expectedCompletion: event.target.value }))}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 px-3 py-2 text-xs outline-none focus:border-[#1a73e8] focus:ring-2 focus:ring-[#1a73e8]/20"
                />
              </div>

              <div className="space-y-2 pt-1 text-slate-600 dark:text-slate-300">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={maintenanceForm.showCountdown}
                    onChange={(event) => setMaintenanceForm((prev) => ({ ...prev, showCountdown: event.target.checked }))}
                    className="rounded border-slate-300 text-[#1a73e8] focus:ring-[#1a73e8]"
                  />
                  <span>Display countdown clock</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={maintenanceForm.autoDisable}
                    onChange={(event) => setMaintenanceForm((prev) => ({ ...prev, autoDisable: event.target.checked }))}
                    className="rounded border-slate-300 text-[#1a73e8] focus:ring-[#1a73e8]"
                  />
                  <span>Auto-restore system when timer finishes</span>
                </label>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2.5 border-t border-slate-100 pt-3.5 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setMaintenanceDraftOpen(false)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={maintenanceBusy}
                onClick={() => void handleMaintenanceAction('update')}
                className="rounded-lg bg-[#1a73e8] hover:bg-[#1557b0] text-white px-4 py-2 text-xs font-medium shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                {maintenanceBusy ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Operational Backup Modal */}
      {restoreTarget && (
        <div className="fixed inset-0 z-[100002] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-200/90 bg-white dark:border-slate-800 dark:bg-slate-900 p-6 shadow-2xl animate-in fade-in-0 zoom-in-95">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Restore Operational Snapshot?
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              This replaces operational tables with the snapshot created on {new Date(restoreTarget.createdAt).toLocaleString()}.
              User accounts, settings, and audit logs are protected and will remain unchanged.
            </p>
            {backupError && <p role="alert" className="rounded-lg bg-rose-50 p-2.5 text-xs text-rose-800">{backupError}</p>}
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
              Type <span className="font-mono font-bold text-rose-600">RESTORE</span> to confirm:
              <input
                autoComplete="off"
                value={restoreConfirmation}
                onChange={(event) => setRestoreConfirmation(event.target.value)}
                className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 px-3 py-2 text-xs font-mono outline-none focus:border-[#1a73e8]"
                placeholder="RESTORE"
              />
            </label>
            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                disabled={backupBusy}
                onClick={() => { setRestoreTarget(null); setRestoreConfirmation(''); setBackupError(''); }}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-850 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={backupBusy || restoreConfirmation !== 'RESTORE'}
                onClick={() => void restoreBackup()}
                className="rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 text-xs font-medium shadow-xs transition-colors disabled:opacity-40 cursor-pointer"
              >
                {backupBusy ? 'Restoring…' : 'Restore Snapshot'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
