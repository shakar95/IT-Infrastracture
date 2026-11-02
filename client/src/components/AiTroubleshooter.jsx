import React, { useState, useEffect } from 'react';
import {
  Bot,
  Sparkles,
  Send,
  Cpu,
  RefreshCw,
  HelpCircle,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Terminal,
} from 'lucide-react';
import { translations } from '../i18n/translations';
import { api } from '../services/api';

export default function AiTroubleshooter({
  devices = [],
  boqModels = [],
  initialDevice = null,
  lang = 'en',
}) {
  const t = translations[lang] || translations.en;
  const isKu = lang === 'ku';

  const [selectedDeviceId, setSelectedDeviceId] = useState(initialDevice?.id || '');
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [solutionResult, setSolutionResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (initialDevice) {
      setSelectedDeviceId(initialDevice.id);
      setQuery(`Device ${initialDevice.custom_label_id} (${initialDevice.ip_address || 'No IP'}) is experiencing connection loss.`);
    }
  }, [initialDevice]);

  const quickScenarios = [
    {
      title: 'Crestron touch screen TSW-770 is offline',
      query: 'Crestron touch screen TSW-770 is offline and not responding to master CP4N controller.',
    },
    {
      title: 'LPR gate barrier not opening for incoming cars',
      query: 'Hikvision LPR camera reads the vehicle plate but the automatic hydraulic barrier relay does not lift.',
    },
    {
      title: 'Wi-Fi 7 AP-GF-01 packet drops & link speed',
      query: 'Ubiquiti U7-Pro access point AP-GF-01 is falling back from 2.5 GbE to 100 Mbps on switch port 14.',
    },
    {
      title: 'Televes IPTV multicast stream freeze',
      query: 'Televes Avant X IPTV headend stream freezes on VLAN 10 after 3 minutes of multicast playback.',
    },
  ];

  const handleRunTroubleshoot = async (promptQuery) => {
    const textToRun = promptQuery || query;
    if (!textToRun.trim()) return;

    setIsLoading(true);
    setErrorMsg(null);
    setSolutionResult(null);

    try {
      const res = await api.troubleshootIssue(textToRun, selectedDeviceId || null);
      setSolutionResult(res);
    } catch (err) {
      setErrorMsg(err.message || 'Troubleshooting request failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedDev = devices.find((d) => d.id === selectedDeviceId);
  const selectedModel = selectedDev ? boqModels.find((m) => m.id === selectedDev.boq_model_id) : null;

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Bot className="w-6 h-6 text-indigo-400" />
          <span>{t.troubleshootTitle}</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">{t.troubleshootSubtitle}</p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-2xl flex items-center gap-3 text-xs text-red-200">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Main Troubleshooting Form */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
        {/* Device Context Picker */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-300">
            {t.selectTargetDevice}
          </label>
          <select
            value={selectedDeviceId}
            onChange={(e) => setSelectedDeviceId(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
          >
            <option value="">General Project Infrastructure Query (No specific device)</option>
            {devices.map((d) => {
              const m = boqModels.find((model) => model.id === d.boq_model_id);
              return (
                <option key={d.id} value={d.id}>
                  {d.custom_label_id} — {m ? `${m.brand} ${m.model}` : 'ELV Unit'} ({d.ip_address || 'No IP'}, VLAN {d.vlan_id})
                </option>
              );
            })}
          </select>
        </div>

        {/* Selected Device Context Card */}
        {selectedDev && (
          <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
            <div>
              <span className="text-slate-400 text-[10px] block">HARDWARE UNDER TEST</span>
              <span className="font-bold text-white">{selectedDev.custom_label_id}</span>
              <span className="text-slate-400 ml-2">
                ({selectedModel ? `${selectedModel.brand} ${selectedModel.model}` : 'Generic'})
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded bg-slate-900 text-cyan-400 border border-slate-800">
                IP: {selectedDev.ip_address || 'Unassigned'}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-900 text-blue-400 border border-slate-800">
                VLAN: {selectedDev.vlan_id || 10}
              </span>
              <span className="px-2 py-0.5 rounded bg-slate-900 text-amber-300 border border-slate-800">
                {selectedDev.switch_name ? `${selectedDev.switch_name} [${selectedDev.switch_port}]` : 'Unpatched'}
              </span>
            </div>
          </div>
        )}

        {/* Quick Question Chips */}
        <div>
          <span className="text-xs font-medium text-slate-400 block mb-2">{t.quickInquiries}</span>
          <div className="flex flex-wrap gap-2">
            {quickScenarios.map((sc, i) => (
              <button
                key={i}
                onClick={() => {
                  setQuery(sc.query);
                  handleRunTroubleshoot(sc.query);
                }}
                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-950 hover:bg-indigo-950/40 text-slate-300 hover:text-indigo-300 border border-slate-800 hover:border-indigo-500/40 transition active:scale-95 text-left"
              >
                {sc.title}
              </button>
            ))}
          </div>
        </div>

        {/* Input Text Box */}
        <div className="space-y-3">
          <div className="relative">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.queryPlaceholder}
              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 h-28 resize-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => handleRunTroubleshoot()}
              disabled={isLoading || !query.trim()}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white shadow-lg shadow-indigo-900/40 transition active:scale-95 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{t.diagnosing}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>{t.btnDiagnose}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* AI Diagnostic Solution Display */}
      {solutionResult && (
        <div className="p-6 bg-slate-900 border border-indigo-500/40 rounded-3xl shadow-2xl space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-indigo-400" />
              <h3 className="text-base font-bold text-white">{t.solutionTitle}</h3>
            </div>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-mono">
              Engine: {solutionResult.provider}
            </span>
          </div>

          {/* Formatted Solution Output */}
          <div className="prose prose-invert max-w-none text-xs sm:text-sm text-slate-200 leading-relaxed space-y-3 font-sans whitespace-pre-line">
            {solutionResult.solution}
          </div>

          {solutionResult.manual_used && (
            <div className="pt-3 border-t border-slate-800 flex items-center gap-2 text-xs text-slate-400">
              <FileText className="w-4 h-4 text-amber-400" />
              <span>Referenced Technical Source: <strong>{solutionResult.manual_used}</strong></span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

