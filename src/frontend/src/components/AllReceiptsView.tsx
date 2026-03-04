import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAllEntries } from "@/hooks/useQueries";
import type { ExpenseEntry, SheetName } from "@/hooks/useQueries";
import { getAllReceiptImages } from "@/hooks/useReceiptImages";
import { ICON_MAP } from "@/hooks/useSheetConfig";
import type { SheetConfigMap } from "@/hooks/useSheetConfig";
import { cn } from "@/lib/utils";
import { downloadReceiptImage } from "@/utils/downloadReceipt";
import { ArrowLeft, Download, Image, Receipt, Search, X } from "lucide-react";
import { useState } from "react";

interface AllReceiptsViewProps {
  onClose: () => void;
  year: number;
  sheetConfigs: SheetConfigMap;
  categories: string[];
}

const SHEET_COLORS: Record<SheetName, string> = {
  Cabin: "bg-emerald-100 text-emerald-700",
  Milton: "bg-blue-100 text-blue-700",
  Fife: "bg-amber-100 text-amber-700",
  Tacoma: "bg-violet-100 text-violet-700",
};

const SHEET_ICON_COLORS: Record<SheetName, string> = {
  Cabin: "text-emerald-600",
  Milton: "text-blue-600",
  Fife: "text-amber-600",
  Tacoma: "text-violet-600",
};

const SHEET_BG: Record<SheetName, string> = {
  Cabin: "bg-emerald-50",
  Milton: "bg-blue-50",
  Fife: "bg-amber-50",
  Tacoma: "bg-violet-50",
};

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

export function AllReceiptsView({
  onClose,
  year,
  sheetConfigs,
  categories: _categories,
}: AllReceiptsViewProps) {
  const { data: allEntries, isLoading } = useAllEntries();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<SheetName | "All">("All");
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const receiptImages = getAllReceiptImages();

  const filtered = [...(allEntries ?? [])]
    .filter((e) => e.date.startsWith(String(year)))
    .filter((e) => {
      if (activeFilter !== "All" && e.sheet !== activeFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          e.companyName?.toLowerCase().includes(q) ||
          e.category?.toLowerCase().includes(q) ||
          e.notes?.toLowerCase().includes(q) ||
          e.sheet?.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const total = filtered.reduce((sum, e) => sum + e.amount, 0);

  const sheets: SheetName[] = ["Cabin", "Milton", "Fife", "Tacoma"];

  function getSheetLabel(sheet: string) {
    return sheetConfigs[sheet]?.label ?? sheet;
  }

  function getSheetIcon(sheet: string) {
    const cfg = sheetConfigs[sheet];
    if (!cfg) return null;
    return ICON_MAP[cfg.icon] ?? null;
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-background flex flex-col"
      data-ocid="all_receipts.page"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      {/* Header */}
      <header className="px-4 pt-4 pb-3 flex items-center gap-3 shrink-0 border-b border-border">
        <button
          type="button"
          onClick={onClose}
          className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors tap-highlight-none"
          data-ocid="all_receipts.close_button"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h2 className="font-display font-bold text-lg leading-tight">
            All Receipts
          </h2>
          <p className="text-xs text-muted-foreground">{year}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="font-bold text-sm text-foreground">
            {formatCurrency(total)}
          </p>
        </div>
      </header>

      {/* Search */}
      <div className="px-4 pt-3 pb-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search receipts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-muted rounded-xl pl-9 pr-9 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground"
            data-ocid="all_receipts.search_input"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground tap-highlight-none"
              data-ocid="all_receipts.search_clear_button"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Sheet filter chips */}
      <div
        className="px-4 pb-3 flex gap-2 overflow-x-auto shrink-0 no-scrollbar"
        data-ocid="all_receipts.filter_row"
      >
        <button
          type="button"
          onClick={() => setActiveFilter("All")}
          className={cn(
            "shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors tap-highlight-none",
            activeFilter === "All"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground",
          )}
          data-ocid="all_receipts.filter_all_tab"
        >
          All
        </button>
        {sheets.map((sheet) => {
          const SheetIcon = getSheetIcon(sheet);
          return (
            <button
              key={sheet}
              type="button"
              onClick={() => setActiveFilter(sheet)}
              className={cn(
                "shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors tap-highlight-none",
                activeFilter === sheet
                  ? SHEET_COLORS[sheet]
                  : "bg-muted text-muted-foreground",
              )}
              data-ocid={`all_receipts.filter_${sheet.toLowerCase()}_tab`}
            >
              {SheetIcon && <SheetIcon className="h-3 w-3" />}
              {getSheetLabel(sheet)}
            </button>
          );
        })}
      </div>

      {/* Full-screen receipt image preview */}
      {previewImage && (
        <dialog
          open
          className="fixed inset-0 z-[200] bg-black/90 flex flex-col w-full h-full max-w-none max-h-none m-0 p-0 border-0"
          data-ocid="all_receipts.image_preview_modal"
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
              data-ocid="all_receipts.image_preview_close_button"
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

      {/* List */}
      <div className="flex-1 overflow-y-auto scroll-container px-4 pb-6">
        {isLoading ? (
          <div className="space-y-2" data-ocid="all_receipts.loading_state">
            {["sk1", "sk2", "sk3", "sk4", "sk5"].map((k) => (
              <Skeleton key={k} className="h-20 w-full rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-center"
            data-ocid="all_receipts.empty_state"
          >
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
              <Receipt className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="font-display font-semibold text-foreground/80 mb-1">
              No receipts found
            </p>
            <p className="text-sm text-muted-foreground max-w-[220px]">
              {search
                ? "Try a different search term"
                : `No receipts saved for ${year}`}
            </p>
          </div>
        ) : (
          <div className="space-y-2" data-ocid="all_receipts.entries_list">
            {filtered.map((entry, idx) => {
              const SheetIcon = getSheetIcon(entry.sheet);
              const sheetColor =
                SHEET_ICON_COLORS[entry.sheet as SheetName] ??
                "text-muted-foreground";
              const sheetBg = SHEET_BG[entry.sheet as SheetName] ?? "bg-muted";
              const sheetBadge =
                SHEET_COLORS[entry.sheet as SheetName] ??
                "bg-muted text-muted-foreground";
              const entryImage = receiptImages[entry.id.toString()] ?? null;
              return (
                <div
                  key={entry.id.toString()}
                  className="bg-card rounded-xl border border-border overflow-hidden"
                  data-ocid={`all_receipts.item.${idx + 1}`}
                >
                  {/* Receipt image thumbnail */}
                  {entryImage && (
                    <button
                      type="button"
                      onClick={() => setPreviewImage(entryImage)}
                      className="w-full h-24 overflow-hidden bg-muted/30 block tap-highlight-none"
                      title="View receipt image"
                      data-ocid={`all_receipts.image_preview.${idx + 1}`}
                    >
                      <img
                        src={entryImage}
                        alt="Receipt scan"
                        className="w-full h-full object-cover object-top"
                      />
                    </button>
                  )}

                  <div className="p-3.5 flex gap-3 items-start">
                    {/* Sheet icon */}
                    <div
                      className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0",
                        sheetBg,
                      )}
                    >
                      {SheetIcon ? (
                        <SheetIcon className={cn("h-4 w-4", sheetColor)} />
                      ) : (
                        <Receipt className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>

                    {/* Details */}
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
                            sheetBadge,
                          )}
                        >
                          {getSheetLabel(entry.sheet)}
                        </span>
                        {entry.category && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-muted text-muted-foreground">
                            {entry.category}
                          </span>
                        )}
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

                    {/* Download button — only active when image is stored */}
                    <button
                      type="button"
                      onClick={() =>
                        entryImage
                          ? downloadReceiptImage(
                              entry,
                              getSheetLabel(entry.sheet),
                            )
                          : undefined
                      }
                      disabled={!entryImage}
                      title={
                        entryImage
                          ? "Download receipt image"
                          : "No image saved for this receipt"
                      }
                      className={`shrink-0 w-8 h-8 flex items-center justify-center rounded-lg transition-colors tap-highlight-none ${
                        entryImage
                          ? "text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                          : "text-muted-foreground/30 cursor-not-allowed"
                      }`}
                      data-ocid={`all_receipts.download_button.${idx + 1}`}
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
