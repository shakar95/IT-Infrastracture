import express from 'express';
import { supabase, isSupabaseConfigured } from '../config/supabase.js';
import { mockDevices, mockBoqModels, mockFloorPlans, mockCategories } from '../services/mockData.js';
import { validateDeviceGuardrails, GuardrailError } from '../services/guardrail.service.js';

const router = express.Router();

// Helper to format device response cleanly for clients
export function formatDeviceOutput(d) {
  if (!d) return d;
  const isUnlabeled = !d.custom_label_id || d.custom_label_id.startsWith('UNLABELED-');
  const customFieldVals = (typeof d.custom_field_values === 'object' && d.custom_field_values) ? d.custom_field_values : {};

  // Strict Connection Type Resolution:
  let connType = d.connection_type || customFieldVals.connection_type;
  if (!connType) {
    if (d.patch_panel_name || customFieldVals.patch_panel_name || d.switch_name?.startsWith('PP:')) {
      connType = 'patch_panel';
    } else if (d.connected_socket_id || customFieldVals.connected_socket_id || d.switch_name?.startsWith('Socket:')) {
      connType = 'socket';
    } else {
      connType = 'switch';
    }
  }

  const isSocket = connType === 'socket';
  const isPatchPanel = connType === 'patch_panel';
  const isSwitch = connType === 'switch';

  const patchPanelName = isPatchPanel
    ? (d.patch_panel_name !== undefined && d.patch_panel_name !== null
        ? d.patch_panel_name
        : (customFieldVals.patch_panel_name !== undefined && customFieldVals.patch_panel_name !== null
            ? customFieldVals.patch_panel_name
            : (d.switch_name?.startsWith('PP:') ? d.switch_name.replace('PP:', '').trim() : null)))
    : null;

  const patchPanelPort = isPatchPanel
    ? (d.patch_panel_port !== undefined && d.patch_panel_port !== null
        ? d.patch_panel_port
        : (customFieldVals.patch_panel_port !== undefined && customFieldVals.patch_panel_port !== null
            ? customFieldVals.patch_panel_port
            : null))
    : null;

  const connectedSocketId = isSocket ? (d.connected_socket_id || customFieldVals.connected_socket_id || null) : null;
  const connectedSocketLabel = isSocket ? (d.connected_socket_label || customFieldVals.connected_socket_label || null) : null;
  const connectedSocketModelId = isSocket ? (d.connected_socket_model_id || customFieldVals.connected_socket_model_id || null) : null;

  const switchName = isSocket
    ? (connectedSocketLabel ? `Socket: ${connectedSocketLabel}` : 'Socket')
    : isPatchPanel
    ? (patchPanelName ? `PP: ${patchPanelName}` : 'Patch Panel')
    : (d.switch_name || null);

  const switchPort = isSwitch ? (d.switch_port || null) : (isPatchPanel ? patchPanelPort : null);

  return {
    ...d,
    custom_label_id: isUnlabeled ? '' : d.custom_label_id,
    connection_type: connType,
    connected_socket_id: connectedSocketId,
    connected_socket_label: connectedSocketLabel,
    connected_socket_model_id: connectedSocketModelId,
    patch_panel_name: patchPanelName,
    patch_panel_port: patchPanelPort,
    switch_name: switchName,
    switch_port: switchPort,
    rack_name: d.placement_zone === 'rack' ? (d.rack_name || null) : null,
    rack_unit: d.placement_zone === 'rack' ? (d.rack_unit || null) : null,
    boq_model: d.boq_models ? { ...d.boq_models, category: d.boq_models.categories } : (d.boq_model || null),
    floor_plan: d.floor_plans || d.floor_plan || null,
  };
}

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
      let query = supabase
        .from('devices')
        .select('*, boq_models!devices_boq_model_id_fkey(*, categories(*)), floor_plans(*)')
        .order('created_at', { ascending: false });
      if (status) query = query.eq('installation_status', status);
      if (floor_plan_id) query = query.eq('floor_plan_id', floor_plan_id);
      if (zone) query = query.eq('placement_zone', zone);
      
      let { data, error } = await query;

      // Resilient fallback: if the explicit foreign key join fails, fetch devices and join in-memory
      if (error) {
        console.warn('Supabase embedded devices query failed, attempting decoupled join:', error.message);
        try {
          let fallbackDevQuery = supabase.from('devices').select('*').order('created_at', { ascending: false });
          if (status) fallbackDevQuery = fallbackDevQuery.eq('installation_status', status);
          if (floor_plan_id) fallbackDevQuery = fallbackDevQuery.eq('floor_plan_id', floor_plan_id);
          if (zone) fallbackDevQuery = fallbackDevQuery.eq('placement_zone', zone);

          const [devsRes, modelsRes, fpsRes] = await Promise.all([
            fallbackDevQuery,
            supabase.from('boq_models').select('*, categories(*)'),
            supabase.from('floor_plans').select('*'),
          ]);

          if (!devsRes.error && devsRes.data) {
            const modelMap = new Map((modelsRes.data || []).map((m) => [m.id, m]));
            const fpMap = new Map((fpsRes.data || []).map((fp) => [fp.id, fp]));
            data = devsRes.data.map((d) => ({
              ...d,
              boq_models: modelMap.get(d.boq_model_id) || null,
              floor_plans: fpMap.get(d.floor_plan_id) || null,
            }));
            error = null;
          }
        } catch (fallbackErr) {
          console.error('Decoupled fallback also failed:', fallbackErr.message);
        }
      }

      if (!error && data) {
        let result = data.map((d) => formatDeviceOutput(d));

        if (project_id) {
          result = result.filter((d) => {
            if (project_id === '0f7f7c37-7097-4094-b146-c1b6b0b36dda' || project_id === 'proj-sitak') {
              return !d.project_id || d.project_id === 'proj-sitak' || d.project_id === '0f7f7c37-7097-4094-b146-c1b6b0b36dda';
            }
            return d.project_id === project_id;
          });
        }

        if (category_id) {
          result = result.filter((d) => d.boq_model?.category_id === category_id);
        }
        if (search) {
          const s = search.toLowerCase();
          result = result.filter(
            (d) =>
              (d.custom_label_id && d.custom_label_id.toLowerCase().includes(s)) ||
              (d.ip_address && d.ip_address.includes(s)) ||
              (d.mac_address && d.mac_address.toLowerCase().includes(s)) ||
              (d.serial_number && d.serial_number.toLowerCase().includes(s)) ||
              (d.switch_name && d.switch_name.toLowerCase().includes(s)) ||
              (d.patch_panel_name && d.patch_panel_name.toLowerCase().includes(s)) ||
              (d.connected_socket_label && d.connected_socket_label.toLowerCase().includes(s)) ||
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
        return formatDeviceOutput({
          ...d,
          boq_models: model ? { ...model, categories: category } : null,
          floor_plans: floorPlan || null,
        });
      });

    if (status) result = result.filter((d) => d.installation_status === status);
    if (floor_plan_id) result = result.filter((d) => d.floor_plan_id === floor_plan_id);
    if (zone) result = result.filter((d) => d.placement_zone === zone);
    if (category_id) result = result.filter((d) => d.boq_model?.category_id === category_id);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (d) =>
          (d.custom_label_id && d.custom_label_id.toLowerCase().includes(s)) ||
          (d.ip_address && d.ip_address.includes(s)) ||
          (d.mac_address && d.mac_address.toLowerCase().includes(s)) ||
          (d.serial_number && d.serial_number.toLowerCase().includes(s)) ||
          (d.switch_name && d.switch_name.toLowerCase().includes(s)) ||
          (d.patch_panel_name && d.patch_panel_name.toLowerCase().includes(s)) ||
          (d.connected_socket_label && d.connected_socket_label.toLowerCase().includes(s)) ||
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
      let { data: d, error } = await supabase
        .from('devices')
        .select('*, boq_models!devices_boq_model_id_fkey(*, categories(*)), floor_plans(*)')
        .eq('id', id)
        .maybeSingle();

      if (error || !d) {
        // Fallback: decoupled fetch
        const { data: rawDev } = await supabase.from('devices').select('*').eq('id', id).maybeSingle();
        if (rawDev) {
          const [{ data: model }, { data: fp }] = await Promise.all([
            supabase.from('boq_models').select('*, categories(*)').eq('id', rawDev.boq_model_id).maybeSingle(),
            rawDev.floor_plan_id ? supabase.from('floor_plans').select('*').eq('id', rawDev.floor_plan_id).maybeSingle() : Promise.resolve({ data: null }),
          ]);
          return res.json(formatDeviceOutput({ ...rawDev, boq_models: model, floor_plans: fp }));
        }
      }

      if (error) throw error;
      if (!d) return res.status(404).json({ error: 'Device not found' });
      return res.json(formatDeviceOutput(d));
    }

    const device = mockDevices.find((d) => d.id === id);
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const model = mockBoqModels.find((m) => m.id === device.boq_model_id);
    const category = model ? mockCategories.find((c) => c.id === model.category_id) : null;
    const floorPlan = mockFloorPlans.find((fp) => fp.id === device.floor_plan_id);

    res.json(formatDeviceOutput({
      ...device,
      boq_models: model ? { ...model, categories: category } : null,
      floor_plans: floorPlan || null,
    }));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create individual device
router.post('/', async (req, res) => {
  try {
    const deviceData = req.body;
    const { model } = await getModelAndFloorPlan(deviceData.boq_model_id, deviceData.floor_plan_id);

    // Keep custom_label_id blank if left empty by the user - do not auto-generate fake labels!
    const rawLabel = (deviceData.custom_label_id || '').trim();
    const finalLabel = rawLabel || null;

    const connection_type = deviceData.connection_type || 'switch';
    const connected_socket_id = deviceData.connected_socket_id || null;
    const connected_socket_label = deviceData.connected_socket_label || null;
    const connected_socket_model_id = deviceData.connected_socket_model_id || null;
    const patch_panel_name = deviceData.patch_panel_name || null;
    const patch_panel_port = deviceData.patch_panel_port || null;

    let derivedSwitchName = deviceData.switch_name || null;
    let derivedSwitchPort = deviceData.switch_port || null;
    if (connection_type === 'socket') {
      derivedSwitchName = deviceData.switch_name || (connected_socket_label ? `Socket: ${connected_socket_label}` : 'Socket');
    } else if (connection_type === 'patch_panel') {
      derivedSwitchName = deviceData.switch_name || (patch_panel_name ? `PP: ${patch_panel_name}` : 'Patch Panel');
      derivedSwitchPort = deviceData.switch_port || patch_panel_port || null;
    }

    const custom_field_values = {
      ...(typeof deviceData.custom_field_values === 'object' && deviceData.custom_field_values ? deviceData.custom_field_values : {}),
      connection_type,
      connected_socket_id,
      connected_socket_label,
      connected_socket_model_id,
      patch_panel_name,
      patch_panel_port,
    };

    const payload = {
      project_id: deviceData.project_id || 'proj-sitak',
      boq_model_id: deviceData.boq_model_id,
      custom_label_id: finalLabel,
      serial_number: (deviceData.serial_number || '').trim() || null,
      mac_address: (deviceData.mac_address || '').trim() || null,
      ip_address: (deviceData.ip_address || '').trim() || null,
      subnet_mask: deviceData.subnet_mask || '255.255.255.0',
      gateway: deviceData.gateway || '192.168.10.1',
      vlan_id: Number(deviceData.vlan_id) || 10,
      switch_name: derivedSwitchName,
      switch_port: derivedSwitchPort,
      rack_name: deviceData.rack_name || null,
      rack_unit: deviceData.rack_unit || null,
      zone: deviceData.zone || null,
      placement_zone: deviceData.placement_zone || (model?.is_rack_mounted ? 'rack' : 'indoor'),
      floor_plan_id: deviceData.floor_plan_id || null,
      pos_x: deviceData.pos_x ?? null,
      pos_y: deviceData.pos_y ?? null,
      installation_status: deviceData.installation_status || 'Pending',
      config_backup_url: deviceData.config_backup_url || null,
      notes: deviceData.notes || '',
      custom_field_values,
      connection_type,
      connected_socket_id,
      connected_socket_label,
      connected_socket_model_id,
      patch_panel_name,
      patch_panel_port,
    };

    if (isSupabaseConfigured) {
      let currentPayload = { ...payload };
      let { data, error } = await supabase
        .from('devices')
        .insert([currentPayload])
        .select('*, boq_models!devices_boq_model_id_fkey(*, categories(*)), floor_plans(*)')
        .single();

      // Graceful fallback 1: If new connection columns don't exist in Supabase schema cache yet
      if (error && (error.code === 'PGRST204' || error.message?.includes('connection_type') || error.message?.includes('patch_panel') || error.message?.includes('connected_socket'))) {
        delete currentPayload.connection_type;
        delete currentPayload.connected_socket_id;
        delete currentPayload.connected_socket_label;
        delete currentPayload.connected_socket_model_id;
        delete currentPayload.patch_panel_name;
        delete currentPayload.patch_panel_port;
        const retryRes = await supabase.from('devices').insert([currentPayload]).select('*, boq_models!devices_boq_model_id_fkey(*, categories(*)), floor_plans(*)').single();
        data = retryRes.data;
        error = retryRes.error;
      }

      // Graceful fallback 2: If project_id or zone column is missing
      if (error && (error.message?.includes('project_id') || error.message?.includes('zone') || error.code === 'PGRST204')) {
        delete currentPayload.project_id;
        delete currentPayload.zone;
        const retryResult = await supabase.from('devices').insert([currentPayload]).select('*, boq_models!devices_boq_model_id_fkey(*, categories(*)), floor_plans(*)').single();
        data = retryResult.data;
        error = retryResult.error;
      }

      // Graceful fallback 3: If custom_label_id has NOT NULL or UNIQUE constraint before migration is executed
      if (error && (error.code === '23502' || error.code === '23505') && !finalLabel) {
        currentPayload.custom_label_id = `UNLABELED-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const retryResult = await supabase.from('devices').insert([currentPayload]).select('*, boq_models!devices_boq_model_id_fkey(*, categories(*)), floor_plans(*)').single();
        data = retryResult.data;
        error = retryResult.error;
      }

      if (error) throw error;
      return res.status(201).json(formatDeviceOutput(data));
    }

    const newDevice = {
      ...payload,
      id: `dev-${Date.now()}`,
      created_at: new Date().toISOString(),
    };

    mockDevices.push(newDevice);
    res.status(201).json(formatDeviceOutput(newDevice));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update individual device
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const rawLabel = updates.custom_label_id !== undefined ? (updates.custom_label_id || '').trim() : undefined;
    const finalLabel = rawLabel !== undefined ? (rawLabel || null) : undefined;

    const connection_type = updates.connection_type;
    const connected_socket_id = updates.connected_socket_id;
    const connected_socket_label = updates.connected_socket_label;
    const connected_socket_model_id = updates.connected_socket_model_id;
    const patch_panel_name = updates.patch_panel_name;
    const patch_panel_port = updates.patch_panel_port;

    let derivedSwitchName = updates.switch_name;
    let derivedSwitchPort = updates.switch_port;
    if (connection_type === 'socket') {
      derivedSwitchName = connected_socket_label ? `Socket: ${connected_socket_label}` : 'Socket';
      derivedSwitchPort = null;
    } else if (connection_type === 'patch_panel') {
      derivedSwitchName = patch_panel_name ? `PP: ${patch_panel_name}` : 'Patch Panel';
      derivedSwitchPort = patch_panel_port || null;
    } else {
      derivedSwitchName = updates.switch_name || null;
      derivedSwitchPort = updates.switch_port || null;
    }

    const custom_field_values = {
      ...(typeof updates.custom_field_values === 'object' && updates.custom_field_values ? updates.custom_field_values : {}),
      connection_type,
      connected_socket_id: connection_type === 'socket' ? (connected_socket_id || null) : null,
      connected_socket_label: connection_type === 'socket' ? (connected_socket_label || null) : null,
      connected_socket_model_id: connection_type === 'socket' ? (connected_socket_model_id || null) : null,
      patch_panel_name: connection_type === 'patch_panel' ? (patch_panel_name || null) : null,
      patch_panel_port: connection_type === 'patch_panel' ? (patch_panel_port || null) : null,
    };

    if (isSupabaseConfigured) {
      const deviceUpdatePayload = {
        boq_model_id: updates.boq_model_id,
        custom_label_id: finalLabel,
        serial_number: updates.serial_number !== undefined ? ((updates.serial_number || '').trim() || null) : undefined,
        mac_address: updates.mac_address !== undefined ? ((updates.mac_address || '').trim() || null) : undefined,
        ip_address: updates.ip_address !== undefined ? ((updates.ip_address || '').trim() || null) : undefined,
        subnet_mask: updates.subnet_mask,
        gateway: updates.gateway,
        vlan_id: updates.vlan_id !== undefined ? (Number(updates.vlan_id) || 10) : undefined,
        switch_name: derivedSwitchName,
        switch_port: derivedSwitchPort,
        rack_name: updates.placement_zone && updates.placement_zone !== 'rack' ? null : updates.rack_name,
        rack_unit: updates.placement_zone && updates.placement_zone !== 'rack' ? null : updates.rack_unit,
        zone: updates.zone !== undefined ? (updates.zone || null) : undefined,
        placement_zone: updates.placement_zone,
        floor_plan_id: updates.floor_plan_id !== undefined ? (updates.floor_plan_id || null) : undefined,
        pos_x: updates.pos_x ?? null,
        pos_y: updates.pos_y ?? null,
        installation_status: updates.installation_status,
        config_backup_url: updates.config_backup_url,
        notes: updates.notes,
        custom_field_values,
        connection_type,
        connected_socket_id: connection_type === 'socket' ? (connected_socket_id || null) : null,
        connected_socket_label: connection_type === 'socket' ? (connected_socket_label || null) : null,
        connected_socket_model_id: connection_type === 'socket' ? (connected_socket_model_id || null) : null,
        patch_panel_name: connection_type === 'patch_panel' ? (patch_panel_name || null) : null,
        patch_panel_port: connection_type === 'patch_panel' ? (patch_panel_port || null) : null,
        updated_at: new Date().toISOString(),
      };

      // Remove undefined keys
      Object.keys(deviceUpdatePayload).forEach((k) => deviceUpdatePayload[k] === undefined && delete deviceUpdatePayload[k]);

      let { data, error } = await supabase
        .from('devices')
        .update(deviceUpdatePayload)
        .eq('id', id)
        .select('*, boq_models!devices_boq_model_id_fkey(*, categories(*)), floor_plans(*)')
        .single();

      // Graceful fallback 1: If new connection columns don't exist in Supabase schema cache yet
      if (error && (error.code === 'PGRST204' || error.message?.includes('connection_type') || error.message?.includes('patch_panel') || error.message?.includes('connected_socket'))) {
        delete deviceUpdatePayload.connection_type;
        delete deviceUpdatePayload.connected_socket_id;
        delete deviceUpdatePayload.connected_socket_label;
        delete deviceUpdatePayload.connected_socket_model_id;
        delete deviceUpdatePayload.patch_panel_name;
        delete deviceUpdatePayload.patch_panel_port;
        const retryRes = await supabase.from('devices').update(deviceUpdatePayload).eq('id', id).select('*, boq_models!devices_boq_model_id_fkey(*, categories(*)), floor_plans(*)').single();
        data = retryRes.data;
        error = retryRes.error;
      }

      // Graceful fallback 2: If zone column is missing
      if (error && (error.message?.includes('zone') || error.code === 'PGRST204')) {
        delete deviceUpdatePayload.zone;
        const retryResult = await supabase
          .from('devices')
          .update(deviceUpdatePayload)
          .eq('id', id)
          .select('*, boq_models!devices_boq_model_id_fkey(*, categories(*)), floor_plans(*)')
          .single();
        data = retryResult.data;
        error = retryResult.error;
      }

      // Graceful fallback 3: If custom_label_id has NOT NULL or UNIQUE constraint before migration is executed
      if (error && (error.code === '23502' || error.code === '23505') && finalLabel === null) {
        deviceUpdatePayload.custom_label_id = `UNLABELED-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const retryResult = await supabase
          .from('devices')
          .update(deviceUpdatePayload)
          .eq('id', id)
          .select('*, boq_models!devices_boq_model_id_fkey(*, categories(*)), floor_plans(*)')
          .single();
        data = retryResult.data;
        error = retryResult.error;
      }

      if (error) throw error;
      return res.json(formatDeviceOutput(data));
    }

    const idx = mockDevices.findIndex((d) => d.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Device not found' });

    mockDevices[idx] = {
      ...mockDevices[idx],
      ...updates,
      custom_field_values,
      switch_name: derivedSwitchName,
      switch_port: derivedSwitchPort,
      rack_name: updates.placement_zone && updates.placement_zone !== 'rack' ? null : (updates.rack_name !== undefined ? updates.rack_name : mockDevices[idx].rack_name),
      rack_unit: updates.placement_zone && updates.placement_zone !== 'rack' ? null : (updates.rack_unit !== undefined ? updates.rack_unit : mockDevices[idx].rack_unit),
      connection_type,
      connected_socket_id: connection_type === 'socket' ? connected_socket_id : null,
      connected_socket_label: connection_type === 'socket' ? connected_socket_label : null,
      connected_socket_model_id: connection_type === 'socket' ? connected_socket_model_id : null,
      patch_panel_name: connection_type === 'patch_panel' ? patch_panel_name : null,
      patch_panel_port: connection_type === 'patch_panel' ? patch_panel_port : null,
      updated_at: new Date().toISOString(),
    };
    res.json(formatDeviceOutput(mockDevices[idx]));
  } catch (err) {
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
    const { floor_plan_id, pos_x, pos_y, placement_zone, zone, notes } = req.body;

    let device = null;
    let model = null;
    let targetFloorPlan = null;

    if (isSupabaseConfigured) {
      try {
        const [{ data: d }, { data: fp }] = await Promise.all([
          supabase.from('devices').select('*, boq_models!devices_boq_model_id_fkey(*)').eq('id', id).maybeSingle(),
          floor_plan_id ? supabase.from('floor_plans').select('*').eq('id', floor_plan_id).maybeSingle() : Promise.resolve({ data: null }),
        ]);
        device = d;
        model = d?.boq_models;
        targetFloorPlan = fp;
      } catch (err) {
        console.warn('Supabase fetch device position error, using mock fallback:', err.message);
      }
    }

    if (!device) {
      device = mockDevices.find((d) => d.id === id);
      if (device) {
        model = mockBoqModels.find((m) => m.id === device.boq_model_id);
        targetFloorPlan = floor_plan_id ? mockFloorPlans.find((fp) => fp.id === floor_plan_id) : null;
      }
    }

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    const determinedZone = placement_zone || (targetFloorPlan ? targetFloorPlan.zone_type : device.placement_zone) || 'indoor';

    const updatePayload = {
      floor_plan_id: floor_plan_id || null,
      pos_x: pos_x !== null && pos_x !== undefined ? Number(pos_x) : null,
      pos_y: pos_y !== null && pos_y !== undefined ? Number(pos_y) : null,
      placement_zone: determinedZone,
      updated_at: new Date().toISOString(),
    };
    if (zone !== undefined) {
      updatePayload.zone = zone || null;
    } else if (targetFloorPlan?.zone) {
      updatePayload.zone = targetFloorPlan.zone;
    }
    if (notes !== undefined) {
      updatePayload.notes = notes;
    }

    let savedDevice = null;
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('devices')
          .update(updatePayload)
          .eq('id', id)
          .select()
          .maybeSingle();

        if (!error && data) {
          savedDevice = data;
        }
      } catch (err) {
        console.warn('Supabase update device position warning:', err.message);
      }
    }

    // Always update mockDevices as well for instant consistency
    const mockDev = mockDevices.find((d) => d.id === id);
    if (mockDev) {
      mockDev.floor_plan_id = updatePayload.floor_plan_id;
      mockDev.pos_x = updatePayload.pos_x;
      mockDev.pos_y = updatePayload.pos_y;
      mockDev.placement_zone = updatePayload.placement_zone;
      if (updatePayload.zone !== undefined) mockDev.zone = updatePayload.zone;
      if (notes !== undefined) mockDev.notes = notes;
      mockDev.updated_at = updatePayload.updated_at;
      if (!savedDevice) savedDevice = mockDev;
    }

    res.json({
      success: true,
      device: savedDevice || { ...device, ...updatePayload },
    });
  } catch (err) {
    console.error('Update device position error:', err);
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
