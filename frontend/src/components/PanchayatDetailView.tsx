import React, { useState } from 'react';
import { TabType, Panchayat, Student } from '../types';

interface PanchayatDetailViewProps {
  panchayat: Panchayat;
  students: Student[];
  onBack: () => void;
  onNavigate: (tab: TabType, targetId?: string, secondaryParam?: string) => void;
  onAddVillage: (panchayatId: string, villageName: string) => void;
}

function villageStudentsOf(panchayatId: string, villageName: string, all: Student[]) {
  return all.filter(
    (s) =>
      (s.panchayatId === panchayatId ||
        s.panchayatName.toLowerCase().includes(panchayatId.toLowerCase())) &&
      s.villageName.toLowerCase() === villageName.toLowerCase()
  );
}

const STATUS_BADGE: Record<string, string> = {
  'On Track':            'badge-success',
  'Correction Required': 'badge-warning',
  'Action Needed':       'badge-error',
};

export const PanchayatDetailView: React.FC<PanchayatDetailViewProps> = ({
  panchayat,
  students,
  onBack,
  onNavigate,
  onAddVillage,
}) => {
  const [showAdd, setShowAdd]     = useState(false);
  const [newVillage, setNewVillage] = useState('');
  const [search, setSearch]       = useState('');

  const panStudents   = students.filter(
    (s) => s.panchayatId === panchayat.id || s.panchayatName.toLowerCase() === panchayat.name.toLowerCase()
  );
  const boys  = panStudents.filter((s) => s.gender === 'male').length;
  const girls = panStudents.filter((s) => s.gender === 'female').length;

  const filtered = panchayat.villages.filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVillage.trim()) return;
    onAddVillage(panchayat.id, newVillage.trim());
    setNewVillage('');
    setShowAdd(false);
  };

  return (
    <div className="page-container space-y-5">
      {/* Breadcrumb */}
      <nav className="breadcrumb">
        <button onClick={onBack}>Panchayats</button>
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>chevron_right</span>
        <span className="current">{panchayat.name}</span>
      </nav>

      {/* Page header */}
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="page-title mb-0">{panchayat.name}</h1>
              <span className={`badge ${STATUS_BADGE[panchayat.status] || 'badge-neutral'}`}>
                {panchayat.status}
              </span>
            </div>
            <p className="page-subtitle">
              {panchayat.cluster} · {panchayat.villages.length} villages · {panStudents.length} students
            </p>
          </div>
          <div className="flex gap-2 self-start">
            <button onClick={() => onNavigate('attendance', panchayat.id)} className="btn btn-secondary btn-sm">
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>how_to_reg</span>
              Attendance
            </button>
            <button onClick={() => setShowAdd(true)} className="btn btn-primary btn-sm">
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
              Add village
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
          {[
            { label: 'Villages', value: panchayat.villages.length },
            { label: 'Students', value: panStudents.length },
            { label: 'Girls', value: girls },
            { label: 'Boys', value: boys },
          ].map((s) => (
            <div key={s.label} className="stat-item" style={{ cursor: 'default' }}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value">{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Villages */}
      <div className="card overflow-hidden">
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--color-border)' }}
        >
          <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
            Village learning centers
          </span>
          <div className="flex items-center gap-2">
            <div className="relative">
              <span
                className="material-symbols-outlined absolute top-1/2 -translate-y-1/2"
                style={{ left: 8, fontSize: 15, color: 'var(--color-text-muted)', pointerEvents: 'none' }}
              >
                search
              </span>
              <input
                type="text"
                placeholder="Filter..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="field-input"
                style={{ paddingLeft: 28, width: 160, height: 30, fontSize: '0.75rem' }}
              />
            </div>
            <button onClick={() => setShowAdd(true)} className="btn btn-secondary btn-sm">
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>add</span>
              Add
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>holiday_village</span>
            </div>
            <div className="empty-state-title">No village centers found</div>
            <div className="empty-state-body">
              {search ? 'Try a different search term.' : 'Add a village to this panchayat.'}
            </div>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--color-border)' }}>
            {filtered.map((v, idx) => {
              const vs     = villageStudentsOf(panchayat.id, v.name, panStudents);
              const vBoys  = vs.filter((s) => s.gender === 'male').length;
              const vGirls = vs.filter((s) => s.gender === 'female').length;
              const count  = vs.length || v.studentCount;

              return (
                <div
                  key={v.id}
                  onClick={() => onNavigate('students', panchayat.id, v.name)}
                  className="flex items-center justify-between gap-4 px-4 py-3 cursor-pointer"
                  style={{ background: 'transparent' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--color-surface)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className="text-xs font-semibold w-6 text-center shrink-0"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      {idx + 1}
                    </span>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                        {v.name}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {vBoys} boys · {vGirls} girls
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="badge badge-brand">{count} students</span>
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 16, color: 'var(--color-text-muted)' }}
                    >
                      chevron_right
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add village modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Add village to {panchayat.name}</span>
              <button onClick={() => setShowAdd(false)} className="btn btn-ghost btn-icon">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body space-y-4">
                <div>
                  <label className="field-label" htmlFor="vil-name">Village name *</label>
                  <input
                    id="vil-name"
                    type="text"
                    required
                    placeholder="e.g., Ammapettai"
                    value={newVillage}
                    onChange={(e) => setNewVillage(e.target.value)}
                    className="field-input"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="field-label">Panchayat</label>
                  <input
                    type="text"
                    disabled
                    value={panchayat.name}
                    className="field-input"
                    style={{ background: 'var(--color-surface)', color: 'var(--color-text-secondary)' }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowAdd(false)} className="btn btn-ghost">Cancel</button>
                <button type="submit" className="btn btn-primary">Save village</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
