/**
 * LiveCameraView — Full-screen live camera viewfinder.
 *
 * - Shows getUserMedia live video feed (rear camera)
 * - Shutter button captures full-res frame and calls onCapture
 * - Falls back to <input type="file" capture> if getUserMedia is unavailable
 * - Close button dismisses without capturing
 */

import { cn } from "@/lib/utils";
import { Camera, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface LiveCameraViewProps {
  onCapture: (blob: Blob) => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function LiveCameraView({ onCapture, onClose }: LiveCameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [fallbackMode, setFallbackMode] = useState(false);
  const [capturing, setCapturing] = useState(false);

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
    };
  }, []);

  const handleVideoReady = useCallback(() => {
    setCameraReady(true);
  }, []);

  // ── Capture ──────────────────────────────────────────────────────────────
  const handleCapture = useCallback(async () => {
    const video = videoRef.current;
    if (!video || capturing) return;

    setCapturing(true);

    try {
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

      onCapture(rawBlob);
    } catch {
      setCapturing(false);
    }
  }, [capturing, onCapture]);

  // ── Fallback file input handler ──────────────────────────────────────────
  const handleFallbackFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) {
        onClose();
        return;
      }
      onCapture(file);
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
      {/* Hidden offscreen canvas used only for capture */}
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

        <div className="px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm bg-black/50 text-white/70">
          Point at receipt
        </div>
      </div>

      {/* Video */}
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
        />

        {/* Corner guide overlay — static visual guides */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="relative w-4/5 aspect-[3/4]">
            {/* Top-left */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white/80" />
            {/* Top-right */}
            <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white/80" />
            {/* Bottom-left */}
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white/80" />
            {/* Bottom-right */}
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white/80" />
          </div>
        </div>

        {/* Guide text at bottom of viewfinder */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent pt-16 pb-4 px-4 pointer-events-none">
          <p className="text-white/80 text-xs text-center">
            Position the receipt within the guides, then tap the button
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
            "bg-white/20",
            capturing && "opacity-50 pointer-events-none",
          )}
          data-ocid="camera.primary_button"
          aria-label="Capture receipt photo"
        >
          {capturing ? (
            <div className="w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : (
            <div className="w-14 h-14 rounded-full bg-white" />
          )}
        </button>
      </div>
    </div>
  );
}
