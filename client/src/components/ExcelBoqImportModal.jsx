import React, { useState, useRef } from 'react';
import {
  X,
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertCircle,
  Layers,
  ArrowRight,
  Eye,
  Trash2,
  RefreshCw,
  PlusCircle,
  SkipForward,
  Sparkles,
} from 'lucide-react';
import { downloadBoqExcelTemplate, parseBoqExcelFile } from '../utils/excelBoqUtils';

export default function ExcelBoqImportModal({
  isOpen,
  onClose,
  categories = [],
  existingModels = [],
  onImport,
  lang = 'en',
}) {
  const isKu = lang === 'ku';
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedItems, setParsedItems] = useState([]);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'add' | 'update' | 'skip'
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState(null);
  const [successReport, setSuccessReport] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    try {
      downloadBoqExcelTemplate(categories);
    } catch (err) {
      setError(isKu ? 'داونلۆدکردنی تێمپلەیت سەرکەوتوو نەبوو' : 'Failed to download Excel template');
    }
  };

  const processFile = async (file) => {
    if (!file) return;
    const validExts = ['.xlsx', '.xls', '.csv'];
    const lowerName = file.name.toLowerCase();
    const isValid = validExts.some((ext) => lowerName.endsWith(ext));

    if (!isValid) {
      setError(
        isKu
          ? 'تکایە تەنها فایلی ئێکسڵ (.xlsx, .xls) یان .csv دابنێ'
          : 'Please upload a valid .xlsx, .xls, or .csv file'
      );
      return;
    }

    try {
      setIsParsing(true);
      setError(null);
      setSelectedFile(file);
      const items = await parseBoqExcelFile(file, categories);
      if (!items || items.length === 0) {
        throw new Error(
          isKu
            ? 'هیچ داتایەکی دروست لە ناو فایلی ئێکسڵەکە نەدۆزرایەوە'
            : 'No valid BOQ items found in Excel sheet'
        );
      }

      // Smart comparison with existing BOQ models of current project
      const enriched = items.map((item) => {
        const normModel = (item.model || '').trim().toLowerCase();
        const normBrand = (item.brand || '').trim().toLowerCase();

        const existing = existingModels.find(
          (m) =>
            m.model?.trim().toLowerCase() === normModel ||
            (m.brand?.trim().toLowerCase() === normBrand && m.model?.trim().toLowerCase() === normModel)
        );

        if (!existing) {
          return {
            ...item,
            _action: 'add',
            _diffs: [],
          };
        }

        const diffs = [];
        if (Number(existing.total_qty) !== Number(item.total_qty)) {
          diffs.push({
            field: 'total_qty',
            label: isKu ? 'ژمارە' : 'Qty',
            oldVal: existing.total_qty,
            newVal: item.total_qty,
          });
        }
        if (Number(existing.unit_cost) !== Number(item.unit_cost)) {
          diffs.push({
            field: 'unit_cost',
            label: isKu ? 'نرخ' : 'Cost',
            oldVal: `$${existing.unit_cost}`,
            newVal: `$${item.unit_cost}`,
          });
        }
        if ((existing.description || '').trim() !== (item.description || '').trim() && (item.description || '').trim()) {
          diffs.push({
            field: 'description',
            label: isKu ? 'پێناسە' : 'Description',
            oldVal: existing.description,
            newVal: item.description,
          });
        }
        if (item.category_id && existing.category_id !== item.category_id) {
          diffs.push({
            field: 'category_id',
            label: isKu ? 'بەش' : 'Category',
            oldVal: existing.category_id,
            newVal: item.category_id,
          });
        }
        if (Boolean(existing.is_rack_mounted) !== Boolean(item.is_rack_mounted)) {
          diffs.push({
            field: 'is_rack_mounted',
            label: isKu ? 'ڕاک' : 'Rack Mount',
            oldVal: existing.is_rack_mounted ? 'Yes' : 'No',
            newVal: item.is_rack_mounted ? 'Yes' : 'No',
          });
        }
        if (Number(existing.rack_unit_size) !== Number(item.rack_unit_size)) {
          diffs.push({
            field: 'rack_unit_size',
            label: isKu ? 'قەبارەی ڕاک' : 'Rack Size',
            oldVal: `${existing.rack_unit_size}U`,
            newVal: `${item.rack_unit_size}U`,
          });
        }

        if (diffs.length > 0) {
          return {
            ...item,
            _action: 'update',
            _existingId: existing.id,
            _diffs: diffs,
          };
        }

        return {
          ...item,
          _action: 'skip',
          _existingId: existing.id,
          _diffs: [],
        };
      });

      setParsedItems(enriched);
    } catch (err) {
      console.error('Excel parse error:', err);
      setError(err.message || (isKu ? 'هەڵەیەک لە خوێندنەوەی ئێکسڵەکە ڕوویدا' : 'Failed to parse Excel file'));
      setParsedItems([]);
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) processFile(file);
  };

  const handleConfirmImport = async () => {
    if (!parsedItems || parsedItems.length === 0) return;
    try {
      setIsImporting(true);
      setError(null);
      const res = await onImport(parsedItems);
      const report = res?.report || {
        added_count: addItems.length,
        updated_count: updateItems.length,
        skipped_count: skipItems.length,
      };
      setSuccessReport({
        ...report,
        version: res?.version,
      });

      setTimeout(() => {
        onClose();
        setSuccessReport(null);
        setParsedItems([]);
        setSelectedFile(null);
      }, 2200);
    } catch (err) {
      setError(err.message || (isKu ? 'هاوردەکردنی داتاکان سەرکەوتوو نەبوو' : 'Failed to import BOQ items'));
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setParsedItems([]);
    setActiveFilter('all');
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addItems = parsedItems.filter((it) => it._action === 'add');
  const updateItems = parsedItems.filter((it) => it._action === 'update');
  const skipItems = parsedItems.filter((it) => it._action === 'skip');

  const filteredPreview = parsedItems.filter((it) => {
    if (activeFilter === 'add') return it._action === 'add';
    if (activeFilter === 'update') return it._action === 'update';
    if (activeFilter === 'skip') return it._action === 'skip';
    return true;
  });

  const totalParsedQty = parsedItems.reduce((acc, it) => acc + (it.total_qty || 0), 0);
  const totalParsedCost = parsedItems.reduce((acc, it) => acc + (it.unit_cost || 0) * (it.total_qty || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col space-y-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
                <span>{isKu ? 'هاوردەکردن و ئەپدەیتکردنی زیرەکی BOQ لە ئێکسڵ' : 'Smart BOQ Excel Import & Deduplication'}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/30">
                  {isKu ? 'خۆکارانە ڤێرژن دروست دەکات' : 'Auto Versioning'}
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isKu
                  ? 'مۆدێلی نوێ زیاد دەکرێت، مۆدێلی گۆڕاو ئەپدەیت دەبێت، وە مۆدێلی وەک خۆی سکیپ دەکرێت بەبێ دووبارەبوونەوە.'
                  : 'Automatically adds new models, updates modified ones, and skips unchanged items without duplicates.'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Template Download Banner */}
        <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-slate-900 border border-blue-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <Download className="w-4 h-4 text-amber-400 shrink-0" />
            <div className="text-xs">
              <span className="font-semibold text-white">
                {isKu ? 'تێمپلەیتی پێوانەیی ئێکسڵ بۆ پرۆژە:' : 'Standard BOQ Excel Template:'}
              </span>{' '}
              <span className="text-slate-300">
                {isKu
                  ? 'داونلۆدی بکە، پڕی بکەرەوە، پاشان لێرە باری بکە'
                  : 'Download the formatted template with predefined ELV columns & sample rows'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow transition active:scale-95 shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isKu ? 'داونلۆدکردنی تێمپلەیت (.xlsx)' : 'Download Template (.xlsx)'}</span>
          </button>
        </div>

        {/* Feedback Alerts */}
        {error && (
          <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successReport && (
          <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-xs text-emerald-200 space-y-1.5 shrink-0 animate-fadeIn">
            <div className="flex items-center gap-2 font-bold text-sm text-emerald-300">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>
                {isKu
                  ? `هاوردەکردن و نوێکردنەوە بە سەرکەوتوویی تەواو بوو! (${successReport.version?.version_number || 'ڤێرژنی نوێ'})`
                  : `BOQ successfully synchronized with version checkpoint (${successReport.version?.version_number || 'New Version'})!`}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs pt-1">
              <span className="px-2 py-0.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold">
                ➕ {successReport.added_count} {isKu ? 'نوێ زیادکرا' : 'Added'}
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold">
                🔄 {successReport.updated_count} {isKu ? 'نوێکرایەوە' : 'Updated'}
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 font-semibold">
                ⏭️ {successReport.skipped_count} {isKu ? 'بێ گۆڕانکاری (پەڕێندرا)' : 'Unchanged (Skipped)'}
              </span>
            </div>
          </div>
        )}

        {/* Dropzone Area or Parsed Preview */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {parsedItems.length === 0 ? (
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`cursor-pointer border-2 border-dashed rounded-3xl p-8 sm:p-12 text-center transition-all ${
                dragActive
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-slate-800 bg-slate-950/40 hover:border-blue-500/50 hover:bg-slate-900/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="mx-auto w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center mb-3">
                <Upload className="w-7 h-7 text-blue-400" />
              </div>
              <h4 className="text-base font-bold text-white">
                {isKu ? 'فایلی ئێکسڵەکە لێرە ڕابکێشە یان کلیک بکە' : 'Drag & drop your Excel file here or click to browse'}
              </h4>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {isKu
                  ? 'پشتیوانی فۆرماتەکانی .xlsx و .xls و .csv دەکات. وێنەی دیفۆڵتی ستاندارد بەخۆڕایی بۆ هەر دیڤایسێک دادەنرێت.'
                  : 'Supports .xlsx, .xls, and .csv. Category-specific hardware photos are automatically assigned.'}
              </p>
              {isParsing && (
                <div className="mt-4 inline-flex items-center gap-2 text-xs text-blue-400">
                  <div className="w-3.5 h-3.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                  <span>{isKu ? 'شیکردنەوە و بەراوردکردنی فایلی ئێکسڵ...' : 'Analyzing & comparing with existing BOQ...'}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary Metrics Bar with Action Counts */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">{isKu ? 'کۆی گشتی لە فایل' : 'Total Rows'}</span>
                  <span className="text-base font-bold text-white">{parsedItems.length}</span>
                </div>
                <div className="p-3 rounded-2xl bg-emerald-950/20 border border-emerald-500/30">
                  <span className="text-[10px] text-emerald-400 block font-semibold">{isKu ? '➕ مۆدێلی نوێ' : '➕ To Add'}</span>
                  <span className="text-base font-bold text-emerald-400">{addItems.length}</span>
                </div>
                <div className="p-3 rounded-2xl bg-amber-950/20 border border-amber-500/30">
                  <span className="text-[10px] text-amber-300 block font-semibold">{isKu ? '🔄 ئەپدەیت دەبێت' : '🔄 To Update'}</span>
                  <span className="text-base font-bold text-amber-300">{updateItems.length}</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-semibold">{isKu ? '⏭️ بێ گۆڕانکاری (سکیپ)' : '⏭️ To Skip'}</span>
                  <span className="text-base font-bold text-slate-300">{skipItems.length}</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block">{isKu ? 'فایل' : 'File'}</span>
                    <span className="text-xs font-semibold text-slate-200 truncate max-w-[90px] block" title={selectedFile?.name}>
                      {selectedFile?.name}
                    </span>
                  </div>
                  <button
                    onClick={handleReset}
                    title={isKu ? 'سڕینەوە و هەڵبژاردنەوە' : 'Reset file'}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Action Filter Pills */}
              <div className="flex flex-wrap items-center gap-2 pt-1 border-b border-slate-800 pb-2.5">
                <button
                  type="button"
                  onClick={() => setActiveFilter('all')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition ${
                    activeFilter === 'all'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {isKu ? 'هەموو' : 'All'} ({parsedItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('add')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                    activeFilter === 'add'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-emerald-950/30 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-900/40'
                  }`}
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>{isKu ? 'نوێ' : 'New'} ({addItems.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('update')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                    activeFilter === 'update'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'bg-amber-950/30 text-amber-300 border border-amber-500/30 hover:bg-amber-900/40'
                  }`}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{isKu ? 'گۆڕانکاری و ئەپدەیت' : 'Modified'} ({updateItems.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveFilter('skip')}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 ${
                    activeFilter === 'skip'
                      ? 'bg-slate-700 text-white shadow-sm'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
                  }`}
                >
                  <SkipForward className="w-3.5 h-3.5" />
                  <span>{isKu ? 'بێ گۆڕانکاری (دەپەڕێندرێت)' : 'Unchanged'} ({skipItems.length})</span>
                </button>
              </div>

              {/* Items Preview Table */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/50">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/90 text-slate-400 sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">{isKu ? 'حاڵەت' : 'Action'}</th>
                        <th className="py-2.5 px-3">{isKu ? 'وێنەی دیفۆڵت' : 'Default Image'}</th>
                        <th className="py-2.5 px-3">{isKu ? 'براند و مۆدێل' : 'Brand & Model'}</th>
                        <th className="py-2.5 px-3">{isKu ? 'بەش (Category)' : 'Category'}</th>
                        <th className="py-2.5 px-3">{isKu ? 'ژمارە' : 'Qty'}</th>
                        <th className="py-2.5 px-3">{isKu ? 'نرخ' : 'Unit Cost'}</th>
                        <th className="py-2.5 px-3">{isKu ? 'گۆڕانکارییەکان' : 'Detected Diff'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredPreview.map((item, idx) => (
                        <tr
                          key={idx}
                          className={`transition ${
                            item._action === 'add'
                              ? 'bg-emerald-950/10 hover:bg-emerald-950/20'
                              : item._action === 'update'
                              ? 'bg-amber-950/10 hover:bg-amber-950/20'
                              : 'hover:bg-slate-900/40 opacity-70'
                          }`}
                        >
                          <td className="py-2 px-3">
                            {item._action === 'add' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                ➕ {isKu ? 'نوێ' : 'Add'}
                              </span>
                            )}
                            {item._action === 'update' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                🔄 {isKu ? 'ئەپدەیت' : 'Update'}
                              </span>
                            )}
                            {item._action === 'skip' && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400 border border-slate-700">
                                ⏭️ {isKu ? 'سکیپ' : 'Skip'}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <img
                              src={item.product_image_url}
                              alt={item.model}
                              className="w-10 h-10 object-cover rounded-lg border border-slate-800 bg-slate-900"
                              onError={(e) => {
                                e.target.src = 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600';
                              }}
                            />
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-semibold text-white block">{item.brand}</span>
                            <span className="text-blue-400 font-mono text-[11px] block">{item.model}</span>
                            {item.description && (
                              <span className="text-slate-400 text-[10px] line-clamp-1 max-w-xs">{item.description}</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/15 text-blue-300 border border-blue-500/25">
                              {isKu && item.category_name_ku ? item.category_name_ku : item.category_name}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-semibold text-white">
                            {item.total_qty}
                          </td>
                          <td className="py-2 px-3 text-slate-300 font-mono">
                            ${item.unit_cost}
                          </td>
                          <td className="py-2 px-3 text-[11px]">
                            {item._diffs && item._diffs.length > 0 ? (
                              <div className="space-y-1">
                                {item._diffs.map((d, i) => (
                                  <span
                                    key={i}
                                    className="inline-block mr-1 px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30 text-[10px]"
                                  >
                                    {d.label}: {d.oldVal} ➔ <strong>{d.newVal}</strong>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-500 text-[10px]">
                                {item._action === 'add'
                                  ? (isKu ? 'ئامێری تەواو نوێ' : 'Brand new item')
                                  : (isKu ? 'تەواو وەک خۆیەتی' : 'Identical, no changes')}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400">
            {parsedItems.length > 0 && (
              <span>
                {isKu
                  ? `${addItems.length} نوێ زیاد دەبێت، ${updateItems.length} ئەپدەیت دەبێت، ${skipItems.length} دەپەڕێندرێت`
                  : `${addItems.length} to add, ${updateItems.length} to update, ${skipItems.length} to skip`}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isImporting}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              {isKu ? 'داخستن' : 'Close'}
            </button>
            {parsedItems.length > 0 && (
              <button
                type="button"
                onClick={handleConfirmImport}
                disabled={isImporting || (addItems.length === 0 && updateItems.length === 0)}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 transition disabled:opacity-50"
              >
                {isImporting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{isKu ? 'هاوردە و ئەپدەیت دەکرێت...' : 'Synchronizing...'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isKu
                        ? `پشتڕاستکردنەوە و هاوردەکردن (${addItems.length} نوێ + ${updateItems.length} ئەپدەیت)`
                        : `Confirm & Apply (${addItems.length} New + ${updateItems.length} Updated)`}
                    </span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
