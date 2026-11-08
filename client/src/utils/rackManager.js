import { useState, useEffect } from 'react';
import { api } from '../services/api';

/**
 * Rack & Cabinet Management Utility
 * Manages Server Racks, Network Cabinets, and AV Racks across the Sitak Villa project
 * Supports auto-sync with Backend API & auto-discovery from Device rack names
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

export function saveStoredRacks(racks, emitEvent = true) {
  if (typeof window === 'undefined' || !Array.isArray(racks)) return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(racks));
    if (emitEvent) {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: racks }));
    }
  } catch (err) {
    console.error('Failed to save racks to localStorage:', err);
  }
}

/**
 * Merge an array of racks into storage without losing existing items or coordinates
 */
export function mergeRacks(newRacks = []) {
  if (!Array.isArray(newRacks) || newRacks.length === 0) return getStoredRacks();
  const current = getStoredRacks();
  let changed = false;
  const merged = [...current];

  newRacks.forEach((nR) => {
    if (!nR || !nR.name) return;
    const idx = merged.findIndex(
      (r) =>
        r.id === nR.id ||
        r.name?.toLowerCase() === nR.name?.toLowerCase() ||
        (r.nameKu && nR.nameKu && r.nameKu?.toLowerCase() === nR.nameKu?.toLowerCase())
    );

    if (idx !== -1) {
      // Update missing fields
      const existing = merged[idx];
      const updatedItem = {
        ...existing,
        ...nR,
        // preserve coordinates if not present in new
        pos_x: nR.pos_x !== undefined && nR.pos_x !== null ? nR.pos_x : existing.pos_x,
        pos_y: nR.pos_y !== undefined && nR.pos_y !== null ? nR.pos_y : existing.pos_y,
        floor_plan_id: nR.floor_plan_id !== undefined && nR.floor_plan_id !== null ? nR.floor_plan_id : existing.floor_plan_id,
      };
      if (JSON.stringify(existing) !== JSON.stringify(updatedItem)) {
        merged[idx] = updatedItem;
        changed = true;
      }
    } else {
      merged.push(nR);
      changed = true;
    }
  });

  if (changed) {
    saveStoredRacks(merged);
  }
  return merged;
}

/**
 * Auto-discover racks from devices list
 */
export function syncRacksWithDevices(devicesList = []) {
  if (!Array.isArray(devicesList) || devicesList.length === 0) return getStoredRacks();
  const current = getStoredRacks();
  let changed = false;
  const updated = [...current];

  devicesList.forEach((d) => {
    const rName = d?.rack_name?.trim();
    if (!rName) return;

    const exists = updated.some(
      (r) =>
        r.name?.toLowerCase() === rName.toLowerCase() ||
        r.id?.toLowerCase() === rName.toLowerCase() ||
        (r.nameKu && r.nameKu?.toLowerCase() === rName.toLowerCase())
    );

    if (!exists) {
      const cleanId = rName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `rack_${Date.now()}`;
      updated.push({
        id: cleanId,
        name: rName,
        nameKu: rName,
        totalUnits: 42,
        zone: d.zone || 'main_villa',
        location: d.zone ? `Zone: ${d.zone}` : 'Server Rack',
        isSystem: false,
        floor_plan_id: d.floor_plan_id || null,
        pos_x: d.pos_x || null,
        pos_y: d.pos_y || null,
      });
      changed = true;
    }
  });

  if (changed) {
    saveStoredRacks(updated);
    // Background sync to server
    api.syncRacks(updated).catch(() => {});
  }
  return updated;
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

  // Sync with server
  api.createRack(newRack).catch((err) => {
    console.warn('Backend rack create sync warning:', err);
    api.syncRacks(updated).catch(() => {});
  });

  return newRack;
}

export function updateRack(id, updates = {}) {
  const current = getStoredRacks();
  let updatedRack = null;
  const updated = current.map((r) => {
    if (r.id === id) {
      updatedRack = {
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
      return updatedRack;
    }
    return r;
  });
  saveStoredRacks(updated);

  // Sync with server
  if (updatedRack) {
    api.updateRack(id, updates).catch((err) => {
      console.warn('Backend rack update sync warning:', err);
    });
  }

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

  // Sync with server
  api.updateRack(id, { floor_plan_id, pos_x, pos_y }).catch((err) => {
    console.warn('Backend rack position update warning:', err);
  });

  return updated;
}

export function unpinRack(id) {
  return updateRackPosition(id, { floor_plan_id: null, pos_x: null, pos_y: null });
}

export function deleteRack(id) {
  const current = getStoredRacks();
  const updated = current.filter((r) => r.id !== id);
  saveStoredRacks(updated);

  // Sync with server
  api.deleteRack(id).catch((err) => {
    console.warn('Backend rack delete warning:', err);
  });

  return updated;
}

export function formatRack(rackIdOrName, lang = 'en') {
  if (!rackIdOrName) return null;
  const racks = getStoredRacks();
  const isKu = lang === 'ku';

  const match = racks.find(
    (r) =>
      r.id === rackIdOrName ||
      r.name?.toLowerCase() === rackIdOrName.toLowerCase() ||
      (r.nameKu && r.nameKu?.toLowerCase() === rackIdOrName.toLowerCase())
  );

  if (match) {
    return isKu ? (match.nameKu || match.name) : match.name;
  }

  return rackIdOrName;
}

/**
 * React hook to listen to reactive updates for racks and sync across server / devices
 */
export function useRacks(passedDevices = []) {
  const [racks, setRacks] = useState(() => getStoredRacks());

  // 1. Initial background server sync & upload
  useEffect(() => {
    let isMounted = true;

    async function syncWithServer() {
      try {
        const local = getStoredRacks();
        // Send our local racks to merge with server, and get back latest merged racks
        const res = await api.syncRacks(local);
        if (isMounted && res && Array.isArray(res.racks) && res.racks.length > 0) {
          mergeRacks(res.racks);
          setRacks(getStoredRacks());
        }
      } catch (err) {
        // Fallback: try simple GET
        try {
          const srvRacks = await api.getRacks();
          if (isMounted && Array.isArray(srvRacks) && srvRacks.length > 0) {
            mergeRacks(srvRacks);
            setRacks(getStoredRacks());
          }
        } catch (e) {
          // Offline or network error: use local storage
        }
      }
    }

    syncWithServer();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Auto-discover from passedDevices whenever devices are loaded/updated
  useEffect(() => {
    if (Array.isArray(passedDevices) && passedDevices.length > 0) {
      syncRacksWithDevices(passedDevices);
      setRacks(getStoredRacks());
    }
  }, [passedDevices]);

  // 3. Listen to local events & cross-tab storage events
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
