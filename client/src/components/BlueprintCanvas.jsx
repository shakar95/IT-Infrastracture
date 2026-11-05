import React, { useState, useEffect, useRef } from 'react';
import { ensurePdfJs, isPdfDocument } from '../utils/pdfEngine';

// Global in-memory cache to guarantee each PDF URL is fetched AT MOST ONCE
const pdfDocumentCache = new Map();
const renderedPageCache = new Map();

export default function BlueprintCanvas({
  activePlan,
  onDimensionsReady,
}) {
  const canvasRef = useRef(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const [renderedDataUrl, setRenderedDataUrl] = useState(null);

  const imageUrl = activePlan?.image_url;
  const isPdf = isPdfDocument(imageUrl);

  // Keep a stable ref to onDimensionsReady to NEVER trigger effect re-runs
  const onDimensionsReadyRef = useRef(onDimensionsReady);
  useEffect(() => {
    onDimensionsReadyRef.current = onDimensionsReady;
  });

  // Track the last successfully processed URL to avoid re-running work
  const lastProcessedUrlRef = useRef(null);

  // 1. Handle Raster Images (PNG, JPG, WebP, SVG, data:image/...)
  useEffect(() => {
    if (!imageUrl || isPdf) return;
    if (lastProcessedUrlRef.current === imageUrl) return;
    lastProcessedUrlRef.current = imageUrl;

    const img = new Image();
    img.onload = () => {
      const nw = img.naturalWidth || 2400;
      const nh = img.naturalHeight || 1600;
      // High-resolution coordinate space (2400 - 5200px) for razor-sharp zoom
      const targetWidth = Math.min(Math.max(nw, 2400), 5200);
      const targetHeight = Math.round((nh / nw) * targetWidth);

      if (onDimensionsReadyRef.current) {
        onDimensionsReadyRef.current(targetWidth, targetHeight);
      }
    };
    img.onerror = (e) => {
      console.warn('Failed to load blueprint raster image:', e);
    };
    img.src = imageUrl;
  }, [imageUrl, isPdf]);

  // 2. Handle Vector PDF Documents (Renders ONCE at 300+ DPI equivalent, cached forever)
  useEffect(() => {
    if (!imageUrl || !isPdf) {
      setRenderedDataUrl(null);
      setPdfError(null);
      setIsLoadingPdf(false);
      return;
    }

    // Check if we already rendered this exact PDF URL
    if (renderedPageCache.has(imageUrl)) {
      const cached = renderedPageCache.get(imageUrl);
      setRenderedDataUrl(cached.dataUrl);
      setIsLoadingPdf(false);
      setPdfError(null);
      lastProcessedUrlRef.current = imageUrl;
      if (onDimensionsReadyRef.current) {
        onDimensionsReadyRef.current(cached.width, cached.height);
      }
      return;
    }

    if (lastProcessedUrlRef.current === imageUrl) return;
    lastProcessedUrlRef.current = imageUrl;

    let isCancelled = false;
    setIsLoadingPdf(true);
    setPdfError(null);

    const loadAndRenderPdf = async () => {
      try {
        const pdfLib = await ensurePdfJs();
        if (!pdfLib || isCancelled) return;

        // Retrieve or start document loading promise (cached so network fetch happens once)
        let docPromise = pdfDocumentCache.get(imageUrl);
        if (!docPromise) {
          if (imageUrl.startsWith('data:')) {
            const base64Data = imageUrl.split(',')[1] || imageUrl;
            const binaryStr = window.atob(base64Data);
            const len = binaryStr.length;
            const bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            docPromise = pdfLib.getDocument({ data: bytes.buffer }).promise;
          } else {
            docPromise = pdfLib.getDocument({
              url: imageUrl,
              withCredentials: false,
              isEvalSupported: false,
            }).promise;
          }
          pdfDocumentCache.set(imageUrl, docPromise);
        }

        const pdfDoc = await docPromise;
        if (isCancelled) return;

        // Fetch page 1
        const page = await pdfDoc.getPage(1);
        const unscaled = page.getViewport({ scale: 1.0 });

        // Vector Scale: 3.2x to 4.0x delivers 300+ DPI equivalent for CAD drawings
        const maxUnscaledDim = Math.max(unscaled.width, unscaled.height);
        const targetScale = Math.min(4.0, Math.max(2.5, 4500 / maxUnscaledDim));
        const viewport = page.getViewport({ scale: targetScale });

        // Target map coordinate width & height
        const targetWidth = Math.min(Math.max(unscaled.width * 2.5, 2400), 5200);
        const targetHeight = Math.round((unscaled.height / unscaled.width) * targetWidth);

        // Offscreen high-DPI canvas render
        const offCanvas = document.createElement('canvas');
        offCanvas.width = Math.ceil(viewport.width);
        offCanvas.height = Math.ceil(viewport.height);
        const ctx = offCanvas.getContext('2d', { alpha: false });

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);

        await page.render({
          canvasContext: ctx,
          viewport,
          intent: 'print',
        }).promise;

        if (isCancelled) return;

        // Generate lossless PNG data URL to display via GPU-accelerated <img>
        const pngDataUrl = offCanvas.toDataURL('image/png');

        // Save in memory cache
        renderedPageCache.set(imageUrl, {
          dataUrl: pngDataUrl,
          width: targetWidth,
          height: targetHeight,
        });

        setRenderedDataUrl(pngDataUrl);
        setIsLoadingPdf(false);

        if (onDimensionsReadyRef.current) {
          onDimensionsReadyRef.current(targetWidth, targetHeight);
        }
      } catch (err) {
        console.error('PDF vector engine render failure:', err);
        if (!isCancelled) {
          setPdfError(err.message || 'Failed to render PDF vector drawing');
          setIsLoadingPdf(false);
        }
      }
    };

    loadAndRenderPdf();

    return () => {
      isCancelled = true;
    };
  }, [imageUrl, isPdf]);

  // Display Vector PDF via high-res lossless raster
  if (isPdf) {
    if (pdfError) {
      return (
        <div className="w-full h-full min-h-[360px] bg-slate-900 border border-red-500/30 rounded-xl flex flex-col items-center justify-center p-6 text-center">
          <p className="text-sm font-bold text-red-400 mb-1">کێشە لە خوێندنەوەی فایلی PDF نەخشەکە هەیە</p>
          <p className="text-xs text-slate-400 font-mono max-w-md mb-4">{pdfError}</p>
          <button
            onClick={() => {
              pdfDocumentCache.delete(imageUrl);
              renderedPageCache.delete(imageUrl);
              lastProcessedUrlRef.current = null;
              window.location.reload();
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white"
          >
            دووبارە تاقیکردنەوە (Retry)
          </button>
        </div>
      );
    }

    if (isLoadingPdf && !renderedDataUrl) {
      return (
        <div className="w-full h-full min-h-[400px] bg-slate-950 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-blue-400 font-mono">
            خەریکی بارکردنی نەخشەی ڤێکتەری PDF بە کوالێتی بەرز...
          </p>
        </div>
      );
    }

    return (
      <img
        src={renderedDataUrl || imageUrl}
        alt={activePlan?.name || 'Blueprint PDF'}
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          imageRendering: '-webkit-optimize-contrast',
        }}
        className="pointer-events-none select-none block"
      />
    );
  }

  // Display Standard Raster Blueprint (PNG / JPG / WebP)
  return (
    <img
      src={imageUrl}
      alt={activePlan?.name || 'Blueprint'}
      draggable={false}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        imageRendering: '-webkit-optimize-contrast',
      }}
      className="pointer-events-none select-none block"
    />
  );
}
