import express from 'express';
import { supabase, isSupabaseConfigured } from '../config/supabase.js';
import { mockBoqModels, mockDevices, mockCategories } from '../services/mockData.js';

const router = express.Router();

// GET all BOQ models with provisioned counts
router.get('/', async (req, res) => {
  try {
    if (isSupabaseConfigured) {
      const { data: models, error } = await supabase
        .from('boq_models')
        .select('*, categories(*)');
      if (error) throw error;

      const { data: devices } = await supabase.from('devices').select('id, boq_model_id');
      const enhanced = models.map((m) => ({
        ...m,
        provisioned_count: (devices || []).filter((d) => d.boq_model_id === m.id).length,
      }));
      return res.json(enhanced);
    }

    // In-memory fallback
    const enriched = mockBoqModels.map((m) => {
      const cat = mockCategories.find((c) => c.id === m.category_id);
      const provCount = mockDevices.filter((d) => d.boq_model_id === m.id).length;
      return {
        ...m,
        category: cat,
        provisioned_count: provCount,
      };
    });
    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create new BOQ model
router.post('/', async (req, res) => {
  try {
    const {
      category_id,
      brand,
      model,
      description,
      total_qty = 1,
      unit_cost = 0,
      product_image_url,
      manual_pdf_url,
      allowed_zones = ['indoor'],
      is_rack_mounted = false,
      rack_unit_size = 0,
      custom_specs = {},
    } = req.body;

    if (!brand || !model || !category_id) {
      return res.status(400).json({ error: 'Brand, Model, and Category are required.' });
    }

    const payload = {
      category_id,
      brand,
      model,
      description: description || '',
      total_qty: Number(total_qty) || 1,
      unit_cost: Number(unit_cost) || 0,
      product_image_url: product_image_url || 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600',
      manual_pdf_url: manual_pdf_url || null,
      allowed_zones: Array.isArray(allowed_zones) ? allowed_zones : ['indoor'],
      is_rack_mounted: Boolean(is_rack_mounted),
      rack_unit_size: Number(rack_unit_size) || 0,
      custom_specs: custom_specs || {},
    };

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('boq_models').insert([payload]).select('*, categories(*)').single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    const newModel = {
      ...payload,
      id: `boq-${Date.now()}`,
      created_at: new Date().toISOString(),
    };

    mockBoqModels.push(newModel);
    res.status(201).json(newModel);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update BOQ model
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('boq_models').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return res.json(data);
    }

    const idx = mockBoqModels.findIndex((m) => m.id === id);
    if (idx === -1) return res.status(404).json({ error: 'BOQ Model not found' });

    mockBoqModels[idx] = { ...mockBoqModels[idx], ...updates, updated_at: new Date().toISOString() };
    res.json(mockBoqModels[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE BOQ model
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('boq_models').delete().eq('id', id);
      if (error) throw error;
      return res.json({ success: true, message: 'BOQ Model removed' });
    }

    const idx = mockBoqModels.findIndex((m) => m.id === id);
    if (idx === -1) return res.status(404).json({ error: 'BOQ Model not found' });

    mockBoqModels.splice(idx, 1);
    res.json({ success: true, message: 'BOQ Model removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST Auto-provision / Bulk Generate Individual Devices from BOQ model
router.post('/:id/provision', async (req, res) => {
  try {
    const { id } = req.params;
    const { count = 1, prefix = 'DEV', starting_index = 1, vlan_id = 10, target_zone = 'indoor' } = req.body;

    let model;
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('boq_models').select('*').eq('id', id).single();
      if (error || !data) return res.status(404).json({ error: 'BOQ Model not found' });
      model = data;
    } else {
      model = mockBoqModels.find((m) => m.id === id);
      if (!model) return res.status(404).json({ error: 'BOQ Model not found' });
    }

    const newDevices = [];
    const generatedCount = Math.min(Number(count) || 1, 50); // limit batch to 50

    for (let i = 0; i < generatedCount; i++) {
      const indexNum = Number(starting_index) + i;
      const indexStr = indexNum < 10 ? `0${indexNum}` : `${indexNum}`;
      const label = `${prefix}-${indexStr}`;
      
      const randomMac = Array.from({ length: 6 }, () =>
        Math.floor(Math.random() * 256).toString(16).padStart(2, '0').toUpperCase()
      ).join(':');

      const devObj = {
        boq_model_id: model.id,
        custom_label_id: label,
        serial_number: `${model.brand.substring(0, 2).toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`,
        mac_address: randomMac,
        ip_address: null,
        subnet_mask: '255.255.255.0',
        gateway: '192.168.10.1',
        vlan_id: Number(vlan_id) || 10,
        switch_name: null,
        switch_port: null,
        rack_name: model.is_rack_mounted ? 'Main 42U Rack A' : null,
        rack_unit: model.is_rack_mounted ? `U${Math.min(42, 20 + i)}` : null,
        placement_zone: model.is_rack_mounted ? 'rack' : target_zone || model.allowed_zones?.[0] || 'indoor',
        floor_plan_id: null,
        pos_x: null,
        pos_y: null,
        installation_status: 'Pending',
        config_backup_url: null,
        notes: `Bulk provisioned from BOQ Model ${model.brand} ${model.model}`,
      };

      if (!isSupabaseConfigured) {
        devObj.id = `dev-${Date.now()}-${i}`;
        devObj.created_at = new Date().toISOString();
        mockDevices.push(devObj);
      }
      newDevices.push(devObj);
    }

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('devices').insert(newDevices).select('*, boq_models(*, categories(*)), floor_plans(*)');
      if (error) throw error;
      return res.status(201).json({
        success: true,
        provisioned_count: data.length,
        devices: data,
      });
    }

    res.status(201).json({
      success: true,
      provisioned_count: newDevices.length,
      devices: newDevices,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

