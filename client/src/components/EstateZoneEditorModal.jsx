import React, { useState } from 'react';
import {
  X,
  Plus,
  Pencil,
  Trash2,
  Check,
  Building2,
  Sparkles,
} from 'lucide-react';
import { useEstateZones } from '../utils/estateZoneManager';

export default function EstateZoneEditorModal({ isOpen, onClose, lang = 'ku' }) {
  const isKu = lang === 'ku';
  const { estateZones, addEstateZone, updateEstateZone, deleteEstateZone } = useEstateZones();

  const [newNameEn, setNewNameEn] = useState('');
  const [newNameKu, setNewNameKu] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editNameEn, setEditNameEn] = useState('');
  const [editNameKu, setEditNameKu] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleAdd = (e) => {
    e.preventDefault();
    setErrorMsg('');
    const nameEn = newNameEn.trim();
    const nameKu = newNameKu.trim();

    if (!nameEn && !nameKu) {
      setErrorMsg(isKu ? 'تکایە ناوی زۆن بنووسە' : 'Please provide a zone name');
      return;
    }

    const added = addEstateZone(nameEn || nameKu, nameKu || nameEn);
    if (!added) {
      setErrorMsg(isKu ? 'نەتوانرا زیاد بکرێت' : 'Failed to add zone');
      return;
    }

    setNewNameEn('');
    setNewNameKu('');
  };

  const handleStartEdit = (zone) => {
    setEditingId(zone.id);
    setEditNameEn(zone.label || '');
    setEditNameKu(zone.labelKu || zone.label || '');
  };

  const handleSaveEdit = (id) => {
    if (!editNameEn.trim() && !editNameKu.trim()) return;
    updateEstateZone(id, editNameEn.trim() || editNameKu.trim(), editNameKu.trim() || editNameEn.trim());
    setEditingId(null);
  };

  const handleDelete = (id, label) => {
    const confirmText = isKu
      ? `ئایا دڵنیایت لە سڕینەوەی زۆنی "${label}"؟`
      : `Are you sure you want to delete zone "${label}"?`;
    if (window.confirm(confirmText)) {
      deleteEstateZone(id);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 my-6 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                {isKu ? 'بەڕێوەبردنی زۆنەکان (Zones)' : 'Manage Estate Zones'}
              </h3>
              <p className="text-xs text-slate-400">
                {isKu
                  ? 'Main Villa، Guest House، Service Area یان زۆنی نوێ'
                  : 'Main Villa, Guest House, Service Area, or custom zones'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add New Zone Form */}
        <form onSubmit={handleAdd} className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-400">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isKu ? 'زیادکردنی زۆنی نوێ' : 'Add New Estate Zone'}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <input
                type="text"
                value={newNameEn}
                onChange={(e) => setNewNameEn(e.target.value)}
                placeholder={isKu ? 'ناو بە ئینگلیزی (وەک Pool House)' : 'Name in English (e.g. Pool House)'}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <input
                type="text"
                value={newNameKu}
                onChange={(e) => setNewNameKu(e.target.value)}
                placeholder={isKu ? 'ناو بە کوردی (وەک خانووی حەوز)' : 'Name in Kurdish (optional)'}
                className="w-full bg-slate-900 border border-slate-700/80 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {errorMsg && <p className="text-[11px] text-red-400">{errorMsg}</p>}

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isKu ? 'زیادکردنی زۆن' : 'Add Zone'}</span>
            </button>
          </div>
        </form>

        {/* Existing Zones List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px] max-h-[300px]">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block px-1">
            {isKu ? 'لیستی زۆنەکان (Zones)' : 'Active Estate Zones'} ({estateZones.length})
          </span>

          <div className="space-y-1.5">
            {estateZones.map((zone) => {
              const isEditing = editingId === zone.id;

              if (isEditing) {
                return (
                  <div
                    key={zone.id}
                    className="p-2.5 rounded-xl bg-slate-800 border border-blue-500/50 space-y-2 animate-fadeIn"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={editNameEn}
                        onChange={(e) => setEditNameEn(e.target.value)}
                        placeholder="English name"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-400"
                      />
                      <input
                        type="text"
                        value={editNameKu}
                        onChange={(e) => setEditNameKu(e.target.value)}
                        placeholder="ناوی کوردی"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-400"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-2.5 py-1 rounded-lg text-[11px] text-slate-400 hover:text-white"
                      >
                        {isKu ? 'پاشگەزبوونەوە' : 'Cancel'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(zone.id)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold"
                      >
                        <Check className="w-3 h-3" />
                        <span>{isKu ? 'سەیڤکە' : 'Save'}</span>
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={zone.id}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-200">
                          {isKu ? zone.labelKu : zone.label}
                        </span>
                        {zone.labelKu && zone.label && zone.labelKu !== zone.label && (
                          <span className="text-[11px] text-slate-400">
                            ({isKu ? zone.label : zone.labelKu})
                          </span>
                        )}
                        {zone.isSystem && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                            {isKu ? 'بنەڕەتی' : 'System'}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">ID: {zone.id}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(zone)}
                      title={isKu ? 'دەستکاری ناو' : 'Edit name'}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    {!zone.isSystem && (
                      <button
                        type="button"
                        onClick={() => handleDelete(zone.id, isKu ? zone.labelKu : zone.label)}
                        title={isKu ? 'سڕینەوەی ئەم زۆنە' : 'Delete this zone'}
                        className="p-1.5 rounded-lg text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition"
          >
            {isKu ? 'تەواو / داخستن' : 'Done'}
          </button>
        </div>
      </div>
    </div>
  );
}
