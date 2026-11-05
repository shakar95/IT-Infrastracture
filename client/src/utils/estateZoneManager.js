import { useState, useEffect } from 'react';

export const DEFAULT_ESTATE_ZONES = [
  { id: 'main_villa', label: 'Main Villa', labelKu: 'ڤێلای سەرەکی', isSystem: true },
  { id: 'guest_house', label: 'Guest House', labelKu: 'خانەی میوان', isSystem: true },
  { id: 'service_area', label: 'Service Area', labelKu: 'ناوچەی خزمەتگوزاری', isSystem: true },
  { id: 'security_gate', label: 'Security & Gate', labelKu: 'دەروازە و ئاسایش', isSystem: false },
  { id: 'landscape', label: 'Landscape & Garden', labelKu: 'باخچە و سەوزایی', isSystem: false },
];

const STORAGE_KEY = 'it_infrastructure_estate_zones_v1';
const EVENT_NAME = 'it_estate_zones_updated';

export function getStoredEstateZones() {
  if (typeof window === 'undefined') return DEFAULT_ESTATE_ZONES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ESTATE_ZONES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_ESTATE_ZONES;
    return parsed;
  } catch (err) {
    console.warn('Failed to parse stored estate zones, reverting to defaults:', err);
    return DEFAULT_ESTATE_ZONES;
  }
}

export function saveStoredEstateZones(zones) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(zones));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: zones }));
  } catch (err) {
    console.error('Failed to save estate zones to localStorage:', err);
  }
}

export function addEstateZone(name, nameKu) {
  const cleanName = (name || '').trim();
  const cleanKu = (nameKu || '').trim() || cleanName;
  if (!cleanName && !cleanKu) return null;

  const current = getStoredEstateZones();
  let baseId = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!baseId) {
    baseId = `zone_${Date.now()}`;
  }
  let id = baseId;
  let counter = 1;
  while (current.some((z) => z.id === id)) {
    id = `${baseId}_${counter++}`;
  }

  const newZone = {
    id,
    label: cleanName || cleanKu,
    labelKu: cleanKu || cleanName,
    isSystem: false,
  };

  const updated = [...current, newZone];
  saveStoredEstateZones(updated);
  return newZone;
}

export function updateEstateZone(id, name, nameKu) {
  const current = getStoredEstateZones();
  const updated = current.map((z) => {
    if (z.id === id) {
      return {
        ...z,
        label: (name || '').trim() || z.label,
        labelKu: (nameKu || '').trim() || z.labelKu || name,
      };
    }
    return z;
  });
  saveStoredEstateZones(updated);
  return updated;
}

export function deleteEstateZone(id) {
  const current = getStoredEstateZones();
  const updated = current.filter((z) => z.id !== id);
  saveStoredEstateZones(updated);
  return updated;
}

export function formatEstateZone(zoneId, lang = 'en') {
  if (!zoneId || zoneId === 'none' || zoneId === 'unassigned') {
    return lang === 'ku' ? 'گشتی / بێ زۆن' : 'General / No Zone';
  }
  const zones = getStoredEstateZones();
  const found = zones.find((z) => z.id === zoneId || z.label?.toLowerCase() === zoneId.toLowerCase());
  if (found) {
    return lang === 'ku' ? (found.labelKu || found.label) : (found.label || found.labelKu);
  }
  return zoneId.replace(/_/g, ' ');
}

/**
 * React hook to subscribe to estate zones (Main Villa, Guest House, Service Area, etc.)
 */
export function useEstateZones() {
  const [estateZones, setEstateZones] = useState(() => getStoredEstateZones());

  useEffect(() => {
    const handleUpdate = () => {
      setEstateZones(getStoredEstateZones());
    };

    window.addEventListener(EVENT_NAME, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener(EVENT_NAME, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  return {
    estateZones,
    addEstateZone: (name, nameKu) => addEstateZone(name, nameKu),
    updateEstateZone: (id, name, nameKu) => updateEstateZone(id, name, nameKu),
    deleteEstateZone: (id) => deleteEstateZone(id),
    formatEstateZone: (zoneId, lang) => formatEstateZone(zoneId, lang),
  };
}
