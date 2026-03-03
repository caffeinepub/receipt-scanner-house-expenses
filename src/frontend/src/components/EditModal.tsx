import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateEntry } from "@/hooks/useQueries";
import type { ExpenseEntry, SheetName } from "@/hooks/useQueries";
import { SHEETS } from "@/hooks/useQueries";
import { cn } from "@/lib/utils";
import { Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CategorySelect } from "./CategorySelect";

interface EditModalProps {
  entry: ExpenseEntry | null;
  open: boolean;
  onClose: () => void;
  categories: string[];
}

export function EditModal({
  entry,
  open,
  onClose,
  categories,
}: EditModalProps) {
  const [form, setForm] = useState({
    sheet: "",
    date: "",
    companyName: "",
    category: "",
    amount: "",
    notes: "",
  });

  const updateEntry = useUpdateEntry();

  useEffect(() => {
    if (entry) {
      setForm({
        sheet: entry.sheet,
        date: entry.date,
        companyName: entry.companyName,
        category: entry.category,
        amount: entry.amount.toString(),
        notes: entry.notes,
      });
    }
  }, [entry]);

  const handleSave = async () => {
    if (!entry) return;
    const amount = Number.parseFloat(form.amount);
    if (Number.isNaN(amount)) {
      toast.error("Please enter a valid amount");
      return;
    }

    try {
      await updateEntry.mutateAsync({
        id: entry.id,
        sheet: form.sheet,
        date: form.date,
        companyName: form.companyName.trim(),
        category: form.category,
        amount,
        notes: form.notes.trim(),
        createdAt: entry.createdAt,
      });
      toast.success("Entry updated");
      onClose();
    } catch {
      toast.error("Failed to update entry");
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="bottom"
        className="h-[90dvh] rounded-t-2xl p-0 flex flex-col overflow-hidden"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="font-display text-xl font-bold">
              Edit Entry
            </SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-9 w-9"
              data-ocid="edit.cancel_button"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto scroll-container">
          <div className="p-5 space-y-5 pb-6">
            {/* House selector */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">
                House
              </Label>
              <div className="grid grid-cols-4 gap-2">
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
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">
                Date
              </Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, date: e.target.value }))
                }
                className="h-12 bg-card"
              />
            </div>

            {/* Company */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">
                Company
              </Label>
              <Input
                value={form.companyName}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    companyName: e.target.value,
                  }))
                }
                placeholder="Vendor / store name"
                className="h-12 bg-card"
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">
                Category
              </Label>
              <CategorySelect
                categories={categories}
                value={form.category}
                onChange={(v) => setForm((prev) => ({ ...prev, category: v }))}
              />
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground/80 uppercase tracking-wide">
                Amount
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
                />
              </div>
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
                placeholder="Optional notes…"
                className="min-h-[80px] bg-card resize-none"
              />
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="outline"
                className="h-12"
                onClick={onClose}
                data-ocid="edit.cancel_button"
              >
                Cancel
              </Button>
              <Button
                className="h-12 gap-2 font-semibold"
                onClick={handleSave}
                disabled={updateEntry.isPending}
                data-ocid="edit.save_button"
              >
                {updateEntry.isPending ? (
                  <span className="h-4 w-4 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
