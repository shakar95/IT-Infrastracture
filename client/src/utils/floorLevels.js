/**
 * Architectural Floor Level Translation & Formatting Utility
 * Handles standard architectural levels (-2 to 4+) in Kurdish (Sorani) & English
 */

export const FLOOR_LEVEL_OPTIONS = [
  { level: -2, labelEn: 'Basement 2 (-2)', labelKu: 'ژێرزەمینی دووەم (-2)', shortEn: 'Basement 2', shortKu: 'ژێرزەمین -2' },
  { level: -1, labelEn: 'Basement (-1)', labelKu: 'ژێرزەمین (-1)', shortEn: 'Basement', shortKu: 'ژێرزەمین' },
  { level: 0, labelEn: 'Ground Floor (0)', labelKu: 'قاتی زەمینی (0)', shortEn: 'Ground Floor', shortKu: 'قاتی زەمینی' },
  { level: 1, labelEn: 'First Floor (1)', labelKu: 'قاتی یەکەم (1)', shortEn: '1st Floor', shortKu: 'قاتی ١' },
  { level: 2, labelEn: 'Second Floor (2)', labelKu: 'قاتی دووەم (2)', shortEn: '2nd Floor', shortKu: 'قاتی ٢' },
  { level: 3, labelEn: 'Third Floor (3)', labelKu: 'قاتی سێیەم (3)', shortEn: '3rd Floor', shortKu: 'قاتی ٣' },
  { level: 4, labelEn: 'Roof Top (4)', labelKu: 'سەربان (4)', shortEn: 'Roof Top', shortKu: 'سەربان' },
];

export function formatFloorLevel(level, lang = 'en') {
  if (level === undefined || level === null || level === '') return null;
  const num = Number(level);
  const isKu = lang === 'ku';

  const match = FLOOR_LEVEL_OPTIONS.find((opt) => opt.level === num);
  if (match) {
    return isKu ? match.labelKu : match.labelEn;
  }

  return isKu ? `قاتی ${num}` : `Floor Level ${num}`;
}

export function formatShortFloorLevel(level, lang = 'en') {
  if (level === undefined || level === null || level === '') return null;
  const num = Number(level);
  const isKu = lang === 'ku';

  const match = FLOOR_LEVEL_OPTIONS.find((opt) => opt.level === num);
  if (match) {
    return isKu ? match.shortKu : match.shortEn;
  }

  return isKu ? `قاتی ${num}` : `Floor ${num}`;
}

/**
 * Returns a complete, user-friendly floor plan display label with architectural floor level
 * e.g. "Guest House (Basement -1)", "Main Villa (Ground Floor 0)", "Service Area (Basement -1)"
 */
export function getFloorPlanDisplayLabel(fp, lang = 'en') {
  if (!fp) return '';
  const isKu = lang === 'ku';
  const planName = (isKu ? (fp.name_ku || fp.name) : (fp.name || fp.name_ku)) || (isKu ? 'نەخشە' : 'Floor Plan');

  let floorText = null;
  let floorTextEn = null;

  if (fp.floor_level !== undefined && fp.floor_level !== null && fp.floor_level !== '') {
    floorText = formatFloorLevel(fp.floor_level, lang);
    floorTextEn = formatFloorLevel(fp.floor_level, 'en');
  } else {
    // Intelligent heuristic fallback from plan name
    const combined = `${fp.name || ''} ${fp.name_ku || ''}`.toLowerCase();
    if (combined.includes('basement 2') || combined.includes('ژێرزەمینی دووەم') || combined.includes('-2')) {
      floorText = isKu ? 'ژێرزەمینی دووەم (-2)' : 'Basement 2 (-2)';
      floorTextEn = 'Basement 2 (-2)';
    } else if (combined.includes('basement') || combined.includes('ژێرزەمین') || combined.includes('-1')) {
      floorText = isKu ? 'ژێرزەمین (-1)' : 'Basement (-1)';
      floorTextEn = 'Basement (-1)';
    } else if (combined.includes('ground') || combined.includes('زەمینی') || combined.includes(' (0)')) {
      floorText = isKu ? 'قاتی زەمینی (0)' : 'Ground Floor (0)';
      floorTextEn = 'Ground Floor (0)';
    } else if (combined.includes('first') || combined.includes('1st') || combined.includes('یەکەم') || combined.includes(' (1)')) {
      floorText = isKu ? 'قاتی یەکەم (1)' : 'First Floor (1)';
      floorTextEn = 'First Floor (1)';
    } else if (combined.includes('second') || combined.includes('2nd') || combined.includes('دووەم') || combined.includes(' (2)')) {
      floorText = isKu ? 'قاتی دووەم (2)' : 'Second Floor (2)';
      floorTextEn = 'Second Floor (2)';
    } else if (combined.includes('third') || combined.includes('3rd') || combined.includes('سێیەم') || combined.includes(' (3)')) {
      floorText = isKu ? 'قاتی سێیەم (3)' : 'Third Floor (3)';
      floorTextEn = 'Third Floor (3)';
    } else if (combined.includes('roof') || combined.includes('سەربان') || combined.includes(' (4)')) {
      floorText = isKu ? 'سەربان (4)' : 'Roof Top (4)';
      floorTextEn = 'Roof Top (4)';
    }
  }

  const label = isKu && floorText && floorTextEn && floorText !== floorTextEn
    ? `${floorText} • ${floorTextEn}`
    : (floorText || floorTextEn);

  if (label && !planName.toLowerCase().includes(floorTextEn?.toLowerCase() || '')) {
    return `${planName} (${label})`;
  }

  return planName;
}


