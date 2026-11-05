import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Pencil,
  AlertTriangle,
  Move,
  Search,
  Crosshair,
  Sparkles,
  FileText,
  Check,
  Settings2,
  Building2,
} from 'lucide-react';
import { translations } from '../i18n/translations';
import AddFloorPlanModal from './AddFloorPlanModal';
import ZoneEditorModal from './ZoneEditorModal';
import EstateZoneEditorModal from './EstateZoneEditorModal';
import BlueprintCanvas from './BlueprintCanvas';
import { api } from '../services/api';
import { getIctDeviceIcon } from '../utils/ictIcons';
import { useZones } from '../utils/zoneManager';
import { useEstateZones } from '../utils/estateZoneManager';
import { formatFloorLevel, formatShortFloorLevel } from '../utils/floorLevels';

export default function InteractiveMap({
  floorPlans = [],
  devices = [],
  boqModels = [],
  categories = [],
  onUpdatePosition,
  onUpdateDevice,
  onOpenTroubleshoot,
  onCreateFloorPlan,
  onUpdateFloorPlan,
  onDeleteFloorPlan,
  initialSelectedPlanId = null,
  initialSelectedDevice = null,
  lang = 'en',
}) {
  const t = translations[lang] || translations.en;
  const isKu = lang === 'ku';
  const { zones, formatZone } = useZones();
  const { estateZones, formatEstateZone } = useEstateZones();
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [isEstateZoneModalOpen, setIsEstateZoneModalOpen] = useState(false);
  const [selectedZoneFilter, setSelectedZoneFilter] = useState('all');

  // 1. All State Hooks
  const [selectedPlanId, setSelectedPlanId] = useState(initialSelectedPlanId || floorPlans[0]?.id || '');
  const [selectedDevice, setSelectedDevice] = useState(initialSelectedDevice || null);
  const [pingStatus, setPingStatus] = useState(null);
  const [deviceToPlace, setDeviceToPlace] = useState(null);
  const [isAddPlanModalOpen, setIsAddPlanModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [isEditPlanModalOpen, setIsEditPlanModalOpen] = useState(false);
  const [mobileActiveView, setMobileActiveView] = useState('canvas'); // 'canvas' | 'plans' | 'devices'

  // Device Location Zone & Engineering Notes State
  const [deviceNotes, setDeviceNotes] = useState('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesSavedSuccess, setNotesSavedSuccess] = useState(false);
  const [deviceZone, setDeviceZone] = useState('');
  const [isSavingZone, setIsSavingZone] = useState(false);
  const [deviceEstateZone, setDeviceEstateZone] = useState('');
  const [isSavingEstateZone, setIsSavingEstateZone] = useState(false);

  // Dynamic Blueprint Aspect Ratio State
  const [planDimensions, setPlanDimensions] = useState({ width: 1200, height: 800 });

  // Pan & Zoom State (60fps hardware accelerated)
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  // Quick Click-to-Place Popover State
  const [activeClickCoord, setActiveClickCoord] = useState(null); // { x: 45.2, y: 60.5 }
  const [quickSearchQuery, setQuickSearchQuery] = useState('');
  const [quickFilterTab, setQuickFilterTab] = useState('unplaced'); // 'unplaced' | 'all'
  const [placementFlash, setPlacementFlash] = useState(null); // { x, y }

  // 2. All Ref Hooks
  const dragOriginRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const hasDraggedSignificantlyRef = useRef(false);
  const viewportRef = useRef(null);
  const blueprintGraphicRef = useRef(null);
  const lastFittedPlanIdRef = useRef(null);
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const touchStartTimeRef = useRef(0);
  const pinchInitialDistRef = useRef(0);
  const pinchInitialZoomRef = useRef(1);

  // 3. Derived Variables (Available to all functions and effects below)
  const activePlan = floorPlans.find((fp) => fp.id === selectedPlanId) || floorPlans[0];

  // Devices placed on this floor plan
  const pinnedDevices = devices.filter(
    (d) => d.floor_plan_id === activePlan?.id && d.pos_x !== null && d.pos_y !== null
  );

  // Devices not yet placed on this floor plan
  const unpinnedDevices = devices.filter((d) => !d.floor_plan_id || d.pos_x === null);

  // 4. Auto-fit Callback (Guaranteed that viewportRef, setZoom, setPan are ready)
  const autoFitBlueprint = useCallback((customWidth, customHeight) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const vpWidth = vp.clientWidth || 800;
    const vpHeight = vp.clientHeight || 560;

    const bWidth = customWidth || 2400;
    const bHeight = customHeight || 1600;

    const pad = 48;
    const scaleX = (vpWidth - pad) / bWidth;
    const scaleY = (vpHeight - pad) / bHeight;
    const fitScale = Math.min(scaleX, scaleY);
    const safeZoom = Math.max(0.06, Math.min(1.0, Number(fitScale.toFixed(3))));

    setZoom(safeZoom);
    setPan({ x: 0, y: 0 });
  }, []);

  // Handle dimensions from BlueprintCanvas (high-DPI resolution, up to 5200px)
  const handleDimensionsReady = useCallback((w, h) => {
    setPlanDimensions((prev) => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    if (lastFittedPlanIdRef.current !== activePlan?.id) {
      lastFittedPlanIdRef.current = activePlan?.id;
      autoFitBlueprint(w, h);
    }
  }, [activePlan?.id, autoFitBlueprint]);

  // 5. Effects
  // Sync initial selections
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

  // Keep selectedPlanId valid if plans change or one is deleted
  useEffect(() => {
    if (!floorPlans.some((fp) => fp.id === selectedPlanId) && floorPlans.length > 0) {
      setSelectedPlanId(floorPlans[0].id);
    }
  }, [floorPlans, selectedPlanId]);

  // Non-passive wheel handler: Smooth, guaranteed e.preventDefault() to stop page scroll, supports mouse & trackpad
  const handleWheelZoom = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    const delta = e.deltaY;
    if (Math.abs(delta) < 0.05) return;

    const factor = delta < 0 ? 1.15 : 0.85;
    setZoom((prevZoom) => {
      const nextZoom = Math.max(0.06, Math.min(12.0, Number((prevZoom * factor).toFixed(3))));
      return nextZoom;
    });
  }, []);

  // Callback ref: Attaches wheel listener with { passive: false } the exact moment the element mounts!
  const setViewportRef = useCallback((node) => {
    if (viewportRef.current) {
      viewportRef.current.removeEventListener('wheel', handleWheelZoom);
    }
    viewportRef.current = node;
    if (node) {
      node.addEventListener('wheel', handleWheelZoom, { passive: false });
    }
  }, [handleWheelZoom]);

  // Sync selected device notes & zone
  useEffect(() => {
    if (selectedDevice) {
      setDeviceNotes(selectedDevice.notes || '');
      setDeviceZone(selectedDevice.placement_zone || '');
      setDeviceEstateZone(selectedDevice.zone || '');
      setNotesSavedSuccess(false);
    }
  }, [selectedDevice?.id, selectedDevice?.notes, selectedDevice?.placement_zone, selectedDevice?.zone]);

  // Handlers for Zone & Notes
  const handleUpdateZone = async (newZone) => {
    if (!selectedDevice || newZone === deviceZone || isSavingZone) return;
    try {
      setIsSavingZone(true);
      setDeviceZone(newZone);
      const updatedPayload = {
        ...selectedDevice,
        placement_zone: newZone || null,
      };
      if (onUpdateDevice) {
        await onUpdateDevice(selectedDevice.id, updatedPayload);
      } else {
        await api.updateDevice(selectedDevice.id, updatedPayload);
      }
      setSelectedDevice((prev) => (prev ? { ...prev, placement_zone: newZone || null } : prev));
    } catch (err) {
      alert(err.message || 'Failed to update location zone');
      setDeviceZone(selectedDevice.placement_zone || '');
    } finally {
      setIsSavingZone(false);
    }
  };

  const handleUpdateEstateZone = async (newEstateZone) => {
    if (!selectedDevice || newEstateZone === deviceEstateZone || isSavingEstateZone) return;
    try {
      setIsSavingEstateZone(true);
      setDeviceEstateZone(newEstateZone);
      const updatedPayload = {
        ...selectedDevice,
        zone: newEstateZone || null,
      };
      if (onUpdateDevice) {
        await onUpdateDevice(selectedDevice.id, updatedPayload);
      } else {
        await api.updateDevice(selectedDevice.id, updatedPayload);
      }
      setSelectedDevice((prev) => (prev ? { ...prev, zone: newEstateZone || null } : prev));
    } catch (err) {
      alert(err.message || 'Failed to update estate zone');
      setDeviceEstateZone(selectedDevice.zone || '');
    } finally {
      setIsSavingEstateZone(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedDevice || isSavingNotes) return;
    try {
      setIsSavingNotes(true);
      const updatedPayload = {
        ...selectedDevice,
        notes: deviceNotes,
      };
      if (onUpdateDevice) {
        await onUpdateDevice(selectedDevice.id, updatedPayload);
      } else {
        await api.updateDevice(selectedDevice.id, updatedPayload);
      }
      setSelectedDevice((prev) => (prev ? { ...prev, notes: deviceNotes } : prev));
      setNotesSavedSuccess(true);
      setTimeout(() => setNotesSavedSuccess(false), 2500);
    } catch (err) {
      alert(err.message || 'Failed to save engineering note');
    } finally {
      setIsSavingNotes(false);
    }
  };

  // Zoom controls (multiplicative, natural scaling with event stopping)
  const handleZoomIn = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setZoom((prev) => Math.min(12.0, Number((prev * 1.25).toFixed(3))));
  };

  const handleZoomOut = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setZoom((prev) => Math.max(0.06, Number((prev * 0.80).toFixed(3))));
  };

  const handleResetView = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    autoFitBlueprint();
  };

  // Drag Panning Handlers
  const handleMouseDown = (e) => {
    // Ignore clicks on pins, buttons, inputs, popovers
    if (e.target.closest('.device-pin, .interactive-control, button, input, .quick-assign-popover')) {
      return;
    }
    setIsDragging(true);
    dragOriginRef.current = { x: e.clientX, y: e.clientY };
    panStartRef.current = { x: pan.x, y: pan.y };
    hasDraggedSignificantlyRef.current = false;
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - dragOriginRef.current.x;
    const dy = e.clientY - dragOriginRef.current.y;
    if (Math.hypot(dx, dy) > 5) {
      hasDraggedSignificantlyRef.current = true;
    }
    setPan({
      x: panStartRef.current.x + dx,
      y: panStartRef.current.y + dy,
    });
  };

  const handleMouseUp = (e) => {
    if (!isDragging) return;
    setIsDragging(false);

    // If mouse moved less than 5px, treat as click-to-place!
    if (!hasDraggedSignificantlyRef.current) {
      handleBlueprintClick(e);
    }
  };

  const handleMouseLeave = () => {
    if (isDragging) setIsDragging(false);
  };

  // Multi-Touch Handlers (Mobile & iPad / Tablet Pan + Pinch-to-Zoom)
  const handleTouchStart = (e) => {
    if (e.target.closest('.device-pin, .interactive-control, button, input, .quick-assign-popover')) {
      return;
    }

    if (e.touches.length === 1) {
      setIsDragging(true);
      const t = e.touches[0];
      dragOriginRef.current = { x: t.clientX, y: t.clientY };
      panStartRef.current = { x: pan.x, y: pan.y };
      touchStartPosRef.current = { x: t.clientX, y: t.clientY };
      touchStartTimeRef.current = Date.now();
      hasDraggedSignificantlyRef.current = false;
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      pinchInitialDistRef.current = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      pinchInitialZoomRef.current = zoom;
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 1 && isDragging) {
      const t = e.touches[0];
      const dx = t.clientX - dragOriginRef.current.x;
      const dy = t.clientY - dragOriginRef.current.y;
      if (Math.hypot(dx, dy) > 8) {
        hasDraggedSignificantlyRef.current = true;
      }
      setPan({
        x: panStartRef.current.x + dx,
        y: panStartRef.current.y + dy,
      });
    } else if (e.touches.length === 2 && pinchInitialDistRef.current > 0) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      const scaleFactor = currentDist / pinchInitialDistRef.current;
      const newZoom = Math.max(0.06, Math.min(12.0, Number((pinchInitialZoomRef.current * scaleFactor).toFixed(3))));
      setZoom(newZoom);
    }
  };

  const handleTouchEnd = (e) => {
    if (e.touches.length === 0) {
      const duration = Date.now() - touchStartTimeRef.current;
      setIsDragging(false);
      pinchInitialDistRef.current = 0;

      // Quick tap on blueprint without dragging
      if (!hasDraggedSignificantlyRef.current && duration < 350) {
        handleBlueprintClick({
          clientX: touchStartPosRef.current.x,
          clientY: touchStartPosRef.current.y,
        });
      }
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      dragOriginRef.current = { x: t.clientX, y: t.clientY };
      panStartRef.current = { x: pan.x, y: pan.y };
      setIsDragging(true);
      pinchInitialDistRef.current = 0;
    }
  };

  // Click anywhere on blueprint to place or open quick placement dialog
  const handleBlueprintClick = (e) => {
    if (!blueprintGraphicRef.current || !activePlan) return;

    const rect = blueprintGraphicRef.current.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;

    const clampedX = Math.max(1, Math.min(99, Math.round(rawX * 10) / 10));
    const clampedY = Math.max(1, Math.min(99, Math.round(rawY * 10) / 10));

    // Case A: User already picked a device from staging drawer
    if (deviceToPlace) {
      onUpdatePosition(deviceToPlace.id, {
        floor_plan_id: activePlan.id,
        pos_x: clampedX,
        pos_y: clampedY,
      });
      triggerPlacementFlash(clampedX, clampedY);
      setSelectedDevice(deviceToPlace);
      setDeviceToPlace(null);
      return;
    }

    // Case B: Click-to-place popover dialog opens right at this point
    setActiveClickCoord({ x: clampedX, y: clampedY });
    setQuickSearchQuery('');
    setQuickFilterTab('unplaced');
  };

  const triggerPlacementFlash = (x, y) => {
    setPlacementFlash({ x, y });
    setTimeout(() => setPlacementFlash(null), 1800);
  };

  // Assign chosen device to active clicked coordinate
  const handleAssignDeviceToCoord = (device) => {
    if (!activeClickCoord || !activePlan) return;

    onUpdatePosition(device.id, {
      floor_plan_id: activePlan.id,
      pos_x: activeClickCoord.x,
      pos_y: activeClickCoord.y,
    });

    triggerPlacementFlash(activeClickCoord.x, activeClickCoord.y);
    setSelectedDevice(device);
    setActiveClickCoord(null);
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

  const handleDeleteActiveFloorPlan = () => {
    if (!activePlan) return;
    const planName = isKu ? (activePlan.name_ku || activePlan.name) : activePlan.name;
    const msg = isKu
      ? `ئایا دڵنیایت لە سڕینەوەی ئەم نەخشەیە: "${planName}"؟\nدیڤایسەکانی سەر ئەم نەخشەیە لە ماپ لادەبرێن بەڵام لە سیستەم نامێننەوە.`
      : `Are you sure you want to delete "${planName}"?\nPinned devices on this floor plan will be unpinned.`;

    if (!window.confirm(msg)) return;
    if (onDeleteFloorPlan) {
      onDeleteFloorPlan(activePlan.id);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{t.mapTitle}</h2>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30 font-mono">
              Vector 60FPS
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400">{t.mapSubtitle}</p>
        </div>
      </div>

      {/* Mobile & iPad Segmented View Switcher (lg:hidden) */}
      <div className="lg:hidden flex items-center p-1 bg-slate-900 border border-slate-800 rounded-2xl shadow-lg gap-1">
        <button
          type="button"
          onClick={() => setMobileActiveView('canvas')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition ${
            mobileActiveView === 'canvas'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Crosshair className="w-3.5 h-3.5" />
          <span>{isKu ? 'نەخشە' : 'Map Canvas'}</span>
          <span className="text-[10px] font-mono opacity-80 font-bold">({pinnedDevices.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileActiveView('plans')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition ${
            mobileActiveView === 'plans'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>{isKu ? 'پلانەکان' : 'Floor Plans'}</span>
          <span className="text-[10px] font-mono opacity-80 font-bold">({floorPlans.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileActiveView('devices')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold transition ${
            mobileActiveView === 'devices'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Cpu className="w-3.5 h-3.5" />
          <span>{isKu ? 'ئامێرەکان' : 'Equipment'}</span>
          <span className="text-[10px] font-mono opacity-80 font-bold">({unpinnedDevices.length})</span>
        </button>
      </div>

      {/* 3-Column Studio Layout: Floor Plans Sidebar (Left) | Canvas (Center) | Device Tray (Right) */}
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* 1. Left Sidebar: Floor Plans List (Fixed Height, Scrollable Window) */}
        <div className={`w-full lg:w-64 xl:w-72 shrink-0 bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 shadow-xl flex-col h-[700px] ${
          mobileActiveView === 'plans' ? 'flex' : 'hidden lg:flex'
        }`}>
          {/* Header & Add Blueprint Button */}
          <div className="space-y-3 pb-3 border-b border-slate-800/80 shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white tracking-tight">
                  {isKu ? 'نەخشەکانی بینا' : 'Floor Plans'}
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                {floorPlans.length}
              </span>
            </div>

            <button
              onClick={() => setIsAddPlanModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-900/30 transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>{isKu ? '+ نەخشەی نوێ (PDF / وێنە)' : '+ Add Blueprint (PDF / Img)'}</span>
            </button>

            {/* Quick Estate Zone Filter: All, Main Villa, Guest House, Service Area */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 pt-1">
              <button
                type="button"
                onClick={() => setSelectedZoneFilter('all')}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition ${
                  selectedZoneFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {isKu ? 'گشت' : 'All'}
              </button>
              {estateZones.map((ez) => (
                <button
                  key={ez.id}
                  type="button"
                  onClick={() => setSelectedZoneFilter(ez.id)}
                  className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition ${
                    selectedZoneFilter === ez.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {isKu ? (ez.labelKu || ez.label) : (ez.label || ez.labelKu)}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable Floor Plans List inside Fixed Window */}
          <div className="flex-1 overflow-y-auto space-y-2 pt-3 pr-1 custom-scrollbar">
            {floorPlans.filter((fp) => selectedZoneFilter === 'all' || fp.zone === selectedZoneFilter).length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 italic">
                {isKu ? 'هیچ نەخشەیەک بەردەست نییە' : 'No floor plans available'}
              </div>
            ) : (
              floorPlans
                .filter((fp) => selectedZoneFilter === 'all' || fp.zone === selectedZoneFilter)
                .map((fp) => {
                const isActive = fp.id === activePlan?.id;
                const planDeviceCount = devices.filter((d) => d.floor_plan_id === fp.id).length;
                const zoneBadgeClass = isActive
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700/60';

                return (
                  <div
                    key={fp.id}
                    onClick={() => {
                      setSelectedPlanId(fp.id);
                      setSelectedDevice(null);
                      setDeviceToPlace(null);
                      setActiveClickCoord(null);
                      setMobileActiveView('canvas');
                    }}
                    role="button"
                    tabIndex={0}
                    className={`w-full text-left p-3 rounded-xl border transition group relative cursor-pointer ${
                      isActive
                        ? 'bg-blue-600/15 border-blue-500/80 text-white shadow-md shadow-blue-950/50 ring-1 ring-blue-500/40'
                        : 'bg-slate-950/50 border-slate-800/80 text-slate-300 hover:bg-slate-800/60 hover:border-slate-700 hover:text-white'
                    }`}
                  >
                    {/* Active Indicator Bar */}
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-1 bg-blue-500 rounded-r-full" />
                    )}

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-bold text-white leading-tight">
                            {isKu ? (fp.name_ku || fp.name) : fp.name}
                          </p>
                          {fp.floor_level !== undefined && fp.floor_level !== null && (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0">
                              {formatFloorLevel(fp.floor_level, lang)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap mt-1">
                          {fp.zone && (
                            <span className="text-[10px] text-slate-400 font-medium inline-flex items-center gap-0.5">
                              <Building2 className="w-2.5 h-2.5 text-blue-400" />
                              <span>{formatEstateZone(fp.zone, lang)}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Zone Type Badge */}
                      {fp.zone_type ? (
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border uppercase tracking-wider shrink-0 ${zoneBadgeClass}`}>
                          {formatZone(fp.zone_type, lang)}
                        </span>
                      ) : null}
                    </div>

                    {/* Metadata Footer: Pin count + Edit / Delete Action Buttons */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-1.5 border-t border-slate-800/60">
                      <span className="flex items-center gap-1 font-mono text-[10px]">
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-blue-400' : 'bg-slate-500'}`} />
                        {planDeviceCount} {isKu ? 'ئامێر' : 'pins'}
                      </span>

                      {/* Action buttons (Edit & Delete) */}
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingPlan(fp);
                            setIsEditPlanModalOpen(true);
                          }}
                          title={isKu ? 'دەستکاریکردنی نەخشە، ناو، و وێنە' : 'Edit floor plan details & image'}
                          className="p-1 text-slate-400 hover:text-blue-400 hover:bg-blue-500/20 rounded-md transition"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {onDeleteFloorPlan && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const planTitle = isKu ? (fp.name_ku || fp.name) : fp.name;
                              const confirmMsg = isKu
                                ? `ئایا دڵنیایت لە سڕینەوەی ئەم نەخشەیە: "${planTitle}"؟\nدیڤایسەکانی سەر ئەم نەخشەیە لادەبرێن.`
                                : `Are you sure you want to delete "${planTitle}"?`;
                              if (window.confirm(confirmMsg)) {
                                onDeleteFloorPlan(fp.id);
                                if (selectedPlanId === fp.id) {
                                  const remaining = floorPlans.filter((p) => p.id !== fp.id);
                                  setSelectedPlanId(remaining[0]?.id || '');
                                }
                              }
                            }}
                            title={isKu ? 'سڕینەوەی نەخشە' : 'Delete floor plan'}
                            className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-500/20 rounded-md transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* 2. Center: Interactive Blueprint Canvas */}
        <div className={`flex-1 min-w-0 w-full space-y-3 ${
          mobileActiveView === 'canvas' ? 'block' : 'hidden lg:block'
        }`}>
          {/* Mobile & iPad Quick Floor Plan Pill Selector */}
          <div className="lg:hidden flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none touch-pan-x">
            {floorPlans.map((fp) => {
              const isAct = fp.id === activePlan?.id;
              return (
                <button
                  key={fp.id}
                  onClick={() => {
                    setSelectedPlanId(fp.id);
                    setSelectedDevice(null);
                    setDeviceToPlace(null);
                    setActiveClickCoord(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 shrink-0 border ${
                    isAct
                      ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/30'
                      : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isAct ? 'bg-white' : 'bg-slate-500'}`} />
                  <span>{isKu ? (fp.name_ku || fp.name) : fp.name}</span>
                  {fp.floor_level !== undefined && fp.floor_level !== null && (
                    <span className="text-[10px] font-mono opacity-80">
                      ({formatShortFloorLevel(fp.floor_level, lang)})
                    </span>
                  )}
                </button>
              );
            })}
            <button
              onClick={() => setIsAddPlanModalOpen(true)}
              className="px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap bg-slate-900 hover:bg-slate-800 text-blue-400 border border-slate-800 shrink-0 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isKu ? 'نوێ' : 'Add'}</span>
            </button>
          </div>

          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 px-4 py-2.5 rounded-2xl shadow-md">
            <div className="flex items-center gap-2.5 text-xs text-slate-300">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="font-semibold text-white">
                {activePlan ? (isKu ? (activePlan.name_ku || activePlan.name) : activePlan.name) : 'No Plan Selected'}
              </span>
              {activePlan?.floor_level !== undefined && activePlan?.floor_level !== null && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {formatFloorLevel(activePlan.floor_level, lang)}
                </span>
              )}
              <span className="text-slate-600">|</span>
              <span className="text-blue-400 font-mono font-bold">
                {pinnedDevices.length} {isKu ? 'ئامێر جێگیرکراوە' : 'pins placed'}
              </span>
            </div>

            {/* Hint & Navigation Tools */}
            <div className="flex items-center gap-2">
              {deviceToPlace && (
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-600/20 border border-blue-500/40 rounded-xl text-xs text-blue-300 animate-pulse">
                  <span>
                    {isKu ? 'کلیک لە نەخشەکە بکە بۆ جێگیرکردنی:' : 'Click layout to anchor:'}{' '}
                    <strong>{deviceToPlace.custom_label_id}</strong>
                  </span>
                  <button onClick={() => setDeviceToPlace(null)} className="text-blue-400 hover:text-white p-0.5">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 bg-slate-950/70 rounded-xl border border-slate-800 text-[11px] text-slate-400">
                <Move className="w-3 h-3 text-blue-400" />
                <span>{isKu ? 'ڕابکێشە بۆ جووڵە • زووم بکە بە ٢ پەنجە' : 'Drag to pan • 2-finger zoom'}</span>
              </div>

              {/* Zoom Buttons */}
              <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={handleZoomOut}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 transition"
                  title={t.zoomOut}
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="px-1.5 text-[11px] font-mono text-blue-400 font-bold min-w-[42px] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 transition"
                  title={t.zoomIn}
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <button
                  onClick={handleResetView}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-300 transition"
                  title={isKu ? 'پیشاندانی هەموو نەخشەکە بە تەواوی لەسەر شاشە' : 'Fit Entire Blueprint to Screen (100% visible)'}
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Edit Active Floor Plan Button */}
              {activePlan && (
                <button
                  onClick={() => {
                    setEditingPlan(activePlan);
                    setIsEditPlanModalOpen(true);
                  }}
                  title={isKu ? 'دەستکاریکردنی نەخشە، ناو، و وێنەی بلوپرینت' : 'Edit floor plan name & blueprint image'}
                  className="px-2.5 py-1.5 text-slate-300 hover:text-blue-400 hover:bg-blue-500/10 rounded-xl border border-slate-800 hover:border-blue-500/30 transition flex items-center gap-1.5 text-xs font-semibold"
                >
                  <Pencil className="w-3.5 h-3.5 text-blue-400" />
                  <span className="hidden sm:inline">{isKu ? 'دەستکاری نەخشە' : 'Edit Blueprint'}</span>
                </button>
              )}

              {/* Delete Active Floor Plan */}
              {activePlan && onDeleteFloorPlan && (
                <button
                  onClick={handleDeleteActiveFloorPlan}
                  title={isKu ? 'سڕینەوەی ئەم نەخشەیە' : 'Delete this floor plan'}
                  className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl border border-transparent hover:border-red-500/20 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Map Surface Viewport with Silky Smooth Pan & Multi-Touch Zoom (iPad / Mobile Optimized) */}
          <div
            ref={setViewportRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{ touchAction: 'none' }}
            className={`relative overflow-hidden bg-slate-950 border border-slate-800 rounded-2xl min-h-[420px] h-[55vh] sm:min-h-[520px] sm:h-[62vh] lg:h-[640px] shadow-2xl select-none ${
              isDragging ? 'cursor-grabbing' : deviceToPlace ? 'cursor-crosshair' : 'cursor-grab'
            }`}
          >
            {activePlan ? (
              <div
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
                  transformOrigin: 'center center',
                  willChange: 'transform',
                }}
                className="transition-transform duration-75 select-none"
              >
                {/* Floor Plan Architectural Graphic Container (Full uncropped blueprint view) */}
                <div
                  ref={blueprintGraphicRef}
                  style={{
                    width: `${planDimensions.width}px`,
                    height: `${planDimensions.height}px`,
                    transformStyle: 'preserve-3d',
                    backfaceVisibility: 'hidden',
                  }}
                  className="relative rounded-xl overflow-hidden shadow-2xl bg-white border border-slate-700/80"
                >
                  <BlueprintCanvas
                    activePlan={activePlan}
                    zoom={zoom}
                    onDimensionsReady={handleDimensionsReady}
                  />
                  <div className="absolute inset-0 bg-slate-950/5 pointer-events-none" />

                  {/* Architectural Grid Overlay */}
                  <div
                    className="absolute inset-0 opacity-15 pointer-events-none"
                    style={{
                      backgroundImage:
                        'linear-gradient(to right, #3b82f6 1px, transparent 1px), linear-gradient(to bottom, #3b82f6 1px, transparent 1px)',
                      backgroundSize: '40px 40px',
                    }}
                  />

                  {/* Placement Ripple Flash Animation */}
                  {placementFlash && (
                    <div
                      style={{ left: `${placementFlash.x}%`, top: `${placementFlash.y}%` }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30 flex items-center justify-center"
                    >
                      <span className="w-12 h-12 rounded-full border-2 border-emerald-400 bg-emerald-500/30 animate-ping" />
                      <Sparkles className="w-5 h-5 text-emerald-300 absolute animate-bounce" />
                    </div>
                  )}

                  {/* Active Selected Coordinate Target Reticle */}
                  {activeClickCoord && (
                    <div
                      style={{ left: `${activeClickCoord.x}%`, top: `${activeClickCoord.y}%` }}
                      className="absolute -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none"
                    >
                      <div className="w-10 h-10 rounded-full border-2 border-dashed border-blue-400 bg-blue-500/20 animate-spin" />
                      <div className="w-3 h-3 bg-blue-400 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-lg shadow-blue-500/50" />
                    </div>
                  )}

                  {/* Interactive Device Pins with Dynamic ICT Icons */}
                  {pinnedDevices.map((dev) => {
                    const model = boqModels.find((m) => m.id === dev.boq_model_id);
                    const category = model ? categories.find((c) => c.id === model.category_id) : null;
                    const isSelected = selectedDevice?.id === dev.id;
                    const DevIcon = getIctDeviceIcon(dev, model, category);

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
                          setActiveClickCoord(null);
                        }}
                        style={{ left: `${dev.pos_x}%`, top: `${dev.pos_y}%` }}
                        className="device-pin absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer group z-20 flex flex-col items-center select-none"
                      >
                        {/* Status Ring & ICT Device Icon */}
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-transform duration-200 group-hover:scale-125 ${
                            isSelected ? 'scale-125 ring-4 ring-blue-500/40' : ''
                          }`}
                          style={{
                            backgroundColor: '#0f172a',
                            border: `2.5px solid ${statusColor}`,
                            boxShadow: isSelected ? `0 0 18px ${statusColor}` : '0 4px 10px rgba(0,0,0,0.6)',
                          }}
                        >
                          <DevIcon className="w-4 h-4 text-white drop-shadow" />
                        </div>

                        {/* Persistent High-Contrast Label Pill Under Pin */}
                        <div className="mt-1 px-1.5 py-0.5 rounded-md bg-slate-950/95 border border-slate-700/80 shadow-md pointer-events-none whitespace-nowrap">
                          <span className="text-[9px] font-bold font-mono text-slate-200 tracking-tight block leading-none">
                            {dev.custom_label_id}
                          </span>
                        </div>

                        {/* Rich Hover / Touch Tooltip */}
                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:flex flex-col items-center pointer-events-none whitespace-nowrap z-30">
                          <div className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl text-center space-y-0.5">
                            <div className="flex items-center justify-center gap-1.5">
                              <DevIcon className="w-3.5 h-3.5 text-blue-400" />
                              <p className="text-xs font-bold font-mono text-white">{dev.custom_label_id}</p>
                            </div>
                            <p className="text-[10px] text-blue-300 font-mono">{dev.ip_address || 'No IP'}</p>
                            <p className="text-[10px] text-slate-400">{model ? `${model.brand} ${model.model}` : ''}</p>
                          </div>
                          <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1 border-r border-b border-slate-700" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center p-8 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-blue-400">
                  <FileText className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {isKu ? 'هیچ نەخشە یان سایت پلانێک دانەنراوە' : 'No Floor Plans Available'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    {isKu
                      ? 'فایلی PDF ی ئەندازیاری بیناکە یان وێنەی پلانەکە ئاپلۆد بکە بۆ دانانی ئامێرەکان'
                      : 'Upload an architectural PDF blueprint or image to place and track devices visually'}
                  </p>
                </div>
                <button
                  onClick={() => setIsAddPlanModalOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg transition active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isKu ? 'ئەپلۆدکردنی نەخشە بە PDF' : 'Upload Blueprint (PDF)'}</span>
                </button>
              </div>
            )}

            {/* Quick Click-to-Place Popover Dialog */}
            {activeClickCoord && (
              <div
                className="quick-assign-popover absolute z-50 bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:w-96 bg-slate-900/95 backdrop-blur-md border border-blue-500/40 rounded-2xl p-4 shadow-2xl space-y-3 animate-fadeIn"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-white">
                    <Crosshair className="w-4 h-4 text-blue-400" />
                    <span>{isKu ? 'جێگیرکردنی ئامێر لەم خاڵە' : 'Place Device At This Point'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                      X: {activeClickCoord.x}% Y: {activeClickCoord.y}%
                    </span>
                    <button
                      onClick={() => setActiveClickCoord(null)}
                      className="text-slate-400 hover:text-white p-0.5 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Search & Tabs */}
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      value={quickSearchQuery}
                      onChange={(e) => setQuickSearchQuery(e.target.value)}
                      placeholder={isKu ? 'گەڕان بەپێی ناوی ئامێر یان مۆدێل...' : 'Search device label or model...'}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800/80">
                    <button
                      type="button"
                      onClick={() => setQuickFilterTab('unplaced')}
                      className={`flex-1 py-1 rounded-lg text-xs font-semibold transition ${
                        quickFilterTab === 'unplaced'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {isKu ? 'دانەنراوەکان' : 'Unplaced'} ({unpinnedDevices.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickFilterTab('all')}
                      className={`flex-1 py-1 rounded-lg text-xs font-semibold transition ${
                        quickFilterTab === 'all'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {isKu ? 'هەموو ئامێرەکان' : 'All Devices'} ({devices.length})
                    </button>
                  </div>
                </div>

                {/* Filtered Device List */}
                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                  {(() => {
                    const sourceList = quickFilterTab === 'unplaced' ? unpinnedDevices : devices;
                    const filtered = sourceList.filter((dev) => {
                      if (!quickSearchQuery) return true;
                      const q = quickSearchQuery.toLowerCase();
                      const model = boqModels.find((m) => m.id === dev.boq_model_id);
                      return (
                        dev.custom_label_id?.toLowerCase().includes(q) ||
                        dev.ip_address?.toLowerCase().includes(q) ||
                        model?.model?.toLowerCase().includes(q) ||
                        model?.brand?.toLowerCase().includes(q)
                      );
                    });

                    if (filtered.length === 0) {
                      return (
                        <div className="p-4 text-center text-xs text-slate-500 italic">
                          {isKu ? 'هیچ ئامێرێک نەدۆزرایەوە' : 'No matching devices found'}
                        </div>
                      );
                    }

                    return filtered.map((dev) => {
                      const model = boqModels.find((m) => m.id === dev.boq_model_id);
                      const category = model ? categories.find((c) => c.id === model.category_id) : null;
                      const DevIcon = getIctDeviceIcon(dev, model, category);
                      const isAlreadyPinned = dev.floor_plan_id && dev.pos_x !== null;

                      return (
                        <div
                          key={dev.id}
                          onClick={() => handleAssignDeviceToCoord(dev)}
                          className="p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-800 border border-slate-800 hover:border-blue-500/50 cursor-pointer transition flex items-center justify-between gap-2.5 group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 truncate">
                            <div className="w-8 h-8 rounded-lg bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 shadow-sm">
                              <DevIcon className="w-4 h-4" />
                            </div>
                            <div className="truncate min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs text-white font-mono group-hover:text-blue-400 transition truncate">
                                  {dev.custom_label_id}
                                </span>
                                {isAlreadyPinned && (
                                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-400 font-mono shrink-0">
                                    {isKu ? 'لەسەر نەخشەیە' : 'Pinned'}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 block truncate">
                                {model ? `${model.brand} ${model.model}` : 'ELV Hardware'} • {dev.ip_address || 'No IP'}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-semibold shrink-0 shadow transition"
                          >
                            {isKu ? 'جێگیرکردن' : 'Pin Here'}
                          </button>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 3. Right Sidebar: Staging Tray & Device Inspector (Mobile & iPad Drawer Supported) */}
        <div className={`w-full lg:w-72 xl:w-80 shrink-0 space-y-4 ${
          mobileActiveView === 'devices' || (mobileActiveView === 'canvas' && selectedDevice) ? 'block' : 'hidden lg:block'
        }`}>
          {/* Selected Device Inspector Drawer */}
          {selectedDevice ? (
            <div className="bg-slate-900/95 border border-blue-500/40 rounded-2xl p-4 shadow-xl space-y-4 animate-fadeIn">
              {(() => {
                const model = boqModels.find((m) => m.id === selectedDevice.boq_model_id) || selectedDevice.boq_model;
                const category = model ? categories.find((c) => c.id === model.category_id) : null;
                const DevIcon = getIctDeviceIcon(selectedDevice, model, category);

                return (
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 shadow-sm">
                        <DevIcon className="w-5 h-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-400">
                          {t.inspectTitle} {category ? `• ${isKu ? (category.name_ku || category.name) : category.name}` : ''}
                        </span>
                        <h3 className="text-base font-bold text-white font-mono">{selectedDevice.custom_label_id}</h3>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedDevice(null)}
                      className="text-slate-400 hover:text-white p-1 rounded-lg"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })()}

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

              {/* Coordinates Pill */}
              <div className="flex items-center justify-between p-2 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono">
                <span className="text-slate-400">Blueprint Position:</span>
                <span className="text-blue-400 font-bold">
                  X: {selectedDevice.pos_x ?? '—'}% / Y: {selectedDevice.pos_y ?? '—'}%
                </span>
              </div>

              {/* Status Badge */}
              <div className="flex items-center justify-between p-2.5 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-xs text-slate-400">Installation Status:</span>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                  {selectedDevice.installation_status}
                </span>
              </div>

              {/* 1. Estate Zone Selector (Main Villa / Guest House / Service Area) */}
              <div className="p-3 bg-slate-950/90 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>{isKu ? 'زۆن (Zone)' : 'Zone (Building)'}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {isSavingEstateZone && (
                      <span className="text-[10px] text-blue-400 animate-pulse font-mono">
                        {isKu ? 'تۆمارکردن...' : 'Saving...'}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsEstateZoneModalOpen(true)}
                      className="text-[11px] text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1 transition"
                    >
                      <Settings2 className="w-3 h-3" />
                      <span>{isKu ? 'دەستکاری' : 'Manage'}</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => handleUpdateEstateZone('')}
                    disabled={isSavingEstateZone}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition active:scale-95 ${
                      !deviceEstateZone
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30 font-bold border border-blue-400'
                        : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    <span>—</span>
                    <span>{isKu ? 'بێ زۆن' : 'No Zone'}</span>
                  </button>

                  {estateZones.map((ez) => {
                    const isSelected = deviceEstateZone === ez.id || deviceEstateZone === ez.label;
                    return (
                      <button
                        key={ez.id}
                        type="button"
                        onClick={() => handleUpdateEstateZone(ez.id)}
                        disabled={isSavingEstateZone}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition active:scale-95 ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30 font-bold border border-blue-400'
                            : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                        }`}
                      >
                        <Building2 className="w-3 h-3 opacity-70" />
                        <span>{isKu ? (ez.labelKu || ez.label) : (ez.label || ez.labelKu)}</span>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setIsEstateZoneModalOpen(true)}
                    className="px-2 py-1.5 rounded-lg text-xs text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-600/30 border border-blue-500/30 flex items-center gap-1 transition"
                    title={isKu ? 'زیادکردنی زۆنی نوێ' : 'Add new zone'}
                  >
                    <Plus className="w-3 h-3" />
                    <span>{isKu ? 'نوێ' : 'New'}</span>
                  </button>
                </div>
              </div>

              {/* Location Zone Selector (Dynamic Custom Zones) */}
              <div className="p-3 bg-slate-950/90 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-blue-400" />
                    <span>{isKu ? 'شوێنی دیڤایس (Location Zone)' : 'Location Zone'}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    {isSavingZone && (
                      <span className="text-[10px] text-blue-400 animate-pulse font-mono">
                        {isKu ? 'تۆمارکردن...' : 'Saving...'}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsZoneModalOpen(true)}
                      className="text-[11px] text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-1 transition"
                    >
                      <Settings2 className="w-3 h-3" />
                      <span>{isKu ? 'دەستکاری زۆنەکان' : 'Manage Zones'}</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {/* None / Unassigned option */}
                  <button
                    type="button"
                    onClick={() => handleUpdateZone('')}
                    disabled={isSavingZone}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition active:scale-95 ${
                      !deviceZone
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30 font-bold border border-blue-400'
                        : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    <span>—</span>
                    <span>{isKu ? 'بێ دیاریکردن' : 'None / Unset'}</span>
                  </button>

                  {/* All available custom & system zones */}
                  {zones.map((z) => {
                    const isSelected = deviceZone === z.id;
                    const iconEmoji =
                      z.id === 'indoor'
                        ? '🏠'
                        : z.id === 'outdoor'
                        ? '🌳'
                        : z.id === 'rack'
                        ? '🗄️'
                        : z.id === 'safe_room'
                        ? '🛡️'
                        : '📍';

                    return (
                      <button
                        key={z.id}
                        type="button"
                        onClick={() => handleUpdateZone(z.id)}
                        disabled={isSavingZone}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition active:scale-95 ${
                          isSelected
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30 font-bold border border-blue-400'
                            : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
                        }`}
                      >
                        <span>{iconEmoji}</span>
                        <span>{isKu ? (z.labelKu || z.label) : (z.label || z.labelKu)}</span>
                      </button>
                    );
                  })}

                  {/* Quick Add Custom Zone Button */}
                  <button
                    type="button"
                    onClick={() => setIsZoneModalOpen(true)}
                    className="px-2 py-1.5 rounded-lg text-xs text-blue-400 hover:text-white bg-blue-500/10 hover:bg-blue-600/30 border border-blue-500/30 flex items-center gap-1 transition"
                    title={isKu ? 'زیادکردنی زۆنی نوێ' : 'Add new zone'}
                  >
                    <Plus className="w-3 h-3" />
                    <span>{isKu ? 'نوێ' : 'New'}</span>
                  </button>
                </div>
              </div>

              {/* Engineering Notes Section */}
              <div className="p-3 bg-slate-950/90 rounded-xl border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                    <span>{isKu ? 'تێبینی ئەندازیاری' : 'Engineering Notes'}</span>
                  </label>
                  {notesSavedSuccess && (
                    <span className="text-[10px] text-blue-400 font-semibold flex items-center gap-1 animate-fadeIn">
                      <Check className="w-3 h-3" />
                      <span>{isKu ? 'تێبینی سەیڤ کرا!' : 'Note Saved!'}</span>
                    </span>
                  )}
                </div>

                <textarea
                  rows={3}
                  value={deviceNotes}
                  onChange={(e) => {
                    setDeviceNotes(e.target.value);
                    setNotesSavedSuccess(false);
                  }}
                  placeholder={
                    isKu
                      ? 'تێبینی لەسەر ئەم ئامێرە لێرە بنووسە (بۆ نموونە: شوێنی دانان، ژمارەی کێبڵ، بەرزی، لای دەرگا...)'
                      : 'Write engineering notes here (e.g. drop #14, mounting height, PoE requirement)...'
                  }
                  className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none resize-none transition"
                />

                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={isSavingNotes || deviceNotes === (selectedDevice.notes || '')}
                    onClick={handleSaveNotes}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white shadow transition active:scale-95"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>
                      {isSavingNotes
                        ? (isKu ? 'تۆمارکردن...' : 'Saving...')
                        : (isKu ? 'سەیڤکردنی تێبینی' : 'Save Note')}
                    </span>
                  </button>
                </div>
              </div>

              {/* Specs Grid */}
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between p-2 bg-slate-950/60 rounded-lg">
                  <span className="text-slate-400">IP Address:</span>
                  <span className="text-blue-400 font-bold">{selectedDevice.ip_address || 'Unassigned'}</span>
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
                  <span className="text-slate-200 truncate">
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
                  <Activity className={`w-3.5 h-3.5 ${pingStatus === 'testing' ? 'animate-spin text-blue-400' : 'text-blue-400'}`} />
                  <span>{pingStatus === 'testing' ? 'Pinging ICMP...' : t.testPing}</span>
                </button>

                {pingStatus && pingStatus !== 'testing' && (
                  <div className={`mt-2 p-2 rounded-lg text-[11px] font-mono text-center border ${
                    pingStatus.ok ? 'bg-blue-950/40 border-blue-800/40 text-blue-300' : 'bg-red-950/40 border-red-800/40 text-red-300'
                  }`}>
                    {pingStatus.ok ? `Reply from ${pingStatus.ip}: time=${pingStatus.latency}ms TTL=64` : `Request timed out (Host Unreachable)`}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <button
                  onClick={() => onOpenTroubleshoot(selectedDevice)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-blue-600/15 hover:bg-blue-600/25 text-blue-300 border border-blue-500/30 transition active:scale-95"
                >
                  <Bot className="w-3.5 h-3.5 text-blue-400" />
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
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {isKu
                  ? 'لەسەر هەر ئامێرێک کلیک بکە یان ڕاستەوخۆ لەسەر نەخشەکە لە هەر خاڵێک کلیک بکە بۆ جێگیرکردن.'
                  : 'Click a device below or click anywhere on the blueprint directly to anchor pins.'}
              </p>

              <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1">
                {unpinnedDevices.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500 italic">
                    {isKu ? 'هەموو دیڤایسەکان لەسەر نەخشە جێگیرکراون!' : 'All devices are currently pinned to maps!'}
                  </div>
                ) : (
                  unpinnedDevices.map((dev) => {
                    const model = boqModels.find((m) => m.id === dev.boq_model_id);
                    const category = model ? categories.find((c) => c.id === model.category_id) : null;
                    const DevIcon = getIctDeviceIcon(dev, model, category);
                    const isSelectedForPlacement = deviceToPlace?.id === dev.id;

                    return (
                      <div
                        key={dev.id}
                        onClick={() => {
                          setDeviceToPlace(isSelectedForPlacement ? null : dev);
                          setActiveClickCoord(null);
                        }}
                        className={`p-3 rounded-xl border cursor-pointer transition flex items-center justify-between gap-2.5 ${
                          isSelectedForPlacement
                            ? 'bg-blue-600/20 border-blue-500 text-white shadow-md'
                            : 'bg-slate-950/70 border-slate-800/80 hover:border-slate-700 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                            isSelectedForPlacement
                              ? 'bg-blue-600 text-white border-blue-400'
                              : 'bg-slate-900 border-slate-800 text-blue-400'
                          }`}>
                            <DevIcon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold font-mono text-white truncate">{dev.custom_label_id}</p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {model ? `${model.brand} ${model.model}` : 'ELV Unit'}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-800 text-blue-400 shrink-0">
                          {isSelectedForPlacement ? (isKu ? 'جێگیرکردن...' : 'Placing...') : (isKu ? '+ دانان' : 'Pin +')}
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

      {/* Edit Site Plan / Floor Plan Modal */}
      <AddFloorPlanModal
        isOpen={isEditPlanModalOpen}
        onClose={() => {
          setIsEditPlanModalOpen(false);
          setEditingPlan(null);
        }}
        planToEdit={editingPlan}
        onUpdateFloorPlan={onUpdateFloorPlan}
        onDeleteFloorPlan={(id) => {
          if (onDeleteFloorPlan) {
            onDeleteFloorPlan(id);
            if (selectedPlanId === id) {
              const remaining = floorPlans.filter((p) => p.id !== id);
              setSelectedPlanId(remaining[0]?.id || '');
            }
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
    </div>
  );
}
