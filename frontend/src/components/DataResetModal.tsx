import React, { useEffect, useState } from 'react';
import { apiUrl } from '../utils/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface ResetScope { id: string; label: string }
interface ResetModule { id: string; label: string; scopes: ResetScope[] }
interface ResetImpact { records: number; expenses: number; bills: number; relatedRecords: number; files: number }
interface ResetResult extends ResetImpact { affectedRows: number; filesRemoved: number; fileCleanupErrors: string[]; message: string; safetyBackupId?: string }

interface DataResetModalProps {
  open: boolean;
  authToken: string;
  suggestedModule?: string;
  onClose: () => void;
  onCompleted: (result: ResetResult, moduleLabel: string, scopeLabel: string) => void;
}

const emptyImpact: ResetImpact = { records: 0, expenses: 0, bills: 0, relatedRecords: 0, files: 0 };

export const DataResetModal: React.FC<DataResetModalProps> = ({ open, authToken, suggestedModule, onClose, onCompleted }) => {
  const [modules, setModules] = useState<ResetModule[]>([]);
  const [moduleId, setModuleId] = useState('');
  const [scopeId, setScopeId] = useState('');
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [impact, setImpact] = useState<ResetImpact>(emptyImpact);
  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [loadingImpact, setLoadingImpact] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<ResetResult | null>(null);

  const selectedModule = modules.find((module) => module.id === moduleId);
  const selectedScope = selectedModule?.scopes.find((scope) => scope.id === scopeId);
  const isFinanceReset = Boolean(selectedModule?.id.startsWith('finance'));

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoadingOptions(true);
    setError('');
    setSuccess(null);
    setStep(0);
    setScopeId('');
    setTypedConfirmation('');
    fetch(apiUrl('/api/admin/data-reset/options'), {
      headers: { Authorization: `Bearer ${authToken}` },
      signal: controller.signal,
      cache: 'no-store',
    }).then(async (response) => {
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success || !Array.isArray(data.modules)) throw new Error(data?.error || 'Unable to load reset modules.');
      setModules(data.modules);
      setModuleId(data.modules.some((module: ResetModule) => module.id === suggestedModule) ? suggestedModule || '' : '');
    }).catch((loadError) => {
      if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : 'Unable to load reset modules.');
    }).finally(() => {
      if (!controller.signal.aborted) setLoadingOptions(false);
    });
    return () => controller.abort();
  }, [open, authToken, suggestedModule]);

  if (!open) return null;

  const loadImpactAndContinue = async () => {
    if (!selectedModule || !selectedScope) return;
    setLoadingImpact(true);
    setError('');
    setTypedConfirmation('');
    try {
      const query = new URLSearchParams({ module: selectedModule.id, scope: selectedScope.id });
      const response = await fetch(apiUrl(`/api/admin/data-reset/impact?${query.toString()}`), {
        headers: { Authorization: `Bearer ${authToken}` },
        cache: 'no-store',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) throw new Error(data?.error || 'Unable to calculate the reset impact.');
      setImpact(data.impact || emptyImpact);
      setStep(2);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to calculate the reset impact.');
    } finally {
      setLoadingImpact(false);
    }
  };

  const executeReset = async () => {
    if (typedConfirmation !== 'RESET' || !selectedModule || !selectedScope) return;
    setExecuting(true);
    setError('');
    try {
      const response = await fetch(apiUrl('/api/admin/data-reset/execute'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ module: selectedModule.id, scope: selectedScope.id, confirmation: typedConfirmation, expectedImpact: impact }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        if (data?.impact) setImpact(data.impact);
        setTypedConfirmation('');
        throw new Error(data?.error || 'Reset failed. No data was changed.');
      }
      const result = data.result as ResetResult;
      setSuccess(result);
      onCompleted(result, selectedModule.label, selectedScope.label);
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Reset failed. No data was changed.');
    } finally {
      setExecuting(false);
    }
  };

  const resetAndClose = () => {
    setModuleId('');
    setScopeId('');
    setStep(0);
    setImpact(emptyImpact);
    setTypedConfirmation('');
    setSuccess(null);
    setError('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100001] flex items-center justify-center bg-gray-950/70 p-3 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="data-reset-title">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <header className="border-b border-gray-200 bg-red-50 px-5 py-4 dark:border-gray-700 dark:bg-red-950/30">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-red-700 dark:text-red-300">Super Admin · Destructive Action</p>
          <h2 id="data-reset-title" className="mt-1 text-lg font-bold text-gray-900 dark:text-white">{success ? 'Reset completed' : 'Reset Data'}</h2>
          {!success && <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">Nothing is removed until you review the impact and type RESET.</p>}
        </header>

        <div className="max-h-[72vh] space-y-4 overflow-y-auto p-5">
          {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-medium text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">{error}</div>}

          {success ? (
            <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200">
              <p className="font-bold">✓ {selectedModule?.label} — {selectedScope?.label} reset successfully.</p>
              <p>{success.records} records{isFinanceReset ? ` · ${success.expenses} expenses · ${success.bills} bills` : ''}{success.relatedRecords > 0 ? ` · ${success.relatedRecords} related records` : ''} removed or reset.</p>
              {success.filesRemoved > 0 && <p>{success.filesRemoved} uploaded files removed from storage.</p>}
              {success.safetyBackupId && <p className="text-[11px]">Safety backup created first: {success.safetyBackupId}</p>}
              {success.fileCleanupErrors?.length > 0 && <p className="text-amber-800 dark:text-amber-200">Some files could not be removed: {success.fileCleanupErrors.join(' ')}</p>}
              <p className="text-[11px]">Reset ID: {success.message ? 'Recorded in the audit log' : 'Completed'}</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-[11px] font-semibold text-gray-500">
                {['Select module', 'Select scope', 'Review & confirm'].map((label, index) => <span key={label} className={`rounded-full px-2.5 py-1 ${step === index ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200' : 'bg-gray-100 dark:bg-gray-800'}`}>{index + 1}. {label}</span>)}
              </div>

              {step === 0 && <div>
                <label className="mb-1.5 block text-xs font-bold text-gray-800 dark:text-gray-200">What page/module do you want to reset?</label>
                <Select
                  value={moduleId}
                  disabled={loadingOptions}
                  onValueChange={(val) => {
                    setModuleId(val);
                    setScopeId('');
                  }}
                >
                  <SelectTrigger className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                    <SelectValue placeholder="Select a module…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
                    {modules.map((module) => (
                      <SelectItem key={module.id} value={module.id}>{module.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {suggestedModule && selectedModule && <p className="mt-1.5 text-[11px] text-blue-700 dark:text-blue-300">Suggested from the current page. You can change it.</p>}
                <p className="mt-3 text-[11px] text-gray-500">System settings, authentication, role permissions, users, Super Admin accounts, and audit logs are not resettable here.</p>
              </div>}

              {step === 1 && <div>
                <p className="mb-1.5 text-xs font-semibold text-gray-600 dark:text-gray-300">Module: <strong className="text-gray-900 dark:text-white">{selectedModule?.label}</strong></p>
                <label className="mb-1.5 block text-xs font-bold text-gray-800 dark:text-gray-200">What data inside this module should be reset?</label>
                <Select
                  value={scopeId}
                  onValueChange={(val) => setScopeId(val)}
                >
                  <SelectTrigger className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                    <SelectValue placeholder="Select an exact reset scope…" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
                    {selectedModule?.scopes.map((scope) => (
                      <SelectItem key={scope.id} value={scope.id}>{scope.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-2 text-[11px] text-gray-500">No reset scope is preselected. Only data entities present in this application are listed.</p>
              </div>}

              {step === 2 && <div className="space-y-3">
                <div className="rounded-xl border border-red-200 bg-red-50/70 p-4 dark:border-red-900 dark:bg-red-950/20">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">Reset Confirmation</h3>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <dt className="text-gray-500">Module</dt><dd className="font-semibold text-gray-900 dark:text-white">{selectedModule?.label}</dd>
                    <dt className="text-gray-500">Reset scope</dt><dd className="font-semibold text-gray-900 dark:text-white">{selectedScope?.label}</dd>
                    <dt className="text-gray-500">Records affected</dt><dd className="font-bold tabular-nums">{impact.records}</dd>
                    {isFinanceReset && <><dt className="text-gray-500">Expenses affected</dt><dd className="font-bold tabular-nums">{impact.expenses}</dd>
                    <dt className="text-gray-500">Bills affected</dt><dd className="font-bold tabular-nums">{impact.bills}</dd></>}
                    <dt className="text-gray-500">Related records</dt><dd className="font-bold tabular-nums">{impact.relatedRecords}</dd>
                    {impact.files > 0 && <><dt className="text-gray-500">Stored files</dt><dd className="font-bold tabular-nums">{impact.files}</dd></>}
                  </dl>
                </div>
                <div className="rounded-lg border border-red-300 bg-red-100 px-3 py-2.5 text-xs font-semibold text-red-900 dark:border-red-900 dark:bg-red-950/50 dark:text-red-100">This action cannot be undone. Other modules and protected system data will not be affected.</div>
                <label htmlFor="reset-confirmation" className="block text-xs font-bold text-gray-800 dark:text-gray-200">Type <span className="font-mono text-red-700 dark:text-red-300">RESET</span> exactly to confirm.</label>
                <input id="reset-confirmation" autoComplete="off" value={typedConfirmation} onChange={(event) => setTypedConfirmation(event.target.value)} className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-mono text-sm tracking-widest outline-none focus:border-red-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white" placeholder="Type RESET" />
              </div>}
            </>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-5 py-4 dark:border-gray-700 dark:bg-gray-800/50">
          {success ? <span className="text-xs text-emerald-700 dark:text-emerald-300">✓ Reset audited successfully</span> : <button type="button" onClick={resetAndClose} disabled={executing} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">Cancel</button>}
          <div className="ml-auto flex items-center gap-2">
            {step === 1 && !success && <button type="button" onClick={() => { setStep(0); setScopeId(''); setError(''); }} className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">Back</button>}
            {step === 2 && !success && <button type="button" onClick={() => { setStep(1); setTypedConfirmation(''); setError(''); }} className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">Back</button>}
            {!success && step === 0 && <button type="button" disabled={!moduleId || loadingOptions} onClick={() => { setStep(1); setError(''); }} className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-gray-900">Continue</button>}
            {!success && step === 1 && <button type="button" disabled={!scopeId || loadingImpact} onClick={() => void loadImpactAndContinue()} className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-gray-900">{loadingImpact ? 'Checking…' : 'Continue'}</button>}
            {!success && step === 2 && <button type="button" disabled={typedConfirmation !== 'RESET' || executing} onClick={() => void executeReset()} className="rounded-lg bg-red-700 px-4 py-2 text-xs font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40">{executing ? 'Resetting…' : 'Confirm Reset'}</button>}
            {success && <button type="button" onClick={resetAndClose} className="rounded-lg bg-gray-900 px-4 py-2 text-xs font-bold text-white dark:bg-white dark:text-gray-900">Done</button>}
          </div>
        </footer>
      </div>
    </div>
  );
};
