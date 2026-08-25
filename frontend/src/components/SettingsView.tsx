import React, { useState } from 'react';

export const SettingsView: React.FC = () => {
  const [profile, setProfile] = useState({
    name: 'Priya Natarajan',
    role: 'Cluster Administrator',
    email: 'priya.natarajan@tqindia.org',
    phone: '+91 94432 10987',
    cluster: 'Dharmapuri Cluster',
    district: 'Dharmapuri, Tamil Nadu',
    academicYear: '2026–2027',
  });

  const [smsAlerts, setSmsAlerts] = useState(true);
  const [emailDigest, setEmailDigest] = useState(true);
  const [autoSync, setAutoSync] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    setShowEditModal(false);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const Toggle: React.FC<{
    checked: boolean;
    onChange: (v: boolean) => void;
    id: string;
  }> = ({ checked, onChange, id }) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      id={id}
      onClick={() => onChange(!checked)}
      className="relative inline-flex items-center cursor-pointer shrink-0"
      style={{
        width: 40,
        height: 22,
        borderRadius: 99,
        background: checked ? 'var(--color-brand)' : 'var(--color-border-strong)',
        border: 'none',
        outline: 'none',
        transition: 'background 0.2s',
      }}
    >
      <span
        style={{
          display: 'block',
          width: 16,
          height: 16,
          borderRadius: 99,
          background: '#fff',
          position: 'absolute',
          left: checked ? 20 : 3,
          transition: 'left 0.2s',
          boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
        }}
      />
    </button>
  );

  const initials = profile.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className="page-container" style={{ maxWidth: 720 }}>
      {/* Page header */}
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your account, preferences, and notification settings.</p>
      </div>

      {savedSuccess && (
        <div
          className="flex items-center gap-2 px-4 py-3 mb-5 rounded text-sm"
          style={{
            background: 'var(--color-success-bg)',
            border: '1px solid var(--color-success-border)',
            color: 'var(--color-success)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
          Profile saved successfully.
        </div>
      )}

      {/* Profile card */}
      <div className="card mb-4">
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Profile</h2>
          <button onClick={() => setShowEditModal(true)} className="btn btn-secondary btn-sm">
            Edit
          </button>
        </div>
        <div className="px-5 py-4">
          <div className="flex items-center gap-4 mb-5">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base shrink-0"
              style={{ background: 'var(--color-brand)' }}
            >
              {initials}
            </div>
            <div>
              <div className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>{profile.name}</div>
              <div className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>{profile.role}</div>
              <span
                className="badge badge-brand mt-1"
                style={{ display: 'inline-flex' }}
              >
                {profile.cluster}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Email', value: profile.email },
              { label: 'Phone', value: profile.phone },
              { label: 'District', value: profile.district },
            ].map((item) => (
              <div key={item.label}>
                <div className="text-xs font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--color-text-muted)', fontSize: '0.6875rem' }}>
                  {item.label}
                </div>
                <div className="text-sm" style={{ color: 'var(--color-text)' }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Cluster parameters */}
      <div className="card mb-4">
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Cluster parameters</h2>
        </div>
        <div className="px-5 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Academic year', value: profile.academicYear },
              { label: 'Assigned panchayats', value: '3 active' },
              { label: 'Sync status', value: 'Connected', ok: true },
            ].map((item) => (
              <div key={item.label}>
                <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: 'var(--color-text-muted)', fontSize: '0.6875rem' }}>
                  {item.label}
                </div>
                <div className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: item.ok ? 'var(--color-success)' : 'var(--color-text)' }}>
                  {item.ok && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--color-success)' }} />}
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div className="card mb-4">
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>Notifications &amp; sync</h2>
        </div>
        <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
          {[
            {
              id: 'sms',
              title: 'SMS & WhatsApp alerts',
              desc: 'Receive critical alerts when head office requests corrections.',
              checked: smsAlerts,
              onChange: setSmsAlerts,
            },
            {
              id: 'email',
              title: 'Weekly email digest',
              desc: 'Summary of attendance trends, sessions, and budget.',
              checked: emailDigest,
              onChange: setEmailDigest,
            },
            {
              id: 'sync',
              title: 'Offline cache & auto-sync',
              desc: 'Save attendance logs offline and sync when connectivity resumes.',
              checked: autoSync,
              onChange: setAutoSync,
            },
          ].map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="flex-1">
                <label htmlFor={item.id} className="text-sm font-medium cursor-pointer" style={{ color: 'var(--color-text)' }}>
                  {item.title}
                </label>
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>{item.desc}</p>
              </div>
              <Toggle checked={item.checked} onChange={item.onChange} id={item.id} />
            </div>
          ))}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {showEditModal && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Edit profile</span>
              <button
                onClick={() => setShowEditModal(false)}
                className="btn btn-ghost btn-icon"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
            <form onSubmit={handleProfileSave}>
              <div className="modal-body space-y-4">
                <div>
                  <label className="field-label" htmlFor="edit-name">Full name</label>
                  <input
                    id="edit-name"
                    type="text"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="edit-email">Email</label>
                  <input
                    id="edit-email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="edit-phone">Phone</label>
                  <input
                    id="edit-phone"
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    className="field-input"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="btn btn-ghost"
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Save changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
