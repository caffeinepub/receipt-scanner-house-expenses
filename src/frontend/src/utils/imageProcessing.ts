/**
 * Image processing utilities for receipt scanning.
 * - cropReceipt: auto-detects and crops receipt boundaries
 * - stitchImages: stacks multiple images top-to-bottom
 */

/**
 * Load a Blob into an HTMLImageElement, resolving when fully loaded.
 */
function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

/**
 * Convert a canvas to a Blob (image/jpeg, quality 0.92).
 */
function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Canvas toBlob failed"));
        }
      },
      "image/jpeg",
      0.92,
    );
  });
}

/**
 * Determine the brightness (luminance) of a pixel from RGBA values.
 */
function brightness(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Crop the receipt out of an image blob.
 *
 * Scans from all 4 edges to find where the image deviates from the background
 * (receipts are typically white/light surrounded by a darker or varied background).
 * Returns a cropped blob with 8px padding, or the original blob on failure.
 */
export async function cropReceipt(imageBlob: Blob): Promise<Blob> {
  try {
    const img = await loadImage(imageBlob);
    const { naturalWidth: w, naturalHeight: h } = img;

    // Draw to offscreen canvas
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return imageBlob;

    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, w, h);
    const { data } = imageData;

    // Sample the background from the 4 corners (average brightness)
    const sampleSize = Math.min(20, Math.floor(Math.min(w, h) * 0.05));

    function sampleCornerBrightness(startX: number, startY: number): number {
      let total = 0;
      let count = 0;
      for (let dy = 0; dy < sampleSize; dy++) {
        for (let dx = 0; dx < sampleSize; dx++) {
          const x = startX + dx;
          const y = startY + dy;
          if (x >= 0 && x < w && y >= 0 && y < h) {
            const idx = (y * w + x) * 4;
            total += brightness(data[idx], data[idx + 1], data[idx + 2]);
            count++;
          }
        }
      }
      return count > 0 ? total / count : 128;
    }

    const corners = [
      sampleCornerBrightness(0, 0),
      sampleCornerBrightness(w - sampleSize, 0),
      sampleCornerBrightness(0, h - sampleSize),
      sampleCornerBrightness(w - sampleSize, h - sampleSize),
    ];
    const bgBrightness = corners.reduce((a, b) => a + b, 0) / corners.length;

    // Threshold: if brightness differs from background by this much, it's content
    const threshold = 30;

    // Scan from top
    let top = 0;
    outerTop: for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const b = brightness(data[idx], data[idx + 1], data[idx + 2]);
        if (Math.abs(b - bgBrightness) > threshold) {
          top = y;
          break outerTop;
        }
      }
    }

    // Scan from bottom
    let bottom = h - 1;
    outerBottom: for (let y = h - 1; y >= 0; y--) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const b = brightness(data[idx], data[idx + 1], data[idx + 2]);
        if (Math.abs(b - bgBrightness) > threshold) {
          bottom = y;
          break outerBottom;
        }
      }
    }

    // Scan from left
    let left = 0;
    outerLeft: for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        const idx = (y * w + x) * 4;
        const b = brightness(data[idx], data[idx + 1], data[idx + 2]);
        if (Math.abs(b - bgBrightness) > threshold) {
          left = x;
          break outerLeft;
        }
      }
    }

    // Scan from right
    let right = w - 1;
    outerRight: for (let x = w - 1; x >= 0; x--) {
      for (let y = 0; y < h; y++) {
        const idx = (y * w + x) * 4;
        const b = brightness(data[idx], data[idx + 1], data[idx + 2]);
        if (Math.abs(b - bgBrightness) > threshold) {
          right = x;
          break outerRight;
        }
      }
    }

    // Add padding
    const pad = 8;
    const cropX = Math.max(0, left - pad);
    const cropY = Math.max(0, top - pad);
    const cropW = Math.min(w, right + pad + 1) - cropX;
    const cropH = Math.min(h, bottom + pad + 1) - cropY;

    // Guard against degenerate crop
    if (cropW < 50 || cropH < 50 || cropW > w * 0.98 || cropH > h * 0.98) {
      // Crop is too small or nearly identical to original — return original
      return imageBlob;
    }

    // Draw cropped region to new canvas
    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const cropCtx = cropCanvas.getContext("2d");
    if (!cropCtx) return imageBlob;

    cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    return await canvasToBlob(cropCanvas);
  } catch {
    // On any failure, return the original blob unchanged
    return imageBlob;
  }
}

/**
 * Stitch multiple image blobs together top-to-bottom into a single image.
 *
 * If only one blob is provided, returns it unchanged.
 * Images are centered horizontally if widths differ.
 */
export async function stitchImages(blobs: Blob[]): Promise<Blob> {
  if (blobs.length === 0) {
    throw new Error("No images to stitch");
  }
  if (blobs.length === 1) {
    return blobs[0];
  }

  // Load all images in parallel
  const images = await Promise.all(blobs.map(loadImage));

  const maxWidth = Math.max(...images.map((img) => img.naturalWidth));
  const totalHeight = images.reduce((sum, img) => sum + img.naturalHeight, 0);

  const canvas = document.createElement("canvas");
  canvas.width = maxWidth;
  canvas.height = totalHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not get canvas context");
  }

  // White background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, maxWidth, totalHeight);

  // Draw each image top-to-bottom, centered horizontally
  let yOffset = 0;
  for (const img of images) {
    const xOffset = Math.floor((maxWidth - img.naturalWidth) / 2);
    ctx.drawImage(img, xOffset, yOffset);
    yOffset += img.naturalHeight;
  }

  return await canvasToBlob(canvas);
}
