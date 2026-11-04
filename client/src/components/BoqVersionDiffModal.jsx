import React, { useState } from 'react';
import {
  X,
  GitCompare,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  RefreshCw,
  MinusCircle,
  ArrowRight,
  Filter,
} from 'lucide-react';

export default function BoqVersionDiffModal({
  isOpen,
  onClose,
  version,
  currentModels = [],
  categories = [],
  onRestore,
  lang = 'en',
}) {
  const isKu = lang === 'ku';

  const [filterType, setFilterType] = useState('all'); // 'all' | 'added' | 'modified' | 'removed' | 'unchanged'

  if (!isOpen || !version) return null;

  const snapshotItems = version.items_snapshot || [];

  // Compute Diff between version snapshot and current models
  const diffResults = [];

  // 1. Check current models against snapshot (Added or Modified or Unchanged)
  currentModels.forEach((curr) => {
    const normModel = (curr.model || '').trim().toLowerCase();
    const normBrand = (curr.brand || '').trim().toLowerCase();

    const inSnapshot = snapshotItems.find(
      (s) =>
        s.model?.trim().toLowerCase() === normModel ||
        (s.brand?.trim().toLowerCase() === normBrand && s.model?.trim().toLowerCase() === normModel)
    );

    if (!inSnapshot) {
      // In current, but not in snapshot => ADDED in current
      diffResults.push({
        status: 'added',
        item: curr,
        diffs: [],
      });
    } else {
      // Exists in both => compare fields
      const diffs = [];
      if (Number(inSnapshot.total_qty) !== Number(curr.total_qty)) {
        diffs.push({
          label: isKu ? 'ژمارە' : 'Qty',
          oldVal: inSnapshot.total_qty,
          newVal: curr.total_qty,
        });
      }
      if (Number(inSnapshot.unit_cost) !== Number(curr.unit_cost)) {
        diffs.push({
          label: isKu ? 'نرخ' : 'Cost',
          oldVal: `$${inSnapshot.unit_cost}`,
          newVal: `$${curr.unit_cost}`,
        });
      }
      if ((inSnapshot.description || '').trim() !== (curr.description || '').trim() && (curr.description || '').trim()) {
        diffs.push({
          label: isKu ? 'پێناسە' : 'Description',
          oldVal: inSnapshot.description,
          newVal: curr.description,
        });
      }
      if (curr.category_id && inSnapshot.category_id !== curr.category_id) {
        diffs.push({
          label: isKu ? 'بەش' : 'Category',
          oldVal: inSnapshot.category_id,
          newVal: curr.category_id,
        });
      }
      if (Boolean(inSnapshot.is_rack_mounted) !== Boolean(curr.is_rack_mounted)) {
        diffs.push({
          label: isKu ? 'ڕاک' : 'Rack',
          oldVal: inSnapshot.is_rack_mounted ? 'Yes' : 'No',
          newVal: curr.is_rack_mounted ? 'Yes' : 'No',
        });
      }

      if (diffs.length > 0) {
        diffResults.push({
          status: 'modified',
          item: curr,
          snapshotItem: inSnapshot,
          diffs,
        });
      } else {
        diffResults.push({
          status: 'unchanged',
          item: curr,
          snapshotItem: inSnapshot,
          diffs: [],
        });
      }
    }
  });

  // 2. Check snapshot items missing in current => REMOVED
  snapshotItems.forEach((snap) => {
    const normModel = (snap.model || '').trim().toLowerCase();
    const normBrand = (snap.brand || '').trim().toLowerCase();

    const inCurrent = currentModels.find(
      (c) =>
        c.model?.trim().toLowerCase() === normModel ||
        (c.brand?.trim().toLowerCase() === normBrand && c.model?.trim().toLowerCase() === normModel)
    );

    if (!inCurrent) {
      diffResults.push({
        status: 'removed',
        item: snap,
        diffs: [],
      });
    }
  });

  const addedCount = diffResults.filter((d) => d.status === 'added').length;
  const modifiedCount = diffResults.filter((d) => d.status === 'modified').length;
  const removedCount = diffResults.filter((d) => d.status === 'removed').length;
  const unchangedCount = diffResults.filter((d) => d.status === 'unchanged').length;

  const filteredDiffs = diffResults.filter((d) => {
    if (filterType === 'added') return d.status === 'added';
    if (filterType === 'modified') return d.status === 'modified';
    if (filterType === 'removed') return d.status === 'removed';
    if (filterType === 'unchanged') return d.status === 'unchanged';
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col space-y-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-indigo-500/15 text-indigo-400 border border-indigo-500/25">
              <GitCompare className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>{isKu ? 'بەراوردکردنی جیاوازییەکانی ڤێرژن (Diff Viewer)' : 'Version Comparison & Diff Analysis'}</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-blue-600/20 text-blue-300 border border-blue-500/30">
                  {version.version_number}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isKu ? 'بەراوردی ئەم ڤێرژنە بەرامبەر کەتەلۆگی ئێستای BOQ' : 'Comparing this snapshot against current live BOQ catalog'}
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

        {/* Diff KPI Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          <div className="p-3 rounded-2xl bg-emerald-950/20 border border-emerald-500/30">
            <span className="text-[10px] text-emerald-300 font-semibold block">{isKu ? '➕ ئامێری نوێ' : '➕ Added in Current'}</span>
            <span className="text-xl font-bold text-emerald-400">+{addedCount}</span>
          </div>
          <div className="p-3 rounded-2xl bg-amber-950/20 border border-amber-500/30">
            <span className="text-[10px] text-amber-300 font-semibold block">{isKu ? '🔄 گۆڕانکاری (ئەپدەیت)' : '🔄 Modified Fields'}</span>
            <span className="text-xl font-bold text-amber-300">~{modifiedCount}</span>
          </div>
          <div className="p-3 rounded-2xl bg-rose-950/20 border border-rose-500/30">
            <span className="text-[10px] text-rose-300 font-semibold block">{isKu ? '➖ سڕاوە لە ئێستادا' : '➖ Removed in Current'}</span>
            <span className="text-xl font-bold text-rose-400">-{removedCount}</span>
          </div>
          <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
            <span className="text-[10px] text-slate-400 font-semibold block">{isKu ? '⚪ بێ گۆڕانکاری' : '⚪ Unchanged'}</span>
            <span className="text-xl font-bold text-slate-300">{unchangedCount}</span>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-b border-slate-800 pb-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition ${
              filterType === 'all' ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {isKu ? 'هەموو' : 'All'} ({diffResults.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('added')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition ${
              filterType === 'added'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-950/30 text-emerald-400 border border-emerald-500/30'
            }`}
          >
            ➕ {isKu ? 'نوێ' : 'Added'} ({addedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('modified')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition ${
              filterType === 'modified'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-950/30 text-amber-300 border border-amber-500/30'
            }`}
          >
            🔄 {isKu ? 'گۆڕاو' : 'Modified'} ({modifiedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('removed')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition ${
              filterType === 'removed'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-950/30 text-rose-300 border border-rose-500/30'
            }`}
          >
            ➖ {isKu ? 'سڕاوە' : 'Removed'} ({removedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterType('unchanged')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold transition ${
              filterType === 'unchanged'
                ? 'bg-slate-700 text-white'
                : 'bg-slate-950 text-slate-400 border border-slate-800'
            }`}
          >
            ⚪ {isKu ? 'بێ گۆڕانکاری' : 'Unchanged'} ({unchangedCount})
          </button>
        </div>

        {/* Diff Table */}
        <div className="flex-1 overflow-y-auto border border-slate-800 rounded-2xl bg-slate-950/50">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/90 text-slate-400 sticky top-0 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">{isKu ? 'جیاوازی' : 'Diff Status'}</th>
                <th className="py-2.5 px-3">{isKu ? 'براند و مۆدێل' : 'Brand & Model'}</th>
                <th className="py-2.5 px-3">{isKu ? 'پێناسە' : 'Description'}</th>
                <th className="py-2.5 px-3">{isKu ? 'ژمارە' : 'Qty'}</th>
                <th className="py-2.5 px-3">{isKu ? 'نرخ' : 'Cost'}</th>
                <th className="py-2.5 px-3">{isKu ? 'وردەکاری گۆڕانکارییەکان' : 'Changes Details'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredDiffs.map((diff, idx) => {
                const item = diff.item;
                const isAdd = diff.status === 'added';
                const isMod = diff.status === 'modified';
                const isRem = diff.status === 'removed';

                return (
                  <tr
                    key={idx}
                    className={`transition ${
                      isAdd
                        ? 'bg-emerald-950/15 hover:bg-emerald-950/25'
                        : isMod
                        ? 'bg-amber-950/15 hover:bg-amber-950/25'
                        : isRem
                        ? 'bg-rose-950/15 hover:bg-rose-950/25'
                        : 'hover:bg-slate-900/40 opacity-70'
                    }`}
                  >
                    <td className="py-2.5 px-3">
                      {isAdd && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          ➕ {isKu ? 'نوێ' : 'Added'}
                        </span>
                      )}
                      {isMod && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          🔄 {isKu ? 'گۆڕاو' : 'Modified'}
                        </span>
                      )}
                      {isRem && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          ➖ {isKu ? 'سڕاوە' : 'Removed'}
                        </span>
                      )}
                      {!isAdd && !isMod && !isRem && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                          ⚪ {isKu ? 'هاوشێوە' : 'Same'}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-white block">{item.brand}</span>
                      <span className="text-blue-400 font-mono text-[11px] block">{item.model}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 max-w-xs truncate">
                      {item.description || '—'}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-white">
                      {item.total_qty}
                    </td>
                    <td className="py-2.5 px-3 text-slate-300 font-mono">
                      ${item.unit_cost}
                    </td>
                    <td className="py-2.5 px-3 text-[11px]">
                      {diff.diffs && diff.diffs.length > 0 ? (
                        <div className="space-y-1">
                          {diff.diffs.map((d, i) => (
                            <span
                              key={i}
                              className="inline-block mr-1.5 px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30 text-[10px]"
                            >
                              {d.label}: {d.oldVal} ➔ <strong>{d.newVal}</strong>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-500 text-[10px]">
                          {isAdd
                            ? (isKu ? 'ئامێرێکی نوێیە لە کەتەلۆگی ئێستادا' : 'New device in current BOQ')
                            : isRem
                            ? (isKu ? 'لە کەتەلۆگی ئێستادا سڕدراوەتەوە' : 'Removed from current BOQ')
                            : (isKu ? 'تەواو وەک یەکن' : 'Identical')}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400">
            <span>{isKu ? `ڤێرژنی هەڵبژێردراو: ${version.version_number}` : `Selected Version: ${version.version_number}`}</span>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              {isKu ? 'داخستن' : 'Close'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (onRestore) {
                  onRestore(version);
                  onClose();
                }
              }}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/30 transition active:scale-95"
            >
              <RotateCcw className="w-4 h-4" />
              <span>
                {isKu ? `گەڕاندنەوە بۆ ئەم ڤێرژنە (${version.version_number})` : `Restore to ${version.version_number}`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

