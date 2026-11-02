import React, { useState } from 'react';
import {
  X,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Copy,
  Check,
  ExternalLink,
  MapPin,
  Activity,
  Bot,
  Edit2,
  Server,
  FileText,
  Download,
  Layers,
  ShieldCheck,
  Hash,
  Network,
  RotateCcw,
} from 'lucide-react';
import { translations } from '../i18n/translations';

export default function DeviceDetailsModal({
  device,
  boqModels = [],
  floorPlans = [],
  categories = [],
  isOpen,
  onClose,
  onEdit,
  onUpdateStatus,
  onOpenTroubleshoot,
  onNavigateToMap,
  lang = 'en',
}) {
  if (!isOpen || !device) return null;

  const t = translations[lang] || translations.en;
  const isKu = lang === 'ku';

  const [copiedKey, setCopiedKey] = useState(null);
  const [isImageLightboxOpen, setIsImageLightboxOpen] = useState(false);
  const [imageScale, setImageScale] = useState(1);
  const [pingState, setPingState] = useState(null); // null | 'testing' | { ok: true, latency: 14 }

  // Resolve associated BOQ model, Category, and Floor Plan
  const model = boqModels.find((m) => m.id === device.boq_model_id) || device.boq_model;
  const category = categories.find((c) => c.id === model?.category_id) || model?.category;
  const floorPlan = floorPlans.find((fp) => fp.id === device.floor_plan_id) || device.floor_plan;

  // Copy to clipboard helper
  const handleCopy = (text, key) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Simulate ICMP Ping
  const handleTestPing = () => {
    if (!device.ip_address) return;
    setPingState('testing');
    setTimeout(() => {
      const isOnline = device.installation_status !== 'Pending' || Math.random() > 0.2;
      const latency = Math.floor(6 + Math.random() * 18);
      setPingState({ ok: isOnline, latency, ip: device.ip_address });
    }, 850);
  };

  // Status cycling
  const statuses = ['Pending', 'Installed', 'Configured', 'Verified'];
  const handleStatusClick = (nextStatus) => {
    if (onUpdateStatus) {
      onUpdateStatus(device.id, nextStatus);
    }
  };

  return (
    <>
      {/* Main Inspection Modal Backdrop */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
        <div
          className="relative w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Modal Top Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/70">
            <div className="flex items-center gap-3">
              <span
                className="w-3.5 h-3.5 rounded-full ring-4 shadow-sm"
                style={{
                  backgroundColor:
                    device.installation_status === 'Verified'
                      ? '#10b981'
                      : device.installation_status === 'Configured'
                      ? '#6366f1'
                      : device.installation_status === 'Installed'
                      ? '#3b82f6'
                      : '#f59e0b',
                  ringColor: `${category?.color_code || '#3b82f6'}33`,
                }}
              />
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-bold font-mono text-white tracking-wide">
                    {device.custom_label_id}
                  </h2>
                  <button
                    onClick={() => handleCopy(device.custom_label_id, 'label')}
                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                    title="Copy Label"
                  >
                    {copiedKey === 'label' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-400">
                  {model ? `${model.brand} ${model.model}` : 'Generic Asset'}
                  {category && ` • ${isKu ? category.name_ku : category.name}`}
                </p>
              </div>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  onClose();
                  if (onEdit) onEdit(device);
                }}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              >
                <Edit2 className="w-3.5 h-3.5 text-blue-400" />
                <span>{isKu ? 'دەستکاریکردن' : 'Edit'}</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Modal Body Scroll Area */}
          <div className="overflow-y-auto p-6 space-y-6 flex-1">
            {/* Top Overview Grid: Product Image & Network Quickview */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              {/* Product Photo Showcase with Zoom Trigger */}
              <div className="md:col-span-5 space-y-2">
                <div className="relative group rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-950 aspect-[4/3] shadow-inner flex items-center justify-center">
                  {model?.product_image_url ? (
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

                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />

                  {/* Enlarge Image Overlay Button */}
                  {model?.product_image_url && (
                    <button
                      onClick={() => setIsImageLightboxOpen(true)}
                      className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900/90 text-white backdrop-blur-md border border-slate-700 hover:bg-blue-600 hover:border-blue-500 transition shadow-lg group-hover:opacity-100"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>{isKu ? 'گەورەکردنی وێنە' : 'Zoom Image'}</span>
                    </button>
                  )}

                  {/* Category Pill Tag */}
                  {category && (
                    <div className="absolute top-3 left-3">
                      <span
                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-white shadow backdrop-blur-md"
                        style={{ backgroundColor: `${category.color_code || '#3b82f6'}cc` }}
                      >
                        {isKu ? category.name_ku : category.name}
                      </span>
                    </div>
                  )}

                  {/* Rack Mount Tag */}
                  {model?.is_rack_mounted && (
                    <div className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-amber-500/90 text-slate-950 shadow">
                      <Server className="w-3 h-3" />
                      <span>{model.rack_unit_size || 1}U Rack</span>
                    </div>
                  )}
                </div>

                {/* Subtitle / Model description */}
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
                  <h4 className="text-xs font-bold text-slate-200">
                    {model?.brand} {model?.model}
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-3">
                    {model?.description || 'Iraq Sitak Villa Infrastructure Asset'}
                  </p>
                </div>
              </div>

              {/* Network, Status & Quick Action Panel */}
              <div className="md:col-span-7 space-y-4">
                {/* Installation Status Lifecycle Selector */}
                <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 font-medium">
                      {isKu ? 'دۆخی بەستن و چالاککردن:' : 'Installation Status:'}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">Click step to update</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {statuses.map((st) => {
                      const isActive = device.installation_status === st;
                      return (
                        <button
                          key={st}
                          onClick={() => handleStatusClick(st)}
                          className={`py-2 px-1 rounded-xl text-center text-xs font-bold transition flex flex-col items-center gap-1 ${
                            isActive
                              ? st === 'Verified'
                                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                                : st === 'Configured'
                                ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                : st === 'Installed'
                                ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                                : 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
                              : 'bg-slate-900 text-slate-400 hover:bg-slate-850 hover:text-slate-200 border border-slate-800'
                          }`}
                        >
                          <span className="text-[10px] font-mono leading-none">{st}</span>
                          <span className="text-[9px] opacity-80">
                            {st === 'Pending'
                              ? isKu
                                ? 'نۆت کۆنفیگەر'
                                : 'Pending'
                              : st === 'Installed'
                              ? isKu
                                ? 'بەستراو'
                                : 'Installed'
                              : st === 'Configured'
                              ? isKu
                                ? 'ڕێکخراو'
                                : 'Configured'
                              : isKu
                              ? 'پشتڕاستکراو'
                              : 'Verified'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Network IP & Ping Row */}
                <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400">
                        {isKu ? 'ناونیشانی تۆڕ (IP Address)' : 'Management IP Address'}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-lg font-bold font-mono text-cyan-300">
                          {device.ip_address || 'Unassigned'}
                        </span>
                        {device.ip_address && (
                          <button
                            onClick={() => handleCopy(device.ip_address, 'ip')}
                            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                            title="Copy IP"
                          >
                            {copiedKey === 'ip' ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Ping Simulator Button */}
                    <button
                      onClick={handleTestPing}
                      disabled={!device.ip_address || pingState === 'testing'}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 transition disabled:opacity-40"
                    >
                      <Activity
                        className={`w-4 h-4 ${pingState === 'testing' ? 'animate-spin text-amber-400' : 'text-emerald-400'}`}
                      />
                      <span>{pingState === 'testing' ? 'Pinging ICMP...' : isKu ? 'تاقیکردنەوەی Ping' : 'Test Ping'}</span>
                    </button>
                  </div>

                  {/* Ping Result Alert */}
                  {pingState && pingState !== 'testing' && (
                    <div
                      className={`p-2.5 rounded-xl text-xs font-mono text-center border animate-fadeIn ${
                        pingState.ok
                          ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300'
                          : 'bg-red-950/40 border-red-800/40 text-red-300'
                      }`}
                    >
                      {pingState.ok
                        ? `✓ Reply from ${pingState.ip}: bytes=32 time=${pingState.latency}ms TTL=64`
                        : `✗ Request timed out. Host unreachable on Sitak Management Subnet.`}
                    </div>
                  )}

                  {/* Network Specs Grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-slate-800/80">
                    <div className="p-2 bg-slate-900/60 rounded-xl">
                      <span className="text-[10px] text-slate-400 block">MAC Address:</span>
                      <span className="text-slate-200">{device.mac_address || '—'}</span>
                    </div>
                    <div className="p-2 bg-slate-900/60 rounded-xl">
                      <span className="text-[10px] text-slate-400 block">VLAN:</span>
                      <span className="text-blue-400 font-bold">VLAN {device.vlan_id || 10}</span>
                    </div>
                    <div className="p-2 bg-slate-900/60 rounded-xl">
                      <span className="text-[10px] text-slate-400 block">Subnet Mask:</span>
                      <span className="text-slate-300">{device.subnet_mask || '255.255.255.0'}</span>
                    </div>
                    <div className="p-2 bg-slate-900/60 rounded-xl">
                      <span className="text-[10px] text-slate-400 block">Default Gateway:</span>
                      <span className="text-slate-300">{device.gateway || '192.168.10.1'}</span>
                    </div>
                  </div>
                </div>

                {/* Quick Action Buttons (Troubleshooter & Map Navigation) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      onClose();
                      if (onOpenTroubleshoot) onOpenTroubleshoot(device);
                    }}
                    className="flex items-center justify-center gap-2 p-3 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition active:scale-95"
                  >
                    <Bot className="w-4 h-4 text-indigo-200" />
                    <span>{isKu ? 'پشکنینی کێشە بە AI (RAG)' : 'AI Troubleshooter'}</span>
                  </button>

                  <button
                    onClick={() => {
                      onClose();
                      if (onNavigateToMap) onNavigateToMap(device.floor_plan_id, device.id);
                    }}
                    className="flex items-center justify-center gap-2 p-3 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition active:scale-95"
                  >
                    <MapPin className="w-4 h-4 text-amber-400" />
                    <span>{isKu ? 'پیشاندان لەسەر نەخشەی پڕۆژە' : 'View on Map'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Middle Section: Switch Port & Physical Rack Location */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Switch Connection */}
              <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-slate-400 text-xs">
                  <Network className="w-4 h-4 text-blue-400" />
                  <span className="font-semibold uppercase tracking-wider">{t.switchPort}</span>
                </div>
                <div className="text-sm font-bold text-white">
                  {device.switch_name || <span className="text-slate-500 italic">Not Patched</span>}
                </div>
                {device.switch_port && (
                  <div className="inline-block px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {device.switch_port}
                  </div>
                )}
              </div>

              {/* Rack Location */}
              <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-slate-400 text-xs">
                  <Server className="w-4 h-4 text-indigo-400" />
                  <span className="font-semibold uppercase tracking-wider">{t.rackLocation}</span>
                </div>
                <div className="text-sm font-bold text-white">
                  {device.rack_name || (device.placement_zone === 'rack' ? 'Main 42U Rack' : 'Field Deployed')}
                </div>
                {device.rack_unit && (
                  <div className="inline-block px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    Unit: {device.rack_unit}
                  </div>
                )}
              </div>

              {/* Physical Zone & Serial */}
              <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-1.5">
                <div className="flex items-center gap-2 text-slate-400 text-xs">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span className="font-semibold uppercase tracking-wider">Zone & Serial</span>
                </div>
                <div className="text-xs font-semibold text-emerald-400 capitalize">
                  Zone: {device.placement_zone || 'Indoor'}
                </div>
                <div className="text-xs font-mono text-slate-400 truncate">
                  SN: {device.serial_number || 'Unregistered'}
                </div>
              </div>
            </div>

            {/* Floor Plan & Map Location Preview */}
            {floorPlan && (
              <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                      {isKu ? 'شوێنی جێگیربوون لەسەر نەخشە' : 'Floor Plan & Physical Coordinates'}
                    </h3>
                  </div>
                  <span className="text-xs font-mono text-slate-400">
                    Level {floorPlan.floor_level} • {isKu ? floorPlan.name_ku : floorPlan.name}
                  </span>
                </div>

                {/* Mini Visual Floor Plan preview with pin */}
                <div className="relative h-44 rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                  <img
                    src={floorPlan.image_url}
                    alt={floorPlan.name}
                    className="w-full h-full object-cover opacity-80"
                  />
                  <div className="absolute inset-0 bg-slate-950/30" />

                  {/* Device Pin on Map */}
                  {device.pos_x !== null && device.pos_y !== null ? (
                    <div
                      className="absolute -translate-x-1/2 -translate-y-1/2 z-20 group"
                      style={{ left: `${device.pos_x}%`, top: `${device.pos_y}%` }}
                    >
                      <div className="relative flex items-center justify-center">
                        <span className="absolute w-8 h-8 rounded-full bg-blue-500/40 animate-ping" />
                        <div className="w-7 h-7 rounded-full bg-blue-600 border-2 border-white shadow-xl flex items-center justify-center text-white text-[10px] font-mono font-bold">
                          ●
                        </div>
                      </div>
                      <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 px-2 py-0.5 rounded bg-slate-950 text-white text-[10px] font-mono whitespace-nowrap shadow border border-slate-700">
                        {device.custom_label_id} ({device.pos_x}%, {device.pos_y}%)
                      </div>
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm">
                      <p className="text-xs text-slate-400">
                        {isKu ? 'ئەم ئامێرە هێشتا پین نەکراوە لەسەر نەخشە' : 'Device not yet pinned to this map'}
                      </p>
                    </div>
                  )}

                  {/* Jump button inside map banner */}
                  <button
                    onClick={() => {
                      onClose();
                      if (onNavigateToMap) onNavigateToMap(floorPlan.id, device.id);
                    }}
                    className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900/90 text-white backdrop-blur-md border border-slate-700 hover:bg-blue-600 transition shadow-lg"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>{isKu ? 'کردنەوەی تەواوی نەخشە' : 'Open in Map Viewer'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* Catalog, Manuals & Backup Documents Section */}
            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                  {isKu ? 'کەتەلۆگ، مانیواڵ و فایلی یەدەگی کۆنفیگەرەیشن' : 'Catalog, Manuals & Backup Documents'}
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Engineering Catalog / Manual */}
                <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-slate-200">
                      {isKu ? 'مانیواڵی تەکنیکی و کەتەلۆگ' : 'Datasheet & Technical Catalog'}
                    </span>
                    <p className="text-[10px] text-slate-400">
                      {model ? `${model.brand} ${model.model} Specs` : 'Hardware Documentation'}
                    </p>
                  </div>
                  {model?.manual_pdf_url ? (
                    <a
                      href={model.manual_pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow"
                    >
                      <Download className="w-3 h-3" />
                      <span>PDF</span>
                    </a>
                  ) : (
                    <button
                      onClick={() =>
                        alert(
                          `Official specification sheet for ${model?.brand || 'Device'} ${
                            model?.model || ''
                          } is archived in the Iraq Sitak Villa documentation repository.`
                        )
                      }
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>{isKu ? 'بینینی کەتەلۆگ' : 'View Catalog'}</span>
                    </button>
                  )}
                </div>

                {/* Configuration Backup */}
                <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-slate-200">
                      {isKu ? 'کۆپی یەدەگ (Config Backup)' : 'Configuration Backup'}
                    </span>
                    <p className="text-[10px] text-slate-400">
                      {device.config_backup_url ? 'Backup file available' : 'No backup archive uploaded'}
                    </p>
                  </div>
                  {device.config_backup_url ? (
                    <a
                      href={device.config_backup_url}
                      download
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition shadow"
                    >
                      <Download className="w-3 h-3" />
                      <span>Backup</span>
                    </a>
                  ) : (
                    <button
                      onClick={() =>
                        alert(
                          `To upload a config backup for ${device.custom_label_id}, click 'Edit Configuration' above and attach the backup file.`
                        )
                      }
                      className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-800 text-slate-400 border border-slate-700"
                    >
                      {isKu ? 'بەردەست نییە' : 'Upload in Edit'}
                    </button>
                  )}
                </div>
              </div>

              {/* Custom Model Specs if any */}
              {model?.custom_specs && Object.keys(model.custom_specs).length > 0 && (
                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-[10px] font-semibold uppercase text-slate-400 block mb-1.5">
                    Custom Engineering Attributes:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {Object.entries(model.custom_specs).map(([k, v]) => (
                      <div key={k} className="p-2 bg-slate-900/50 rounded-lg border border-slate-800/60 text-xs">
                        <span className="text-[10px] text-slate-500 capitalize block">{k.replace(/_/g, ' ')}:</span>
                        <span className="font-mono text-slate-200 font-medium">{String(v)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Technician Field Notes */}
              {device.notes && (
                <div className="p-3 bg-slate-900/50 rounded-xl border border-slate-800 text-xs space-y-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Field Technician Remarks / Cabling Notes:
                  </span>
                  <p className="text-slate-300 font-mono">{device.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-6 py-3.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span className="font-mono text-[11px]">ID: {device.id}</span>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition"
            >
              {isKu ? 'داخستن' : 'Close Window'}
            </button>
          </div>
        </div>
      </div>

      {/* FULLSCREEN IMAGE LIGHTBOX MODAL */}
      {isImageLightboxOpen && model?.product_image_url && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95 backdrop-blur-xl animate-fadeIn p-4"
          onClick={() => setIsImageLightboxOpen(false)}
        >
          {/* Lightbox Toolbar */}
          <div
            className="absolute top-4 left-4 right-4 flex items-center justify-between text-white z-50 pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-lg text-xs font-mono font-bold bg-slate-900/80 border border-slate-700">
                {device.custom_label_id}
              </span>
              <span className="text-sm font-bold text-slate-200">
                {model.brand} {model.model}
              </span>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700 px-3 py-1.5 rounded-2xl shadow-2xl">
              <button
                onClick={() => setImageScale((s) => Math.max(0.6, s - 0.25))}
                className="p-1 hover:text-blue-400 transition"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs font-mono px-2">{Math.round(imageScale * 100)}%</span>
              <button
                onClick={() => setImageScale((s) => Math.min(3.0, s + 0.25))}
                className="p-1 hover:text-blue-400 transition"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setImageScale(1)}
                className="p-1 hover:text-amber-400 transition ml-1"
                title="Reset Zoom"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <a
                href={model.product_image_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1 hover:text-emerald-400 transition ml-1"
                title="Open in new tab"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              <button
                onClick={() => setIsImageLightboxOpen(false)}
                className="p-1 hover:text-red-400 transition ml-2 border-l border-slate-700 pl-2"
                title="Close Lightbox"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Lightbox Scalable Image Container */}
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

          {/* Caption at bottom */}
          <div className="absolute bottom-4 text-center text-xs text-slate-400 pointer-events-none">
            {model.description || `${model.brand} ${model.model}`}
          </div>
        </div>
      )}
    </>
  );
}

