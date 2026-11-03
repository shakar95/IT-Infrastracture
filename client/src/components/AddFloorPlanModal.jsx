import React, { useState } from 'react';
import { X, Upload, Camera, MapPin, Layers, Check, Image as ImageIcon } from 'lucide-react';
import { api } from '../services/api';

const compressImageFile = (file, maxWidth = 2000, maxHeight = 1500, quality = 0.85) => {
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

export default function AddFloorPlanModal({
  isOpen,
  onClose,
  onFloorPlanCreated,
  onCreateFloorPlan,
  lang = 'en',
}) {
  const isKu = lang === 'ku';

  const [name, setName] = useState('');
  const [nameKu, setNameKu] = useState('');
  const [zoneType, setZoneType] = useState('indoor');
  const [floorLevel, setFloorLevel] = useState(0);
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleFileSelect = async (file) => {
    if (!file) return;
    try {
      setIsUploading(true);
      const compressedDataUrl = await compressImageFile(file, 2000, 1500, 0.85);
      setImagePreview(compressedDataUrl);

      // Upload directly into Supabase Storage Bucket ('floor-plans' / 'boq-images')
      try {
        const res = await api.uploadFloorPlanImage(compressedDataUrl);
        if (res?.publicUrl) {
          setImageUrl(res.publicUrl);
        } else {
          setImageUrl(compressedDataUrl);
        }
      } catch (uploadErr) {
        console.warn('Bucket upload blip, using compressed data URL:', uploadErr);
        setImageUrl(compressedDataUrl);
      }
    } catch (err) {
      alert(err.message || 'Failed to process image');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      alert(isKu ? 'تکایە ناوی نەخشەکە دیاری بکە' : 'Please provide a name for the Site Plan / Floor Plan');
      return;
    }
    if (!imageUrl && !imagePreview) {
      alert(isKu ? 'تکایە وێنەی سایت پلانەکە ئەپلۆد بکە' : 'Please upload the Site Plan blueprint image');
      return;
    }

    try {
      setIsSubmitting(true);
      const planPayload = {
        name: name.trim(),
        name_ku: nameKu.trim() || name.trim(),
        zone_type: zoneType,
        floor_level: Number(floorLevel) || 0,
        image_url: imageUrl || imagePreview,
        scale_meters_per_pixel: 0.05,
      };

      let createdPlan;
      if (onCreateFloorPlan) {
        createdPlan = await onCreateFloorPlan(planPayload);
      } else {
        createdPlan = await api.createFloorPlan(planPayload);
      }

      if (onFloorPlanCreated) {
        onFloorPlanCreated(createdPlan);
      }

      onClose();
    } catch (err) {
      alert(err.message || 'Failed to create site plan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div
        className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 space-y-5 my-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                {isKu ? 'زیادکردنی سایت پلان و نەخشەی ئەندازیاری' : 'Add Site Plan / Floor Plan Blueprint'}
              </h3>
              <p className="text-xs text-slate-400">
                {isKu
                  ? 'دانانی نەخشە بۆ دیاریکردنی شوێنی دیڤایسەکان بە شێوەی ڕاستەوخۆ'
                  : 'Upload architectural layout to mark and pin device locations visually'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Blueprint Image Upload Box */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {isKu ? 'وێنەی سایت پلان / نەخشەی ڤێلا (Blueprint Image)' : 'Blueprint Image / Architectural Plan'}
            </label>
            <div className="relative border-2 border-dashed border-slate-700 hover:border-blue-500/70 rounded-2xl p-4 bg-slate-950/70 transition flex flex-col items-center justify-center text-center min-h-[170px] overflow-hidden">
              {imagePreview ? (
                <div className="relative w-full">
                  <img
                    src={imagePreview}
                    alt="Floor plan preview"
                    className="w-full max-h-[220px] object-contain rounded-xl mx-auto"
                  />
                  <div className="absolute top-2 right-2 flex items-center gap-2">
                    <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition">
                      {isKu ? 'گۆڕین' : 'Change'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileSelect(e.target.files?.[0])}
                      />
                    </label>
                  </div>
                  {isUploading && (
                    <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center text-xs font-semibold text-blue-400">
                      {isKu ? 'وێنەکە ئەپڵۆد دەبێت بۆ سۆپەبەیس...' : 'Uploading image to Supabase Storage...'}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 py-3">
                  <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto text-blue-400">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-200">
                      {isKu ? 'وێنەی نەخشەکە لێرە دابنێ یان لەسەر ئامێرەکەت هەڵیبژێرە' : 'Click to upload or take a photo of the layout'}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5">PNG, JPG, WebP (بەکێتی floor-plans ی سۆپەبەیس)</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition active:scale-95">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isKu ? 'هەڵبژاردنی وێنە' : 'Upload Image'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFileSelect(e.target.files?.[0])}
                      />
                    </label>
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition active:scale-95">
                      <Camera className="w-3.5 h-3.5 text-amber-400" />
                      <span>{isKu ? 'کامێرا' : 'Camera'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => handleFileSelect(e.target.files?.[0])}
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Names */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {isKu ? 'ناوی سایت پلان بە ئینگلیزی' : 'Site Plan Name (English)'}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Garden & Outdoor Site Plan"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {isKu ? 'ناوی سایت پلان بە کوردی' : 'Site Plan Name (Kurdish)'}
              </label>
              <input
                type="text"
                value={nameKu}
                onChange={(e) => setNameKu(e.target.value)}
                placeholder="وەک: نەخشەی باخچە و حەوشەی دەرەوە"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Zone Type & Floor Level */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {isKu ? 'جۆری ناوچەکە (Zone Type)' : 'Zone Type'}
              </label>
              <select
                value={zoneType}
                onChange={(e) => setZoneType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="indoor">{isKu ? 'ناو ڤێلا (Indoor)' : 'Indoor (Villa Interior)'}</option>
                <option value="outdoor">{isKu ? 'دەرەوە و باخچە (Outdoor / Site)' : 'Outdoor (Site & Landscape)'}</option>
                <option value="rack">{isKu ? 'ژووری سێرڤەر و ڕاکەکان (Server Rack)' : 'Server Rack Room'}</option>
                <option value="safe_room">{isKu ? 'ژووری پارێزراو (Safe Room)' : 'Safe Room / Security'}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {isKu ? 'قات / پلەی شوێن (Floor Level)' : 'Floor Level'}
              </label>
              <select
                value={floorLevel}
                onChange={(e) => setFloorLevel(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value={-1}>Basement / ژێرزەمین (-1)</option>
                <option value={0}>Ground Floor / قاتی زەمینی (0)</option>
                <option value={1}>First Floor / قاتی یەکەم (1)</option>
                <option value={2}>Second Floor / قاتی دووەم (2)</option>
                <option value={3}>Roof Top / سەربان (3)</option>
              </select>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              {isKu ? 'پاشگەزبوونەوە' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isUploading}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/40 transition active:scale-95 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isKu ? 'سەیڤکردنی سایت پلان' : 'Save Site Plan'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

