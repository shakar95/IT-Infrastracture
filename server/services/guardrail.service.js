/**
 * Smart Placement Guardrail Service for Iraq Sitak Villa Project
 * Enforces strict IT/ELV physical & logical constraints with bilingual (Kurdish/English) alerts.
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
 * Validates device placement, IP uniqueness, switch port uniqueness, and rack installation.
 * 
 * @param {Object} deviceData - The device instance being created or updated
 * @param {Object} modelData - The parent BOQ model definition
 * @param {Object} floorPlan - The target floor plan (if assigned)
 * @param {Array} existingDevices - List of already provisioned devices
 */
export function validateDeviceGuardrails(deviceData, modelData, floorPlan, existingDevices = []) {
  const currentDeviceId = deviceData.id;

  // 1. Rack-Mounted Unit Guardrail
  // If the equipment is rack-mounted (e.g. Televes Avant, Crestron CP4N, Core Switch),
  // it CANNOT be placed outside a Server Rack zone!
  if (modelData?.is_rack_mounted) {
    if (deviceData.placement_zone !== 'rack') {
      throw new GuardrailError(
        `[Smart Guardrail Error]: "${modelData.brand} ${modelData.model}" is a rack-mounted unit (${modelData.rack_unit_size || 1}U) and MUST be installed inside a Server Rack zone!`,
        `[ئاگاداری شوێنی ئامێر]: ئامێری "${modelData.brand} ${modelData.model}" مۆدی ڕاکە (${modelData.rack_unit_size || 1}U) و دەبێت تەنها لە ژووری سێرڤەر و ناو ڕاکدا دابنرێت!`,
        'RACK_PLACEMENT_REQUIRED',
        { brand: modelData.brand, model: modelData.model, attemptedZone: deviceData.placement_zone }
      );
    }

    if (floorPlan && floorPlan.zone_type !== 'rack') {
      throw new GuardrailError(
        `[Smart Guardrail Error]: Rack equipment cannot be placed on non-rack map "${floorPlan.name}"! Please choose the Server Room Rack Elevation plan.`,
        `[هەڵەی نەخشە]: ئامێری ڕاک ناتوانرێت لەسەر نەخشەی "${floorPlan.name_ku || floorPlan.name}" دابنرێت! تکایە نەخشەی ژووری سێرڤەر و ڕاکەکان هەڵبژێرە.`,
        'MAP_ZONE_MISMATCH_RACK',
        { floorPlan: floorPlan.name, mapZone: floorPlan.zone_type }
      );
    }
  }

  // 2. Zone Specification (Indoor vs Outdoor)
  // Indoor / Outdoor specifies physical location and zone tagging without blocking placement.
  // Physical placement on maps adapts to the user's chosen location or target map.

  // 3. Duplicate IP Address Guardrail
  if (deviceData.ip_address && deviceData.ip_address.trim() !== '') {
    const cleanIp = deviceData.ip_address.trim();
    const conflictingDevice = existingDevices.find(
      (d) => d.id !== currentDeviceId && d.ip_address && d.ip_address.trim() === cleanIp
    );

    if (conflictingDevice) {
      throw new GuardrailError(
        `[IP Conflict Alert]: IP Address "${cleanIp}" is already assigned to device "${conflictingDevice.custom_label_id}"! Duplicate IP addresses will cause network failure.`,
        `[دژایەتی ئایپی]: ناونیشانی ئایپی "${cleanIp}" پێشتر بۆ ئامێری "${conflictingDevice.custom_label_id}" دانراوە! نابێت دوو ئامێر هەمان ئایپییان هەبێت.`,
        'DUPLICATE_IP_DETECTED',
        { conflictingDevice: conflictingDevice.custom_label_id, ip: cleanIp }
      );
    }
  }

  // 4. Duplicate Switch Port Guardrail
  if (
    deviceData.switch_name &&
    deviceData.switch_name.trim() !== '' &&
    deviceData.switch_port &&
    deviceData.switch_port.trim() !== ''
  ) {
    const sName = deviceData.switch_name.trim().toLowerCase();
    const sPort = deviceData.switch_port.trim().toLowerCase();

    const conflictingPortDevice = existingDevices.find(
      (d) =>
        d.id !== currentDeviceId &&
        d.switch_name &&
        d.switch_port &&
        d.switch_name.trim().toLowerCase() === sName &&
        d.switch_port.trim().toLowerCase() === sPort
    );

    if (conflictingPortDevice) {
      throw new GuardrailError(
        `[Switch Port Collision]: Switch "${deviceData.switch_name}" -> "${deviceData.switch_port}" is already patched to "${conflictingPortDevice.custom_label_id}"!`,
        `[دژایەتی پۆرت]: سویچی "${deviceData.switch_name}" پۆرتی "${deviceData.switch_port}" پێشتر بەستراوەتەوە بە ئامێری "${conflictingPortDevice.custom_label_id}"!`,
        'DUPLICATE_SWITCH_PORT',
        { switch: deviceData.switch_name, port: deviceData.switch_port, connectedTo: conflictingPortDevice.custom_label_id }
      );
    }
  }

  return true;
}

