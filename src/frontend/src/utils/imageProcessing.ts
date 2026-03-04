/**
 * Image processing utilities for receipt scanning.
 * - cropReceipt: auto-detects and crops receipt boundaries using edge detection
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
 * Convert RGBA pixel data to a grayscale array.
 */
function toGrayscale(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): Float32Array {
  const gray = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return gray;
}

/**
 * Compute Sobel edge magnitude map from a grayscale array.
 * Returns Float32Array of edge magnitudes (0-255 range).
 */
function sobelEdges(gray: Float32Array, w: number, h: number): Float32Array {
  const edges = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const tl = gray[(y - 1) * w + (x - 1)];
      const tc = gray[(y - 1) * w + x];
      const tr = gray[(y - 1) * w + (x + 1)];
      const ml = gray[y * w + (x - 1)];
      const mr = gray[y * w + (x + 1)];
      const bl = gray[(y + 1) * w + (x - 1)];
      const bc = gray[(y + 1) * w + x];
      const br = gray[(y + 1) * w + (x + 1)];
      const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
      edges[y * w + x] = Math.sqrt(gx * gx + gy * gy);
    }
  }
  return edges;
}

/**
 * Find the bounding box of the receipt in an edge map using row/column
 * projection profiles. Looks for rows/columns with high edge density.
 *
 * Returns {top, bottom, left, right} in pixel coordinates, or null if
 * no clear receipt region was found.
 */
function findReceiptBounds(
  edges: Float32Array,
  w: number,
  h: number,
  edgeThreshold = 30,
): { top: number; bottom: number; left: number; right: number } | null {
  // Build row projections (sum of strong edges per row)
  const rowProj = new Float32Array(h);
  const colProj = new Float32Array(w);
  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    for (let x = 0; x < w; x++) {
      const e = edges[y * w + x] > edgeThreshold ? 1 : 0;
      rowSum += e;
      colProj[x] += e;
    }
    rowProj[y] = rowSum;
  }

  // Normalise projections to 0-1
  const maxRow = Math.max(...Array.from(rowProj)) || 1;
  const maxCol = Math.max(...Array.from(colProj)) || 1;
  const rowNorm = rowProj.map((v) => v / maxRow);
  const colNorm = colProj.map((v) => v / maxCol);

  // The receipt occupies the region where projection stays above a threshold
  // Use 10% of peak as the cutoff (very permissive to handle faint receipts)
  const rowCutoff = 0.05;
  const colCutoff = 0.05;

  let top = -1;
  for (let y = 0; y < h; y++) {
    if (rowNorm[y] > rowCutoff) {
      top = y;
      break;
    }
  }
  let bottom = -1;
  for (let y = h - 1; y >= 0; y--) {
    if (rowNorm[y] > rowCutoff) {
      bottom = y;
      break;
    }
  }
  let left = -1;
  for (let x = 0; x < w; x++) {
    if (colNorm[x] > colCutoff) {
      left = x;
      break;
    }
  }
  let right = -1;
  for (let x = w - 1; x >= 0; x--) {
    if (colNorm[x] > colCutoff) {
      right = x;
      break;
    }
  }

  if (top === -1 || bottom === -1 || left === -1 || right === -1) return null;

  const bw = right - left;
  const bh = bottom - top;

  // Require a minimum size
  if (bw < w * 0.05 || bh < h * 0.05) return null;

  return { top, bottom, left, right };
}

/**
 * Crop the receipt out of an image blob using Sobel edge detection.
 *
 * Works reliably on white receipts against any background (light or dark)
 * because it detects the text/edge content on the receipt rather than relying
 * on a brightness difference between receipt and background.
 *
 * Returns a cropped blob with padding, or the original blob on failure.
 */
export async function cropReceipt(imageBlob: Blob): Promise<Blob> {
  try {
    const img = await loadImage(imageBlob);
    const { naturalWidth: origW, naturalHeight: origH } = img;

    // Work on a downscaled copy for speed (process at 800px wide max)
    const scale = Math.min(1, 800 / origW);
    const w = Math.round(origW * scale);
    const h = Math.round(origH * scale);

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return imageBlob;

    ctx.drawImage(img, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);

    const gray = toGrayscale(imageData.data, w, h);
    const edges = sobelEdges(gray, w, h);

    // Try multiple thresholds — start strict, relax if nothing found
    const thresholds = [40, 25, 15];
    let bounds: ReturnType<typeof findReceiptBounds> = null;
    for (const t of thresholds) {
      bounds = findReceiptBounds(edges, w, h, t);
      if (bounds) break;
    }

    if (!bounds) {
      // No edge content found — return original
      return imageBlob;
    }

    // Scale bounds back to original image coordinates
    const pad = Math.round(12 / scale); // 12px padding in downscaled = bigger in original
    const cropX = Math.max(0, Math.round(bounds.left / scale) - pad);
    const cropY = Math.max(0, Math.round(bounds.top / scale) - pad);
    const cropR = Math.min(origW, Math.round(bounds.right / scale) + pad);
    const cropB = Math.min(origH, Math.round(bounds.bottom / scale) + pad);
    const cropW = cropR - cropX;
    const cropH = cropB - cropY;

    // Guard against degenerate crops (too small or nearly the whole image)
    if (
      cropW < 50 ||
      cropH < 50 ||
      (cropW > origW * 0.97 && cropH > origH * 0.97)
    ) {
      return imageBlob;
    }

    // Draw the cropped region from the original full-res image
    const fullCanvas = document.createElement("canvas");
    fullCanvas.width = origW;
    fullCanvas.height = origH;
    const fullCtx = fullCanvas.getContext("2d");
    if (!fullCtx) return imageBlob;
    fullCtx.drawImage(img, 0, 0);

    const cropCanvas = document.createElement("canvas");
    cropCanvas.width = cropW;
    cropCanvas.height = cropH;
    const cropCtx = cropCanvas.getContext("2d");
    if (!cropCtx) return imageBlob;

    cropCtx.drawImage(
      fullCanvas,
      cropX,
      cropY,
      cropW,
      cropH,
      0,
      0,
      cropW,
      cropH,
    );

    const result = await canvasToBlob(cropCanvas);

    // Safety check: if the crop is within 3% of the original size, return original
    if (cropW / origW > 0.97 && cropH / origH > 0.97) {
      return imageBlob;
    }

    return result;
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
