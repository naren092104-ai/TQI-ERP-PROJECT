import React, { useState } from "react";
import { Check, Info, X, CheckCircle2 } from "lucide-react";

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

export const SettingsView: React.FC<SettingsViewProps> = ({
  currentUser,
  onUpdateProfile,
}) => {
  // Load saved profile or defaults matching the design
  const [profile, setProfile] = useState(() => {
    const saved = localStorage.getItem("tqi_personal_settings");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
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

  // Inline edit toggle states
  const [isEditingBasic, setIsEditingBasic] = useState(false);
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [isEditingAddress, setIsEditingAddress] = useState(false);

  // Form states
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
    if (onUpdateProfile) {
      onUpdateProfile(newProfile);
    }
  };

  const handleSaveBasic = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      ...profile,
      name: basicForm.name.trim() || profile.name,
      region: basicForm.region.trim() || profile.region,
      language: basicForm.language.trim() || profile.language,
    };
    saveProfile(updated);
    setIsEditingBasic(false);
    showToast("Basic information saved successfully");
  };

  const handleSaveEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailForm.trim()) return;
    const updated = {
      ...profile,
      email: emailForm.trim(),
      emailVerified: true,
    };
    saveProfile(updated);
    setIsEditingEmail(false);
    showToast("Primary email updated");
  };

  const handleSavePhone = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      ...profile,
      phone: phoneForm.trim(),
    };
    saveProfile(updated);
    setIsEditingPhone(false);
    showToast(phoneForm.trim() ? "Phone number saved" : "Phone number removed");
  };

  const handleSaveAddress = (e: React.FormEvent) => {
    e.preventDefault();
    const updated = {
      ...profile,
      mailingAddress: addressForm.trim(),
    };
    saveProfile(updated);
    setIsEditingAddress(false);
    showToast(addressForm.trim() ? "Mailing address saved" : "Mailing address removed");
  };

  return (
    <div className="w-full max-w-4xl py-2 px-1 sm:px-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-[99999] flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-xs font-semibold text-white shadow-theme-lg dark:bg-white dark:text-gray-900 animate-in fade-in-0 slide-in-from-bottom-5">
          <CheckCircle2 className="h-4 w-4 text-success-500 shrink-0" />
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="ml-2 text-gray-400 hover:text-white dark:hover:text-gray-900 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Main Header */}
      <div className="mb-10">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
          Personal Information
        </h1>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
          Manage your basic information, contact methods, and addresses
        </p>
      </div>

      <div className="space-y-12">
        {/* Basic Information Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight">
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
                className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 underline underline-offset-4 hover:text-brand-500 dark:hover:text-brand-400 transition cursor-pointer"
              >
                Edit
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditingBasic(false)}
                className="text-xs sm:text-sm font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white transition cursor-pointer"
              >
                Cancel
              </button>
            )}
          </div>

          {!isEditingBasic ? (
            <div className="space-y-6 text-sm animate-in fade-in-0 duration-200">
              <div>
                <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Name
                </span>
                <span className="font-bold text-gray-900 dark:text-white uppercase tracking-tight text-sm sm:text-base">
                  {profile.name}
                </span>
              </div>

              <div>
                <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Region
                </span>
                <span className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
                  {profile.region}
                </span>
              </div>

              <div>
                <span className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Language
                </span>
                <span className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
                  {profile.language}
                </span>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSaveBasic} className="space-y-4 max-w-lg animate-in fade-in-0 duration-200">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={basicForm.name}
                  onChange={(e) => setBasicForm({ ...basicForm, name: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 bg-transparent px-3.5 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  Region *
                </label>
                <input
                  type="text"
                  required
                  value={basicForm.region}
                  onChange={(e) => setBasicForm({ ...basicForm, region: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 bg-transparent px-3.5 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                  Language *
                </label>
                <input
                  type="text"
                  required
                  value={basicForm.language}
                  onChange={(e) => setBasicForm({ ...basicForm, language: e.target.value })}
                  className="w-full rounded-xl border border-gray-300 bg-transparent px-3.5 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="submit"
                  className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-theme-xs hover:bg-brand-600 transition cursor-pointer"
                >
                  Save Changes
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingBasic(false)}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 transition cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Contact Information Section */}
        <section className="space-y-6">
          <div className="border-b border-gray-100 dark:border-gray-800 pb-2">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight">
              Contact Information
            </h2>
          </div>

          <div className="space-y-8 text-sm">
            {/* Primary Email */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                    <span>Primary Email</span>
                    <Info className="h-3.5 w-3.5 text-gray-400" />
                  </div>
                  {!isEditingEmail && (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
                        {profile.email}
                      </span>
                      {profile.emailVerified && (
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                          <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                          Verified
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {!isEditingEmail && (
                  <button
                    type="button"
                    onClick={() => {
                      setEmailForm(profile.email);
                      setIsEditingEmail(true);
                    }}
                    className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 underline underline-offset-4 hover:text-brand-500 dark:hover:text-brand-400 transition cursor-pointer shrink-0 mt-1"
                  >
                    Edit
                  </button>
                )}
              </div>

              {isEditingEmail && (
                <form onSubmit={handleSaveEmail} className="space-y-3 max-w-md animate-in fade-in-0 duration-200">
                  <input
                    type="email"
                    required
                    value={emailForm}
                    onChange={(e) => setEmailForm(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-transparent px-3.5 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-theme-xs hover:bg-brand-600 transition cursor-pointer"
                    >
                      Save Email
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingEmail(false)}
                      className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Primary Phone Number */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                    <span>Primary Phone Number</span>
                    <Info className="h-3.5 w-3.5 text-gray-400" />
                  </div>
                  {!isEditingPhone && (
                    <div>
                      {profile.phone ? (
                        <span className="font-bold text-gray-900 dark:text-white text-sm sm:text-base font-mono">
                          {profile.phone}
                        </span>
                      ) : (
                        <span className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
                          No phone number added
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {!isEditingPhone && (
                  <button
                    type="button"
                    onClick={() => {
                      setPhoneForm(profile.phone);
                      setIsEditingPhone(true);
                    }}
                    className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 underline underline-offset-4 hover:text-brand-500 dark:hover:text-brand-400 transition cursor-pointer shrink-0 mt-1"
                  >
                    {profile.phone ? "Edit" : "Add"}
                  </button>
                )}
              </div>

              {isEditingPhone && (
                <form onSubmit={handleSavePhone} className="space-y-3 max-w-md animate-in fade-in-0 duration-200">
                  <input
                    type="tel"
                    placeholder="+91 98765 43210"
                    value={phoneForm}
                    onChange={(e) => setPhoneForm(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-transparent px-3.5 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      type="submit"
                      className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-theme-xs hover:bg-brand-600 transition cursor-pointer"
                    >
                      Save Phone
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingPhone(false)}
                      className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 transition cursor-pointer"
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
        <section className="space-y-6">
          <div className="border-b border-gray-100 dark:border-gray-800 pb-2">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white tracking-tight">
              Addresses
            </h2>
          </div>

          <div className="space-y-3 text-sm">
            {/* Mailing */}
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
                  <span>Mailing</span>
                  <Info className="h-3.5 w-3.5 text-gray-400" />
                </div>
                {!isEditingAddress && (
                  <div>
                    {profile.mailingAddress ? (
                      <span className="font-bold text-gray-900 dark:text-white text-sm sm:text-base whitespace-pre-line">
                        {profile.mailingAddress}
                      </span>
                    ) : (
                      <span className="font-bold text-gray-900 dark:text-white text-sm sm:text-base">
                        No mailing address added
                      </span>
                    )}
                  </div>
                )}
              </div>

              {!isEditingAddress && (
                <button
                  type="button"
                  onClick={() => {
                    setAddressForm(profile.mailingAddress);
                    setIsEditingAddress(true);
                  }}
                  className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-gray-100 underline underline-offset-4 hover:text-brand-500 dark:hover:text-brand-400 transition cursor-pointer shrink-0 mt-1"
                >
                  {profile.mailingAddress ? "Edit" : "Add"}
                </button>
              )}
            </div>

            {isEditingAddress && (
              <form onSubmit={handleSaveAddress} className="space-y-3 max-w-lg animate-in fade-in-0 duration-200">
                <textarea
                  rows={3}
                  placeholder="e.g. 12/45, Gandhi Street, Dharmapuri, Tamil Nadu - 636701"
                  value={addressForm}
                  onChange={(e) => setAddressForm(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-transparent px-3.5 py-2.5 text-sm text-gray-900 focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white resize-none"
                />
                <div className="flex items-center gap-3">
                  <button
                    type="submit"
                    className="rounded-xl bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-theme-xs hover:bg-brand-600 transition cursor-pointer"
                  >
                    Save Address
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingAddress(false)}
                    className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>
      </div>
    </div>
  );
};
