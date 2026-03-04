import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSheetEntries } from "@/hooks/useQueries";
import type { ExpenseEntry, SheetName } from "@/hooks/useQueries";
import { useAllEntries } from "@/hooks/useQueries";
import { getAllReceiptImages } from "@/hooks/useReceiptImages";
import type { SheetConfigMap } from "@/hooks/useSheetConfig";
import { cn } from "@/lib/utils";
import { downloadReceiptImage } from "@/utils/downloadReceipt";
import { exportToXlsx } from "@/utils/exportXlsx";
import {
  Download,
  Image,
  Pencil,
  Receipt,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DeleteConfirmDialog } from "./DeleteConfirmDialog";
import { EditModal } from "./EditModal";

interface SheetViewProps {
  sheet: SheetName;
  categories: string[];
  year: number;
  sheetConfigs?: SheetConfigMap;
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  try {
    const [year, month, day] = dateStr.split("-");
    return `${month}/${day}/${year.slice(2)}`;
  } catch {
    return dateStr;
  }
}

const CATEGORY_COLORS: Record<string, string> = {
  Auto: "bg-blue-100 text-blue-700",
  Cleaning: "bg-purple-100 text-purple-700",
  Electric: "bg-yellow-100 text-yellow-700",
  Garbage: "bg-gray-100 text-gray-600",
  "Gas/Propane": "bg-orange-100 text-orange-700",
  Groceries: "bg-green-100 text-green-700",
  Insurance: "bg-indigo-100 text-indigo-700",
  Internet: "bg-cyan-100 text-cyan-700",
  "Landscaping/Yard": "bg-emerald-100 text-emerald-700",
  "Mortgage/Rent": "bg-rose-100 text-rose-700",
  "Pest Control": "bg-lime-100 text-lime-700",
  Phone: "bg-sky-100 text-sky-700",
  Plumbing: "bg-teal-100 text-teal-700",
  "Repairs/Maintenance": "bg-amber-100 text-amber-700",
  Security: "bg-violet-100 text-violet-700",
  Taxes: "bg-red-100 text-red-700",
  Trash: "bg-slate-100 text-slate-600",
  Utilities: "bg-fuchsia-100 text-fuchsia-700",
  "Water/Sewer": "bg-blue-100 text-blue-600",
  Other: "bg-muted text-muted-foreground",
};

function getCategoryColor(category: string) {
  return CATEGORY_COLORS[category] ?? "bg-muted text-muted-foreground";
}

export function SheetView({
  sheet,
  categories,
  year,
  sheetConfigs,
}: SheetViewProps) {
  const { data: entries, isLoading } = useSheetEntries(sheet);
  const { data: allEntries } = useAllEntries();
  const [editEntry, setEditEntry] = useState<ExpenseEntry | null>(null);
  const [deleteEntry, setDeleteEntry] = useState<ExpenseEntry | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const receiptImages = getAllReceiptImages();

  const sorted = [...(entries ?? [])]
    .filter((e) => e.date.startsWith(String(year)))
    .sort((a, b) => b.date.localeCompare(a.date));

  const total = sorted.reduce((sum, e) => sum + e.amount, 0);

  const handleExport = async () => {
    if (!allEntries) return;
    try {
      await exportToXlsx(allEntries, year, sheetConfigs);
      toast.success(`Exported house-expenses-${year}.xlsx`);
    } catch {
      toast.error("Export failed");
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Summary card */}
      <div className="px-4 pt-4 pb-3">
        <div
          className="bg-card rounded-2xl p-4 border border-border shadow-xs"
          data-ocid="sheet.total_card"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                {sheet} — Total Expenses
              </p>
              <p className="text-3xl font-display font-bold text-foreground">
                {formatCurrency(total)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {sorted.length} {sorted.length === 1 ? "receipt" : "receipts"}
              </p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs font-medium"
                onClick={handleExport}
                data-ocid="sheet.export_button"
              >
                <Download className="h-3 w-3" />
                Export
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto scroll-container px-4 pb-2">
        {isLoading ? (
          <div className="space-y-2" data-ocid="sheet.loading_state">
            {["sk1", "sk2", "sk3", "sk4"].map((k) => (
              <Skeleton key={k} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-center"
            data-ocid="sheet.empty_state"
          >
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Receipt className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="font-display font-semibold text-foreground/80 mb-1">
              No receipts yet
            </p>
            <p className="text-sm text-muted-foreground max-w-[200px]">
              Tap the scan button to add your first receipt for {sheet}
            </p>
          </div>
        ) : (
          <div className="space-y-2" data-ocid="sheet.entries_table">
            {sorted.map((entry, idx) => {
              const entryImage = receiptImages[entry.id.toString()] ?? null;
              return (
                <div
                  key={entry.id.toString()}
                  className="bg-card rounded-xl border border-border overflow-hidden"
                  data-ocid={`entry.item.${idx + 1}`}
                >
                  {/* Receipt image thumbnail (if available) */}
                  {entryImage && (
                    <button
                      type="button"
                      onClick={() => setPreviewImage(entryImage)}
                      className="w-full h-24 overflow-hidden bg-muted/30 block tap-highlight-none"
                      title="View receipt image"
                      data-ocid={`entry.image_preview.${idx + 1}`}
                    >
                      <img
                        src={entryImage}
                        alt="Receipt scan"
                        className="w-full h-full object-cover object-top"
                      />
                    </button>
                  )}

                  <div className="p-3.5 flex gap-3 items-start">
                    {/* Left: category dot */}
                    <div className="shrink-0 mt-1.5">
                      <div
                        className={cn(
                          "w-2.5 h-2.5 rounded-full",
                          getCategoryColor(entry.category)
                            .split(" ")[0]
                            .replace("text-", "bg-"),
                        )}
                      />
                    </div>

                    {/* Center: details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-semibold text-sm text-foreground truncate">
                          {entry.companyName}
                        </p>
                        <span className="font-bold text-sm text-foreground shrink-0">
                          {formatCurrency(entry.amount)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(entry.date)}
                        </span>
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            getCategoryColor(entry.category),
                          )}
                        >
                          {entry.category}
                        </span>
                        {entryImage && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary flex items-center gap-1">
                            <Image className="h-2.5 w-2.5" />
                            Image
                          </span>
                        )}
                      </div>
                      {entry.notes && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                          {entry.notes}
                        </p>
                      )}
                    </div>

                    {/* Right: actions */}
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => setEditEntry(entry)}
                        data-ocid={`entry.edit_button.${idx + 1}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={cn(
                          "h-8 w-8",
                          entryImage
                            ? "text-muted-foreground hover:text-foreground"
                            : "text-muted-foreground/30 cursor-not-allowed",
                        )}
                        onClick={() =>
                          entryImage ? downloadReceiptImage(entry) : undefined
                        }
                        disabled={!entryImage}
                        title={
                          entryImage
                            ? "Download receipt image"
                            : "No image saved for this receipt"
                        }
                        data-ocid={`entry.download_button.${idx + 1}`}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteEntry(entry)}
                        data-ocid={`entry.delete_button.${idx + 1}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <EditModal
        entry={editEntry}
        open={!!editEntry}
        onClose={() => setEditEntry(null)}
        categories={categories}
      />

      <DeleteConfirmDialog
        entry={deleteEntry}
        open={!!deleteEntry}
        onClose={() => setDeleteEntry(null)}
      />

      {/* Full-screen receipt image preview */}
      {previewImage && (
        <dialog
          open
          className="fixed inset-0 z-[200] bg-black/90 flex flex-col w-full h-full max-w-none max-h-none m-0 p-0 border-0"
          data-ocid="sheet.image_preview_modal"
          aria-label="Receipt image preview"
        >
          <div className="flex items-center justify-between px-4 py-3 shrink-0">
            <span className="text-white text-sm font-medium">
              Receipt Image
            </span>
            <button
              type="button"
              onClick={() => setPreviewImage(null)}
              className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-white tap-highlight-none"
              data-ocid="sheet.image_preview_close_button"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-auto flex items-start justify-center p-4">
            <img
              src={previewImage}
              alt="Full receipt"
              className="max-w-full rounded-xl shadow-2xl"
            />
          </div>
        </dialog>
      )}
    </div>
  );
}
