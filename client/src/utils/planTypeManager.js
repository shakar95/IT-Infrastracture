import { useState, useEffect } from 'react';

export const DEFAULT_PLAN_TYPES = [
  {
    id: 'ICT',
    label: 'ICT & Networking',
    labelKu: 'ئایتی و تۆڕ (ICT)',
    shortLabel: 'ICT',
    description: 'Data networking, core switches, Wi-Fi APs, servers & telecom',
    descriptionKu: 'تۆڕی زانیاری، سویچەکان، وایفای، سێرڤەر و پەیوەندییەکان',
    color: '#3B82F6', // Blue
    borderColor: 'border-blue-500/40',
    bgColor: 'bg-blue-500/15',
    textColor: 'text-blue-400',
    badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    activeBadgeClass: 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-900/40',
    icon: 'Network',
    isSystem: true,
  },
  {
    id: 'Security',
    label: 'Security & CCTV',
    labelKu: 'ئاسایش و کامێرا (Security)',
    shortLabel: 'Security',
    description: 'CCTV surveillance, access control, gates, intercoms & perimeter detection',
    descriptionKu: 'کامێرای چاودێری، کۆنتڕۆڵی دەرگا، ئینتەرکۆم و سیستەمی ئاگادارکەرەوە',
    color: '#10B981', // Emerald
    borderColor: 'border-emerald-500/40',
    bgColor: 'bg-emerald-500/15',
    textColor: 'text-emerald-400',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    activeBadgeClass: 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-900/40',
    icon: 'Shield',
    isSystem: true,
  },
  {
    id: 'AV',
    label: 'Audio & Visual',
    labelKu: 'دەنگ و ڕەنگ (AV)',
    shortLabel: 'AV',
    description: 'Sound systems, home cinema, IPTV distribution, display screens & conference',
    descriptionKu: 'سیستەمی دەنگ، سینەمای ماڵەوە، تەلەفزیۆنی IPTV و شاشەکان',
    color: '#8B5CF6', // Purple
    borderColor: 'border-purple-500/40',
    bgColor: 'bg-purple-500/15',
    textColor: 'text-purple-400',
    badgeClass: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    activeBadgeClass: 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-900/40',
    icon: 'Tv',
    isSystem: true,
  },
  {
    id: 'BMS',
    label: 'Smart Automation & BMS',
    labelKu: 'سیستەمی زیرەک (BMS)',
    shortLabel: 'BMS',
    description: 'Building management, smart lighting, HVAC controls & shade automation',
    descriptionKu: 'کۆنتڕۆڵی بینا، ڕووناکی زیرەک، فێنککەرەوە و پەردەی ئەلیکترۆنی',
    color: '#F59E0B', // Amber
    borderColor: 'border-amber-500/40',
    bgColor: 'bg-amber-500/15',
    textColor: 'text-amber-400',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    activeBadgeClass: 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-900/40',
    icon: 'Cpu',
    isSystem: false,
  },
];

const STORAGE_KEY = 'it_infrastructure_plan_types_v1';
const EVENT_NAME = 'it_plan_types_updated';

export function getStoredPlanTypes() {
  if (typeof window === 'undefined') return DEFAULT_PLAN_TYPES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PLAN_TYPES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_PLAN_TYPES;
    return parsed;
  } catch (err) {
    console.warn('Failed to parse stored plan types, reverting to defaults:', err);
    return DEFAULT_PLAN_TYPES;
  }
}

export function saveStoredPlanTypes(types) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(types));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: types }));
  } catch (err) {
    console.error('Failed to save plan types to localStorage:', err);
  }
}

export function formatPlanType(typeId, lang = 'en') {
  if (!typeId) {
    return lang === 'ku' ? 'ئایتی و تۆڕ (ICT)' : 'ICT & Networking';
  }
  const types = getStoredPlanTypes();
  const found = types.find((t) => t.id?.toLowerCase() === typeId.toLowerCase());
  if (found) {
    return lang === 'ku' ? (found.labelKu || found.label) : (found.label || found.labelKu);
  }
  return typeId;
}

export function getPlanTypeMeta(typeId) {
  const types = getStoredPlanTypes();
  const found = types.find((t) => t.id?.toLowerCase() === (typeId || 'ICT').toLowerCase());
  return found || DEFAULT_PLAN_TYPES[0];
}

export function usePlanTypes() {
  const [planTypes, setPlanTypes] = useState(getStoredPlanTypes);

  useEffect(() => {
    const handleUpdate = (e) => {
      if (e.detail && Array.isArray(e.detail)) {
        setPlanTypes(e.detail);
      } else {
        setPlanTypes(getStoredPlanTypes());
      }
    };
    window.addEventListener(EVENT_NAME, handleUpdate);
    return () => window.removeEventListener(EVENT_NAME, handleUpdate);
  }, []);

  return {
    planTypes,
    formatPlanType: (id, lang) => formatPlanType(id, lang),
    getPlanTypeMeta,
  };
}
