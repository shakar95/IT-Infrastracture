const API_BASE = import.meta.env.VITE_API_URL || '/api';

async function handleResponse(res) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (json.guardrail_violation) {
      const err = new Error(json.message_en || 'Guardrail Violation');
      err.isGuardrail = true;
      err.data = json;
      throw err;
    }
    throw new Error(json.error || json.message || `Request failed with status ${res.status}`);
  }
  return json;
}

export const api = {
  // Settings & Project
  async getSettings() {
    return handleResponse(await fetch(`${API_BASE}/settings`));
  },
  async getHealth() {
    return handleResponse(await fetch(`${API_BASE}/health`));
  },

  // Categories
  async getCategories() {
    return handleResponse(await fetch(`${API_BASE}/categories`));
  },
  async createCategory(cat) {
    return handleResponse(await fetch(`${API_BASE}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cat),
    }));
  },
  async updateCategory(id, updates) {
    return handleResponse(await fetch(`${API_BASE}/categories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }));
  },
  async deleteCategory(id) {
    return handleResponse(await fetch(`${API_BASE}/categories/${id}`, {
      method: 'DELETE',
    }));
  },

  // BOQ Models
  async getBoqModels(params = {}) {
    const query = new URLSearchParams(params).toString();
    return handleResponse(await fetch(`${API_BASE}/boq${query ? `?${query}` : ''}`));
  },
  async createBoqModel(model) {
    return handleResponse(await fetch(`${API_BASE}/boq`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(model),
    }));
  },
  async updateBoqModel(id, updates) {
    return handleResponse(await fetch(`${API_BASE}/boq/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }));
  },
  async uploadBoqImage(id, fileOrBase64) {
    if (typeof fileOrBase64 === 'string') {
      return handleResponse(await fetch(`${API_BASE}/boq/${id}/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: fileOrBase64 }),
      }));
    } else {
      const formData = new FormData();
      formData.append('image', fileOrBase64);
      return handleResponse(await fetch(`${API_BASE}/boq/${id}/image`, {
        method: 'POST',
        body: formData,
      }));
    }
  },
  async deleteBoqModel(id) {
    return handleResponse(await fetch(`${API_BASE}/boq/${id}`, {
      method: 'DELETE',
    }));
  },
  async bulkProvisionBoq(id, params) {
    return handleResponse(await fetch(`${API_BASE}/boq/${id}/provision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    }));
  },
  async bulkImportBoqModels(items, projectId = 'proj-sitak') {
    return handleResponse(await fetch(`${API_BASE}/boq/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, project_id: projectId }),
    }));
  },

  // BOQ Versions & History Snapshots
  async getBoqVersions(projectId = 'proj-sitak') {
    const query = projectId ? `?project_id=${projectId}` : '';
    return handleResponse(await fetch(`${API_BASE}/boq/versions${query}`));
  },
  async createBoqSnapshot(projectId, data = {}) {
    return handleResponse(await fetch(`${API_BASE}/boq/versions/snapshot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId, ...data }),
    }));
  },
  async restoreBoqVersion(versionId, projectId = 'proj-sitak') {
    return handleResponse(await fetch(`${API_BASE}/boq/versions/${versionId}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ project_id: projectId }),
    }));
  },

  // Devices
  async getDevices(params = {}) {
    const query = new URLSearchParams(params).toString();
    return handleResponse(await fetch(`${API_BASE}/devices${query ? `?${query}` : ''}`));
  },
  async getDevice(id) {
    return handleResponse(await fetch(`${API_BASE}/devices/${id}`));
  },
  async createDevice(dev) {
    return handleResponse(await fetch(`${API_BASE}/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dev),
    }));
  },
  async updateDevice(id, updates) {
    return handleResponse(await fetch(`${API_BASE}/devices/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    }));
  },
  async updateDeviceStatus(id, status) {
    return handleResponse(await fetch(`${API_BASE}/devices/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    }));
  },
  async updateDevicePosition(id, { floor_plan_id, pos_x, pos_y }) {
    return handleResponse(await fetch(`${API_BASE}/devices/${id}/position`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ floor_plan_id, pos_x, pos_y }),
    }));
  },
  async deleteDevice(id) {
    return handleResponse(await fetch(`${API_BASE}/devices/${id}`, {
      method: 'DELETE',
    }));
  },

  // Maps / Floor Plans
  async getMaps(params = {}) {
    const query = new URLSearchParams(params).toString();
    return handleResponse(await fetch(`${API_BASE}/maps${query ? `?${query}` : ''}`));
  },
  async getMapDevices(mapId) {
    return handleResponse(await fetch(`${API_BASE}/maps/${mapId}/devices`));
  },
  async createFloorPlan(planData) {
    return handleResponse(await fetch(`${API_BASE}/maps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(planData),
    }));
  },
  async uploadFloorPlanImage(fileOrBase64) {
    if (typeof fileOrBase64 === 'string') {
      return handleResponse(await fetch(`${API_BASE}/maps/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: fileOrBase64 }),
      }));
    } else {
      const formData = new FormData();
      formData.append('image', fileOrBase64);
      return handleResponse(await fetch(`${API_BASE}/maps/upload`, {
        method: 'POST',
        body: formData,
      }));
    }
  },
  async deleteFloorPlan(id) {
    return handleResponse(await fetch(`${API_BASE}/maps/${id}`, {
      method: 'DELETE',
    }));
  },

  // Projects & Sites
  async getProjects() {
    return handleResponse(await fetch(`${API_BASE}/projects`));
  },
  async createProject(projectData) {
    return handleResponse(await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectData),
    }));
  },
  async deleteProject(id) {
    return handleResponse(await fetch(`${API_BASE}/projects/${id}`, {
      method: 'DELETE',
    }));
  },

  // AI Scanner & Troubleshooting
  async ocrScanSticker(imageBase64, mimeType = 'image/jpeg') {
    return handleResponse(await fetch(`${API_BASE}/ai/ocr-scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, mimeType }),
    }));
  },
  async troubleshootIssue(query, device_id = null) {
    return handleResponse(await fetch(`${API_BASE}/ai/troubleshoot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, device_id }),
    }));
  },
};

