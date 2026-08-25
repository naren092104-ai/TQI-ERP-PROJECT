import React, { useState, useRef, useEffect } from 'react';
import { checkImageClarity, scanBillAndExtractDetails, ClarityCheckResult, ExtractedBillData } from '../utils/billParser';
import {
  Camera,
  UploadCloud,
  FileText,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Check,
  X,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Crop,
  Layers,
  Sliders,
  ScanLine
} from 'lucide-react';
import { ActionButton } from './ui/action-button';

export interface BillAttachment {
  url: string;
  fileName: string;
  detectedAmount?: number;
  isVerified?: boolean;
  origin?: string;
  destination?: string;
  count?: number;
  quality?: string;
}

interface BillScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  expectedAmount?: number;
  categoryLabel?: string;
  onAttachBill: (bill: BillAttachment, extractedData?: ExtractedBillData) => void;
}

export const BillScannerModal: React.FC<BillScannerModalProps> = ({
  isOpen,
  onClose,
  expectedAmount = 0,
  categoryLabel = 'Expense',
  onAttachBill,
}) => {
  const [mode, setMode] = useState<'camera' | 'upload' | 'samples'>('camera');
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [detectedAmount, setDetectedAmount] = useState<number>(expectedAmount || 0);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scannerFilter, setScannerFilter] = useState<'clear' | 'bw' | 'original'>('clear');
  
  // Clarity & OCR State
  const [clarityResult, setClarityResult] = useState<ClarityCheckResult | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedBillData | null>(null);
  const [clarityWarning, setClarityWarning] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sample realistic bills for testing
  const sampleBills = [
    {
      title: 'Bus Ticket (KSR College → Salem)',
      category: 'Travel',
      amount: 200,
      from: 'KSR College',
      to: 'Salem',
      url: 'https://images.unsplash.com/photo-1554415707-9e49fe74a6d0?w=600&auto=format&fit=crop&q=80',
    },
    {
      title: 'Bus Ticket (Dharmapuri → Pennagaram)',
      category: 'Travel',
      amount: 60,
      from: 'Dharmapuri',
      to: 'Pennagaram',
      url: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&auto=format&fit=crop&q=80',
    },
    {
      title: 'Restaurant Lunch Receipt',
      category: 'Food',
      amount: 1000,
      url: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=600&auto=format&fit=crop&q=80',
    },
    {
      title: 'Stationery Store Cash Memo',
      category: 'Stationery',
      amount: 450,
      url: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?w=600&auto=format&fit=crop&q=80',
    },
  ];

  // Start Camera
  const startCamera = async () => {
    setCameraError(null);
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setCameraActive(true);
      } else {
        setCameraError('Camera API is not supported in this browser environment. You can upload an image or choose a sample bill.');
      }
    } catch (err: any) {
      console.warn('Camera access error:', err);
      setCameraError('Could not access camera. Please upload a file or select a sample receipt.');
      setCameraActive(false);
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Lifecycle
  useEffect(() => {
    if (isOpen) {
      setDetectedAmount(expectedAmount || 0);
      setCapturedImage(null);
      setClarityResult(null);
      setExtractedData(null);
      setClarityWarning(null);
      if (mode === 'camera') {
        startCamera();
      }
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, mode]);

  // Capture from live video stream
  const handleCapture = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      stopCamera();
      processScannedImage(dataUrl, `captured_receipt_${Date.now()}.jpg`);
    }
  };

  // Handle local file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      processScannedImage(dataUrl, file.name);
    };
    reader.readAsDataURL(file);
  };

  // Select sample receipt
  const handleSelectSample = (sample: typeof sampleBills[0]) => {
    processScannedImage(sample.url, `${sample.title.replace(/\s+/g, '_')}.jpg`, sample);
  };

  // Process and run clear-scan OCR detection
  const processScannedImage = async (
    imageUrl: string,
    name: string,
    sampleMeta?: { amount: number; from?: string; to?: string; category?: string }
  ) => {
    setCapturedImage(imageUrl);
    setFileName(name);
    setIsScanning(true);
    setClarityWarning(null);

    // 1. Check Clarity Quality
    try {
      const clarity = await checkImageClarity(imageUrl);
      setClarityResult(clarity);
      if (!clarity.isClear) {
        setClarityWarning(
          `Image sharpness score is ${clarity.score}/100. Text may be blurry. Please ensure lighting is bright.`
        );
      }
    } catch (err) {
      console.warn('Clarity check failed:', err);
    }

    // 2. Perform OCR Extraction & Route Parsing
    try {
      const ocrResult = await scanBillAndExtractDetails(imageUrl);
      setIsScanning(false);
      setExtractedData(ocrResult);

      if (sampleMeta && sampleMeta.amount) {
        setDetectedAmount(sampleMeta.amount);
      } else if (ocrResult.amount && ocrResult.amount > 0) {
        setDetectedAmount(ocrResult.amount);
      } else if (expectedAmount && expectedAmount > 0) {
        setDetectedAmount(expectedAmount);
      }
    } catch (err) {
      console.warn('OCR Scan failed:', err);
      setIsScanning(false);
      if (sampleMeta?.amount) {
        setDetectedAmount(sampleMeta.amount);
      }
    }
  };

  // Confirm Attachment
  const handleConfirm = () => {
    if (!capturedImage) return;

    const finalAttachment: BillAttachment = {
      url: capturedImage,
      fileName: fileName || 'scanned_receipt.jpg',
      detectedAmount: detectedAmount,
      isVerified: clarityResult?.isClear ?? true,
      origin: extractedData?.origin,
      destination: extractedData?.destination,
      count: extractedData?.count,
      quality: clarityResult?.quality || 'High',
    };

    onAttachBill(finalAttachment, extractedData || undefined);
    stopCamera();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-gray-950/85 backdrop-blur-sm animate-in fade-in-0 duration-200">
      <div className="relative w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-white dark:bg-gray-900">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-950/40 dark:text-brand-400">
              <ScanLine className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                Clear Scanner &amp; OCR Receipt Capture
              </h2>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Target: {categoryLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Source Mode Tabs */}
        {!capturedImage && (
          <div className="grid grid-cols-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-white/[0.02] text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setMode('camera');
                startCamera();
              }}
              className={`py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                mode === 'camera'
                  ? 'border-brand-500 text-brand-500 dark:text-brand-400'
                  : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              <Camera className="h-3.5 w-3.5" />
              Live Camera
            </button>
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setMode('upload');
              }}
              className={`py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                mode === 'upload'
                  ? 'border-brand-500 text-brand-500 dark:text-brand-400'
                  : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              <UploadCloud className="h-3.5 w-3.5" />
              Upload Image
            </button>
            <button
              type="button"
              onClick={() => {
                stopCamera();
                setMode('samples');
              }}
              className={`py-2.5 flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
                mode === 'samples'
                  ? 'border-brand-500 text-brand-500 dark:text-brand-400'
                  : 'border-transparent text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Sample Receipts
            </button>
          </div>
        )}

        {/* Content Body */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {/* 1. Upload File Mode */}
          {mode === 'upload' && !capturedImage && (
            <div className="space-y-4 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={handleFileUpload}
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 dark:border-gray-700 hover:border-brand-500 rounded-2xl p-8 bg-gray-50/50 hover:bg-brand-50/10 transition-colors cursor-pointer flex flex-col items-center justify-center gap-3"
              >
                <div className="w-12 h-12 rounded-2xl bg-brand-50 dark:bg-brand-950/40 text-brand-500 flex items-center justify-center">
                  <UploadCloud className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Click or Drop Ticket / Bill Photo</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Clear photos only (JPG, PNG, WEBP)</p>
                  <p className="text-[11px] text-brand-500 font-semibold mt-1">
                    ✨ Automatic Route (From → To) &amp; Amount Detection
                  </p>
                </div>
                <button
                  type="button"
                  className="mt-2 px-4 py-1.5 bg-brand-500 text-white text-xs font-semibold rounded-xl shadow-theme-xs hover:bg-brand-600 cursor-pointer"
                >
                  Browse Image
                </button>
              </div>
            </div>
          )}

          {/* 2. Live Camera Mode with Clear Scanner Viewport */}
          {mode === 'camera' && !capturedImage && (
            <div className="space-y-4">
              {cameraError ? (
                <div className="p-5 bg-warning-50/50 border border-warning-200 rounded-2xl text-center space-y-3 dark:bg-warning-950/20 dark:border-warning-900/40">
                  <AlertTriangle className="h-8 w-8 text-warning-500 mx-auto" />
                  <p className="text-xs text-warning-800 dark:text-warning-300 font-medium">{cameraError}</p>
                  <div className="flex justify-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setMode('upload')}
                      className="px-3.5 py-1.5 bg-brand-500 text-white rounded-xl text-xs font-semibold shadow-theme-xs hover:bg-brand-600 cursor-pointer"
                    >
                      Upload Bill Image
                    </button>
                    <button
                      type="button"
                      onClick={() => setMode('samples')}
                      className="px-3.5 py-1.5 border border-gray-200 bg-white text-gray-700 rounded-xl text-xs font-semibold shadow-theme-xs hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300 cursor-pointer"
                    >
                      Use Sample Bill
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative bg-black rounded-2xl overflow-hidden aspect-[4/3] flex items-center justify-center shadow-inner group">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />

                  {/* Clear Scanner Edge Detection Reticle Overlay */}
                  <div className="absolute inset-5 border border-brand-400/60 rounded-xl pointer-events-none flex flex-col justify-between p-2 shadow-[0_0_15px_rgba(22,137,254,0.3)]">
                    {/* Top edge handles */}
                    <div className="flex justify-between">
                      <span className="w-5 h-5 border-t-3 border-l-3 border-brand-400 rounded-tl-sm"></span>
                      <span className="w-5 h-5 border-t-3 border-r-3 border-brand-400 rounded-tr-sm"></span>
                    </div>

                    {/* Laser Scan Sweeping Line Animation */}
                    <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-brand-400 to-transparent shadow-[0_0_8px_#1689fe] animate-pulse" />

                    <div className="text-center">
                      <span className="px-3 py-1 bg-black/70 backdrop-blur-xs text-brand-300 rounded-full text-[10px] font-bold tracking-wider uppercase border border-brand-400/30">
                        Align Bill Inside Scanner Frame
                      </span>
                    </div>

                    {/* Bottom edge handles */}
                    <div className="flex justify-between">
                      <span className="w-5 h-5 border-b-3 border-l-3 border-brand-400 rounded-bl-sm"></span>
                      <span className="w-5 h-5 border-b-3 border-r-3 border-brand-400 rounded-br-sm"></span>
                    </div>
                  </div>
                </div>
              )}

              {cameraActive && !cameraError && (
                <div className="flex justify-center pt-1">
                  <ActionButton
                    onClick={handleCapture}
                    size="default"
                    variant="primary"
                    icon={<Camera size={16} />}
                  >
                    Scan &amp; Capture Bill
                  </ActionButton>
                </div>
              )}
            </div>
          )}

          {/* 3. Sample Bills Mode */}
          {mode === 'samples' && !capturedImage && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold">
                Select a verified sample ticket / bill for instant scanning:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sampleBills.map((sample, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectSample(sample)}
                    className="p-3 border border-gray-200 dark:border-gray-800 rounded-2xl hover:border-brand-500 hover:bg-brand-50/10 dark:hover:bg-brand-950/20 transition-all cursor-pointer flex items-center gap-3 group"
                  >
                    <img
                      src={sample.url}
                      alt={sample.title}
                      className="w-12 h-12 rounded-xl object-cover border border-gray-200 dark:border-gray-800 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-gray-900 dark:text-white truncate group-hover:text-brand-500">
                        {sample.title}
                      </h4>
                      <p className="text-[11px] text-gray-400">{sample.category}</p>
                      <p className="text-xs font-mono font-bold text-success-600">₹{sample.amount}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-brand-500 shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Preview & OCR Clear Scanner Results */}
          {capturedImage && (
            <div className="space-y-4">
              {/* Document Filter Controls (Clear Scanner / High Contrast / Original) */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setScannerFilter('clear')}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${
                      scannerFilter === 'clear'
                        ? 'bg-white dark:bg-gray-700 text-brand-500 shadow-theme-xs'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    Clear Scan
                  </button>
                  <button
                    type="button"
                    onClick={() => setScannerFilter('bw')}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${
                      scannerFilter === 'bw'
                        ? 'bg-white dark:bg-gray-700 text-brand-500 shadow-theme-xs'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    B&amp;W Doc
                  </button>
                  <button
                    type="button"
                    onClick={() => setScannerFilter('original')}
                    className={`px-2.5 py-1 rounded-lg transition-colors ${
                      scannerFilter === 'original'
                        ? 'bg-white dark:bg-gray-700 text-brand-500 shadow-theme-xs'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    Original
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setCapturedImage(null);
                    setClarityResult(null);
                    setExtractedData(null);
                    if (mode === 'camera') startCamera();
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retake
                </button>
              </div>

              {/* Scanned Document Canvas */}
              <div className="relative bg-gray-900 rounded-2xl overflow-hidden max-h-[220px] flex items-center justify-center border border-gray-800">
                <img
                  src={capturedImage}
                  alt="Scanned Bill"
                  className={`max-h-[220px] w-auto object-contain transition-all ${
                    scannerFilter === 'clear'
                      ? 'contrast-125 brightness-105'
                      : scannerFilter === 'bw'
                      ? 'grayscale contrast-150'
                      : ''
                  }`}
                />
                {isScanning && (
                  <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-2">
                    <Sparkles className="h-6 w-6 animate-spin text-brand-400" />
                    <p className="text-xs font-bold">Scanning &amp; Reading Document Details...</p>
                  </div>
                )}
              </div>

              {/* Clarity Quality Badge */}
              {clarityResult && (
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                    clarityResult.isClear
                      ? 'bg-success-50 border-success-200 text-success-700 dark:bg-success-950/30 dark:border-success-900/40 dark:text-success-400'
                      : 'bg-error-50 border-error-200 text-error-700 dark:bg-error-950/30 dark:border-error-900/40 dark:text-error-400'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {clarityResult.isClear ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-success-600" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-error-600" />
                    )}
                    <span className="font-semibold">
                      {clarityResult.isClear
                        ? `Document Clarity: High Resolution (${clarityResult.quality})`
                        : 'Image Quality Warning (Blurry)'}
                    </span>
                  </div>
                  <span className="font-mono text-[11px] opacity-75">
                    {clarityResult.width}×{clarityResult.height}px
                  </span>
                </div>
              )}

              {/* Auto-extracted Travel Route */}
              {extractedData && (extractedData.origin || extractedData.destination) && (
                <div className="p-3 bg-brand-50/50 border border-brand-200 rounded-xl space-y-1.5 text-xs dark:bg-brand-950/20 dark:border-brand-900/40">
                  <div className="font-bold text-brand-600 dark:text-brand-400 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Auto-Extracted Travel Route</span>
                  </div>
                  <div className="flex items-center gap-2 font-bold text-gray-900 dark:text-white">
                    <span className="bg-white dark:bg-gray-800 px-2 py-0.5 rounded-lg border border-gray-200 dark:border-gray-700">
                      {extractedData.origin || 'Origin'}
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-brand-500" />
                    <span className="bg-white dark:bg-gray-800 px-2 py-0.5 rounded-lg border border-gray-200 dark:border-gray-700">
                      {extractedData.destination || 'Destination'}
                    </span>
                  </div>
                </div>
              )}

              {/* Verified Amount Box */}
              <div className="p-3.5 bg-gray-50/70 dark:bg-white/[0.02] border border-gray-200 dark:border-gray-800 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-success-600" />
                    <span>Scanned Bill Amount (₹)</span>
                  </span>
                  <span className="text-[11px] font-mono text-gray-400 truncate max-w-[180px]">{fileName}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                      Detected Amount
                    </label>
                    <input
                      type="number"
                      value={detectedAmount}
                      onChange={(e) => setDetectedAmount(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-sm font-mono font-bold text-gray-900 shadow-theme-xs focus:border-brand-500 focus:outline-none dark:border-gray-800 dark:bg-gray-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
                      Assigned To
                    </label>
                    <div className="rounded-xl border border-gray-200 bg-white/70 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300 truncate">
                      {categoryLabel}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900 flex items-center justify-between">
          {capturedImage ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setCapturedImage(null);
                  setClarityResult(null);
                  setExtractedData(null);
                  if (mode === 'camera') startCamera();
                }}
                className="px-3.5 py-2 text-gray-600 hover:bg-gray-100 rounded-xl text-xs font-semibold flex items-center gap-1 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retake
              </button>
              <ActionButton
                onClick={handleConfirm}
                size="sm"
                variant="primary"
                icon={<Check size={15} />}
              >
                Attach Scanned Bill
              </ActionButton>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="ml-auto px-4 py-2 border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 rounded-xl text-xs font-semibold dark:border-gray-800 dark:bg-gray-800 dark:text-gray-300 shadow-theme-xs"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
