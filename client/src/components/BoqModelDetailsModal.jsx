import React, { useState, useEffect, useMemo } from 'react';
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
  Edit2,
  Camera,
  Upload,
  Image as ImageIcon,
  Trash2,
  RefreshCw,
  Settings2,
  Plug,
  Sliders,
  AlertCircle,
} from 'lucide-react';
import { translations } from '../i18n/translations';
import { api } from '../services/api';
import QuickAddCategoryModal from './QuickAddCategoryModal';
import { useRacks } from '../utils/rackManager';
import RackManagerModal from './RackManagerModal';
import { DEFAULT_ICT_IMAGE, getEffectiveProductImage } from '../utils/defaultIctImage';
import { getFloorPlanDisplayLabel } from '../utils/floorLevels';

// Helper function to compress and resize image files before saving
const compressImageFile = (file, maxWidth = 1200, maxHeight = 900, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Selected file is not an image'));
    }
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

export default function BoqModelDetailsModal({
  model,
  category,
  categories = [],
  boqModels = [],
  devices = [],
  floorPlans = [],
  isOpen,
  onClose,
  initialTab = 'provision',
  onUpdateModel,
  onUpdateTotalQty,
  onCreateDevice,
  onUpdateStatus,
  onNavigateToMap,
  onCreateCategory,
  lang = 'en',
}) {
  if (!isOpen || !model) return null;

  const t = translations[lang] || translations.en;
  const isKu = lang === 'ku';

  // Active Category resolution
  const currentCategory = categories.find((c) => c.id === (model?.category_id || category?.id)) || category || model?.category;

  // Devices provisioned for this specific BOQ model
  const modelDevices = devices.filter((d) => d.boq_model_id === model.id);
  const provisionedCount = modelDevices.length;

  const { racks } = useRacks(devices);
  const [isRackModalOpen, setIsRackModalOpen] = useState(false);

  // Active Tab inside modal: 'details' | 'provision' | 'instances' | 'barcode' | 'edit'
  const [activeTab, setActiveTab] = useState(initialTab || 'provision');

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, model?.id]);

  // Quantity edit state
  const [targetQty, setTargetQty] = useState(model.total_qty || 1);
  const [isUpdatingQty, setIsUpdatingQty] = useState(false);
  const [qtySavedToast, setQtySavedToast] = useState(false);

  // Edit BOQ Model full state
  const [editForm, setEditForm] = useState({
    description: '',
    brand: '',
    model: '',
    category_id: '',
    total_qty: 1,
    unit_cost: 0,
    product_image_url: '',
    manual_pdf_url: '',
    allowed_zones: ['indoor'],
    is_rack_mounted: false,
    rack_unit_size: 1,
    custom_specs_text: '',
  });

  const [newLocationInput, setNewLocationInput] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editSavedToast, setEditSavedToast] = useState(false);

  // Photo upload and management state
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoToast, setPhotoToast] = useState(null);

  // Directly upload and save new photo for model into Supabase Storage Bucket ('boq-images')
  const handleUploadPhoto = async (file) => {
    if (!file) return;
    try {
      setIsUploadingPhoto(true);
      const dataUrl = await compressImageFile(file, 1200, 900, 0.85);
      
      // Update local edit form preview immediately
      setEditForm((prev) => ({ ...prev, product_image_url: dataUrl }));

      let finalUrl = dataUrl;
      try {
        // Upload directly into Supabase Storage Bucket 'boq-images'
        const uploadRes = await api.uploadBoqImage(model.id, dataUrl);
        if (uploadRes?.publicUrl) {
          finalUrl = uploadRes.publicUrl;
          setEditForm((prev) => ({ ...prev, product_image_url: finalUrl }));
        }
      } catch (uploadErr) {
        console.warn('Storage bucket upload blip, saving as direct data URL:', uploadErr);
      }

      // Save to parent BOQ model state & database
      const updater = onUpdateModel || onUpdateTotalQty;
      if (updater) {
        await updater(model.id, { product_image_url: finalUrl });
      }

      setPhotoToast(
        isKu
          ? 'وێنەکە بە سەرکەوتوویی لە ناو بەکێتی سوپەبەیس (boq-images) سەیڤ کرا!'
          : 'Photo saved into Supabase Storage Bucket (boq-images)!'
      );
      setTimeout(() => setPhotoToast(null), 3500);
    } catch (err) {
      alert(err.message || 'Failed to process image');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!window.confirm(isKu ? 'دڵنیایت لە سڕینەوەی وێنەی ئەم ئامێرە؟' : 'Are you sure you want to remove this hardware photo?')) return;
    try {
      setIsUploadingPhoto(true);
      setEditForm((prev) => ({ ...prev, product_image_url: '' }));
      const updater = onUpdateModel || onUpdateTotalQty;
      if (updater) {
        await updater(model.id, { product_image_url: null });
      }
      setPhotoToast(isKu ? 'وێنەی ئامێرەکە سڕایەوە' : 'Device photo removed');
      setTimeout(() => setPhotoToast(null), 3000);
    } catch (err) {
      alert(err.message || 'Failed to remove image');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Fullscreen image zoom
  const [isImageLightboxOpen, setIsImageLightboxOpen] = useState(false);
  const [imageScale, setImageScale] = useState(1);

  // Barcode / Sticker view device
  const [barcodeDevice, setBarcodeDevice] = useState(null);

  // New Provision Form State (English inputs as requested)
  const defaultZone = model.is_rack_mounted ? 'rack' : model.allowed_zones?.[0] || 'indoor';
  const defaultFloor = '';

  const cleanPrefix = `${model.brand.substring(0, 3).toUpperCase()}-${model.model.replace(/[^A-Za-z0-9]/g, '').substring(0, 4).toUpperCase()}`;
  const nextNum = String(provisionedCount + 1).padStart(2, '0');

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  // Sockets resolution for connection linking
  const socketCategory = categories.find((c) =>
    c.name?.toLowerCase().includes('socket') ||
    c.name_ku?.includes('سۆکێت') ||
    c.icon_name === 'Plug'
  );

  const socketBoqModels = boqModels.filter((m) => {
    if (socketCategory && m.category_id === socketCategory.id) return true;
    const desc = `${m.brand} ${m.model} ${m.description || ''}`.toLowerCase();
    return desc.includes('socket') || desc.includes('faceplate') || desc.includes('outlet') || desc.includes('سۆکێت');
  });

  const [form, setForm] = useState({
    custom_label_id: '',
    serial_number: '',
    barcode: '',
    mac_address: '',
    ip_address: '',
    subnet_mask: '',
    gateway: '',
    vlan_id: '',
    connection_type: 'switch', // 'socket' | 'patch_panel' | 'switch'
    connected_socket_id: '',
    connected_socket_label: '',
    connected_socket_model_id: '',
    patch_panel_name: '',
    patch_panel_port: '',
    switch_name: '',
    switch_port: '',
    rack_name: '',
    rack_unit: '',
    placement_zone: defaultZone,
    floor_plan_id: defaultFloor,
    installation_status: 'Pending',
    notes: '',
  });

  const socketDevices = devices.filter((d) => {
    if (form.connected_socket_model_id) {
      return d.boq_model_id === form.connected_socket_model_id;
    }
    return socketBoqModels.some((sm) => sm.id === d.boq_model_id);
  });

  const [isCustomPatchPort, setIsCustomPatchPort] = useState(false);
  const [isCustomSwitchPort, setIsCustomSwitchPort] = useState(false);

  const normPort = (p) => {
    if (!p && p !== 0) return '';
    return String(p).trim().toLowerCase().replace(/^port\s*/i, '');
  };

  // 1. Occupied Sockets Map
  const occupiedSocketMap = useMemo(() => {
    const map = new Map();
    devices.forEach((d) => {
      const isSocket = d.connection_type === 'socket' || (!d.connection_type && d.connected_socket_id);
      if (isSocket && d.connected_socket_id) {
        map.set(d.connected_socket_id, d.custom_label_id || d.serial_number || `Device #${d.id.slice(0, 6)}`);
      }
    });
    return map;
  }, [devices]);

  // Available Sockets (excluding occupied ones)
  const availableSocketDevices = useMemo(() => {
    return socketDevices.filter((s) => {
      if (form.connected_socket_id === s.id) return true;
      return !occupiedSocketMap.has(s.id);
    });
  }, [socketDevices, occupiedSocketMap, form.connected_socket_id]);

  const socketConflict = form.connection_type === 'socket' && form.connected_socket_id
    ? occupiedSocketMap.get(form.connected_socket_id)
    : null;

  // 2. Patch Panel Port Exclusivity
  const knownPatchPanels = useMemo(() => {
    const set = new Set(['PP-IDF01-24P', 'PP-IDF02-24P', 'PP-IDF03-24P', 'PP-IDF04-24P', 'PP-MAIN-MDF-48P']);
    devices.forEach((d) => {
      if (d.patch_panel_name) set.add(d.patch_panel_name.trim());
      else if (d.switch_name?.startsWith('PP:')) set.add(d.switch_name.replace('PP:', '').trim());
    });
    return Array.from(set).filter(Boolean);
  }, [devices]);

  const occupiedPatchPorts = useMemo(() => {
    const map = new Map();
    const currentPP = (form.patch_panel_name || '').trim().toLowerCase();
    if (!currentPP) return map;

    devices.forEach((d) => {
      const isPP = d.connection_type === 'patch_panel' || (!d.connection_type && (d.patch_panel_name || d.switch_name?.startsWith('PP:')));
      if (isPP) {
        const ppName = (d.patch_panel_name || (d.switch_name?.startsWith('PP:') ? d.switch_name.replace('PP:', '') : '')).trim().toLowerCase();
        if (ppName === currentPP) {
          const port = d.patch_panel_port || (d.switch_port && !d.switch_port.startsWith('PP:') ? d.switch_port : null);
          if (port) {
            map.set(normPort(port), d.custom_label_id || d.serial_number || `Device #${d.id.slice(0, 6)}`);
          }
        }
      }
    });
    return map;
  }, [devices, form.patch_panel_name]);

  const availablePatchPorts = useMemo(() => {
    const totalPorts = form.patch_panel_name?.includes('48') ? 48 : 24;
    const ports = [];
    for (let i = 1; i <= totalPorts; i++) {
      const pStr = String(i);
      if (!occupiedPatchPorts.has(pStr)) {
        ports.push(pStr);
      }
    }
    return ports;
  }, [form.patch_panel_name, occupiedPatchPorts]);

  const patchConflict = form.connection_type === 'patch_panel' && (form.patch_panel_port || form.switch_port)
    ? occupiedPatchPorts.get(normPort(form.patch_panel_port || form.switch_port))
    : null;

  // 3. Switch Port Exclusivity
  const knownSwitches = useMemo(() => {
    const set = new Set(['SW-CORE-RACK-48P', 'SW-EDGE-POOL-24P', 'SW-CCTV-SEC-24P', 'SW-POE-MAIN-48P']);
    devices.forEach((d) => {
      if (d.connection_type === 'switch' && d.switch_name && !d.switch_name.startsWith('Socket:') && !d.switch_name.startsWith('PP:')) {
        set.add(d.switch_name.trim());
      }
    });
    return Array.from(set).filter(Boolean);
  }, [devices]);

  const occupiedSwitchPorts = useMemo(() => {
    const map = new Map();
    const currentSW = (form.switch_name || '').trim().toLowerCase();
    if (!currentSW) return map;

    devices.forEach((d) => {
      const isSW = d.connection_type === 'switch' || (!d.connection_type && d.switch_name && !d.switch_name.startsWith('Socket:') && !d.switch_name.startsWith('PP:'));
      if (isSW) {
        const swName = (d.switch_name || '').trim().toLowerCase();
        if (swName === currentSW && d.switch_port) {
          map.set(normPort(d.switch_port), d.custom_label_id || d.serial_number || `Device #${d.id.slice(0, 6)}`);
        }
      }
    });
    return map;
  }, [devices, form.switch_name]);

  const availableSwitchPorts = useMemo(() => {
    const totalPorts = form.switch_name?.includes('48') ? 48 : 24;
    const ports = [];
    for (let i = 1; i <= totalPorts; i++) {
      const pStr = String(i);
      if (!occupiedSwitchPorts.has(pStr)) {
        ports.push(pStr);
      }
    }
    return ports;
  }, [form.switch_name, occupiedSwitchPorts]);

  const switchConflict = form.connection_type === 'switch' && form.switch_port
    ? occupiedSwitchPorts.get(normPort(form.switch_port))
    : null;

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset targetQty and editForm when model changes
  useEffect(() => {
    if (model) {
      setTargetQty(model.total_qty || 1);
      setEditForm({
        description: model.description || '',
        brand: model.brand || '',
        model: model.model || '',
        category_id: model.category_id || (category?.id || ''),
        total_qty: model.total_qty || 1,
        unit_cost: model.unit_cost || 0,
        product_image_url: model.product_image_url || '',
        manual_pdf_url: model.manual_pdf_url || '',
        allowed_zones: Array.isArray(model.allowed_zones) && model.allowed_zones.length > 0 ? [...model.allowed_zones] : ['indoor'],
        is_rack_mounted: Boolean(model.is_rack_mounted),
        rack_unit_size: model.rack_unit_size || 1,
        custom_specs_text: model.custom_specs && typeof model.custom_specs === 'object' ? JSON.stringify(model.custom_specs, null, 2) : '',
      });
    }
  }, [model, category]);

  // Handle Zone Toggle
  const handleToggleZone = (zoneKey) => {
    setEditForm((prev) => {
      const exists = prev.allowed_zones.includes(zoneKey);
      if (exists) {
        if (prev.allowed_zones.length <= 1) {
          alert(isKu ? 'دەبێت لانیکەم یەک شوێن دیاریکراو بێت' : 'At least one location must remain selected');
          return prev;
        }
        return {
          ...prev,
          allowed_zones: prev.allowed_zones.filter((z) => z !== zoneKey),
        };
      } else {
        return {
          ...prev,
          allowed_zones: [...prev.allowed_zones, zoneKey],
        };
      }
    });
  };

  // Handle Adding Custom Location Tag
  const handleAddCustomLocation = (e) => {
    if (e) e.preventDefault();
    const loc = newLocationInput.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_-]/g, '');
    if (!loc) return;
    if (editForm.allowed_zones.includes(loc)) {
      setNewLocationInput('');
      return;
    }
    setEditForm((prev) => ({
      ...prev,
      allowed_zones: [...prev.allowed_zones, loc],
    }));
    setNewLocationInput('');
  };

  // Handle Removing Location Tag
  const handleRemoveLocation = (loc) => {
    if (editForm.allowed_zones.length <= 1) {
      alert(isKu ? 'دەبێت لانیکەم یەک شوێن هەبێت' : 'At least one location is required');
      return;
    }
    setEditForm((prev) => ({
      ...prev,
      allowed_zones: prev.allowed_zones.filter((z) => z !== loc),
    }));
  };

  // Handle Full Model Update (Description, Locations, Brand, Model, Qty, etc.)
  const handleSaveModelEdit = async (e) => {
    if (e) e.preventDefault();
    if (!editForm.brand.trim() || !editForm.model.trim()) {
      alert(isKu ? 'براند و مۆدێل پێویستن' : 'Brand and Model are required');
      return;
    }

    let parsedSpecs = {};
    if (editForm.custom_specs_text.trim()) {
      try {
        parsedSpecs = JSON.parse(editForm.custom_specs_text);
      } catch {
        alert(isKu ? 'تایبەتمەندییەکان دەبێت فۆرماتی دروستی JSON بن' : 'Custom specs must be valid JSON format');
        return;
      }
    }

    try {
      setIsSavingEdit(true);
      const updates = {
        description: editForm.description.trim(),
        brand: editForm.brand.trim(),
        model: editForm.model.trim(),
        category_id: editForm.category_id,
        total_qty: Number(editForm.total_qty) || 1,
        unit_cost: Number(editForm.unit_cost) || 0,
        product_image_url: editForm.product_image_url.trim() || null,
        manual_pdf_url: editForm.manual_pdf_url.trim() || null,
        allowed_zones: editForm.allowed_zones.length > 0 ? editForm.allowed_zones : ['indoor'],
        is_rack_mounted: Boolean(editForm.is_rack_mounted),
        rack_unit_size: editForm.is_rack_mounted ? (Number(editForm.rack_unit_size) || 1) : 0,
        custom_specs: parsedSpecs,
      };

      const updater = onUpdateModel || onUpdateTotalQty;
      if (updater) {
        await updater(model.id, updates);
        setTargetQty(updates.total_qty);
        setEditSavedToast(true);
        setTimeout(() => setEditSavedToast(false), 3000);
      }
    } catch (err) {
      alert(err.message || 'Failed to save changes');
    } finally {
      setIsSavingEdit(false);
    }
  };

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

    if (form.connection_type === 'socket' && form.connected_socket_id && socketConflict) {
      alert(isKu ? `⚠️ ناتوانرێت زیاد بکرێت: ئەم سۆکێتە پێشتر بە ئامێری [${socketConflict}] بەستراوەتەوە و ناتوانرێت بۆ دوو دیڤایس بەکاربهێنرێت!` : `Cannot save: Socket is already linked to device [${socketConflict}]!`);
      return;
    }
    if (form.connection_type === 'patch_panel' && form.patch_panel_name && (form.patch_panel_port || form.switch_port) && patchConflict) {
      alert(isKu ? `⚠️ ناتوانرێت زیاد بکرێت: ئەم پۆرتە لەسەر پاچ پەناڵ پێشتر بە ئامێری [${patchConflict}] بەستراوەتەوە و ناتوانرێت بۆ دوو دیڤایس بەکاربهێنرێت!` : `Cannot save: Patch panel port is already linked to device [${patchConflict}]!`);
      return;
    }
    if (form.connection_type === 'switch' && form.switch_name && form.switch_port && switchConflict) {
      alert(isKu ? `⚠️ ناتوانرێت زیاد بکرێت: ئەم پۆرتە لەسەر سویچ پێشتر بە ئامێری [${switchConflict}] بەستراوەتەوە و ناتوانرێت بۆ دوو دیڤایس بەکاربهێنرێت!` : `Cannot save: Switch port is already linked to device [${switchConflict}]!`);
      return;
    }

    try {
      setIsSubmitting(true);
      const finalLabel = form.custom_label_id.trim()
        ? form.custom_label_id.trim().toUpperCase()
        : '';
      const finalSerial = form.serial_number.trim() || form.barcode.trim() || `SN-${Date.now().toString().slice(-6)}`;

      const payload = {
        boq_model_id: model.id,
        custom_label_id: finalLabel,
        serial_number: finalSerial,
        mac_address: form.mac_address.trim() || null,
        ip_address: form.ip_address.trim() || null,
        subnet_mask: form.subnet_mask.trim() || '255.255.255.0',
        gateway: form.gateway.trim() || '192.168.10.1',
        vlan_id: form.vlan_id ? Number(form.vlan_id) : 10,
        connection_type: form.connection_type || 'switch',
        connected_socket_id: form.connected_socket_id || null,
        connected_socket_label: form.connected_socket_label || null,
        connected_socket_model_id: form.connected_socket_model_id || null,
        patch_panel_name: form.patch_panel_name ? form.patch_panel_name.trim() : null,
        patch_panel_port: form.patch_panel_port ? form.patch_panel_port.trim() : null,
        switch_name: form.switch_name.trim() || null,
        switch_port: form.switch_port.trim() || null,
        rack_name: form.placement_zone === 'rack' ? (form.rack_name?.trim() || racks[0]?.name || 'IDF01') : (form.rack_name?.trim() || null),
        rack_unit: form.placement_zone === 'rack' ? (form.rack_unit?.trim() || 'U1') : (form.rack_unit?.trim() || null),
        placement_zone: form.placement_zone || defaultZone,
        floor_plan_id: form.floor_plan_id || null,
        installation_status: form.installation_status || 'Pending',
        notes: form.notes.trim() || (form.barcode ? `[Barcode: ${form.barcode}]` : ''),
      };

      if (onCreateDevice) {
        await onCreateDevice(payload);
      }

      // Reset form to clean empty fields for next device
      setForm({
        custom_label_id: '',
        serial_number: '',
        barcode: '',
        mac_address: '',
        ip_address: '',
        subnet_mask: '',
        gateway: '',
        vlan_id: '',
        connection_type: 'switch',
        connected_socket_id: '',
        connected_socket_label: '',
        connected_socket_model_id: '',
        patch_panel_name: '',
        patch_panel_port: '',
        switch_name: '',
        switch_port: '',
        rack_name: '',
        rack_unit: '',
        placement_zone: defaultZone,
        floor_plan_id: defaultFloor,
        installation_status: 'Pending',
        notes: '',
      });
      setIsCustomPatchPort(false);
      setIsCustomSwitchPort(false);

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
                  backgroundColor: currentCategory?.color_code || '#3b82f6',
                  ringColor: `${currentCategory?.color_code || '#3b82f6'}33`,
                }}
              />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">{model.brand}</span>
                  <h2 className="text-lg sm:text-xl font-bold font-mono text-white tracking-wide">{model.model}</h2>
                </div>
                <p className="text-xs text-slate-400">
                  {currentCategory ? (isKu ? currentCategory.name_ku : currentCategory.name) : 'ELV Category'}
                  {model.is_rack_mounted && ` • ${model.rack_unit_size || 1}U Server Rack`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('edit')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                  activeTab === 'edit'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                    : 'bg-slate-800 text-slate-300 hover:text-white border-slate-700 hover:bg-slate-750'
                }`}
              >
                <Edit2 className="w-3.5 h-3.5 text-amber-400" />
                <span>{isKu ? 'دەستکاریکردنی کەرەستە و لۆکەیشن' : 'Edit Specs & Locations'}</span>
              </button>
              <button
                onClick={onClose}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
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

            <button
              onClick={() => setActiveTab('edit')}
              className={`py-3 px-3.5 border-b-2 flex items-center gap-2 transition ${
                activeTab === 'edit'
                  ? 'border-amber-500 text-amber-400 font-bold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Edit2 className="w-4 h-4 text-amber-400" />
              <span>{isKu ? 'دەستکاریکردنی دیسکریپشن و لۆکەیشن' : 'Edit Specs & Locations'}</span>
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
                      Custom Label ID
                    </label>
                    <input
                      type="text"
                      value={form.custom_label_id}
                      onChange={(e) => setForm({ ...form, custom_label_id: e.target.value })}
                      placeholder={`e.g. ${cleanPrefix}-${nextNum}`}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Barcode & Serial */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Barcode / Serial Sticker
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={form.barcode}
                        onChange={(e) => setForm({ ...form, barcode: e.target.value, serial_number: e.target.value })}
                        placeholder="Scan or input barcode / serial..."
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
                      placeholder="e.g. 74:83:C2:10:4E:55"
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
                    <input
                      type="number"
                      value={form.vlan_id}
                      onChange={(e) => setForm({ ...form, vlan_id: e.target.value })}
                      placeholder="10"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Connection / Uplink Type: Socket vs Patch Panel vs Switch */}
                  <div className="col-span-1 sm:col-span-2 p-3 bg-slate-900/80 border border-slate-800 rounded-2xl space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                        <Network className="w-3.5 h-3.5 text-blue-400" />
                        <span>{t.connectionType || (isKu ? 'شێوازی بەستنەوە (Connection)' : 'Connection Type')}</span>
                      </label>
                      <div className="inline-flex rounded-xl p-0.5 bg-slate-950 border border-slate-800 text-xs">
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, connection_type: 'socket' })}
                          className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
                            form.connection_type === 'socket'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Plug className="w-3 h-3" />
                          <span>{t.connSocket || (isKu ? 'سۆکێت' : 'Socket')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, connection_type: 'patch_panel' })}
                          className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
                            form.connection_type === 'patch_panel'
                              ? 'bg-purple-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Sliders className="w-3 h-3" />
                          <span>{t.connPatchPanel || (isKu ? 'پاچ پەناڵ' : 'Patch Panel')}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, connection_type: 'switch' })}
                          className={`px-2.5 py-1 rounded-lg font-medium transition flex items-center gap-1 ${
                            form.connection_type === 'switch'
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          <Network className="w-3 h-3" />
                          <span>{t.connSwitch || (isKu ? 'سویچ' : 'Switch')}</span>
                        </button>
                      </div>
                    </div>

                    {/* Sub-form based on Connection Type */}
                    {form.connection_type === 'socket' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-300 mb-1">
                            {isKu ? '١- جۆری سۆکێت (BOQ Model)' : '1. Socket BOQ Type'}
                          </label>
                          <select
                            value={form.connected_socket_model_id}
                            onChange={(e) => {
                              const modelId = e.target.value;
                              setForm({
                                ...form,
                                connected_socket_model_id: modelId,
                                connected_socket_id: '',
                                connected_socket_label: '',
                              });
                            }}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                          >
                            <option value="">{isKu ? '— هەڵبژاردنی جۆری سۆکێت —' : '— Select Socket Model —'}</option>
                            {socketBoqModels.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.brand} {m.model}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-300 mb-1">
                            {isKu ? '٢- سۆکێتی بەستراو (دیڤایس)' : '2. Connected Socket (Device)'}
                          </label>
                          <select
                            value={form.connected_socket_id}
                            onChange={(e) => {
                              const devId = e.target.value;
                              const chosenSocket = socketDevices.find((s) => s.id === devId);
                              setForm({
                                ...form,
                                connected_socket_id: devId,
                                connected_socket_label: chosenSocket?.custom_label_id || '',
                                switch_name: chosenSocket?.custom_label_id ? `Socket: ${chosenSocket.custom_label_id}` : (form.switch_name || 'Socket'),
                              });
                            }}
                            className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 ${
                              socketConflict ? 'border-rose-500/80 bg-rose-950/20' : 'border-slate-800'
                            }`}
                          >
                            <option value="">{isKu ? '— دیاریکردنی سۆکێت —' : '— Select Specific Socket —'}</option>
                            {availableSocketDevices.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.custom_label_id ? `[${s.custom_label_id}]` : `[ID: ${s.id.slice(0, 8)}]`} - {s.floor_plan?.name || s.zone || 'Villa'} {s.notes ? `(${s.notes})` : ''}
                              </option>
                            ))}
                          </select>
                          {socketConflict && (
                            <div className="text-[11px] text-rose-400 bg-rose-950/40 border border-rose-800/60 rounded-lg p-2 mt-1 flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>{isKu ? `⚠️ ئەم سۆکێتە پێشتر بۆ ئامێری [${socketConflict}] دانراوە!` : `⚠️ Socket is already linked to [${socketConflict}]!`}</span>
                            </div>
                          )}
                          {availableSocketDevices.length === 0 && !socketConflict && (
                            <p className="text-[10px] text-amber-400 mt-1">
                              {isKu ? '⚠️ هیچ سۆکێتێکی بەردەست (بەکارنەهاتوو) لەم جۆرە نەدۆزرایەوە.' : '⚠️ No unassigned sockets available for this model.'}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {form.connection_type === 'patch_panel' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-300 mb-1">
                            {t.patchPanelName || (isKu ? 'ناوی پاچ پەناڵ' : 'Patch Panel')}
                          </label>
                          <input
                            type="text"
                            list="modal-patch-panels-list"
                            value={form.patch_panel_name}
                            onChange={(e) => {
                              const val = e.target.value;
                              setForm({
                                ...form,
                                patch_panel_name: val,
                                switch_name: val ? `PP: ${val}` : form.switch_name,
                              });
                            }}
                            placeholder="e.g. PP-IDF01-24P"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                          />
                          <datalist id="modal-patch-panels-list">
                            {knownPatchPanels.map((pp) => (
                              <option key={pp} value={pp} />
                            ))}
                          </datalist>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-medium text-slate-300">
                              {t.patchPanelPort || (isKu ? 'ژمارەی پۆرت' : 'Port')}
                            </label>
                            <button
                              type="button"
                              onClick={() => setIsCustomPatchPort(!isCustomPatchPort)}
                              className="text-[10px] text-purple-400 hover:text-purple-300 font-medium transition cursor-pointer"
                            >
                              {isCustomPatchPort ? (isKu ? '← لیستی پۆرتە بەردەستەکان' : '← Free Ports') : (isKu ? 'دەستی / تر...' : 'Custom Port...')}
                            </button>
                          </div>

                          {!isCustomPatchPort ? (
                            <select
                              value={normPort(form.patch_panel_port)}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '__custom__') {
                                  setIsCustomPatchPort(true);
                                } else {
                                  setForm({
                                    ...form,
                                    patch_panel_port: val,
                                    switch_port: val || form.switch_port,
                                  });
                                }
                              }}
                              className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-xs font-mono text-amber-300 focus:outline-none focus:border-purple-500 cursor-pointer ${
                                patchConflict ? 'border-rose-500/80 bg-rose-950/20' : 'border-slate-800'
                              }`}
                            >
                              <option value="">{isKu ? '— هەڵبژاردنی پۆرتی بەتاڵ —' : '— Select Free Port —'}</option>
                              {availablePatchPorts.map((p) => (
                                <option key={p} value={p}>Port {p}</option>
                              ))}
                              <option value="__custom__">{isKu ? 'نووسینی دەستی (Custom)...' : 'Custom Port...'}</option>
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={form.patch_panel_port}
                              onChange={(e) => {
                                const val = e.target.value;
                                setForm({
                                  ...form,
                                  patch_panel_port: val,
                                  switch_port: val || form.switch_port,
                                });
                              }}
                              placeholder="e.g. 2 or Port 12"
                              className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-xs font-mono text-amber-300 focus:outline-none focus:border-purple-500 ${
                                patchConflict ? 'border-rose-500/80 bg-rose-950/20' : 'border-slate-800'
                              }`}
                            />
                          )}

                          {patchConflict && (
                            <div className="text-[11px] text-rose-400 bg-rose-950/40 border border-rose-800/60 rounded-lg p-2 mt-1 flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>{isKu ? `⚠️ پۆرت [${form.patch_panel_port}] پێشتر بۆ ئامێری [${patchConflict}] دانراوە!` : `⚠️ Port [${form.patch_panel_port}] is already linked to [${patchConflict}]!`}</span>
                            </div>
                          )}
                          {availablePatchPorts.length === 0 && !isCustomPatchPort && form.patch_panel_name && (
                            <p className="text-[10px] text-amber-400 mt-1">
                              {isKu ? '⚠️ هەموو پۆرتەکانی ئەم پاچ پەناڵە بەستراونەتەوە و هیچی بەتاڵ نەماوە.' : '⚠️ All ports on this patch panel are occupied.'}
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {form.connection_type === 'switch' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <div>
                          <label className="block text-[11px] font-medium text-slate-300 mb-1">
                            {t.switchName || (isKu ? 'ناوی سویچ' : 'Switch Name')}
                          </label>
                          <input
                            type="text"
                            list="modal-switches-list"
                            value={form.switch_name}
                            onChange={(e) => setForm({ ...form, switch_name: e.target.value })}
                            placeholder="e.g. SW-CORE-RACK-48P"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                          />
                          <datalist id="modal-switches-list">
                            {knownSwitches.map((sw) => (
                              <option key={sw} value={sw} />
                            ))}
                          </datalist>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-medium text-slate-300">
                              {t.switchPortNumber || (isKu ? 'ژمارەی پۆرت' : 'Switch Port')}
                            </label>
                            <button
                              type="button"
                              onClick={() => setIsCustomSwitchPort(!isCustomSwitchPort)}
                              className="text-[10px] text-blue-400 hover:text-blue-300 font-medium transition cursor-pointer"
                            >
                              {isCustomSwitchPort ? (isKu ? '← لیستی پۆرتە بەردەستەکان' : '← Free Ports') : (isKu ? 'دەستی / تر...' : 'Custom Port...')}
                            </button>
                          </div>

                          {!isCustomSwitchPort ? (
                            <select
                              value={normPort(form.switch_port)}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val === '__custom__') {
                                  setIsCustomSwitchPort(true);
                                } else {
                                  setForm({ ...form, switch_port: val });
                                }
                              }}
                              className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-xs font-mono text-amber-300 focus:outline-none focus:border-blue-500 cursor-pointer ${
                                switchConflict ? 'border-rose-500/80 bg-rose-950/20' : 'border-slate-800'
                              }`}
                            >
                              <option value="">{isKu ? '— هەڵبژاردنی پۆرتی بەتاڵ —' : '— Select Free Port —'}</option>
                              {availableSwitchPorts.map((p) => (
                                <option key={p} value={p}>Port {p}</option>
                              ))}
                              <option value="__custom__">{isKu ? 'نووسینی دەستی (Custom)...' : 'Custom Port...'}</option>
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={form.switch_port}
                              onChange={(e) => setForm({ ...form, switch_port: e.target.value })}
                              placeholder="e.g. 14 or Gi1/0/14"
                              className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-xs font-mono text-amber-300 focus:outline-none focus:border-blue-500 ${
                                switchConflict ? 'border-rose-500/80 bg-rose-950/20' : 'border-slate-800'
                              }`}
                            />
                          )}

                          {switchConflict && (
                            <div className="text-[11px] text-rose-400 bg-rose-950/40 border border-rose-800/60 rounded-lg p-2 mt-1 flex items-center gap-1.5">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>{isKu ? `⚠️ پۆرت [${form.switch_port}] پێشتر بۆ ئامێری [${switchConflict}] دانراوە!` : `⚠️ Port [${form.switch_port}] is already linked to [${switchConflict}]!`}</span>
                            </div>
                          )}
                          {availableSwitchPorts.length === 0 && !isCustomSwitchPort && form.switch_name && (
                            <p className="text-[10px] text-amber-400 mt-1">
                              {isKu ? '⚠️ هەموو پۆرتەکانی ئەم سویچە بەستراونەتەوە و هیچی بەتاڵ نەماوە.' : '⚠️ All ports on this switch are occupied.'}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Location 1: Assigned Floor Plan */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {isKu ? 'سایت پلان / نەخشەی شوێن' : 'Physical Floor Plan'}
                    </label>
                    <select
                      value={form.floor_plan_id}
                      onChange={(e) => setForm({ ...form, floor_plan_id: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="">{isKu ? 'دیاری نەکراوە (دانانی لە دوایدا)' : 'None (Unassigned)'}</option>
                      {floorPlans.map((fp) => (
                        <option key={fp.id} value={fp.id}>
                          {getFloorPlanDisplayLabel(fp, lang)}
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
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                            <Server className="w-3 h-3 text-blue-400" />
                            <span>Server Rack</span>
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
                          value={form.rack_name || ''}
                          onChange={(e) => {
                            if (e.target.value === '__manage__') {
                              setIsRackModalOpen(true);
                            } else {
                              setForm({ ...form, rack_name: e.target.value });
                            }
                          }}
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
                        >
                          <option value="">{isKu ? '— هەڵبژاردنی ڕاک —' : '— Select Server Rack —'}</option>
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
                                  <span>{dev.custom_label_id ? dev.custom_label_id : <span className="text-slate-500 italic text-[11px] font-sans">{isKu ? '— بێ لەیبڵ —' : '— No Label —'}</span>}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-amber-300 whitespace-nowrap">
                                {dev.serial_number || 'No Serial'}
                              </td>
                              <td className="px-4 py-3 text-cyan-300 whitespace-nowrap">
                                {dev.ip_address || <span className="text-slate-600 italic">Unassigned</span>}
                              </td>
                              <td className="px-4 py-3 text-slate-300 whitespace-nowrap font-sans text-xs">
                                <div className="font-medium text-white">{fp ? getFloorPlanDisplayLabel(fp, lang) : (isKu ? 'بێ نەخشە' : 'No Map')}</div>
                                <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                                  {(() => {
                                    const connType = dev.connection_type || (dev.patch_panel_name || dev.switch_name?.startsWith('PP:') ? 'patch_panel' : (dev.connected_socket_id || dev.switch_name?.startsWith('Socket:') ? 'socket' : 'switch'));

                                    if (connType === 'patch_panel') {
                                      const ppName = dev.patch_panel_name || (dev.switch_name?.startsWith('PP:') ? dev.switch_name.replace('PP:', '').trim() : '') || (isKu ? 'پاچ پەناڵ' : 'PP');
                                      const ppPort = dev.patch_panel_port || (dev.switch_port && !dev.switch_port.startsWith('PP:') ? dev.switch_port : '');
                                      return (
                                        <span className="text-purple-400 flex items-center gap-1">
                                          <Sliders className="w-3 h-3" />
                                          <span>{ppName}{ppPort ? ` [${ppPort}]` : ''}</span>
                                        </span>
                                      );
                                    }

                                    if (connType === 'socket') {
                                      const raw = dev.connected_socket_label || (dev.switch_name?.startsWith('Socket:') ? dev.switch_name.replace('Socket:', '').trim() : '') || '';
                                      const clean = raw.replace(/^Socket:?\s*/i, '').trim();
                                      return (
                                        <span className="text-emerald-400 flex items-center gap-1">
                                          <Plug className="w-3 h-3" />
                                          <span>
                                            {isKu ? 'سۆکێت' : 'Socket'}
                                            {clean && clean.toLowerCase() !== 'socket' ? ` [${clean}]` : ''}
                                          </span>
                                        </span>
                                      );
                                    }

                                    if (dev.switch_name) {
                                      return (
                                        <span className="text-blue-400 flex items-center gap-1">
                                          <Network className="w-3 h-3" />
                                          <span>{dev.switch_name}{dev.switch_port ? ` [${dev.switch_port}]` : ''}</span>
                                        </span>
                                      );
                                    }

                                    return <span>{dev.rack_unit ? `Rack: ${dev.rack_unit}` : 'Field'}</span>;
                                  })()}
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
                {/* Product Photo Showcase with Direct Upload / Update */}
                <div className="md:col-span-5 space-y-3">
                  <div className="relative group rounded-2xl overflow-hidden border border-slate-700/80 bg-slate-950 aspect-[4/3] shadow-inner flex items-center justify-center">
                    <img
                      src={getEffectiveProductImage(model.product_image_url)}
                      alt={`${model.brand} ${model.model}`}
                      onError={(e) => { e.currentTarget.src = DEFAULT_ICT_IMAGE; }}
                      className="w-full h-full object-cover transition duration-300 group-hover:scale-105"
                    />

                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />

                    {/* Quick Image Action Controls Overlay */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-auto">
                      <label className="cursor-pointer flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-900/95 text-white backdrop-blur-md border border-slate-700 hover:bg-blue-600 hover:border-blue-500 transition shadow-lg active:scale-95">
                        <Camera className="w-3.5 h-3.5 text-amber-400" />
                        <span>{isKu ? 'گۆڕینی وێنە' : 'Change Photo'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleUploadPhoto(e.target.files?.[0])}
                        />
                      </label>

                      <div className="flex items-center gap-1.5">
                        {model.product_image_url && (
                          <button
                            type="button"
                            onClick={handleRemovePhoto}
                            title={isKu ? 'سڕینەوەی وێنە' : 'Remove Photo'}
                            className="p-1.5 rounded-xl bg-slate-900/90 text-slate-400 hover:text-red-400 border border-slate-700 hover:bg-slate-800 transition shadow-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {model.product_image_url && (
                          <button
                            type="button"
                            onClick={() => setIsImageLightboxOpen(true)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-900/90 text-white backdrop-blur-md border border-slate-700 hover:bg-slate-800 transition shadow-lg"
                          >
                            <Maximize2 className="w-3.5 h-3.5" />
                            <span>{isKu ? 'گەورەکردن' : 'Zoom'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Photo status toast */}
                  {photoToast && (
                    <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2 animate-fadeIn">
                      <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>{photoToast}</span>
                    </div>
                  )}

                  {isUploadingPhoto && (
                    <div className="p-3 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-300 text-xs flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-blue-400 shrink-0" />
                      <span>{isKu ? 'وێنەکە پرۆسێس دەکرێت و دادەنرێت...' : 'Optimizing and saving photo...'}</span>
                    </div>
                  )}

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
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                        Product Description:
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('edit')}
                        className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-semibold transition"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>{isKu ? 'دەستکاریکردنی دیسکریپشن' : 'Edit Description'}</span>
                      </button>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-sans">
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
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                        Allowed Physical Zones & Locations:
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab('edit')}
                        className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-semibold transition"
                      >
                        <Plus className="w-3 h-3" />
                        <span>{isKu ? '+ زیادکردنی لۆکەیشن' : '+ Add Location'}</span>
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {model.allowed_zones?.map((z) => (
                        <span
                          key={z}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-900 text-slate-200 border border-slate-700 font-mono"
                        >
                          {z === 'indoor'
                            ? 'Indoor (ناو ڤێلا)'
                            : z === 'outdoor'
                            ? 'Outdoor (دەرەوە)'
                            : z === 'rack'
                            ? 'Server Rack (ڕاک)'
                            : z === 'safe_room'
                            ? 'Safe Room'
                            : z}
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

            {/* TAB 4: EDIT BOQ MODEL, DESCRIPTION & LOCATIONS */}
            {activeTab === 'edit' && (
              <form onSubmit={handleSaveModelEdit} className="space-y-6 animate-fadeIn">
                {/* Edit Success Toast */}
                {editSavedToast && (
                  <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs sm:text-sm flex items-center justify-between shadow-lg">
                    <div className="flex items-center gap-2.5">
                      <Check className="w-5 h-5 text-emerald-400 shrink-0" />
                      <span className="font-semibold">
                        {isKu
                          ? 'گۆڕانکارییەکانی وەسف، لۆکەیشن و مۆدێل بە سەرکەوتوویی لە خشتەی BOQ پاشەکەوت کران!'
                          : 'BOQ Model description, locations & specifications saved successfully!'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('details')}
                      className="text-xs font-semibold text-emerald-400 underline hover:text-emerald-200"
                    >
                      {isKu ? 'بینینی ئەنجام' : 'View Result'}
                    </button>
                  </div>
                )}

                {/* Section 1: Product Description */}
                <div className="p-5 rounded-2xl bg-amber-950/20 border-2 border-amber-500/40 space-y-2 shadow-inner">
                  <div className="flex items-center justify-between">
                    <label className="text-xs sm:text-sm font-bold text-amber-300 flex items-center gap-2">
                      <Edit2 className="w-4 h-4 text-amber-400" />
                      <span>{isKu ? 'وەسفی کەرەستە لە خشتەی BOQ (Description)' : 'Product Description in BOQ *'}</span>
                    </label>
                    <span className="text-[11px] text-amber-400/80 font-mono">
                      {editForm.description.length} chars
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {isKu
                      ? 'ئەم دەقە ڕاستەوخۆ لەسەر کارتی ئەم ئامێرە لە بەشی BOQ پیشان دەدرێت و دەتوانیت هەرکات بتەوێت دەستکاری بکەیت:'
                      : 'This text is displayed on the BOQ card on the dashboard and catalog view:'}
                  </p>
                  <textarea
                    rows={4}
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    placeholder="e.g. SERVIDOR ARANTIACAST LITE MAX.80 PTOS - Hospitality Google Cast streaming controller appliance"
                    className="w-full bg-slate-950 border border-amber-500/50 rounded-xl p-3 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 leading-relaxed font-sans"
                    required
                  />
                </div>

                {/* Section 2: Allowed Locations / Physical Placement Zones */}
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-400" />
                      <h3 className="text-xs sm:text-sm font-bold text-white">
                        {isKu ? 'لۆکەیشن و شوێنە ڕێپێدراوەکان بۆ ئەم ئامێرە' : 'Allowed Physical Placement Zones & Locations'}
                      </h3>
                    </div>
                    <span className="text-[11px] text-slate-400 font-mono">
                      ({editForm.allowed_zones.length} {isKu ? 'شوێن چالاکە' : 'active'})
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {isKu
                      ? 'دیاریکردنی ئەو ناوچە و شوێنانەی کە ئەم ئامێرە لەخۆدەگرن بۆ ڕێکخستن و ڕێنمایی:'
                      : 'Specify the target zones and locations for this equipment:'}
                  </p>

                  {/* Standard Predefined Zone Chips */}
                  <div className="space-y-2">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                      {isKu ? 'شوێنە ستانداردەکانی ڤێلا (کلیک بکە بۆ چالاککردن / ناچالاککردن):' : 'Standard Villa Zones (Click to toggle):'}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'indoor', labelKu: 'ناو ڤێلا (Indoor)', labelEn: 'Indoor Villa' },
                        { id: 'outdoor', labelKu: 'دەرەوە و باخچە (Outdoor)', labelEn: 'Outdoor Grounds' },
                        { id: 'rack', labelKu: 'ناو ڕاکی سێرڤەر (Server Rack)', labelEn: 'Server Rack' },
                        { id: 'safe_room', labelKu: 'ژووری پارێزراو (Safe Room)', labelEn: 'Safe Room' },
                        { id: 'terrace', labelKu: 'باڵکۆن و سەربان (Terrace & Roof)', labelEn: 'Terrace & Roof' },
                        { id: 'pool', labelKu: 'مەلەوانگە (Swimming Pool)', labelEn: 'Swimming Pool Area' },
                        { id: 'gate', labelKu: 'دەروازە و پارکینگ (Main Gate)', labelEn: 'Main Gate & Parking' },
                        { id: 'cinema', labelKu: 'ژووری سینەما (Home Cinema)', labelEn: 'Home Cinema Room' },
                      ].map((zone) => {
                        const isSelected = editForm.allowed_zones.includes(zone.id);
                        return (
                          <button
                            key={zone.id}
                            type="button"
                            onClick={() => handleToggleZone(zone.id)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition border ${
                              isSelected
                                ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/30'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-850'
                            }`}
                          >
                            <Check className={`w-3.5 h-3.5 ${isSelected ? 'opacity-100' : 'opacity-0'}`} />
                            <span>{isKu ? zone.labelKu : zone.labelEn}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Add Custom Location Input Field */}
                  <div className="pt-3 border-t border-slate-800/80 space-y-2">
                    <label className="block text-[11px] font-semibold text-slate-300">
                      {isKu ? '+ زیادکردنی ناوی لۆکەیشنی تر بە دڵی خۆت:' : '+ Add Custom Location Name:'}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newLocationInput}
                        onChange={(e) => setNewLocationInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddCustomLocation();
                          }
                        }}
                        placeholder={isKu ? 'ناوی شوێنەکە بنووسە (بۆ نموونە: Majlis, Gym, Basement Plant Room)...' : 'Type custom location name (e.g. Majlis, Gym, Roof)...'}
                        className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={handleAddCustomLocation}
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition active:scale-95 shrink-0"
                      >
                        {isKu ? 'زیادکردنی لۆکەیشن' : '+ Add Location'}
                      </button>
                    </div>
                  </div>

                  {/* Currently Selected Location Chips */}
                  <div className="pt-2">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider block mb-2">
                      {isKu ? 'لیستی تەواوی لۆکەیشنە چالاککراوەکانی ئەم مۆدێلە:' : 'All Active Locations for this Model:'}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {editForm.allowed_zones.map((loc) => (
                        <span
                          key={loc}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium bg-slate-900 text-blue-300 border border-blue-500/30"
                        >
                          <span>{loc}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveLocation(loc)}
                            title="Remove location"
                            className="text-slate-400 hover:text-red-400 transition"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Section 3: Hardware Identity & Specs */}
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
                  <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-cyan-400" />
                    <span>{isKu ? 'زانیاری ئەندازیاری و کەتەلۆگ' : 'Engineering & Hardware Profile'}</span>
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        {t.brand} *
                      </label>
                      <input
                        type="text"
                        value={editForm.brand}
                        onChange={(e) => setEditForm({ ...editForm, brand: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        {t.model} *
                      </label>
                      <input
                        type="text"
                        value={editForm.model}
                        onChange={(e) => setEditForm({ ...editForm, model: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none focus:border-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-300">
                          {t.category}
                        </label>
                        <button
                          type="button"
                          onClick={() => setIsCategoryModalOpen(true)}
                          className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>{isKu ? '+ زیادکردنی بەش' : '+ New Category'}</span>
                        </button>
                      </div>
                      <select
                        value={editForm.category_id}
                        onChange={(e) => setEditForm({ ...editForm, category_id: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>
                            {isKu ? c.name_ku : c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        {isKu ? 'کۆی ژمارەی داواکراو لە BOQ (Target Qty)' : 'Target BOQ Quantity *'}
                      </label>
                      <input
                        type="number"
                        min={provisionedCount}
                        value={editForm.total_qty}
                        onChange={(e) => setEditForm({ ...editForm, total_qty: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        {isKu ? 'نرخی تاک بە دۆلاری ئەمریکی ($)' : 'Unit Cost (USD) *'}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.unit_cost}
                        onChange={(e) => setEditForm({ ...editForm, unit_cost: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-emerald-400 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Hardware Photo & Documentation */}
                  <div className="pt-3 border-t border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-slate-200 flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-amber-400" />
                        <span>{isKu ? 'وێنەی ئامێر (Device Photo)' : 'Device Photo'}</span>
                      </label>
                      {editForm.product_image_url ? (
                        <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                          {isKu ? 'وێنە دانراوە' : 'Photo Attached'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">
                          {isKu ? 'هیچ وێنەیەک دانەنراوە' : 'No Photo'}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
                      {/* Photo Thumbnail Preview */}
                      <div className="sm:col-span-4">
                        <div className="relative group rounded-xl overflow-hidden border-2 border-dashed border-slate-700 bg-slate-950 aspect-[4/3] flex flex-col items-center justify-center p-2">
                          {editForm.product_image_url ? (
                            <>
                              <img
                                src={editForm.product_image_url}
                                alt="Device preview"
                                className="w-full h-full object-cover rounded-lg"
                              />
                              <div className="absolute inset-0 bg-slate-950/70 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2 p-2">
                                <label className="cursor-pointer p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow transition" title={isKu ? 'گۆڕینی وێنە' : 'Change Photo'}>
                                  <Camera className="w-4 h-4" />
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => handleUploadPhoto(e.target.files?.[0])}
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={handleRemovePhoto}
                                  title={isKu ? 'سڕینەوەی وێنە' : 'Remove Photo'}
                                  className="p-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 text-white shadow transition"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </>
                          ) : (
                            <label className="cursor-pointer flex flex-col items-center justify-center text-center p-3 w-full h-full hover:bg-slate-900/60 transition rounded-lg">
                              <ImageIcon className="w-8 h-8 text-slate-600 mb-1" />
                              <span className="text-[11px] font-bold text-blue-400">
                                {isKu ? '+ دانانی وێنە' : '+ Add Photo'}
                              </span>
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => handleUploadPhoto(e.target.files?.[0])}
                              />
                            </label>
                          )}
                        </div>
                      </div>

                      {/* Photo Upload Actions & URL Input */}
                      <div className="sm:col-span-8 space-y-2.5">
                        <div className="flex flex-wrap gap-2">
                          <label className="cursor-pointer flex-1 inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition active:scale-95">
                            <Upload className="w-4 h-4" />
                            <span>{isKu ? 'ئەپلۆدکردن لە ئامێرەکەت' : 'Upload from Device'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => handleUploadPhoto(e.target.files?.[0])}
                            />
                          </label>

                          <label className="cursor-pointer inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold shadow-md transition active:scale-95">
                            <Camera className="w-4 h-4 text-amber-400" />
                            <span>{isKu ? 'کامێرا' : 'Camera'}</span>
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={(e) => handleUploadPhoto(e.target.files?.[0])}
                            />
                          </label>

                          {editForm.product_image_url && (
                            <button
                              type="button"
                              onClick={handleRemovePhoto}
                              className="px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-red-500/20 text-slate-400 hover:text-red-400 border border-slate-700 text-xs font-semibold transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        <div>
                          <label className="block text-[11px] text-slate-400 mb-1">
                            {isKu ? 'یان بەستەری ڕاستەوخۆ (Image URL):' : 'Or Direct Image URL:'}
                          </label>
                          <input
                            type="text"
                            value={editForm.product_image_url}
                            onChange={(e) => setEditForm({ ...editForm, product_image_url: e.target.value })}
                            placeholder="https://..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* PDF Manual URL */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {isKu ? 'بەستەری داتاشیت و مانیواڵی فەرمی (PDF Datasheet URL)' : 'Official Datasheet / PDF Manual URL'}
                    </label>
                    <input
                      type="text"
                      value={editForm.manual_pdf_url}
                      onChange={(e) => setEditForm({ ...editForm, manual_pdf_url: e.target.value })}
                      placeholder="https://..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Rack Mount Configuration */}
                  <div className="flex flex-wrap items-center gap-6 p-3.5 bg-slate-900 rounded-xl border border-slate-800">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editForm.is_rack_mounted}
                        onChange={(e) => setEditForm({ ...editForm, is_rack_mounted: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 bg-slate-950"
                      />
                      <span className="text-xs font-semibold text-white">
                        {isKu ? 'لەناو ڕاکی سێرڤەر دادەنرێت (19" Server Rack Mounted)' : '19" Server Rack Mounted'}
                      </span>
                    </label>

                    {editForm.is_rack_mounted && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-400">
                          {isKu ? 'بەرزی ناو ڕاک:' : 'Rack Unit Height:'}
                        </span>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={editForm.rack_unit_size || 1}
                          onChange={(e) => setEditForm({ ...editForm, rack_unit_size: e.target.value })}
                          className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono text-amber-300"
                        />
                        <span className="text-xs font-mono text-amber-300">U</span>
                      </div>
                    )}
                  </div>

                  {/* Custom Specs JSON */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {isKu ? 'تایبەتمەندییە وردە ئەندازیارییەکان (JSON Specs)' : 'Custom Engineering JSON Specs'}
                    </label>
                    <textarea
                      rows={3}
                      value={editForm.custom_specs_text}
                      onChange={(e) => setEditForm({ ...editForm, custom_specs_text: e.target.value })}
                      placeholder='{"poe_standard": "802.3at", "power_watts": 30}'
                      className="w-full bg-slate-950 font-mono text-xs text-cyan-300 border border-slate-700 rounded-xl p-3 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Submit Action Bar */}
                <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setActiveTab('details')}
                    className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-400 hover:text-white transition"
                  >
                    {isKu ? 'پاشگەزبوونەوە' : 'Cancel'}
                  </button>

                  <button
                    type="submit"
                    disabled={isSavingEdit}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-gradient-to-r from-emerald-600 via-teal-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500 text-white shadow-xl shadow-emerald-950/40 transition active:scale-95 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>
                      {isSavingEdit
                        ? (isKu ? 'خەزن دەکرێت...' : 'Saving Changes...')
                        : (isKu ? 'پاشەکەوتکردنی هەموو گۆڕانکارییەکان' : 'Save All BOQ Changes')}
                    </span>
                  </button>
                </div>
              </form>
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

      {/* Quick Add Category Modal */}
      <QuickAddCategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onCreateCategory={onCreateCategory}
        onCategoryCreated={(newCat) => {
          if (newCat?.id) {
            setEditForm((prev) => ({ ...prev, category_id: newCat.id }));
          }
        }}
        lang={lang}
      />

      {/* Dynamic Server Rack & Cabinet Manager Modal */}
      <RackManagerModal
        isOpen={isRackModalOpen}
        onClose={() => setIsRackModalOpen(false)}
        devices={devices}
        lang={lang}
      />
    </>
  );
}

