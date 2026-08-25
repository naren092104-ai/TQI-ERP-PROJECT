import React, { useState, useMemo } from 'react';
import { TabType, Panchayat } from '../types';

interface PanchayatsViewProps {
  panchayats: Panchayat[];
  onSelectPanchayat: (panchayatId: string) => void;
  onAddPanchayat: (p: {
    name: string;
    cluster: string;
    status: 'On Track' | 'Correction Required' | 'Action Needed';
    initialVillages: string[];
  }) => void;
  onNavigate: (tab: TabType, targetId?: string, secondaryParam?: string) => void;
}

const STATUS_BADGE: Record<string, string> = {
  'On Track':            'badge-success',
  'Correction Required': 'badge-warning',
  'Action Needed':       'badge-error',
};

export const PanchayatsView: React.FC<PanchayatsViewProps> = ({
  panchayats,
  onSelectPanchayat,
  onAddPanchayat,
  onNavigate,
}) => {
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [showAdd, setShowAdd]           = useState(false);

  const [form, setForm] = useState({
    name: '',
    block: 'Harur Block',
    status: 'On Track' as 'On Track' | 'Correction Required' | 'Action Needed',
    villages: '',
  });

  const totalVillages  = useMemo(() => panchayats.reduce((s, p) => s + (p.villagesCount || p.villages.length), 0), [panchayats]);
  const totalStudents  = useMemo(() => panchayats.reduce((s, p) => s + p.activeStudents, 0), [panchayats]);
  const totalVols      = useMemo(() => panchayats.reduce((s, p) => s + p.volunteersCount, 0), [panchayats]);

  const filtered = useMemo(() =>
    panchayats.filter((p) => {
      const q = search.toLowerCase();
      const matchSearch = !search ||
        p.name.toLowerCase().includes(q) ||
        p.villages.some((v) => v.name.toLowerCase().includes(q));
      const matchStatus = statusFilter === 'All' || p.status === statusFilter;
      return matchSearch && matchStatus;
    }),
    [panchayats, search, statusFilter]
  );

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onAddPanchayat({
      name: form.name.trim(),
      cluster: `Dharmapuri (${form.block})`,
      status: form.status,
      initialVillages: form.villages.split(',').map((v) => v.trim()).filter(Boolean),
    });
    setForm({ name: '', block: 'Harur Block', status: 'On Track', villages: '' });
    setShowAdd(false);
  };

  return (
    <div className="page-container space-y-5">
      {/* Page header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Panchayats</h1>
          <p className="page-subtitle">
            {panchayats.length} panchayat hubs · {totalVillages} villages · {totalStudents} students
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} className="btn btn-primary self-start">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
          Add panchayat
        </button>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Panchayats', value: panchayats.length },
          { label: 'Villages', value: totalVillages },
          { label: 'Students', value: totalStudents },
          { label: 'Volunteers', value: totalVols },
        ].map((s) => (
          <div key={s.label} className="stat-item">
            <div className="stat-label">{s.label}</div>
            <div className="stat-value">{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card p-3">
        <div className="filter-toolbar">
          <div className="relative flex-1" style={{ minWidth: 200, maxWidth: 340 }}>
            <span
              className="material-symbols-outlined absolute top-1/2 -translate-y-1/2"
              style={{ left: 10, fontSize: 16, color: 'var(--color-text-muted)', pointerEvents: 'none' }}
            >
              search
            </span>
            <input
              type="text"
              placeholder="Search panchayats or villages..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="field-input"
              style={{ paddingLeft: 34 }}
            />
          </div>
          {(['All', 'On Track', 'Correction Required', 'Action Needed'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="btn btn-sm"
              style={{
                background: statusFilter === s ? 'var(--color-brand)' : 'var(--color-surface)',
                color: statusFilter === s ? '#fff' : 'var(--color-text-secondary)',
                border: `1px solid ${statusFilter === s ? 'var(--color-brand)' : 'var(--color-border)'}`,
              }}
            >
              {s}
            </button>
          ))}
          <span className="text-xs ml-auto" style={{ color: 'var(--color-text-muted)' }}>
            {filtered.length} of {panchayats.length}
          </span>
        </div>
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>location_city</span>
            </div>
            <div className="empty-state-title">No panchayats found</div>
            <div className="empty-state-body">
              {search ? 'Try a different search term.' : 'Add a panchayat to get started.'}
            </div>
            {!search && (
              <button onClick={() => setShowAdd(true)} className="btn btn-primary mt-2">Add panchayat</button>
            )}
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="tqi-table">
              <thead>
                <tr>
                  <th>Panchayat</th>
                  <th>Status</th>
                  <th>Villages</th>
                  <th>Students</th>
                  <th>Volunteers</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <button
                        onClick={() => onSelectPanchayat(p.id)}
                        className="text-sm font-semibold text-left cursor-pointer"
                        style={{ color: 'var(--color-brand)', background: 'none', border: 'none', padding: 0 }}
                      >
                        {p.name}
                      </button>
                      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {p.villages.slice(0, 3).map((v) => v.name).join(', ')}
                        {p.villages.length > 3 && ` +${p.villages.length - 3}`}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGE[p.status] || 'badge-neutral'}`}>
                        {p.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{p.villagesCount || p.villages.length}</td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{p.activeStudents}</td>
                    <td style={{ color: 'var(--color-text-secondary)' }}>{p.volunteersCount}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onNavigate('students', p.id)}
                          className="btn btn-ghost btn-sm"
                          title="View students"
                        >
                          Students
                        </button>
                        <button
                          onClick={() => onSelectPanchayat(p.id)}
                          className="btn btn-secondary btn-sm"
                        >
                          Open
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Panchayat Modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Add panchayat</span>
              <button onClick={() => setShowAdd(false)} className="btn btn-ghost btn-icon">
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body space-y-4">
                <div>
                  <label className="field-label" htmlFor="pan-name">Panchayat name *</label>
                  <input
                    id="pan-name"
                    type="text"
                    required
                    placeholder="e.g., Vedakkattamaduvu"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="pan-block">Block</label>
                  <input
                    id="pan-block"
                    type="text"
                    value={form.block}
                    onChange={(e) => setForm({ ...form, block: e.target.value })}
                    className="field-input"
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor="pan-status">Status</label>
                  <select
                    id="pan-status"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}
                    className="field-select"
                  >
                    <option>On Track</option>
                    <option>Correction Required</option>
                    <option>Action Needed</option>
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor="pan-villages">
                    Initial villages <span style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>(comma separated)</span>
                  </label>
                  <input
                    id="pan-villages"
                    type="text"
                    placeholder="e.g., Ammapettai, Pudur"
                    value={form.villages}
                    onChange={(e) => setForm({ ...form, villages: e.target.value })}
                    className="field-input"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" onClick={() => setShowAdd(false)} className="btn btn-ghost">Cancel</button>
                <button type="submit" className="btn btn-primary">Save panchayat</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
