/**
 * Standard Default Hardware Image for BOQ & ELV Equipment
 * Modern dark-slate card with glowing 'ICT' typography and server chip icon
 */

export const DEFAULT_ICT_IMAGE = '/default-ict-device.svg';

export const DEFAULT_ICT_SVG_DATA_URI =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0a0f1d"/>
      <stop offset="50%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <linearGradient id="cyanBlueGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="50%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#6366f1"/>
    </linearGradient>
    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" stroke-width="1" opacity="0.6"/>
      <circle cx="40" cy="40" r="1.5" fill="#38bdf8" opacity="0.25"/>
    </pattern>
  </defs>
  <rect width="800" height="600" fill="url(#bgGrad)"/>
  <rect width="800" height="600" fill="url(#grid)"/>
  <rect x="180" y="110" width="440" height="380" rx="24" fill="#0b1329" stroke="#1e3a8a" stroke-width="2"/>
  <rect x="220" y="150" width="360" height="300" rx="16" fill="#030712" stroke="#1e293b" stroke-width="1.5"/>
  <g transform="translate(368, 185)">
    <rect x="0" y="0" width="64" height="64" rx="14" fill="#1e293b" stroke="#38bdf8" stroke-width="1.5"/>
    <path d="M 16 32 H 48 M 32 16 V 48" stroke="#38bdf8" stroke-width="2" stroke-linecap="round"/>
    <circle cx="32" cy="32" r="5" fill="#38bdf8"/>
  </g>
  <text x="400" y="335" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="82" font-weight="900" fill="url(#cyanBlueGrad)" text-anchor="middle" letter-spacing="8">ICT</text>
  <text x="400" y="375" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="12" font-weight="700" fill="#94a3b8" text-anchor="middle" letter-spacing="4">INFRASTRUCTURE HARDWARE</text>
  <rect x="290" y="405" width="220" height="26" rx="13" fill="#1e293b" stroke="#334155" stroke-width="1"/>
  <circle cx="312" cy="418" r="4" fill="#10b981"/>
  <text x="412" y="422" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="10" font-weight="700" fill="#cbd5e1" text-anchor="middle" letter-spacing="2">DEFAULT ASSET IMAGE</text>
</svg>`
  );

export function getEffectiveProductImage(imageUrl) {
  if (!imageUrl || imageUrl === 'null' || imageUrl === 'undefined') {
    return DEFAULT_ICT_IMAGE;
  }
  // If it was the old unsplash fallback, migrate to modern ICT image
  if (imageUrl.includes('unsplash.com/photo-1544716278-ca5e3f4abd8c')) {
    return DEFAULT_ICT_IMAGE;
  }
  return imageUrl;
}
