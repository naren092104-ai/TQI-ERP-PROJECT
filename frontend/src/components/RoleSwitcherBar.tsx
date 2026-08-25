import React from 'react';
import { UserRole } from '../types';

interface RoleSwitcherBarProps {
  currentRole: UserRole;
  currentClusterId: string;
  onSwitchRole: (role: UserRole, clusterId?: string) => void;
  pendingApprovalsCount?: number;
  unreadNotifsCount?: number;
}

export const RoleSwitcherBar: React.FC<RoleSwitcherBarProps> = ({
  currentRole,
  currentClusterId,
  onSwitchRole,
  pendingApprovalsCount = 0,
  unreadNotifsCount = 0,
}) => {
  return (
    <div className="bg-[#0B3D91] text-white px-3 md:px-4 py-2 border-b border-[#002869] shadow-xs select-none sticky top-0 z-50">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Active Persona Display */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white10 px-2.5 py-1 rounded-md text-xs font-semibold">
            <span className="material-symbols-outlined text-[16px] text-[#FF7A00]">
              {currentRole === 'Super Admin' ? 'shield_person' : 'badge'}
            </span>
            <span className="text-white/80">Active Role:</span>
            <span className="text-white font-bold">{currentRole}</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-md text-xs">
            <span className="material-symbols-outlined text-[15px] text-white/70">location_on</span>
            <span className="text-white/80">Scope:</span>
            <span className="font-semibold text-white">
              {currentRole === 'Super Admin'
                ? 'All Tamil Nadu Clusters (Central)'
                : currentClusterId === 'salem'
                ? 'Salem Cluster Scoped'
                : currentClusterId === 'namakkal'
                ? 'Namakkal Cluster Scoped'
                : 'Dharmapuri Cluster Scoped'}
            </span>
          </div>
        </div>

        {/* Right: Quick Persona Switcher Buttons */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-white/70 hidden md:inline">
            Switch Persona:
          </span>

          <button
            onClick={() => onSwitchRole('Super Admin')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
              currentRole === 'Super Admin'
                ? 'bg-[#FF7A00] text-white shadow-xs scale-102  ring-white/50'
                : 'bg-white10 hover:bg-white20 text-white/90'
            }`}
            title="Super Admin - Full state access and central approval authority"
          >
            <span className="material-symbols-outlined text-[13px]">verified_user</span>
            Super Admin
            {pendingApprovalsCount > 0 && currentRole === 'Super Admin' && (
              <span className="bg-red-500 text-white text-[9.5px] px-1.5 py-0.2 rounded-full font-bold">
                {pendingApprovalsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onSwitchRole('Cluster Admin', 'dharmapuri')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
              currentRole === 'Cluster Admin' && currentClusterId === 'dharmapuri'
                ? 'bg-[#FF7A00] text-white shadow-xs scale-102  ring-white/50'
                : 'bg-white10 hover:bg-white20 text-white/90'
            }`}
            title="Cluster Admin - Dharmapuri Cluster"
          >
            <span>Dharmapuri Admin</span>
          </button>

          <button
            onClick={() => onSwitchRole('Cluster Admin', 'salem')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
              currentRole === 'Cluster Admin' && currentClusterId === 'salem'
                ? 'bg-[#FF7A00] text-white shadow-xs scale-102  ring-white/50'
                : 'bg-white10 hover:bg-white20 text-white/90'
            }`}
            title="Cluster Admin - Salem Cluster"
          >
            <span>Salem Admin</span>
          </button>

          <button
            onClick={() => onSwitchRole('Cluster Admin', 'namakkal')}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
              currentRole === 'Cluster Admin' && currentClusterId === 'namakkal'
                ? 'bg-[#FF7A00] text-white shadow-xs scale-102  ring-white/50'
                : 'bg-white10 hover:bg-white20 text-white/90'
            }`}
            title="Cluster Admin - Namakkal Cluster"
          >
            <span>Namakkal Admin</span>
          </button>
        </div>
      </div>
    </div>
  );
};

