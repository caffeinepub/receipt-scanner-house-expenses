/**
 * Stores and retrieves scanned receipt images linked to backend entry IDs.
 * Images are stored as base64 data URLs in localStorage keyed by entry ID.
 */

const STORAGE_KEY = "receiptImages_v1";

// Map of entryId (string) -> base64 data URL
type ImageMap = Record<string, string>;

function loadImageMap(): ImageMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    return parsed as ImageMap;
  } catch {
    return {};
  }
}

function saveImageMap(map: ImageMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore quota errors -- images are large, so this can happen
  }
}

export function saveReceiptImage(entryId: bigint, dataUrl: string): void {
  const map = loadImageMap();
  map[entryId.toString()] = dataUrl;
  saveImageMap(map);
}

export function getReceiptImage(entryId: bigint): string | null {
  const map = loadImageMap();
  return map[entryId.toString()] ?? null;
}

export function deleteReceiptImage(entryId: bigint): void {
  const map = loadImageMap();
  delete map[entryId.toString()];
  saveImageMap(map);
}

export function getAllReceiptImages(): ImageMap {
  return loadImageMap();
}
