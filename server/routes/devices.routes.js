import express from 'express';
import { supabase, isSupabaseConfigured } from '../config/supabase.js';
import { mockDevices, mockBoqModels, mockFloorPlans, mockCategories } from '../services/mockData.js';
import { validateDeviceGuardrails, GuardrailError } from '../services/guardrail.service.js';

const router = express.Router();

// Helper to fetch BOQ model and floor plan for guardrail checks
async function getModelAndFloorPlan(boqModelId, floorPlanId) {
  if (isSupabaseConfigured) {
    const [{ data: model }, { data: fp }, { data: allDevs }] = await Promise.all([
      supabase.from('boq_models').select('*').eq('id', boqModelId).maybeSingle(),
      floorPlanId ? supabase.from('floor_plans').select('*').eq('id', floorPlanId).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from('devices').select('*'),
    ]);
    return { model, floorPlan: fp, allDevices: allDevs || [] };
  }

  return {
    model: mockBoqModels.find((m) => m.id === boqModelId),
    floorPlan: floorPlanId ? mockFloorPlans.find((fp) => fp.id === floorPlanId) : null,
    allDevices: mockDevices,
  };
}

// GET all devices (with optional filters)
router.get('/', async (req, res) => {
  try {
    const { status, floor_plan_id, zone, category_id, search, project_id } = req.query;
    const targetProject = project_id || 'proj-sitak';

    if (isSupabaseConfigured) {
      let query = supabase.from('devices').select('*, boq_models(*, categories(*)), floor_plans(*)').order('created_at', { ascending: false });
      if (status) query = query.eq('installation_status', status);
      if (floor_plan_id) query = query.eq('floor_plan_id', floor_plan_id);
      if (zone) query = query.eq('placement_zone', zone);
      
      const { data, error } = await query;
      if (!error && data) {
        let result = data.map((d) => ({
          ...d,
          boq_model: d.boq_models ? { ...d.boq_models, category: d.boq_models.categories } : null,
          floor_plan: d.floor_plans || null,
        }));

        if (category_id) {
          result = result.filter((d) => d.boq_model?.category_id === category_id);
        }
        if (search) {
          const s = search.toLowerCase();
          result = result.filter(
            (d) =>
              d.custom_label_id.toLowerCase().includes(s) ||
              (d.ip_address && d.ip_address.includes(s)) ||
              (d.mac_address && d.mac_address.toLowerCase().includes(s)) ||
              (d.serial_number && d.serial_number.toLowerCase().includes(s)) ||
              (d.switch_name && d.switch_name.toLowerCase().includes(s)) ||
              (d.boq_model && (d.boq_model.brand + ' ' + d.boq_model.model).toLowerCase().includes(s))
          );
        }

        return res.json(result);
      }
    }

    // In-memory filter - Strictly scoped to targetProject
    let result = mockDevices
      .filter((d) => (d.project_id || 'proj-sitak') === targetProject)
      .map((d) => {
        const model = mockBoqModels.find((m) => m.id === d.boq_model_id);
        const category = model ? mockCategories.find((c) => c.id === model.category_id) : null;
        const floorPlan = mockFloorPlans.find((fp) => fp.id === d.floor_plan_id);
        return {
          ...d,
          boq_model: model ? { ...model, category } : null,
          floor_plan: floorPlan || null,
        };
      });

    if (status) result = result.filter((d) => d.installation_status === status);
    if (floor_plan_id) result = result.filter((d) => d.floor_plan_id === floor_plan_id);
    if (zone) result = result.filter((d) => d.placement_zone === zone);
    if (category_id) result = result.filter((d) => d.boq_model?.category_id === category_id);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (d) =>
          d.custom_label_id.toLowerCase().includes(s) ||
          (d.ip_address && d.ip_address.includes(s)) ||
          (d.mac_address && d.mac_address.toLowerCase().includes(s)) ||
          (d.serial_number && d.serial_number.toLowerCase().includes(s)) ||
          (d.switch_name && d.switch_name.toLowerCase().includes(s)) ||
          (d.boq_model && (d.boq_model.brand + ' ' + d.boq_model.model).toLowerCase().includes(s))
      );
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single device by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (isSupabaseConfigured) {
      const { data: d, error } = await supabase
        .from('devices')
        .select('*, boq_models(*, categories(*)), floor_plans(*)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return res.json({
        ...d,
        boq_model: d.boq_models ? { ...d.boq_models, category: d.boq_models.categories } : null,
        floor_plan: d.floor_plans || null,
      });
    }

    const device = mockDevices.find((d) => d.id === id);
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const model = mockBoqModels.find((m) => m.id === device.boq_model_id);
    const category = model ? mockCategories.find((c) => c.id === model.category_id) : null;
    const floorPlan = mockFloorPlans.find((fp) => fp.id === device.floor_plan_id);

    res.json({
      ...device,
      boq_model: model ? { ...model, category } : null,
      floor_plan: floorPlan || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create individual device (with guardrail validation)
router.post('/', async (req, res) => {
  try {
    const deviceData = req.body;
    const { model, floorPlan, allDevices } = await getModelAndFloorPlan(deviceData.boq_model_id, deviceData.floor_plan_id);

    // Run Node.js Smart Placement Guardrails
    validateDeviceGuardrails(deviceData, model, floorPlan, allDevices);

    const payload = {
      project_id: deviceData.project_id || 'proj-sitak',
      boq_model_id: deviceData.boq_model_id,
      custom_label_id: deviceData.custom_label_id || `DEV-${Math.floor(100 + Math.random() * 900)}`,
      serial_number: deviceData.serial_number || `SN-${Date.now().toString().slice(-6)}`,
      mac_address: deviceData.mac_address || null,
      ip_address: deviceData.ip_address || null,
      subnet_mask: deviceData.subnet_mask || '255.255.255.0',
      gateway: deviceData.gateway || '192.168.10.1',
      vlan_id: Number(deviceData.vlan_id) || 10,
      switch_name: deviceData.switch_name || null,
      switch_port: deviceData.switch_port || null,
      rack_name: deviceData.rack_name || null,
      rack_unit: deviceData.rack_unit || null,
      placement_zone: deviceData.placement_zone || (model?.is_rack_mounted ? 'rack' : 'indoor'),
      floor_plan_id: deviceData.floor_plan_id || null,
      pos_x: deviceData.pos_x ?? null,
      pos_y: deviceData.pos_y ?? null,
      installation_status: deviceData.installation_status || 'Pending',
      config_backup_url: deviceData.config_backup_url || null,
      notes: deviceData.notes || '',
    };

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('devices').insert([payload]).select('*, boq_models(*, categories(*)), floor_plans(*)').single();
      if (error) {
        if (error.message.includes('Guardrail Error') || error.message.includes('IP Conflict') || error.message.includes('Port Conflict')) {
          return res.status(422).json({
            guardrail_violation: true,
            code: 'PG_TRIGGER_GUARDRAIL',
            message_en: error.message,
            message_ku: error.message,
          });
        }
        throw error;
      }
      return res.status(201).json({
        ...data,
        boq_model: data.boq_models ? { ...data.boq_models, category: data.boq_models.categories } : null,
        floor_plan: data.floor_plans || null,
      });
    }

    const newDevice = {
      ...payload,
      id: `dev-${Date.now()}`,
      created_at: new Date().toISOString(),
    };

    mockDevices.push(newDevice);
    res.status(201).json(newDevice);
  } catch (err) {
    if (err instanceof GuardrailError) {
      return res.status(422).json({
        guardrail_violation: true,
        code: err.code,
        message_en: err.message_en,
        message_ku: err.message_ku,
        details: err.details,
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT update individual device (with guardrail validation)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { model, floorPlan, allDevices } = await getModelAndFloorPlan(updates.boq_model_id, updates.floor_plan_id);
    validateDeviceGuardrails({ ...updates, id }, model, floorPlan, allDevices);

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('devices')
        .update({
          boq_model_id: updates.boq_model_id,
          custom_label_id: updates.custom_label_id,
          serial_number: updates.serial_number,
          mac_address: updates.mac_address,
          ip_address: updates.ip_address || null,
          subnet_mask: updates.subnet_mask,
          gateway: updates.gateway,
          vlan_id: Number(updates.vlan_id) || 10,
          switch_name: updates.switch_name,
          switch_port: updates.switch_port,
          rack_name: updates.rack_name,
          rack_unit: updates.rack_unit,
          placement_zone: updates.placement_zone,
          floor_plan_id: updates.floor_plan_id || null,
          pos_x: updates.pos_x ?? null,
          pos_y: updates.pos_y ?? null,
          installation_status: updates.installation_status,
          config_backup_url: updates.config_backup_url,
          notes: updates.notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*, boq_models(*, categories(*)), floor_plans(*)')
        .single();

      if (error) {
        if (error.message.includes('Guardrail Error') || error.message.includes('IP Conflict') || error.message.includes('Port Conflict')) {
          return res.status(422).json({
            guardrail_violation: true,
            code: 'PG_TRIGGER_GUARDRAIL',
            message_en: error.message,
            message_ku: error.message,
          });
        }
        throw error;
      }
      return res.json({
        ...data,
        boq_model: data.boq_models ? { ...data.boq_models, category: data.boq_models.categories } : null,
        floor_plan: data.floor_plans || null,
      });
    }

    const idx = mockDevices.findIndex((d) => d.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Device not found' });

    mockDevices[idx] = { ...mockDevices[idx], ...updates, updated_at: new Date().toISOString() };
    res.json(mockDevices[idx]);
  } catch (err) {
    if (err instanceof GuardrailError) {
      return res.status(422).json({
        guardrail_violation: true,
        code: err.code,
        message_en: err.message_en,
        message_ku: err.message_ku,
        details: err.details,
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// PATCH update status (Pending -> Installed -> Configured -> Verified)
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const validStatuses = ['Pending', 'Installed', 'Configured', 'Verified'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid status. Choose from: ${validStatuses.join(', ')}` });
    }

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('devices')
        .update({ installation_status: status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return res.json({ success: true, device: data });
    }

    const device = mockDevices.find((d) => d.id === id);
    if (!device) return res.status(404).json({ error: 'Device not found' });

    device.installation_status = status;
    device.updated_at = new Date().toISOString();
    res.json({ success: true, device });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH pin or reposition device on floor plan
router.patch('/:id/position', async (req, res) => {
  try {
    const { id } = req.params;
    const { floor_plan_id, pos_x, pos_y } = req.body;

    let device, model, targetFloorPlan, allDevices;

    if (isSupabaseConfigured) {
      const [{ data: d }, { data: fp }, { data: allDevs }] = await Promise.all([
        supabase.from('devices').select('*, boq_models(*)').eq('id', id).single(),
        floor_plan_id ? supabase.from('floor_plans').select('*').eq('id', floor_plan_id).single() : Promise.resolve({ data: null }),
        supabase.from('devices').select('*'),
      ]);
      device = d;
      model = d?.boq_models;
      targetFloorPlan = fp;
      allDevices = allDevs || [];
    } else {
      device = mockDevices.find((d) => d.id === id);
      if (!device) return res.status(404).json({ error: 'Device not found' });
      model = mockBoqModels.find((m) => m.id === device.boq_model_id);
      targetFloorPlan = floor_plan_id ? mockFloorPlans.find((fp) => fp.id === floor_plan_id) : null;
      allDevices = mockDevices;
    }

    const candidate = {
      ...device,
      floor_plan_id,
      pos_x,
      pos_y,
      placement_zone: targetFloorPlan ? targetFloorPlan.zone_type : device.placement_zone,
    };

    validateDeviceGuardrails(candidate, model, targetFloorPlan, allDevices);

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('devices')
        .update({
          floor_plan_id,
          pos_x,
          pos_y,
          placement_zone: targetFloorPlan ? targetFloorPlan.zone_type : device.placement_zone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (error.message.includes('Guardrail Error') || error.message.includes('Zone mismatch')) {
          return res.status(422).json({
            guardrail_violation: true,
            code: 'PG_ZONE_GUARDRAIL',
            message_en: error.message,
            message_ku: error.message,
          });
        }
        throw error;
      }
      return res.json({ success: true, device: data });
    }

    device.floor_plan_id = floor_plan_id;
    device.pos_x = pos_x;
    device.pos_y = pos_y;
    if (targetFloorPlan) {
      device.placement_zone = targetFloorPlan.zone_type;
    }
    device.updated_at = new Date().toISOString();

    res.json({ success: true, device });
  } catch (err) {
    if (err instanceof GuardrailError) {
      return res.status(422).json({
        guardrail_violation: true,
        code: err.code,
        message_en: err.message_en,
        message_ku: err.message_ku,
        details: err.details,
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// DELETE device
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (isSupabaseConfigured) {
      const { error } = await supabase.from('devices').delete().eq('id', id);
      if (error) throw error;
      return res.json({ success: true, message: 'Device removed' });
    }

    const idx = mockDevices.findIndex((d) => d.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Device not found' });

    mockDevices.splice(idx, 1);
    res.json({ success: true, message: 'Device removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
