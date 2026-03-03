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
import { useAddEntry, useAllCompanyNames } from "@/hooks/useQueries";
import type { SheetName } from "@/hooks/useQueries";
import { SHEETS } from "@/hooks/useQueries";
import { cn } from "@/lib/utils";
import { type OcrResult, runOcr } from "@/utils/ocr";
import { AlertCircle, Camera, Receipt, RefreshCw, Save } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { CategorySelect } from "./CategorySelect";
import { CompanySelect } from "./CompanySelect";

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
}

export function ScanModal({
  open,
  onClose,
  onSaved,
  categories,
  defaultSheet,
}: ScanModalProps) {
  const [step, setStep] = useState<ScanStep>("capture");
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [form, setForm] = useState<ScanFormData>({
    sheet: defaultSheet ?? "",
    date: new Date().toISOString().split("T")[0],
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

  const resetState = useCallback(() => {
    setStep("capture");
    setOcrResult(null);
    setOcrProgress(0);
    setCapturedImage(null);
    setForm({
      sheet: defaultSheet ?? "",
      date: new Date().toISOString().split("T")[0],
      companyName: "",
      category: "",
      amount: "",
      notes: "",
    });
    setErrors({});
  }, [defaultSheet]);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show captured image preview
    const previewUrl = URL.createObjectURL(file);
    setCapturedImage(previewUrl);
    setStep("processing");
    setOcrProgress(10);

    try {
      // Simulate progress while OCR runs
      const progressInterval = setInterval(() => {
        setOcrProgress((p) => Math.min(p + 8, 85));
      }, 400);

      const result = await runOcr(file);

      clearInterval(progressInterval);
      setOcrProgress(100);

      setOcrResult(result);
      setForm((prev) => ({
        ...prev,
        date: result.date,
        companyName: result.companyName,
        amount: result.amount > 0 ? result.amount.toFixed(2) : "",
      }));

      setTimeout(() => {
        setStep("review");
      }, 500);
    } catch {
      toast.error("OCR failed — please fill in details manually");
      setStep("review");
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
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
    if (!validate()) return;

    try {
      await addEntry.mutateAsync({
        sheet: form.sheet,
        date: form.date,
        companyName: form.companyName.trim(),
        category: form.category,
        amount: Number.parseFloat(form.amount),
        notes: form.notes.trim(),
      });

      toast.success("Receipt saved successfully");
      onSaved(form.sheet as SheetName);
      resetState();
      onClose();
    } catch {
      toast.error("Failed to save receipt");
    }
  };

  const handleRescan = () => {
    if (capturedImage) {
      URL.revokeObjectURL(capturedImage);
    }
    setCapturedImage(null);
    setOcrResult(null);
    setStep("capture");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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

        {/* Step: Capture */}
        {step === "capture" && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6 pb-[calc(5rem+env(safe-area-inset-bottom,0px))]">
            <div className="w-full max-w-xs aspect-[3/4] rounded-2xl border-2 border-dashed border-border bg-muted/40 flex flex-col items-center justify-center gap-4 relative overflow-hidden">
              <div className="absolute inset-0 opacity-5">
                <div className="absolute top-1/4 left-0 right-0 h-px bg-foreground" />
                <div className="absolute top-3/4 left-0 right-0 h-px bg-foreground" />
                <div className="absolute top-0 bottom-0 left-1/4 w-px bg-foreground" />
                <div className="absolute top-0 bottom-0 left-3/4 w-px bg-foreground" />
              </div>
              {/* Corner guides */}
              {[
                "top-3 left-3",
                "top-3 right-3",
                "bottom-3 left-3",
                "bottom-3 right-3",
              ].map((pos) => (
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
                Point camera at receipt
              </p>
            </div>

            <Button
              size="lg"
              className="w-full max-w-xs h-14 text-base font-semibold gap-3 rounded-xl"
              onClick={() => fileInputRef.current?.click()}
              data-ocid="scan.capture_button"
            >
              <Camera className="h-5 w-5" />
              Open Camera
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              The app will automatically extract date, vendor, and total amount
            </p>
          </div>
        )}

        {/* Step: Processing */}
        {step === "processing" && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
            {capturedImage && (
              <div className="w-full max-w-xs aspect-[3/4] rounded-2xl overflow-hidden border border-border">
                <img
                  src={capturedImage}
                  alt="Captured receipt"
                  className="w-full h-full object-cover"
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

        {/* Step: Review */}
        {step === "review" && (
          <div className="flex-1 overflow-y-auto scroll-container">
            <div className="p-5 space-y-5 pb-6">
              {/* House selector */}
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">
                  House *
                </Label>
                <div
                  className="grid grid-cols-4 gap-2"
                  data-ocid="scan.sheet_select"
                >
                  {SHEETS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setForm((prev) => ({ ...prev, sheet: s }))}
                      className={cn(
                        "py-3 rounded-xl text-sm font-medium transition-all border tap-highlight-none",
                        form.sheet === s
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-card border-border text-muted-foreground hover:border-primary/50",
                      )}
                    >
                      {s}
                    </button>
                  ))}
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
                  Date (Column A) *
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
                  Company (Column B) *
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
                  Category (Column C) *
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
                  Total Amount (Column D) *
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
                  Notes (Column E)
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
                  disabled={addEntry.isPending}
                  data-ocid="scan.save_button"
                >
                  {addEntry.isPending ? (
                    <>
                      <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                      Saving…
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
