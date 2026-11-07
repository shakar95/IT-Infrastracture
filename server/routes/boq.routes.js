import express from 'express';
import multer from 'multer';
import { supabase, isSupabaseConfigured } from '../config/supabase.js';
import { mockBoqModels, mockDevices, mockCategories, mockBoqVersions } from '../services/mockData.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// GET all BOQ models with provisioned counts (Scoped to project_id)
router.get('/', async (req, res) => {
  try {
    const targetProject = req.query.project_id || 'proj-sitak';

    if (isSupabaseConfigured) {
      let query = supabase.from('boq_models').select('*, categories(*)');
      const { data: models, error } = await query;
      if (!error && models) {
        const { data: devices } = await supabase.from('devices').select('id, boq_model_id');
        const enhanced = models.map((m) => ({
          ...m,
          provisioned_count: (devices || []).filter((d) => d.boq_model_id === m.id).length,
        }));
        return res.json(enhanced);
      }
    }

    // In-memory fallback - Strictly filter by project_id
    const enriched = mockBoqModels
      .filter((m) => (m.project_id || 'proj-sitak') === targetProject)
      .map((m) => {
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

// POST create new BOQ model (Scoped to project_id)
router.post('/', async (req, res) => {
  try {
    const {
      project_id = 'proj-sitak',
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
      project_id,
      category_id,
      brand: brand.trim(),
      model: model.trim(),
      description: description || '',
      total_qty: Number(total_qty) || 1,
      unit_cost: Number(unit_cost) || 0,
      product_image_url: product_image_url || '/default-ict-device.svg',
      manual_pdf_url: manual_pdf_url || null,
      allowed_zones: Array.isArray(allowed_zones) ? allowed_zones : ['indoor'],
      is_rack_mounted: Boolean(is_rack_mounted),
      rack_unit_size: Number(rack_unit_size) || 0,
      custom_specs: custom_specs || {},
    };

    if (isSupabaseConfigured) {
      let { data, error } = await supabase.from('boq_models').insert([payload]).select('*, categories(*)').single();
      // Graceful fallback if boq_models table does not yet have 'project_id' column in Supabase schema cache
      if (error && (error.message?.includes('project_id') || error.code === 'PGRST204')) {
        console.warn('Supabase boq_models table missing project_id column, retrying insert without project_id...');
        const { project_id, ...payloadWithoutProject } = payload;
        const retryResult = await supabase.from('boq_models').insert([payloadWithoutProject]).select('*, categories(*)').single();
        data = retryResult.data;
        error = retryResult.error;
      }
      if (!error && data) return res.status(201).json(data);
    }

    const newModel = {
      ...payload,
      id: `boq-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      created_at: new Date().toISOString(),
    };

    mockBoqModels.push(newModel);
    res.status(201).json(newModel);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/boq/batch - Smart Bulk import with deduplication, field update, skip & auto-versioning
router.post('/batch', async (req, res) => {
  try {
    const { items = [], project_id = 'proj-sitak' } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided for batch import' });
    }

    const defaultImg = '/default-ict-device.svg';

    // 1. Fetch all categories to guarantee every item has a valid Category UUID in Supabase
    let dbCategories = [];
    if (isSupabaseConfigured) {
      try {
        const { data: catData } = await supabase.from('categories').select('id, name, name_ku');
        if (catData && catData.length > 0) dbCategories = catData;
      } catch (catErr) {
        console.warn('Failed to load categories from Supabase:', catErr.message);
      }
    }
    if (dbCategories.length === 0) {
      dbCategories = mockCategories;
    }
    const defaultCategoryId = dbCategories[0]?.id || '10000000-0000-0000-0000-000000000001';

    // 2. Fetch existing models from Supabase (or memory)
    let currentDbModels = [];
    if (isSupabaseConfigured) {
      try {
        const { data: dbData } = await supabase.from('boq_models').select('*');
        if (dbData) currentDbModels = dbData;
      } catch (err) {
        console.warn('Failed to load Supabase models for batch import:', err.message);
      }
    }
    if (currentDbModels.length === 0) {
      currentDbModels = mockBoqModels;
    }

    // 3. Process items and prepare batch upsert payload
    const added = [];
    const updated = [];
    const skipped = [];
    const changeDetails = [];
    const upsertBatch = [];

    // Deduplicate within the incoming batch itself (by brand + model lowercased)
    const seenBrandModel = new Map();

    for (const rawItem of items) {
      const brand = (rawItem.brand || 'Generic').trim();
      const model = (rawItem.model || `MOD-${Math.floor(1000 + Math.random() * 9000)}`).trim();
      const normBrand = brand.toLowerCase();
      const normModel = model.toLowerCase();
      const dedupeKey = `${normBrand}:::${normModel}`;

      // If duplicate in incoming Excel, skip subsequent duplicates within the batch
      if (seenBrandModel.has(dedupeKey)) continue;
      seenBrandModel.set(dedupeKey, true);

      // Match against existing database models
      const existing = currentDbModels.find(
        (m) =>
          (m.model && m.model.trim().toLowerCase() === normModel && m.brand && m.brand.trim().toLowerCase() === normBrand) ||
          (m.model && m.model.trim().toLowerCase() === normModel)
      );

      // Validate category ID
      let categoryId = rawItem.category_id;
      if (!categoryId || !dbCategories.some((c) => c.id === categoryId)) {
        // Try match by name
        const catStr = (rawItem.category_name || rawItem.category || '').toLowerCase();
        const matched = dbCategories.find(
          (c) =>
            c.name.toLowerCase() === catStr ||
            (c.name_ku && c.name_ku.toLowerCase() === catStr) ||
            c.name.toLowerCase().includes(catStr)
        );
        categoryId = matched ? matched.id : defaultCategoryId;
      }

      const targetQty = Math.max(1, Number(rawItem.total_qty) || 1);
      const targetUnitCost = Number(rawItem.unit_cost) || 0;
      const targetDesc = (rawItem.description || '').trim();
      const targetZone = Array.isArray(rawItem.allowed_zones) && rawItem.allowed_zones.length > 0
        ? rawItem.allowed_zones
        : [rawItem.placement_zone || 'indoor'];
      const targetIsRack = Boolean(rawItem.is_rack_mounted);
      const targetRackSize = Number(rawItem.rack_unit_size) || 0;
      const targetImg = rawItem.product_image_url || defaultImg;

      if (!existing) {
        // Prepare for insert - omit id so Postgres generates UUID automatically!
        const itemRecord = {
          project_id,
          brand,
          model,
          category_id: categoryId,
          description: targetDesc,
          total_qty: targetQty,
          unit_cost: targetUnitCost,
          product_image_url: targetImg,
          manual_pdf_url: rawItem.manual_pdf_url || null,
          allowed_zones: targetZone,
          is_rack_mounted: targetIsRack,
          rack_unit_size: targetRackSize,
          custom_specs: rawItem.custom_specs || {},
          updated_at: new Date().toISOString(),
        };

        upsertBatch.push(itemRecord);
        added.push(itemRecord);
        changeDetails.push({
          type: 'added',
          brand,
          model,
          details: `Added new model (Qty: ${targetQty}, Cost: $${targetUnitCost})`,
        });
      } else {
        // Compare diffs
        const diffs = [];
        if (Number(existing.total_qty) !== targetQty) {
          diffs.push({ field: 'total_qty', label: 'Qty', oldVal: existing.total_qty, newVal: targetQty });
        }
        if (Number(existing.unit_cost) !== targetUnitCost) {
          diffs.push({ field: 'unit_cost', label: 'Unit Cost', oldVal: existing.unit_cost, newVal: targetUnitCost });
        }
        if ((existing.description || '').trim() !== targetDesc && targetDesc) {
          diffs.push({ field: 'description', label: 'Description', oldVal: existing.description, newVal: targetDesc });
        }
        if (categoryId && existing.category_id !== categoryId) {
          diffs.push({ field: 'category_id', label: 'Category', oldVal: existing.category_id, newVal: categoryId });
        }
        if (Boolean(existing.is_rack_mounted) !== targetIsRack) {
          diffs.push({ field: 'is_rack_mounted', label: 'Rack Mount', oldVal: existing.is_rack_mounted, newVal: targetIsRack });
        }
        if (Number(existing.rack_unit_size) !== targetRackSize) {
          diffs.push({ field: 'rack_unit_size', label: 'Rack Size', oldVal: existing.rack_unit_size, newVal: targetRackSize });
        }

        if (diffs.length > 0) {
          const itemRecord = {
            id: existing.id,
            project_id: existing.project_id || project_id,
            brand: existing.brand || brand,
            model: existing.model || model,
            category_id: categoryId,
            description: targetDesc || existing.description,
            total_qty: targetQty,
            unit_cost: targetUnitCost,
            product_image_url: targetImg,
            manual_pdf_url: rawItem.manual_pdf_url || existing.manual_pdf_url || null,
            allowed_zones: targetZone,
            is_rack_mounted: targetIsRack,
            rack_unit_size: targetRackSize,
            custom_specs: rawItem.custom_specs || existing.custom_specs || {},
            updated_at: new Date().toISOString(),
          };

          upsertBatch.push(itemRecord);
          updated.push({
            ...itemRecord,
            diffs,
          });
          changeDetails.push({
            type: 'updated',
            brand,
            model,
            diffs,
            details: diffs.map((d) => `${d.label}: ${d.oldVal} ➔ ${d.newVal}`).join(', '),
          });
        } else {
          skipped.push(existing);
        }
      }
    }

    // 4. Execute Batch Upsert into Supabase in fast chunks
    if (isSupabaseConfigured && upsertBatch.length > 0) {
      const CHUNK_SIZE = 100;
      for (let i = 0; i < upsertBatch.length; i += CHUNK_SIZE) {
        const chunk = upsertBatch.slice(i, i + CHUNK_SIZE);
        try {
          const { error: upsertErr } = await supabase
            .from('boq_models')
            .upsert(chunk, { onConflict: 'brand,model' });

          if (upsertErr) {
            console.error('Supabase batch upsert chunk error:', upsertErr);
            // Fallback: try inserting without project_id if column missing in Supabase schema cache
            if (upsertErr.message?.includes('project_id') || upsertErr.code === 'PGRST204') {
              const cleanedChunk = chunk.map(({ project_id: _, ...rest }) => rest);
              await supabase.from('boq_models').upsert(cleanedChunk, { onConflict: 'brand,model' });
            }
          }
        } catch (chunkErr) {
          console.error('Error executing chunk upsert:', chunkErr);
        }
      }
    }

    // Also update in-memory mockBoqModels for local sync
    for (const item of upsertBatch) {
      const idx = mockBoqModels.findIndex((m) => m.brand === item.brand && m.model === item.model);
      if (idx !== -1) {
        mockBoqModels[idx] = { ...mockBoqModels[idx], ...item };
      } else {
        mockBoqModels.push({
          id: item.id || `boq-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          created_at: new Date().toISOString(),
          ...item,
        });
      }
    }

    // 5. Version snapshot
    let createdVersion = null;
    if (added.length > 0 || updated.length > 0) {
      const existingProjectVersions = mockBoqVersions.filter((v) => v.project_id === project_id);
      const nextVerNum = `v1.${existingProjectVersions.length}`;
      const finalProjectModels = mockBoqModels.filter((m) => (m.project_id || 'proj-sitak') === project_id);

      createdVersion = {
        id: `ver-${Date.now()}`,
        project_id,
        version_number: nextVerNum,
        title: `Excel BOQ Import (${nextVerNum})`,
        title_ku: `هاوردەکردنی ئێکسڵ (${nextVerNum})`,
        summary: `${added.length} Added, ${updated.length} Updated, ${skipped.length} Skipped`,
        summary_ku: `${added.length} زیادکراو، ${updated.length} نوێکراوە، ${skipped.length} بێ گۆڕانکاری`,
        author: 'System (Excel Import)',
        created_at: new Date().toISOString(),
        item_count: finalProjectModels.length,
        total_value: finalProjectModels.reduce((acc, m) => acc + (m.total_qty || 0) * (m.unit_cost || 0), 0),
        changes: {
          added_count: added.length,
          updated_count: updated.length,
          skipped_count: skipped.length,
          details: changeDetails,
        },
        items_snapshot: JSON.parse(JSON.stringify(finalProjectModels)),
      };

      mockBoqVersions.unshift(createdVersion);
    }

    // 6. Fetch fresh, complete list of models to return to frontend
    let finalModels = mockBoqModels.filter((m) => (m.project_id || 'proj-sitak') === project_id);
    if (isSupabaseConfigured) {
      try {
        const { data: dbModels } = await supabase.from('boq_models').select('*, categories(*)');
        if (dbModels && dbModels.length > 0) {
          const { data: devices } = await supabase.from('devices').select('id, boq_model_id');
          finalModels = dbModels
            .filter((m) => (m.project_id || 'proj-sitak') === project_id)
            .map((m) => ({
              ...m,
              provisioned_count: (devices || []).filter((d) => d.boq_model_id === m.id).length,
            }));
        }
      } catch (err) {
        console.warn('Error fetching fresh Supabase models after batch import:', err.message);
      }
    }

    return res.status(201).json({
      success: true,
      models: finalModels,
      report: {
        total_processed: items.length,
        added_count: added.length,
        updated_count: updated.length,
        skipped_count: skipped.length,
        added,
        updated,
        skipped,
      },
      version: createdVersion,
    });
  } catch (err) {
    console.error('Error in smart BOQ batch import:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/boq/versions - Get all version snapshots for a project
router.get('/versions', async (req, res) => {
  try {
    const { project_id = 'proj-sitak' } = req.query;
    const versions = mockBoqVersions
      .filter((v) => (v.project_id || 'proj-sitak') === project_id)
      .map((v) => ({
        id: v.id,
        project_id: v.project_id,
        version_number: v.version_number,
        title: v.title,
        title_ku: v.title_ku,
        summary: v.summary,
        summary_ku: v.summary_ku,
        author: v.author,
        created_at: v.created_at,
        item_count: v.item_count,
        total_value: v.total_value,
        changes: v.changes,
        // snapshot items provided for comparison & restore
        items_snapshot: v.items_snapshot,
      }));
    res.json(versions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/boq/versions/snapshot - Manually create a version checkpoint
router.post('/versions/snapshot', async (req, res) => {
  try {
    const { project_id = 'proj-sitak', title, title_ku, summary, summary_ku } = req.body;
    const projectModels = mockBoqModels.filter((m) => (m.project_id || 'proj-sitak') === project_id);
    const existingProjectVersions = mockBoqVersions.filter((v) => v.project_id === project_id);
    const nextVerNum = `v1.${existingProjectVersions.length}`;

    const newVersion = {
      id: `ver-${Date.now()}`,
      project_id,
      version_number: nextVerNum,
      title: title || `Manual Snapshot (${nextVerNum})`,
      title_ku: title_ku || `ڤێرژنی دەستی (${nextVerNum})`,
      summary: summary || `Saved snapshot of ${projectModels.length} models`,
      summary_ku: summary_ku || `وەرگرتنی ڤێرژنی ${projectModels.length} مۆدێل`,
      author: 'Engineer',
      created_at: new Date().toISOString(),
      item_count: projectModels.length,
      total_value: projectModels.reduce((acc, m) => acc + (m.total_qty || 0) * (m.unit_cost || 0), 0),
      changes: {
        added_count: 0,
        updated_count: 0,
        skipped_count: projectModels.length,
        details: [`Manual snapshot taken at ${new Date().toLocaleTimeString()}`],
      },
      items_snapshot: JSON.parse(JSON.stringify(projectModels)),
    };

    mockBoqVersions.unshift(newVersion);
    res.status(201).json(newVersion);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/boq/versions/:id/restore - Restore BOQ to a specific version snapshot
router.post('/versions/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;
    const { project_id = 'proj-sitak' } = req.body;

    const targetVersion = mockBoqVersions.find((v) => v.id === id && (v.project_id || 'proj-sitak') === project_id);
    if (!targetVersion) {
      return res.status(404).json({ error: 'BOQ version not found' });
    }

    // Remove existing items for this project
    for (let i = mockBoqModels.length - 1; i >= 0; i--) {
      if ((mockBoqModels[i].project_id || 'proj-sitak') === project_id) {
        mockBoqModels.splice(i, 1);
      }
    }

    // Restore items from snapshot
    const restoredItems = JSON.parse(JSON.stringify(targetVersion.items_snapshot));
    restoredItems.forEach((it) => {
      mockBoqModels.push({
        ...it,
        project_id,
        restored_at: new Date().toISOString(),
      });
    });

    // Create a rollback audit version so history is never lost
    const existingProjectVersions = mockBoqVersions.filter((v) => v.project_id === project_id);
    const rollbackVerNum = `v1.${existingProjectVersions.length}`;
    const rollbackVersion = {
      id: `ver-${Date.now()}`,
      project_id,
      version_number: rollbackVerNum,
      title: `Rollback to ${targetVersion.version_number}`,
      title_ku: `گەڕاندنەوە بۆ ${targetVersion.version_number}`,
      summary: `Restored BOQ catalog to state of ${targetVersion.version_number}`,
      summary_ku: `گەڕاندنەوەی کەتەلۆگ بۆ دۆخی ${targetVersion.version_number}`,
      author: 'System (Rollback)',
      created_at: new Date().toISOString(),
      item_count: restoredItems.length,
      total_value: restoredItems.reduce((acc, m) => acc + (m.total_qty || 0) * (m.unit_cost || 0), 0),
      changes: {
        rollback_from: targetVersion.version_number,
        details: [`Restored catalog from snapshot ${targetVersion.version_number}`],
      },
      items_snapshot: JSON.parse(JSON.stringify(restoredItems)),
    };

    mockBoqVersions.unshift(rollbackVersion);

    res.json({
      success: true,
      message: `Successfully restored BOQ to version ${targetVersion.version_number}`,
      models: restoredItems,
      version: rollbackVersion,
    });
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

// POST /api/boq/:id/image - Uploads photo directly into Supabase Storage Bucket ('boq-images')
router.post('/:id/image', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;
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

    const fileName = `model-${id}-${Date.now()}.${fileExt}`;

    if (isSupabaseConfigured) {
      // 1. Upload to Supabase Storage Bucket 'boq-images'
      const { data: uploadData, error: uploadErr } = await supabase.storage
        .from('boq-images')
        .upload(fileName, fileBuffer, {
          contentType: mimeType,
          upsert: true,
        });

      if (uploadErr) {
        console.error('Supabase Storage upload error:', uploadErr);
        throw uploadErr;
      }

      // 2. Retrieve public CDN URL from bucket
      const { data: urlData } = supabase.storage
        .from('boq-images')
        .getPublicUrl(fileName);

      const publicUrl = urlData.publicUrl;

      // 3. Update boq_models table with the storage URL
      const { data: updatedModel, error: updateErr } = await supabase
        .from('boq_models')
        .update({ product_image_url: publicUrl })
        .eq('id', id)
        .select()
        .single();

      if (updateErr) throw updateErr;

      return res.json({
        success: true,
        publicUrl,
        storagePath: uploadData.path,
        bucket: 'boq-images',
        model: updatedModel,
      });
    }

    // In-memory fallback
    const dataUrl = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
    const idx = mockBoqModels.findIndex((m) => m.id === id);
    if (idx !== -1) {
      mockBoqModels[idx].product_image_url = dataUrl;
    }
    return res.json({ success: true, publicUrl: dataUrl });
  } catch (err) {
    console.error('Error uploading BOQ image to bucket:', err);
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

