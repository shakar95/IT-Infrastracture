const API_BASE = '/api';

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
  async getBoqModels() {
    return handleResponse(await fetch(`${API_BASE}/boq`));
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
  async getMaps() {
    return handleResponse(await fetch(`${API_BASE}/maps`));
  },
  async getMapDevices(mapId) {
    return handleResponse(await fetch(`${API_BASE}/maps/${mapId}/devices`));
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

