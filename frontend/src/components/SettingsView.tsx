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

/**
 * Personal Information — Profile settings view.
 *
 * Layout:
 *   - Page hero (eyebrow + h1 + sub)
 *   - Three .tqi-card sections: Basic, Contact, Addresses
 *   - Each field rendered as a label/value pair using .tqi-field-label
 *     (theme-aware contrast: var(--text-secondary) in light, #C8CCD3 in dark)
 *   - Edit states swap label/value for the Field component
 */
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

  const [toastMessage, setToastMessage] = useState<string | null>(null);
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
      setBackupMessage(`Backup ${restoreTarget.id} restored. A safety backup (${data.safetyBackupId}) was created first. Protected users, settings, and audit logs were preserved.`);
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
        showToast('Set a future maintenance end date and time to show the countdown.');
        return;
      }
      if (!maintenanceForm.showCountdown) {
        showToast('Enable the countdown timer so users can see when maintenance is expected to finish.');
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
      showToast(data.message || 'Maintenance settings updated successfully.');
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
    showToast("Basic information saved successfully");
  };

  const handleSaveEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailForm.trim()) return;
    saveProfile({ ...profile, email: emailForm.trim(), emailVerified: true });
    setIsEditingEmail(false);
    showToast("Primary email updated");
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
    showToast(
      addressForm.trim() ? "Mailing address saved" : "Mailing address removed",
    );
  };

  const handleSaveFinanceOfficer = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = financeOfficerForm.trim().replace(/\s+/g, " ");
    if (!value || !onSaveFinanceOfficerName) return;
    setIsSavingFinanceOfficer(true);
    try {
      await onSaveFinanceOfficerName(value);
      showToast("Finance officer name saved and will autofill finance statements");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to save finance settings");
    } finally {
      setIsSavingFinanceOfficer(false);
    }
  };

  // Inline edit link — pencil + label, brand-tinted on hover
  const EditLink: React.FC<{
    onClick: () => void;
    label: string;
  }> = ({ onClick, label }) => (
    <button
      type="button"
      onClick={onClick}
      className="tqi-btn-ghost group inline-flex items-center gap-1.5 text-[13px] font-semibold"
      style={{ color: "var(--text-secondary)" }}
    >
      <Pencil
        size={14}
        weight="light"
        style={{ color: "var(--text-muted)" }}
      />
      <span className="group-hover:underline group-hover:underline-offset-4 group-hover:decoration-2 transition-colors" style={{ textUnderlineOffset: 4 }}>
        {label}
      </span>
    </button>
  );

  const CancelLink: React.FC<{ onClick: () => void }> = ({ onClick }) => (
    <button
      type="button"
      onClick={onClick}
      className="tqi-btn-ghost text-[13px] font-semibold"
      style={{ color: "var(--text-muted)" }}
    >
      Cancel
    </button>
  );

  // ReadField removed in favor of SettingsRow (label-left / value-right pattern).

  /**
   * SettingsRow — horizontal settings pattern (label-left / value-right).
   * Matches Linear / Notion / Stripe Dashboard. Labels align in a fixed
   * left column, values fill the right; the row stack lives inside a
   * vertical list. Edit action sits at the row's right edge.
   */
  const SettingsRow: React.FC<{
    label: string;
    hint?: string;
    children: React.ReactNode;
    action?: React.ReactNode;
    divider?: boolean;
  }> = ({ label, hint, children, action, divider = true }) => (
    <div
      className="grid grid-cols-1 sm:grid-cols-[180px_1fr_auto] gap-3 sm:gap-6 items-start"
      style={{
        padding: "1.1rem 0",
        borderBottom: divider ? "1px solid var(--border-subtle)" : "none",
      }}
    >
      <div className="sm:pt-0.5">
        <div
          style={{
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--text-secondary)",
            letterSpacing: "-0.005em",
          }}
        >
          {label}
        </div>
        {hint && (
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              marginTop: 2,
              lineHeight: 1.45,
            }}
          >
            {hint}
          </div>
        )}
      </div>
      <div className="min-w-0">{children}</div>
      {action && <div className="sm:pt-0.5 sm:justify-self-end">{action}</div>}
    </div>
  );

  return (
    <div className="w-full max-w-5xl py-2 px-1 sm:px-4">
      {/* Toast */}
      {toastMessage && (
        <div
          className="fixed bottom-6 right-6 z-[99999] flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold shadow-theme-lg animate-in fade-in-0 slide-in-from-bottom-5"
          style={{ background: "var(--text)", color: "var(--card)" }}
        >
          <ShieldCheck size={16} weight="light" style={{ color: "var(--success)" }} />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 cursor-pointer opacity-70 hover:opacity-100 transition-opacity"
          >
            <X size={14} weight="light" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="tqi-page-hero mb-10" style={{ padding: "1.75rem 1.75rem" }}>
        <div
          className="tqi-section-eyebrow"
          style={{
            fontSize: "0.6875rem",
            fontWeight: 600,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "var(--brand)",
            marginBottom: 8,
          }}
        >
          Account & Profile
        </div>
        <h1
          className="font-bold tracking-tight"
          style={{
            fontSize: "1.75rem",
            lineHeight: 1.15,
            color: "var(--text)",
            letterSpacing: "-0.02em",
          }}
        >
          Personal Information
        </h1>
        <p
          className="mt-2 text-sm"
          style={{ color: "var(--text-muted)", maxWidth: "44ch" }}
        >
          Manage your basic information, contact methods, and addresses.
          Changes are saved to this device.
        </p>
      </div>

      <div className="space-y-6">
        {canResetData && (
          <section className="tqi-card border border-red-200 dark:border-red-900/70" style={{ padding: "1.5rem 1.75rem" }}>
            <div className="mb-4 flex flex-col gap-4 border-b pb-4" style={{ borderColor: "var(--border-subtle)" }}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#0B3D91]">System Settings</div>
                  <h2 className="mt-1 text-lg font-black text-[#0B3D91]">Website Maintenance Mode</h2>
                </div>
                <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${maintenance?.enabled ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  <span className={`h-2.5 w-2.5 rounded-full ${maintenance?.enabled ? 'bg-red-600' : 'bg-emerald-600'}`} />
                  {maintenance?.enabled ? 'Maintenance mode active' : 'Website is live'}
                </span>
              </div>
              <p className="text-sm text-slate-600">Temporarily disable access to the TQI application while system maintenance, updates, bug fixes or deployments are in progress.</p>
            </div>

            {maintenance?.enabled ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-black text-red-800"><span className="text-lg">🔴</span> MAINTENANCE MODE ACTIVE</div>
                  <p className="mt-2 text-sm text-red-700">Normal users are currently blocked from accessing the application.</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Maintenance until</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{maintenance.expectedCompletion ? new Date(maintenance.expectedCompletion).toLocaleString() : 'End time not set — edit settings to add a countdown'}</div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Auto disable</div>
                    <div className="mt-2 text-sm font-semibold text-slate-900">{maintenance.autoDisable ? 'Enabled' : 'Disabled'}</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={() => void handleMaintenanceAction('disable')} disabled={maintenanceBusy} className="rounded-lg bg-red-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-800 disabled:opacity-60">{maintenanceBusy ? 'Updating…' : 'Disable Maintenance Mode'}</button>
                  <button type="button" onClick={() => setMaintenanceDraftOpen(true)} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50">Edit Settings</button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center gap-2 text-sm font-black text-emerald-800"><span className="text-lg">🟢</span> WEBSITE IS LIVE</div>
                  <p className="mt-2 text-sm text-emerald-700">All users can currently access the application.</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                  Super Admin will continue to have full access to the application even when maintenance mode is enabled.
                </div>
                <button type="button" onClick={() => setMaintenanceDialogOpen(true)} className="rounded-lg bg-[#0B3D91] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#092d67]">Enable Maintenance Mode</button>
              </div>
            )}
          </section>
        )}

        {canResetData && <section className="tqi-card border border-blue-200 dark:border-blue-900/70" style={{ padding: "1.5rem 1.75rem" }}>
          <div className="mb-4 flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: "var(--border-subtle)" }}>
            <div><h2 className="font-bold tracking-tight text-blue-900 dark:text-blue-200" style={{ fontSize: "1.0625rem" }}>Operational Backup &amp; Restore</h2><p className="mt-1 text-xs" style={{ color: "var(--text-muted)" }}>Automatic daily backups are stored on the backend. Snapshots preserve operational tables and uploads; accounts, passwords, settings, academic setup, and audit logs are excluded.</p></div>
            <button type="button" onClick={() => void createBackupNow()} disabled={backupBusy} className="shrink-0 rounded-lg bg-blue-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-800 disabled:opacity-50">{backupBusy ? 'Working…' : 'Create Backup Now'}</button>
          </div>
          {backupMessage && <p role="status" className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{backupMessage}</p>}
          {backupError && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-800">{backupError}</p>}
          {backups.length === 0 ? <p className="py-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>No backups available yet. The first automatic snapshot is created when the backend starts.</p> : <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-xs"><thead><tr className="border-b text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)", borderColor: "var(--border-subtle)" }}><th className="py-2 pr-3">Created</th><th className="py-2 pr-3">Type</th><th className="py-2 pr-3">Snapshot Size</th><th className="py-2 pr-3">Upload Files</th><th className="py-2">Actions</th></tr></thead><tbody>{backups.map((backup) => <tr key={backup.id} className="border-b last:border-0" style={{ borderColor: "var(--border-subtle)" }}><td className="py-3 pr-3">{new Date(backup.createdAt).toLocaleString()}</td><td className="py-3 pr-3 capitalize">{backup.kind}</td><td className="py-3 pr-3">{(Number(backup.bytes || 0) / 1024 / 1024).toFixed(2)} MB</td><td className="py-3 pr-3">{backup.includesUploads ? 'Included' : 'No uploads'}</td><td className="py-3"><div className="flex gap-2"><button type="button" onClick={() => void downloadBackup(backup)} className="rounded-md border border-gray-300 px-2.5 py-1.5 text-[11px] font-semibold dark:border-gray-700">Download</button><button type="button" onClick={() => { setRestoreTarget(backup); setRestoreConfirmation(''); setBackupError(''); }} className="rounded-md border border-amber-300 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 dark:border-amber-900 dark:text-amber-200">Restore</button></div></td></tr>)}</tbody></table>
          </div>}
        </section>}

        {canResetData && <section className="tqi-card border border-red-200 dark:border-red-900/70" style={{ padding: "1.5rem 1.75rem" }}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold tracking-tight text-red-800 dark:text-red-300" style={{ fontSize: "1.0625rem" }}>Administration &amp; Data Reset</h2>
              <p className="mt-1 max-w-2xl text-xs" style={{ color: "var(--text-muted)" }}>Reset only a selected operational module and scope. The Super Admin account, authentication, settings, role permissions, and audit logs are protected.</p>
            </div>
            <button type="button" onClick={onOpenResetData} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-red-300 bg-red-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
              <span aria-hidden="true">⚠</span> Reset Data
            </button>
          </div>
        </section>}

        {canManageFinanceSettings && <section className="tqi-card" style={{ padding: "1.5rem 1.75rem" }}>
          <div className="mb-4 border-b pb-3" style={{ borderColor: "var(--border-subtle)" }}>
            <h2 className="font-bold tracking-tight" style={{ fontSize: "1.0625rem", color: "var(--text)" }}>Finance statement setup</h2>
            <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>This finance officer name is autofilled on finance forms and downloaded statements.</p>
          </div>
          <form onSubmit={(event) => void handleSaveFinanceOfficer(event)} className="flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end">
            <label className="flex-1 text-xs font-semibold" style={{ color: "var(--text-secondary)" }}>Finance officer name
              <input required value={financeOfficerForm} onChange={(event) => setFinanceOfficerForm(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white" placeholder="Finance officer name" />
            </label>
            <button type="submit" disabled={isSavingFinanceOfficer || !financeOfficerForm.trim()} className="tqi-btn-primary disabled:opacity-50">{isSavingFinanceOfficer ? "Saving…" : "Save finance setup"}</button>
          </form>
        </section>}

        {canResetData && <section className="tqi-card" style={{ padding: "1.5rem 1.75rem" }}>
          <div className="mb-4 flex items-center justify-between gap-3 border-b pb-3" style={{ borderColor: "var(--border-subtle)" }}>
            <div>
              <h2 className="font-bold tracking-tight" style={{ fontSize: "1.0625rem", color: "var(--text)" }}>Reset History</h2>
              <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>Recent scoped reset attempts recorded in the protected audit log.</p>
            </div>
          </div>
          {resetHistoryError ? <p role="alert" className="text-xs text-red-700">{resetHistoryError}</p> : resetHistory.length === 0 ? <p className="py-5 text-center text-xs" style={{ color: "var(--text-muted)" }}>No reset operations recorded.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead><tr className="border-b text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)", borderColor: "var(--border-subtle)" }}><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Admin</th><th className="py-2 pr-3">Module</th><th className="py-2 pr-3">Scope</th><th className="py-2 pr-3">Records</th><th className="py-2 pr-3">Status</th><th className="py-2">Action</th></tr></thead>
                <tbody>{resetHistory.map((item) => <React.Fragment key={item.id}>
                  <tr className="border-b" style={{ borderColor: "var(--border-subtle)" }}>
                    <td className="py-3 pr-3 whitespace-nowrap">{item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}</td>
                    <td className="py-3 pr-3">{item.adminName || 'Super Admin'}</td>
                    <td className="py-3 pr-3">{item.moduleLabel || item.module || '—'}</td>
                    <td className="py-3 pr-3">{item.scopeLabel || item.scope || '—'}</td>
                    <td className="py-3 pr-3 tabular-nums">{Number(item.records || 0)}{String(item.module || '').startsWith('finance') && <span className="text-[10px] opacity-70"> ({Number(item.expenses || 0)} expenses · {Number(item.bills || 0)} bills)</span>}{Number(item.relatedRecords || 0) > 0 && <span className="text-[10px] opacity-70"> · {Number(item.relatedRecords || 0)} related</span>}</td>
                    <td className="py-3 pr-3"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${String(item.status).startsWith('SUCCESS') ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300'}`}>{item.status || 'UNKNOWN'}</span></td>
                    <td className="py-3"><button type="button" onClick={() => setExpandedResetId((current) => current === item.id ? null : item.id)} className="font-semibold text-blue-700 hover:underline dark:text-blue-300">{expandedResetId === item.id ? 'Hide' : 'Details'}</button></td>
                  </tr>
                  {expandedResetId === item.id && <tr className="border-b bg-gray-50/70 dark:bg-gray-800/40" style={{ borderColor: "var(--border-subtle)" }}><td colSpan={7} className="px-3 py-3 text-[11px]">
                    <div className="grid gap-2 sm:grid-cols-2"><div><strong>Reset ID:</strong> {item.resetId || '—'}</div><div><strong>Admin ID:</strong> {item.adminId || '—'}</div><div><strong>Client IP:</strong> {item.ip || 'Not available'}</div><div><strong>Device:</strong> {item.userAgent || 'Not available'}</div></div>
                    {item.error && <p className="mt-2 text-red-700"><strong>Error:</strong> {item.error}</p>}
                    {Array.isArray(item.fileCleanupErrors) && item.fileCleanupErrors.length > 0 && <p className="mt-2 text-amber-700"><strong>File cleanup:</strong> {item.fileCleanupErrors.join(' ')}</p>}
                  </td></tr>}
                </React.Fragment>)}</tbody>
              </table>
            </div>
          )}
        </section>}

        {/* Basic Information */}
        <section className="tqi-card" style={{ padding: "1.5rem 1.75rem" }}>
          <div
            className="flex items-center justify-between"
            style={{ marginBottom: "0.25rem", paddingBottom: "0.85rem", borderBottom: "1px solid var(--border-subtle)" }}
          >
            <div>
              <h2
                className="font-bold tracking-tight"
                style={{ fontSize: "1.0625rem", color: "var(--text)" }}
              >
                Basic Information
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                How your identity is presented across TQI-ERP
              </p>
            </div>
            {!isEditingBasic ? (
              <EditLink
                onClick={() => {
                  setBasicForm({
                    name: profile.name,
                    region: profile.region,
                    language: profile.language,
                  });
                  setIsEditingBasic(true);
                }}
                label="Edit"
              />
            ) : (
              <CancelLink onClick={() => setIsEditingBasic(false)} />
            )}
          </div>

          {!isEditingBasic ? (
            <div className="tqi-rise">
              <SettingsRow
                label="Full name"
                hint="As shown across TQI-ERP"
                divider
              >
                <span
                  style={{
                    color: "var(--text)",
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    letterSpacing: "-0.005em",
                  }}
                >
                  {profile.name}
                </span>
              </SettingsRow>
              <SettingsRow label="Region" hint="Country of operation" divider>
                <span
                  style={{
                    color: "var(--text)",
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    letterSpacing: "-0.005em",
                  }}
                >
                  {profile.region}
                </span>
              </SettingsRow>
              <SettingsRow label="Language" hint="Default app locale" divider={false}>
                <span
                  style={{
                    color: "var(--text)",
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    letterSpacing: "-0.005em",
                  }}
                >
                  {profile.language}
                </span>
              </SettingsRow>
            </div>
          ) : (
            <form onSubmit={handleSaveBasic} className="tqi-rise space-y-4 max-w-xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InputField
                  label="Full name"
                  required
                  value={basicForm.name}
                  onChange={(e) =>
                    setBasicForm({ ...basicForm, name: e.target.value })
                  }
                />
                <InputField
                  label="Region"
                  required
                  value={basicForm.region}
                  onChange={(e) =>
                    setBasicForm({ ...basicForm, region: e.target.value })
                  }
                />
              </div>
              <InputField
                label="Language"
                required
                value={basicForm.language}
                onChange={(e) =>
                  setBasicForm({ ...basicForm, language: e.target.value })
                }
              />
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="submit"
                  className="tqi-btn-primary inline-flex items-center gap-2"
                >
                  Save changes
                </button>
                <CancelLink onClick={() => setIsEditingBasic(false)} />
              </div>
            </form>
          )}
        </section>

        {/* Contact Information */}
        <section className="tqi-card" style={{ padding: "1.5rem 1.75rem" }}>
          <div
            className="flex items-center justify-between"
            style={{ marginBottom: "1.25rem", paddingBottom: "0.85rem", borderBottom: "1px solid var(--border-subtle)" }}
          >
            <div>
              <h2
                className="font-bold tracking-tight"
                style={{ fontSize: "1.0625rem", color: "var(--text)" }}
              >
                Contact Information
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Verified ways for TQI to reach you
              </p>
            </div>
          </div>

          <div className="tqi-rise">
            {/* Email */}
            <SettingsRow
              label="Primary email"
              hint="Used for sign-in and important notifications"
              action={
                !isEditingEmail ? (
                  <EditLink
                    onClick={() => {
                      setEmailForm(profile.email);
                      setIsEditingEmail(true);
                    }}
                    label="Edit"
                  />
                ) : undefined
              }
              divider
            >
              {!isEditingEmail ? (
                <div className="flex flex-wrap items-center gap-2.5">
                  <span
                    className="inline-flex items-center gap-2"
                    style={{
                      color: "var(--text)",
                      fontSize: "0.9375rem",
                      fontWeight: 600,
                    }}
                  >
                    <Mail
                      size={14}
                      weight="light"
                      style={{ color: "var(--text-muted)" }}
                    />
                    {profile.email}
                  </span>
                  {profile.emailVerified && (
                    <span
                      className="tqi-chip tqi-chip-success"
                      style={{ fontSize: "0.6875rem" }}
                    >
                      <Check size={12} weight="bold" />
                      Verified
                    </span>
                  )}
                </div>
              ) : (
                <form
                  onSubmit={handleSaveEmail}
                  className="tqi-rise space-y-3 max-w-md"
                >
                  <InputField
                    type="email"
                    required
                    value={emailForm}
                    onChange={(e) => setEmailForm(e.target.value)}
                  />
                  <div className="flex items-center gap-3">
                    <button type="submit" className="tqi-btn-primary">
                      Save email
                    </button>
                    <CancelLink onClick={() => setIsEditingEmail(false)} />
                  </div>
                </form>
              )}
            </SettingsRow>

            {/* Phone */}
            <SettingsRow
              label="Primary phone"
              hint="Optional — used for SMS alerts only"
              action={
                !isEditingPhone && profile.phone ? (
                  <EditLink
                    onClick={() => {
                      setPhoneForm(profile.phone);
                      setIsEditingPhone(true);
                    }}
                    label="Edit"
                  />
                ) : undefined
              }
              divider={false}
            >
              {!isEditingPhone ? (
                profile.phone ? (
                  <span
                    className="inline-flex items-center gap-2"
                    style={{
                      color: "var(--text)",
                      fontSize: "0.9375rem",
                      fontWeight: 600,
                      fontFamily:
                        "ui-monospace, SFMono-Regular, Menlo, monospace",
                      letterSpacing: "-0.01em",
                    }}
                  >
                    <Phone
                      size={14}
                      weight="light"
                      style={{ color: "var(--text-muted)" }}
                    />
                    {profile.phone}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneForm(profile.phone);
                      setIsEditingPhone(true);
                    }}
                    className="tqi-btn-ghost"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "0.5rem 0.75rem",
                      borderRadius: 10,
                      border: "1px dashed var(--border)",
                      color: "var(--text-muted)",
                      background: "transparent",
                      fontSize: "0.875rem",
                      fontWeight: 500,
                      cursor: "pointer",
                      transition: "all 0.18s var(--ease-out-expo)",
                    }}
                  >
                    <Plus
                      size={14}
                      weight="light"
                      style={{ color: "var(--brand)" }}
                    />
                    Add a phone number
                  </button>
                )
              ) : (
                <form
                  onSubmit={handleSavePhone}
                  className="tqi-rise space-y-3 max-w-md"
                >
                  <InputField
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phoneForm}
                    onChange={(e) => setPhoneForm(e.target.value)}
                  />
                  <div className="flex items-center gap-3">
                    <button type="submit" className="tqi-btn-primary">
                      Save phone
                    </button>
                    <CancelLink onClick={() => setIsEditingPhone(false)} />
                  </div>
                </form>
              )}
            </SettingsRow>
          </div>
        </section>

        {/* Addresses */}
        <section className="tqi-card" style={{ padding: "1.5rem 1.75rem" }}>
          <div
            className="flex items-center justify-between"
            style={{ marginBottom: "0.25rem", paddingBottom: "0.85rem", borderBottom: "1px solid var(--border-subtle)" }}
          >
            <div>
              <h2
                className="font-bold tracking-tight"
                style={{ fontSize: "1.0625rem", color: "var(--text)" }}
              >
                Addresses
              </h2>
              <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                Postal address for physical correspondence
              </p>
            </div>
          </div>

          <div className="tqi-rise">
            <SettingsRow
              label="Mailing address"
              hint="Optional"
              action={
                !isEditingAddress && profile.mailingAddress ? (
                  <EditLink
                    onClick={() => {
                      setAddressForm(profile.mailingAddress);
                      setIsEditingAddress(true);
                    }}
                    label="Edit"
                  />
                ) : undefined
              }
              divider={false}
            >
              {!isEditingAddress ? (
                profile.mailingAddress ? (
                  <span
                    className="inline-flex items-start gap-2"
                    style={{
                      color: "var(--text)",
                      fontSize: "0.9375rem",
                      fontWeight: 500,
                      whiteSpace: "pre-line",
                      lineHeight: 1.5,
                    }}
                  >
                    <MapPin
                      size={14}
                      weight="light"
                      style={{
                        color: "var(--text-muted)",
                        marginTop: 3,
                        flexShrink: 0,
                      }}
                    />
                    {profile.mailingAddress}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setAddressForm(profile.mailingAddress);
                      setIsEditingAddress(true);
                    }}
                    className="tqi-btn-ghost"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                        padding: "0.5rem 0.75rem",
                        borderRadius: 10,
                        border: "1px dashed var(--border)",
                        color: "var(--text-muted)",
                        background: "transparent",
                        fontSize: "0.875rem",
                        fontWeight: 500,
                        cursor: "pointer",
                        transition: "all 0.18s var(--ease-out-expo)",
                      }}
                    >
                      <Plus
                        size={14}
                        weight="light"
                        style={{ color: "var(--brand)" }}
                      />
                      Add a mailing address
                    </button>
                  )
              ) : (
                <form
                  onSubmit={handleSaveAddress}
                  className="tqi-rise space-y-3 max-w-lg"
                >
                  <TextAreaField
                    rows={3}
                    placeholder="e.g. 12/45, Gandhi Street, Dharmapuri, Tamil Nadu - 636701"
                    value={addressForm}
                    onChange={(e) => setAddressForm(e.target.value)}
                  />
                  <div className="flex items-center gap-3">
                    <button type="submit" className="tqi-btn-primary">
                      Save address
                    </button>
                    <CancelLink onClick={() => setIsEditingAddress(false)} />
                  </div>
                </form>
              )}
            </SettingsRow>
          </div>
        </section>
      </div>
      {maintenanceDialogOpen && (
        <div className="fixed inset-0 z-[100002] flex items-center justify-center bg-gray-950/70 p-4" role="dialog" aria-modal="true" aria-labelledby="maintenance-title">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FF7A00]">Website Maintenance</div>
                <h2 id="maintenance-title" className="mt-1 text-xl font-black text-[#0B3D91]">Enable Maintenance Mode?</h2>
              </div>
              <button type="button" onClick={() => setMaintenanceDialogOpen(false)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100"> <X size={16} /> </button>
            </div>
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              This will temporarily prevent normal users from accessing the TQI application.
            </div>
            <div className="mt-4 text-sm text-slate-600">
              Affected users:
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Cluster Admin</li>
                <li>Financer</li>
                <li>Volunteer</li>
                <li>Other normal users</li>
              </ul>
            </div>
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              Super Admin will continue to have access.
            </div>

            <div className="mt-5 space-y-4">
              <label className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Maintenance Title
                <input value={maintenanceForm.title} onChange={(event) => setMaintenanceForm((prev) => ({ ...prev, title: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#0B3D91]" placeholder="Website Under Maintenance" />
              </label>
              <label className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Maintenance Message
                <textarea value={maintenanceForm.message} onChange={(event) => setMaintenanceForm((prev) => ({ ...prev, message: event.target.value }))} rows={4} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#0B3D91]" placeholder="We are currently performing scheduled maintenance and system improvements. Please check back shortly." />
              </label>
              <label className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Expected Completion Date &amp; Time
                <input type="datetime-local" value={maintenanceForm.expectedCompletion} onChange={(event) => setMaintenanceForm((prev) => ({ ...prev, expectedCompletion: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#0B3D91]" />
              </label>

              <div className="space-y-2 text-sm text-slate-700">
                <label className="flex items-center gap-3"><input type="checkbox" checked={maintenanceForm.showCountdown} onChange={(event) => setMaintenanceForm((prev) => ({ ...prev, showCountdown: event.target.checked }))} /> Show Countdown Timer</label>
                <label className="flex items-center gap-3"><input type="checkbox" checked={maintenanceForm.autoDisable} onChange={(event) => setMaintenanceForm((prev) => ({ ...prev, autoDisable: event.target.checked }))} /> Automatically disable maintenance mode at the scheduled time</label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setMaintenanceDialogOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-700">Cancel</button>
              <button type="button" disabled={maintenanceBusy} onClick={() => void handleMaintenanceAction('enable')} className="rounded-lg bg-[#0B3D91] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60">{maintenanceBusy ? 'Enabling…' : 'Enable Maintenance Mode'}</button>
            </div>
          </div>
        </div>
      )}

      {maintenanceDraftOpen && (
        <div className="fixed inset-0 z-[100002] flex items-center justify-center bg-gray-950/70 p-4" role="dialog" aria-modal="true" aria-labelledby="maintenance-edit-title">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#FF7A00]">Website Maintenance</div>
                <h2 id="maintenance-edit-title" className="mt-1 text-xl font-black text-[#0B3D91]">Edit Maintenance Settings</h2>
              </div>
              <button type="button" onClick={() => setMaintenanceDraftOpen(false)} className="rounded-md p-2 text-slate-500 hover:bg-slate-100"> <X size={16} /> </button>
            </div>
            <div className="mt-5 space-y-4">
              <label className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Maintenance Title
                <input value={maintenanceForm.title} onChange={(event) => setMaintenanceForm((prev) => ({ ...prev, title: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#0B3D91]" />
              </label>
              <label className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Maintenance Message
                <textarea value={maintenanceForm.message} onChange={(event) => setMaintenanceForm((prev) => ({ ...prev, message: event.target.value }))} rows={4} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#0B3D91]" />
              </label>
              <label className="block text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Expected Completion Date &amp; Time
                <input type="datetime-local" value={maintenanceForm.expectedCompletion} onChange={(event) => setMaintenanceForm((prev) => ({ ...prev, expectedCompletion: event.target.value }))} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-[#0B3D91]" />
              </label>
              <div className="space-y-2 text-sm text-slate-700">
                <label className="flex items-center gap-3"><input type="checkbox" checked={maintenanceForm.showCountdown} onChange={(event) => setMaintenanceForm((prev) => ({ ...prev, showCountdown: event.target.checked }))} /> Show Countdown Timer</label>
                <label className="flex items-center gap-3"><input type="checkbox" checked={maintenanceForm.autoDisable} onChange={(event) => setMaintenanceForm((prev) => ({ ...prev, autoDisable: event.target.checked }))} /> Automatically disable maintenance mode at the scheduled time</label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setMaintenanceDraftOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-700">Cancel</button>
              <button type="button" disabled={maintenanceBusy} onClick={() => void handleMaintenanceAction('update')} className="rounded-lg bg-[#0B3D91] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60">{maintenanceBusy ? 'Saving…' : 'Save Settings'}</button>
            </div>
          </div>
        </div>
      )}

      {restoreTarget && (
        <div className="fixed inset-0 z-[100002] flex items-center justify-center bg-gray-950/70 p-4" role="dialog" aria-modal="true" aria-labelledby="restore-backup-title">
          <div className="w-full max-w-lg space-y-4 rounded-2xl border border-amber-300 bg-white p-5 shadow-2xl dark:border-amber-900 dark:bg-gray-900">
            <h2 id="restore-backup-title" className="text-base font-bold text-gray-900 dark:text-white">Restore Operational Backup?</h2>
            <p className="text-xs text-gray-600 dark:text-gray-300">This replaces operational records with the snapshot from {new Date(restoreTarget.createdAt).toLocaleString()}. User accounts, password hashes, system settings, academic setup, and audit logs are excluded and will remain unchanged.</p>
            <p className="text-xs font-semibold">Records in the snapshot: {Object.values(restoreTarget.counts || {}).map((value) => Number(value || 0)).reduce((sum, value) => sum + value, 0)}</p>
            {backupError && <p role="alert" className="rounded-lg bg-red-50 p-2.5 text-xs text-red-800">{backupError}</p>}
            <label className="block text-xs font-semibold">Type <span className="font-mono text-red-700">RESTORE</span> to proceed<input autoComplete="off" value={restoreConfirmation} onChange={(event) => setRestoreConfirmation(event.target.value)} className="mt-1.5 w-full rounded-lg border border-gray-300 bg-transparent px-3 py-2 font-mono dark:border-gray-700" placeholder="RESTORE" /></label>
            <div className="flex justify-end gap-2"><button type="button" disabled={backupBusy} onClick={() => { setRestoreTarget(null); setRestoreConfirmation(''); setBackupError(''); }} className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold dark:border-gray-700">Cancel</button><button type="button" disabled={backupBusy || restoreConfirmation !== 'RESTORE'} onClick={() => void restoreBackup()} className="rounded-lg bg-amber-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{backupBusy ? 'Restoring…' : 'Restore Backup'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
};
