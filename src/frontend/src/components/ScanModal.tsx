import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useActor } from "@/hooks/useActor";
import { useAddEntry, useAllCompanyNames } from "@/hooks/useQueries";
import type { SheetName } from "@/hooks/useQueries";
import { SHEETS } from "@/hooks/useQueries";
import { saveReceiptImage } from "@/hooks/useReceiptImages";
import { useScanFolders } from "@/hooks/useScanFolders";
import { ICON_MAP } from "@/hooks/useSheetConfig";
import type { SheetConfigMap } from "@/hooks/useSheetConfig";
import { cn } from "@/lib/utils";
import { cropReceipt, stitchImages } from "@/utils/imageProcessing";
import { type OcrResult, runOcr } from "@/utils/ocr";
import { AlertCircle, Camera, Receipt, RefreshCw, Save, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CategorySelect } from "./CategorySelect";
import { CompanySelect } from "./CompanySelect";
import { FolderSelect } from "./FolderSelect";

// Module-level helpers so they are stable and don't need to be in useCallback deps
/**
 * Returns the date from the last successfully saved receipt, or null if none.
 * Callers should only fall back to today's date as a last resort for the
 * initial default form state; OCR fallback should use null to leave the field
 * blank when there is truly no previous receipt date stored.
 */
function getLastScannedDate(): string | null {
  return localStorage.getItem("receiptScanner_lastScannedDate");
}

function saveLastScannedDate(date: string) {
  localStorage.setItem("receiptScanner_lastScannedDate", date);
}

type ScanStep = "capture" | "processing" | "review";

interface ScanFormData {
  sheet: SheetName | "";
  date: string;
  companyName: string;
  category: string;
  amount: string;
  notes: string;
}

interface ScanModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: (sheet: SheetName) => void;
  categories: string[];
  defaultSheet?: SheetName;
  sheetConfigs?: SheetConfigMap;
}

export function ScanModal({
  open,
  onClose,
  onSaved,
  categories,
  defaultSheet,
  sheetConfigs,
}: ScanModalProps) {
  const [step, setStep] = useState<ScanStep>("capture");
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);

  // Multi-scan state
  const [scannedBlobs, setScannedBlobs] = useState<Blob[]>([]);
  const [scannedPreviews, setScannedPreviews] = useState<string[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>("");

  const [form, setForm] = useState<ScanFormData>({
    sheet: defaultSheet ?? "",
    // Pre-fill with last scanned date; falls back to today only if nothing saved yet
    date: getLastScannedDate() ?? new Date().toISOString().split("T")[0],
    companyName: "",
    category: "",
    amount: "",
    notes: "",
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof ScanFormData, string>>
  >({});

  const fileInputRef = useRef<HTMLInputElement>(null);
  const addEntry = useAddEntry();
  const existingCompanies = useAllCompanyNames();
  const { actor, isFetching: actorFetching } = useActor();
  const { folders, createFolder, addEntryToFolder } = useScanFolders();

  const resetState = useCallback(() => {
    setStep("capture");
    setOcrResult(null);
    setOcrProgress(0);
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage);
    }
    setCapturedImage(null);
    // Revoke all preview object URLs
    setScannedPreviews((prev) => {
      for (const url of prev) {
        URL.revokeObjectURL(url);
      }
      return [];
    });
    setScannedBlobs([]);
    setSelectedFolderId("");
    setForm({
      sheet: defaultSheet ?? "",
      date: getLastScannedDate() ?? new Date().toISOString().split("T")[0],
      companyName: "",
      category: "",
      amount: "",
      notes: "",
    });
    setErrors({});
  }, [defaultSheet, capturedImage]);

  // Auto-open camera when modal opens
  useEffect(() => {
    if (open) {
      const timer = setTimeout(() => {
        fileInputRef.current?.click();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input so same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    try {
      // Crop the receipt from the background
      const croppedBlob = await cropReceipt(file);

      // Create preview URL for the cropped blob
      const previewUrl = URL.createObjectURL(croppedBlob);

      setScannedBlobs((prev) => [...prev, croppedBlob]);
      setScannedPreviews((prev) => [...prev, previewUrl]);
    } catch {
      // If cropping fails, use original file
      const previewUrl = URL.createObjectURL(file);
      setScannedBlobs((prev) => [...prev, file]);
      setScannedPreviews((prev) => [...prev, previewUrl]);
    }
  };

  const handleRemoveScan = (index: number) => {
    setScannedPreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
    setScannedBlobs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleContinueToReview = async () => {
    if (scannedBlobs.length === 0) return;

    setStep("processing");
    setOcrProgress(10);

    try {
      // Stitch all captured blobs top-to-bottom
      const stitchedBlob = await stitchImages(scannedBlobs);

      // Show preview of stitched image
      const stitchedUrl = URL.createObjectURL(stitchedBlob);
      setCapturedImage(stitchedUrl);

      // Simulate progress while OCR runs
      const progressInterval = setInterval(() => {
        setOcrProgress((p) => Math.min(p + 8, 85));
      }, 400);

      // Convert stitched blob to File for OCR
      const stitchedFile = new File([stitchedBlob], "receipt.jpg", {
        type: "image/jpeg",
      });

      const result = await runOcr(stitchedFile);

      clearInterval(progressInterval);
      setOcrProgress(100);

      setOcrResult(result);
      // Use the date from the receipt; if OCR couldn't read it, fall back to
      // the date from the last successfully scanned receipt. If no previous
      // receipt exists yet, leave the field showing today so it isn't blank.
      const resolvedDate =
        result.date ??
        getLastScannedDate() ??
        new Date().toISOString().split("T")[0];
      // Use the amount from OCR (already the highest found when no total keyword
      // matched). If OCR returned null it means no numeric amount was detected.
      const resolvedAmount =
        result.amount !== null && result.amount > 0
          ? result.amount.toFixed(2)
          : "";
      setForm((prev) => ({
        ...prev,
        date: resolvedDate,
        companyName: result.companyName,
        amount: resolvedAmount,
      }));

      setTimeout(() => {
        setStep("review");
      }, 500);
    } catch {
      toast.error("OCR failed — please fill in details manually");
      setStep("review");
    }
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof ScanFormData, string>> = {};
    if (!form.sheet) newErrors.sheet = "Please select a house";
    if (!form.date) newErrors.date = "Date is required";
    if (!form.companyName.trim())
      newErrors.companyName = "Company name is required";
    if (!form.category) newErrors.category = "Category is required";
    if (!form.amount || Number.isNaN(Number.parseFloat(form.amount))) {
      newErrors.amount = "Valid amount is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    // Guard: actor not yet connected
    if (!actor || actorFetching) {
      toast.error("Still connecting to backend — please try again in a moment");
      return;
    }

    if (!validate()) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      const savedEntry = await addEntry.mutateAsync({
        sheet: form.sheet,
        date: form.date,
        companyName: form.companyName.trim(),
        category: form.category,
        amount: Number.parseFloat(form.amount),
        notes: form.notes.trim(),
      });

      // Save the receipt image linked to the new entry ID
      if (scannedBlobs.length > 0) {
        try {
          const blobToSave =
            scannedBlobs.length === 1
              ? scannedBlobs[0]
              : await stitchImages(scannedBlobs);

          // Use a Promise so we await the FileReader before closing
          await new Promise<void>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const dataUrl = reader.result as string;
              // Store image linked to backend entry ID
              saveReceiptImage(savedEntry.id, dataUrl);

              // Also save to folder if one was selected
              if (selectedFolderId) {
                addEntryToFolder(selectedFolderId, {
                  imageDataUrl: dataUrl,
                  savedAt: new Date().toISOString(),
                  receiptDate: form.date,
                  companyName: form.companyName.trim(),
                  amount: Number.parseFloat(form.amount),
                });
              }
              resolve();
            };
            reader.onerror = () => resolve(); // Non-fatal
            reader.readAsDataURL(blobToSave);
          });
        } catch {
          // Non-fatal — image save failure shouldn't block the entry save
        }
      }

      // Persist the date so future scans can fall back to it if OCR can't read the date
      if (form.date) saveLastScannedDate(form.date);

      toast.success("Receipt saved successfully");
      onSaved(form.sheet as SheetName);
      resetState();
      onClose();
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to save receipt: ${detail}`);
    }
  };

  const handleRescan = () => {
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage);
    }
    setCapturedImage(null);
    setOcrResult(null);
    setScannedPreviews((prev) => {
      for (const url of prev) {
        URL.revokeObjectURL(url);
      }
      return [];
    });
    setScannedBlobs([]);
    setStep("capture");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    // Auto-open camera for rescan
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 100);
  };

  const confidenceColor =
    (ocrResult?.confidence ?? 0) > 70
      ? "bg-primary/20 text-primary"
      : "bg-amber-500/20 text-amber-700";

  return (
    <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
      <SheetContent
        side="bottom"
        className="h-[95dvh] rounded-t-2xl p-0 flex flex-col overflow-hidden"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="font-display text-xl font-bold">
              {step === "capture" && "Scan Receipt"}
              {step === "processing" && "Reading Receipt…"}
              {step === "review" && "Review & Save"}
            </SheetTitle>
            {step === "review" && ocrResult && (
              <Badge className={cn("text-xs font-medium", confidenceColor)}>
                {Math.round(ocrResult.confidence)}% confidence
              </Badge>
            )}
          </div>
          {/* Step indicator */}
          <div className="flex gap-2 mt-2">
            {(["capture", "processing", "review"] as ScanStep[]).map((s, i) => (
              <div
                key={s}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  i === 0 && step !== "capture"
                    ? "bg-primary"
                    : i === 1 && step === "review"
                      ? "bg-primary"
                      : i === ["capture", "processing", "review"].indexOf(step)
                        ? "bg-primary/50"
                        : "bg-muted",
                )}
              />
            ))}
          </div>
        </SheetHeader>

        {/* Hidden camera input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileCapture}
          className="hidden"
        />

        {/* ── Step: Capture ── */}
        {step === "capture" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Thumbnail strip of already-captured scans */}
            {scannedPreviews.length > 0 ? (
              <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Captured scans ({scannedPreviews.length})
                </p>
                <div className="space-y-2">
                  {scannedPreviews.map((url, index) => (
                    <div
                      key={url}
                      className="relative rounded-xl overflow-hidden border border-border bg-muted/20"
                      style={{ height: "120px" }}
                    >
                      <img
                        src={url}
                        alt={`Scan ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                      <span className="absolute bottom-2 left-3 text-white text-xs font-semibold drop-shadow">
                        Part {index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveScan(index)}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center transition-colors"
                        aria-label={`Remove scan ${index + 1}`}
                        data-ocid={`scan.thumbnail_remove.${index + 1}`}
                      >
                        <X className="h-3.5 w-3.5 text-white" />
                      </button>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground text-center pt-1">
                  Scans will be stitched top-to-bottom
                </p>
              </div>
            ) : (
              /* Empty state — show receipt viewfinder placeholder */
              <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4">
                <div className="w-full max-w-xs aspect-[3/4] rounded-2xl border-2 border-dashed border-border bg-muted/40 flex flex-col items-center justify-center gap-4 relative overflow-hidden">
                  <div className="absolute inset-0 opacity-5">
                    <div className="absolute top-1/4 left-0 right-0 h-px bg-foreground" />
                    <div className="absolute top-3/4 left-0 right-0 h-px bg-foreground" />
                    <div className="absolute top-0 bottom-0 left-1/4 w-px bg-foreground" />
                    <div className="absolute top-0 bottom-0 left-3/4 w-px bg-foreground" />
                  </div>
                  {/* Corner guides */}
                  {(
                    [
                      "top-3 left-3",
                      "top-3 right-3",
                      "bottom-3 left-3",
                      "bottom-3 right-3",
                    ] as const
                  ).map((pos) => (
                    <div
                      key={pos}
                      className={cn(
                        "absolute w-6 h-6 border-primary",
                        `${pos.includes("top") ? "border-t-2" : "border-b-2"} ${pos.includes("left") ? "border-l-2" : "border-r-2"}`,
                        pos,
                      )}
                    />
                  ))}
                  <Receipt className="h-16 w-16 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground text-center px-4">
                    Camera will open automatically
                  </p>
                </div>
                <p className="text-xs text-muted-foreground text-center max-w-xs">
                  Scan the top half first, then tap "Add another scan" for long
                  receipts
                </p>
              </div>
            )}

            {/* Bottom actions */}
            <div className="px-4 pb-6 pt-3 space-y-2.5 shrink-0 border-t border-border/50">
              <Button
                variant="outline"
                className="w-full h-12 gap-2 font-medium"
                onClick={() => fileInputRef.current?.click()}
                data-ocid="scan.add_another_button"
              >
                <Camera className="h-4 w-4" />
                {scannedPreviews.length === 0
                  ? "Open Camera"
                  : "Add another scan"}
              </Button>
              <Button
                className="w-full h-12 gap-2 font-semibold"
                disabled={scannedBlobs.length === 0}
                onClick={handleContinueToReview}
                data-ocid="scan.continue_button"
              >
                Continue to Review
              </Button>
            </div>
          </div>
        )}

        {/* ── Step: Processing ── */}
        {step === "processing" && (
          <div className="flex-1 flex flex-col items-center p-6 gap-6 overflow-y-auto">
            {/* Thumbnail strip of captured scans */}
            {scannedPreviews.length > 0 && (
              <div className="w-full space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {scannedPreviews.length} scan
                  {scannedPreviews.length !== 1 ? "s" : ""} — stitching…
                </p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {scannedPreviews.map((url, i) => (
                    <div
                      key={url}
                      className="shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-border"
                    >
                      <img
                        src={url}
                        alt={`Scan part ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {capturedImage && (
              <div className="w-full max-w-xs aspect-[3/4] rounded-2xl overflow-hidden border border-border">
                <img
                  src={capturedImage}
                  alt="Stitched receipt"
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            <div className="w-full max-w-xs space-y-3">
              <p className="text-sm font-medium text-center text-foreground">
                Extracting receipt data…
              </p>
              <Progress
                value={ocrProgress}
                className="h-2"
                data-ocid="scan.loading_state"
              />
              <p className="text-xs text-muted-foreground text-center">
                {ocrProgress < 30
                  ? "Stitching images…"
                  : ocrProgress < 50
                    ? "Loading OCR engine…"
                    : ocrProgress < 70
                      ? "Analyzing text…"
                      : ocrProgress < 90
                        ? "Extracting fields…"
                        : "Almost done…"}
              </p>
            </div>
          </div>
        )}

        {/* ── Step: Review ── */}
        {step === "review" && (
          <div className="flex-1 overflow-y-auto scroll-container">
            <div className="p-5 space-y-5 pb-6">
              {/* Save to Folder (optional) */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">
                  Save to Folder (optional)
                </Label>
                <FolderSelect
                  folders={folders}
                  value={selectedFolderId}
                  onChange={setSelectedFolderId}
                  onCreateFolder={createFolder}
                />
              </div>

              {/* House selector */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">
                  House *
                </Label>
                <div
                  className="grid grid-cols-2 gap-2"
                  data-ocid="scan.sheet_select"
                >
                  {SHEETS.map((s) => {
                    const cfg = sheetConfigs?.[s];
                    const label = cfg?.label ?? s;
                    const IconComp = cfg ? ICON_MAP[cfg.icon] : null;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() =>
                          setForm((prev) => ({ ...prev, sheet: s }))
                        }
                        className={cn(
                          "py-3 px-2 rounded-xl text-sm font-medium transition-all border tap-highlight-none flex flex-col items-center gap-1",
                          form.sheet === s
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-card border-border text-muted-foreground hover:border-primary/50",
                        )}
                      >
                        {IconComp && (
                          <IconComp
                            className={cn(
                              "h-4 w-4",
                              form.sheet === s
                                ? "text-primary-foreground"
                                : "text-muted-foreground",
                            )}
                          />
                        )}
                        <span className="truncate w-full text-center">
                          {label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {errors.sheet && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.sheet}
                  </p>
                )}
              </div>

              {/* Date */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">
                  Date *
                </Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, date: e.target.value }))
                  }
                  className="h-12 bg-card"
                  data-ocid="scan.date_input"
                />
                {errors.date && (
                  <p className="text-xs text-destructive">{errors.date}</p>
                )}
              </div>

              {/* Company */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">
                  Company *
                </Label>
                <CompanySelect
                  value={form.companyName}
                  onChange={(v) =>
                    setForm((prev) => ({ ...prev, companyName: v }))
                  }
                  existingCompanies={existingCompanies}
                  ocrConfidence={ocrResult?.confidence}
                />
                {errors.companyName && (
                  <p className="text-xs text-destructive">
                    {errors.companyName}
                  </p>
                )}
              </div>

              {/* Category */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">
                  Category *
                </Label>
                <CategorySelect
                  categories={categories}
                  value={form.category}
                  onChange={(v) =>
                    setForm((prev) => ({ ...prev, category: v }))
                  }
                />
                {errors.category && (
                  <p className="text-xs text-destructive">{errors.category}</p>
                )}
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">
                  Total Amount *
                </Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                    $
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.amount}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, amount: e.target.value }))
                    }
                    placeholder="0.00"
                    className="h-12 pl-8 bg-card"
                    data-ocid="scan.amount_input"
                  />
                </div>
                {errors.amount && (
                  <p className="text-xs text-destructive">{errors.amount}</p>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">
                  Notes
                </Label>
                <Textarea
                  value={form.notes}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="Optional notes about this receipt…"
                  className="min-h-[80px] bg-card resize-none"
                  data-ocid="scan.notes_textarea"
                />
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button
                  variant="outline"
                  className="h-12 gap-2"
                  onClick={handleRescan}
                  data-ocid="scan.rescan_button"
                >
                  <RefreshCw className="h-4 w-4" />
                  Rescan
                </Button>
                <Button
                  className="h-12 gap-2 font-semibold"
                  onClick={handleSave}
                  disabled={addEntry.isPending || actorFetching}
                  data-ocid="scan.save_button"
                >
                  {addEntry.isPending || actorFetching ? (
                    <>
                      <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                      {actorFetching ? "Connecting…" : "Saving…"}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      Save Entry
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
