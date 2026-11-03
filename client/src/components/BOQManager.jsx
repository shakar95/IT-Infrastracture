import React, { useState } from 'react';
import {
  Layers,
  Plus,
  Search,
  FileText,
  ExternalLink,
  Cpu,
  Trash2,
  Edit2,
  Check,
  X,
  Sparkles,
  Server,
  Image as ImageIcon,
  Barcode,
  Eye,
  Maximize2,
  Camera,
  Upload,
} from 'lucide-react';
import { translations } from '../i18n/translations';
import BoqModelDetailsModal from './BoqModelDetailsModal';

const compressImage = (file, maxWidth = 1200, maxHeight = 900, quality = 0.85) => {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('Invalid image'));
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
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
};

export default function BOQManager({
  boqModels = [],
  categories = [],
  devices = [],
  floorPlans = [],
  selectedCategory = 'all',
  onSelectCategory,
  onAddModel,
  onUpdateModel,
  onDeleteModel,
  onBulkProvision,
  onCreateDevice,
  onUpdateStatus,
  onNavigateToMap,
  lang = 'en',
}) {
  const t = translations[lang] || translations.en;
  const isKu = lang === 'ku';

  const [search, setSearch] = useState('');
  const [internalCategory, setInternalCategory] = useState('all');
  const activeCategory = onSelectCategory ? selectedCategory : internalCategory;
  const setCategory = onSelectCategory || setInternalCategory;
  const activeCategoryObj = categories.find((c) => c.id === activeCategory);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [bulkModalModel, setBulkModalModel] = useState(null);
  const [inspectingModel, setInspectingModel] = useState(null);
  const [modalInitialTab, setModalInitialTab] = useState('provision');

  const handleOpenEdit = (model) => {
    setInspectingModel(model);
    setModalInitialTab('edit');
  };

  const handleOpenProvision = (model) => {
    setInspectingModel(model);
    setModalInitialTab('provision');
  };

  const handleUpdateModelAndInspect = async (id, updates) => {
    const updated = await onUpdateModel(id, updates);
    if (inspectingModel && inspectingModel.id === id) {
      setInspectingModel((prev) => ({ ...prev, ...updates, ...updated }));
    }
    return updated;
  };

  // Form State for New Model (English technical fields)
  const [formData, setFormData] = useState({
    brand: '',
    model: '',
    category_id: categories[0]?.id || '',
    description: '',
    total_qty: 1,
    unit_cost: 0,
    product_image_url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600',
    manual_pdf_url: '',
    allowed_zones: ['indoor'],
    is_rack_mounted: false,
    rack_unit_size: 0,
    custom_specs_text: '{\n  "poe_standard": "802.3at",\n  "power_watts": 30\n}',
  });

  // Bulk Provision State
  const [bulkParams, setBulkParams] = useState({
    count: 5,
    prefix: 'AP-GF',
    starting_index: 1,
    vlan_id: 10,
    target_zone: 'indoor',
  });

  // Filtered list
  const filteredModels = boqModels.filter((m) => {
    const matchesCat = activeCategory === 'all' || m.category_id === activeCategory;
    const s = search.toLowerCase();
    const matchesSearch =
      m.brand.toLowerCase().includes(s) ||
      m.model.toLowerCase().includes(s) ||
      (m.description && m.description.toLowerCase().includes(s));
    return matchesCat && matchesSearch;
  });

  const handleOpenBulk = (model) => {
    const cleanPrefix = `${model.brand.substring(0, 3).toUpperCase()}-${model.model.replace(/[^A-Za-z0-9]/g, '').substring(0, 4).toUpperCase()}`;
    const targetCount = Math.max(1, (model.total_qty || 1) - (model.provisioned_count || 0));
    setBulkParams({
      count: targetCount,
      prefix: cleanPrefix,
      starting_index: (model.provisioned_count || 0) + 1,
      vlan_id: 10,
      target_zone: model.is_rack_mounted ? 'rack' : model.allowed_zones[0] || 'indoor',
    });
    setBulkModalModel(model);
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    let parsedSpecs = {};
    try {
      if (formData.custom_specs_text.trim()) {
        parsedSpecs = JSON.parse(formData.custom_specs_text);
      }
    } catch {
      alert('Custom specifications must be valid JSON format');
      return;
    }

    onAddModel({
      ...formData,
      total_qty: Number(formData.total_qty),
      unit_cost: Number(formData.unit_cost),
      rack_unit_size: Number(formData.rack_unit_size),
      custom_specs: parsedSpecs,
    });
    setIsAddModalOpen(false);
  };

  const handleBulkSubmit = (e) => {
    e.preventDefault();
    if (!bulkModalModel) return;
    onBulkProvision(bulkModalModel.id, bulkParams);
    setBulkModalModel(null);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">{t.boqTitle}</h2>
          <p className="text-xs sm:text-sm text-slate-400">{t.boqSubtitle}</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 transition active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          {t.btnAddModel}
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-center gap-3 bg-slate-900/70 border border-slate-800 p-3.5 rounded-2xl">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.searchBoq}
            className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        {/* Category Pill / Select */}
        <select
          value={activeCategory}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full md:w-64 bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition"
        >
          <option value="all">{t.allCategories} ({boqModels.length})</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {isKu ? c.name_ku : c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Active Category Filter Tag Banner (When navigated from Dashboard or selected) */}
      {activeCategory !== 'all' && (
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-blue-950/40 border border-blue-500/30 text-xs">
          <div className="flex items-center gap-2.5">
            <div
              className="w-3 h-3 rounded-full shadow-sm"
              style={{ backgroundColor: activeCategoryObj?.color_code || '#3B82F6' }}
            />
            <span className="text-slate-400">
              {isKu ? 'ئامێرە فلتەرکراوەکانی بەشی:' : 'Showing BOQ models for:'}
            </span>
            <span className="font-bold text-white px-2.5 py-1 rounded-lg bg-blue-600/30 border border-blue-500/40">
              {isKu ? activeCategoryObj?.name_ku : activeCategoryObj?.name}
            </span>
            <span className="text-slate-400 font-mono">
              ({filteredModels.length} {isKu ? 'مۆدێل دۆزرایەوە' : 'models found'})
            </span>
          </div>
          <button
            onClick={() => setCategory('all')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold transition active:scale-95"
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
            <span>{isKu ? 'پیشاندانی هەموو کەتەلۆگ' : 'Clear Filter / Show All'}</span>
          </button>
        </div>
      )}

      {/* Empty State when no models match filter */}
      {filteredModels.length === 0 && (
        <div className="text-center py-12 bg-slate-900/40 border border-dashed border-slate-800 rounded-2xl p-8">
          <Layers className="w-10 h-10 text-slate-500 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-white">
            {isKu ? 'هیچ مۆدێلێک لەم بەشەدا نەدۆزرایەوە' : 'No models found in this category'}
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            {isKu
              ? 'دەتوانیت فلتەرەکە لابدەیت بۆ بینینی هەموو کەرەستەکانی کەتەلۆگ'
              : 'Try selecting all categories or clearing your search term.'}
          </p>
          <button
            onClick={() => setCategory('all')}
            className="mt-4 px-4 py-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 text-xs font-semibold hover:bg-blue-600/30 transition"
          >
            {isKu ? 'پیشاندانی هەموو بەشەکان' : 'Show All Categories'}
          </button>
        </div>
      )}

      {/* Models Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredModels.map((m) => {
          const category = categories.find((c) => c.id === m.category_id);
          const isFullyProvisioned = (m.provisioned_count || 0) >= m.total_qty;

          return (
            <div
              key={m.id}
              onClick={() => handleOpenProvision(m)}
              className="bg-slate-900/70 border border-slate-800/90 rounded-2xl overflow-hidden hover:border-blue-500/60 hover:shadow-2xl hover:shadow-blue-500/10 transition-all flex flex-col group cursor-pointer"
            >
              {/* Product Image & Badges */}
              <div className="relative h-44 bg-slate-950 overflow-hidden">
                <img
                  src={m.product_image_url}
                  alt={`${m.brand} ${m.model}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

                {/* Hover Inspect Overlay */}
                <div className="absolute inset-0 bg-blue-950/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition duration-300">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/95 text-white text-xs font-semibold backdrop-blur-md shadow-xl">
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>{isKu ? 'کردنەوە و زیادکردنی دیڤایس' : 'Open & Provision'}</span>
                  </div>
                </div>

                {/* Category Badge */}
                <div className="absolute top-3 left-3">
                  <span
                    className="px-2.5 py-1 rounded-md text-[11px] font-bold text-white shadow-md backdrop-blur-md"
                    style={{ backgroundColor: `${category?.color_code || '#3B82F6'}cc` }}
                  >
                    {category ? (isKu ? category.name_ku : category.name) : 'ELV'}
                  </span>
                </div>

                {/* Rack Mounted Indicator */}
                {m.is_rack_mounted && (
                  <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-amber-500/90 text-slate-950 shadow-md">
                    <Server className="w-3 h-3" />
                    <span>{m.rack_unit_size || 1}U Rack</span>
                  </div>
                )}

                {/* Provision Count Overlay */}
                <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-xs text-slate-300">
                  <span className="font-semibold text-white">
                    Qty: <span className="text-amber-400 font-bold">{m.total_qty}</span>
                  </span>
                  <span
                    className={`font-semibold px-2 py-0.5 rounded-md ${
                      isFullyProvisioned
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    }`}
                  >
                    {m.provisioned_count || 0} / {m.total_qty} {isKu ? 'تۆمارکراو' : 'Provisioned'}
                  </span>
                </div>
              </div>

              {/* Model Info */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">{m.brand}</span>
                    <h3 className="text-base font-bold text-white truncate group-hover:text-blue-300 transition">
                      {m.model}
                    </h3>
                  </div>

                  {/* Editable Description Container */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEdit(m);
                    }}
                    className="group/desc cursor-pointer mt-1 rounded-lg p-1 -m-1 hover:bg-slate-800/40 transition"
                    title={isKu ? 'کلیک بکە بۆ دەستکاریکردنی ئەم دیسکریپشنە' : 'Click to edit this description'}
                  >
                    <p className="text-xs text-slate-400 group-hover/desc:text-amber-300 line-clamp-2 leading-relaxed transition flex items-start justify-between gap-1">
                      <span>{m.description || 'Enterprise ELV hardware component for Sitak Villa infrastructure.'}</span>
                      <span className="p-0.5 rounded text-slate-500 group-hover/desc:text-amber-400 group-hover/desc:bg-amber-400/10 shrink-0">
                        <Edit2 className="w-3 h-3" />
                      </span>
                    </p>
                  </div>

                  {/* Allowed Zones */}
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {m.allowed_zones?.map((z) => (
                      <span
                        key={z}
                        className="px-2 py-0.5 text-[10px] rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-mono"
                      >
                        {z === 'indoor' ? t.zoneIndoor : z === 'outdoor' ? t.zoneOutdoor : z === 'rack' ? t.zoneRack : z === 'safe_room' ? t.zoneSafeRoom : z}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Action Footer */}
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  {m.manual_pdf_url ? (
                    <a
                      href={m.manual_pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
                    >
                      <FileText className="w-3.5 h-3.5 text-amber-400" />
                      <span>{t.viewManual}</span>
                    </a>
                  ) : (
                    <span className="text-xs text-slate-500 italic">{t.noManual}</span>
                  )}

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenEdit(m);
                      }}
                      title={isKu ? 'دەستکاریکردنی وەسف، لۆکەیشن و مۆدێل' : 'Edit description, locations & specs'}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500/10 text-amber-300 hover:bg-amber-500/25 border border-amber-500/30 transition shadow active:scale-95"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>{isKu ? 'دەستکاری' : 'Edit'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenProvision(m);
                      }}
                      title="Open and provision device with barcode & location"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 transition shadow active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isKu ? 'زیادکردن' : 'Add'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenBulk(m);
                      }}
                      title="Bulk generate device instances"
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700 transition active:scale-95"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                      <span className="hidden sm:inline">{t.btnBulkProvision}</span>
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteModel(m.id);
                      }}
                      className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add BOQ Model Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">{t.btnAddModel}</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    {t.category} *
                  </label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    required
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {isKu ? c.name_ku : c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t.brand} *</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="e.g. Ubiquiti, Crestron, Televes"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t.model} *</label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="e.g. U7-Pro, TSW-770"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t.totalQty} *</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.total_qty}
                    onChange={(e) => setFormData({ ...formData, total_qty: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Technical hardware specifications and Sitak Villa application details..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 h-20"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium text-slate-300">
                      {isKu ? 'وێنەی ئامێر (Photo)' : 'Product Photo'}
                    </label>
                    <label className="cursor-pointer text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isKu ? 'ئەپلۆدکردنی وێنە' : 'Upload File'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          try {
                            const dataUrl = await compressImage(file);
                            setFormData((prev) => ({ ...prev, product_image_url: dataUrl }));
                          } catch (err) {
                            alert('Failed to process image');
                          }
                        }}
                      />
                    </label>
                  </div>
                  <input
                    type="text"
                    value={formData.product_image_url}
                    onChange={(e) => setFormData({ ...formData, product_image_url: e.target.value })}
                    placeholder="https://... or upload photo"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">PDF Manual / Datasheet URL</label>
                  <input
                    type="url"
                    value={formData.manual_pdf_url}
                    onChange={(e) => setFormData({ ...formData, manual_pdf_url: e.target.value })}
                    placeholder="https://..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center gap-6 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_rack_mounted}
                    onChange={(e) => setFormData({ ...formData, is_rack_mounted: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-700 text-blue-600 focus:ring-0 bg-slate-900"
                  />
                  <span className="text-xs font-medium text-slate-200">{t.rackMounted} (19" Server Rack)</span>
                </label>

                {formData.is_rack_mounted && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Rack Height:</span>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={formData.rack_unit_size || 1}
                      onChange={(e) => setFormData({ ...formData, rack_unit_size: e.target.value })}
                      className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                    />
                    <span className="text-xs text-slate-400">U</span>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Custom Technical Specs (JSON Schema)
                </label>
                <textarea
                  value={formData.custom_specs_text}
                  onChange={(e) => setFormData({ ...formData, custom_specs_text: e.target.value })}
                  className="w-full font-mono text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-cyan-300 focus:outline-none focus:border-blue-500 h-20"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-400 hover:text-white"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30"
                >
                  Save BOQ Model
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Provisioning Modal */}
      {bulkModalModel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-400" />
                <h3 className="text-base font-bold text-white">{t.bulkProvisionTitle}</h3>
              </div>
              <button
                onClick={() => setBulkModalModel(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBulkSubmit} className="p-6 space-y-4">
              <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                <span className="text-xs text-blue-400 font-semibold uppercase">{bulkModalModel.brand}</span>
                <p className="text-sm font-bold text-white">{bulkModalModel.model}</p>
                <p className="text-xs text-slate-400 mt-1">{t.bulkProvisionDesc}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t.labelPrefix}</label>
                  <input
                    type="text"
                    value={bulkParams.prefix}
                    onChange={(e) => setBulkParams({ ...bulkParams, prefix: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t.quantityToProvision}</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={bulkParams.count}
                    onChange={(e) => setBulkParams({ ...bulkParams, count: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t.startVlan}</label>
                  <input
                    type="number"
                    value={bulkParams.vlan_id}
                    onChange={(e) => setBulkParams({ ...bulkParams, vlan_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Starting Index</label>
                  <input
                    type="number"
                    min="1"
                    value={bulkParams.starting_index}
                    onChange={(e) => setBulkParams({ ...bulkParams, starting_index: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-950/30 border border-blue-800/40 rounded-xl text-xs text-blue-200">
                Preview: <code>{bulkParams.prefix}-0{bulkParams.starting_index}</code> through{' '}
                <code>
                  {bulkParams.prefix}-
                  {Number(bulkParams.starting_index) + Number(bulkParams.count) - 1 < 10
                    ? `0${Number(bulkParams.starting_index) + Number(bulkParams.count) - 1}`
                    : Number(bulkParams.starting_index) + Number(bulkParams.count) - 1}
                </code>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setBulkModalModel(null)}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-slate-400 hover:text-white"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-900/40"
                >
                  {t.confirmProvision}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BOQ Model Inspection, Full Editing & Barcode Provisioning Modal */}
      <BoqModelDetailsModal
        model={inspectingModel}
        category={categories.find((c) => c.id === inspectingModel?.category_id)}
        categories={categories}
        devices={devices}
        floorPlans={floorPlans}
        isOpen={Boolean(inspectingModel)}
        initialTab={modalInitialTab}
        onClose={() => setInspectingModel(null)}
        onUpdateModel={handleUpdateModelAndInspect}
        onUpdateTotalQty={handleUpdateModelAndInspect}
        onCreateDevice={onCreateDevice}
        onUpdateStatus={onUpdateStatus}
        onNavigateToMap={onNavigateToMap}
        lang={lang}
      />
    </div>
  );
}

