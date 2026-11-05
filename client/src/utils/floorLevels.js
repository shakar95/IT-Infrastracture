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
