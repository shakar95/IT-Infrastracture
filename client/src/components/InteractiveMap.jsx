import React, { useState, useRef, useEffect } from 'react';
import {
  MapPin,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  Clock,
  Layers,
  Cpu,
  Wifi,
  Camera,
  Server,
  Tv,
  ExternalLink,
  Bot,
  Activity,
  X,
  Plus,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { translations } from '../i18n/translations';
import AddFloorPlanModal from './AddFloorPlanModal';

export default function InteractiveMap({
  floorPlans = [],
  devices = [],
  boqModels = [],
  categories = [],
  onUpdatePosition,
  onOpenTroubleshoot,
  onCreateFloorPlan,
  onDeleteFloorPlan,
  initialSelectedPlanId = null,
  initialSelectedDevice = null,
  lang = 'en',
}) {
  const t = translations[lang] || translations.en;
  const isKu = lang === 'ku';

  const [selectedPlanId, setSelectedPlanId] = useState(initialSelectedPlanId || floorPlans[0]?.id || '');
  const [selectedDevice, setSelectedDevice] = useState(initialSelectedDevice || null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [pingStatus, setPingStatus] = useState(null); // null | 'testing' | { ok: true, latency: 12 }
  const [deviceToPlace, setDeviceToPlace] = useState(null);
  const [isAddPlanModalOpen, setIsAddPlanModalOpen] = useState(false);

  useEffect(() => {
    if (initialSelectedPlanId) {
      setSelectedPlanId(initialSelectedPlanId);
    }
  }, [initialSelectedPlanId]);

  useEffect(() => {
    if (initialSelectedDevice) {
      setSelectedDevice(initialSelectedDevice);
    }
  }, [initialSelectedDevice]);

  const mapContainerRef = useRef(null);

  const activePlan = floorPlans.find((fp) => fp.id === selectedPlanId) || floorPlans[0];

  // Devices placed on this floor plan
  const pinnedDevices = devices.filter(
    (d) => d.floor_plan_id === activePlan?.id && d.pos_x !== null && d.pos_y !== null
  );

  // Devices not yet placed on this floor plan
  const unpinnedDevices = devices.filter((d) => !d.floor_plan_id || d.pos_x === null);

  // Click on map to place selected device
  const handleMapClick = (e) => {
    if (!deviceToPlace || !mapContainerRef.current) return;

    const rect = mapContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const clampedX = Math.max(2, Math.min(98, Math.round(x * 10) / 10));
    const clampedY = Math.max(2, Math.min(98, Math.round(y * 10) / 10));

    onUpdatePosition(deviceToPlace.id, {
      floor_plan_id: activePlan.id,
      pos_x: clampedX,
      pos_y: clampedY,
    });

    setDeviceToPlace(null);
  };

  const handleSimulatePing = (ip) => {
    setPingStatus('testing');
    setTimeout(() => {
      const isUp = Math.random() > 0.05;
      const latency = Math.floor(2 + Math.random() * 18);
      setPingStatus({ ok: isUp, latency, ip });
    }, 600);
  };

  const handleUnpin = (device) => {
    onUpdatePosition(device.id, {
      floor_plan_id: null,
      pos_x: null,
      pos_y: null,
    });
    setSelectedDevice(null);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header & Floor Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{t.mapTitle}</h2>
          <p className="text-xs sm:text-sm text-slate-400">{t.mapSubtitle}</p>
        </div>

        {/* Floor Plan Tabs & Add Plan Button */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800">
            {floorPlans.map((fp) => {
              const isActive = fp.id === activePlan?.id;
              return (
                <button
                  key={fp.id}
                  onClick={() => {
                    setSelectedPlanId(fp.id);
                    setSelectedDevice(null);
                    setDeviceToPlace(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <span>{isKu ? fp.name_ku : fp.name}</span>
                  <span className="ml-1.5 px-1.5 py-0.2 rounded text-[10px] bg-slate-950/60 font-mono">
                    {fp.zone_type}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setIsAddPlanModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 transition active:scale-95 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{isKu ? '+ زیادکردنی سایت پلان / نەخشە' : '+ Add Site Plan'}</span>
          </button>
        </div>
      </div>

      {/* Main Map Viewer & Device Staging Drawer */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Side: Interactive Blueprint Canvas (3 cols) */}
        <div className="lg:col-span-3 space-y-3">
          {/* Controls Bar */}
          <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 px-4 py-2.5 rounded-2xl">
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="font-semibold text-white">{isKu ? activePlan?.name_ku : activePlan?.name}</span>
              <span className="text-slate-500">|</span>
              <span className="text-amber-400 font-mono font-medium">
                {pinnedDevices.length} {isKu ? 'ئامێر جێگیرکراوە' : 'pins placed'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {deviceToPlace && (
                <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/20 border border-amber-500/40 rounded-xl text-xs text-amber-300 animate-bounce">
                  <span>Click blueprint to place: <strong>{deviceToPlace.custom_label_id}</strong></span>
                  <button onClick={() => setDeviceToPlace(null)} className="text-amber-400 hover:text-white">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.15))}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300"
                title={t.zoomOut}
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoomLevel((z) => Math.min(1.8, z + 0.15))}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300"
                title={t.zoomIn}
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                onClick={() => setZoomLevel(1)}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300"
                title={t.resetZoom}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Map Surface Viewport */}
          <div className="relative overflow-hidden bg-slate-950 border border-slate-800 rounded-2xl min-h-[500px] flex items-center justify-center p-2 shadow-2xl">
            <div
              ref={mapContainerRef}
              onClick={handleMapClick}
              style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'center center' }}
              className={`relative w-full aspect-[16/10] max-h-[640px] rounded-xl overflow-hidden select-none transition-transform duration-200 ${
                deviceToPlace ? 'cursor-crosshair' : 'cursor-default'
              }`}
            >
              {/* Floor Plan Architectural Graphic */}
              <img
                src={activePlan?.image_url}
                alt={activePlan?.name}
                className="w-full h-full object-cover filter brightness-90 contrast-105"
              />
              <div className="absolute inset-0 bg-slate-950/30 backdrop-contrast-125 pointer-events-none" />

              {/* Grid Overlay for Architectural Precision */}
              <div
                className="absolute inset-0 opacity-15 pointer-events-none"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, #3b82f6 1px, transparent 1px), linear-gradient(to bottom, #3b82f6 1px, transparent 1px)',
                  backgroundSize: '40px 40px',
                }}
              />

              {/* Interactive Device Pins */}
              {pinnedDevices.map((dev) => {
                const model = boqModels.find((m) => m.id === dev.boq_model_id);
                const category = model ? categories.find((c) => c.id === model.category_id) : null;
                const isSelected = selectedDevice?.id === dev.id;

                const statusColor =
                  dev.installation_status === 'Verified'
                    ? '#10B981'
                    : dev.installation_status === 'Configured'
                    ? '#6366F1'
                    : dev.installation_status === 'Installed'
                    ? '#3B82F6'
                    : '#F59E0B';

                return (
                  <div
                    key={dev.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDevice(dev);
                      setPingStatus(null);
                    }}
                    style={{ left: `${dev.pos_x}%`, top: `${dev.pos_y}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20"
                  >
                    {/* Pulsing Status Ring */}
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition duration-200 group-hover:scale-125"
                      style={{
                        backgroundColor: '#0f172a',
                        border: `2.5px solid ${statusColor}`,
                        boxShadow: isSelected ? `0 0 15px ${statusColor}` : '0 4px 10px rgba(0,0,0,0.5)',
                      }}
                    >
                      <span className="text-[10px] font-bold text-white font-mono">
                        {dev.custom_label_id.substring(0, 3)}
                      </span>
                    </div>

                    {/* Tooltip Tag */}
                    <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover:flex flex-col items-center pointer-events-none whitespace-nowrap z-30">
                      <div className="px-2 py-1 bg-slate-900 border border-slate-700 rounded-md shadow-xl text-center">
                        <p className="text-[11px] font-bold font-mono text-white">{dev.custom_label_id}</p>
                        <p className="text-[9px] text-cyan-400 font-mono">{dev.ip_address || 'No IP'}</p>
                      </div>
                      <div className="w-1.5 h-1.5 bg-slate-900 rotate-45 -mt-1 border-r border-b border-slate-700" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Staging Tray & Device Inspector (1 col) */}
        <div className="space-y-4">
          {/* Selected Device Inspector Drawer */}
          {selectedDevice ? (
            <div className="bg-slate-900/90 border border-blue-500/40 rounded-2xl p-4 shadow-xl space-y-4 animate-fadeIn">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">
                    {t.inspectTitle}
                  </span>
                  <h3 className="text-base font-bold text-white font-mono">{selectedDevice.custom_label_id}</h3>
                </div>
                <button
                  onClick={() => setSelectedDevice(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Hardware Device Photo & Model Name */}
              {(() => {
                const model = boqModels.find((m) => m.id === selectedDevice.boq_model_id) || selectedDevice.boq_model;
                if (!model) return null;
                return (
                  <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-950">
                    {model.product_image_url && (
                      <div className="relative h-28 w-full bg-slate-950 overflow-hidden">
                        <img
                          src={model.product_image_url}
                          alt={`${model.brand} ${model.model}`}
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent" />
                      </div>
                    )}
                    <div className="p-2.5">
                      <div className="text-xs font-bold text-white">{model.brand} {model.model}</div>
                      <div className="text-[11px] text-slate-400 truncate">{model.description}</div>
                    </div>
                  </div>
                );
              })()}

              {/* Status Badge */}
              <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400">Installation Status:</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    selectedDevice.installation_status === 'Verified'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : selectedDevice.installation_status === 'Configured'
                      ? 'bg-indigo-500/20 text-indigo-400'
                      : selectedDevice.installation_status === 'Installed'
                      ? 'bg-blue-500/20 text-blue-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  {selectedDevice.installation_status}
                </span>
              </div>

              {/* Specs Grid */}
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between p-2 bg-slate-950/60 rounded-lg">
                  <span className="text-slate-400">IP Address:</span>
                  <span className="text-cyan-400 font-bold">{selectedDevice.ip_address || 'Unassigned'}</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-950/60 rounded-lg">
                  <span className="text-slate-400">MAC Address:</span>
                  <span className="text-slate-200">{selectedDevice.mac_address || '—'}</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-950/60 rounded-lg">
                  <span className="text-slate-400">VLAN:</span>
                  <span className="text-blue-400">VLAN {selectedDevice.vlan_id || 10}</span>
                </div>
                <div className="flex justify-between p-2 bg-slate-950/60 rounded-lg">
                  <span className="text-slate-400">Switch Port:</span>
                  <span className="text-amber-300 truncate">
                    {selectedDevice.switch_name ? `${selectedDevice.switch_name} [${selectedDevice.switch_port}]` : '—'}
                  </span>
                </div>
                <div className="flex justify-between p-2 bg-slate-950/60 rounded-lg">
                  <span className="text-slate-400">Rack Location:</span>
                  <span className="text-slate-200">{selectedDevice.rack_unit || 'Field Unit'}</span>
                </div>
              </div>

              {/* Ping Simulator Button */}
              <div>
                <button
                  onClick={() => handleSimulatePing(selectedDevice.ip_address)}
                  disabled={!selectedDevice.ip_address || pingStatus === 'testing'}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white transition disabled:opacity-50"
                >
                  <Activity className={`w-3.5 h-3.5 ${pingStatus === 'testing' ? 'animate-spin text-amber-400' : 'text-emerald-400'}`} />
                  <span>{pingStatus === 'testing' ? 'Pinging ICMP...' : t.testPing}</span>
                </button>

                {pingStatus && pingStatus !== 'testing' && (
                  <div className={`mt-2 p-2 rounded-lg text-[11px] font-mono text-center border ${
                    pingStatus.ok ? 'bg-emerald-950/40 border-emerald-800/40 text-emerald-300' : 'bg-red-950/40 border-red-800/40 text-red-300'
                  }`}>
                    {pingStatus.ok ? `Reply from ${pingStatus.ip}: time=${pingStatus.latency}ms TTL=64` : `Request timed out (Host Unreachable)`}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => onOpenTroubleshoot(selectedDevice)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-200 border border-indigo-500/40 transition active:scale-95"
                >
                  <Bot className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{t.launchTroubleshoot}</span>
                </button>

                <button
                  onClick={() => handleUnpin(selectedDevice)}
                  className="w-full px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-red-400 hover:bg-slate-800/50 transition"
                >
                  {t.removePin}
                </button>
              </div>
            </div>
          ) : (
            /* Unpinned Equipment Tray (Click to place) */
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">{t.unpinnedDevices}</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                  {unpinnedDevices.length}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">{t.dragHint}</p>

              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {unpinnedDevices.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 italic">
                    All devices are currently pinned to maps!
                  </div>
                ) : (
                  unpinnedDevices.map((dev) => {
                    const model = boqModels.find((m) => m.id === dev.boq_model_id);
                    const isSelectedForPlacement = deviceToPlace?.id === dev.id;

                    return (
                      <div
                        key={dev.id}
                        onClick={() => setDeviceToPlace(isSelectedForPlacement ? null : dev)}
                        className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between ${
                          isSelectedForPlacement
                            ? 'bg-blue-600/20 border-blue-500 text-white shadow-md'
                            : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold font-mono text-white">{dev.custom_label_id}</p>
                          <p className="text-[10px] text-slate-400">
                            {model ? `${model.brand} ${model.model}` : 'ELV Unit'}
                          </p>
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-blue-400">
                          {isSelectedForPlacement ? 'Placing...' : 'Pin +'}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Site Plan / Floor Plan Modal */}
      <AddFloorPlanModal
        isOpen={isAddPlanModalOpen}
        onClose={() => setIsAddPlanModalOpen(false)}
        onCreateFloorPlan={onCreateFloorPlan}
        onFloorPlanCreated={(newPlan) => {
          if (newPlan?.id) {
            setSelectedPlanId(newPlan.id);
          }
        }}
        lang={lang}
      />
    </div>
  );
}

