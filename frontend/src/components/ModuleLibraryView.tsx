import React, { useEffect, useState } from 'react';
import { TqiModule } from '../types';
import { apiUrl } from '../utils/api';

interface ModuleLibraryViewProps {
  authToken?: string;
}

export const ModuleLibraryView: React.FC<ModuleLibraryViewProps> = ({ authToken }) => {
  const [modules, setModules] = useState<TqiModule[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const loadModules = async () => {
      try {
        const response = await fetch(apiUrl('/api/modules'), { headers: authToken ? { Authorization: `Bearer ${authToken}` } : {} });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'Unable to load modules.');
        if (!cancelled) setModules(data.modules || []);
      } catch (error) {
        if (!cancelled) setErrorMessage(error instanceof Error ? error.message : 'Unable to load modules.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadModules();
    return () => { cancelled = true; };
  }, [authToken]);

  return (
    <section className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] font-semibold" style={{ color: 'var(--color-text-muted)' }}>Program library</p>
          <h1 className="text-2xl font-bold mt-1" style={{ color: 'var(--color-text)' }}>Modules</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>Approved learning modules available to TQI centres.</p>
        </div>
        <div className="text-xs px-3 py-2 rounded-md border" style={{ color: 'var(--color-text-secondary)', borderColor: 'var(--color-border)', background: 'var(--color-surface-white)' }}>{modules.length} modules</div>
      </div>

      {isLoading && <div className="py-16 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading modules...</div>}
      {errorMessage && <div className="p-3 rounded-md text-sm" style={{ color: 'var(--color-error)', background: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)' }}>{errorMessage}</div>}
      {!isLoading && !errorMessage && modules.length === 0 && <div className="py-16 text-center border rounded-md" style={{ color: 'var(--color-text-muted)', borderColor: 'var(--color-border)' }}>No modules found.</div>}

      {!isLoading && !errorMessage && modules.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {modules.map((module) => (
            <article key={module.id} className="p-5 rounded-md border" style={{ background: 'var(--color-surface-white)', borderColor: 'var(--color-border)', boxShadow: 'var(--shadow-sm)' }}>
              <div className="flex items-start justify-between gap-3">
                <span className="text-xs font-bold px-2 py-1 rounded" style={{ color: 'var(--color-brand)', background: 'var(--color-brand-soft)' }}>{module.moduleNumber}</span>
                <span className="text-[11px] font-semibold" style={{ color: module.status === 'Active' ? '#16803c' : 'var(--color-text-muted)' }}>{module.status}</span>
              </div>
              <h2 className="text-base font-bold mt-4" style={{ color: 'var(--color-text)' }}>{module.moduleName}</h2>
              <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>{module.topic}</p>
              <p className="text-xs mt-4 leading-5" style={{ color: 'var(--color-text-muted)' }}>{module.description || 'Learning module for TQI academic sessions.'}</p>
              <div className="flex items-center justify-between mt-5 pt-4 border-t text-xs" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
                <span>{module.academicYear}</span>
                <span>{module.resources.length} resources</span>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
