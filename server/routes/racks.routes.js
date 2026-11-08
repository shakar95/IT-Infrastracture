import express from 'express';
import { supabase, isSupabaseConfigured } from '../config/supabase.js';
import { mockProjectSettings, mockDevices } from '../services/mockData.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../data/racks.json');

// Ensure data folder exists for offline file persistence
try {
  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
} catch (e) {
  // ignore
}

export const INITIAL_DEFAULT_RACKS = [
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

// Helper: Read stored racks from File, Supabase, or Mock
async function readStoredRacks() {
  let racks = null;

  // 1. Try local data file first for fastest local persistence
  try {
    if (fs.existsSync(DATA_FILE)) {
      const content = fs.readFileSync(DATA_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        racks = parsed;
      }
    }
  } catch (err) {
    console.warn('Could not read racks.json:', err.message);
  }

  // 2. Try Supabase project_settings
  if (!racks && isSupabaseConfigured) {
    try {
      const { data, error } = await supabase
        .from('project_settings')
        .select('id, network_defaults')
        .limit(1)
        .maybeSingle();

      if (!error && data?.network_defaults?.racks && Array.isArray(data.network_defaults.racks)) {
        racks = data.network_defaults.racks;
      }
    } catch (err) {
      console.warn('Supabase read racks warning:', err.message);
    }
  }

  // 3. Try mockProjectSettings
  if (!racks && mockProjectSettings.network_defaults?.racks) {
    racks = mockProjectSettings.network_defaults.racks;
  }

  // Fallback to initial defaults
  if (!Array.isArray(racks) || racks.length === 0) {
    racks = [...INITIAL_DEFAULT_RACKS];
  }

  // 4. Auto-discover any racks used in devices table!
  try {
    let deviceRacks = [];
    if (isSupabaseConfigured) {
      const { data: dbDevs } = await supabase
        .from('devices')
        .select('rack_name, zone, floor_plan_id, pos_x, pos_y');
      if (Array.isArray(dbDevs)) {
        deviceRacks = dbDevs;
      }
    } else {
      deviceRacks = mockDevices || [];
    }

    let hasNewFromDevices = false;
    deviceRacks.forEach((dev) => {
      const rName = dev.rack_name?.trim();
      if (!rName) return;
      const exists = racks.some(
        (r) =>
          r.name?.toLowerCase() === rName.toLowerCase() ||
          r.id?.toLowerCase() === rName.toLowerCase() ||
          (r.nameKu && r.nameKu.toLowerCase() === rName.toLowerCase())
      );

      if (!exists) {
        const cleanId = rName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || `rack_${Date.now()}`;
        racks.push({
          id: cleanId,
          name: rName,
          nameKu: rName,
          totalUnits: 42,
          zone: dev.zone || 'main_villa',
          location: dev.zone ? `Zone: ${dev.zone}` : 'Server Rack',
          isSystem: false,
          floor_plan_id: dev.floor_plan_id || null,
          pos_x: dev.pos_x || null,
          pos_y: dev.pos_y || null,
        });
        hasNewFromDevices = true;
      }
    });

    if (hasNewFromDevices) {
      await writeStoredRacks(racks);
    }
  } catch (err) {
    console.warn('Auto-discovery of device racks error:', err.message);
  }

  return racks;
}

// Helper: Save racks to File, Supabase, and Mock
async function writeStoredRacks(racks) {
  if (!Array.isArray(racks)) return;

  // 1. Write to local file
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(racks, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write racks.json:', err.message);
  }

  // 2. Write to mockProjectSettings
  if (!mockProjectSettings.network_defaults) {
    mockProjectSettings.network_defaults = {};
  }
  mockProjectSettings.network_defaults.racks = racks;

  // 3. Write to Supabase project_settings
  if (isSupabaseConfigured) {
    try {
      const { data: existing } = await supabase
        .from('project_settings')
        .select('id, network_defaults')
        .limit(1)
        .maybeSingle();

      if (existing) {
        const updatedDefaults = {
          ...(existing.network_defaults || {}),
          racks,
        };
        await supabase
          .from('project_settings')
          .update({ network_defaults: updatedDefaults })
          .eq('id', existing.id);
      }
    } catch (err) {
      console.warn('Supabase write racks warning:', err.message);
    }
  }
}

// GET all racks
router.get('/', async (req, res) => {
  try {
    const racks = await readStoredRacks();
    res.json(racks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST sync racks from client (e.g. laptop sends its created racks)
router.post('/sync', async (req, res) => {
  try {
    const { clientRacks } = req.body;
    let currentRacks = await readStoredRacks();

    if (Array.isArray(clientRacks) && clientRacks.length > 0) {
      clientRacks.forEach((cRack) => {
        if (!cRack || !cRack.name) return;
        const existingIdx = currentRacks.findIndex(
          (r) =>
            r.id === cRack.id ||
            r.name.toLowerCase() === cRack.name.toLowerCase() ||
            (r.nameKu && cRack.nameKu && r.nameKu.toLowerCase() === cRack.nameKu.toLowerCase())
        );

        if (existingIdx !== -1) {
          // Merge updates if client has more info
          currentRacks[existingIdx] = {
            ...currentRacks[existingIdx],
            ...cRack,
            // Keep coordinates if set on client
            pos_x: cRack.pos_x !== undefined ? cRack.pos_x : currentRacks[existingIdx].pos_x,
            pos_y: cRack.pos_y !== undefined ? cRack.pos_y : currentRacks[existingIdx].pos_y,
            floor_plan_id: cRack.floor_plan_id !== undefined ? cRack.floor_plan_id : currentRacks[existingIdx].floor_plan_id,
          };
        } else {
          currentRacks.push(cRack);
        }
      });

      await writeStoredRacks(currentRacks);
    }

    res.json({ success: true, racks: currentRacks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create a single rack
router.post('/', async (req, res) => {
  try {
    const { name, nameKu, totalUnits = 42, zone = 'main_villa', location = '', floor_plan_id = null, pos_x = null, pos_y = null } = req.body;
    const cleanName = (name || '').trim();
    const cleanKu = (nameKu || '').trim() || cleanName;

    if (!cleanName && !cleanKu) {
      return res.status(400).json({ error: 'Rack name is required' });
    }

    const currentRacks = await readStoredRacks();
    let baseId = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if (!baseId) baseId = `rack_${Date.now()}`;
    let id = baseId;
    let counter = 1;
    while (currentRacks.some((r) => r.id === id)) {
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
      floor_plan_id: floor_plan_id || null,
      pos_x: pos_x !== null && pos_x !== undefined ? Number(pos_x) : null,
      pos_y: pos_y !== null && pos_y !== undefined ? Number(pos_y) : null,
    };

    const updated = [...currentRacks, newRack];
    await writeStoredRacks(updated);
    res.status(201).json(newRack);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update a rack
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const currentRacks = await readStoredRacks();

    let updatedItem = null;
    const updated = currentRacks.map((r) => {
      if (r.id === id) {
        updatedItem = {
          ...r,
          name: updates.name !== undefined ? (updates.name.trim() || r.name) : r.name,
          nameKu: updates.nameKu !== undefined ? (updates.nameKu.trim() || r.nameKu || r.name) : r.nameKu,
          totalUnits: updates.totalUnits !== undefined ? Number(updates.totalUnits) || r.totalUnits : r.totalUnits,
          zone: updates.zone !== undefined ? updates.zone : r.zone,
          location: updates.location !== undefined ? updates.location.trim() : r.location,
          floor_plan_id: updates.floor_plan_id !== undefined ? updates.floor_plan_id : (r.floor_plan_id || null),
          pos_x: updates.pos_x !== undefined ? (updates.pos_x !== null ? Number(updates.pos_x) : null) : (r.pos_x ?? null),
          pos_y: updates.pos_y !== undefined ? (updates.pos_y !== null ? Number(updates.pos_y) : null) : (r.pos_y ?? null),
        };
        return updatedItem;
      }
      return r;
    });

    if (!updatedItem) {
      return res.status(404).json({ error: 'Rack not found' });
    }

    await writeStoredRacks(updated);
    res.json(updatedItem);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE a rack
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const currentRacks = await readStoredRacks();
    const updated = currentRacks.filter((r) => r.id !== id);
    await writeStoredRacks(updated);
    res.json({ success: true, message: 'Rack deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
