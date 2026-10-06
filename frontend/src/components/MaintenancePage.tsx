import React, { useEffect, useMemo, useState } from 'react';
import { TqiLogo } from './TqiLogo';

interface MaintenancePageProps {
  maintenance: {
    enabled: boolean;
    title: string;
    message: string;
    expectedCompletion: string | null;
    showCountdown: boolean;
    autoDisable: boolean;
  } | null;
}

const getCountdownParts = (target: Date | null) => {
  if (!target) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  const diff = Math.max(target.getTime() - Date.now(), 0);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds, expired: diff <= 0 };
};

export const MaintenancePage: React.FC<MaintenancePageProps> = ({ maintenance }) => {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const countdown = useMemo(() => {
    if (!maintenance?.expectedCompletion) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
    return getCountdownParts(new Date(maintenance.expectedCompletion));
  }, [maintenance, now]);

  const title = maintenance?.title || 'Website Under Maintenance';
  const message = maintenance?.message || 'We are currently performing scheduled maintenance and system improvements. Please check back shortly.';
  const expectedCompletion = maintenance?.expectedCompletion ? new Date(maintenance.expectedCompletion).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }) : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-5xl rounded-[2rem] border border-slate-200 bg-white/90 p-5 shadow-[0_24px_80px_rgba(11,61,145,0.08)] backdrop-blur-sm sm:p-10">
        <div className="flex items-center justify-center gap-3 text-center">
          <TqiLogo size={48} />
          <div>
            <div className="text-xl font-black tracking-tight text-[#0B3D91]">Talent Quest for India</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#FF7A00]">ERP · CONNECT · SHARE</div>
          </div>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#FF7A00]/20 bg-[#FFF4EB] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.20em] text-[#B95400]">
              <span className="inline-block h-2 w-2 rounded-full bg-[#FF7A00]" />
              Maintenance
            </div>
            <h1 className="text-4xl font-black tracking-[-0.05em] text-[#0B3D91] sm:text-5xl">WEBSITE UNDER MAINTENANCE</h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-slate-600">{message}</p>

            {expectedCompletion && maintenance?.showCountdown && !countdown.expired && (
              <div className="mt-8 grid grid-cols-4 gap-3 sm:gap-4">
                {[
                  { label: 'Days', value: countdown.days },
                  { label: 'Hours', value: countdown.hours },
                  { label: 'Minutes', value: countdown.minutes },
                  { label: 'Seconds', value: countdown.seconds },
                ].map((item) => (
                  <div key={item.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-4 text-center">
                    <div className="text-3xl font-black tracking-tight text-[#0B3D91]">{String(item.value).padStart(2, '0')}</div>
                    <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">{item.label}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
              <span className="font-bold">Maintenance expected until:</span>{' '}
              {expectedCompletion || 'The end time has not been scheduled yet. Please check back shortly.'}
              {expectedCompletion && countdown.expired && (
                <p className="mt-2 text-xs text-blue-800">The scheduled time has passed. Access will return when the Super Admin disables maintenance mode.</p>
              )}
            </div>
          </div>

          <div className="flex justify-center">
            <div className="relative flex h-[280px] w-[280px] items-center justify-center rounded-[2rem] border border-slate-200 bg-gradient-to-br from-blue-50 to-orange-50 shadow-inner">
              <div className="absolute inset-8 rounded-[1.5rem] border border-dashed border-[#0B3D91]/20" />
              <div className="relative flex h-32 w-32 items-center justify-center rounded-full border-8 border-[#0B3D91]/10 bg-white shadow-lg">
                <div className="text-6xl">🛠️</div>
              </div>
              <div className="absolute -left-1 top-12 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0B3D91] text-2xl text-white shadow-lg">⚙️</div>
              <div className="absolute -right-2 bottom-12 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FF7A00] text-2xl text-white shadow-lg">🔧</div>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-200 pt-6 text-center text-base font-medium text-slate-600">
          Thank you for your patience.
        </div>
      </div>
    </div>
  );
};
