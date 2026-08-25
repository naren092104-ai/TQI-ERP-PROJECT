import React, { useState } from 'react';
import { Cluster, TabType } from '../types';

interface ClustersViewProps {
  clusters: Cluster[];
  onNavigate: (tab: TabType, targetId?: string) => void;
  onAddCluster?: (cluster: Partial<Cluster>) => void | Promise<void | boolean>;
}

export const ClustersView: React.FC<ClustersViewProps> = ({
  clusters = [],
  onNavigate,
  onAddCluster,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');

  const [newCollegeName, setNewCollegeName] = useState('');
  const [newClusterDistrict, setNewClusterDistrict] = useState('');
  const [newSpocName, setNewSpocName] = useState('');
  const [newSpocMobile, setNewSpocMobile] = useState('');
  const [newSpocEmail, setNewSpocEmail] = useState('');

  const filteredClusters = clusters.filter(
    (c) =>
      (c.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.district || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.collegeName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.spocName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.adminName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.code || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleCreateCluster = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (
      !newCollegeName.trim() ||
      !newClusterDistrict.trim() ||
      !newSpocName.trim() ||
      !newSpocMobile.trim() ||
      !newSpocEmail.trim()
    ) {
      setFormError('Please fill in all required fields marked with *.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (onAddCluster) {
        const res = await onAddCluster({
          collegeName: newCollegeName.trim(),
          district: newClusterDistrict.trim(),
          name: `${newCollegeName.trim()} (${newClusterDistrict.trim()})`,
          spocName: newSpocName.trim(),
          spocMobile: newSpocMobile.trim(),
          adminName: newSpocName.trim(),
          adminEmail: newSpocEmail.trim().toLowerCase(),
          adminPhone: newSpocMobile.trim(),
          status: 'Active',
        });

        if (res === false) {
          setIsSubmitting(false);
          return;
        }
      }

      setIsAddModalOpen(false);
      setNewCollegeName('');
      setNewClusterDistrict('');
      setNewSpocName('');
      setNewSpocMobile('');
      setNewSpocEmail('');
      setFormError('');
    } catch (err: any) {
      setFormError(err?.message || 'Failed to onboard college cluster.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white border border-[#c4c6d3]/80 rounded-md p-4 md:p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-[#002869] text-white flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-[20px]">hub</span>
            </div>
            <h1 className="text-xl md:text-2xl font-bold text-[#002869] tracking-tight">
              Clusters & College Onboarding
            </h1>
            <span className="bg-[#002869]/10 text-[#002869] text-[11px] font-bold px-2 py-0.5 rounded-full">
              {clusters.length} Onboarded Colleges
            </span>
          </div>
          <p className="text-xs text-[#747783] mt-1">
            Centrally manage onboarded partner colleges, district clusters, SPOC coordinators, and regional administrators.
          </p>
        </div>

        <button
          onClick={() => {
            setIsAddModalOpen(true);
            setFormError('');
          }}
          className="bg-[#002869] hover:bg-[#001f52] text-white px-3.5 py-2 rounded-md text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <span className="material-symbols-outlined text-[16px]">add_circle</span>
          Onboard New College
        </button>
      </div>

      {/* Search and Summary KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-[#c4c6d3]/70 rounded-md p-3.5 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-blue-50 text-[#002869] flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px]">school</span>
          </div>
          <div>
            <span className="text-[10.5px] text-slate-500 font-semibold block uppercase">Onboarded Colleges</span>
            <span className="text-lg font-bold text-[#002869]">{clusters.length}</span>
          </div>
        </div>

        <div className="bg-white border border-[#c4c6d3]/70 rounded-md p-3.5 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px]">location_city</span>
          </div>
          <div>
            <span className="text-[10.5px] text-slate-500 font-semibold block uppercase">Total Panchayats</span>
            <span className="text-lg font-bold text-emerald-800">
              {clusters.reduce((acc, c) => acc + (c.activePanchayats || 0), 0)}
            </span>
          </div>
        </div>

        <div className="bg-white border border-[#c4c6d3]/70 rounded-md p-3.5 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-purple-50 text-purple-700 flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px]">groups</span>
          </div>
          <div>
            <span className="text-[10.5px] text-slate-500 font-semibold block uppercase">Enrolled Students</span>
            <span className="text-lg font-bold text-purple-800">
              {clusters.reduce((acc, c) => acc + (c.totalStudents || 0), 0)}
            </span>
          </div>
        </div>

        <div className="bg-white border border-[#c4c6d3]/70 rounded-md p-3.5 shadow-xs flex items-center gap-3">
          <div className="w-10 h-10 rounded-md bg-amber-50 text-amber-700 flex items-center justify-center">
            <span className="material-symbols-outlined text-[22px]">volunteer_activism</span>
          </div>
          <div>
            <span className="text-[10.5px] text-slate-500 font-semibold block uppercase">Active Volunteers</span>
            <span className="text-lg font-bold text-amber-800">
              {clusters.reduce((acc, c) => acc + (c.totalVolunteers || 0), 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Search Input */}
      <div className="bg-white border border-[#c4c6d3]/80 rounded-md p-3 shadow-xs">
        <div className="relative w-full max-w-sm">
          <span className="material-symbols-outlined absolute left-2.5 top-2 text-[18px] text-slate-400">
            search
          </span>
          <input
            type="text"
            placeholder="Search by college, district, or SPOC..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#f8fafc] border border-slate-300 rounded-md pl-8 pr-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:border-[#002869]"
          />
        </div>
      </div>

      {/* Cluster Grid Cards */}
      {filteredClusters.length === 0 ? (
        <div className="bg-white border border-[#c4c6d3]/80 rounded-md p-8 text-center text-slate-500 space-y-2">
          <span className="material-symbols-outlined text-4xl text-slate-400">domain_disabled</span>
          <p className="font-semibold text-sm text-slate-700">No partner colleges onboarded yet.</p>
          <p className="text-xs text-slate-500">Click "Onboard New College" to register a college and assign its SPOC administrator.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClusters.map((cluster) => {
            const completionRate = Math.round(
              ((cluster.completedSessions || 0) / (cluster.totalSessions || 48)) * 100
            );

            return (
              <div
                key={cluster.id}
                className="bg-white border border-[#c4c6d3]/80 rounded-md overflow-hidden shadow-xs hover:border-[#002869] transition-all flex flex-col justify-between"
              >
                <div className="p-4 space-y-3">
                  {/* Top Badge & Title */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-[#002869] bg-[#002869]/10 px-2 py-0.5 rounded">
                          {cluster.code}
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                          {cluster.status}
                        </span>
                      </div>
                      <h3 className="text-base font-bold text-[#002869] mt-1">{cluster.collegeName || cluster.name}</h3>
                      <p className="text-xs text-slate-500">{cluster.district}, Tamil Nadu</p>
                    </div>

                    <div className="w-9 h-9 rounded-md bg-[#002869] text-white flex items-center justify-center font-bold text-xs shrink-0">
                      {(cluster.collegeName || cluster.name || 'CL').substring(0, 2).toUpperCase()}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] font-medium">
                      <span className="text-slate-600">Curriculum Progress</span>
                      <span className="text-[#002869] font-bold">
                        {completionRate}% ({cluster.completedSessions || 0}/{cluster.totalSessions || 48} sessions)
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-[#002869] h-2 rounded-full transition-all duration-500"
                        style={{ width: `${completionRate}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Key Metrics */}
                  <div className="grid grid-cols-3 gap-2 bg-[#f8fafc] border border-slate-200/80 rounded-md p-2.5 text-center text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Panchayats</span>
                      <span className="font-bold text-slate-800">{cluster.activePanchayats}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Students</span>
                      <span className="font-bold text-slate-800">{cluster.totalStudents}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Volunteers</span>
                      <span className="font-bold text-slate-800">{cluster.totalVolunteers}</span>
                    </div>
                  </div>

                  {/* SPOC / Admin Coordinator Details */}
                  <div className="bg-slate-50/70 border border-slate-200/60 rounded p-2.5 space-y-1 text-[11.5px]">
                    <div className="flex items-center justify-between text-slate-800 font-semibold">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px] text-[#002869]">badge</span>
                        {cluster.spocName || cluster.adminName || 'SPOC Admin'}
                      </span>
                      <span className="font-mono text-[10.5px] text-slate-600">{cluster.spocMobile || cluster.adminPhone}</span>
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono truncate">
                      {cluster.adminEmail}
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                <div className="p-3 bg-[#f8fafc] border-t border-slate-200/80 flex items-center justify-end">
                  <button
                    onClick={() => onNavigate('panchayats', cluster.id)}
                    className="text-xs font-bold text-[#002869] hover:text-[#001f52] flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    View Panchayats & Scope
                    <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Onboard New College Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#c4c6d3] rounded-md w-full max-w-lg shadow-lg overflow-hidden">
            <div className="bg-[#002869] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]">school</span>
                <h3 className="text-base font-bold">Onboard Partner College</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-white/80 hover:text-white p-1 rounded-full cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <form onSubmit={handleCreateCluster} className="p-5 space-y-4 text-xs">
              {formError && (
                <div className="p-2.5 rounded bg-red-50 border border-red-200 text-red-700 text-[11.5px]">
                  {formError}
                </div>
              )}

              {/* College & District */}
              <div className="space-y-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Partner College / Institution Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Government Arts College"
                    value={newCollegeName}
                    onChange={(e) => setNewCollegeName(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-slate-300 rounded-md p-2 text-xs focus:outline-none focus:border-[#002869]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">District *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dharmapuri"
                    value={newClusterDistrict}
                    onChange={(e) => setNewClusterDistrict(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-slate-300 rounded-md p-2 text-xs focus:outline-none focus:border-[#002869]"
                  />
                </div>
              </div>

              {/* College SPOC Coordinator */}
              <div className="pt-3 border-t border-slate-200 space-y-3">
                <h4 className="font-bold text-[#002869] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px]">person</span>
                  College SPOC & Cluster Administrator
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">SPOC Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dr. M. Vignesh"
                      value={newSpocName}
                      onChange={(e) => setNewSpocName(e.target.value)}
                      className="w-full bg-[#f8fafc] border border-slate-300 rounded-md p-2 text-xs focus:outline-none focus:border-[#002869]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">SPOC Mobile Number *</label>
                    <input
                      type="tel"
                      required
                      placeholder="e.g. +91 98765 43210"
                      value={newSpocMobile}
                      onChange={(e) => setNewSpocMobile(e.target.value)}
                      className="w-full bg-[#f8fafc] border border-slate-300 rounded-md p-2 text-xs focus:outline-none focus:border-[#002869]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">SPOC Official Login Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. vignesh.m@gac-dpi.edu.in"
                    value={newSpocEmail}
                    onChange={(e) => setNewSpocEmail(e.target.value)}
                    className="w-full bg-[#f8fafc] border border-slate-300 rounded-md p-2 text-xs focus:outline-none focus:border-[#002869]"
                  />
                </div>
              </div>

              {/* Notice */}
              <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-md text-[11px] text-blue-900 space-y-1">
                <p className="font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">forward_to_inbox</span>
                  Automated Credentials Email
                </p>
                <p className="text-blue-800">
                  The SPOC will be provisioned as the Regional Cluster Admin. A secure temporary password and onboarding instructions will be dispatched to <strong>{newSpocEmail || 'their email'}</strong>.
                </p>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-md font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-[#002869] hover:bg-[#001f52] text-white rounded-md font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isSubmitting ? 'Onboarding College...' : 'Onboard College & Send Credentials'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
