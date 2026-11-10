import React, { useState } from 'react';
import {
  Settings,
  Plus,
  Trash2,
  Layers,
  Palette,
  Check,
  X,
  Code2,
  Sliders,
  ShieldCheck,
} from 'lucide-react';
import { translations } from '../i18n/translations';

export default function CategoryBuilder({
  categories = [],
  onCreateCategory,
  onUpdateCategory,
  onDeleteCategory,
  lang = 'en',
}) {
  const t = translations[lang] || translations.en;
  const isKu = lang === 'ku';

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form State
  const [catForm, setCatForm] = useState({
    name: '',
    name_ku: '',
    description: '',
    icon_name: 'Layers',
    color_code: '#3B82F6',
    allowed_zones: ['indoor'],
    custom_schema: [
      { key: 'poe_standard', label: 'PoE Standard (e.g. 802.3at)', type: 'text' },
    ],
  });

  const availableIcons = ['Layers', 'Tv', 'Cpu', 'Volume2', 'Monitor', 'Film', 'Wifi', 'Camera', 'ShieldCheck', 'Key', 'Bell', 'PhoneCall', 'Server', 'Plug'];
  const allZones = ['indoor', 'outdoor', 'rack', 'safe_room'];

  const toggleZone = (zone) => {
    if (catForm.allowed_zones.includes(zone)) {
      setCatForm({
        ...catForm,
        allowed_zones: catForm.allowed_zones.filter((z) => z !== zone),
      });
    } else {
      setCatForm({
        ...catForm,
        allowed_zones: [...catForm.allowed_zones, zone],
      });
    }
  };

  const handleAddField = () => {
    setCatForm({
      ...catForm,
      custom_schema: [
        ...catForm.custom_schema,
        { key: `field_${Date.now().toString().slice(-4)}`, label: 'New Spec Field', type: 'text' },
      ],
    });
  };

  const handleUpdateField = (index, keyName, value) => {
    const updated = [...catForm.custom_schema];
    updated[index][keyName] = value;
    setCatForm({ ...catForm, custom_schema: updated });
  };

  const handleRemoveField = (index) => {
    const updated = catForm.custom_schema.filter((_, i) => i !== index);
    setCatForm({ ...catForm, custom_schema: updated });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!catForm.name || !catForm.name_ku) {
      alert('English and Kurdish category names are required');
      return;
    }
    onCreateCategory(catForm);
    setIsAddModalOpen(false);
    // Reset
    setCatForm({
      name: '',
      name_ku: '',
      description: '',
      icon_name: 'Layers',
      color_code: '#3B82F6',
      allowed_zones: ['indoor'],
      custom_schema: [{ key: 'poe_standard', label: 'PoE Standard', type: 'text' }],
    });
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-blue-400" />
            <span>{t.settingsTitle}</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">{t.settingsSubtitle}</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 transition active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" />
          {t.addCategoryBtn}
        </button>
      </div>

      {/* Categories Cards List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {categories.map((c) => (
          <div
            key={c.id}
            className="p-5 bg-slate-900/70 border border-slate-800 rounded-2xl flex flex-col justify-between hover:border-slate-700 transition space-y-4"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shadow-md font-bold text-white text-xs"
                    style={{ backgroundColor: c.color_code || '#3B82F6' }}
                  >
                    {c.icon_name?.substring(0, 2) || 'EL'}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{isKu ? c.name_ku : c.name}</h3>
                    <p className="text-[11px] text-slate-400">{isKu ? c.name : c.name_ku}</p>
                  </div>
                </div>

                <button
                  onClick={() => onDeleteCategory(c.id)}
                  title="Delete category"
                  className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-slate-300 mt-3 line-clamp-2 leading-relaxed">
                {c.description || 'Custom ELV infrastructure category for Sitak Villa.'}
              </p>

              {/* Allowed Zones */}
              <div className="mt-3">
                <span className="text-[10px] text-slate-400 block mb-1 uppercase font-semibold">
                  Allowed Placement Zones:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {c.allowed_zones?.map((z) => (
                    <span
                      key={z}
                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-950 text-blue-300 border border-slate-800"
                    >
                      {z}
                    </span>
                  ))}
                </div>
              </div>

              {/* Dynamic JSON Schema Properties */}
              {c.custom_schema && c.custom_schema.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-800/80">
                  <span className="text-[10px] text-slate-400 block mb-1 uppercase font-semibold">
                    Dynamic Schema Fields ({c.custom_schema.length}):
                  </span>
                  <div className="space-y-1">
                    {c.custom_schema.map((field, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-[11px] bg-slate-950/60 px-2 py-1 rounded border border-slate-800/60 font-mono"
                      >
                        <span className="text-slate-300">{field.label || field.key}</span>
                        <span className="text-amber-400 text-[10px]">[{field.type || 'text'}]</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="text-[10px] text-slate-500 font-mono pt-2 border-t border-slate-800/50 flex justify-between">
              <span>Color: {c.color_code}</span>
              <span>Icon: {c.icon_name}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Add Category Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white">{t.addCategoryBtn}</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t.categoryNameEn} *</label>
                  <input
                    type="text"
                    value={catForm.name}
                    onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                    placeholder="e.g. Landscape Audio, Fiber Optic"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t.categoryNameKu} *</label>
                  <input
                    type="text"
                    value={catForm.name_ku}
                    onChange={(e) => setCatForm({ ...catForm, name_ku: e.target.value })}
                    placeholder="بۆ نموونە: دەنگی باخچە، ڕیشاڵی بینایی"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-sans"
                    dir="rtl"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t.categoryDescription}</label>
                <textarea
                  value={catForm.description}
                  onChange={(e) => setCatForm({ ...catForm, description: e.target.value })}
                  placeholder="Infrastructure purpose and technical domain specifications..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 h-16"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t.iconName}</label>
                  <select
                    value={catForm.icon_name}
                    onChange={(e) => setCatForm({ ...catForm, icon_name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white"
                  >
                    {availableIcons.map((ic) => (
                      <option key={ic} value={ic}>{ic}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">{t.colorCode}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={catForm.color_code}
                      onChange={(e) => setCatForm({ ...catForm, color_code: e.target.value })}
                      className="w-10 h-9 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={catForm.color_code}
                      onChange={(e) => setCatForm({ ...catForm, color_code: e.target.value })}
                      className="flex-1 font-mono text-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Allowed Installation Zones */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">{t.allowedZonesSelect}</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {allZones.map((z) => {
                    const isSelected = catForm.allowed_zones.includes(z);
                    return (
                      <button
                        type="button"
                        key={z}
                        onClick={() => toggleZone(z)}
                        className={`p-2 rounded-xl text-xs font-semibold border transition text-center capitalize ${
                          isSelected
                            ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        {z}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dynamic JSON Schema Field Builder */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                    {t.customSchemaTitle}
                  </span>
                  <button
                    type="button"
                    onClick={handleAddField}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.addField}</span>
                  </button>
                </div>

                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {catForm.custom_schema.map((f, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={f.key}
                        onChange={(e) => handleUpdateField(i, 'key', e.target.value)}
                        placeholder={t.fieldKey}
                        className="w-1/3 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono"
                        required
                      />
                      <input
                        type="text"
                        value={f.label}
                        onChange={(e) => handleUpdateField(i, 'label', e.target.value)}
                        placeholder={t.fieldLabel}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                        required
                      />
                      <select
                        value={f.type}
                        onChange={(e) => handleUpdateField(i, 'type', e.target.value)}
                        className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-slate-300"
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="boolean">Boolean</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleRemoveField(i)}
                        className="p-1 text-slate-500 hover:text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
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
                  {t.saveCategory}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

