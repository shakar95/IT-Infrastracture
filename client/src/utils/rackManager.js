import { useState, useEffect } from 'react';

/**
 * Rack & Cabinet Management Utility
 * Manages Server Racks, Network Cabinets, and AV Racks across the Sitak Villa project
 */

export const DEFAULT_RACKS = [
  {
    id: 'main_rack_a',
    name: 'Main 42U Server Rack A',
    nameKu: 'ڕاکی سەرەکی 42U سێرڤەر A',
    totalUnits: 42,
    zone: 'main_villa',
    location: 'Main Server Room (Basement -1)',
    isSystem: true,
    floor_plan_id: null,
    pos_x: null,
    pos_y: null,
  },
  {
    id: 'guest_rack',
    name: 'Guest House 24U Network Rack',
    nameKu: 'ڕاکی خانەی میوان 24U تۆڕ',
    totalUnits: 24,
    zone: 'guest_house',
    location: 'Guest House IT Closet',
    isSystem: true,
    floor_plan_id: null,
    pos_x: null,
    pos_y: null,
  },
  {
    id: 'service_rack',
    name: 'Service Area 18U MDF Rack',
    nameKu: 'ڕاکی ناوچەی خزمەتگوزاری 18U',
    totalUnits: 18,
    zone: 'service_area',
    location: 'Service Block Tech Room',
    isSystem: true,
    floor_plan_id: null,
    pos_x: null,
    pos_y: null,
  },
  {
    id: 'gate_cabinet',
    name: 'Security Gate 12U Wall Cabinet',
    nameKu: 'کابینەی ئاسایش و دەروازە 12U',
    totalUnits: 12,
    zone: 'security_gate',
    location: 'Security Office',
    isSystem: false,
    floor_plan_id: null,
    pos_x: null,
    pos_y: null,
  },
];

const STORAGE_KEY = 'it_infrastructure_racks_v1';
const EVENT_NAME = 'it_racks_updated';

export function getStoredRacks() {
  if (typeof window === 'undefined') return DEFAULT_RACKS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_RACKS;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_RACKS;
    return parsed;
  } catch (err) {
    console.warn('Failed to parse stored racks, reverting to defaults:', err);
    return DEFAULT_RACKS;
  }
}

export function saveStoredRacks(racks) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(racks));
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: racks }));
  } catch (err) {
    console.error('Failed to save racks to localStorage:', err);
  }
}

export function addRack(name, nameKu, totalUnits = 42, zone = 'main_villa', location = '') {
  const cleanName = (name || '').trim();
  const cleanKu = (nameKu || '').trim() || cleanName;
  if (!cleanName && !cleanKu) return null;

  const current = getStoredRacks();
  let baseId = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!baseId) {
    baseId = `rack_${Date.now()}`;
  }
  let id = baseId;
  let counter = 1;
  while (current.some((r) => r.id === id)) {
    id = `${baseId}_${counter++}`;
  }

  const newRack = {
    id,
    name: cleanName || cleanKu,
    nameKu: cleanKu || cleanName,
    totalUnits: Number(totalUnits) || 42,
    zone: zone || 'main_villa',
    location: location.trim(),
    isSystem: false,
    floor_plan_id: null,
    pos_x: null,
    pos_y: null,
  };

  const updated = [...current, newRack];
  saveStoredRacks(updated);
  return newRack;
}

export function updateRack(id, updates = {}) {
  const current = getStoredRacks();
  const updated = current.map((r) => {
    if (r.id === id) {
      return {
        ...r,
        name: updates.name !== undefined ? (updates.name.trim() || r.name) : r.name,
        nameKu: updates.nameKu !== undefined ? (updates.nameKu.trim() || r.nameKu || r.name) : r.nameKu,
        totalUnits: updates.totalUnits !== undefined ? Number(updates.totalUnits) || r.totalUnits : r.totalUnits,
        zone: updates.zone !== undefined ? updates.zone : r.zone,
        location: updates.location !== undefined ? updates.location.trim() : r.location,
        floor_plan_id: updates.floor_plan_id !== undefined ? updates.floor_plan_id : (r.floor_plan_id || null),
        pos_x: updates.pos_x !== undefined ? updates.pos_x : (r.pos_x ?? null),
        pos_y: updates.pos_y !== undefined ? updates.pos_y : (r.pos_y ?? null),
      };
    }
    return r;
  });
  saveStoredRacks(updated);
  return updated;
}

export function updateRackPosition(id, { floor_plan_id = null, pos_x = null, pos_y = null } = {}) {
  const current = getStoredRacks();
  const updated = current.map((r) => {
    if (r.id === id) {
      return {
        ...r,
        floor_plan_id: floor_plan_id || null,
        pos_x: pos_x !== null && pos_x !== undefined ? Number(pos_x) : null,
        pos_y: pos_y !== null && pos_y !== undefined ? Number(pos_y) : null,
      };
    }
    return r;
  });
  saveStoredRacks(updated);
  return updated;
}

export function unpinRack(id) {
  return updateRackPosition(id, { floor_plan_id: null, pos_x: null, pos_y: null });
}

export function deleteRack(id) {
  const current = getStoredRacks();
  const updated = current.filter((r) => r.id !== id);
  saveStoredRacks(updated);
  return updated;
}

export function formatRack(rackIdOrName, lang = 'en') {
  if (!rackIdOrName) return null;
  const racks = getStoredRacks();
  const isKu = lang === 'ku';

  const match = racks.find(
    (r) =>
      r.id === rackIdOrName ||
      r.name.toLowerCase() === rackIdOrName.toLowerCase() ||
      (r.nameKu && r.nameKu.toLowerCase() === rackIdOrName.toLowerCase())
  );

  if (match) {
    return isKu ? (match.nameKu || match.name) : match.name;
  }

  return rackIdOrName;
}

/**
 * React hook to listen to reactive updates for racks
 */
export function useRacks() {
  const [racks, setRacks] = useState(() => getStoredRacks());

  useEffect(() => {
    const handleUpdate = (e) => {
      if (e.detail) {
        setRacks(e.detail);
      } else {
        setRacks(getStoredRacks());
      }
    };

    window.addEventListener(EVENT_NAME, handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener(EVENT_NAME, handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, []);

  return {
    racks,
    addRack,
    updateRack,
    deleteRack,
    updateRackPosition,
    unpinRack,
    formatRack: (id, lang) => formatRack(id, lang),
  };
}

