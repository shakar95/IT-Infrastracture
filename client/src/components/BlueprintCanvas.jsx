import React, { useState, useEffect, useRef } from 'react';
import { ensurePdfJs, isPdfDocument } from '../utils/pdfEngine';

export default function BlueprintCanvas({
  activePlan,
  zoom = 1,
  onDimensionsReady,
}) {
  const canvasRef = useRef(null);
  const [isPdf, setIsPdf] = useState(false);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [pdfDoc, setPdfDoc] = useState(null);
  const lastRenderedZoomRef = useRef(null);
  const renderTaskRef = useRef(null);

  const imageUrl = activePlan?.image_url;

  // Detect whether blueprint is a vector PDF or image
  useEffect(() => {
    const isDocPdf = isPdfDocument(imageUrl);
    setIsPdf(isDocPdf);
    if (!isDocPdf) {
      setPdfDoc(null);
    }
  }, [imageUrl]);

  // Handle standard raster image blueprint (PNG / JPG / WebP)
  useEffect(() => {
    if (!imageUrl || isPdf) return;

    const img = new Image();
    img.onload = () => {
      const nw = img.naturalWidth || 2400;
      const nh = img.naturalHeight || 1600;
      // High-resolution coordinate space (2400 - 5200px) so browser GPU preserves full detail
      const targetWidth = Math.min(Math.max(nw, 2400), 5200);
      const targetHeight = Math.round((nh / nw) * targetWidth);
      if (onDimensionsReady) {
        onDimensionsReady(targetWidth, targetHeight);
      }
    };
    img.src = imageUrl;
  }, [imageUrl, isPdf, onDimensionsReady]);

  // Load vector PDF document with PDF.js
  useEffect(() => {
    if (!imageUrl || !isPdf) return;

    let isCancelled = false;
    const loadPdf = async () => {
      try {
        setIsLoadingPdf(true);
        const pdfLib = await ensurePdfJs();
        if (!pdfLib || isCancelled) return;

        let loadingTask;
        if (imageUrl.startsWith('data:')) {
          // Base64 data URL
          const base64Data = imageUrl.split(',')[1] || imageUrl;
          const binaryStr = window.atob(base64Data);
          const len = binaryStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          loadingTask = pdfLib.getDocument({ data: bytes.buffer });
        } else {
          // Remote or local URL
          loadingTask = pdfLib.getDocument({ url: imageUrl });
        }

        const doc = await loadingTask.promise;
        if (isCancelled) return;
        setPdfDoc(doc);

        // Fetch page 1 base dimensions
        const page = await doc.getPage(1);
        const unscaled = page.getViewport({ scale: 1.0 });
        const targetWidth = Math.min(Math.max(unscaled.width * 2.5, 2400), 5200);
        const targetHeight = Math.round((unscaled.height / unscaled.width) * targetWidth);

        if (onDimensionsReady) {
          onDimensionsReady(targetWidth, targetHeight);
        }
      } catch (err) {
        console.error('Failed to load vector PDF blueprint in map canvas:', err);
      } finally {
        if (!isCancelled) setIsLoadingPdf(false);
      }
    };

    loadPdf();

    return () => {
      isCancelled = true;
    };
  }, [imageUrl, isPdf, onDimensionsReady]);

  // Render vector PDF onto canvas with dynamic scale
  useEffect(() => {
    if (!pdfDoc || !isPdf || !canvasRef.current) return;

    let isCancelled = false;

    const renderVectorPage = async () => {
      try {
        const page = await pdfDoc.getPage(1);
        const unscaled = page.getViewport({ scale: 1.0 });

        // Calculate vector scale: ensure minimum 3.0x scale (300+ DPI equivalent for CAD text)
        // Scale dynamically with zoom so text remains 100% crisp at any zoom level!
        const vectorScale = Math.min(4.5, Math.max(3.0, (zoom || 1) * 2.0));

        if (lastRenderedZoomRef.current === vectorScale) return;
        lastRenderedZoomRef.current = vectorScale;

        const viewport = page.getViewport({ scale: vectorScale });
        const canvas = canvasRef.current;
        if (!canvas || isCancelled) return;

        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext('2d', { alpha: false });

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Cancel previous render task if active
        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch {
            // ignore cancel error
          }
        }

        renderTaskRef.current = page.render({
          canvasContext: ctx,
          viewport,
          intent: 'print',
        });

        await renderTaskRef.current.promise;
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('PDF vector page render error:', err);
        }
      }
    };

    // Debounce rendering slightly when zoom changes so dragging/zooming stays 60fps smooth
    const timer = setTimeout(renderVectorPage, 120);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [pdfDoc, isPdf, zoom]);

  if (isPdf) {
    return (
      <div className="relative w-full h-full bg-white flex items-center justify-center">
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            imageRendering: '-webkit-optimize-contrast',
          }}
          className="pointer-events-none select-none block"
        />
        {isLoadingPdf && (
          <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center">
            <div className="flex items-center gap-2 text-xs font-semibold text-blue-600 font-mono">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <span>Rendering PDF Vector Engine (Direct CAD Clarity)...</span>
            </div>
          </div>
        )}
      </div>
    );
  }

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
