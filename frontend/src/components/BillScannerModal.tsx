import React, { useState, useRef, useEffect } from 'react';
import { checkImageClarity, extractRouteAndDetailsFromText, scanBillAndExtractDetails, ClarityCheckResult, ExtractedBillData } from '../utils/billParser';

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

  useEffect(() => {
    if (isOpen && mode === 'camera' && !capturedImage) {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen, mode, capturedImage]);

  // Capture Frame
  const handleCapture = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      processScannedImage(dataUrl, `Camera_Capture_${Date.now()}.jpg`, expectedAmount || 200);
    }
  };

  // Process & Extract Route + Amount with Clarity Check
  const processScannedImage = async (dataUrl: string, origFileName: string, fallbackAmount: number) => {
    setIsScanning(true);
    setClarityWarning(null);
    stopCamera();
    setCapturedImage(dataUrl);
    setFileName(origFileName);

    // 1. Check Clarity first
    const clarity = await checkImageClarity(dataUrl);
    setClarityResult(clarity);

    if (!clarity.isClear) {
      setClarityWarning(clarity.message);
    }

    // 2. Perform OCR & Travel Route Extraction
    try {
      const extracted = await scanBillAndExtractDetails(dataUrl, origFileName);
      setExtractedData(extracted);

      const parsedAmount = extracted.amount || expectedAmount || fallbackAmount;
      setDetectedAmount(parsedAmount);
    } catch (err) {
      const parsed = extractRouteAndDetailsFromText('', origFileName);
      setExtractedData(parsed);
      setDetectedAmount(expectedAmount || fallbackAmount);
    } finally {
      setIsScanning(false);
    }
  };

  // Handle File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (reader.result) {
          processScannedImage(reader.result as string, file.name, expectedAmount || 200);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Select Sample
  const handleSelectSample = (sample: typeof sampleBills[0]) => {
    processScannedImage(sample.url, `${sample.title.replace(/\s+/g, '_')}.jpg`, sample.amount);
  };

  // Confirm Attachment
  const handleConfirm = () => {
    if (!capturedImage) return;

    if (clarityResult && !clarityResult.isClear && clarityResult.score < 25) {
      if (!confirm(`Warning: ${clarityResult.message}\n\nDo you still want to proceed with this bill?`)) {
        return;
      }
    }

    const billObj: BillAttachment = {
      url: capturedImage,
      fileName: fileName || `Bill_${categoryLabel.replace(/\s+/g, '_')}_${Date.now()}.jpg`,
      detectedAmount: detectedAmount,
      isVerified: true,
      origin: extractedData?.origin,
      destination: extractedData?.destination,
      count: extractedData?.count,
      quality: clarityResult?.quality || 'High',
    };

    onAttachBill(billObj, extractedData || undefined);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-[#001947]/60  z-[220] flex items-center justify-center p-3 sm:p-4 animate-[fadeIn_0.15s_ease-out]">
      <div className="bg-white rounded-md shadow-sm max-w-xl w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[#c4c6d3] bg-[#f4f3fb] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-md bg-[#fb7800] text-white flex items-center justify-center shadow-xs">
              <span className="material-symbols-outlined text-[18px]">document_scanner</span>
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-[#002869]">Upload &amp; Scan Bill / Ticket</h2>
              <p className="text-[11px] text-[#434652]">Category: {categoryLabel} • Auto Route &amp; Fare Detection</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1 text-[#434652] hover:bg-[#e8e7ef] rounded-full transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* View Switcher Tabs (when not showing preview) */}
        {!capturedImage && (
          <div className="flex border-b border-[#c4c6d3] bg-white px-4">
            <button
              onClick={() => {
                setCapturedImage(null);
                setMode('upload');
              }}
              className={`flex-1 py-2.5 text-[13px] font-bold flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                mode === 'upload'
                  ? 'border-[#fb7800] text-[#fb7800]'
                  : 'border-transparent text-[#434652] hover:text-[#002869]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">upload_file</span>
              Upload Bill Photo
            </button>
            <button
              onClick={() => setMode('camera')}
              className={`flex-1 py-2.5 text-[13px] font-bold flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                mode === 'camera'
                  ? 'border-[#fb7800] text-[#fb7800]'
                  : 'border-transparent text-[#434652] hover:text-[#002869]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">photo_camera</span>
              Live Camera
            </button>
            <button
              onClick={() => {
                stopCamera();
                setMode('samples');
              }}
              className={`flex-1 py-2.5 text-[13px] font-bold flex items-center justify-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                mode === 'samples'
                  ? 'border-[#fb7800] text-[#fb7800]'
                  : 'border-transparent text-[#434652] hover:text-[#002869]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">receipt</span>
              Sample Tickets
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
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
                className="border-2 border-dashed border-[#c4c6d3] hover:border-[#fb7800] rounded-md p-8 bg-[#faf8ff] hover:bg-[#fff7f2] transition-colors cursor-pointer flex flex-col items-center justify-center gap-3"
              >
                <div className="w-14 h-14 rounded-full bg-[#dae2ff] text-[#001947] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[28px]">cloud_upload</span>
                </div>
                <div>
                  <p className="text-[14px] font-bold text-[#002869]">Click or Drop Ticket / Bill Photo</p>
                  <p className="text-[12px] text-[#747783] mt-0.5">Clear photos only (JPG, PNG, WEBP)</p>
                  <p className="text-[11px] text-[#137333] font-semibold mt-1">
                    ✨ Automatic Route (From → To) &amp; Amount Detection
                  </p>
                </div>
                <button
                  type="button"
                  className="mt-2 px-4 py-2 bg-[#002869] text-white text-[12px] font-bold rounded-md shadow-xs cursor-pointer"
                >
                  Choose File
                </button>
              </div>
            </div>
          )}

          {/* 2. Live Camera Mode */}
          {mode === 'camera' && !capturedImage && (
            <div className="space-y-4">
              {cameraError ? (
                <div className="p-4 bg-[#fff7f2] border border-[#ffdbc8] rounded-md text-center space-y-3">
                  <span className="material-symbols-outlined text-[36px] text-[#fb7800]">videocam_off</span>
                  <p className="text-[13px] text-[#592600] font-medium">{cameraError}</p>
                  <div className="flex justify-center gap-2">
                    <button
                      onClick={() => setMode('upload')}
                      className="px-4 py-2 bg-[#002869] text-white rounded-md text-[12px] font-bold cursor-pointer"
                    >
                      Upload Bill Image
                    </button>
                    <button
                      onClick={() => setMode('samples')}
                      className="px-4 py-2 bg-[#fb7800] text-white rounded-md text-[12px] font-bold cursor-pointer"
                    >
                      Use Sample Bill
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative bg-black rounded-md overflow-hidden aspect-[4/3] flex items-center justify-center shadow-inner">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {/* Scanner Reticle Overlay */}
                  <div className="absolute inset-6 border-2 border-[#fb7800]/80 rounded-md pointer-events-none flex flex-col justify-between p-3">
                    <div className="flex justify-between">
                      <span className="w-4 h-4 border-t-2 border-l-2 border-[#fb7800]"></span>
                      <span className="w-4 h-4 border-t-2 border-r-2 border-[#fb7800]"></span>
                    </div>
                    <div className="text-center">
                      <span className="px-3 py-1 bg-black/60 text-[#ffdbc8] rounded-full text-[11px] font-bold tracking-wide">
                        Hold Ticket Steady &amp; Clear
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="w-4 h-4 border-b-2 border-l-2 border-[#fb7800]"></span>
                      <span className="w-4 h-4 border-b-2 border-r-2 border-[#fb7800]"></span>
                    </div>
                  </div>
                </div>
              )}

              {cameraActive && !cameraError && (
                <div className="flex justify-center pt-1">
                  <button
                    onClick={handleCapture}
                    className="flex items-center gap-2 px-6 py-2.5 bg-[#fb7800] text-white rounded-md font-bold text-[13.5px] shadow-sm hover:bg-[#fb7800]/90 active:scale-95 transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]">photo_camera</span>
                    Capture Receipt
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 3. Sample Bills Mode */}
          {mode === 'samples' && !capturedImage && (
            <div className="space-y-3">
              <p className="text-[12px] text-[#434652] font-semibold">
                Select a sample verified ticket / bill for instant testing:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sampleBills.map((sample, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectSample(sample)}
                    className="p-3 border border-[#c4c6d3]/80 hover:border-[#fb7800] rounded-md hover:bg-[#fff7f2] transition-all cursor-pointer flex items-center gap-3 group"
                  >
                    <img
                      src={sample.url}
                      alt={sample.title}
                      className="w-14 h-14 rounded-md object-cover border border-[#c4c6d3]"
                      referrerPolicy="no-referrer"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-[12.5px] font-bold text-[#002869] truncate group-hover:text-[#fb7800]">
                        {sample.title}
                      </h4>
                      <p className="text-[11px] text-[#747783]">{sample.category}</p>
                      <p className="text-[12px] font-mono font-bold text-[#137333]">₹{sample.amount}</p>
                    </div>
                    <span className="material-symbols-outlined text-[18px] text-[#747783] group-hover:text-[#fb7800]">
                      arrow_forward
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 4. Preview & Extracted OCR Details */}
          {capturedImage && (
            <div className="space-y-4">
              <div className="relative bg-slate-900 rounded-md overflow-hidden max-h-[240px] flex items-center justify-center">
                <img
                  src={capturedImage}
                  alt="Scanned Bill"
                  className="max-h-[240px] w-auto object-contain"
                  referrerPolicy="no-referrer"
                />
                {isScanning && (
                  <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center text-white gap-2">
                    <span className="material-symbols-outlined text-[32px] animate-spin text-[#fb7800]">
                      progress_activity
                    </span>
                    <p className="text-[13px] font-bold">Scanning Bill &amp; Detecting Travel Route...</p>
                  </div>
                )}
              </div>

              {/* Clarity Quality Badge */}
              {clarityResult && (
                <div
                  className={`p-3 rounded-md border flex items-center justify-between text-[12px] ${
                    clarityResult.isClear
                      ? 'bg-[#e6f4ea] border-[#ceead6] text-[#137333]'
                      : 'bg-[#ffdad6] border-[#ffb4ab] text-[#ba1a1a]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">
                      {clarityResult.isClear ? 'check_circle' : 'warning'}
                    </span>
                    <span className="font-bold">
                      {clarityResult.isClear
                        ? `Bill Clarity: High Quality (${clarityResult.quality})`
                        : 'Image Quality Warning'}
                    </span>
                  </div>
                  <span className="font-mono font-semibold text-[11px]">
                    {clarityResult.width}×{clarityResult.height}px
                  </span>
                </div>
              )}

              {clarityWarning && (
                <div className="p-3 bg-[#fff7f2] border border-[#ffdbc8] rounded-md text-[12px] text-[#592600] flex items-center gap-2 font-medium">
                  <span className="material-symbols-outlined text-[16px] text-[#fb7800]">info</span>
                  <span>{clarityWarning}</span>
                </div>
              )}

              {/* Auto-extracted Travel Route Box */}
              {extractedData && (extractedData.origin || extractedData.destination) && (
                <div className="p-3.5 bg-[#e8f0fe] border border-[#d2e3fc] rounded-md space-y-1.5 text-[12.5px]">
                  <div className="font-extrabold text-[#1967d2] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px]">directions_bus</span>
                    <span>✨ Auto-Detected Travel Route</span>
                  </div>
                  <div className="flex items-center gap-2 font-bold text-[#002869]">
                    <span className="bg-white px-2.5 py-1 rounded border border-[#d2e3fc]">
                      {extractedData.origin || 'Origin'}
                    </span>
                    <span className="material-symbols-outlined text-[16px] text-[#1967d2]">arrow_forward</span>
                    <span className="bg-white px-2.5 py-1 rounded border border-[#d2e3fc]">
                      {extractedData.destination || 'Destination'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#1967d2]">
                    This route will be auto-written into your expense line item.
                  </p>
                </div>
              )}

              {/* Amount Matching & Verification Box */}
              <div className="p-3.5 bg-[#f4f3fb] border border-[#c4c6d3]/80 rounded-md space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-bold text-[#002869] flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px] text-[#137333]">verified</span>
                    <span>Bill Amount (₹)</span>
                  </span>
                  <span className="text-[11px] font-semibold text-[#747783]">{fileName}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <label className="block text-[11px] font-bold text-[#434652] mb-1">
                      Detected Amount (₹)
                    </label>
                    <input
                      type="number"
                      value={detectedAmount}
                      onChange={(e) => setDetectedAmount(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-1.5 bg-white border border-[#c4c6d3] rounded-md text-[14px] font-mono font-bold text-[#002869] focus:outline-none focus:border-[#fb7800]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-[#434652] mb-1">
                      Target Line Item
                    </label>
                    <div className="px-3 py-1.5 bg-white80 border border-[#c4c6d3]/60 rounded-md text-[13px] font-semibold text-[#434652] truncate">
                      {categoryLabel}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-[#c4c6d3] bg-[#faf8ff] flex items-center justify-between">
          {capturedImage ? (
            <>
              <button
                onClick={() => {
                  setCapturedImage(null);
                  setClarityResult(null);
                  setExtractedData(null);
                  if (mode === 'camera') startCamera();
                }}
                className="px-3.5 py-2 text-[#434652] hover:bg-[#e8e7ef] rounded-md text-[12px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                Retake / Change
              </button>
              <button
                onClick={handleConfirm}
                className="px-5 py-2 bg-[#fb7800] text-white rounded-md text-[13px] font-bold flex items-center gap-1.5 hover:bg-[#fb7800]/90 shadow-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">check</span>
                Attach Bill &amp; Auto-Write
              </button>
            </>
          ) : (
            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="ml-auto px-4 py-2 border border-[#c4c6d3] text-[#434652] hover:bg-[#f4f3fb] rounded-md text-[12px] font-bold cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};


