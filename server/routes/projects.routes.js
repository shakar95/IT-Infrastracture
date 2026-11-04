import express from 'express';
import { supabase, isSupabaseConfigured } from '../config/supabase.js';

const router = express.Router();

let mockProjects = [
  {
    id: 'proj-sitak',
    name: 'Iraq Sitak Villa Project',
    name_ku: 'پرۆژەی نایابی ڤێلای سیتەک',
    location: 'Sitak, Sulaymaniyah, KRI',
    location_ku: 'سیتەک، سلێمانی',
    client_name: 'VIP Mountain Estate',
    is_default: true,
    created_at: new Date().toISOString(),
  },
];

// GET all projects / sites
router.get('/', async (req, res) => {
  try {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.from('project_settings').select('*').order('created_at');
      if (!error && data && data.length > 0) {
        return res.json(
          data.map((p) => ({
            id: p.id,
            name: p.project_name,
            name_ku: p.project_name,
            location: p.location,
            location_ku: p.location,
            client_name: p.client_name,
            network_defaults: p.network_defaults,
            is_default: p.id === data[0].id,
            created_at: p.created_at,
          }))
        );
      }
    }
    res.json(mockProjects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST create new project / site
router.post('/', async (req, res) => {
  try {
    const { name, name_ku, location, location_ku, client_name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Project name is required' });
    }

    const newProject = {
      id: `proj-${Date.now()}`,
      name,
      name_ku: name_ku || name,
      location: location || 'Sulaymaniyah, Kurdistan Region',
      location_ku: location_ku || location || 'سلێمانی، هەرێمی کوردستان',
      client_name: client_name || 'Client Estate',
      is_default: false,
      created_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('project_settings')
        .insert([
          {
            project_name: name,
            location: location || 'Sulaymaniyah, Kurdistan Region',
            client_name: client_name || 'Client Estate',
          },
        ])
        .select()
        .single();

      if (!error && data) {
        return res.status(201).json({
          id: data.id,
          name: data.project_name,
          name_ku: name_ku || data.project_name,
          location: data.location,
          location_ku: location_ku || data.location,
          client_name: data.client_name,
          is_default: false,
          created_at: data.created_at,
        });
      }
    }

    mockProjects.push(newProject);
    res.status(201).json(newProject);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE project
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (isSupabaseConfigured) {
      await supabase.from('project_settings').delete().eq('id', id);
    }
    mockProjects = mockProjects.filter((p) => p.id !== id);
    res.json({ success: true, message: 'Project removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

