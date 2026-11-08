import express from 'express';
import multer from 'multer';
import { supabase, isSupabaseConfigured } from '../config/supabase.js';
import { mockFloorPlans, mockDevices, mockBoqModels, mockCategories } from '../services/mockData.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB for large floor plan blueprints
});

// GET all floor plans (Scoped to project_id)
router.get('/', async (req, res) => {
  try {
    const targetProject = req.query.project_id || 'proj-sitak';

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('floor_plans').select('*').order('floor_level');
      if (!error && data) {
        // Ensure plan_type defaults to 'ICT' if not set
        const populated = data.map((fp) => ({
          ...fp,
          plan_type: fp.plan_type || 'ICT',
        }));
        return res.json(populated);
      }
    }

    // In-memory filter - Strictly scoped to targetProject
    const filtered = mockFloorPlans
      .filter((fp) => (fp.project_id || 'proj-sitak') === targetProject)
      .map((fp) => ({
        ...fp,
        plan_type: fp.plan_type || 'ICT',
      }));
    res.json(filtered);
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

// POST /api/maps/upload - Upload blueprint/site-plan image file to Supabase Storage
router.post('/upload', upload.single('image'), async (req, res) => {
  try {
    let fileBuffer;
    let mimeType = 'image/jpeg';
    let fileExt = 'jpg';

    if (req.file) {
      fileBuffer = req.file.buffer;
      mimeType = req.file.mimetype || 'image/jpeg';
      fileExt = req.file.originalname?.split('.').pop() || 'jpg';
    } else if (req.body?.imageBase64) {
      const base64Str = req.body.imageBase64;
      const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (matches && matches.length === 3) {
        mimeType = matches[1];
        fileBuffer = Buffer.from(matches[2], 'base64');
        fileExt = mimeType.split('/')[1] || 'jpg';
      } else {
        fileBuffer = Buffer.from(base64Str, 'base64');
      }
    } else {
      return res.status(400).json({ error: 'No image file or imageBase64 provided' });
    }

    const fileName = `floor-plan-${Date.now()}.${fileExt}`;

    if (isSupabaseConfigured) {
      // Try bucket 'floor-plans' first, fallback to 'boq-images'
      let bucketName = 'floor-plans';
      let uploadRes = await supabase.storage
        .from(bucketName)
        .upload(fileName, fileBuffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadRes.error) {
        // Fallback to boq-images bucket which is guaranteed public
        bucketName = 'boq-images';
        uploadRes = await supabase.storage
          .from(bucketName)
          .upload(fileName, fileBuffer, {
            contentType: mimeType,
            upsert: true,
          });
      }

      if (uploadRes.error) {
        console.error('Storage upload error:', uploadRes.error);
        throw uploadRes.error;
      }

      const { data: urlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      return res.json({
        success: true,
        publicUrl: urlData.publicUrl,
        storagePath: uploadRes.data.path,
        bucket: bucketName,
      });
    }

    const dataUrl = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
    return res.json({ success: true, publicUrl: dataUrl });
  } catch (err) {
    console.error('Error uploading floor plan image:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST add new floor plan
router.post('/', async (req, res) => {
  try {
    const { name, name_ku, zone, zone_type, plan_type, floor_level, image_url, scale_meters_per_pixel = 0.05 } = req.body;

    if (!name || !image_url) {
      return res.status(400).json({ error: 'Floor plan name and image URL are required.' });
    }

    const planPayload = {
      project_id: req.body.project_id || 'proj-sitak',
      name,
      name_ku: name_ku || name,
      zone: zone || null,
      zone_type: zone_type || null,
      plan_type: plan_type || 'ICT',
      floor_level:
        floor_level !== undefined && floor_level !== null && floor_level !== ''
          ? Number(floor_level)
          : null,
      image_url,
      scale_meters_per_pixel: Number(scale_meters_per_pixel) || 0.05,
      is_active: true,
    };

    if (isSupabaseConfigured) {
      let { data, error } = await supabase
        .from('floor_plans')
        .insert([planPayload])
        .select()
        .single();

      // Graceful fallback if floor_plans table does not yet have 'plan_type', 'zone' or 'project_id' column in Supabase schema cache
      if (error && (error.message?.includes('plan_type') || error.message?.includes('zone') || error.message?.includes('project_id') || error.code === 'PGRST204')) {
        console.warn('Supabase floor_plans missing column, retrying insert with standard columns...');
        const { plan_type: _pt, zone: _z, project_id: _p, ...cleanPayload } = planPayload;
        const retryResult = await supabase
          .from('floor_plans')
          .insert([cleanPayload])
          .select()
          .single();
        data = retryResult.data;
        error = retryResult.error;
      }

      // Graceful fallback if database schema enforces NOT NULL or enum on zone_type or floor_level
      if (
        error &&
        (error.message?.includes('zone_type') ||
          error.message?.includes('floor_level') ||
          error.message?.includes('enum') ||
          error.code === '22P02')
      ) {
        console.warn('Supabase constraint on zone_type or floor_level, retrying with safe fallback defaults...');
        const safePayload = {
          ...planPayload,
          zone_type: planPayload.zone_type || 'indoor',
          floor_level: planPayload.floor_level ?? 0,
        };
        const retryFallback = await supabase
          .from('floor_plans')
          .insert([safePayload])
          .select()
          .single();
        data = retryFallback.data;
        error = retryFallback.error;
      }

      if (error) throw error;
      return res.status(201).json({ ...data, plan_type: planPayload.plan_type || 'ICT' });
    }

    const newPlan = {
      ...planPayload,
      id: `fp-${Date.now()}`,
      created_at: new Date().toISOString(),
    };

    mockFloorPlans.push(newPlan);
    res.status(201).json(newPlan);
  } catch (err) {
    console.error('Error creating floor plan:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT update floor plan (Name, Kurdish Name, Zone, Floor Level, Plan Type, Blueprint Image)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, name_ku, zone, zone_type, plan_type, floor_level, image_url, scale_meters_per_pixel } = req.body;

    const updatePayload = {};
    if (name !== undefined) updatePayload.name = name;
    if (name_ku !== undefined) updatePayload.name_ku = name_ku;
    if (zone !== undefined) updatePayload.zone = zone || null;
    if (zone_type !== undefined) updatePayload.zone_type = zone_type || null;
    if (plan_type !== undefined) updatePayload.plan_type = plan_type || 'ICT';
    if (floor_level !== undefined) {
      updatePayload.floor_level =
        floor_level !== null && floor_level !== '' && floor_level !== undefined
          ? Number(floor_level)
          : null;
    }
    if (image_url !== undefined) updatePayload.image_url = image_url;
    if (scale_meters_per_pixel !== undefined) updatePayload.scale_meters_per_pixel = Number(scale_meters_per_pixel);

    if (isSupabaseConfigured) {
      let { data, error } = await supabase
        .from('floor_plans')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      // Graceful fallback if database schema doesn't yet have 'plan_type' column
      if (error && (error.message?.includes('plan_type') || error.code === 'PGRST204')) {
        console.warn('Supabase floor_plans missing plan_type, retrying update without plan_type...');
        const { plan_type: _pt, ...cleanPayload } = updatePayload;
        const retryUpdate = await supabase
          .from('floor_plans')
          .update(cleanPayload)
          .eq('id', id)
          .select()
          .single();
        data = retryUpdate.data;
        error = retryUpdate.error;
      }

      // Graceful fallback if database schema enforces NOT NULL or enum on zone_type or floor_level
      if (
        error &&
        (error.message?.includes('zone_type') ||
          error.message?.includes('floor_level') ||
          error.message?.includes('enum') ||
          error.code === '22P02')
      ) {
        console.warn('Supabase constraint on zone_type or floor_level update, falling back to safe defaults...');
        const safeUpdate = { ...updatePayload };
        if (safeUpdate.zone_type === null) safeUpdate.zone_type = 'indoor';
        if (safeUpdate.floor_level === null) safeUpdate.floor_level = 0;
        const retryUpdate = await supabase
          .from('floor_plans')
          .update(safeUpdate)
          .eq('id', id)
          .select()
          .single();
        data = retryUpdate.data;
        error = retryUpdate.error;
      }

      if (error) throw error;
      return res.json({ ...data, plan_type: updatePayload.plan_type || data?.plan_type || 'ICT' });
    }

    const idx = mockFloorPlans.findIndex((fp) => fp.id === id);
    if (idx !== -1) {
      mockFloorPlans[idx] = {
        ...mockFloorPlans[idx],
        ...updatePayload,
        updated_at: new Date().toISOString(),
      };
      return res.json(mockFloorPlans[idx]);
    }

    return res.status(404).json({ error: 'Floor plan not found' });
  } catch (err) {
    console.error('Error updating floor plan:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE floor plan
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (isSupabaseConfigured) {
      // Unpin any devices on this plan first
      await supabase.from('devices').update({ floor_plan_id: null, pos_x: null, pos_y: null }).eq('floor_plan_id', id);
      const { error } = await supabase.from('floor_plans').delete().eq('id', id);
      if (error) throw error;
      return res.json({ success: true, message: 'Floor plan deleted' });
    }

    const idx = mockFloorPlans.findIndex((fp) => fp.id === id);
    if (idx !== -1) {
      mockFloorPlans.splice(idx, 1);
    }
    return res.json({ success: true, message: 'Floor plan deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
