import React, { useState, useRef, useEffect } from 'react';
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
  ChevronDown,
  Plus,
  Check,
  MapPin,
  Trash2,
  Pencil,
} from 'lucide-react';
import { translations } from '../i18n/translations';

export default function Navbar({
  activeTab,
  setActiveTab,
  lang,
  setLang,
  projects = [],
  activeProject = null,
  onSwitchProject,
  onOpenCreateProject,
  onEditProject,
  onDeleteProject,
}) {
  const t = translations[lang] || translations.en;
  const isKu = lang === 'ku';

  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsProjectDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    { id: 'dashboard', label: t.navDashboard, icon: LayoutDashboard },
    { id: 'boq', label: t.navBoq, icon: Layers },
    { id: 'devices', label: t.navDevices, icon: Cpu },
    { id: 'map', label: t.navMap, icon: Map },
    { id: 'scanner', label: t.navAiScanner, icon: Camera },
    { id: 'troubleshoot', label: t.navAiTroubleshoot, icon: Bot },
    { id: 'settings', label: t.navSettings, icon: Settings },
  ];

  const currentProjectName = isKu
    ? (activeProject?.name_ku || activeProject?.name || t.projectName)
    : (activeProject?.name || t.projectName);

  const currentLocation = isKu
    ? (activeProject?.location_ku || activeProject?.location || t.locationTag)
    : (activeProject?.location || t.locationTag);

  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur-md border-b border-slate-800">
      {/* Top Project Identification & Switcher Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16">
          {/* Logo & Project Switcher Dropdown */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shadow-sm shrink-0">
              <Building className="w-4 h-4 sm:w-5 sm:h-5 text-blue-400" />
            </div>

            <div className="relative min-w-0" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsProjectDropdownOpen(!isProjectDropdownOpen)}
                className="flex items-center gap-1.5 group text-left rounded-xl p-1 -m-1 hover:bg-slate-800/60 transition min-w-0"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h1 className="text-sm sm:text-base font-bold text-white tracking-tight flex items-center gap-1.5 group-hover:text-blue-400 transition truncate">
                      <span className="truncate">{currentProjectName}</span>
                      <ChevronDown className={`w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-400 transition-transform duration-200 shrink-0 ${isProjectDropdownOpen ? 'rotate-180 text-blue-400' : ''}`} />
                    </h1>
                  </div>
                  <p className="text-[11px] sm:text-xs text-slate-400 flex items-center gap-1 truncate">
                    <span className="hidden sm:inline text-slate-500">{t.projectSubtitle} •</span>
                    <span className="text-slate-300 font-medium truncate">{currentLocation}</span>
                  </p>
                </div>
              </button>

              {/* Projects Switcher Menu */}
              {isProjectDropdownOpen && (
                <div className="absolute left-0 mt-2 w-72 sm:w-80 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-2 z-50 animate-fadeIn">
                  <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 border-b border-slate-800/80 flex items-center justify-between">
                    <span>{isKu ? 'پرۆژە و سایتە بەردەستەکان' : 'Select Project / Site'}</span>
                    <span className="text-blue-400 font-mono text-[10px]">{projects.length} {isKu ? 'سایت' : 'Sites'}</span>
                  </div>

                  <div className="max-h-64 overflow-y-auto py-1 space-y-1">
                    {projects.map((proj) => {
                      const isSelected = activeProject?.id === proj.id;
                      const pName = isKu ? (proj.name_ku || proj.name) : proj.name;
                      const pLoc = isKu ? (proj.location_ku || proj.location) : proj.location;

                      return (
                        <div
                          key={proj.id}
                          className={`w-full group p-2 rounded-xl transition flex items-center justify-between gap-1.5 ${
                            isSelected
                              ? 'bg-blue-600/15 border border-blue-500/30 text-white'
                              : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              if (onSwitchProject) onSwitchProject(proj);
                              setIsProjectDropdownOpen(false);
                            }}
                            className="flex-1 text-left truncate flex items-center justify-between"
                          >
                            <div className="truncate pr-1">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-xs truncate">{pName}</span>
                                {isSelected && (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] bg-blue-500/20 text-blue-400 font-mono shrink-0">
                                    {isKu ? 'چالاک' : 'Active'}
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-slate-400 flex items-center gap-1 truncate mt-0.5">
                                <MapPin className="w-3 h-3 text-amber-400/80 shrink-0" />
                                {pLoc}
                              </span>
                            </div>
                            {isSelected && <Check className="w-4 h-4 text-blue-400 shrink-0 mx-1" />}
                          </button>

                          {/* Project Actions: Edit & Delete */}
                          <div className="flex items-center gap-1 shrink-0">
                            {onEditProject && (
                              <button
                                type="button"
                                title={isKu ? 'دەستکاریکردنی تایتڵ و دیسکریپشن' : 'Edit title & description'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setIsProjectDropdownOpen(false);
                                  onEditProject(proj);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition opacity-80 sm:opacity-0 sm:group-hover:opacity-100 shrink-0"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {onDeleteProject && (
                              <button
                                type="button"
                                title={isKu ? 'سڕینەوەی ئەم سایتە بە تەواوی' : 'Delete this project / site completely'}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteProject(proj.id);
                                }}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition opacity-80 sm:opacity-0 sm:group-hover:opacity-100 shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProjectDropdownOpen(false);
                        if (onOpenCreateProject) onOpenCreateProject();
                      }}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold transition active:scale-95"
                    >
                      <Plus className="w-4 h-4 text-blue-400" />
                      <span>{isKu ? '+ دروستکردنی پرۆژە یان سایتی نوێ' : '+ Add New Site / Project'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Controls: Language Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 shadow-inner">
              <button
                onClick={() => setLang('en')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition ${
                  lang === 'en'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLang('ku')}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition font-sans ${
                  lang === 'ku'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                کوردی
              </button>
            </div>
          </div>
        </div>

        {/* Tab Navigation Menu (Touch-friendly horizontal scroll for Mobile & iPad) */}
        <nav className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-2 scrollbar-none border-t border-slate-800/80 pt-2 touch-pan-x">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all duration-150 shrink-0 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/30 border border-blue-500'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
