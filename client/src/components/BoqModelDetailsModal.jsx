import React, { useState, useEffect } from 'react';
import {
  X,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Barcode,
  QrCode,
  Printer,
  Plus,
  Minus,
  Check,
  Copy,
  MapPin,
  Server,
  Layers,
  FileText,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Save,
  RotateCcw,
  Network,
  Cpu,
  Eye,
} from 'lucide-react';
import { translations } from '../i18n/translations';

export default function BoqModelDetailsModal({
  model,
  category,
  devices = [],
  floorPlans = [],
  isOpen,
  onClose,
  onUpdateTotalQty,
  onCreateDevice,
  onUpdateStatus,
  onNavigateToMap,
  lang = 'en',
}) {
  if (!isOpen || !model) return null;

  const t = translations[lang] || translations.en;
  const isKu = lang === 'ku';

  // Devices provisioned for this specific BOQ model
  const modelDevices = devices.filter((d) => d.boq_model_id === model.id);
  const provisionedCount = modelDevices.length;

  // Active Tab inside modal: 'details' | 'provision' | 'instances' | 'barcode'
  const [activeTab, setActiveTab] = useState('provision');

  // Quantity edit state
  const [targetQty, setTargetQty] = useState(model.total_qty || 1);
  const [isUpdatingQty, setIsUpdatingQty] = useState(false);
  const [qtySavedToast, setQtySavedToast] = useState(false);

  // Fullscreen image zoom
  const [isImageLightboxOpen, setIsImageLightboxOpen] = useState(false);
  const [imageScale, setImageScale] = useState(1);

  // Barcode / Sticker view device
  const [barcodeDevice, setBarcodeDevice] = useState(null);

  // New Provision Form State (English inputs as requested)
  const defaultZone = model.is_rack_mounted ? 'rack' : model.allowed_zones?.[0] || 'indoor';
  const defaultFloor = floorPlans.find((fp) => fp.zone_type === defaultZone)?.id || floorPlans[0]?.id || '';

  const cleanPrefix = `${model.brand.substring(0, 3).toUpperCase()}-${model.model.replace(/[^A-Za-z0-9]/g, '').substring(0, 4).toUpperCase()}`;
  const nextNum = String(provisionedCount + 1).padStart(2, '0');

  const [form, setForm] = useState({
    custom_label_id: `${cleanPrefix}-${nextNum}`,
    serial_number: `SN-${Date.now().toString().slice(-6)}`,
    barcode: `BC-${Date.now().toString().slice(-8)}`,
    mac_address: `00:${Math.floor(10 + Math.random() * 89)}:${Math.floor(10 + Math.random() * 89)}:${Math.floor(10 + Math.random() * 89)}:${Math.floor(10 + Math.random() * 89)}:${Math.floor(10 + Math.random() * 89)}`,
    ip_address: '',
    subnet_mask: '255.255.255.0',
    gateway: '192.168.10.1',
    vlan_id: 10,
    switch_name: model.is_rack_mounted ? 'SW-CORE-RACK-48P' : 'SW-EDGE-GF-24P',
    switch_port: `Port ${Math.floor(1 + Math.random() * 24)}`,
    rack_name: model.is_rack_mounted ? 'Main 42U Rack A' : '',
    rack_unit: model.is_rack_mounted ? `U${Math.floor(10 + Math.random() * 25)}` : '',
    placement_zone: defaultZone,
    floor_plan_id: defaultFloor,
    installation_status: 'Pending',
    notes: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset targetQty when model changes
  useEffect(() => {
    setTargetQty(model.total_qty || 1);
  }, [model]);

  // Handle Qty Update
  const handleSaveQty = async () => {
    if (targetQty < provisionedCount) {
      alert(`Target BOQ quantity cannot be less than already provisioned count (${provisionedCount})`);
      return;
    }
    try {
      setIsUpdatingQty(true);
      if (onUpdateTotalQty) {
        await onUpdateTotalQty(model.id, { total_qty: Number(targetQty) });
        setQtySavedToast(true);
        setTimeout(() => setQtySavedToast(false), 2500);
      }
    } catch (err) {
      alert(err.message || 'Failed to update quantity');
    } finally {
      setIsUpdatingQty(false);
    }
  };

  // Generate new barcode helper
  const handleRegenBarcode = () => {
    const randomHex = Math.floor(10000000 + Math.random() * 90000000);
    setForm((prev) => ({
      ...prev,
      barcode: `BC-${randomHex}`,
      serial_number: `SN-${Date.now().toString().slice(-6)}`,
    }));
  };

  // Submit new device instance
  const handleCreateInstance = async (e) => {
    e.preventDefault();
    try {
      setIsSubmitting(true);
      const payload = {
        boq_model_id: model.id,
        custom_label_id: form.custom_label_id.trim().toUpperCase(),
        serial_number: form.serial_number.trim() || form.barcode.trim(),
        mac_address: form.mac_address.trim() || null,
        ip_address: form.ip_address.trim() || null,
        subnet_mask: form.subnet_mask.trim() || '255.255.255.0',
        gateway: form.gateway.trim() || '192.168.10.1',
        vlan_id: Number(form.vlan_id) || 10,
        switch_name: form.switch_name.trim() || null,
        switch_port: form.switch_port.trim() || null,
        rack_name: form.placement_zone === 'rack' ? (form.rack_name.trim() || 'Main 42U Rack A') : null,
        rack_unit: form.placement_zone === 'rack' ? (form.rack_unit.trim() || 'U1') : null,
        placement_zone: form.placement_zone,
        floor_plan_id: form.floor_plan_id || null,
        installation_status: form.installation_status || 'Pending',
        notes: form.notes.trim() ? `[Barcode: ${form.barcode}] ${form.notes.trim()}` : `[Barcode: ${form.barcode}]`,
      };

      if (onCreateDevice) {
        await onCreateDevice(payload);
      }

      // Auto-increment label for next item
      const nextSequence = String(modelDevices.length + 2).padStart(2, '0');
      setForm((prev) => ({
        ...prev,
        custom_label_id: `${cleanPrefix}-${nextSequence}`,
        serial_number: `SN-${Date.now().toString().slice(-6)}`,
        barcode: `BC-${Date.now().toString().slice(-8)}`,
        ip_address: '',
      }));

      // Switch to instances tab to show the newly added device
      setActiveTab('instances');
    } catch (err) {
      alert(err.message || 'Failed to provision device instance');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
        <div
          className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
            <div className="flex items-center gap-3">
              <span
                className="w-3.5 h-3.5 rounded-full ring-4 shadow-sm"
                style={{
                  backgroundColor: category?.color_code || '#3b82f6',
                  ringColor: `${category?.color_code || '#3b82f6'}33`,
                }}
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">{model.brand}</span>
                  <h2 className="text-lg sm:text-xl font-bold font-mono text-white tracking-wide">{model.model}</h2>
                </div>
                <p className="text-xs text-slate-400">
                  {category ? (isKu ? category.name_ku : category.name) : 'ELV Category'}
                  {model.is_rack_mounted && ` • ${model.rack_unit_size || 1}U Server Rack`}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Navigation Tabs */}
          <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 gap-2 text-xs font-semibold overflow-x-auto">
            <button
              onClick={() => setActiveTab('provision')}
              className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition ${
                activeTab === 'provision'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Barcode className="w-4 h-4" />
              <span>{isKu ? 'دابینکردن بە بارکۆد و لۆکەیشن' : 'Provision with Barcode & Location'}</span>
            </button>

            <button
              onClick={() => setActiveTab('instances')}
              className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition ${
                activeTab === 'instances'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>
                {isKu ? 'ئامێرە تۆمارکراوەکان' : 'Provisioned Instances'} ({modelDevices.length}/{targetQty})
              </span>
            </button>

            <button
              onClick={() => setActiveTab('details')}
              className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition ${
                activeTab === 'details'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>{isKu ? 'کەتەلۆگ و زانیاری کەرەستە' : 'Catalog & Quantity Specs'}</span>
            </button>
          </div>

          {/* Modal Content Scroll Area */}
          <div className="overflow-y-auto p-6 space-y-6 flex-1">
            {/* Top Quantity Management Card (Visible across all tabs) */}
            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400 block">
                  {isKu ? 'کۆی ژمارەی داواکراو لە خشتەی کەرەستەکان (BOQ Quantity):' : 'Total BOQ Target Quantity:'}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold font-mono text-white">{targetQty}</span>
                  <span className="text-xs text-slate-400">
                    ({provisionedCount} {isKu ? 'تۆمارکراوە' : 'Provisioned'} • {Math.max(0, targetQty - provisionedCount)} {isKu ? 'ماوە' : 'Remaining'})
                  </span>
                </div>
              </div>

              {/* Quantity Incrementor Controls */}
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-900 border border-slate-700 rounded-xl overflow-hidden p-0.5">
                  <button
                    type="button"
                    onClick={() => setTargetQty((q) => Math.max(provisionedCount, Number(q) - 1))}
                    disabled={targetQty <= provisionedCount}
                    className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 transition rounded-lg"
                    title="Decrease Quantity"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min={provisionedCount}
                    value={targetQty}
                    onChange={(e) => setTargetQty(Number(e.target.value))}
                    className="w-16 bg-transparent text-center font-mono font-bold text-white text-sm focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setTargetQty((q) => Number(q) + 1)}
                    className="p-2 text-slate-300 hover:text-white hover:bg-slate-800 transition rounded-lg"
                    title="Increase Quantity"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleSaveQty}
                  disabled={isUpdatingQty || targetQty === model.total_qty}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-slate-950 font-bold transition shadow"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isUpdatingQty ? 'Saving...' : isKu ? 'خەزنکردنی ژمارە' : 'Update Qty'}</span>
                </button>

                {qtySavedToast && (
                  <span className="text-xs text-emerald-400 font-semibold animate-fadeIn flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    {isKu ? 'نوێکرایەوە!' : 'Updated!'}
                  </span>
                )}
              </div>
            </div>

            {/* TAB 1: PROVISION NEW INSTANCE WITH BARCODE & LOCATION */}
            {activeTab === 'provision' && (
              <form onSubmit={handleCreateInstance} className="space-y-5 animate-fadeIn">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Barcode className="w-4 h-4 text-blue-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      {isKu ? 'تۆمارکردنی ئامێر بە بارکۆد، لەیبڵ و شوێنی فیزیکی' : 'Provision Hardware Instance (Barcode, Label & Location)'}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleRegenBarcode}
                    className="flex items-center gap-1 text-[11px] text-blue-400 hover:text-blue-300 transition"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{isKu ? 'دروستکردنی بارکۆدی نوێ' : 'Regen Barcode & Serial'}</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Custom Label ID */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Custom Label ID <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={form.custom_label_id}
                      onChange={(e) => setForm({ ...form, custom_label_id: e.target.value })}
                      placeholder="e.g. AP-GF-01 or TV-MUX-01"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Barcode & Serial */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Barcode / Serial Sticker <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={form.barcode}
                        onChange={(e) => setForm({ ...form, barcode: e.target.value, serial_number: e.target.value })}
                        placeholder="Scan or input barcode..."
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-amber-300 pr-10 focus:outline-none focus:border-blue-500"
                      />
                      <Barcode className="w-4 h-4 text-slate-500 absolute right-3 top-2.5" />
                    </div>
                  </div>

                  {/* MAC Address */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">MAC Address</label>
                    <input
                      type="text"
                      value={form.mac_address}
                      onChange={(e) => setForm({ ...form, mac_address: e.target.value })}
                      placeholder="00:11:22:33:44:55"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* IP Address */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">IP Address</label>
                    <input
                      type="text"
                      value={form.ip_address}
                      onChange={(e) => setForm({ ...form, ip_address: e.target.value })}
                      placeholder="e.g. 192.168.10.55"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* VLAN ID */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">VLAN ID</label>
                    <select
                      value={form.vlan_id}
                      onChange={(e) => setForm({ ...form, vlan_id: Number(e.target.value) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                    >
                      <option value={10}>VLAN 10 - Core & Management</option>
                      <option value={20}>VLAN 20 - IP CCTV & Surveillance</option>
                      <option value={30}>VLAN 30 - Wi-Fi Infrastructure</option>
                      <option value={40}>VLAN 40 - Automation & AV Multiroom</option>
                      <option value={50}>VLAN 50 - Guest Network</option>
                    </select>
                  </div>

                  {/* Switch & Port */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Switch Name</label>
                      <input
                        type="text"
                        value={form.switch_name}
                        onChange={(e) => setForm({ ...form, switch_name: e.target.value })}
                        placeholder="SW-CORE-RACK-48P"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Switch Port</label>
                      <input
                        type="text"
                        value={form.switch_port}
                        onChange={(e) => setForm({ ...form, switch_port: e.target.value })}
                        placeholder="Port 12"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-amber-300 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Location 1: Assigned Floor Plan */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Physical Floor Plan <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={form.floor_plan_id}
                      onChange={(e) => setForm({ ...form, floor_plan_id: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      {floorPlans.map((fp) => (
                        <option key={fp.id} value={fp.id}>
                          {isKu ? fp.name_ku : fp.name} ({fp.zone_type})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Location 2: Installation Zone */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Installation Zone</label>
                    <select
                      value={form.placement_zone}
                      onChange={(e) => setForm({ ...form, placement_zone: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="indoor">Indoor (ناو ڤێلا)</option>
                      <option value="outdoor">Outdoor (دەرەوە / باخچە)</option>
                      <option value="rack">Server Rack (ژووری سێرڤەر / ڕاک)</option>
                      <option value="safe_room">Safe Room (ژووری پارێزراو)</option>
                    </select>
                  </div>

                  {/* Rack Location Details if Rack Zone */}
                  {form.placement_zone === 'rack' && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Server Rack Name</label>
                        <input
                          type="text"
                          value={form.rack_name}
                          onChange={(e) => setForm({ ...form, rack_name: e.target.value })}
                          placeholder="Main 42U Rack A"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1">Rack Unit Position</label>
                        <input
                          type="text"
                          value={form.rack_unit}
                          onChange={(e) => setForm({ ...form, rack_unit: e.target.value })}
                          placeholder="e.g. U14 or U20-U22"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono text-indigo-300 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </>
                  )}

                  {/* Installation Status */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Installation Status</label>
                    <select
                      value={form.installation_status}
                      onChange={(e) => setForm({ ...form, installation_status: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="Pending">Pending (Not Configured / نۆت کۆنفیگەر)</option>
                      <option value="Installed">Installed (بەستراو لە شوێنی فیزیکی)</option>
                      <option value="Configured">Configured (کۆنفیگەرکراو بە تەواوی)</option>
                      <option value="Verified">Verified (پشتڕاستکراو لە ڕێی تێست)</option>
                    </select>
                  </div>

                  {/* Specific Location Notes */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Physical Location Remarks</label>
                    <input
                      type="text"
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="e.g. Living room ceiling mount near terrace glass door"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end pt-3 border-t border-slate-800">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 transition active:scale-95 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    <span>
                      {isSubmitting
                        ? 'Provisioning...'
                        : isKu
                        ? 'دروستکردن و دابینکردنی ئەم دیڤایسە'
                        : 'Provision Device Instance'}
                    </span>
                  </button>
                </div>
              </form>
            )}

            {/* TAB 2: EXISTING PROVISIONED INSTANCES */}
            {activeTab === 'instances' && (
              <div className="space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-blue-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      {isKu ? 'ئامێرە چالاککراوەکانی ئەم مۆدێلە' : 'Generated Instances for this BOQ Item'}
                    </h3>
                  </div>
                  <button
                    onClick={() => setActiveTab('provision')}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600/20 text-blue-300 hover:bg-blue-600/40 border border-blue-500/30 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isKu ? '+ ئامێری نوێ' : '+ Add New Instance'}</span>
                  </button>
                </div>

                {modelDevices.length === 0 ? (
                  <div className="text-center py-10 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3">
                    <Barcode className="w-10 h-10 text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-400">
                      {isKu
                        ? 'هیچ ئامێرێک بۆ ئەم مۆدێلە دابین نەکراوە، کلیک لەسەر تابی سەرەوە بکە بۆ دروستکردن.'
                        : 'No instances provisioned yet for this model. Switch to the Provision tab to create one.'}
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-950/80">
                    <table className="w-full text-left text-xs font-mono text-slate-300">
                      <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-800">
                        <tr>
                          <th className="px-4 py-3">Label ID</th>
                          <th className="px-4 py-3">Barcode / Serial</th>
                          <th className="px-4 py-3">IP Address</th>
                          <th className="px-4 py-3">Location & Switch</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3 text-right">Label Sticker</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {modelDevices.map((dev) => {
                          const fp = floorPlans.find((p) => p.id === dev.floor_plan_id);
                          return (
                            <tr key={dev.id} className="hover:bg-slate-900/60 transition">
                              <td className="px-4 py-3 font-bold text-white whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                                  <span>{dev.custom_label_id}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-amber-300 whitespace-nowrap">
                                {dev.serial_number || 'No Serial'}
                              </td>
                              <td className="px-4 py-3 text-cyan-300 whitespace-nowrap">
                                {dev.ip_address || <span className="text-slate-600 italic">Unassigned</span>}
                              </td>
                              <td className="px-4 py-3 text-slate-300 whitespace-nowrap font-sans text-xs">
                                <div>{fp ? (isKu ? fp.name_ku : fp.name) : 'No Map'}</div>
                                <div className="text-[10px] text-slate-500 font-mono">
                                  {dev.rack_unit ? `Rack: ${dev.rack_unit}` : dev.switch_port ? `Port: ${dev.switch_port}` : 'Field'}
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <button
                                  onClick={() => {
                                    const next =
                                      dev.installation_status === 'Pending'
                                        ? 'Installed'
                                        : dev.installation_status === 'Installed'
                                        ? 'Configured'
                                        : dev.installation_status === 'Configured'
                                        ? 'Verified'
                                        : 'Pending';
                                    if (onUpdateStatus) onUpdateStatus(dev.id, next);
                                  }}
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    dev.installation_status === 'Verified'
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                      : dev.installation_status === 'Configured'
                                      ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                                      : dev.installation_status === 'Installed'
                                      ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                      : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  }`}
                                >
                                  {dev.installation_status}
                                </button>
                              </td>
                              <td className="px-4 py-3 text-right whitespace-nowrap">
                                <button
                                  onClick={() => setBarcodeDevice(dev)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                                >
                                  <Barcode className="w-3.5 h-3.5 text-amber-400" />
                                  <span>{isKu ? 'لەیلبڵ' : 'Sticker'}</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: HARDWARE SPECS & CATALOG */}
            {activeTab === 'details' && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start animate-fadeIn">
                {/* Product Photo Showcase */}
                <div className="md:col-span-5 space-y-3">
                  <div className="relative group rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-950 aspect-[4/3] shadow-inner flex items-center justify-center">
                    {model.product_image_url ? (
                      <img
                        src={model.product_image_url}
                        alt={`${model.brand} ${model.model}`}
                        className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="text-center p-6 text-slate-500">
                        <Layers className="w-12 h-12 mx-auto mb-2 opacity-40" />
                        <p className="text-xs">No Hardware Photo Available</p>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />

                    {model.product_image_url && (
                      <button
                        onClick={() => setIsImageLightboxOpen(true)}
                        className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900/90 text-white backdrop-blur-md border border-slate-700 hover:bg-blue-600 transition shadow-lg"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>{isKu ? 'گەورەکردنی وێنە' : 'Zoom Image'}</span>
                      </button>
                    )}
                  </div>

                  {model.manual_pdf_url && (
                    <a
                      href={model.manual_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 p-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                    >
                      <FileText className="w-4 h-4 text-amber-400" />
                      <span>{isKu ? 'داگرتنی مانیواڵی فەرمی PDF' : 'Open PDF Catalog Manual'}</span>
                    </a>
                  )}
                </div>

                {/* Specs Details */}
                <div className="md:col-span-7 space-y-4">
                  <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Product Description:
                    </span>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {model.description || 'Enterprise ELV hardware component for Sitak Villa infrastructure.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                    <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">Unit Cost (USD):</span>
                      <span className="text-base font-bold text-emerald-400">${model.unit_cost || '0.00'}</span>
                    </div>
                    <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                      <span className="text-[10px] text-slate-400 block font-sans">Rack Unit Profile:</span>
                      <span className="text-base font-bold text-amber-300">
                        {model.is_rack_mounted ? `${model.rack_unit_size || 1}U Server Rack` : 'Field Deployed'}
                      </span>
                    </div>
                  </div>

                  {/* Allowed Zones */}
                  <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                      Allowed Physical Zones:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {model.allowed_zones?.map((z) => (
                        <span
                          key={z}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-900 text-slate-200 border border-slate-700"
                        >
                          {z === 'indoor'
                            ? 'Indoor (ناو ڤێلا)'
                            : z === 'outdoor'
                            ? 'Outdoor (دەرەوە)'
                            : z === 'rack'
                            ? 'Server Rack (ڕاک)'
                            : 'Safe Room'}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Custom Specs */}
                  {model.custom_specs && Object.keys(model.custom_specs).length > 0 && (
                    <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                        Custom Engineering Parameters:
                      </span>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {Object.entries(model.custom_specs).map(([k, v]) => (
                          <div key={k} className="p-2 bg-slate-900 rounded-lg">
                            <span className="text-[10px] text-slate-500 capitalize block">{k.replace(/_/g, ' ')}:</span>
                            <span className="font-mono text-slate-200 font-bold">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-3.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono text-[11px]">Model ID: {model.id}</span>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition"
            >
              {isKu ? 'داخستن' : 'Close Window'}
            </button>
          </div>
        </div>
      </div>

      {/* FULLSCREEN IMAGE LIGHTBOX */}
      {isImageLightboxOpen && model?.product_image_url && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl animate-fadeIn p-4"
          onClick={() => setIsImageLightboxOpen(false)}
        >
          <div
            className="absolute top-4 left-4 right-4 flex items-center justify-between text-white z-50 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-slate-200 font-mono">
                {model.brand} {model.model}
              </span>
            </div>

            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700 px-3 py-1.5 rounded-2xl shadow-2xl">
              <button
                onClick={() => setImageScale((s) => Math.max(0.6, s - 0.25))}
                className="p-1 hover:text-blue-400 transition"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono px-2">{Math.round(imageScale * 100)}%</span>
              <button
                onClick={() => setImageScale((s) => Math.min(3.0, s + 0.25))}
                className="p-1 hover:text-blue-400 transition"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button onClick={() => setImageScale(1)} className="p-1 hover:text-amber-400 transition ml-1">
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsImageLightboxOpen(false)}
                className="p-1 hover:text-red-400 transition ml-2 border-l border-slate-700 pl-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div
            className="w-full h-full flex items-center justify-center p-6 overflow-hidden cursor-grab active:cursor-grabbing"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={model.product_image_url}
              alt={`${model.brand} ${model.model}`}
              style={{
                transform: `scale(${imageScale})`,
                transition: 'transform 0.15s ease-out',
                maxWidth: '90vw',
                maxHeight: '85vh',
              }}
              className="object-contain rounded-xl shadow-2xl select-none"
            />
          </div>
        </div>
      )}

      {/* PRINTABLE BARCODE & HARDWARE LABEL STICKER MODAL */}
      {barcodeDevice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
          onClick={() => setBarcodeDevice(null)}
        >
          <div
            className="bg-white text-slate-900 rounded-2xl p-6 max-w-sm w-full shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">
                Iraq Sitak Villa Project • ELV Label
              </span>
              <button onClick={() => setBarcodeDevice(null)} className="text-slate-400 hover:text-slate-900">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable Sticker Preview */}
            <div className="border-2 border-dashed border-slate-400 rounded-xl p-4 bg-slate-50 space-y-2 text-center">
              <div className="text-lg font-black font-mono tracking-wider">{barcodeDevice.custom_label_id}</div>
              <div className="text-xs font-semibold text-slate-700">
                {model.brand} {model.model}
              </div>

              {/* Simulated Barcode */}
              <div className="py-2 flex flex-col items-center">
                <div className="flex items-center justify-center tracking-tighter text-2xl font-mono select-none">
                  || | ||| | |||| | || ||| || ||| ||
                </div>
                <div className="text-[10px] font-mono text-slate-600">{barcodeDevice.serial_number || 'SN-UNKNOWN'}</div>
              </div>

              <div className="grid grid-cols-2 text-[10px] font-mono text-left pt-2 border-t border-slate-300">
                <div>
                  <span className="text-slate-500 block">IP / VLAN:</span>
                  <span className="font-bold">{barcodeDevice.ip_address || 'DHCP'} / V{barcodeDevice.vlan_id || 10}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Location:</span>
                  <span className="font-bold">{barcodeDevice.rack_unit || 'Field Unit'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <span className="text-[10px] text-slate-500 font-mono">Format: 50x30mm Thermal Label</span>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition shadow"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Sticker</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

