import type { ExpenseEntry } from "@/hooks/useQueries";
import { getReceiptImage } from "@/hooks/useReceiptImages";
import { toast } from "sonner";

/**
 * Downloads the actual scanned receipt image if one exists for this entry.
 * Shows a toast if no image is stored for this receipt.
 */
export function downloadReceiptImage(
  entry: ExpenseEntry,
  sheetLabel?: string,
): void {
  const imageDataUrl = getReceiptImage(entry.id);

  if (!imageDataUrl) {
    toast.error(
      "No receipt image saved for this entry. Images are only available for receipts scanned after the image-saving feature was added.",
    );
    return;
  }

  // Determine file extension from data URL mime type
  const mimeMatch = imageDataUrl.match(/^data:([^;]+);/);
  const mime = mimeMatch?.[1] ?? "image/jpeg";
  const ext = mime === "image/png" ? "png" : "jpg";

  // Sanitize filename parts
  const property = (sheetLabel ?? entry.sheet)
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase()
    .slice(0, 20);
  const company = (entry.companyName ?? "receipt")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase()
    .slice(0, 30);
  const date = (entry.date ?? "").replace(/[^0-9-]/g, "") || "unknown-date";
  const filename = `receipt-${property}-${company}-${date}.${ext}`;

  // Convert data URL to Blob for a proper file download
  const byteString = atob(imageDataUrl.split(",")[1]);
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  const blob = new Blob([ab], { type: mime });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast.success(`Downloading ${filename}`);
}
