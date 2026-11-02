import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Upload,
  CheckCircle2,
  Sparkles,
  RefreshCw,
  Scan,
  Cpu,
  Layers,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { translations } from '../i18n/translations';
import { api } from '../services/api';

export default function AiCameraScanner({
  boqModels = [],
  categories = [],
  onDeviceRegistered,
  lang = 'en',
}) {
  const t = translations[lang] || translations.en;
  const isKu = lang === 'ku';

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Start Camera
  const startCamera = async () => {
    try {
      setErrorMsg(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setIsCameraActive(true);
    } catch (err) {
      console.warn('Camera access error:', err.message);
      setErrorMsg('Camera access was not permitted or is unavailable. You can use the photo upload option below.');
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  // Capture frame from video stream
  const captureFrame = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    setCapturedImage(dataUrl);
    stopCamera();
    analyzeLabel(dataUrl);
  };

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      setCapturedImage(dataUrl);
      analyzeLabel(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // Send photo to Gemini Vision API
  const analyzeLabel = async (base64) => {
    setIsAnalyzing(true);
    setErrorMsg(null);
    setScanResult(null);

    try {
      const result = await api.ocrScanSticker(base64);
      setScanResult(result);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to analyze sticker image.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Fast 1-click confirm provision
  const handleConfirmRegistration = async () => {
    if (!scanResult?.prefilled_form) return;
    const p = scanResult.prefilled_form;

    try {
      await onDeviceRegistered({
        boq_model_id: p.boq_model_id,
        custom_label_id: p.custom_label_id,
        serial_number: p.serial_number,
        mac_address: p.mac_address,
        ip_address: '', // To be configured or DHCP assigned
        subnet_mask: '255.255.255.0',
        gateway: '192.168.10.1',
        vlan_id: 10,
        switch_name: 'SW-CORE-RACK-48P',
        switch_port: '',
        placement_zone: p.placement_zone,
        installation_status: 'Installed',
        notes: `AI Sticker Scanner provisioned (${scanResult.provider})`,
      });

      // Reset
      setScanResult(null);
      setCapturedImage(null);
    } catch (err) {
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
          <Camera className="w-6 h-6 text-amber-400" />
          <span>{t.scannerTitle}</span>
        </h2>
        <p className="text-xs sm:text-sm text-slate-400">{t.scannerSubtitle}</p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-red-950/40 border border-red-800/60 rounded-2xl flex items-center gap-3 text-xs text-red-200">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Camera Viewport / Upload Box */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6">
        <div className="relative aspect-video max-h-[440px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 flex items-center justify-center">
          {/* Live Video Stream */}
          {isCameraActive && (
            <div className="relative w-full h-full">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {/* Animated Target Scanning Reticle */}
              <div className="absolute inset-10 border-2 border-dashed border-blue-400/80 rounded-2xl pointer-events-none flex items-center justify-center">
                <div className="w-16 h-16 border-t-2 border-l-2 border-amber-400 -translate-x-12 -translate-y-12" />
                <div className="w-16 h-16 border-b-2 border-r-2 border-amber-400 translate-x-12 translate-y-12" />
                <span className="text-xs font-mono font-bold bg-slate-900/80 px-2 py-1 rounded text-amber-300">
                  Align Device Serial/MAC Sticker Here
                </span>
              </div>
            </div>
          )}

          {/* Captured Image Display */}
          {!isCameraActive && capturedImage && (
            <div className="relative w-full h-full">
              <img src={capturedImage} alt="Captured Sticker" className="w-full h-full object-contain" />
              {isAnalyzing && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                  <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
                  <p className="text-sm font-semibold text-white">{t.analyzingImage}</p>
                </div>
              )}
            </div>
          )}

          {/* Placeholder / Empty State */}
          {!isCameraActive && !capturedImage && (
            <div className="text-center p-8 space-y-3">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                <Scan className="w-8 h-8 text-slate-500" />
              </div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">{t.cameraPermission}</p>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          {!isCameraActive ? (
            <button
              onClick={startCamera}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/30 transition active:scale-95"
            >
              <Camera className="w-4 h-4" />
              {t.startCamera}
            </button>
          ) : (
            <div className="flex gap-3">
              <button
                onClick={captureFrame}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-lg shadow-amber-900/40 transition active:scale-95"
              >
                <Scan className="w-4 h-4" />
                {t.capturePhoto}
              </button>
              <button
                onClick={stopCamera}
                className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-slate-400 hover:text-white bg-slate-800 transition"
              >
                {t.stopCamera}
              </button>
            </div>
          )}

          {/* Upload Button */}
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition active:scale-95"
            >
              <Upload className="w-4 h-4 text-blue-400" />
              {t.uploadImage}
            </button>
          </div>
        </div>
      </div>

      {/* Auto-Provisioning Result Card (Pre-filled Form) */}
      {scanResult && (
        <div className="p-6 bg-gradient-to-tr from-slate-900 via-slate-900 to-blue-950/40 border border-blue-500/40 rounded-3xl shadow-2xl space-y-5 animate-fadeIn">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-5 h-5" />
              <h3 className="text-base font-bold text-white">{t.scanSuccess}</h3>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono">
              {t.confidence}: {Math.round((scanResult.extracted.confidence_score || 0.95) * 100)}%
            </span>
          </div>

          {/* Matched Model Card */}
          {scanResult.matched_model && (
            <div className="flex items-center gap-4 p-4 bg-slate-950/80 rounded-2xl border border-slate-800">
              <img
                src={scanResult.matched_model.product_image_url}
                alt={scanResult.matched_model.model}
                className="w-16 h-16 rounded-xl object-cover"
              />
              <div className="flex-1">
                <span className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider">
                  {t.matchedModelFound}
                </span>
                <h4 className="text-base font-bold text-white">
                  {scanResult.matched_model.brand} {scanResult.matched_model.model}
                </h4>
                <p className="text-xs text-slate-400">
                  {isKu ? scanResult.matched_category?.name_ku : scanResult.matched_category?.name}
                </p>
              </div>
            </div>
          )}

          {/* Extracted Fields Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">{t.customLabel}</span>
              <span className="text-white font-bold">{scanResult.prefilled_form.custom_label_id}</span>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">{t.serialNumber}</span>
              <span className="text-amber-300 font-bold">{scanResult.prefilled_form.serial_number || '—'}</span>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">{t.macAddress}</span>
              <span className="text-cyan-300 font-bold">{scanResult.prefilled_form.mac_address || '—'}</span>
            </div>
            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
              <span className="text-slate-400 block text-[10px] uppercase">{t.allowedZones}</span>
              <span className="text-blue-300 font-bold">{scanResult.prefilled_form.placement_zone}</span>
            </div>
          </div>

          {/* Confirm Button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={handleConfirmRegistration}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-xl shadow-emerald-950/50 transition active:scale-95"
            >
              <span>{t.confirmAndRegister}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

