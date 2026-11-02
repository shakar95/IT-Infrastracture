import express from 'express';
import { supabase, isSupabaseConfigured } from '../config/supabase.js';
import { mockFloorPlans, mockDevices, mockBoqModels, mockCategories } from '../services/mockData.js';

const router = express.Router();

// GET all floor plans
router.get('/', async (req, res) => {
  try {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('floor_plans').select('*').order('floor_level');
      if (error) throw error;
      return res.json(data);
    }
    res.json(mockFloorPlans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET floor plan by ID with all placed devices
router.get('/:id/devices', async (req, res) => {
  try {
    const { id } = req.params;

    if (isSupabaseConfigured) {
      const [{ data: plan, error: pErr }, { data: devs, error: dErr }] = await Promise.all([
        supabase.from('floor_plans').select('*').eq('id', id).single(),
        supabase.from('devices').select('*, boq_models(*, categories(*))').eq('floor_plan_id', id).not('pos_x', 'is', null),
      ]);
      if (pErr) return res.status(404).json({ error: 'Floor plan not found' });
      if (dErr) throw dErr;

      return res.json({
        floor_plan: plan,
        devices: (devs || []).map((d) => ({
          ...d,
          boq_model: d.boq_models ? { ...d.boq_models, category: d.boq_models.categories } : null,
        })),
      });
    }

    const plan = mockFloorPlans.find((fp) => fp.id === id);
    if (!plan) return res.status(404).json({ error: 'Floor plan not found' });

    const pinnedDevices = mockDevices
      .filter((d) => d.floor_plan_id === id && d.pos_x !== null && d.pos_y !== null)
      .map((d) => {
        const model = mockBoqModels.find((m) => m.id === d.boq_model_id);
        const category = model ? mockCategories.find((c) => c.id === model.category_id) : null;
        return {
          ...d,
          boq_model: model ? { ...model, category } : null,
        };
      });

    res.json({
      floor_plan: plan,
      devices: pinnedDevices,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add new floor plan
router.post('/', async (req, res) => {
  try {
    const { name, name_ku, zone_type = 'indoor', floor_level = 0, image_url, scale_meters_per_pixel = 0.05 } = req.body;

    if (!name || !image_url) {
      return res.status(400).json({ error: 'Floor plan name and image URL are required.' });
    }

    const newPlan = {
      id: `fp-${Date.now()}`,
      name,
      name_ku: name_ku || name,
      zone_type,
      floor_level: Number(floor_level) || 0,
      image_url,
      scale_meters_per_pixel: Number(scale_meters_per_pixel) || 0.05,
      created_at: new Date().toISOString(),
    };

    mockFloorPlans.push(newPlan);
    res.status(201).json(newPlan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

