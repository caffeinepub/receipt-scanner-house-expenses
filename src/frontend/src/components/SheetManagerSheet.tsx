import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ICON_LABELS, ICON_MAP, ICON_NAMES } from "@/hooks/useSheetConfig";
import type {
  IconName,
  SheetConfig,
  SheetConfigMap,
} from "@/hooks/useSheetConfig";
import { cn } from "@/lib/utils";
import { CheckCircle2, Pencil, X } from "lucide-react";
import { useState } from "react";

interface SheetManagerSheetProps {
  open: boolean;
  onClose: () => void;
  sheetKeys: string[];
  sheetConfigs: SheetConfigMap;
  updateSheetConfig: (key: string, config: SheetConfig) => void;
}

export function SheetManagerSheet({
  open,
  onClose,
  sheetKeys,
  sheetConfigs,
  updateSheetConfig,
}: SheetManagerSheetProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftLabel, setDraftLabel] = useState("");
  const [draftIcon, setDraftIcon] = useState<IconName>("Home");

  function startEditing(key: string) {
    const cfg = sheetConfigs[key] ?? { label: key, icon: "Home" as IconName };
    setDraftLabel(cfg.label);
    setDraftIcon(cfg.icon);
    setEditingKey(key);
  }

  function cancelEditing() {
    setEditingKey(null);
  }

  function saveEditing(key: string) {
    updateSheetConfig(key, {
      label: draftLabel.trim() || key,
      icon: draftIcon,
    });
    setEditingKey(null);
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl px-0 pt-0 pb-0 max-h-[90dvh] flex flex-col"
        data-ocid="settings.sheet"
      >
        {/* ── Drag handle ── */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        <SheetHeader className="px-5 pb-3 shrink-0 flex flex-row items-center justify-between">
          <SheetTitle className="font-display text-lg font-bold text-foreground">
            Manage Sheets
          </SheetTitle>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors tap-highlight-none"
            data-ocid="settings.close_button"
            aria-label="Close sheet manager"
          >
            <X className="h-4 w-4" />
          </button>
        </SheetHeader>

        <ScrollArea className="flex-1 overflow-y-auto px-5 pb-8">
          <div className="space-y-2">
            {sheetKeys.map((key, idx) => {
              const cfg = sheetConfigs[key] ?? {
                label: key,
                icon: "Home" as IconName,
              };
              const IconComp = ICON_MAP[cfg.icon];
              const isEditing = editingKey === key;
              const rowIndex = (idx + 1) as 1 | 2 | 3 | 4;

              return (
                <div
                  key={key}
                  className={cn(
                    "rounded-xl border border-border transition-all",
                    isEditing ? "bg-secondary/50 border-primary/30" : "bg-card",
                  )}
                  data-ocid={`settings.item.${rowIndex}`}
                >
                  {/* ── Row header ── */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <IconComp className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">
                        {cfg.label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ICON_LABELS[cfg.icon]}
                      </p>
                    </div>
                    {!isEditing && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 px-3 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => startEditing(key)}
                        data-ocid={`settings.edit_button.${rowIndex}`}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1.5" />
                        Edit
                      </Button>
                    )}
                  </div>

                  {/* ── Inline edit form ── */}
                  {isEditing && (
                    <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-3">
                      {/* Name input */}
                      <div className="space-y-1.5">
                        <label
                          htmlFor={`sheet-name-${key}`}
                          className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
                        >
                          Name
                        </label>
                        <Input
                          id={`sheet-name-${key}`}
                          value={draftLabel}
                          onChange={(e) => setDraftLabel(e.target.value)}
                          placeholder="Sheet name"
                          className="h-10 text-sm"
                          data-ocid="settings.name_input"
                          onKeyDown={(e) =>
                            e.key === "Enter" && saveEditing(key)
                          }
                          autoFocus
                        />
                      </div>

                      {/* Icon picker */}
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Icon
                        </p>
                        <div className="grid grid-cols-4 gap-2">
                          {ICON_NAMES.map((iconName, iconIdx) => {
                            const IcoComp = ICON_MAP[iconName];
                            const isSelected = draftIcon === iconName;
                            const iconIndex = (iconIdx + 1) as
                              | 1
                              | 2
                              | 3
                              | 4
                              | 5
                              | 6
                              | 7
                              | 8
                              | 9
                              | 10
                              | 11
                              | 12
                              | 13
                              | 14
                              | 15
                              | 16;

                            return (
                              <button
                                key={iconName}
                                type="button"
                                onClick={() => setDraftIcon(iconName)}
                                className={cn(
                                  "flex flex-col items-center gap-1 py-2 px-1 rounded-xl transition-all tap-highlight-none",
                                  isSelected
                                    ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-1"
                                    : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                                )}
                                data-ocid={`settings.icon_button.${iconIndex}`}
                                aria-label={ICON_LABELS[iconName]}
                                aria-pressed={isSelected}
                              >
                                <IcoComp className="h-5 w-5" />
                                <span className="text-[9px] font-medium leading-none">
                                  {ICON_LABELS[iconName]}
                                </span>
                                {isSelected && (
                                  <CheckCircle2 className="absolute h-3 w-3 top-0.5 right-0.5 opacity-70" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Save / Cancel */}
                      <div className="flex gap-2 pt-1">
                        <Button
                          type="button"
                          onClick={() => saveEditing(key)}
                          className="flex-1 h-10 font-semibold"
                          data-ocid="settings.save_button"
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={cancelEditing}
                          className="flex-1 h-10"
                          data-ocid="settings.cancel_button"
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Tax-deductible hint */}
          <p className="mt-4 text-[11px] text-muted-foreground text-center leading-relaxed px-2">
            Rename each property sheet and choose a tax-deductible category icon
            to match your expenses.
          </p>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
