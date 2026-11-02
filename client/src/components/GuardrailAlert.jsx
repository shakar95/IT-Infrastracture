import React from 'react';
import { AlertTriangle, X, ShieldAlert, Cpu, Network, MapPin } from 'lucide-react';

export default function GuardrailAlert({ alert, onClose, lang = 'en' }) {
  if (!alert) return null;

  const isKu = lang === 'ku';

  const getIcon = () => {
    switch (alert.code) {
      case 'RACK_PLACEMENT_REQUIRED':
      case 'MAP_ZONE_MISMATCH_RACK':
        return <Cpu className="w-8 h-8 text-amber-400 shrink-0" />;
      case 'ZONE_MISMATCH_OUTDOOR':
      case 'CERTIFIED_ZONE_RESTRICTION':
        return <MapPin className="w-8 h-8 text-rose-400 shrink-0" />;
      case 'DUPLICATE_IP_DETECTED':
      case 'DUPLICATE_SWITCH_PORT':
        return <Network className="w-8 h-8 text-red-500 shrink-0" />;
      default:
        return <ShieldAlert className="w-8 h-8 text-amber-400 shrink-0" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-xl bg-slate-900 border-2 border-red-500/70 rounded-2xl shadow-2xl shadow-red-950/50 overflow-hidden">
        {/* Top Hazard Bar */}
        <div className="h-2 bg-gradient-to-r from-red-600 via-amber-500 to-red-600 animate-pulse" />

        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
              {getIcon()}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Smart Guardrail Protection
                </span>
                <button
                  onClick={onClose}
                  className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <h3 className="mt-2 text-xl font-bold text-white tracking-tight">
                {isKu ? 'ئاگاداری ڕێگری ئەندازیاری و شوێنی نادروست!' : 'Placement Guardrail Violation Prevented'}
              </h3>

              {/* Kurdish Primary Message */}
              <div className="mt-4 p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl">
                <p className="text-xs uppercase tracking-wider font-semibold text-amber-400 mb-1">
                  پوختەی کوردی (Kurdish Rule Explanation):
                </p>
                <p className="text-sm font-medium text-slate-200 leading-relaxed font-sans" dir="rtl">
                  {alert.message_ku || alert.message || 'کردارەکە بەپێی ڕێنماییەکان ڕێپێدراو نییە.'}
                </p>
              </div>

              {/* English Technical Message */}
              <div className="mt-3 p-3.5 bg-slate-950/70 border border-slate-800 rounded-xl">
                <p className="text-xs uppercase tracking-wider font-semibold text-blue-400 mb-1">
                  Technical Specification (English):
                </p>
                <p className="text-sm font-mono text-slate-300 leading-relaxed">
                  {alert.message_en || alert.message}
                </p>
              </div>

              {/* Details if available */}
              {alert.details && Object.keys(alert.details).length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {Object.entries(alert.details).map(([k, v]) => (
                    <span key={k} className="px-2.5 py-1 bg-slate-800 text-slate-300 rounded-md border border-slate-700">
                      <strong className="text-slate-400">{k}:</strong> {String(v)}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-800">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r from-red-600 to-amber-600 text-white hover:from-red-500 hover:to-amber-500 shadow-lg shadow-red-900/30 transition active:scale-95"
            >
              {isKu ? 'تێگەیشتم و چاکی دەکەم (Acknowledge & Correct)' : 'Acknowledge & Correct'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

