import express from 'express';
import { supabase, isSupabaseConfigured } from '../config/supabase.js';
import { mockBoqModels, mockDevices, mockFloorPlans, mockBoqVersions } from '../services/mockData.js';

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
            name_ku: p.network_defaults?.name_ku || p.project_name,
            location: p.location,
            location_ku: p.network_defaults?.location_ku || p.location,
            client_name: p.client_name,
            description: p.network_defaults?.description || p.location,
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

// PUT update project / site (name, description, location)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, name_ku, location, location_ku, client_name, description } = req.body;

    let updatedProject = null;

    if (isSupabaseConfigured) {
      const { data: existing } = await supabase
        .from('project_settings')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      const updateData = {};
      if (name !== undefined) updateData.project_name = name.trim();
      if (location !== undefined) updateData.location = location.trim();
      else if (description !== undefined) updateData.location = description.trim();
      if (client_name !== undefined) updateData.client_name = client_name.trim();

      const network_defaults = {
        ...(existing?.network_defaults || {}),
        ...(description !== undefined ? { description: description.trim() } : {}),
        ...(name_ku !== undefined ? { name_ku: name_ku.trim() } : {}),
        ...(location_ku !== undefined ? { location_ku: location_ku.trim() } : {}),
      };
      updateData.network_defaults = network_defaults;

      const { data, error } = await supabase
        .from('project_settings')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (!error && data) {
        updatedProject = {
          id: data.id,
          name: data.project_name,
          name_ku: name_ku || data.network_defaults?.name_ku || data.project_name,
          location: data.location,
          location_ku: location_ku || data.network_defaults?.location_ku || data.location,
          client_name: data.client_name,
          description: data.network_defaults?.description || data.location,
          network_defaults: data.network_defaults,
          is_default: false,
          created_at: data.created_at,
        };
      }
    }

    const mockIdx = mockProjects.findIndex((p) => p.id === id);
    if (mockIdx !== -1) {
      mockProjects[mockIdx] = {
        ...mockProjects[mockIdx],
        name: name !== undefined ? name.trim() : mockProjects[mockIdx].name,
        name_ku: name_ku !== undefined ? name_ku.trim() : mockProjects[mockIdx].name_ku,
        location: location !== undefined ? location.trim() : (description !== undefined ? description.trim() : mockProjects[mockIdx].location),
        location_ku: location_ku !== undefined ? location_ku.trim() : mockProjects[mockIdx].location_ku,
        client_name: client_name !== undefined ? client_name.trim() : mockProjects[mockIdx].client_name,
        description: description !== undefined ? description.trim() : mockProjects[mockIdx].description,
      };
      if (!updatedProject) {
        updatedProject = mockProjects[mockIdx];
      }
    }

    if (!updatedProject) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json(updatedProject);
  } catch (err) {
    console.error('Error updating project:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE project / site completely with all associated data
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (isSupabaseConfigured) {
      // Clean up child tables first
      await supabase.from('devices').delete().eq('project_id', id);
      await supabase.from('floor_plans').delete().eq('project_id', id);
      await supabase.from('boq_models').delete().eq('project_id', id);
      await supabase.from('boq_versions').delete().eq('project_id', id);
      await supabase.from('project_settings').delete().eq('id', id);
    }

    mockProjects = mockProjects.filter((p) => p.id !== id);

    for (let i = mockDevices.length - 1; i >= 0; i--) {
      if (mockDevices[i].project_id === id) {
        mockDevices.splice(i, 1);
      }
    }
    for (let i = mockFloorPlans.length - 1; i >= 0; i--) {
      if (mockFloorPlans[i].project_id === id) {
        mockFloorPlans.splice(i, 1);
      }
    }
    for (let i = mockBoqModels.length - 1; i >= 0; i--) {
      if (mockBoqModels[i].project_id === id) {
        mockBoqModels.splice(i, 1);
      }
    }
    for (let i = mockBoqVersions.length - 1; i >= 0; i--) {
      if (mockBoqVersions[i].project_id === id) {
        mockBoqVersions.splice(i, 1);
      }
    }

    res.json({ success: true, message: 'Project and all associated data deleted successfully' });
  } catch (err) {
    console.error('Error deleting project:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;

