import React, { useState } from 'react';
import {
  X,
  Plus,
  Pencil,
  Trash2,
  Check,
  Server,
  Building2,
  MapPin,
  Cpu,
} from 'lucide-react';
import { useRacks } from '../utils/rackManager';
import { useEstateZones } from '../utils/estateZoneManager';

const RACK_UNIT_PRESETS = [48, 45, 42, 36, 24, 18, 15, 12, 9, 6, 4];

export default function RackManagerModal({ isOpen, onClose, devices = [], lang = 'ku' }) {
  const isKu = lang === 'ku';
  const { racks, addRack, updateRack, deleteRack } = useRacks(devices);
  const { estateZones, formatEstateZone } = useEstateZones();

  const [newNameEn, setNewNameEn] = useState('');
  const [newNameKu, setNewNameKu] = useState('');
  const [newUnits, setNewUnits] = useState(42);
  const [newZone, setNewZone] = useState('main_villa');
  const [newLocation, setNewLocation] = useState('');

  const [editingId, setEditingId] = useState(null);
  const [editNameEn, setEditNameEn] = useState('');
  const [editNameKu, setEditNameKu] = useState('');
  const [editUnits, setEditUnits] = useState(42);
  const [editZone, setEditZone] = useState('main_villa');
  const [editLocation, setEditLocation] = useState('');

  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleAdd = (e) => {
    e.preventDefault();
    setErrorMsg('');
    const nameEn = newNameEn.trim();
    const nameKu = newNameKu.trim();

    if (!nameEn && !nameKu) {
      setErrorMsg(isKu ? 'تکایە ناوی ڕاکەکە بنووسە' : 'Please provide a rack name');
      return;
    }

    const added = addRack(
      nameEn || nameKu,
      nameKu || nameEn,
      Number(newUnits) || 42,
      newZone,
      newLocation
    );

    if (!added) {
      setErrorMsg(isKu ? 'نەتوانرا زیاد بکرێت' : 'Failed to add rack');
      return;
    }

    setNewNameEn('');
    setNewNameKu('');
    setNewUnits(42);
    setNewLocation('');
  };

  const handleStartEdit = (rack) => {
    setEditingId(rack.id);
    setEditNameEn(rack.name || '');
    setEditNameKu(rack.nameKu || rack.name || '');
    setEditUnits(rack.totalUnits || 42);
    setEditZone(rack.zone || 'main_villa');
    setEditLocation(rack.location || '');
  };

  const handleSaveEdit = (id) => {
    if (!editNameEn.trim() && !editNameKu.trim()) return;
    updateRack(id, {
      name: editNameEn.trim() || editNameKu.trim(),
      nameKu: editNameKu.trim() || editNameEn.trim(),
      totalUnits: Number(editUnits) || 42,
      zone: editZone,
      location: editLocation,
    });
    setEditingId(null);
  };

  const handleDelete = (rack) => {
    const rackLabel = isKu ? (rack.nameKu || rack.name) : rack.name;
    const installedCount = devices.filter(
      (d) =>
        d.rack_name &&
        (d.rack_name.toLowerCase() === rack.name.toLowerCase() ||
          (rack.nameKu && d.rack_name.toLowerCase() === rack.nameKu.toLowerCase()) ||
          d.rack_name === rack.id)
    ).length;

    let confirmText = isKu
      ? `ئایا دڵنیایت لە سڕینەوەی ڕاکی "${rackLabel}"؟`
      : `Are you sure you want to delete rack "${rackLabel}"?`;

    if (installedCount > 0) {
      confirmText += isKu
        ? `\n\nئاگاداری: (${installedCount}) ئامێر لەم ڕاکەدایە!`
        : `\n\nWarning: ${installedCount} devices are mapped to this rack!`;
    }

    if (window.confirm(confirmText)) {
      deleteRack(rack.id);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 my-6 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30 shadow-sm">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {isKu ? 'بەڕێوەبردنی ڕاکەکان (Rack & Cabinet Manager)' : 'Rack & Cabinet Manager'}
              </h3>
              <p className="text-xs text-slate-400">
                {isKu
                  ? 'زیادکردنی ڕاکی نوێ، گۆڕینی ناوەکان، دیاریکردنی قەبارە (42U) و شوێنەکانیان'
                  : 'Add, rename, edit capacity (42U/24U), and configure equipment racks'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Add New Rack Form */}
        <form onSubmit={handleAdd} className="p-3.5 bg-slate-950/70 border border-slate-800/80 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              <span>{isKu ? 'زیادکردنی ڕاکی نوێ' : 'Add New Server Rack / Cabinet'}</span>
            </span>
            <span className="text-[10px] text-slate-500 font-mono">
              {racks.length} {isKu ? 'ڕاک تۆمارکراوە' : 'racks configured'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                {isKu ? 'ناوی ڕاک (ئینگلیزی):' : 'Rack Name (English):'}
              </label>
              <input
                type="text"
                value={newNameEn}
                onChange={(e) => setNewNameEn(e.target.value)}
                placeholder="e.g. Main 42U Server Rack B"
                className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                {isKu ? 'ناوی ڕاک بە کوردی:' : 'Rack Name (Kurdish):'}
              </label>
              <input
                type="text"
                value={newNameKu}
                onChange={(e) => setNewNameKu(e.target.value)}
                placeholder="بۆ نموونە: ڕاکی سێرڤەری سەرەکی 42U B"
                className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                {isKu ? 'قەبارەی ڕاک (Rack Units):' : 'Rack Units (RU):'}
              </label>
              <select
                value={newUnits}
                onChange={(e) => setNewUnits(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
              >
                {RACK_UNIT_PRESETS.map((u) => (
                  <option key={u} value={u}>
                    {u}U Rack
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                {isKu ? 'زۆنی پرۆژە:' : 'Estate Zone:'}
              </label>
              <select
                value={newZone}
                onChange={(e) => setNewZone(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
              >
                {estateZones.map((ez) => (
                  <option key={ez.id} value={ez.id}>
                    {isKu ? (ez.labelKu || ez.label) : ez.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-300 mb-1">
                {isKu ? 'ژوور / شوێنی ورد:' : 'Room / Location:'}
              </label>
              <input
                type="text"
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                placeholder="e.g. Basement -1 Server Room"
                className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
              />
            </div>
          </div>

          {errorMsg && <p className="text-xs text-red-400 font-medium">{errorMsg}</p>}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-blue-900/30 cursor-pointer active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>{isKu ? '+ زیادکردنی ئەم ڕاکە' : '+ Add Rack'}</span>
            </button>
          </div>
        </form>

        {/* Existing Racks List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
          <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider block mb-1">
            {isKu ? 'ڕاکە تۆمارکراوەکان (کلیک بکە بۆ گۆڕینی ناو یان دەستکاری):' : 'Configured Racks (Click pencil to rename/edit):'}
          </span>

          {racks.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500 italic">
              {isKu ? 'هیچ ڕاکێک تۆمار نەکراوە' : 'No racks configured yet'}
            </div>
          ) : (
            racks.map((rack) => {
              const isEditing = editingId === rack.id;
              const installedCount = devices.filter(
                (d) =>
                  d.rack_name &&
                  (d.rack_name.toLowerCase() === rack.name.toLowerCase() ||
                    (rack.nameKu && d.rack_name.toLowerCase() === rack.nameKu.toLowerCase()) ||
                    d.rack_name === rack.id)
              ).length;

              if (isEditing) {
                return (
                  <div
                    key={rack.id}
                    className="p-3 bg-slate-950 border border-blue-500 rounded-2xl space-y-3 animate-fadeIn"
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                      <span className="text-xs font-bold text-blue-400">{isKu ? 'دەستکاریکردنی ڕاک' : 'Edit Rack'}</span>
                      <span className="text-[10px] font-mono text-slate-500">ID: {rack.id}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Name (English):</label>
                        <input
                          type="text"
                          value={editNameEn}
                          onChange={(e) => setEditNameEn(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">ناوی ڕاک (کوردی):</label>
                        <input
                          type="text"
                          value={editNameKu}
                          onChange={(e) => setEditNameKu(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-white focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Capacity:</label>
                        <select
                          value={editUnits}
                          onChange={(e) => setEditUnits(Number(e.target.value))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-1 text-xs text-white"
                        >
                          {RACK_UNIT_PRESETS.map((u) => (
                            <option key={u} value={u}>
                              {u}U
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Zone:</label>
                        <select
                          value={editZone}
                          onChange={(e) => setEditZone(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-1 text-xs text-white"
                        >
                          {estateZones.map((ez) => (
                            <option key={ez.id} value={ez.id}>
                              {isKu ? (ez.labelKu || ez.label) : ez.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] text-slate-400 mb-0.5">Location / Room:</label>
                        <input
                          type="text"
                          value={editLocation}
                          onChange={(e) => setEditLocation(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2 py-1 text-xs text-white"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-800/80">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                      >
                        {isKu ? 'پاشگەزبوونەوە' : 'Cancel'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveEdit(rack.id)}
                        className="px-3 py-1 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1 transition shadow cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{isKu ? 'پاشەکەوتکردن' : 'Save'}</span>
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={rack.id}
                  className="p-3 bg-slate-950/70 hover:bg-slate-850/60 border border-slate-800 rounded-2xl flex items-center justify-between gap-3 transition group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 shadow-sm">
                      <Server className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white tracking-tight">
                          {isKu ? (rack.nameKu || rack.name) : rack.name}
                        </span>
                        <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          {rack.totalUnits}U
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5 text-[10px] text-slate-400">
                        {rack.zone && (
                          <span className="inline-flex items-center gap-0.5">
                            <Building2 className="w-2.5 h-2.5 text-blue-400" />
                            <span>{formatEstateZone(rack.zone, lang)}</span>
                          </span>
                        )}
                        {rack.location && (
                          <span className="inline-flex items-center gap-0.5 text-slate-500">
                            <MapPin className="w-2.5 h-2.5" />
                            <span>{rack.location}</span>
                          </span>
                        )}
                        <span className="inline-flex items-center gap-0.5 text-cyan-400 font-mono">
                          <Cpu className="w-2.5 h-2.5" />
                          <span>{installedCount} {isKu ? 'ئامێر' : 'devices'}</span>
                        </span>
                        {rack.floor_plan_id && rack.pos_x !== null && (
                          <span className="inline-flex items-center gap-0.5 text-emerald-400 font-semibold">
                            <MapPin className="w-2.5 h-2.5" />
                            <span>{isKu ? 'پینکراو لەسەر نەخشە' : 'Pinned on Map'}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(rack)}
                      title={isKu ? 'گۆڕینی ناو و دەستکاریکردن' : 'Rename / Edit Rack'}
                      className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-blue-500/15 rounded-lg transition cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(rack)}
                      title={isKu ? 'سڕینەوەی ئەم ڕاکە' : 'Delete Rack'}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/15 rounded-lg transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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

