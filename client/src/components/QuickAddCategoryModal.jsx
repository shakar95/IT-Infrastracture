import React, { useState } from 'react';
import { X, Plus, Sparkles, Check } from 'lucide-react';

const PRESET_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#EF4444', // Red
  '#6366F1', // Indigo
];

const PRESET_ICONS = [
  'Layers',
  'Cpu',
  'Wifi',
  'Camera',
  'Server',
  'ShieldCheck',
  'Key',
  'Tv',
  'Volume2',
  'Monitor',
  'Film',
  'PhoneCall',
  'Bell',
];

export default function QuickAddCategoryModal({
  isOpen,
  onClose,
  onCategoryCreated,
  onCreateCategory,
  lang = 'en',
}) {
  const isKu = lang === 'ku';

  const [name, setName] = useState('');
  const [nameKu, setNameKu] = useState('');
  const [description, setDescription] = useState('');
  const [colorCode, setColorCode] = useState(PRESET_COLORS[0]);
  const [iconName, setIconName] = useState('Layers');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !nameKu.trim()) {
      alert(isKu ? 'تکایە ناوی بەشەکە بە کوردی و ئینگلیزی بنووسە' : 'Please provide Category Name in English and Kurdish');
      return;
    }

    try {
      setIsSubmitting(true);
      const catPayload = {
        name: name.trim(),
        name_ku: nameKu.trim(),
        description: description.trim(),
        color_code: colorCode,
        icon_name: iconName,
        allowed_zones: ['indoor', 'outdoor', 'rack', 'safe_room'],
      };

      let createdCat;
      if (onCreateCategory) {
        createdCat = await onCreateCategory(catPayload);
      }

      if (onCategoryCreated) {
        onCategoryCreated(createdCat || catPayload);
      }

      onClose();
    } catch (err) {
      alert(err.message || 'Failed to create category');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-3.5 h-3.5 rounded-full"
              style={{ backgroundColor: colorCode }}
            />
            <h3 className="text-base font-bold text-white">
              {isKu ? 'زیادکردنی بەشی نوێ (Category)' : 'Add New ELV Category'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {isKu ? 'ناوی بەش بە ئینگلیزی (English Name)' : 'Category Name (English)'}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Smart Lighting & Shading"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {isKu ? 'ناوی بەش بە کوردی (Kurdish Name)' : 'Category Name (Kurdish)'}
            </label>
            <input
              type="text"
              value={nameKu}
              onChange={(e) => setNameKu(e.target.value)}
              placeholder="وەک: رووناکیی زیرەک و پەردەکان"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {isKu ? 'وەسفی کورت (ئارەزوومەندانە)' : 'Description (Optional)'}
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ELV systems description..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Color Palette */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {isKu ? 'ڕەنگی هێما و کاردەکە' : 'Accent Color'}
            </label>
            <div className="flex items-center gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColorCode(c)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition ${
                    colorCode === c ? 'ring-2 ring-white scale-110' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {colorCode === c && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                </button>
              ))}
            </div>
          </div>

          {/* Icon Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {isKu ? 'ئایکۆنی بەشەکە' : 'Icon'}
            </label>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_ICONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => setIconName(ic)}
                  className={`px-2 py-1.5 rounded-lg text-xs font-mono text-center border transition ${
                    iconName === ic
                      ? 'bg-blue-600/30 border-blue-500 text-blue-300 font-bold'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {ic.slice(0, 5)}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              {isKu ? 'پاشگەزبوونەوە' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/40 transition active:scale-95 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              <span>{isKu ? 'زیادکردنی بەش' : 'Add Category'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

