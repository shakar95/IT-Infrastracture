import React, { useState } from 'react';
import { X, Building2, MapPin, User, Plus, Check } from 'lucide-react';

export default function CreateProjectModal({ isOpen, onClose, onCreateProject, lang = 'en' }) {
  const isKu = lang === 'ku';

  const [formData, setFormData] = useState({
    name: '',
    name_ku: '',
    location: '',
    location_ku: '',
    client_name: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setError(isKu ? 'تکایە ناوی پرۆژەکە بنووسە' : 'Project name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onCreateProject({
        name: formData.name.trim(),
        name_ku: formData.name_ku.trim() || formData.name.trim(),
        location: formData.location.trim() || 'Sulaymaniyah, Kurdistan Region',
        location_ku: formData.location_ku.trim() || formData.location.trim() || 'سلێمانی، هەرێمی کوردستان',
        client_name: formData.client_name.trim() || 'Client Estate',
      });
      onClose();
    } catch (err) {
      setError(err.message || (isKu ? 'هەڵەیەک ڕوویدا' : 'Failed to create project'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/15 text-blue-400 border border-blue-500/25">
              <Building2 className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                {isKu ? 'دروستکردنی پرۆژە یان سایتی نوێ' : 'Create New Project / Site'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isKu
                  ? 'سایت یان ڤێلایەکی نوێ زیاد بکە بۆ بەڕێوەبردنی BOQ و کەرەستەکانی ژێرخان'
                  : 'Add a new estate, villa, or facility to manage separate BOQ and equipment'}
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

        {error && (
          <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-xs text-rose-300 font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {isKu ? 'ناوی پرۆژە (بە ئینگلیزی - فەرمی) *' : 'Project Name (English) *'}
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Dukan Lake Luxury Villa Project"
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {isKu ? 'ناوی پرۆژە بە کوردی' : 'Project Name (Kurdish)'}
            </label>
            <input
              type="text"
              value={formData.name_ku}
              onChange={(e) => setFormData({ ...formData, name_ku: e.target.value })}
              placeholder="وەک: پرۆژەی ڤێلای دەریاچەی دووکان"
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-right"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {isKu ? 'شوێن / لۆکەیشن (ئینگلیزی)' : 'Location (English)'}
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g. Dukan, Sulaymaniyah, KRI"
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                {isKu ? 'شوێن بە کوردی' : 'Location (Kurdish)'}
              </label>
              <input
                type="text"
                value={formData.location_ku}
                onChange={(e) => setFormData({ ...formData, location_ku: e.target.value })}
                placeholder="دووکان، سلێمانی"
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition text-right"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              {isKu ? 'ناوی کڕیار یان جۆری موڵک' : 'Client Name / Estate Type'}
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={formData.client_name}
                onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                placeholder="e.g. VIP Lake Residence"
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-9 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            >
              {isKu ? 'پاشگەزبوونەوە' : 'Cancel'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <span>{isKu ? 'دروستدەکرێت...' : 'Creating...'}</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{isKu ? 'دروستکردنی پڕۆژە' : 'Create Site / Project'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

