import React, { useState } from "react";
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
}

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

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const saveProfile = (newProfile: typeof profile) => {
    setProfile(newProfile);
    localStorage.setItem("tqi_personal_settings", JSON.stringify(newProfile));
    onUpdateProfile?.(newProfile);
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
    </div>
  );
};
