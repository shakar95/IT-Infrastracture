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
  Shield,
  Network,
} from 'lucide-react';
import { translations } from '../i18n/translations';
import AddFloorPlanModal from './AddFloorPlanModal';
import ZoneEditorModal from './ZoneEditorModal';
import EstateZoneEditorModal from './EstateZoneEditorModal';
import RackManagerModal from './RackManagerModal';
import BlueprintCanvas from './BlueprintCanvas';
import { api } from '../services/api';
import { getIctDeviceIcon } from '../utils/ictIcons';
import { useZones } from '../utils/zoneManager';
import { useEstateZones } from '../utils/estateZoneManager';
import { useRacks } from '../utils/rackManager';
import { usePlanTypes, getPlanTypeMeta } from '../utils/planTypeManager';
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
  const { racks, updateRackPosition, unpinRack } = useRacks(devices);
  const { planTypes, formatPlanType, getPlanTypeMeta } = usePlanTypes();
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [isEstateZoneModalOpen, setIsEstateZoneModalOpen] = useState(false);
  const [isRackModalOpen, setIsRackModalOpen] = useState(false);
  const [selectedZoneFilter, setSelectedZoneFilter] = useState('all');
  const [selectedPlanTypeFilter, setSelectedPlanTypeFilter] = useState('all'); // 'all' | 'ICT' | 'Security' | 'AV' | 'BMS'

  // 1. All State Hooks
  const [selectedPlanId, setSelectedPlanId] = useState(initialSelectedPlanId || floorPlans[0]?.id || '');
  const [selectedDevice, setSelectedDevice] = useState(initialSelectedDevice || null);
  const [selectedRack, setSelectedRack] = useState(null);
  const [pingStatus, setPingStatus] = useState(null);
  const [deviceToPlace, setDeviceToPlace] = useState(null);
  const [isPlacementMode, setIsPlacementMode] = useState(false);
  const [selectedDeviceToAssign, setSelectedDeviceToAssign] = useState(null);
  const [selectedRackToAssign, setSelectedRackToAssign] = useState(null);
  const [placementModalTab, setPlacementModalTab] = useState('equipment'); // 'equipment' | 'racks'
  const [trayTab, setTrayTab] = useState('equipment'); // 'equipment' | 'racks'
  const [rackSearch, setRackSearch] = useState('');
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
  const [assignSearch, setAssignSearch] = useState('');
  const [assignCategory, setAssignCategory] = useState('all');

  // Pin Drag-and-Drop Repositioning State
  const [draggedPin, setDraggedPin] = useState(null); // { id, type: 'device' | 'rack', posX, posY }
  const pinDragRef = useRef({
    isDragging: false,
    hasMoved: false,
    item: null,
    type: 'device',
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  });

  // 2. All Ref Hooks
  const dragOriginRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const hasDraggedSignificantlyRef = useRef(false);
  const viewportRef = useRef(null);
  const activeClickCoordRef = useRef(activeClickCoord);
  activeClickCoordRef.current = activeClickCoord;
  const blueprintGraphicRef = useRef(null);
  const lastFittedPlanIdRef = useRef(null);
  const touchStartPosRef = useRef({ x: 0, y: 0 });
  const touchStartTimeRef = useRef(0);
  const pinchInitialDistRef = useRef(0);
  const pinchInitialZoomRef = useRef(1);

  // 3. Derived Variables (Available to all functions and effects below)
  // Filtered Floor Plans based on Estate Zone AND Plan Type (Discipline)
  const filteredFloorPlans = floorPlans.filter((fp) => {
    const matchesZone = selectedZoneFilter === 'all' || fp.zone === selectedZoneFilter;
    const pType = (fp.plan_type || 'ICT').toLowerCase();
    const matchesType =
      selectedPlanTypeFilter === 'all' || pType === selectedPlanTypeFilter.toLowerCase();
    return matchesZone && matchesType;
  });

  const activePlan =
    filteredFloorPlans.find((fp) => fp.id === selectedPlanId) ||
    floorPlans.find((fp) => fp.id === selectedPlanId) ||
    filteredFloorPlans[0] ||
    floorPlans[0];

  // Devices placed on this floor plan
  const pinnedDevices = devices.filter(
    (d) => d.floor_plan_id === activePlan?.id && d.pos_x !== null && d.pos_y !== null
  );

  // Devices not yet placed on this floor plan
  const unpinnedDevices = devices.filter((d) => !d.floor_plan_id || d.pos_x === null);

  // Server Racks placed on this floor plan
  const pinnedRacks = racks.filter(
    (r) => r.floor_plan_id === activePlan?.id && r.pos_x !== null && r.pos_y !== null
  );

  // Server Racks not placed on this floor plan (or unpinned anywhere)
  const unpinnedRacks = racks.filter((r) => !r.floor_plan_id || r.pos_x === null);

  // Filtered racks for assignment modal
  const filteredRacksToAssign = unpinnedRacks.filter((rack) => {
    if (!rackSearch.trim()) return true;
    const q = rackSearch.toLowerCase().trim();
    return (
      rack.name?.toLowerCase().includes(q) ||
      rack.nameKu?.toLowerCase().includes(q) ||
      rack.location?.toLowerCase().includes(q) ||
      rack.zone?.toLowerCase().includes(q)
    );
  });

  // Filtered devices for the placement assignment modal
  const filteredDevicesToAssign = unpinnedDevices.filter((dev) => {
    const m = boqModels.find((b) => b.id === dev.boq_model_id);
    const cat = m ? categories.find((c) => c.id === m.category_id) : null;

    if (assignCategory !== 'all' && m?.category_id !== assignCategory) {
      return false;
    }

    if (assignSearch.trim()) {
      const q = assignSearch.toLowerCase().trim();
      const matchLabel = dev.custom_label_id?.toLowerCase().includes(q);
      const matchBrand = m?.brand?.toLowerCase().includes(q);
      const matchModel = m?.model?.toLowerCase().includes(q);
      const matchDesc = m?.description?.toLowerCase().includes(q);
      const matchIp = dev.ip_address?.toLowerCase().includes(q);
      const matchCat = cat?.name?.toLowerCase().includes(q) || cat?.name_ku?.toLowerCase().includes(q);
      return matchLabel || matchBrand || matchModel || matchDesc || matchIp || matchCat;
    }

    return true;
  });

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
      // If arriving to place an unpinned device, engage placement mode directly
      if (!initialSelectedDevice.floor_plan_id || initialSelectedDevice.pos_x === null) {
        setDeviceToPlace(initialSelectedDevice);
        setSelectedDeviceToAssign(initialSelectedDevice);
        setIsPlacementMode(true);
        setMobileActiveView('canvas');
      }
    }
  }, [initialSelectedDevice]);

  // Keep selectedPlanId valid if plans change, one is deleted, or filter changes
  useEffect(() => {
    if (filteredFloorPlans.length > 0 && !filteredFloorPlans.some((fp) => fp.id === selectedPlanId)) {
      setSelectedPlanId(filteredFloorPlans[0].id);
      setSelectedDevice(null);
      setSelectedRack(null);
      setDeviceToPlace(null);
      setActiveClickCoord(null);
    } else if (!floorPlans.some((fp) => fp.id === selectedPlanId) && floorPlans.length > 0) {
      setSelectedPlanId(floorPlans[0].id);
    }
  }, [floorPlans, filteredFloorPlans, selectedPlanId]);

  // Non-passive wheel handler: Smooth, guaranteed e.preventDefault() to stop page scroll, supports mouse & trackpad
  const handleWheelZoom = useCallback((e) => {
    // Suppress blueprint zoom if manual pin placement modal or any modal is open
    if (activeClickCoordRef.current || e.target.closest('.no-map-zoom, .modal-open, [role="dialog"], .fixed')) {
      return;
    }
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
      const isRack = newZone === 'rack';
      const updatedPayload = {
        ...selectedDevice,
        placement_zone: newZone || null,
        rack_name: isRack
          ? (selectedDevice.rack_name || racks[0]?.name || 'Main 42U Server Rack A')
          : selectedDevice.rack_name,
      };
      if (onUpdateDevice) {
        await onUpdateDevice(selectedDevice.id, updatedPayload);
      } else {
        await api.updateDevice(selectedDevice.id, updatedPayload);
      }
      setSelectedDevice((prev) =>
        prev
          ? {
              ...prev,
              placement_zone: newZone || null,
              rack_name: isRack ? (prev.rack_name || racks[0]?.name || 'Main 42U Server Rack A') : prev.rack_name,
            }
          : prev
      );
    } catch (err) {
      alert(err.message || 'Failed to update location zone');
      setDeviceZone(selectedDevice.placement_zone || '');
    } finally {
      setIsSavingZone(false);
    }
  };

  const handleUpdateDeviceRack = async (newRackName, newRackUnit) => {
    if (!selectedDevice) return;
    try {
      const updatedPayload = {
        ...selectedDevice,
        rack_name: newRackName || null,
        rack_unit: newRackUnit !== undefined ? (newRackUnit || null) : selectedDevice.rack_unit,
      };
      if (onUpdateDevice) {
        await onUpdateDevice(selectedDevice.id, updatedPayload);
      } else {
        await api.updateDevice(selectedDevice.id, updatedPayload);
      }
      setSelectedDevice((prev) =>
        prev
          ? {
              ...prev,
              rack_name: newRackName || null,
              rack_unit: newRackUnit !== undefined ? (newRackUnit || null) : prev.rack_unit,
            }
          : prev
      );
    } catch (err) {
      alert(err.message || 'Failed to update rack assignment');
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

  // Pin Drag Handlers & Window Movement Listeners (Drag & Drop repositioning)
  const handlePinMouseDown = (e, item, type = 'device') => {
    e.stopPropagation();
    if (e.button && e.button !== 0) return; // Only primary mouse button
    const clientX = e.clientX;
    const clientY = e.clientY;
    pinDragRef.current = {
      isDragging: true,
      hasMoved: false,
      item,
      type,
      startX: clientX,
      startY: clientY,
      currentX: item.pos_x,
      currentY: item.pos_y,
    };
  };

  const handlePinTouchStart = (e, item, type = 'device') => {
    e.stopPropagation();
    if (!e.touches || !e.touches[0]) return;
    const touch = e.touches[0];
    pinDragRef.current = {
      isDragging: true,
      hasMoved: false,
      item,
      type,
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: item.pos_x,
      currentY: item.pos_y,
    };
  };

  useEffect(() => {
    const handleWindowMouseMove = (e) => {
      if (!pinDragRef.current.isDragging || !blueprintGraphicRef.current) return;
      const clientX = e.clientX;
      const clientY = e.clientY;
      const dx = clientX - pinDragRef.current.startX;
      const dy = clientY - pinDragRef.current.startY;
      if (Math.hypot(dx, dy) >= 4) {
        pinDragRef.current.hasMoved = true;
      }
      if (pinDragRef.current.hasMoved) {
        const rect = blueprintGraphicRef.current.getBoundingClientRect();
        const rawX = ((clientX - rect.left) / rect.width) * 100;
        const rawY = ((clientY - rect.top) / rect.height) * 100;
        const clampedX = Math.max(0.5, Math.min(99.5, Math.round(rawX * 10) / 10));
        const clampedY = Math.max(0.5, Math.min(99.5, Math.round(rawY * 10) / 10));
        pinDragRef.current.currentX = clampedX;
        pinDragRef.current.currentY = clampedY;
        setDraggedPin({
          id: pinDragRef.current.item.id,
          type: pinDragRef.current.type,
          posX: clampedX,
          posY: clampedY,
        });
      }
    };

    const handleWindowTouchMove = (e) => {
      if (!pinDragRef.current.isDragging || !blueprintGraphicRef.current || !e.touches || !e.touches[0]) return;
      const touch = e.touches[0];
      const clientX = touch.clientX;
      const clientY = touch.clientY;
      const dx = clientX - pinDragRef.current.startX;
      const dy = clientY - pinDragRef.current.startY;
      if (Math.hypot(dx, dy) >= 4) {
        pinDragRef.current.hasMoved = true;
        if (e.cancelable) e.preventDefault();
      }
      if (pinDragRef.current.hasMoved) {
        const rect = blueprintGraphicRef.current.getBoundingClientRect();
        const rawX = ((clientX - rect.left) / rect.width) * 100;
        const rawY = ((clientY - rect.top) / rect.height) * 100;
        const clampedX = Math.max(0.5, Math.min(99.5, Math.round(rawX * 10) / 10));
        const clampedY = Math.max(0.5, Math.min(99.5, Math.round(rawY * 10) / 10));
        pinDragRef.current.currentX = clampedX;
        pinDragRef.current.currentY = clampedY;
        setDraggedPin({
          id: pinDragRef.current.item.id,
          type: pinDragRef.current.type,
          posX: clampedX,
          posY: clampedY,
        });
      }
    };

    const handleWindowEnd = () => {
      if (!pinDragRef.current.isDragging) return;
      const { hasMoved, item, type, currentX, currentY } = pinDragRef.current;
      pinDragRef.current.isDragging = false;

      if (hasMoved && item && activePlan) {
        if (type === 'device') {
          if (onUpdatePosition) {
            onUpdatePosition(item.id, {
              floor_plan_id: activePlan.id,
              pos_x: currentX,
              pos_y: currentY,
            });
          }
          triggerPlacementFlash(currentX, currentY);
          setSelectedDevice({ ...item, floor_plan_id: activePlan.id, pos_x: currentX, pos_y: currentY });
          setSelectedRack(null);
          setMobileActiveView('devices');
        } else if (type === 'rack') {
          if (updateRackPosition) {
            updateRackPosition(item.id, {
              floor_plan_id: activePlan.id,
              pos_x: currentX,
              pos_y: currentY,
            });
          }
          triggerPlacementFlash(currentX, currentY);
          setSelectedRack({ ...item, floor_plan_id: activePlan.id, pos_x: currentX, pos_y: currentY });
          setSelectedDevice(null);
          setMobileActiveView('devices');
        }
      } else if (!hasMoved && item) {
        // Simple tap / click without moving
        if (type === 'device') {
          setSelectedDevice(item);
          setSelectedRack(null);
          setPingStatus(null);
          setActiveClickCoord(null);
          setMobileActiveView('devices');
        } else if (type === 'rack') {
          setSelectedRack(item);
          setSelectedDevice(null);
          setPingStatus(null);
          setActiveClickCoord(null);
          setMobileActiveView('devices');
        }
      }

      pinDragRef.current = {
        isDragging: false,
        hasMoved: false,
        item: null,
        type: 'device',
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
      };
      setDraggedPin(null);
    };

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowEnd);
    window.addEventListener('touchmove', handleWindowTouchMove, { passive: false });
    window.addEventListener('touchend', handleWindowEnd);
    window.addEventListener('touchcancel', handleWindowEnd);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowEnd);
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', handleWindowEnd);
      window.removeEventListener('touchcancel', handleWindowEnd);
    };
  }, [activePlan, onUpdatePosition, updateRackPosition]);

  // Drag Panning Handlers
  const handleMouseDown = (e) => {
    // Ignore clicks on pins, buttons, inputs, popovers
    if (e.target.closest('.device-pin, .rack-pin, .interactive-control, button, input, .quick-assign-popover')) {
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
    if (Math.hypot(dx, dy) >= 6) {
      hasDraggedSignificantlyRef.current = true;
      setPan({
        x: panStartRef.current.x + dx,
        y: panStartRef.current.y + dy,
      });
    }
  };

  const handleMouseUp = (e) => {
    if (!isDragging) return;
    setIsDragging(false);

    // Open device/rack placement picker if tapped on blueprint and there are unpinned items or in placement mode
    if (!hasDraggedSignificantlyRef.current) {
      if (isPlacementMode || deviceToPlace || unpinnedDevices.length > 0 || unpinnedRacks.length > 0) {
        handleBlueprintClick(e);
      } else {
        setSelectedDevice(null);
        setSelectedRack(null);
      }
    }
  };

  const handleMouseLeave = () => {
    if (isDragging) setIsDragging(false);
  };

  // Multi-Touch Handlers (Mobile & iPad / Tablet Pan + Pinch-to-Zoom)
  const handleTouchStart = (e) => {
    if (e.target.closest('.device-pin, .rack-pin, .interactive-control, button, input, .quick-assign-popover')) {
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
      if (Math.hypot(dx, dy) >= 6) {
        hasDraggedSignificantlyRef.current = true;
        setPan({
          x: panStartRef.current.x + dx,
          y: panStartRef.current.y + dy,
        });
      }
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

      // Open device/rack placement picker on mobile tap if unpinned items exist or in placement mode
      if (!hasDraggedSignificantlyRef.current && duration < 350) {
        if (isPlacementMode || deviceToPlace || unpinnedDevices.length > 0 || unpinnedRacks.length > 0) {
          handleBlueprintClick({
            clientX: touchStartPosRef.current.x,
            clientY: touchStartPosRef.current.y,
          });
        } else {
          setSelectedDevice(null);
          setSelectedRack(null);
        }
      }
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      dragOriginRef.current = { x: t.clientX, y: t.clientY };
      panStartRef.current = { x: pan.x, y: pan.y };
      setIsDragging(true);
      pinchInitialDistRef.current = 0;
    }
  };

  // Click anywhere on blueprint to open manual placement modal
  const handleBlueprintClick = (e) => {
    if (!blueprintGraphicRef.current || !activePlan) return;

    const rect = blueprintGraphicRef.current.getBoundingClientRect();

    // Use touch start or mouse down coordinates if available for ultra-precise anchor
    const clientX = (dragOriginRef.current && typeof dragOriginRef.current.x === 'number')
      ? dragOriginRef.current.x
      : (e?.clientX ?? 0);
    const clientY = (dragOriginRef.current && typeof dragOriginRef.current.y === 'number')
      ? dragOriginRef.current.y
      : (e?.clientY ?? 0);

    // If click was outside the actual blueprint container, ignore
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
      return;
    }

    const rawX = ((clientX - rect.left) / rect.width) * 100;
    const rawY = ((clientY - rect.top) / rect.height) * 100;

    const clampedX = Math.max(0.5, Math.min(99.5, Math.round(rawX * 100) / 100));
    const clampedY = Math.max(0.5, Math.min(99.5, Math.round(rawY * 100) / 100));

    setActiveClickCoord({ x: clampedX, y: clampedY });
    setAssignSearch('');
    setAssignCategory('all');
    setRackSearch('');

    if (deviceToPlace) {
      setSelectedDeviceToAssign(deviceToPlace);
      setSelectedRackToAssign(null);
      setPlacementModalTab('equipment');
    } else {
      setSelectedDeviceToAssign(null);
      setSelectedRackToAssign(null);
      if (unpinnedDevices.length === 0 && unpinnedRacks.length > 0) {
        setPlacementModalTab('racks');
      } else {
        setPlacementModalTab('equipment');
      }
    }
  };

  const triggerPlacementFlash = (x, y) => {
    setPlacementFlash({ x, y });
    setTimeout(() => setPlacementFlash(null), 1800);
  };

  // Assign chosen device to active clicked coordinate
  const handleAssignDeviceToCoord = (device) => {
    if (!activeClickCoord || !activePlan || !device) return;

    onUpdatePosition(device.id, {
      floor_plan_id: activePlan.id,
      pos_x: activeClickCoord.x,
      pos_y: activeClickCoord.y,
    });

    triggerPlacementFlash(activeClickCoord.x, activeClickCoord.y);
    setSelectedDevice(device);
    setSelectedRack(null);
    setActiveClickCoord(null);
    setDeviceToPlace(null);
    setSelectedDeviceToAssign(null);
    setIsPlacementMode(false);
  };

  // Assign chosen Server Rack to active clicked coordinate
  const handleAssignRackToCoord = (rack) => {
    if (!activeClickCoord || !activePlan || !rack) return;

    updateRackPosition(rack.id, {
      floor_plan_id: activePlan.id,
      pos_x: activeClickCoord.x,
      pos_y: activeClickCoord.y,
    });

    triggerPlacementFlash(activeClickCoord.x, activeClickCoord.y);
    setSelectedRack({
      ...rack,
      floor_plan_id: activePlan.id,
      pos_x: activeClickCoord.x,
      pos_y: activeClickCoord.y,
    });
    setSelectedDevice(null);
    setActiveClickCoord(null);
    setSelectedRackToAssign(null);
    setIsPlacementMode(false);
  };

  const handleUnpinRack = (rack) => {
    if (!rack) return;
    unpinRack(rack.id);
    setSelectedRack(null);
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
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setIsRackModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-slate-900 hover:bg-slate-800 text-blue-400 hover:text-white border border-slate-800 hover:border-slate-700 shadow transition active:scale-95 shrink-0 cursor-pointer"
          >
            <Server className="w-4 h-4 text-blue-400" />
            <span>{isKu ? 'ڕاکەکانی سێرڤەر' : 'Server Racks'}</span>
          </button>
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

            {/* Discipline / Plan Type Filter (All, ICT, Security, AV, BMS) */}
            <div className="space-y-1.5 pt-1.5 border-t border-slate-800/80">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-semibold">{isKu ? 'سیستەم / جۆری ماپ:' : 'Discipline:'}</span>
                <span className="font-mono text-[10px] text-blue-400 font-bold">
                  {selectedPlanTypeFilter === 'all'
                    ? (isKu ? 'گشت' : 'All')
                    : selectedPlanTypeFilter}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedPlanTypeFilter('all')}
                  className={`py-1 px-1.5 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    selectedPlanTypeFilter === 'all'
                      ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400/40'
                      : 'bg-slate-950/70 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  <span>{isKu ? 'گشت' : 'All'}</span>
                  <span className="text-[9px] font-mono opacity-80">({floorPlans.length})</span>
                </button>
                {planTypes.map((pt) => {
                  const isSel = selectedPlanTypeFilter.toLowerCase() === pt.id.toLowerCase();
                  const count = floorPlans.filter(
                    (fp) => (fp.plan_type || 'ICT').toLowerCase() === pt.id.toLowerCase()
                  ).length;
                  const IconComp = pt.id === 'Security' ? Shield : pt.id === 'AV' ? Tv : pt.id === 'BMS' ? Cpu : Network;
                  return (
                    <button
                      key={pt.id}
                      type="button"
                      onClick={() => setSelectedPlanTypeFilter(pt.id)}
                      className={`py-1 px-1.5 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                        isSel
                          ? 'text-white shadow-md ring-1 ring-white/30'
                          : 'bg-slate-950/70 text-slate-400 hover:text-white border border-slate-800'
                      }`}
                      style={isSel ? { backgroundColor: pt.color } : {}}
                    >
                      <IconComp className="w-2.5 h-2.5 shrink-0" />
                      <span>{pt.shortLabel || pt.id}</span>
                      <span className="text-[9px] font-mono opacity-80">({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>

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
            {filteredFloorPlans.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500 space-y-2.5 px-2">
                <Shield className="w-8 h-8 text-slate-600 mx-auto stroke-1" />
                <p className="italic">
                  {isKu
                    ? `هیچ نەخشەیەکی ${selectedPlanTypeFilter === 'all' ? '' : selectedPlanTypeFilter} بەردەست نییە`
                    : `No ${selectedPlanTypeFilter === 'all' ? '' : selectedPlanTypeFilter} floor plans found`}
                </p>
                <button
                  type="button"
                  onClick={() => setIsAddPlanModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600/20 text-blue-300 border border-blue-500/30 hover:bg-blue-600/30 transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>
                    {isKu
                      ? `+ زیادکردنی نەخشەی ${selectedPlanTypeFilter !== 'all' ? selectedPlanTypeFilter : ''}`
                      : `+ Add ${selectedPlanTypeFilter !== 'all' ? selectedPlanTypeFilter : ''} Blueprint`}
                  </span>
                </button>
              </div>
            ) : (
              filteredFloorPlans.map((fp) => {
                const isActive = fp.id === activePlan?.id;
                const planDeviceCount = devices.filter((d) => d.floor_plan_id === fp.id).length;
                const zoneBadgeClass = isActive
                  ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                  : 'bg-slate-800 text-slate-400 border-slate-700/60';
                const ptMeta = getPlanTypeMeta(fp.plan_type || 'ICT');
                const TypeIcon = ptMeta.id === 'Security' ? Shield : ptMeta.id === 'AV' ? Tv : ptMeta.id === 'BMS' ? Cpu : Network;

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
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                          {/* Plan Type Discipline Badge */}
                          <span
                            className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold border shrink-0 inline-flex items-center gap-1"
                            style={{
                              backgroundColor: `${ptMeta.color}15`,
                              color: ptMeta.color,
                              borderColor: `${ptMeta.color}35`,
                            }}
                          >
                            <TypeIcon className="w-2.5 h-2.5" />
                            <span>{ptMeta.shortLabel || fp.plan_type || 'ICT'}</span>
                          </span>

                          {fp.floor_level !== undefined && fp.floor_level !== null && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-blue-500/20 text-blue-300 border border-blue-500/40 inline-flex items-center gap-1 shrink-0">
                              <Layers className="w-2.5 h-2.5 text-blue-400" />
                              <span>{isKu ? `قات: ${formatFloorLevel(fp.floor_level, lang)}` : `Floor: ${formatFloorLevel(fp.floor_level, lang)}`}</span>
                            </span>
                          )}
                          {fp.zone && (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] text-slate-300 font-medium bg-slate-900 border border-slate-700/60 inline-flex items-center gap-1 shrink-0">
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
            {filteredFloorPlans.map((fp) => {
              const isAct = fp.id === activePlan?.id;
              const ptMeta = getPlanTypeMeta(fp.plan_type || 'ICT');
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
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: isAct ? '#ffffff' : ptMeta.color }}
                  />
                  <span>{isKu ? (fp.name_ku || fp.name) : fp.name}</span>
                  <span className="text-[9px] font-mono opacity-80 font-bold px-1 rounded bg-black/30">
                    {ptMeta.shortLabel || fp.plan_type || 'ICT'}
                  </span>
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
            <div className="flex items-center gap-2.5 text-xs text-slate-300 flex-wrap">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="font-semibold text-white">
                {activePlan ? (isKu ? (activePlan.name_ku || activePlan.name) : activePlan.name) : 'No Plan Selected'}
              </span>

              {/* Active Plan Discipline Badge */}
              {activePlan && (() => {
                const ptMeta = getPlanTypeMeta(activePlan.plan_type || 'ICT');
                const TypeIcon = ptMeta.id === 'Security' ? Shield : ptMeta.id === 'AV' ? Tv : ptMeta.id === 'BMS' ? Cpu : Network;
                return (
                  <span
                    className="px-2.5 py-0.5 rounded-lg text-[10px] font-bold font-mono border inline-flex items-center gap-1 shadow-sm"
                    style={{
                      backgroundColor: `${ptMeta.color}20`,
                      color: ptMeta.color,
                      borderColor: `${ptMeta.color}40`,
                    }}
                  >
                    <TypeIcon className="w-3 h-3" />
                    <span>{ptMeta.shortLabel || activePlan.plan_type || 'ICT'}</span>
                  </span>
                );
              })()}

              {activePlan?.floor_level !== undefined && activePlan?.floor_level !== null && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-bold font-mono bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  {formatFloorLevel(activePlan.floor_level, lang)}
                </span>
              )}
              <span className="text-slate-600">|</span>
              <span className="text-blue-400 font-mono font-bold">
                {pinnedDevices.length} {isKu ? 'ئامێر' : 'devices'}
                {pinnedRacks.length > 0 && ` • ${pinnedRacks.length} ${isKu ? 'ڕاک' : 'racks'}`}
              </span>
            </div>

            {/* Hint & Navigation Tools */}
            <div className="flex items-center gap-2 flex-wrap">
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
                className="select-none"
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
                      style={{
                        left: `${placementFlash.x}%`,
                        top: `${placementFlash.y}%`,
                        transform: 'translate(-50%, -18px)',
                      }}
                      className="absolute pointer-events-none z-30 flex items-center justify-center"
                    >
                      <span className="w-12 h-12 rounded-full border-2 border-emerald-400 bg-emerald-500/30 animate-ping" />
                      <Sparkles className="w-5 h-5 text-emerald-300 absolute animate-bounce" />
                    </div>
                  )}

                  {/* Active Selected Coordinate Target Reticle */}
                  {activeClickCoord && (
                    <div
                      style={{
                        left: `${activeClickCoord.x}%`,
                        top: `${activeClickCoord.y}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                      className="absolute z-40 pointer-events-none"
                    >
                      <div className="w-10 h-10 rounded-full border-2 border-dashed border-blue-400 bg-blue-500/20 animate-spin" />
                      <div className="w-2.5 h-2.5 bg-blue-400 rounded-full absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 shadow-lg shadow-blue-500/50" />
                    </div>
                  )}

                  {/* Interactive Device Pins with Dynamic ICT Icons & Drag-and-Drop Repositioning */}
                  {pinnedDevices.map((dev) => {
                    const model = boqModels.find((m) => m.id === dev.boq_model_id);
                    const category = model ? categories.find((c) => c.id === model.category_id) : null;
                    const isSelected = selectedDevice?.id === dev.id;
                    const isBeingDragged = draggedPin?.id === dev.id && draggedPin?.type === 'device';
                    const currentX = isBeingDragged ? draggedPin.posX : dev.pos_x;
                    const currentY = isBeingDragged ? draggedPin.posY : dev.pos_y;
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
                        onMouseDown={(e) => handlePinMouseDown(e, dev, 'device')}
                        onTouchStart={(e) => handlePinTouchStart(e, dev, 'device')}
                        style={{
                          left: `${currentX}%`,
                          top: `${currentY}%`,
                          transform: 'translate(-50%, -18px)',
                          zIndex: isBeingDragged ? 50 : isSelected ? 30 : 20,
                          touchAction: 'none',
                        }}
                        className={`device-pin absolute group flex flex-col items-center select-none ${
                          isBeingDragged ? 'cursor-grabbing scale-110' : 'cursor-grab'
                        }`}
                      >
                        {/* Live Drag Coordinate Pill */}
                        {isBeingDragged && (
                          <div className="absolute bottom-full mb-2 px-2.5 py-1 rounded-xl bg-blue-600 border border-blue-400 text-white text-[10px] font-mono font-bold shadow-2xl animate-pulse whitespace-nowrap z-50 pointer-events-none flex items-center gap-1.5">
                            <Move className="w-3 h-3" />
                            <span>X: {currentX}% / Y: {currentY}%</span>
                          </div>
                        )}

                        {/* Status Ring & ICT Device Icon */}
                        <div
                          className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg transition-transform duration-150 ${
                            isBeingDragged
                              ? 'scale-125 ring-4 ring-blue-400 shadow-xl shadow-blue-500/60'
                              : isSelected
                              ? 'scale-125 ring-4 ring-blue-500/40'
                              : 'group-hover:scale-125'
                          }`}
                          style={{
                            backgroundColor: '#0f172a',
                            border: `2.5px solid ${statusColor}`,
                            boxShadow: isSelected || isBeingDragged ? `0 0 18px ${statusColor}` : '0 4px 10px rgba(0,0,0,0.6)',
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

                        {/* Rich Hover / Touch Tooltip (When not dragging) */}
                        {!isBeingDragged && (
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
                        )}
                      </div>
                    );
                  })}

                  {/* Interactive Server Rack Pins with Drag-and-Drop & Direct Rack Equipment View */}
                  {pinnedRacks.map((rack) => {
                    const isSelected = selectedRack?.id === rack.id;
                    const isBeingDragged = draggedPin?.id === rack.id && draggedPin?.type === 'rack';
                    const currentX = isBeingDragged ? draggedPin.posX : rack.pos_x;
                    const currentY = isBeingDragged ? draggedPin.posY : rack.pos_y;
                    const devicesInThisRack = devices.filter((d) => {
                      if (!d.rack_name && !d.rack_id) return false;
                      const rName = rack.name?.toLowerCase();
                      const rNameKu = rack.nameKu?.toLowerCase();
                      const dName = d.rack_name?.toLowerCase();
                      return (
                        d.rack_id === rack.id ||
                        d.rack_name === rack.id ||
                        (rName && dName === rName) ||
                        (rNameKu && dName === rNameKu)
                      );
                    });

                    return (
                      <div
                        key={`rack-pin-${rack.id}`}
                        onMouseDown={(e) => handlePinMouseDown(e, rack, 'rack')}
                        onTouchStart={(e) => handlePinTouchStart(e, rack, 'rack')}
                        style={{
                          left: `${currentX}%`,
                          top: `${currentY}%`,
                          transform: 'translate(-50%, -20px)',
                          zIndex: isBeingDragged ? 50 : isSelected ? 40 : 20,
                          touchAction: 'none',
                        }}
                        className={`rack-pin absolute group flex flex-col items-center select-none ${
                          isBeingDragged ? 'cursor-grabbing scale-110' : 'cursor-grab'
                        }`}
                      >
                        {/* Live Drag Coordinate Pill */}
                        {isBeingDragged && (
                          <div className="absolute bottom-full mb-2 px-2.5 py-1 rounded-xl bg-indigo-600 border border-indigo-400 text-white text-[10px] font-mono font-bold shadow-2xl animate-pulse whitespace-nowrap z-50 pointer-events-none flex items-center gap-1.5">
                            <Move className="w-3 h-3" />
                            <span>X: {currentX}% / Y: {currentY}%</span>
                          </div>
                        )}

                        {/* Rack Icon Container */}
                        <div
                          className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-transform duration-150 ${
                            isBeingDragged
                              ? 'scale-125 ring-4 ring-indigo-400 shadow-xl shadow-indigo-500/60'
                              : isSelected
                              ? 'scale-125 ring-4 ring-indigo-400 shadow-xl shadow-indigo-500/50'
                              : 'group-hover:scale-125 shadow-lg'
                          }`}
                          style={{
                            backgroundColor: '#0f172a',
                            border: '2.5px solid #6366f1',
                            boxShadow: isSelected || isBeingDragged
                              ? '0 0 22px rgba(99, 102, 241, 0.8)'
                              : '0 4px 12px rgba(0,0,0,0.8)',
                          }}
                        >
                          <Server className="w-5 h-5 text-indigo-400 drop-shadow" />
                        </div>

                        {/* Persistent High-Contrast Rack Label Pill Under Pin */}
                        <div className="mt-1 px-2 py-0.5 rounded-md bg-slate-950/95 border border-indigo-500/70 shadow-lg pointer-events-none whitespace-nowrap flex items-center gap-1.5">
                          <span className="text-[8px] font-extrabold uppercase px-1 rounded bg-indigo-500/30 text-indigo-300 font-mono">
                            RACK
                          </span>
                          <span className="text-[9px] font-bold font-mono text-white tracking-tight block leading-none">
                            {isKu ? (rack.nameKu || rack.name) : rack.name}
                          </span>
                          <span className="text-[9px] font-mono text-indigo-400 font-bold">
                            ({rack.totalUnits}U)
                          </span>
                        </div>

                        {/* Mini badge showing count of mounted devices */}
                        {devicesInThisRack.length > 0 && (
                          <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-indigo-600 text-[9px] font-bold text-white border-2 border-slate-900 shadow-md font-mono">
                            {devicesInThisRack.length}
                          </span>
                        )}

                        {/* Rich On-Canvas Rack Details & Mounted Equipment Popover (Directly on Map) */}
                        {isSelected && !isBeingDragged && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 z-40 w-72 sm:w-80 bg-slate-900/98 backdrop-blur-md border border-indigo-500/60 rounded-2xl p-3.5 shadow-2xl text-left pointer-events-auto space-y-2.5 animate-fadeIn"
                          >
                            {/* Header */}
                            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-indigo-400">
                                  <Server className="w-4 h-4" />
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold font-mono text-white leading-tight">
                                    {isKu ? (rack.nameKu || rack.name) : rack.name}
                                  </h4>
                                  <span className="text-[10px] text-indigo-300 font-mono">
                                    {rack.totalUnits}U • {formatEstateZone(rack.zone, lang)}
                                    {rack.location ? ` • ${rack.location}` : ''}
                                  </span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedRack(null);
                                }}
                                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            {/* Devices in this Rack */}
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-slate-300 font-semibold flex items-center gap-1">
                                  <Cpu className="w-3 h-3 text-indigo-400" />
                                  <span>{isKu ? 'ئامێرەکانی ناو ئەم ڕاکە' : 'Mounted Devices in Rack'}</span>
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                  {devicesInThisRack.length} {isKu ? 'ئامێر' : 'items'}
                                </span>
                              </div>

                              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                                {devicesInThisRack.length === 0 ? (
                                  <div className="p-2 text-center text-[11px] text-slate-500 italic bg-slate-950/60 rounded-lg border border-slate-800/80">
                                    {isKu ? 'هیچ ئامێرێک لەناو ئەم ڕاکە دانەنراوە' : 'No equipment mounted in this rack yet'}
                                  </div>
                                ) : (
                                  devicesInThisRack.map((dev) => {
                                    const devModel = boqModels.find((m) => m.id === dev.boq_model_id) || dev.boq_model;
                                    const category = devModel ? categories.find((c) => c.id === devModel.category_id) : null;
                                    const DevIcon = getIctDeviceIcon(dev, devModel, category);
                                    const productImg = devModel?.product_image_url || '/default-ict-device.svg';
                                    const formattedUnit = dev.rack_unit
                                      ? (String(dev.rack_unit).toUpperCase().startsWith('U') ? dev.rack_unit : `U${dev.rack_unit}`)
                                      : null;

                                    return (
                                      <div
                                        key={dev.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedDevice(dev);
                                          setSelectedRack(null);
                                          setMobileActiveView('devices');
                                        }}
                                        className="p-1.5 bg-slate-950/80 hover:bg-slate-800 rounded-xl border border-slate-800 hover:border-indigo-500/50 cursor-pointer transition flex items-center justify-between gap-2 group"
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          {/* Mini Thumbnail */}
                                          <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 p-0.5 flex items-center justify-center shrink-0 overflow-hidden relative shadow-inner">
                                            <img
                                              src={productImg}
                                              alt={devModel?.model || 'Device'}
                                              className="w-full h-full object-contain"
                                              loading="lazy"
                                              onError={(e) => {
                                                e.currentTarget.style.display = 'none';
                                                const fallback = e.currentTarget.parentElement?.querySelector('.device-popover-icon');
                                                if (fallback) fallback.classList.remove('hidden');
                                              }}
                                            />
                                            <div className="device-popover-icon hidden w-full h-full items-center justify-center text-indigo-400">
                                              <DevIcon className="w-4 h-4" />
                                            </div>
                                            {category?.color_code && (
                                              <div
                                                className="absolute bottom-0.5 right-0.5 w-2 h-2 rounded-full border border-slate-900"
                                                style={{ backgroundColor: category.color_code }}
                                              />
                                            )}
                                          </div>

                                          <div className="min-w-0">
                                            <div className="flex items-center gap-1.5">
                                              <span className="font-mono text-[11px] font-bold text-white truncate group-hover:text-indigo-300 transition">
                                                {dev.custom_label_id}
                                              </span>
                                              {formattedUnit && (
                                                <span className="text-[9px] font-mono px-1 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-semibold">
                                                  {formattedUnit}
                                                </span>
                                              )}
                                            </div>
                                            <p className="text-[10px] text-slate-300 truncate font-medium">
                                              {devModel ? `${devModel.brand} ${devModel.model}` : 'Device'}
                                            </p>
                                          </div>
                                        </div>
                                        <span className="text-[9px] font-mono text-cyan-400 shrink-0">{dev.ip_address || '—'}</span>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>

                            {/* Quick Action Buttons */}
                            <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsRackModalOpen(true);
                                }}
                                className="flex-1 py-1 px-2 rounded-lg text-[10px] font-semibold bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 transition flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Settings2 className="w-3 h-3" />
                                <span>{isKu ? 'دەستکاری ڕاک' : 'Manage Rack'}</span>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUnpinRack(rack);
                                }}
                                className="py-1 px-2 rounded-lg text-[10px] font-semibold text-slate-400 hover:text-red-400 hover:bg-slate-800 transition cursor-pointer"
                              >
                                {isKu ? 'لابردن لە نەخشە' : 'Unpin'}
                              </button>
                            </div>

                            {/* Arrow Pointer */}
                            <div className="w-3 h-3 bg-slate-900 border-r border-b border-indigo-500/60 rotate-45 absolute -bottom-1.5 left-1/2 -translate-x-1/2 pointer-events-none" />
                          </div>
                        )}

                        {/* Rich Hover / Touch Tooltip (when not selected and not dragged) */}
                        {!isSelected && !isBeingDragged && (
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:flex flex-col items-center pointer-events-none whitespace-nowrap z-30">
                            <div className="px-3 py-2 bg-slate-900 border border-indigo-500/60 rounded-xl shadow-2xl text-center space-y-1">
                              <div className="flex items-center justify-center gap-1.5">
                                <Server className="w-4 h-4 text-indigo-400" />
                                <p className="text-xs font-bold font-mono text-white">
                                  {isKu ? (rack.nameKu || rack.name) : rack.name}
                                </p>
                              </div>
                              <div className="flex items-center justify-center gap-2 text-[10px] text-slate-300 font-mono">
                                <span className="text-indigo-400 font-semibold">{rack.totalUnits}U Capacity</span>
                                <span>•</span>
                                <span className="text-emerald-400 font-semibold">{devicesInThisRack.length} Mounted</span>
                              </div>
                              {rack.location && (
                                <p className="text-[10px] text-slate-400">{rack.location}</p>
                              )}
                            </div>
                            <div className="w-2 h-2 bg-slate-900 rotate-45 -mt-1 border-r border-b border-indigo-500/60" />
                          </div>
                        )}
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

          </div>
        </div>

        {/* 3. Right Sidebar: Staging Tray & Device Inspector (Mobile & iPad Drawer Supported) */}
        <div className={`w-full lg:w-72 xl:w-80 shrink-0 space-y-4 ${
          mobileActiveView === 'devices' || (mobileActiveView === 'canvas' && (selectedDevice || selectedRack)) ? 'block' : 'hidden lg:block'
        }`}>
          {/* Selected Rack Inspector Drawer */}
          {selectedRack ? (
            <div className="bg-slate-900/95 border border-indigo-500/50 rounded-2xl p-4 shadow-xl space-y-4 animate-fadeIn">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 flex items-center justify-center shrink-0 shadow-sm">
                    <Server className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400 font-mono">
                      {isKu ? 'پشکنینی ڕاک' : 'Server Rack'} • {selectedRack.totalUnits}U
                    </span>
                    <h3 className="text-base font-bold text-white font-mono">
                      {isKu ? (selectedRack.nameKu || selectedRack.name) : selectedRack.name}
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedRack(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Coordinates Pill */}
              <div className="flex items-center justify-between p-2 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono">
                <span className="text-slate-400">{isKu ? 'شوێن لەسەر نەخشە:' : 'Map Coordinates:'}</span>
                <span className="text-indigo-400 font-bold">
                  X: {selectedRack.pos_x ?? '—'}% / Y: {selectedRack.pos_y ?? '—'}%
                </span>
              </div>

              {/* Location & Zone Details */}
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">{isKu ? 'زۆنی پرۆژە:' : 'Zone:'}</span>
                  <span className="text-slate-200 font-semibold">{formatEstateZone(selectedRack.zone, lang)}</span>
                </div>
                {selectedRack.location && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">{isKu ? 'ژوور / شوێن:' : 'Location:'}</span>
                    <span className="text-slate-300 truncate max-w-[170px]">{selectedRack.location}</span>
                  </div>
                )}
              </div>

              {/* Mounted Equipment in this Rack */}
              {(() => {
                const rackDevices = devices.filter((d) => {
                  if (!d.rack_name && !d.rack_id) return false;
                  const rName = selectedRack.name?.toLowerCase();
                  const rNameKu = selectedRack.nameKu?.toLowerCase();
                  const dName = d.rack_name?.toLowerCase();
                  return (
                    d.rack_id === selectedRack.id ||
                    d.rack_name === selectedRack.id ||
                    (rName && dName === rName) ||
                    (rNameKu && dName === rNameKu)
                  );
                });

                return (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{isKu ? 'ئامێرەکانی ناو ئەم ڕاکە:' : 'Mounted Equipment:'}</span>
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                        {rackDevices.length} {isKu ? 'ئامێر' : 'items'}
                      </span>
                    </div>

                    <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {rackDevices.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500 bg-slate-950/60 rounded-xl border border-slate-800/80 italic">
                          {isKu ? 'هیچ ئامێرێک بۆ ئەم ڕاکە دیاری نەکراوە' : 'No equipment currently assigned to this rack'}
                        </div>
                      ) : (
                        rackDevices.map((dev) => {
                          const model = boqModels.find((m) => m.id === dev.boq_model_id) || dev.boq_model;
                          const category = model ? categories.find((c) => c.id === model.category_id) : null;
                          const DevIcon = getIctDeviceIcon(dev, model, category);
                          const productImg = model?.product_image_url || '/default-ict-device.svg';
                          const formattedUnit = dev.rack_unit
                            ? (String(dev.rack_unit).toUpperCase().startsWith('U') ? dev.rack_unit : `U${dev.rack_unit}`)
                            : null;

                          return (
                            <div
                              key={dev.id}
                              onClick={() => {
                                setSelectedDevice(dev);
                                setSelectedRack(null);
                                setMobileActiveView('devices');
                              }}
                              className="p-2.5 bg-slate-950/85 hover:bg-slate-800/90 rounded-2xl border border-slate-800 hover:border-indigo-500/60 cursor-pointer transition-all duration-150 flex items-center justify-between gap-3 group shadow-sm hover:shadow-md hover:shadow-indigo-950/30"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                {/* Small Device Thumbnail Image with Category Dot */}
                                <div className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-800 p-1 flex items-center justify-center shrink-0 overflow-hidden relative shadow-inner group-hover:border-indigo-500/50 transition">
                                  <img
                                    src={productImg}
                                    alt={model?.model || 'Device'}
                                    className="w-full h-full object-contain"
                                    loading="lazy"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                      const fallback = e.currentTarget.parentElement?.querySelector('.device-icon-fallback');
                                      if (fallback) fallback.classList.remove('hidden');
                                    }}
                                  />
                                  <div className="device-icon-fallback hidden w-full h-full items-center justify-center text-indigo-400">
                                    <DevIcon className="w-5 h-5" />
                                  </div>
                                  {category?.color_code && (
                                    <div
                                      className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full border border-slate-900 shadow"
                                      style={{ backgroundColor: category.color_code }}
                                      title={isKu ? (category.name_ku || category.name) : category.name}
                                    />
                                  )}
                                </div>

                                {/* Label, Rack Unit & Model Name */}
                                <div className="min-w-0 space-y-0.5">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-mono text-xs font-bold text-white group-hover:text-indigo-300 transition tracking-tight">
                                      {dev.custom_label_id}
                                    </span>
                                    {formattedUnit && (
                                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                                        {formattedUnit}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-300 font-medium truncate">
                                    {model ? `${model.brand} ${model.model}` : 'Generic Device'}
                                  </p>
                                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                                    {dev.ip_address ? (
                                      <span className="text-cyan-400 font-semibold">{dev.ip_address}</span>
                                    ) : (
                                      <span className="text-slate-500">No IP</span>
                                    )}
                                    {dev.switch_port && (
                                      <span className="text-slate-500">• Port {dev.switch_port}</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right: Status Pill */}
                              <div className="shrink-0 flex items-center pr-1">
                                <span className={`w-2 h-2 rounded-full ${
                                  dev.installation_status === 'Verified'
                                    ? 'bg-emerald-400 shadow-sm shadow-emerald-500/50'
                                    : dev.installation_status === 'Configured'
                                    ? 'bg-indigo-400 shadow-sm shadow-indigo-500/50'
                                    : 'bg-blue-400 shadow-sm shadow-blue-500/50'
                                }`} title={dev.installation_status || 'Installed'} />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Action Buttons for Selected Rack */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsRackModalOpen(true)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 transition active:scale-95 cursor-pointer"
                >
                  <Settings2 className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{isKu ? 'بەڕێوەبردنی ئەم ڕاکە' : 'Manage / Rename Rack'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleUnpinRack(selectedRack)}
                  className="w-full px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-red-400 hover:bg-slate-800/50 transition cursor-pointer"
                >
                  {isKu ? 'لابردنی ڕاک لەسەر نەخشە' : 'Remove Rack from Blueprint'}
                </button>
              </div>
            </div>
          ) : selectedDevice ? (() => {
            const model = boqModels.find((m) => m.id === selectedDevice.boq_model_id) || selectedDevice.boq_model;
            const category = model ? categories.find((c) => c.id === model.category_id) : null;
            const DevIcon = getIctDeviceIcon(selectedDevice, model, category);

            return (
              <div className="bg-slate-900/95 border border-blue-500/40 rounded-2xl p-4 shadow-xl space-y-4 animate-fadeIn">
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

                {/* Hardware Device Photo & Model Name */}
                {model && (
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
                )}

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

              {/* Target Server Rack Selection (Visible whenever device is in a rack or rack-mounted) */}
              {(deviceZone === 'rack' || selectedDevice.placement_zone === 'rack' || model?.is_rack_mounted) && (
                <div className="p-3 bg-indigo-950/40 rounded-xl border-2 border-indigo-500/50 space-y-2.5 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-300">
                      <Server className="w-4 h-4 text-indigo-400" />
                      <span>{isKu ? 'ڕاکی هەڵبژێردراو (Rack Selection)' : 'Assigned Server Rack'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsRackModalOpen(true)}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1 transition cursor-pointer"
                    >
                      <Settings2 className="w-3 h-3" />
                      <span>{isKu ? 'دەستکاری' : 'Manage'}</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {isKu
                      ? 'ئەم ئامێرە لەناو ڕاک دایە. تکایە لەم لیستەدا ڕاکەکەی دیاری بکە:'
                      : 'This equipment is mounted inside a server rack. Select target rack cabinet:'}
                  </p>

                  <div className="space-y-2">
                    <select
                      value={selectedDevice.rack_name || ''}
                      onChange={(e) => handleUpdateDeviceRack(e.target.value)}
                      className="w-full bg-slate-900 border border-indigo-500/60 rounded-xl px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-indigo-400 shadow-inner cursor-pointer"
                    >
                      <option value="">{isKu ? '— ڕاکێک هەڵبژێرە —' : '— Select a Server Rack —'}</option>
                      {racks.map((r) => (
                        <option key={r.id} value={r.name}>
                          {isKu ? (r.nameKu || r.name) : r.name} ({r.totalUnits}U) {r.location ? `— ${r.location}` : ''}
                        </option>
                      ))}
                    </select>

                    {/* Rack Unit (RU Position) Input */}
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[11px] text-slate-400 font-mono shrink-0">
                        {isKu ? 'شوێنی یونت (U):' : 'Rack Unit (U):'}
                      </span>
                      <input
                        type="text"
                        defaultValue={selectedDevice.rack_unit || ''}
                        placeholder="e.g. U14, U1-U2"
                        onBlur={(e) => handleUpdateDeviceRack(selectedDevice.rack_name, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleUpdateDeviceRack(selectedDevice.rack_name, e.currentTarget.value);
                          }
                        }}
                        className="flex-1 bg-slate-900 border border-slate-700 focus:border-indigo-400 rounded-lg px-2.5 py-1 text-xs font-mono text-indigo-300 placeholder-slate-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

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
                <div className="flex justify-between items-center p-2 bg-slate-950/60 rounded-lg">
                  <span className="text-slate-400">Rack Location:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-200">
                      {selectedDevice.rack_name
                        ? `${selectedDevice.rack_name}${selectedDevice.rack_unit ? ` (${selectedDevice.rack_unit})` : ''}`
                        : (selectedDevice.rack_unit || 'Field Unit')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsRackModalOpen(true)}
                      className="text-blue-400 hover:text-blue-300 p-0.5 rounded cursor-pointer transition"
                      title={isKu ? 'دەستکاری ڕاکەکان' : 'Manage Racks'}
                    >
                      <Settings2 className="w-3 h-3" />
                    </button>
                  </div>
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
            );
          })() : (
            /* Unpinned Equipment & Server Racks Tray */
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">
                  {trayTab === 'equipment' ? t.unpinnedDevices : (isKu ? 'ڕاکە جێگیرنەکراوەکان' : 'Unpinned Server Racks')}
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                  {trayTab === 'equipment' ? unpinnedDevices.length : unpinnedRacks.length}
                </span>
              </div>

              {/* Tray Tab Switcher */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setTrayTab('equipment')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
                    trayTab === 'equipment'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>{isKu ? 'ئامێرەکان' : 'Equipment'}</span>
                  <span className="text-[10px] font-mono opacity-80">({unpinnedDevices.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTrayTab('racks')}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1 ${
                    trayTab === 'racks'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Server className="w-3.5 h-3.5" />
                  <span>{isKu ? 'ڕاکەکان' : 'Racks'}</span>
                  <span className="text-[10px] font-mono opacity-80">({unpinnedRacks.length})</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                {isKu
                  ? 'کلیک لەسەر هەر خاڵێکی نەخشەکە بکە بۆ دانان و پینکردنی ئامێر یان ڕاکی هەڵبژێردراو.'
                  : 'Click anywhere on the blueprint directly to anchor equipment or server racks.'}
              </p>

              {trayTab === 'equipment' ? (
                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1 custom-scrollbar">
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
                            const isTogglingOff = isSelectedForPlacement;
                            if (isTogglingOff) {
                              setDeviceToPlace(null);
                              setSelectedDeviceToAssign(null);
                              setIsPlacementMode(false);
                            } else {
                              setDeviceToPlace(dev);
                              setSelectedDeviceToAssign(dev);
                              setIsPlacementMode(true);
                              setMobileActiveView('canvas');
                            }
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
              ) : (
                <div className="space-y-2 max-h-[460px] overflow-y-auto pr-1 custom-scrollbar">
                  {unpinnedRacks.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 space-y-2 italic">
                      <p>{isKu ? 'هەموو ڕاکەکان لەسەر نەخشە جێگیرکراون!' : 'All server racks are currently pinned!'}</p>
                      <button
                        type="button"
                        onClick={() => setIsRackModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition cursor-pointer not-italic"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isKu ? '+ ڕاکی نوێ' : '+ Add New Rack'}</span>
                      </button>
                    </div>
                  ) : (
                    unpinnedRacks.map((rack) => {
                      const devicesInThisRack = devices.filter(
                        (d) =>
                          d.rack_name &&
                          (d.rack_name.toLowerCase() === rack.name.toLowerCase() ||
                            (rack.nameKu && d.rack_name.toLowerCase() === rack.nameKu.toLowerCase()) ||
                            d.rack_name === rack.id)
                      );

                      return (
                        <div
                          key={rack.id}
                          className="p-3 rounded-xl border border-slate-800/80 bg-slate-950/70 hover:border-indigo-500/50 transition flex items-center justify-between gap-2.5"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border bg-slate-900 border-indigo-500/30 text-indigo-400">
                              <Server className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold font-mono text-white truncate">
                                  {isKu ? (rack.nameKu || rack.name) : rack.name}
                                </p>
                                <span className="text-[9px] font-mono font-bold px-1 rounded bg-indigo-500/20 text-indigo-300">
                                  {rack.totalUnits}U
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 truncate">
                                {rack.location || (isKu ? 'ژووری سێرڤەر' : 'Server Room')} • {devicesInThisRack.length} devs
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRackToAssign(rack);
                              setPlacementModalTab('racks');
                              // prompt user by setting default active click coord or letting them click
                              setActiveClickCoord({ x: 50, y: 50 });
                            }}
                            className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition active:scale-95 shrink-0 cursor-pointer"
                          >
                            {isKu ? '+ دانان' : 'Pin +'}
                          </button>
                        </div>
                      );
                    })
                  )}

                  <div className="pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setIsRackModalOpen(true)}
                      className="w-full py-2 px-3 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-indigo-300 border border-slate-800 flex items-center justify-center gap-1.5 transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isKu ? '+ دروستکردن یان دەستکاری ڕاکەکان' : '+ Manage & Add Racks'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Site Plan / Floor Plan Modal */}
      <AddFloorPlanModal
        isOpen={isAddPlanModalOpen}
        onClose={() => setIsAddPlanModalOpen(false)}
        onCreateFloorPlan={onCreateFloorPlan}
        defaultPlanType={selectedPlanTypeFilter !== 'all' ? selectedPlanTypeFilter : 'ICT'}
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

      {/* Dynamic Server Rack & Cabinet Manager Modal */}
      <RackManagerModal
        isOpen={isRackModalOpen}
        onClose={() => setIsRackModalOpen(false)}
        devices={devices}
        lang={lang}
      />

      {/* Dedicated Manual Device Placement Modal Dialog with Modern UI/UX & Thumbnails (Isolated outside viewport) */}
            {/* Dedicated Manual Device Placement Modal Dialog with Modern UI/UX & Thumbnails */}
            {activeClickCoord && (
              <div
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn"
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
                onClick={() => {
                  setActiveClickCoord(null);
                  setIsPlacementMode(false);
                  setDeviceToPlace(null);
                  setSelectedDeviceToAssign(null);
                  setAssignSearch('');
                  setAssignCategory('all');
                }}
              >
                <div
                  className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col max-h-[88vh] overflow-hidden animate-scaleIn no-map-zoom"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shadow-inner shrink-0">
                        <MapPin className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <h4 className="text-base font-bold text-white tracking-tight">
                          {isKu ? 'دیاریکردنی ئامێر یان ڕاک بۆ پینکردن لەم خاڵەدا' : 'Pin Equipment or Rack at Location'}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                          <span className="font-medium text-slate-300">
                            {isKu ? (activePlan?.name_ku || activePlan?.name) : activePlan?.name}
                          </span>
                          <span>•</span>
                          <span className="font-mono text-blue-400 font-semibold bg-blue-950/60 px-2 py-0.5 rounded-md border border-blue-800/40 text-[11px]">
                            X: {activeClickCoord.x}% | Y: {activeClickCoord.y}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveClickCoord(null);
                        setIsPlacementMode(false);
                        setDeviceToPlace(null);
                        setSelectedDeviceToAssign(null);
                        setSelectedRackToAssign(null);
                        setAssignSearch('');
                        setAssignCategory('all');
                        setRackSearch('');
                      }}
                      className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Mode Tabs: Equipment vs Server Racks */}
                  <div className="flex items-center gap-2 p-1 bg-slate-950 rounded-2xl border border-slate-800 shrink-0 mt-3">
                    <button
                      type="button"
                      onClick={() => setPlacementModalTab('equipment')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                        placementModalTab === 'equipment'
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Cpu className="w-3.5 h-3.5" />
                      <span>{isKu ? 'ئامێرەکان' : 'Equipment'}</span>
                      <span className="text-[10px] font-mono opacity-80">({unpinnedDevices.length})</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlacementModalTab('racks')}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                        placementModalTab === 'racks'
                          ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/30'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Server className="w-3.5 h-3.5" />
                      <span>{isKu ? 'ڕاکەکانی سێرڤەر' : 'Server Racks'}</span>
                      <span className="text-[10px] font-mono opacity-80">({unpinnedRacks.length})</span>
                    </button>
                  </div>

                  {placementModalTab === 'equipment' ? (
                    <>
                      {/* Search & Category Filter Bar */}
                      <div className="pt-3 pb-2 space-y-2.5 shrink-0">
                        <div className="relative">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={assignSearch}
                            onChange={(e) => setAssignSearch(e.target.value)}
                            placeholder={isKu ? 'گەڕان بەپێی لەیبڵ، براند، مۆدێل، یان ئایپی...' : 'Search equipment by label, brand, model, IP...'}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition shadow-inner"
                            autoFocus
                          />
                          {assignSearch && (
                            <button
                              type="button"
                              onClick={() => setAssignSearch('')}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Quick Category Tabs */}
                        {categories.length > 0 && (
                          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] no-scrollbar">
                            <button
                              type="button"
                              onClick={() => setAssignCategory('all')}
                              className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition cursor-pointer ${
                                assignCategory === 'all'
                                  ? 'bg-blue-600 text-white shadow-sm'
                                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                              }`}
                            >
                              {isKu ? 'هەموو بەشەکان' : 'All'} ({unpinnedDevices.length})
                            </button>
                            {categories
                              .filter((c) =>
                                unpinnedDevices.some((d) => {
                                  const m = boqModels.find((b) => b.id === d.boq_model_id);
                                  return m?.category_id === c.id;
                                })
                              )
                              .map((cat) => {
                                const count = unpinnedDevices.filter((d) => {
                                  const m = boqModels.find((b) => b.id === d.boq_model_id);
                                  return m?.category_id === cat.id;
                                }).length;
                                return (
                                  <button
                                    key={cat.id}
                                    type="button"
                                    onClick={() => setAssignCategory(cat.id)}
                                    className={`px-2.5 py-1 rounded-lg font-medium whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                                      assignCategory === cat.id
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                                    }`}
                                  >
                                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cat.color_code || '#3B82F6' }} />
                                    <span>{isKu ? (cat.name_ku || cat.name) : cat.name}</span>
                                    <span className="opacity-70 text-[10px]">({count})</span>
                                  </button>
                                );
                              })}
                          </div>
                        )}
                      </div>

                      {/* Equipment List (Scrollable Cards with Thumbnails) */}
                      <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[340px] space-y-2 pr-1 custom-scrollbar">
                        {filteredDevicesToAssign.length === 0 ? (
                          <div className="py-12 flex flex-col items-center justify-center text-center text-slate-500 space-y-2">
                            <Cpu className="w-10 h-10 text-slate-600 stroke-1" />
                            <p className="text-xs font-medium text-slate-400">
                              {assignSearch
                                ? (isKu ? 'هیچ ئامێرێک نەدۆزرایەوە بەپێی ئەم گەڕانە' : 'No equipment found matching filter')
                                : (isKu ? 'هیچ ئامێرێکی دانەنراو نەماوە' : 'No unpinned equipment remaining')}
                            </p>
                          </div>
                        ) : (
                          filteredDevicesToAssign.map((dev) => {
                            const m = boqModels.find((b) => b.id === dev.boq_model_id);
                            const cat = m ? categories.find((c) => c.id === m.category_id) : null;
                            const isSelected = selectedDeviceToAssign?.id === dev.id;
                            const productImg = m?.product_image_url || '/default-ict-device.svg';

                            return (
                              <div
                                key={dev.id}
                                onClick={() => setSelectedDeviceToAssign(dev)}
                                onDoubleClick={() => handleAssignDeviceToCoord(dev)}
                                className={`group p-3 rounded-2xl border transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 ${
                                  isSelected
                                    ? 'bg-blue-950/40 border-blue-500 ring-2 ring-blue-500/30 shadow-lg shadow-blue-950/50'
                                    : 'bg-slate-950/80 hover:bg-slate-800/60 border-slate-800 hover:border-slate-700'
                                }`}
                              >
                                {/* Left: Device Thumbnail & Info */}
                                <div className="flex items-center gap-3 min-w-0">
                                  {/* Small Device Thumbnail Image */}
                                  <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800/80 p-1 flex items-center justify-center shrink-0 overflow-hidden relative group-hover:border-slate-700 shadow-inner">
                                    <img
                                      src={productImg}
                                      alt={m?.model || 'Device'}
                                      className="w-full h-full object-contain"
                                      loading="lazy"
                                    />
                                    <div
                                      className="absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full border border-slate-900"
                                      style={{ backgroundColor: cat?.color_code || '#3B82F6' }}
                                    />
                                  </div>

                                  {/* Details */}
                                  <div className="min-w-0 space-y-0.5">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-xs font-bold text-white tracking-tight">
                                        {dev.custom_label_id}
                                      </span>
                                      {cat && (
                                        <span
                                          className="px-2 py-0.5 rounded-md text-[10px] font-semibold border"
                                          style={{
                                            backgroundColor: `${cat.color_code || '#3B82F6'}15`,
                                            color: cat.color_code || '#3B82F6',
                                            borderColor: `${cat.color_code || '#3B82F6'}30`,
                                          }}
                                        >
                                          {isKu ? (cat.name_ku || cat.name) : cat.name}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-slate-300 font-medium truncate">
                                      {m ? `${m.brand} ${m.model}` : 'Generic Device'}
                                    </p>
                                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                                      {dev.ip_address ? (
                                        <span className="text-cyan-400 font-semibold">{dev.ip_address}</span>
                                      ) : (
                                        <span className="text-slate-500">No IP</span>
                                      )}
                                      {dev.switch_name && (
                                        <span>• {dev.switch_name} [{dev.switch_port || 'P1'}]</span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Right: Selection Indicator */}
                                <div className="shrink-0 flex items-center pr-1">
                                  <div
                                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                                      isSelected
                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50 ring-2 ring-blue-400/50'
                                        : 'border-2 border-slate-700 bg-slate-900/60 text-transparent group-hover:border-slate-500'
                                    }`}
                                  >
                                    <Check className={`w-3.5 h-3.5 ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Modal Footer for Equipment */}
                      <div className="pt-3.5 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
                        <span className="text-xs text-slate-400">
                          {selectedDeviceToAssign ? (
                            <span className="text-blue-400 font-semibold">
                              {isKu ? 'ئامێری هەڵبژێردراو:' : 'Selected:'} <strong className="text-white font-mono">{selectedDeviceToAssign.custom_label_id}</strong>
                            </span>
                          ) : (
                            <span>{isKu ? 'تکایە ئامێرێک لە لیستەکە هەڵبژێرە' : 'Select an equipment to pin'}</span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveClickCoord(null);
                              setIsPlacementMode(false);
                              setDeviceToPlace(null);
                              setSelectedDeviceToAssign(null);
                              setSelectedRackToAssign(null);
                              setAssignSearch('');
                              setAssignCategory('all');
                              setRackSearch('');
                            }}
                            className="py-2 px-3.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                          >
                            {isKu ? 'پاشگەزبوونەوە' : 'Cancel'}
                          </button>
                          <button
                            type="button"
                            disabled={!selectedDeviceToAssign}
                            onClick={() => {
                              if (selectedDeviceToAssign) handleAssignDeviceToCoord(selectedDeviceToAssign);
                            }}
                            className="py-2 px-4 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 text-white shadow-lg shadow-blue-900/40 transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                            <span>{isKu ? 'سەلماندن و دانان' : 'Confirm & Pin'}</span>
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Search for Server Racks */}
                      <div className="pt-3 pb-2 shrink-0">
                        <div className="relative">
                          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            type="text"
                            value={rackSearch}
                            onChange={(e) => setRackSearch(e.target.value)}
                            placeholder={isKu ? 'گەڕان بۆ ڕاک بەپێی ناو، شوێن، زۆن...' : 'Search server racks by name, room, zone...'}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl pl-10 pr-9 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition shadow-inner"
                            autoFocus
                          />
                          {rackSearch && (
                            <button
                              type="button"
                              onClick={() => setRackSearch('')}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white p-0.5 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Server Racks List */}
                      <div className="flex-1 overflow-y-auto min-h-[200px] max-h-[340px] space-y-2 pr-1 custom-scrollbar">
                        {filteredRacksToAssign.length === 0 ? (
                          <div className="py-12 flex flex-col items-center justify-center text-center text-slate-500 space-y-3">
                            <Server className="w-10 h-10 text-slate-600 stroke-1" />
                            <p className="text-xs font-medium text-slate-400">
                              {rackSearch
                                ? (isKu ? 'هیچ ڕاکێک نەدۆزرایەوە بەپێی ئەم گەڕانە' : 'No server racks match your search')
                                : (isKu ? 'هەموو ڕاکەکان لەسەر نەخشە جێگیرکراون!' : 'All server racks are currently pinned to maps!')}
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveClickCoord(null);
                                setIsRackModalOpen(true);
                              }}
                              className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition flex items-center gap-1.5 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>{isKu ? '+ دروستکردنی ڕاکی نوێ' : '+ Create New Rack'}</span>
                            </button>
                          </div>
                        ) : (
                          filteredRacksToAssign.map((rack) => {
                            const isSelected = selectedRackToAssign?.id === rack.id;
                            const devicesInThisRack = devices.filter(
                              (d) =>
                                d.rack_name &&
                                (d.rack_name.toLowerCase() === rack.name.toLowerCase() ||
                                  (rack.nameKu && d.rack_name.toLowerCase() === rack.nameKu.toLowerCase()) ||
                                  d.rack_name === rack.id)
                            );

                            return (
                              <div
                                key={rack.id}
                                onClick={() => setSelectedRackToAssign(rack)}
                                onDoubleClick={() => handleAssignRackToCoord(rack)}
                                className={`group p-3 rounded-2xl border transition-all duration-150 cursor-pointer flex items-center justify-between gap-3 ${
                                  isSelected
                                    ? 'bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/30 shadow-lg shadow-indigo-950/50'
                                    : 'bg-slate-950/80 hover:bg-slate-800/60 border-slate-800 hover:border-slate-700'
                                }`}
                              >
                                {/* Left: Rack Icon & Info */}
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-12 h-12 rounded-xl bg-slate-900 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-inner group-hover:border-indigo-500/60 transition">
                                    <Server className="w-6 h-6 text-indigo-400 drop-shadow" />
                                  </div>

                                  <div className="min-w-0 space-y-0.5">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono text-xs font-bold text-white tracking-tight">
                                        {isKu ? (rack.nameKu || rack.name) : rack.name}
                                      </span>
                                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 font-mono">
                                        {rack.totalUnits}U Cabinet
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-300 font-medium truncate">
                                      {rack.location || (isKu ? 'ژووری سێرڤەر' : 'Server Room')}
                                      {rack.zone && ` • ${formatEstateZone(rack.zone, lang)}`}
                                    </p>
                                    <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                                      <span className="text-emerald-400 font-semibold">
                                        {devicesInThisRack.length} {isKu ? 'ئامێری تێدایە' : 'devices mounted'}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Right: Selection Indicator */}
                                <div className="shrink-0 flex items-center pr-1">
                                  <div
                                    className={`w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                                      isSelected
                                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/50 ring-2 ring-indigo-400/50'
                                        : 'border-2 border-slate-700 bg-slate-900/60 text-transparent group-hover:border-slate-500'
                                    }`}
                                  >
                                    <Check className={`w-3.5 h-3.5 ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Modal Footer for Racks */}
                      <div className="pt-3.5 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
                        <span className="text-xs text-slate-400">
                          {selectedRackToAssign ? (
                            <span className="text-indigo-400 font-semibold">
                              {isKu ? 'ڕاکی هەڵبژێردراو:' : 'Selected:'} <strong className="text-white font-mono">{isKu ? (selectedRackToAssign.nameKu || selectedRackToAssign.name) : selectedRackToAssign.name}</strong>
                            </span>
                          ) : (
                            <span>{isKu ? 'تکایە ڕاکێک لە لیستەکە هەڵبژێرە' : 'Select a server rack to pin'}</span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setActiveClickCoord(null);
                              setIsPlacementMode(false);
                              setDeviceToPlace(null);
                              setSelectedDeviceToAssign(null);
                              setSelectedRackToAssign(null);
                              setAssignSearch('');
                              setAssignCategory('all');
                              setRackSearch('');
                            }}
                            className="py-2 px-3.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                          >
                            {isKu ? 'پاشگەزبوونەوە' : 'Cancel'}
                          </button>
                          <button
                            type="button"
                            disabled={!selectedRackToAssign}
                            onClick={() => {
                              if (selectedRackToAssign) handleAssignRackToCoord(selectedRackToAssign);
                            }}
                            className="py-2 px-4 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white shadow-lg shadow-indigo-900/40 transition active:scale-95 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Check className="w-4 h-4" />
                            <span>{isKu ? 'سەلماندن و دانان' : 'Confirm & Pin Rack'}</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
    </div>
  );
}
