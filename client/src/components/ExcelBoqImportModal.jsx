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
} from 'lucide-react';
import { downloadBoqExcelTemplate, parseBoqExcelFile } from '../utils/excelBoqUtils';

export default function ExcelBoqImportModal({
  isOpen,
  onClose,
  categories = [],
  onImport,
  lang = 'en',
}) {
  const isKu = lang === 'ku';
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [parsedItems, setParsedItems] = useState([]);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState(null);
  const [successCount, setSuccessCount] = useState(null);
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
      setError(isKu ? 'تکایە تەنها فایلی ئێکسڵ (.xlsx, .xls) یان .csv دابنێ' : 'Please upload a valid .xlsx, .xls, or .csv file');
      return;
    }

    try {
      setIsParsing(true);
      setError(null);
      setSelectedFile(file);
      const items = await parseBoqExcelFile(file, categories);
      if (!items || items.length === 0) {
        throw new Error(isKu ? 'هیچ داتایەکی دروست لە ناو فایلی ئێکسڵەکە نەدۆزرایەوە' : 'No valid BOQ items found in Excel sheet');
      }
      setParsedItems(items);
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
      await onImport(parsedItems);
      setSuccessCount(parsedItems.length);
      setTimeout(() => {
        onClose();
        setSuccessCount(null);
        setParsedItems([]);
        setSelectedFile(null);
      }, 1500);
    } catch (err) {
      setError(err.message || (isKu ? 'هاوردەکردنی داتاکان سەرکەوتوو نەبوو' : 'Failed to import BOQ items'));
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setSelectedFile(null);
    setParsedItems([]);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const totalParsedQty = parsedItems.reduce((acc, it) => acc + (it.total_qty || 0), 0);
  const totalParsedCost = parsedItems.reduce((acc, it) => acc + (it.unit_cost || 0) * (it.total_qty || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col space-y-5 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              <FileSpreadsheet className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                {isKu ? 'هاوردەکردنی BOQ لە فایلی ئێکسڵەوە' : 'Import BOQ Catalog from Excel'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isKu
                  ? 'فایلی ئێکسڵی کەرەستەکان باربکە، سیستەمەکە خۆکارانە وێنەی دیفۆڵت و بەشەکانیان ڕێکدەخات'
                  : 'Bulk import hardware models from Excel with automatic category detection and default equipment photos'}
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
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-950/40 via-indigo-950/30 to-slate-900 border border-blue-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
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

        {successCount !== null && (
          <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2 shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              {isKu
                ? `بە سەرکەوتوویی ${successCount} ئامێر لە ئێکسڵەوە هاوردەی کەتەلۆکی BOQ کرا!`
                : `Successfully imported ${successCount} equipment models to BOQ!`}
            </span>
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
                  <span>{isKu ? 'شیکردنەوەی فایلی ئێکسڵ...' : 'Analyzing Excel file...'}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Summary Metrics Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">{isKu ? 'مۆدێلەکان' : 'Models Detected'}</span>
                  <span className="text-base font-bold text-white">{parsedItems.length}</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">{isKu ? 'کۆی گشتی کەرەستە' : 'Total Units'}</span>
                  <span className="text-base font-bold text-emerald-400">{totalParsedQty}</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">{isKu ? 'کۆی مەزەندەکراو' : 'Est. Total Value'}</span>
                  <span className="text-base font-bold text-amber-300">${totalParsedCost.toLocaleString()}</span>
                </div>
                <div className="p-3 rounded-2xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block">{isKu ? 'فایل' : 'File'}</span>
                    <span className="text-xs font-semibold text-slate-200 truncate max-w-[100px] block" title={selectedFile?.name}>
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

              {/* Items Preview Table */}
              <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950/50">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/90 text-slate-400 sticky top-0 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">{isKu ? 'وێنەی دیفۆڵت' : 'Default Image'}</th>
                        <th className="py-2.5 px-3">{isKu ? 'براند و مۆدێل' : 'Brand & Model'}</th>
                        <th className="py-2.5 px-3">{isKu ? 'بەش (Category)' : 'Category'}</th>
                        <th className="py-2.5 px-3">{isKu ? 'ژمارە' : 'Qty'}</th>
                        <th className="py-2.5 px-3">{isKu ? 'نرخ' : 'Unit Cost'}</th>
                        <th className="py-2.5 px-3">{isKu ? 'زۆن' : 'Zone'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {parsedItems.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/40 transition">
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
                          <td className="py-2 px-3 text-[11px] text-slate-400">
                            {item.placement_zone} {item.is_rack_mounted && `(${item.rack_unit_size}U)`}
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
                {isKu ? `${parsedItems.length} ئامێر ئامادەیە بۆ هاوردەکردن` : `${parsedItems.length} items ready to import`}
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
                disabled={isImporting}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/30 transition disabled:opacity-50"
              >
                {isImporting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{isKu ? 'هاوردە دەکرێت...' : 'Importing...'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      {isKu ? `پشتڕاستکردنەوە و هاوردەکردن (${parsedItems.length})` : `Confirm & Import (${parsedItems.length} Items)`}
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
