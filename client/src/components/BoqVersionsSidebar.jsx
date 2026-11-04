import React, { useState, useEffect } from 'react';
import {
  X,
  History,
  RotateCcw,
  GitCompare,
  Plus,
  Check,
  Calendar,
  Layers,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  Clock,
  User,
} from 'lucide-react';
import { api } from '../services/api';

export default function BoqVersionsSidebar({
  isOpen,
  onClose,
  activeProject,
  currentBoqModels = [],
  onRestoreVersion,
  onCreateSnapshot,
  onOpenDiffModal,
  lang = 'en',
}) {
  const isKu = lang === 'ku';

  const [versions, setVersions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSnapshotModalOpen, setIsSnapshotModalOpen] = useState(false);
  const [snapshotTitle, setSnapshotTitle] = useState('');
  const [snapshotSummary, setSnapshotSummary] = useState('');
  const [isSubmittingSnapshot, setIsSubmittingSnapshot] = useState(false);
  const [restoringId, setRestoringId] = useState(null);

  useEffect(() => {
    if (isOpen) {
      loadVersions();
    }
  }, [isOpen, activeProject?.id]);

  const loadVersions = async () => {
    try {
      setIsLoading(true);
      const data = await api.getBoqVersions(activeProject?.id || 'proj-sitak');
      setVersions(data || []);
    } catch (err) {
      console.error('Failed to load BOQ versions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTakeSnapshot = async (e) => {
    e.preventDefault();
    if (!snapshotTitle.trim()) return;

    try {
      setIsSubmittingSnapshot(true);
      const newVer = await onCreateSnapshot({
        title: snapshotTitle.trim(),
        title_ku: snapshotTitle.trim(),
        summary: snapshotSummary.trim() || `Snapshot of ${currentBoqModels.length} models`,
        summary_ku: snapshotSummary.trim() || `ڤێرژنی دەستی بۆ ${currentBoqModels.length} مۆدێل`,
      });
      setVersions((prev) => [newVer, ...prev]);
      setIsSnapshotModalOpen(false);
      setSnapshotTitle('');
      setSnapshotSummary('');
    } catch (err) {
      alert(err.message || 'Failed to save snapshot');
    } finally {
      setIsSubmittingSnapshot(false);
    }
  };

  const handleRestore = async (version) => {
    const confirmMsg = isKu
      ? `ئایا دڵنیایت لە گەڕاندنەوەی کەتەلۆکی ئەم پڕۆژەیە بۆ ڤێرژنی ${version.version_number} (${version.title_ku || version.title})؟`
      : `Are you sure you want to restore the BOQ catalog to version ${version.version_number} (${version.title})?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setRestoringId(version.id);
      await onRestoreVersion(version.id);
      await loadVersions();
    } catch (err) {
      alert(err.message || 'Failed to restore version');
    } finally {
      setRestoringId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-md sm:max-w-lg bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/95">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/15 text-blue-400 border border-blue-500/25">
              <History className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>{isKu ? 'مێژوو و ڤێرژنەکانی BOQ' : 'BOQ Versions & History'}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/15 text-blue-300 border border-blue-500/30">
                  {versions.length} {isKu ? 'ڤێرژن' : 'Versions'}
                </span>
              </h3>
              <p className="text-xs text-slate-400 truncate max-w-[260px]">
                {activeProject?.name || 'Project Site'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar */}
        <div className="p-3 bg-slate-950/50 border-b border-slate-800/80 flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-400">
            {isKu ? 'دەتوانیت هەر ڤێرژنێک بەراورد یان ڕیستۆر بکەیت' : 'Compare diffs or restore any previous snapshot'}
          </span>
          <button
            type="button"
            onClick={() => setIsSnapshotModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow transition active:scale-95 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isKu ? '+ وەرگرتنی ڤێرژن' : '+ Save Snapshot'}</span>
          </button>
        </div>

        {/* Snapshot Modal Form */}
        {isSnapshotModalOpen && (
          <div className="p-4 bg-slate-950 border-b border-slate-800 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>{isKu ? 'تۆمارکردنی ڤێرژنی نوێ لەم ساتەدا' : 'Create New BOQ Snapshot Checkpoint'}</span>
              </h4>
              <button
                type="button"
                onClick={() => setIsSnapshotModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleTakeSnapshot} className="space-y-2.5">
              <input
                type="text"
                required
                value={snapshotTitle}
                onChange={(e) => setSnapshotTitle(e.target.value)}
                placeholder={isKu ? 'ناوی ڤێرژنەکە، وەک: پێش دەستپێکردنی دامەزراندن' : 'Snapshot title, e.g. Pre-Commissioning Baseline'}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
              <input
                type="text"
                value={snapshotSummary}
                onChange={(e) => setSnapshotSummary(e.target.value)}
                placeholder={isKu ? 'تێبینی یان هۆکاری گۆڕانکاری (ئارەزوومەندانە)' : 'Reason or summary notes (optional)'}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsSnapshotModalOpen(false)}
                  className="px-3 py-1 rounded-lg text-xs text-slate-400 hover:text-white"
                >
                  {isKu ? 'پاشگەزبوونەوە' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSnapshot}
                  className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow transition disabled:opacity-50"
                >
                  {isSubmittingSnapshot ? (isKu ? 'تۆمار دەکرێت...' : 'Saving...') : (isKu ? 'تۆمارکردن' : 'Save')}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Versions List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs text-slate-400">{isKu ? 'بارکردنی ڤێرژنەکان...' : 'Loading versions...'}</span>
            </div>
          ) : versions.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <History className="w-10 h-10 text-slate-600 mx-auto" />
              <h4 className="text-sm font-semibold text-white">
                {isKu ? 'هیچ ڤێرژنێک تۆمار نەکراوە' : 'No BOQ versions recorded yet'}
              </h4>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                {isKu
                  ? 'لەگەڵ هەموو هاوردەکردنێکی ئێکسڵ یان دروستکردنی دەستی، ڤێرژنی نوێ لێرە هەڵدەگیرێت.'
                  : 'Every Excel import or manual snapshot automatically creates a version here.'}
              </p>
            </div>
          ) : (
            versions.map((ver, idx) => {
              const isLatest = idx === 0;
              const dateStr = new Date(ver.created_at).toLocaleString(isKu ? 'ku' : 'en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              });

              const addedCount = ver.changes?.added_count || 0;
              const updatedCount = ver.changes?.updated_count || 0;
              const skippedCount = ver.changes?.skipped_count || 0;

              return (
                <div
                  key={ver.id}
                  className={`p-4 rounded-2xl border transition-all duration-200 space-y-3 ${
                    isLatest
                      ? 'bg-blue-950/25 border-blue-500/40 shadow-lg shadow-blue-950/30'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {/* Top Version Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-xl text-xs font-bold bg-blue-600/30 text-blue-300 border border-blue-500/40 font-mono">
                        {ver.version_number}
                      </span>
                      {isLatest && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          {isKu ? 'دواین ڤێرژن' : 'Latest'}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-slate-500" />
                      <span>{dateStr}</span>
                    </div>
                  </div>

                  {/* Title & Summary */}
                  <div>
                    <h4 className="text-sm font-bold text-white tracking-tight">
                      {isKu ? (ver.title_ku || ver.title) : ver.title}
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {isKu ? (ver.summary_ku || ver.summary) : ver.summary}
                    </p>
                  </div>

                  {/* Change Badges */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-semibold">
                      {ver.item_count || ver.items_snapshot?.length || 0} {isKu ? 'ئامێر' : 'Items'}
                    </span>
                    {addedCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-semibold">
                        +{addedCount} {isKu ? 'نوێ' : 'Added'}
                      </span>
                    )}
                    {updatedCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                        ~{updatedCount} {isKu ? 'نوێکراوە' : 'Updated'}
                      </span>
                    )}
                    {skippedCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-400 border border-slate-700">
                        {skippedCount} {isKu ? 'بێ گۆڕانکاری' : 'Skipped'}
                      </span>
                    )}
                  </div>

                  {/* Actions for this Version */}
                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenDiffModal && onOpenDiffModal(ver)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-blue-600/30 text-blue-300 hover:text-white border border-slate-700 hover:border-blue-500/40 transition active:scale-95"
                    >
                      <GitCompare className="w-3.5 h-3.5 text-blue-400" />
                      <span>{isKu ? 'بەراوردکردن (Diff)' : 'Compare Diff'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={restoringId === ver.id}
                      onClick={() => handleRestore(ver)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-amber-600/30 text-amber-300 hover:text-amber-200 border border-slate-700 hover:border-amber-500/40 transition active:scale-95 disabled:opacity-50"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                      <span>
                        {restoringId === ver.id
                          ? (isKu ? 'دەگەڕێندرێتەوە...' : 'Restoring...')
                          : (isKu ? 'ڕیستۆرکردن' : 'Restore')}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
