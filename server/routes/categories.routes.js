import express from 'express';
import { supabase, isSupabaseConfigured } from '../config/supabase.js';
import { mockCategories, mockBoqModels } from '../services/mockData.js';

const router = express.Router();

// GET all categories
router.get('/', async (req, res) => {
  try {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('categories').select('*').order('name');
      if (error) throw error;
      return res.json(data);
    }
    res.json(mockCategories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add new category with allowed zones and custom schema
router.post('/', async (req, res) => {
  try {
    const {
      name,
      name_ku,
      description,
      icon_name = 'Layers',
      color_code = '#3B82F6',
      allowed_zones = ['indoor'],
      custom_schema = [],
    } = req.body;

    if (!name || !name_ku) {
      return res.status(400).json({ error: 'Category Name (English & Kurdish) is required.' });
    }

    const newCategory = {
      id: `cat-${Date.now()}`,
      name,
      name_ku,
      description: description || '',
      icon_name,
      color_code,
      allowed_zones: Array.isArray(allowed_zones) ? allowed_zones : ['indoor'],
      custom_schema: Array.isArray(custom_schema) ? custom_schema : [],
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('categories').insert([newCategory]).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    mockCategories.push(newCategory);
    res.status(201).json(newCategory);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT update category (e.g. adding custom fields or allowed zones)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('categories').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return res.json(data);
    }

    const idx = mockCategories.findIndex((c) => c.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Category not found' });

    mockCategories[idx] = { ...mockCategories[idx], ...updates, updated_at: new Date().toISOString() };
    res.json(mockCategories[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE category
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if category is in use
    const inUse = mockBoqModels.some((b) => b.category_id === id);
    if (inUse) {
      return res.status(400).json({
        error: 'Cannot delete category because it is currently assigned to one or more BOQ models.',
      });
    }

    const idx = mockCategories.findIndex((c) => c.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Category not found' });

    mockCategories.splice(idx, 1);
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

