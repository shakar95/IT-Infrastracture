/**
 * Architectural PDF Vector Engine for Iraq Sitak Villa IT/ELV Infrastructure
 * Provides crystal-clear, zero-degradation vector PDF rendering with PDF.js
 */

export const ensurePdfJs = async () => {
  if (typeof window === 'undefined') return null;
  if (window.pdfjsLib) {
    if (!window.pdfjsLib.GlobalWorkerOptions?.workerSrc) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }
    return window.pdfjsLib;
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      } else {
        reject(new Error('PDF.js failed to initialize'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load PDF vector engine script from CDN'));
    document.head.appendChild(script);
  });
};

/**
 * Check if a URL or base64 string is a PDF document
 */
export function isPdfDocument(urlOrData) {
  if (!urlOrData || typeof urlOrData !== 'string') return false;
  return (
    urlOrData.startsWith('data:application/pdf') ||
    urlOrData.toLowerCase().includes('.pdf') ||
    (urlOrData.startsWith('blob:') && urlOrData.includes('pdf'))
  );
}

/**
 * Renders a PDF page to ultra-high-resolution lossless PNG
 * Uses scale 3.5 - 4.5 and PNG encoding so CAD text & fine line dimensions never blur!
 */
export async function renderPdfToHighResPng(pdfDoc, pageNum = 1, maxDimension = 5400) {
  const page = await pdfDoc.getPage(pageNum);
  const unscaled = page.getViewport({ scale: 1.0 });

  // Calculate high-DPI vector scale (aim for 300+ DPI equivalent for razor-sharp CAD text)
  const maxUnscaledDim = Math.max(unscaled.width, unscaled.height);
  const calculatedScale = Math.min(4.5, maxDimension / maxUnscaledDim);
  const safeScale = Math.max(2.5, calculatedScale);

  const viewport = page.getViewport({ scale: safeScale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d', { alpha: false });

  // Solid clean white background for blueprint line contrast
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({
    canvasContext: ctx,
    viewport,
    intent: 'print', // Higher vector accuracy for CAD drawings
  }).promise;

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width: canvas.width,
    height: canvas.height,
    aspectRatio: unscaled.width / unscaled.height,
    unscaledWidth: unscaled.width,
    unscaledHeight: unscaled.height,
  };
}

/**
 * Directly renders a vector PDF page onto an HTML5 Canvas at target pixel density
 */
export async function renderPdfToCanvasElement(pdfDocOrUrl, pageNum = 1, canvasEl, targetScale = 3.0) {
  if (!canvasEl) return null;
  const pdfLib = await ensurePdfJs();

  let pdfDoc = pdfDocOrUrl;
  if (typeof pdfDocOrUrl === 'string') {
    const loadingTask = pdfLib.getDocument(pdfDocOrUrl);
    pdfDoc = await loadingTask.promise;
  }

  const page = await pdfDoc.getPage(pageNum);
  const unscaled = page.getViewport({ scale: 1.0 });
  const viewport = page.getViewport({ scale: targetScale });

  canvasEl.width = Math.ceil(viewport.width);
  canvasEl.height = Math.ceil(viewport.height);
  const ctx = canvasEl.getContext('2d', { alpha: false });

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);

  await page.render({
    canvasContext: ctx,
    viewport,
    intent: 'print',
  }).promise;

  return {
    width: canvasEl.width,
    height: canvasEl.height,
    aspectRatio: unscaled.width / unscaled.height,
  };
}
