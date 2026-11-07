import React, { useState } from 'react';
import {
  Cpu,
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  Layers,
  Network,
  Server,
  Upload,
  X,
  MapPin,
  Bot,
  Maximize2,
  Eye,
  Info,
  Settings2,
  Building2,
} from 'lucide-react';
import { translations } from '../i18n/translations';
import DeviceDetailsModal from './DeviceDetailsModal';
import QuickAddCategoryModal from './QuickAddCategoryModal';
import ZoneEditorModal from './ZoneEditorModal';
import EstateZoneEditorModal from './EstateZoneEditorModal';
import RackManagerModal from './RackManagerModal';
import { getIctDeviceIcon } from '../utils/ictIcons';
import { useZones } from '../utils/zoneManager';
import { useEstateZones } from '../utils/estateZoneManager';
import { useRacks } from '../utils/rackManager';
import { DEFAULT_ICT_IMAGE, getEffectiveProductImage } from '../utils/defaultIctImage';

export default function DeviceProvisioning({
  devices = [],
  boqModels = [],
  floorPlans = [],
  categories = [],
  onCreateDevice,
  onUpdateDevice,
  onUpdateStatus,
  onDeleteDevice,
  onOpenTroubleshoot,
  onNavigateToMap,
  onCreateCategory,
  lang = 'en',
}) {
  const t = translations[lang] || translations.en;
  const isKu = lang === 'ku';
  const { zones, formatZone } = useZones();
  const { estateZones, formatEstateZone } = useEstateZones();
  const { racks } = useRacks();
  const [isRackModalOpen, setIsRackModalOpen] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [estateZoneFilter, setEstateZoneFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [inspectingDevice, setInspectingDevice] = useState(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [isEstateZoneModalOpen, setIsEstateZoneModalOpen] = useState(false);

  // Form State (All fields start empty, placeholders will show guidance)
  const [deviceForm, setDeviceForm] = useState({
    boq_model_id: boqModels[0]?.id || '',
    custom_label_id: '',
    serial_number: '',
    mac_address: '',
    ip_address: '',
    subnet_mask: '',
    gateway: '',
    vlan_id: '',
    switch_name: '',
    switch_port: '',
    rack_name: '',
    rack_unit: '',
    zone: '',
    placement_zone: 'indoor',
    floor_plan_id: '',
    installation_status: 'Pending',
    config_backup_url: '',
    notes: '',
  });

  // Filtered devices
  const filteredDevices = devices.filter((d) => {
    const model = boqModels.find((m) => m.id === d.boq_model_id);
    const matchesStatus = statusFilter === 'all' || d.installation_status === statusFilter;
    const matchesZone = zoneFilter === 'all' || d.placement_zone === zoneFilter;
    const matchesEstateZone = estateZoneFilter === 'all' || d.zone === estateZoneFilter;
    const matchesCategory = categoryFilter === 'all' || (model && model.category_id === categoryFilter);

    const s = search.toLowerCase();
    const matchesSearch =
      d.custom_label_id.toLowerCase().includes(s) ||
      (d.ip_address && d.ip_address.includes(s)) ||
      (d.mac_address && d.mac_address.toLowerCase().includes(s)) ||
      (d.serial_number && d.serial_number.toLowerCase().includes(s)) ||
      (d.switch_name && d.switch_name.toLowerCase().includes(s)) ||
      (model && (model.brand + ' ' + model.model).toLowerCase().includes(s));

    return matchesStatus && matchesZone && matchesEstateZone && matchesCategory && matchesSearch;
  });

  const handleOpenNew = () => {
    setDeviceForm({
      boq_model_id: '',
      custom_label_id: '',
      serial_number: '',
      mac_address: '',
      ip_address: '',
      subnet_mask: '',
      gateway: '',
      vlan_id: '',
      switch_name: '',
      switch_port: '',
      rack_name: '',
      rack_unit: '',
      zone: '',
      placement_zone: 'indoor',
      floor_plan_id: '',
      installation_status: 'Pending',
      config_backup_url: '',
      notes: '',
    });
    setEditingDevice(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (dev) => {
    setDeviceForm({
      boq_model_id: dev.boq_model_id,
      custom_label_id: dev.custom_label_id || '',
      serial_number: dev.serial_number || '',
      mac_address: dev.mac_address || '',
      ip_address: dev.ip_address || '',
      subnet_mask: dev.subnet_mask || '',
      gateway: dev.gateway || '',
      vlan_id: dev.vlan_id || '',
      switch_name: dev.switch_name || '',
      switch_port: dev.switch_port || '',
      rack_name: dev.rack_name || '',
      rack_unit: dev.rack_unit || '',
      zone: dev.zone || '',
      placement_zone: dev.placement_zone || 'indoor',
      floor_plan_id: dev.floor_plan_id || '',
      installation_status: dev.installation_status || 'Pending',
      config_backup_url: dev.config_backup_url || '',
      notes: dev.notes || '',
    });
    setEditingDevice(dev);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    const selectedModel = boqModels.find((m) => m.id === deviceForm.boq_model_id);
    const cleanPrefix = selectedModel
      ? `${selectedModel.brand.substring(0, 3).toUpperCase()}-${selectedModel.model.replace(/[^A-Za-z0-9]/g, '').substring(0, 4).toUpperCase()}`
      : 'DEV';

    const payload = {
      ...deviceForm,
      custom_label_id: deviceForm.custom_label_id.trim()
        ? deviceForm.custom_label_id.trim().toUpperCase()
        : `${cleanPrefix}-${Math.floor(100 + Math.random() * 900)}`,
      serial_number: deviceForm.serial_number.trim() || null,
      mac_address: deviceForm.mac_address.trim() || null,
      ip_address: deviceForm.ip_address.trim() || null,
      subnet_mask: deviceForm.subnet_mask.trim() || '255.255.255.0',
      gateway: deviceForm.gateway.trim() || '192.168.10.1',
      vlan_id: deviceForm.vlan_id ? Number(deviceForm.vlan_id) : 10,
      switch_name: deviceForm.switch_name.trim() || null,
      switch_port: deviceForm.switch_port.trim() || null,
      rack_name: deviceForm.rack_name ? deviceForm.rack_name.trim() : null,
      rack_unit: deviceForm.rack_unit ? deviceForm.rack_unit.trim() : null,
      floor_plan_id: deviceForm.floor_plan_id || null,
    };

    if (editingDevice) {
      await onUpdateDevice(editingDevice.id, payload);
    } else {
      await onCreateDevice(payload);
    }
    setIsModalOpen(false);
  };

  const nextStatusMap = {
    Pending: 'Installed',
    Installed: 'Configured',
    Configured: 'Verified',
    Verified: 'Pending',
  };

  const cycleStatus = (dev) => {
    const next = nextStatusMap[dev.installation_status] || 'Pending';
    onUpdateStatus(dev.id, next);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{t.devTitle}</h2>
          <p className="text-xs sm:text-sm text-slate-400">{t.devSubtitle}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsRackModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-blue-400 hover:text-white border border-slate-800 hover:border-slate-700 shadow transition active:scale-95 shrink-0 cursor-pointer"
          >
            <Server className="w-4 h-4 text-blue-400" />
            <span>{isKu ? 'بەڕێوەبردنی ڕاکەکان' : 'Manage Racks'}</span>
          </button>
          <button
            onClick={handleOpenNew}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 transition active:scale-95 shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {t.btnNewSingleDevice}
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-slate-900/70 border border-slate-800 p-3.5 rounded-2xl">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchDevices}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-blue-500"
        >
          <option value="all">{t.allStatuses}</option>
          <option value="Pending">{t.statusPending}</option>
          <option value="Installed">{t.statusInstalled}</option>
          <option value="Configured">{t.statusConfigured}</option>
          <option value="Verified">{t.statusVerified}</option>
        </select>

        <select
          value={zoneFilter}
          onChange={(e) => setZoneFilter(e.target.value)}
          className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-blue-500"
        >
          <option value="all">{isKu ? 'گشت جۆرەکانی شوێن (Zone Type)' : 'All Zone Types'}</option>
          {zones.map((z) => (
            <option key={z.id} value={z.id}>
              {isKu ? (z.labelKu || z.label) : (z.label || z.labelKu)}
            </option>
          ))}
        </select>

        <select
          value={estateZoneFilter}
          onChange={(e) => setEstateZoneFilter(e.target.value)}
          className="bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-blue-500"
        >
          <option value="all">{isKu ? 'گشت زۆنەکان (All Zones)' : 'All Zones'}</option>
          {estateZones.map((ez) => (
            <option key={ez.id} value={ez.id}>
              {isKu ? (ez.labelKu || ez.label) : (ez.label || ez.labelKu)}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-blue-500"
          >
            <option value="all">{t.allCategories}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {isKu ? c.name_ku : c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setIsCategoryModalOpen(true)}
            title={isKu ? 'زیادکردنی بەشی نوێ' : 'Add Category'}
            className="p-2 rounded-xl bg-slate-800 hover:bg-blue-600/30 text-blue-400 hover:text-white border border-slate-700 transition shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Devices Data Table */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-800">
              <tr>
                <th className="px-4 py-3.5">{t.customLabel}</th>
                <th className="px-4 py-3.5">{t.model}</th>
                <th className="px-4 py-3.5">{t.ipAddress}</th>
                <th className="px-4 py-3.5">{t.macAddress}</th>
                <th className="px-4 py-3.5">{t.vlan}</th>
                <th className="px-4 py-3.5">{t.switchPort}</th>
                <th className="px-4 py-3.5">{t.rackLocation}</th>
                <th className="px-4 py-3.5">{t.status}</th>
                <th className="px-4 py-3.5 text-right">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredDevices.map((dev) => {
                const model = boqModels.find((m) => m.id === dev.boq_model_id);
                const category = model ? categories.find((c) => c.id === model.category_id) : null;
                const DevIcon = getIctDeviceIcon(dev, model, category);

                return (
                  <tr key={dev.id} className="hover:bg-slate-850/50 transition">
                    <td
                      onClick={() => setInspectingDevice(dev)}
                      title={isKu ? 'کلیک بکە بۆ پیشاندانی هەموو زانیاری، وێنەی گەورە و کەتەلۆگ' : 'Click to inspect full profile, zoomed image & catalog'}
                      className="px-4 py-3 font-mono font-bold text-white whitespace-nowrap cursor-pointer hover:text-blue-400 transition group/label"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                          <DevIcon className="w-3.5 h-3.5" />
                        </div>
                        <span className="underline-offset-4 group-hover/label:underline">{dev.custom_label_id}</span>
                        <Eye className="w-3.5 h-3.5 text-blue-400 opacity-0 group-hover/label:opacity-100 transition ml-1" />
                      </div>
                    </td>
                    <td
                      onClick={() => setInspectingDevice(dev)}
                      title={isKu ? 'کلیک بکە بۆ پیشاندانی هەموو زانیاری، وێنەی گەورە و کەتەلۆگ' : 'Click to inspect full profile, zoomed image & catalog'}
                      className="px-4 py-3 whitespace-nowrap cursor-pointer hover:bg-slate-800/40 transition group/model rounded-lg"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="relative flex-shrink-0 rounded-lg overflow-hidden border border-slate-700 bg-slate-950 group-hover/model:ring-2 group-hover/model:ring-blue-500 transition shadow-sm">
                          <img
                            src={getEffectiveProductImage(model?.product_image_url)}
                            alt=""
                            onError={(e) => { e.currentTarget.src = DEFAULT_ICT_IMAGE; }}
                            className="w-9 h-9 object-cover group-hover/model:scale-110 transition duration-300"
                          />
                          <div className="absolute inset-0 bg-blue-600/30 opacity-0 group-hover/model:opacity-100 flex items-center justify-center transition">
                            <Maximize2 className="w-3.5 h-3.5 text-white drop-shadow" />
                          </div>
                        </div>
                        <div>
                          <div className="font-semibold text-slate-200 group-hover/model:text-blue-300 transition">
                            {model ? `${model.brand} ${model.model}` : 'Generic Device'}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">{dev.serial_number || 'No Serial'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-cyan-400 whitespace-nowrap">
                      {dev.ip_address || <span className="text-slate-600 italic">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-400 text-xs whitespace-nowrap">
                      {dev.mac_address || <span className="text-slate-600 italic">—</span>}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-800 text-blue-400 border border-slate-700">
                        VLAN {dev.vlan_id || 10}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300 whitespace-nowrap">
                      {dev.switch_name ? (
                        <span className="font-medium">
                          {dev.switch_name} <span className="text-amber-400 font-mono">[{dev.switch_port}]</span>
                        </span>
                      ) : (
                        <span className="text-slate-600 italic">Unpatched</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">
                      {dev.rack_name ? (
                        <div className="flex flex-col">
                          <span className="text-white text-xs font-medium">{dev.rack_name}</span>
                          {dev.rack_unit && <span className="text-amber-300 font-mono text-[11px]">{dev.rack_unit}</span>}
                        </div>
                      ) : dev.rack_unit ? (
                        <span className="text-amber-300 font-mono">{dev.rack_unit}</span>
                      ) : (
                        <span className="text-slate-500 text-xs">Field Unit</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => cycleStatus(dev)}
                        title="Click to cycle status"
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition hover:scale-105 active:scale-95 ${
                          dev.installation_status === 'Verified'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : dev.installation_status === 'Configured'
                            ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                            : dev.installation_status === 'Installed'
                            ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        <span>{dev.installation_status}</span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {onNavigateToMap && (
                          <button
                            type="button"
                            onClick={() => onNavigateToMap(dev.floor_plan_id || floorPlans[0]?.id, dev.id)}
                            title={isKu ? 'پیشاندان و جێگیرکردن لەسەر نەخشە' : 'View / Pin on Map'}
                            className="p-1.5 text-blue-400 hover:text-white hover:bg-blue-600 rounded-lg transition"
                          >
                            <MapPin className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setInspectingDevice(dev)}
                          title={isKu ? 'پیشاندانی هەموو زانیاری و وێنەی گەورە' : 'Inspect Profile, Map & Photo'}
                          className="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-950/60 rounded-lg transition"
                        >
                          <Maximize2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onOpenTroubleshoot(dev)}
                          title="Ask AI Troubleshooter about this device"
                          className="p-1.5 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/60 rounded-lg transition"
                        >
                          <Bot className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenEdit(dev)}
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteDevice(dev.id)}
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Device Form Modal (All input fields in English) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {editingDevice ? t.editDevice : t.deviceModalTitle}
                </h3>
                <p className="text-xs text-slate-400">{t.deviceModalSubtitle}</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t.selectBoqModel}</label>
                  <select
                    value={deviceForm.boq_model_id}
                    required
                    onChange={(e) => {
                      const sel = boqModels.find((m) => m.id === e.target.value);
                      setDeviceForm({
                        ...deviceForm,
                        boq_model_id: e.target.value,
                        placement_zone: sel?.is_rack_mounted ? 'rack' : deviceForm.placement_zone,
                        rack_name: sel?.is_rack_mounted ? (deviceForm.rack_name || racks[0]?.name || 'Main 42U Server Rack A') : deviceForm.rack_name,
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">{isKu ? '— مۆدێلی ئامێر هەڵبژێرە —' : '— Select BOQ Model —'}</option>
                    {boqModels.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.brand} {m.model} {m.is_rack_mounted ? '(Rack Unit)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t.customLabel}</label>
                  <input
                    type="text"
                    value={deviceForm.custom_label_id}
                    onChange={(e) => setDeviceForm({ ...deviceForm, custom_label_id: e.target.value })}
                    placeholder="e.g. AP-GF-01, CCTV-EXT-02"
                    className="w-full font-mono bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t.serialNumber}</label>
                  <input
                    type="text"
                    value={deviceForm.serial_number}
                    onChange={(e) => setDeviceForm({ ...deviceForm, serial_number: e.target.value })}
                    placeholder="e.g. UI-U7P-992182"
                    className="w-full font-mono bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t.macAddress}</label>
                  <input
                    type="text"
                    value={deviceForm.mac_address}
                    onChange={(e) => setDeviceForm({ ...deviceForm, mac_address: e.target.value })}
                    placeholder="e.g. 74:83:C2:10:4E:55"
                    className="w-full font-mono bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              {/* Network Parameters */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">
                  Network & VLAN Layer
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">{t.ipAddress}</label>
                    <input
                      type="text"
                      value={deviceForm.ip_address}
                      onChange={(e) => setDeviceForm({ ...deviceForm, ip_address: e.target.value })}
                      placeholder="e.g. 192.168.30.15"
                      className="w-full font-mono bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">{t.vlan}</label>
                    <input
                      type="number"
                      value={deviceForm.vlan_id}
                      onChange={(e) => setDeviceForm({ ...deviceForm, vlan_id: e.target.value })}
                      placeholder="10"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">{t.gateway}</label>
                    <input
                      type="text"
                      value={deviceForm.gateway}
                      onChange={(e) => setDeviceForm({ ...deviceForm, gateway: e.target.value })}
                      placeholder="192.168.10.1"
                      className="w-full font-mono bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Physical Switch & Rack Patching */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t.switchName}</label>
                  <input
                    type="text"
                    list="switches-list"
                    value={deviceForm.switch_name}
                    onChange={(e) => setDeviceForm({ ...deviceForm, switch_name: e.target.value })}
                    placeholder="e.g. SW-CORE-RACK-48P"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  />
                  <datalist id="switches-list">
                    <option value="SW-CORE-RACK-48P" />
                    <option value="SW-EDGE-POOL-24P" />
                    <option value="SW-CCTV-SEC-24P" />
                  </datalist>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t.switchPortNumber}</label>
                  <input
                    type="text"
                    value={deviceForm.switch_port}
                    onChange={(e) => setDeviceForm({ ...deviceForm, switch_port: e.target.value })}
                    placeholder="e.g. Port 14 or Gi1/0/14"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              {/* Site Plan / Floor Plan & Placement Zone & Estate Zone */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Estate Zone (Main Villa / Guest House / Service Area) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-300 flex items-center gap-1">
                      <Building2 className="w-3 h-3 text-blue-400" />
                      <span>{isKu ? 'زۆن (Zone)' : 'Zone'}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({isKu ? 'دڵخوازانە' : 'Optional'})
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsEstateZoneModalOpen(true)}
                      className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold inline-flex items-center gap-0.5 transition"
                    >
                      <Settings2 className="w-2.5 h-2.5" />
                      <span>{isKu ? 'دەستکاری' : 'Manage'}</span>
                    </button>
                  </div>
                  <select
                    value={deviceForm.zone || ''}
                    onChange={(e) => {
                      if (e.target.value === '__manage__') {
                        setIsEstateZoneModalOpen(true);
                      } else {
                        setDeviceForm({ ...deviceForm, zone: e.target.value });
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">{isKu ? '— بێ دیاریکردنی زۆن —' : '— None / Unspecified —'}</option>
                    {estateZones.map((ez) => (
                      <option key={ez.id} value={ez.id}>
                        {isKu ? (ez.labelKu || ez.label) : (ez.label || ez.labelKu)}
                      </option>
                    ))}
                    <option value="__manage__" className="text-blue-400 font-semibold">
                      {isKu ? '+ زیادکردن یان دەستکاری...' : '+ Add / Manage Zones...'}
                    </option>
                  </select>
                </div>

                {/* 2. Zone Type (Indoor / Outdoor / Rack / etc.) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-300">
                      {t.placementZoneLabel}
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({isKu ? 'دڵخوازانە' : 'Optional'})
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsZoneModalOpen(true)}
                      className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold inline-flex items-center gap-0.5 transition"
                    >
                      <Settings2 className="w-2.5 h-2.5" />
                      <span>{isKu ? 'دەستکاری' : 'Manage'}</span>
                    </button>
                  </div>
                  <select
                    value={deviceForm.placement_zone || ''}
                    onChange={(e) => {
                      if (e.target.value === '__manage__') {
                        setIsZoneModalOpen(true);
                      } else {
                        const newZone = e.target.value;
                        setDeviceForm({
                          ...deviceForm,
                          placement_zone: newZone,
                          rack_name: newZone === 'rack'
                            ? (deviceForm.rack_name || racks[0]?.name || 'Main 42U Server Rack A')
                            : deviceForm.rack_name,
                        });
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">{isKu ? '— بێ دیاریکردنی شوێن —' : '— None / Optional —'}</option>
                    {zones.map((z) => (
                      <option key={z.id} value={z.id}>
                        {isKu ? (z.labelKu || z.label) : (z.label || z.labelKu)}
                      </option>
                    ))}
                    <option value="__manage__" className="text-blue-400 font-semibold">
                      {isKu ? '+ زیادکردنی جۆر...' : '+ Add Zone Type...'}
                    </option>
                  </select>
                </div>

                {/* 3. Site Plan / Blueprint */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {isKu ? 'سایت پلان / نەخشەی شوێن' : 'Site Plan / Blueprint'}
                  </label>
                  <select
                    value={deviceForm.floor_plan_id || ''}
                    onChange={(e) => {
                      const selFpId = e.target.value;
                      const selFp = floorPlans.find((fp) => fp.id === selFpId);
                      setDeviceForm({
                        ...deviceForm,
                        floor_plan_id: selFpId,
                        zone: deviceForm.zone || selFp?.zone || '',
                        placement_zone: deviceForm.placement_zone || selFp?.zone_type || 'indoor',
                      });
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">{isKu ? 'دیاری نەکراوە (دانانی لە دوایدا)' : 'None (Unassigned)'}</option>
                    {floorPlans.map((fp) => (
                      <option key={fp.id} value={fp.id}>
                        {isKu ? fp.name_ku : fp.name} {fp.zone ? `[${formatEstateZone(fp.zone, lang)}]` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Server Rack & Rack Unit & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* 1. Server Rack Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-300 flex items-center gap-1">
                      <Server className="w-3 h-3 text-blue-400" />
                      <span>{isKu ? 'ڕاکی سێرڤەر (Rack)' : 'Server Rack'}</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsRackModalOpen(true)}
                      className="text-[10px] text-blue-400 hover:text-blue-300 font-semibold inline-flex items-center gap-0.5 transition cursor-pointer"
                    >
                      <Settings2 className="w-2.5 h-2.5" />
                      <span>{isKu ? 'دەستکاری' : 'Manage'}</span>
                    </button>
                  </div>
                  <select
                    value={deviceForm.rack_name || ''}
                    onChange={(e) => {
                      if (e.target.value === '__manage__') {
                        setIsRackModalOpen(true);
                      } else {
                        setDeviceForm({ ...deviceForm, rack_name: e.target.value });
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="">{isKu ? '— بێ دیاریکردنی ڕاک (Field) —' : '— None / Field Device —'}</option>
                    {racks.map((r) => (
                      <option key={r.id} value={r.name}>
                        {isKu ? (r.nameKu || r.name) : r.name} ({r.totalUnits}U)
                      </option>
                    ))}
                    <option value="__manage__" className="text-blue-400 font-semibold">
                      {isKu ? '+ زیادکردن یان گۆڕینی ناوی ڕاکەکان...' : '+ Add / Rename Racks...'}
                    </option>
                  </select>
                </div>

                {/* 2. Rack Unit Position */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t.rackUnitPos}</label>
                  <input
                    type="text"
                    value={deviceForm.rack_unit}
                    onChange={(e) => setDeviceForm({ ...deviceForm, rack_unit: e.target.value })}
                    placeholder="e.g. U14-U16"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>

                {/* 3. Installation Status */}
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t.status}</label>
                  <select
                    value={deviceForm.installation_status}
                    onChange={(e) => setDeviceForm({ ...deviceForm, installation_status: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="Pending">{t.statusPending}</option>
                    <option value="Installed">{t.statusInstalled}</option>
                    <option value="Configured">{t.statusConfigured}</option>
                    <option value="Verified">{t.statusVerified}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t.notes}</label>
                <input
                  type="text"
                  value={deviceForm.notes}
                  onChange={(e) => setDeviceForm({ ...deviceForm, notes: e.target.value })}
                  placeholder="Installation nuances, key mappings, port profiles..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-400 hover:text-white"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30"
                >
                  {t.saveDevice}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Comprehensive Device Inspection & Image Zoom Modal */}
      <DeviceDetailsModal
        device={inspectingDevice}
        boqModels={boqModels}
        floorPlans={floorPlans}
        categories={categories}
        isOpen={Boolean(inspectingDevice)}
        onClose={() => setInspectingDevice(null)}
        onEdit={(dev) => handleOpenEdit(dev)}
        onUpdateStatus={(id, status) => {
          if (onUpdateStatus) onUpdateStatus(id, status);
          if (inspectingDevice && inspectingDevice.id === id) {
            setInspectingDevice((prev) => ({ ...prev, installation_status: status }));
          }
        }}
        onOpenTroubleshoot={onOpenTroubleshoot}
        onNavigateToMap={onNavigateToMap}
        lang={lang}
      />

      {/* Quick Add Category Modal */}
      <QuickAddCategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onCreateCategory={onCreateCategory}
        onCategoryCreated={(newCat) => {
          if (newCat?.id) {
            setCategoryFilter(newCat.id);
          }
        }}
        lang={lang}
      />

      {/* Dynamic Zone Types Manager Modal */}
      <ZoneEditorModal
        isOpen={isZoneModalOpen}
        onClose={() => setIsZoneModalOpen(false)}
        lang={lang}
      />

      {/* Dynamic Estate Zones Manager Modal (Main Villa, Guest House, Service Area) */}
      <EstateZoneEditorModal
        isOpen={isEstateZoneModalOpen}
        onClose={() => setIsEstateZoneModalOpen(false)}
        lang={lang}
      />

      {/* Dynamic Server Rack & Cabinet Manager Modal */}
      <RackManagerModal
        isOpen={isRackModalOpen}
        onClose={() => setIsRackModalOpen(false)}
        devices={devices}
        lang={lang}
      />
    </div>
  );
}

