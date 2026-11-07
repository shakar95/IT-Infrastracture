/**
 * Placement Guardrail Service for Iraq Sitak Villa Project
 * AI check and restrictive placement blocking have been removed per user preference.
 * Users now have full freedom to pin any device to any location or floor plan.
 */

export class GuardrailError extends Error {
  constructor(messageEn, messageKu, code, details = {}) {
    super(messageEn);
    this.name = 'GuardrailError';
    this.message_en = messageEn;
    this.message_ku = messageKu;
    this.code = code;
    this.details = details;
  }
}

/**
 * Validates device placement (now completely non-blocking to allow full placement freedom).
 */
export function validateDeviceGuardrails(deviceData, modelData, floorPlan, existingDevices = []) {
  // All restrictive placement blocking / AI check disabled per user request
  return true;
}

