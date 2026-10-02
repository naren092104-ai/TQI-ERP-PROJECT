import React, { useEffect, useMemo, useState } from 'react';
import { TqiModule, UserRole } from '../types';
import { Plus, Search, FileText, Download, Upload, Trash2, X, Edit3, Eye } from './ui/icons';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface ModuleLibraryViewProps {
  modules: TqiModule[];
  academicDays: Array<{ dayNumber: number; sessionName: string }>;
  currentUserRole: UserRole;
  currentAcademicYear?: string;
  onCreateModule?: (module: { moduleNumber: string; moduleName: string; topic: string; description: string; academicYear: string; dayNumber: number }) => Promise<string | void>;
  onUpdateModule?: (id: string, module: any) => Promise<void>;
  onDeleteModule?: (id: string) => Promise<void>;
  onUploadResource?: (moduleId: string, file: File) => Promise<void>;
  onDownloadResource?: (moduleId: string, resourceId: string) => void;
  onViewResource?: (moduleId: string, resourceId: string) => void;
  onDeleteResource?: (moduleId: string, resourceId: string) => void;
  onRefreshModules?: () => Promise<void>;
}

export const ModuleLibraryView: React.FC<ModuleLibraryViewProps> = ({
  modules,
  academicDays,
  currentUserRole,
  currentAcademicYear = '',
  onCreateModule,
  onUpdateModule,
  onDeleteModule,
  onUploadResource,
  onDownloadResource,
  onViewResource,
  onDeleteResource,
  onRefreshModules
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<TqiModule | null>(null);
  const availableDays = useMemo(
    () => [...new Map(academicDays.filter((day) => Number.isInteger(day.dayNumber) && day.dayNumber > 0 && day.sessionName.trim()).map((day) => [day.dayNumber, day])).values()].sort((a, b) => a.dayNumber - b.dayNumber),
    [academicDays],
  );
  const availableDayNumbers = useMemo(() => new Set(availableDays.map((day) => day.dayNumber)), [availableDays]);

  useEffect(() => {
    void onRefreshModules?.();
  }, [onRefreshModules]);

  const [formData, setFormData] = useState({
    moduleNumber: '',
    moduleName: '',
    topic: '',
    description: '',
    academicYear: currentAcademicYear,
    dayNumber: 1
  });

  useEffect(() => {
    if (!editingModule && currentAcademicYear) {
      setFormData((current) => ({ ...current, academicYear: currentAcademicYear }));
    }
  }, [currentAcademicYear, editingModule]);

  useEffect(() => {
    if (availableDays.length && !availableDayNumbers.has(formData.dayNumber)) {
      setFormData((current) => ({ ...current, dayNumber: availableDays[0].dayNumber }));
    }
  }, [availableDays, availableDayNumbers, formData.dayNumber]);

  const filteredModules = modules.filter(m => {
    if (m.status === 'Archived') return false;
    if (!availableDayNumbers.has(Number(m.dayNumber))) return false;
    const q = searchTerm.toLowerCase();
    return (
      m.moduleName.toLowerCase().includes(q) ||
      m.topic.toLowerCase().includes(q) ||
      m.moduleNumber.toLowerCase().includes(q) ||
      (m.description && m.description.toLowerCase().includes(q))
    );
  });

  const handleOpenModal = (mod?: TqiModule) => {
    const defaultDay = availableDays[0]?.dayNumber || 1;
    if (mod) {
      setEditingModule(mod);
      setFormData({
        moduleNumber: mod.moduleNumber,
        moduleName: mod.moduleName,
        topic: mod.moduleName,
        description: mod.description || '',
        academicYear: currentAcademicYear || mod.academicYear,
        dayNumber: availableDayNumbers.has(Number(mod.dayNumber)) ? Number(mod.dayNumber) : defaultDay
      });
    } else {
      setEditingModule(null);
      setFormData({
        moduleNumber: `DAY-${Date.now()}`,
        moduleName: '',
        topic: '',
        description: '',
        academicYear: currentAcademicYear,
        dayNumber: defaultDay
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!availableDayNumbers.has(formData.dayNumber)) return;
    if (editingModule && onUpdateModule) {
      await onUpdateModule(editingModule.id, formData);
    } else if (onCreateModule) {
      await onCreateModule(formData);
    }
    setIsModalOpen(false);
  };

  const handleUpload = async (moduleId: string) => {
    if (!onUploadResource) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.ppt,.pptx';
    input.onchange = async (e: any) => {
      const files = Array.from(e.target.files || []) as File[];
      if (files.length > 0) {
        for (const file of files) {
          await onUploadResource(moduleId, file);
        }
      }
    };
    input.click();
  };

  const handleUploadDay = (day: { dayNumber: number; sessionName: string }) => {
    if (currentUserRole !== 'Super Admin') return;
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = '.pdf,.ppt,.pptx';
    input.onchange = async (event) => {
      const files = Array.from((event.target as HTMLInputElement).files || []);
      if (!files.length) return;
      try {
        let targetModule = modules.find((module) => Number(module.dayNumber || 1) === day.dayNumber && module.status !== 'Archived');
        if (!targetModule && onCreateModule) {
          const createdModuleId = await onCreateModule({
            moduleNumber: `DAY-${day.dayNumber}`,
            moduleName: day.sessionName,
            topic: day.sessionName,
            description: '',
            academicYear: currentAcademicYear,
            dayNumber: day.dayNumber,
          });
          if (createdModuleId) targetModule = { id: createdModuleId } as TqiModule;
        }
        if (!targetModule || !onUploadResource) throw new Error('Unable to prepare this Academic Setup day for upload.');
        for (const file of files) await onUploadResource(targetModule.id, file);
      } catch (error) {
        console.error('Failed to upload Academic Setup day resources:', error);
      }
    };
    input.click();
  };

  const isPptFile = (fileName?: string, fileType?: string) => {
    const name = (fileName || '').toLowerCase();
    const type = (fileType || '').toLowerCase();
    return type.includes('ppt') || name.endsWith('.ppt') || name.endsWith('.pptx');
  };

  return (
    <div className="w-full space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-gray-100 dark:border-gray-800">
        <div>
          <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white flex items-center gap-2">
            <span>Module Library & PPTs</span>
            {currentAcademicYear && (
              <span className="text-xs px-2.5 py-0.5 rounded-full font-medium bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 border border-brand-200 dark:border-brand-500/20">
                {currentAcademicYear}
              </span>
            )}
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Super Admins upload PPTs and curriculum materials; Cluster Admins can browse and download them directly for classroom sessions.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {currentUserRole === 'Super Admin' && (
            <button
              onClick={() => handleOpenModal()}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-brand-500 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white shadow-theme-xs hover:bg-brand-600 transition"
            >
              <Plus className="h-4 w-4" />
              <span>Create Module</span>
            </button>
          )}
        </div>
      </div>

      {/* Module search */}
      <div className="relative">
          <Search className="h-4 w-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search modules or topics..."
            className="w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 py-2 text-xs sm:text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-500 focus:outline-none dark:border-gray-800 dark:bg-gray-900 dark:text-white"
          />
      </div>

      {/* One section per Academic Setup day; each day remains visible before content is uploaded. */}
      {availableDays.length ? <div className="space-y-5">
        {availableDays.map((day) => {
          const dayModules = filteredModules.filter((module) => Number(module.dayNumber || 1) === day.dayNumber);
          return <section key={day.dayNumber} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.02]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 dark:border-gray-800">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-500">Day {day.dayNumber}</p>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">{day.sessionName}</h2>
              </div>
              {currentUserRole === 'Super Admin' && <button type="button" onClick={() => handleUploadDay(day)} className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 px-3 py-2 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:border-brand-500/30 dark:text-brand-300 dark:hover:bg-brand-500/10"><Upload className="h-3.5 w-3.5" />Upload files</button>}
            </div>
            {dayModules.length ? <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dayModules.map((module) => {
          const primaryPpt = module.resources?.find(r => r.isPrimaryPPT || isPptFile(r.fileName || r.originalFileName, r.fileType));
          const otherResources = module.resources?.filter(r => r.id !== primaryPpt?.id) || [];

          return (
            <div
              key={module.id}
              className="flex flex-col rounded-2xl border border-gray-200 bg-white p-4 sm:p-5 shadow-theme-xs hover:border-brand-500/40 transition dark:border-gray-800 dark:bg-white/[0.02]"
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400 border border-brand-100 dark:border-brand-500/20">
                    Day {module.dayNumber || 1}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                    module.status === 'Active'
                      ? 'bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400'
                      : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {module.status || 'Active'}
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  {currentUserRole === 'Super Admin' && (
                    <>
                      <button
                        onClick={() => handleOpenModal(module)}
                        className="p-1.5 text-gray-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition dark:hover:bg-gray-800"
                        title="Edit Module"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteModule && onDeleteModule(module.id)}
                        className="p-1.5 text-gray-400 hover:text-error-500 hover:bg-error-50 rounded-lg transition dark:hover:bg-gray-800"
                        title="Delete Module"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Module Title & Description */}
              <div className="mt-1">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white leading-snug">
                  {module.moduleName}
                </h3>
                {module.topic && module.topic !== module.moduleName && (
                  <p className="text-xs font-medium text-brand-600 dark:text-brand-400 mt-0.5">
                    {module.topic}
                  </p>
                )}
                {module.description && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 line-clamp-3">
                    {module.description}
                  </p>
                )}
              </div>

              {/* Primary PPT Download Feature Card */}
              {primaryPpt ? (
                <div className="mt-4 p-3 rounded-xl bg-orange-50/60 dark:bg-orange-500/10 border border-orange-200/80 dark:border-orange-500/20">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-orange-500 text-white flex items-center justify-center font-bold text-[10px] shrink-0 shadow-sm">
                        PPT
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                            {primaryPpt.fileName || primaryPpt.originalFileName}
                          </span>
                        </div>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">
                          Primary Session Slides
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {onViewResource && (
                        <button
                          type="button"
                          onClick={() => onViewResource(module.id, primaryPpt.id)}
                          className="p-1.5 text-gray-500 hover:text-brand-500 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition"
                          title="Preview Slides"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onDownloadResource && onDownloadResource(module.id, primaryPpt.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-semibold shadow-theme-xs transition active:scale-95"
                        title="Download PPT"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download PPT</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 p-3 rounded-xl bg-gray-50 dark:bg-white/[0.02] border border-dashed border-gray-200 dark:border-gray-800 flex items-center justify-between">
                  <div className="text-xs text-gray-400 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span>No PPT presentation uploaded yet</span>
                  </div>
                  {currentUserRole === 'Super Admin' && (
                    <button
                      type="button"
                      onClick={() => handleUpload(module.id)}
                      className="text-xs text-brand-600 hover:text-brand-700 font-semibold"
                    >
                      + Upload PPT
                    </button>
                  )}
                </div>
              )}

              {/* Other Resources & Worksheets */}
              <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800 space-y-2 flex-1">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-semibold text-gray-500 dark:text-gray-400">
                    Additional Materials ({otherResources.length})
                  </span>
                  {currentUserRole === 'Super Admin' && (
                    <button
                      onClick={() => handleUpload(module.id)}
                      className="text-brand-500 font-semibold hover:underline flex items-center gap-1 text-xs"
                    >
                      <Upload className="w-3 h-3" /> Add Files
                    </button>
                  )}
                </div>

                {otherResources.map((res) => {
                  const isPdf = (res.fileType || '').toLowerCase().includes('pdf') || (res.fileName || '').toLowerCase().endsWith('.pdf');
                  return (
                    <div
                      key={res.id}
                      className="flex items-center justify-between p-2 bg-gray-50 dark:bg-white/[0.02] rounded-xl border border-gray-100 dark:border-gray-800 text-xs"
                    >
                      <div className="flex items-center gap-2 truncate pr-2">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                          isPdf ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300'
                        }`}>
                          {res.fileType || (isPdf ? 'PDF' : 'FILE')}
                        </span>
                        <span className="truncate text-gray-700 dark:text-gray-300">
                          {res.fileName || res.originalFileName}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {onViewResource && (
                          <button
                            type="button"
                            onClick={() => onViewResource(module.id, res.id)}
                            className="text-gray-500 hover:text-brand-500 p-1.5 rounded-md hover:bg-white dark:hover:bg-gray-800 transition"
                            title="View resource"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onDownloadResource && onDownloadResource(module.id, res.id)}
                          className="text-gray-500 hover:text-brand-500 p-1.5 rounded-md hover:bg-white dark:hover:bg-gray-800 transition"
                          title="Download resource"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        {currentUserRole === 'Super Admin' && (
                          <button
                            type="button"
                            onClick={() => onDeleteResource && onDeleteResource(module.id, res.id)}
                            className="text-gray-500 hover:text-red-600 p-1.5 rounded-md hover:bg-white dark:hover:bg-gray-800 transition"
                            title="Delete resource"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {otherResources.length === 0 && !primaryPpt && (
                  <div className="text-[11px] text-gray-400 text-center py-2 bg-gray-50 dark:bg-white/[0.02] rounded-lg">
                    No documents attached yet
                  </div>
                )}
              </div>
            </div>
          );
        })}

            </div> : <div className="rounded-xl border border-dashed border-gray-200 px-4 py-7 text-center text-xs text-gray-500 dark:border-gray-700">{currentUserRole === 'Super Admin' ? 'No materials uploaded for this day yet. Use Upload files to add PPT or PDF materials.' : 'No materials uploaded by Super Admin for this day yet.'}</div>}
          </section>;
        })}
        {currentUserRole !== 'Super Admin' && filteredModules.length === 0 && <div className="py-12 text-center text-sm text-gray-500">No uploaded materials found for this academic year or filter.</div>}
      </div> : <div className="rounded-xl border border-dashed border-gray-200 py-12 text-center text-sm text-gray-500 dark:border-gray-800">No named Academic Setup days are configured for this academic year.</div>}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/60 p-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="font-bold text-gray-900 dark:text-white">
                {editingModule ? 'Edit Module' : 'Create Module'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Academic Setup Day</label>
                  <Select
                    value={String(formData.dayNumber)}
                    onValueChange={(val) => setFormData({ ...formData, dayNumber: Number(val) })}
                  >
                    <SelectTrigger className="w-full text-xs h-9 rounded-xl border border-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:text-white">
                      <SelectValue placeholder="Select Day" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableDays.map(({ dayNumber: d, sessionName }) => (
                        <SelectItem key={d} value={String(d)}>
                          Day {d} · {sessionName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1" htmlFor="mod-name">Module Name</label>
                <input id="mod-name" required value={formData.moduleName} onChange={e => setFormData({...formData, moduleName: e.target.value})} className="w-full text-xs rounded-xl border border-gray-300 p-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
              </div>
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                Academic Year: <strong>{currentAcademicYear || 'Not configured'}</strong>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1" htmlFor="mod-desc">Description</label>
                <textarea id="mod-desc" rows={3} value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full text-xs rounded-xl border border-gray-300 p-2 dark:bg-gray-800 dark:border-gray-700 dark:text-white" />
              </div>
              <div className="pt-4 flex justify-end gap-2 border-t border-gray-100 dark:border-gray-800">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-xs font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300">Cancel</button>
                <button type="submit" disabled={!availableDays.length} className="px-4 py-2 text-xs font-semibold text-white bg-brand-500 rounded-xl hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50">Save Module</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
