import React, { useState, useEffect } from 'react';
import {
  X,
  Upload,
  Camera,
  MapPin,
  Layers,
  Check,
  Image as ImageIcon,
  FileText,
  FileCode,
  ChevronLeft,
  ChevronRight,
  Info,
  Pencil,
  Trash2,
  Settings2,
  Building2,
} from 'lucide-react';
import { api } from '../services/api';
import { useZones } from '../utils/zoneManager';
import { useEstateZones } from '../utils/estateZoneManager';
import ZoneEditorModal from './ZoneEditorModal';
import EstateZoneEditorModal from './EstateZoneEditorModal';

// Helper to ensure PDF.js is loaded
const ensurePdfJs = async () => {
  if (window.pdfjsLib) {
    if (!window.pdfjsLib.GlobalWorkerOptions?.workerSrc) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    return window.pdfjsLib;
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      } else {
        reject(new Error('PDF.js not loaded'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load PDF vector engine'));
    document.head.appendChild(script);
  });
};

const compressImageFile = (file, maxDimension = 3600, quality = 0.92) => {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('Invalid image'));
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        // Strictly preserve full aspect ratio with zero edge cropping
        if (width > maxDimension || height > maxDimension) {
          const ratio = Math.min(maxDimension / width, maxDimension / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
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
  planToEdit = null,
  onFloorPlanCreated,
  onCreateFloorPlan,
  onUpdateFloorPlan,
  onDeleteFloorPlan,
  lang = 'en',
}) {
  const isKu = lang === 'ku';
  const { zones } = useZones();
  const { estateZones } = useEstateZones();
  const [isZoneModalOpen, setIsZoneModalOpen] = useState(false);
  const [isEstateZoneModalOpen, setIsEstateZoneModalOpen] = useState(false);

  const [name, setName] = useState('');
  const [nameKu, setNameKu] = useState('');
  const [zone, setZone] = useState('');
  const [zoneType, setZoneType] = useState('');
  const [floorLevel, setFloorLevel] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // PDF Blueprint State
  const [loadedPdfDoc, setLoadedPdfDoc] = useState(null);
  const [pdfPageNumber, setPdfPageNumber] = useState(1);
  const [pdfTotalPages, setPdfTotalPages] = useState(0);
  const [fileMeta, setFileMeta] = useState(null); // { name, type, size }
  const [dwgNotice, setDwgNotice] = useState(false);

  useEffect(() => {
    if (planToEdit) {
      setName(planToEdit.name || '');
      setNameKu(planToEdit.name_ku || planToEdit.name || '');
      setZone(planToEdit.zone || '');
      setZoneType(planToEdit.zone_type || '');
      setFloorLevel(
        planToEdit.floor_level !== undefined && planToEdit.floor_level !== null
          ? planToEdit.floor_level
          : ''
      );
      setImageUrl(planToEdit.image_url || '');
      setImagePreview(planToEdit.image_url || '');
      setLoadedPdfDoc(null);
      setPdfPageNumber(1);
      setPdfTotalPages(0);
      setFileMeta(null);
      setDwgNotice(false);
    } else {
      setName('');
      setNameKu('');
      setZone('');
      setZoneType('');
      setFloorLevel('');
      setImageUrl('');
      setImagePreview('');
      setLoadedPdfDoc(null);
      setPdfPageNumber(1);
      setPdfTotalPages(0);
      setFileMeta(null);
      setDwgNotice(false);
    }
  }, [planToEdit, isOpen]);

  if (!isOpen) return null;

  // Render a specific page of the loaded PDF (Full aspect ratio, zero edge-clipping)
  const renderPdfPage = async (pdfDoc, pageNum) => {
    try {
      const page = await pdfDoc.getPage(pageNum);
      // Unscaled base dimensions of the architectural drawing
      const unscaledViewport = page.getViewport({ scale: 1.0 });

      // Calculate scale so entire page fits in high-DPI canvas without cropping any edges
      const maxCanvasDim = 3600;
      const calculatedScale = Math.min(2.5, maxCanvasDim / Math.max(unscaledViewport.width, unscaledViewport.height));
      const safeScale = Math.max(1.0, calculatedScale);

      const viewport = page.getViewport({ scale: safeScale });
      const canvas = document.createElement('canvas');
      // Ceiling viewport dimensions to guarantee no edge pixel is cropped
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext('2d');

      // Clean white architectural drawing background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: ctx,
        viewport,
      }).promise;

      return canvas.toDataURL('image/jpeg', 0.92);
    } catch (err) {
      console.error('Error rendering PDF page:', err);
      throw err;
    }
  };

  const handlePdfPageChange = async (newPage) => {
    if (!loadedPdfDoc || newPage < 1 || newPage > pdfTotalPages) return;
    try {
      setIsUploading(true);
      setPdfPageNumber(newPage);
      const dataUrl = await renderPdfPage(loadedPdfDoc, newPage);
      setImagePreview(dataUrl);

      // Upload page preview to Supabase storage or keep dataURL
      try {
        const res = await api.uploadFloorPlanImage(dataUrl);
        if (res?.publicUrl) setImageUrl(res.publicUrl);
        else setImageUrl(dataUrl);
      } catch {
        setImageUrl(dataUrl);
      }
    } catch (err) {
      alert(err.message || 'Failed to switch PDF blueprint page');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileSelect = async (file) => {
    if (!file) return;

    const lowerName = file.name.toLowerCase();

    // Check for AutoCAD DWG files
    if (lowerName.endsWith('.dwg') || lowerName.endsWith('.dxf')) {
      setDwgNotice(true);
      return;
    }
    setDwgNotice(false);

    try {
      setIsUploading(true);

      // Auto-suggest plan name from file name if empty
      const cleanFileName = file.name
        .replace(/\.[^/.]+$/, '')
        .replace(/[-_]/g, ' ')
        .trim();

      if (!name) setName(cleanFileName);
      if (!nameKu) setNameKu(cleanFileName);

      setFileMeta({
        name: file.name,
        type: lowerName.endsWith('.pdf') ? 'pdf' : 'image',
        size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
      });

      // Handle PDF Blueprint Files
      if (file.type === 'application/pdf' || lowerName.endsWith('.pdf')) {
        const pdfLib = await ensurePdfJs();
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfLib.getDocument({ data: arrayBuffer });
        const pdfDoc = await loadingTask.promise;

        setLoadedPdfDoc(pdfDoc);
        setPdfTotalPages(pdfDoc.numPages);
        setPdfPageNumber(1);

        const renderedDataUrl = await renderPdfPage(pdfDoc, 1);
        setImagePreview(renderedDataUrl);

        try {
          const res = await api.uploadFloorPlanImage(renderedDataUrl);
          if (res?.publicUrl) setImageUrl(res.publicUrl);
          else setImageUrl(renderedDataUrl);
        } catch {
          setImageUrl(renderedDataUrl);
        }
      } else {
        // Standard Image File (.png, .jpg, .svg, .webp)
        setLoadedPdfDoc(null);
        setPdfTotalPages(0);
        const compressedDataUrl = await compressImageFile(file, 3600, 0.92);
        setImagePreview(compressedDataUrl);

        try {
          const res = await api.uploadFloorPlanImage(compressedDataUrl);
          if (res?.publicUrl) setImageUrl(res.publicUrl);
          else setImageUrl(compressedDataUrl);
        } catch {
          setImageUrl(compressedDataUrl);
        }
      }
    } catch (err) {
      console.error('Failed to process blueprint file:', err);
      alert(err.message || 'Failed to process blueprint file');
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
      alert(isKu ? 'تکایە وێنەی سایت پلانەکە یان فایلی PDF ئەپلۆد بکە' : 'Please upload the Site Plan blueprint image or PDF');
      return;
    }

    try {
      setIsSubmitting(true);
      const planPayload = {
        name: name.trim(),
        name_ku: nameKu.trim() || name.trim(),
        zone: zone || null,
        zone_type: zoneType || null,
        floor_level:
          floorLevel !== '' && floorLevel !== null && floorLevel !== undefined
            ? Number(floorLevel)
            : null,
        image_url: imageUrl || imagePreview,
        scale_meters_per_pixel: 0.05,
      };

      if (planToEdit) {
        let updatedPlan;
        if (onUpdateFloorPlan) {
          updatedPlan = await onUpdateFloorPlan(planToEdit.id, planPayload);
        } else {
          updatedPlan = await api.updateFloorPlan(planToEdit.id, planPayload);
        }
        if (onFloorPlanCreated) {
          onFloorPlanCreated(updatedPlan);
        }
      } else {
        let createdPlan;
        if (onCreateFloorPlan) {
          createdPlan = await onCreateFloorPlan(planPayload);
        } else {
          createdPlan = await api.createFloorPlan(planPayload);
        }
        if (onFloorPlanCreated) {
          onFloorPlanCreated(createdPlan);
        }
      }

      onClose();
    } catch (err) {
      alert(err.message || (planToEdit ? 'Failed to update site plan' : 'Failed to create site plan'));
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
            <div className={`p-2 rounded-xl ${planToEdit ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'}`}>
              {planToEdit ? <Pencil className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                {planToEdit
                  ? (isKu ? 'دەستکاری نەخشە و زانیارییەکان' : 'Edit Floor Plan / Location')
                  : (isKu ? 'زیادکردنی نەخشە و پلانی ئەندازیاری (PDF / وێنە)' : 'Add Architectural Blueprint (PDF / Image)')}
              </h3>
              <p className="text-xs text-slate-400">
                {planToEdit
                  ? (isKu
                      ? 'دەتوانیت ناوی نەخشە، جۆری شوێن، قات، یان وێنەی بلوپرینتەکە بگۆڕیت'
                      : 'Update name, zone type, floor level, or replace blueprint image/PDF')
                  : (isKu
                      ? 'فایلی PDF ی کوالیتی بەرز یان وێنە ئەپلۆد بکە بۆ جێگیرکردنی دیڤایسەکان بە کلیک'
                      : 'Upload high-DPI PDF drawings or images with instant click-to-place pin')}
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

        {/* DWG Format Notice Modal/Callout */}
        {dwgNotice && (
          <div className="p-3.5 bg-amber-500/15 border border-amber-500/30 rounded-2xl text-xs space-y-1.5 animate-fadeIn">
            <div className="flex items-center gap-2 text-amber-300 font-bold">
              <Info className="w-4 h-4 shrink-0 text-amber-400" />
              <span>{isKu ? 'ڕێنمایی بۆ فایلی AutoCAD DWG' : 'How to use AutoCAD DWG Blueprints'}</span>
            </div>
            <p className="text-slate-300 text-[11px] leading-relaxed">
              {isKu
                ? 'فایلی DWG کۆدێکی باینەری کۆمپانیای Autodesk ە و لە براوسەردا بەبێ سێرڤەری گرانبەها ڕاستەوخۆ کار ناکات. تکایە لە نێو بەرنامەی AutoCAD فەرمانی Plot / Export to PDF بدە و فایلی PDF ـەکە لێرە ئەپڵۆد بکە بە کوالیتییەکی نایاب.'
                : 'DWG is a closed proprietary Autodesk binary CAD format. In AutoCAD or Revit, choose Plot / Export to PDF and upload the resulting vector PDF file here for crystal-clear interactive rendering.'}
            </p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Blueprint Image / PDF Upload Box */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300">
                {isKu ? 'فایلی نەخشە (PDF ی ئەندازیاری یان وێنەی ڕوون)' : 'Blueprint Layout (Architectural PDF or Image)'}
              </label>
              {fileMeta && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                  {fileMeta.type.toUpperCase()} • {fileMeta.size}
                </span>
              )}
            </div>

            <div className="relative border-2 border-dashed border-slate-700 hover:border-blue-500/70 rounded-2xl p-4 bg-slate-950/70 transition flex flex-col items-center justify-center text-center min-h-[170px] overflow-hidden">
              {imagePreview ? (
                <div className="relative w-full space-y-2">
                  <div className="relative min-h-[200px] max-h-[320px] w-full overflow-hidden rounded-xl border border-slate-700 bg-white flex items-center justify-center p-2 shadow-inner">
                    <img
                      src={imagePreview}
                      alt="Blueprint preview"
                      className="max-h-[300px] max-w-full w-auto h-auto object-contain rounded-lg mx-auto shadow-sm"
                    />
                  </div>

                  {/* Multi-Page PDF Page Switcher */}
                  {pdfTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-3 pt-1">
                      <button
                        type="button"
                        disabled={pdfPageNumber <= 1 || isUploading}
                        onClick={() => handlePdfPageChange(pdfPageNumber - 1)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold disabled:opacity-40 flex items-center gap-1"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>{isKu ? 'لاپەڕەی پێشوو' : 'Prev'}</span>
                      </button>

                      <span className="text-xs font-mono text-blue-400 font-bold">
                        {isKu ? `لاپەڕە ${pdfPageNumber} لە ${pdfTotalPages}` : `Sheet ${pdfPageNumber} of ${pdfTotalPages}`}
                      </span>

                      <button
                        type="button"
                        disabled={pdfPageNumber >= pdfTotalPages || isUploading}
                        onClick={() => handlePdfPageChange(pdfPageNumber + 1)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold disabled:opacity-40 flex items-center gap-1"
                      >
                        <span>{isKu ? 'لاپەڕەی دواتر' : 'Next'}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-center justify-center gap-2 pt-1">
                    <label className="cursor-pointer px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow transition">
                      {isKu ? 'گۆڕینی فایل' : 'Change File'}
                      <input
                        type="file"
                        accept="image/*,application/pdf,.pdf,.dwg,.dxf"
                        className="hidden"
                        onChange={(e) => handleFileSelect(e.target.files?.[0])}
                      />
                    </label>
                  </div>

                  {isUploading && (
                    <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center gap-2 text-xs font-semibold text-blue-400">
                      <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                      <span>{isKu ? 'ئامادەکردنی فایلی PDF و نەخشەکە بە کوالیتی بەرز...' : 'Processing high-DPI vector blueprint...'}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3 py-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-800/80 flex items-center justify-center mx-auto text-blue-400 border border-slate-700/60 shadow-inner">
                    <FileText className="w-7 h-7" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-200">
                      {isKu ? 'فایلی PDF ی ئەندازیاری یان وێنەی نەخشە لێرە دابنێ' : 'Upload Architectural PDF Blueprint or High-Res Image'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      PDF, PNG, JPG, WebP <span className="text-blue-400 font-mono">(Direct PDF Vector Rendering)</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-900/30 transition active:scale-95">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{isKu ? 'هەڵبژاردنی PDF یان وێنە' : 'Choose PDF / Image'}</span>
                      <input
                        type="file"
                        accept="image/*,application/pdf,.pdf,.dwg,.dxf"
                        className="hidden"
                        onChange={(e) => handleFileSelect(e.target.files?.[0])}
                      />
                    </label>
                    <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition active:scale-95">
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
                placeholder="e.g. Ground Floor MEP & ELV Layout"
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
                placeholder="وەک: نەخشەی قاتی زەمینی سیستەمی ELV"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Zone (Estate Area) & Zone Type & Floor Level */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 1. Zone (Main Villa, Guest House, Service Area, etc.) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>{isKu ? 'زۆن (Zone)' : 'Zone'}</span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    ({isKu ? 'دڵخوازانە' : 'Optional'})
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsEstateZoneModalOpen(true)}
                  className="text-[10px] text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-0.5 transition"
                >
                  <Settings2 className="w-2.5 h-2.5" />
                  <span>{isKu ? 'دەستکاری' : 'Manage'}</span>
                </button>
              </div>
              <select
                value={zone}
                onChange={(e) => {
                  if (e.target.value === '__manage__') {
                    setIsEstateZoneModalOpen(true);
                  } else {
                    setZone(e.target.value);
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
                  {isKu ? '+ زیادکردنی زۆن...' : '+ Add / Manage Zones...'}
                </option>
              </select>
            </div>

            {/* 2. Zone Type (Indoor, Outdoor, Rack, etc.) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-300">
                  {isKu ? 'جۆری شوێن (Zone Type)' : 'Zone Type'}
                  <span className="text-[10px] text-slate-400 font-normal">
                    ({isKu ? 'دڵخوازانە' : 'Optional'})
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsZoneModalOpen(true)}
                  className="text-[10px] text-blue-400 hover:text-blue-300 font-medium inline-flex items-center gap-0.5 transition"
                >
                  <Settings2 className="w-2.5 h-2.5" />
                  <span>{isKu ? 'دەستکاری' : 'Manage'}</span>
                </button>
              </div>
              <select
                value={zoneType}
                onChange={(e) => {
                  if (e.target.value === '__manage__') {
                    setIsZoneModalOpen(true);
                  } else {
                    setZoneType(e.target.value);
                  }
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">{isKu ? '— بێ دیاریکردن —' : '— None / Optional —'}</option>
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

            {/* 3. Floor Level */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                {isKu ? 'قات / نهۆم (Floor)' : 'Floor Level'}
                <span className="text-[10px] text-slate-400 font-normal ml-1 mr-1">
                  ({isKu ? 'دڵخوازانە' : 'Optional'})
                </span>
              </label>
              <select
                value={floorLevel}
                onChange={(e) => setFloorLevel(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">{isKu ? '— بێ دیاریکردنی قات —' : '— None / Optional —'}</option>
                <option value={-2}>{isKu ? 'ژێرزەمینی دووەم (-2)' : 'Basement 2 (-2)'}</option>
                <option value={-1}>{isKu ? 'ژێرزەمین (-1)' : 'Basement (-1)'}</option>
                <option value={0}>{isKu ? 'قاتی زەمینی (0)' : 'Ground Floor (0)'}</option>
                <option value={1}>{isKu ? 'قاتی یەکەم (1)' : 'First Floor (1)'}</option>
                <option value={2}>{isKu ? 'قاتی دووەم (2)' : 'Second Floor (2)'}</option>
                <option value={3}>{isKu ? 'قاتی سێیەم (3)' : 'Third Floor (3)'}</option>
                <option value={4}>{isKu ? 'سەربان (4)' : 'Roof Top (4)'}</option>
              </select>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-between gap-3 border-t border-slate-800">
            {planToEdit && onDeleteFloorPlan ? (
              <button
                type="button"
                onClick={async () => {
                  const planTitle = isKu ? (planToEdit.name_ku || planToEdit.name) : planToEdit.name;
                  const confirmMsg = isKu
                    ? `ئایا دڵنیایت لە سڕینەوەی ئەم نەخشەیە: "${planTitle}"؟\nدیڤایسەکانی سەر ئەم نەخشەیە لادەبرێن.`
                    : `Are you sure you want to delete "${planTitle}"?`;
                  if (window.confirm(confirmMsg)) {
                    await onDeleteFloorPlan(planToEdit.id);
                    onClose();
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isKu ? 'سڕینەوەی نەخشە' : 'Delete Plan'}</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3">
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
                <span>
                  {planToEdit
                    ? (isKu ? 'پاشەکەوتکردنی گۆڕانکارییەکان' : 'Save Changes')
                    : (isKu ? 'سەیڤکردنی سایت پلان' : 'Save Site Plan')}
                </span>
              </button>
            </div>
          </div>
        </form>

        {/* Custom Zone Types Management Modal */}
        <ZoneEditorModal
          isOpen={isZoneModalOpen}
          onClose={() => setIsZoneModalOpen(false)}
          lang={lang}
        />

        {/* Custom Estate Zones (Main Villa, Guest House, Service Area) Modal */}
        <EstateZoneEditorModal
          isOpen={isEstateZoneModalOpen}
          onClose={() => setIsEstateZoneModalOpen(false)}
          lang={lang}
        />
      </div>
    </div>
  );
}

