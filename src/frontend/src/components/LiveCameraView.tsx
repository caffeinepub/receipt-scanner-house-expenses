/**
 * LiveCameraView — Full-screen live camera viewfinder with real-time
 * receipt boundary detection overlay.
 *
 * - Shows getUserMedia live video feed (rear camera)
 * - Draws green corner guides when a receipt boundary is detected
 * - Shutter button captures full-res frame, runs cropReceipt, calls onCapture
 * - Falls back to <input type="file" capture> if getUserMedia is unavailable
 * - Close button dismisses without capturing
 */

import { cn } from "@/lib/utils";
import { cropReceipt } from "@/utils/imageProcessing";
import { Camera, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface ReceiptBounds {
  x: number;
  y: number;
  w: number;
  h: number;
  /** True when a clear, confident receipt boundary was found */
  confident: boolean;
}

interface LiveCameraViewProps {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Lightweight brightness-based edge detection (same algorithm as cropReceipt)
// Runs on a downscaled pixel buffer to keep it fast (~10 fps on canvas).
// Returns the bounding box in normalised [0..1] coordinates.
// ---------------------------------------------------------------------------
function detectReceiptBounds(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): ReceiptBounds | null {
  function brightness(r: number, g: number, b: number): number {
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  const sampleSize = Math.min(20, Math.floor(Math.min(w, h) * 0.05));

  function sampleCorner(sx: number, sy: number): number {
    let total = 0;
    let count = 0;
    for (let dy = 0; dy < sampleSize; dy++) {
      for (let dx = 0; dx < sampleSize; dx++) {
        const x = sx + dx;
        const y = sy + dy;
        if (x >= 0 && x < w && y >= 0 && y < h) {
          const idx = (y * w + x) * 4;
          total += brightness(data[idx], data[idx + 1], data[idx + 2]);
          count++;
        }
      }
    }
    return count > 0 ? total / count : 128;
  }

  const bgBrightness =
    (sampleCorner(0, 0) +
      sampleCorner(w - sampleSize, 0) +
      sampleCorner(0, h - sampleSize) +
      sampleCorner(w - sampleSize, h - sampleSize)) /
    4;

  const threshold = 28;

  let top = -1;
  outerTop: for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (
        Math.abs(
          brightness(data[idx], data[idx + 1], data[idx + 2]) - bgBrightness,
        ) > threshold
      ) {
        top = y;
        break outerTop;
      }
    }
  }
  if (top === -1) return null;

  let bottom = -1;
  outerBottom: for (let y = h - 1; y >= 0; y--) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      if (
        Math.abs(
          brightness(data[idx], data[idx + 1], data[idx + 2]) - bgBrightness,
        ) > threshold
      ) {
        bottom = y;
        break outerBottom;
      }
    }
  }

  let left = -1;
  outerLeft: for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      const idx = (y * w + x) * 4;
      if (
        Math.abs(
          brightness(data[idx], data[idx + 1], data[idx + 2]) - bgBrightness,
        ) > threshold
      ) {
        left = x;
        break outerLeft;
      }
    }
  }

  let right = -1;
  outerRight: for (let x = w - 1; x >= 0; x--) {
    for (let y = 0; y < h; y++) {
      const idx = (y * w + x) * 4;
      if (
        Math.abs(
          brightness(data[idx], data[idx + 1], data[idx + 2]) - bgBrightness,
        ) > threshold
      ) {
        right = x;
        break outerRight;
      }
    }
  }

  if (left === -1 || right === -1 || top === -1 || bottom === -1) return null;

  const bw = right - left;
  const bh = bottom - top;

  // Require a minimum size to consider it a real receipt
  if (bw < w * 0.1 || bh < h * 0.1) return null;

  // Confident if the detected box covers a reasonable receipt-like area
  const areaRatio = (bw * bh) / (w * h);
  const confident =
    areaRatio > 0.08 && areaRatio < 0.97 && bw > w * 0.15 && bh > h * 0.15;

  return {
    x: left / w,
    y: top / h,
    w: bw / w,
    h: bh / h,
    confident,
  };
}

// ---------------------------------------------------------------------------
// Draw corner guides on the overlay canvas
// ---------------------------------------------------------------------------
function drawOverlay(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  bounds: ReceiptBounds | null,
) {
  ctx.clearRect(0, 0, canvasW, canvasH);

  let bx: number;
  let by: number;
  let bw: number;
  let bh: number;
  let confident: boolean;

  if (bounds) {
    bx = bounds.x * canvasW;
    by = bounds.y * canvasH;
    bw = bounds.w * canvasW;
    bh = bounds.h * canvasH;
    confident = bounds.confident;
  } else {
    // Default guide box — centred receipt shape
    const marginX = canvasW * 0.08;
    const marginY = canvasH * 0.12;
    bx = marginX;
    by = marginY;
    bw = canvasW - marginX * 2;
    bh = canvasH - marginY * 2;
    confident = false;
  }

  // ── Spotlight mask ────────────────────────────────────────────────────────
  // Fill entire canvas with a dark overlay, then punch out the receipt area
  // using "destination-out" so only that region shows the live video clearly.
  const radius = 8;

  // 1. Dark mask over everything outside the receipt
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = confident ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0.50)";
  ctx.fillRect(0, 0, canvasW, canvasH);

  // 2. Cut out the receipt rectangle (with rounded corners)
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, bh, radius);
  ctx.fill();

  // Reset composite mode
  ctx.globalCompositeOperation = "source-over";

  // ── Border around the cutout ──────────────────────────────────────────────
  const borderColor = confident
    ? "rgba(74, 222, 128, 0.95)"
    : "rgba(255, 255, 255, 0.70)";
  const cornerLen = Math.min(bw, bh) * 0.1;

  ctx.strokeStyle = borderColor;
  ctx.lineCap = "round";

  // Subtle dashed full border to show exact crop boundary
  ctx.lineWidth = confident ? 2 : 1.5;
  ctx.setLineDash([6, 5]);
  ctx.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
  ctx.setLineDash([]);

  // Bold corner brackets
  ctx.lineWidth = confident ? 4 : 3;

  // Top-left
  ctx.beginPath();
  ctx.moveTo(bx, by + cornerLen);
  ctx.lineTo(bx, by);
  ctx.lineTo(bx + cornerLen, by);
  ctx.stroke();

  // Top-right
  ctx.beginPath();
  ctx.moveTo(bx + bw - cornerLen, by);
  ctx.lineTo(bx + bw, by);
  ctx.lineTo(bx + bw, by + cornerLen);
  ctx.stroke();

  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(bx, by + bh - cornerLen);
  ctx.lineTo(bx, by + bh);
  ctx.lineTo(bx + cornerLen, by + bh);
  ctx.stroke();

  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(bx + bw - cornerLen, by + bh);
  ctx.lineTo(bx + bw, by + bh);
  ctx.lineTo(bx + bw, by + bh - cornerLen);
  ctx.stroke();

  // Label — place above cutout if space allows, else below
  if (confident) {
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.fillStyle = "rgba(74, 222, 128, 0.95)";
    ctx.textAlign = "center";
    const labelY = by > 22 ? by - 10 : by + bh + 20;
    ctx.fillText("Receipt detected — tap to capture", bx + bw / 2, labelY);
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function LiveCameraView({ onCapture, onClose }: LiveCameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [currentBounds, setCurrentBounds] = useState<ReceiptBounds | null>(
    null,
  );

  // ── Start camera ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setFallbackMode(true);
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        if (cancelled) {
          for (const track of stream.getTracks()) track.stop();
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {
            // autoplay was blocked; try muted
            if (videoRef.current) {
              videoRef.current.muted = true;
              videoRef.current.play().catch(() => setFallbackMode(true));
            }
          });
        }
      } catch {
        if (!cancelled) setFallbackMode(true);
      }
    }

    startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) track.stop();
        streamRef.current = null;
      }
      if (rafRef.current !== null) {
        clearTimeout(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  // ── Detection loop (~10 fps) ─────────────────────────────────────────────
  const runDetectionLoop = useCallback(() => {
    const video = videoRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    const sampleCanvas = sampleCanvasRef.current;

    if (!video || !overlayCanvas || !sampleCanvas || video.readyState < 2) {
      rafRef.current = window.setTimeout(
        runDetectionLoop,
        100,
      ) as unknown as number;
      return;
    }

    // Sync overlay canvas size to the display size of the video element
    const rect = video.getBoundingClientRect();
    if (
      overlayCanvas.width !== rect.width ||
      overlayCanvas.height !== rect.height
    ) {
      overlayCanvas.width = rect.width;
      overlayCanvas.height = rect.height;
    }

    // Draw downscaled frame for detection
    const SW = 320;
    const SH = Math.round(
      (SW * video.videoHeight) / Math.max(video.videoWidth, 1),
    );
    sampleCanvas.width = SW;
    sampleCanvas.height = SH;

    const sCtx = sampleCanvas.getContext("2d", { willReadFrequently: true });
    if (!sCtx) {
      rafRef.current = window.setTimeout(
        runDetectionLoop,
        100,
      ) as unknown as number;
      return;
    }

    sCtx.drawImage(video, 0, 0, SW, SH);
    const imageData = sCtx.getImageData(0, 0, SW, SH);
    const bounds = detectReceiptBounds(imageData.data, SW, SH);

    setCurrentBounds(bounds);

    const oCtx = overlayCanvas.getContext("2d");
    if (oCtx)
      drawOverlay(oCtx, overlayCanvas.width, overlayCanvas.height, bounds);

    rafRef.current = window.setTimeout(
      runDetectionLoop,
      100,
    ) as unknown as number; // ~10 fps
  }, []);

  const handleVideoReady = useCallback(() => {
    setCameraReady(true);
    runDetectionLoop();
  }, [runDetectionLoop]);

  // ── Capture ──────────────────────────────────────────────────────────────
  const handleCapture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || capturing) return;

    setCapturing(true);

    try {
      // Stop detection loop while capturing
      if (rafRef.current !== null) {
        clearTimeout(rafRef.current);
        rafRef.current = null;
      }

      const vw = video.videoWidth;
      const vh = video.videoHeight;

      const captureCanvas =
        captureCanvasRef.current ?? document.createElement("canvas");
      captureCanvas.width = vw;
      captureCanvas.height = vh;
      const ctx = captureCanvas.getContext("2d");
      if (!ctx) throw new Error("No canvas context");

      ctx.drawImage(video, 0, 0, vw, vh);

      // Convert to blob
      const rawBlob = await new Promise<Blob>((resolve, reject) => {
        captureCanvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
          "image/jpeg",
          0.92,
        );
      });

      // Run auto-crop
      const croppedBlob = await cropReceipt(rawBlob);

      onCapture(croppedBlob);
    } catch {
      // On failure hand back the raw blob if possible, or re-enable
      setCapturing(false);
      // Restart detection
      rafRef.current = window.setTimeout(
        runDetectionLoop,
        100,
      ) as unknown as number;
    }
  }, [capturing, onCapture, runDetectionLoop]);

  // ── Fallback file input handler ──────────────────────────────────────────
  const handleFallbackFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) {
        onClose();
        return;
      }
      try {
        const croppedBlob = await cropReceipt(file);
        onCapture(croppedBlob);
      } catch {
        onCapture(file);
      }
    },
    [onCapture, onClose],
  );

  // ── Fallback UI ──────────────────────────────────────────────────────────
  if (fallbackMode) {
    return (
      <div className="fixed inset-0 z-[200] bg-background flex flex-col items-center justify-center gap-6 px-6">
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Live camera preview isn't available in this browser. Tap below to open
          your camera and take a photo of the receipt.
        </p>
        <label
          htmlFor="camera-fallback-input"
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm cursor-pointer"
          data-ocid="camera.upload_button"
        >
          <Camera className="h-5 w-5" />
          Open Camera
        </label>
        <input
          id="camera-fallback-input"
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFallbackFile}
          className="hidden"
        />
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-muted-foreground underline-offset-4 underline"
          data-ocid="camera.close_button"
        >
          Cancel
        </button>
      </div>
    );
  }

  // ── Live viewfinder UI ────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-[200] bg-black flex flex-col"
      data-ocid="camera.panel"
    >
      {/* Hidden offscreen canvases used only for processing */}
      <canvas ref={sampleCanvasRef} className="hidden" />
      <canvas ref={captureCanvasRef} className="hidden" />

      {/* Close button */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-safe-top pt-4">
        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/10 active:scale-95 transition-transform"
          data-ocid="camera.close_button"
          aria-label="Close camera"
        >
          <X className="h-5 w-5 text-white" />
        </button>

        {/* Receipt detected indicator */}
        <div
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm transition-all duration-300",
            currentBounds?.confident
              ? "bg-green-500/80 text-white"
              : "bg-black/50 text-white/60",
          )}
        >
          {currentBounds?.confident ? "Receipt detected ✓" : "Align receipt"}
        </div>
      </div>

      {/* Video + overlay */}
      <div className="flex-1 relative overflow-hidden">
        {/* Loading state before video is ready */}
        {!cameraReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white animate-spin" />
              <p className="text-white/70 text-sm">Starting camera…</p>
            </div>
          </div>
        )}

        {/* Live video feed */}
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          onCanPlay={handleVideoReady}
          className="w-full h-full object-cover"
          style={{ transform: "scaleX(1)" }}
        />

        {/* Overlay canvas for boundary guides */}
        <canvas
          ref={overlayCanvasRef}
          className="absolute inset-0 w-full h-full pointer-events-none"
          style={{ mixBlendMode: "normal" }}
        />

        {/* Guide text at bottom of viewfinder */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent pt-16 pb-4 px-4 pointer-events-none">
          <p className="text-white/80 text-xs text-center">
            {currentBounds?.confident
              ? "Hold steady — tap the button to capture"
              : "Position the receipt within the guides"}
          </p>
        </div>
      </div>

      {/* Shutter bar */}
      <div className="shrink-0 bg-black pb-safe-bottom pb-8 pt-4 flex items-center justify-center">
        <button
          type="button"
          onPointerDown={handleCapture}
          disabled={capturing || !cameraReady}
          className={cn(
            "w-20 h-20 rounded-full border-4 border-white flex items-center justify-center transition-all active:scale-95",
            currentBounds?.confident
              ? "bg-green-500/90 border-green-300"
              : "bg-white/20",
            capturing && "opacity-50 pointer-events-none",
          )}
          data-ocid="camera.primary_button"
          aria-label="Capture receipt photo"
        >
          {capturing ? (
            <div className="w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : (
            <div
              className={cn(
                "w-14 h-14 rounded-full transition-colors",
                currentBounds?.confident ? "bg-green-400" : "bg-white",
              )}
            />
          )}
        </button>
      </div>
    </div>
  );
}
