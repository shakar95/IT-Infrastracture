import { useState, useEffect } from 'react';

export const DEFAULT_ZONES = [
  { id: 'indoor', label: 'Indoor', labelKu: 'ناو ماڵ', isSystem: true },
  { id: 'outdoor', label: 'Outdoor', labelKu: 'دەرەوە و باخچە', isSystem: true },
  { id: 'rack', label: 'Server Rack', labelKu: 'ژووری سێرڤەر و ڕاک', isSystem: true },
  { id: 'safe_room', label: 'Safe Room', labelKu: 'ژووری پارێزراو', isSystem: true },
];

const STORAGE_KEY = 'it_infrastructure_zones_v2';
const EVENT_NAME = 'it_zones_updated';

export function getStoredZones() {
  if (typeof window === 'undefined') return DEFAULT_ZONES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_ZONES;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_ZONES;
    return parsed;
  } catch (err) {
    console.warn('Failed to parse stored zones, reverting to defaults:', err);
    return DEFAULT_ZONES;
  }
}

export function saveStoredZones(zones) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(zones));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: zones }));
  } catch (err) {
    console.error('Failed to save zones to localStorage:', err);
  }
}

export function addCustomZone(name, nameKu) {
  const cleanName = (name || '').trim();
  const cleanKu = (nameKu || '').trim() || cleanName;
  if (!cleanName && !cleanKu) return null;

  const current = getStoredZones();
  // Generate safe id
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
  saveStoredZones(updated);
  return newZone;
}

export function updateCustomZone(id, name, nameKu) {
  const current = getStoredZones();
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
  saveStoredZones(updated);
  return updated;
}

export function deleteCustomZone(id) {
  const current = getStoredZones();
  const updated = current.filter((z) => z.id !== id);
  saveStoredZones(updated);
  return updated;
}

export function formatZoneLabel(zoneId, lang = 'en') {
  if (!zoneId || zoneId === 'none' || zoneId === 'unassigned') {
    return lang === 'ku' ? 'دیاری نەکراو / گشتی' : 'Unassigned / General';
  }
  const zones = getStoredZones();
  const found = zones.find((z) => z.id === zoneId);
  if (found) {
    return lang === 'ku' ? (found.labelKu || found.label) : (found.label || found.labelKu);
  }
  // Fallback to formatted ID string
  return zoneId.replace(/_/g, ' ');
}

/**
 * React hook to subscribe to reactive zone updates across all views
 */
export function useZones() {
  const [zones, setZones] = useState(() => getStoredZones());

  useEffect(() => {
    const handleUpdate = () => {
      setZones(getStoredZones());
    };

    window.addEventListener(EVENT_NAME, handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener(EVENT_NAME, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  return {
    zones,
    addZone: (name, nameKu) => addCustomZone(name, nameKu),
    updateZone: (id, name, nameKu) => updateCustomZone(id, name, nameKu),
    deleteZone: (id) => deleteCustomZone(id),
    formatZone: (zoneId, lang) => formatZoneLabel(zoneId, lang),
  };
}

