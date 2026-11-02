import React from 'react';
import {
  LayoutDashboard,
  Layers,
  Cpu,
  Map,
  Camera,
  Bot,
  Settings,
  Languages,
  ShieldCheck,
  Building,
} from 'lucide-react';
import { translations } from '../i18n/translations';

export default function Navbar({ activeTab, setActiveTab, lang, setLang }) {
  const t = translations[lang] || translations.en;
  const isKu = lang === 'ku';

  const navItems = [
    { id: 'dashboard', label: t.navDashboard, icon: LayoutDashboard },
    { id: 'boq', label: t.navBoq, icon: Layers },
    { id: 'devices', label: t.navDevices, icon: Cpu },
    { id: 'map', label: t.navMap, icon: Map },
    { id: 'scanner', label: t.navAiScanner, icon: Camera },
    { id: 'troubleshoot', label: t.navAiTroubleshoot, icon: Bot },
    { id: 'settings', label: t.navSettings, icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      {/* Top Project Identification Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-amber-500 p-0.5 shadow-lg shadow-blue-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Building className="w-5 h-5 text-blue-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                  {t.projectName}
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  {t.systemActive}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {t.projectSubtitle} • <span className="text-amber-400 font-medium">{t.locationTag}</span>
              </p>
            </div>
          </div>

          {/* Right Controls: Language Selector */}
          <div className="flex items-center gap-3">
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1">
              <button
                onClick={() => setLang('en')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  lang === 'en'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLang('ku')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition font-sans ${
                  lang === 'ku'
                    ? 'bg-amber-600 text-white shadow-md shadow-amber-900/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                کوردی (Sorani)
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation Menu */}
        <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto pb-2 scrollbar-none border-t border-slate-800/60 pt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

