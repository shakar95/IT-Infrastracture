import express from 'express';
import { scanDeviceLabel, troubleshootIssue } from '../services/gemini.service.js';
import { mockBoqModels, mockDevices, mockCategories } from '../services/mockData.js';

const router = express.Router();

/**
 * POST /api/ai/ocr-scan
 * Analyzes photo/snapshot of device label or barcode using Gemini Vision.
 * Automatically matches model in BOQ catalog and pre-populates registration form.
 */
router.post('/ocr-scan', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'imageBase64 string is required.' });
    }

    const scanResult = await scanDeviceLabel(imageBase64, mimeType, mockBoqModels);
    
    // Attach matching category metadata
    let category = null;
    if (scanResult.matched_model) {
      category = mockCategories.find((c) => c.id === scanResult.matched_model.category_id);
    }

    res.json({
      ...scanResult,
      matched_category: category,
      prefilled_form: {
        boq_model_id: scanResult.matched_model ? scanResult.matched_model.id : null,
        brand: scanResult.extracted.brand || (scanResult.matched_model ? scanResult.matched_model.brand : ''),
        model: scanResult.extracted.model || (scanResult.matched_model ? scanResult.matched_model.model : ''),
        serial_number: scanResult.extracted.serial_number || '',
        mac_address: scanResult.extracted.mac_address || '',
        custom_label_id: generateSuggestedLabel(scanResult.matched_model, scanResult.extracted.serial_number),
        category_name: category ? category.name : '',
        category_name_ku: category ? category.name_ku : '',
        placement_zone: scanResult.matched_model?.is_rack_mounted
          ? 'rack'
          : scanResult.matched_model?.allowed_zones[0] || 'indoor',
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function generateSuggestedLabel(matchedModel, serial) {
  if (!matchedModel) return `DEV-${Math.floor(100 + Math.random() * 900)}`;
  const prefix = matchedModel.brand.substring(0, 3).toUpperCase();
  const modelPart = matchedModel.model.replace(/[^A-Za-z0-9]/g, '').substring(0, 4).toUpperCase();
  const suffix = serial ? serial.slice(-4).toUpperCase() : Math.floor(10 + Math.random() * 90);
  return `${prefix}-${modelPart}-${suffix}`;
}

/**
 * POST /api/ai/troubleshoot
 * Context-aware RAG Troubleshooting assistant.
 */
router.post('/troubleshoot', async (req, res) => {
  try {
    const { query, device_id } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Troubleshooting query is required.' });
    }

    let device = null;
    let boqModel = null;

    if (device_id) {
      device = mockDevices.find((d) => d.id === device_id);
      if (device) {
        boqModel = mockBoqModels.find((m) => m.id === device.boq_model_id);
      }
    } else {
      // Auto-detect device from query text (e.g. "TSW-770" or "LPR" or "AP-GF-01")
      const qLower = query.toLowerCase();
      device = mockDevices.find(
        (d) =>
          qLower.includes(d.custom_label_id.toLowerCase()) ||
          (d.ip_address && qLower.includes(d.ip_address))
      );
      if (device) {
        boqModel = mockBoqModels.find((m) => m.id === device.boq_model_id);
      } else {
        boqModel = mockBoqModels.find(
          (m) => qLower.includes(m.model.toLowerCase()) || qLower.includes(m.brand.toLowerCase())
        );
      }
    }

    const result = await troubleshootIssue({
      query,
      device,
      boqModel,
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

