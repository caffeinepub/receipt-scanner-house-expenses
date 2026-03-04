import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAddCategory } from "@/hooks/useQueries";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";

interface CategorySelectProps {
  categories: string[];
  value: string;
  onChange: (value: string) => void;
}

/**
 * CategorySelect — works reliably on iPhone inside Radix UI Sheet overlays.
 *
 * Strategy: render the picker as a React portal directly on document.body with
 * a very high z-index. This bypasses all Radix UI portal stacking and iOS
 * touch-event interception that occurs when a <select> or custom overlay is
 * nested inside a Sheet component.
 *
 * Touch events use onTouchEnd with preventDefault() to prevent iOS from
 * firing a delayed synthetic click that misses the target after the list
 * has scrolled.
 */
export function CategorySelect({
  categories,
  value,
  onChange,
}: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [showAddInput, setShowAddInput] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const addCategory = useAddCategory();
  const addInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (showAddInput) {
      setTimeout(() => addInputRef.current?.focus(), 80);
    }
  }, [showAddInput]);

  // Lock body scroll while picker is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleOpen = () => {
    setOpen(true);
    setShowAddInput(false);
    setNewCategory("");
  };

  const handleClose = () => {
    setOpen(false);
    setShowAddInput(false);
    setNewCategory("");
  };

  const handleSelect = (cat: string) => {
    onChange(cat);
    handleClose();
  };

  const handleAddCategory = async () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    // Set value immediately so validation passes right away
    onChange(trimmed);
    handleClose();
    if (categories.includes(trimmed)) return;
    try {
      await addCategory.mutateAsync(trimmed);
      toast.success(`Category "${trimmed}" added`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.toLowerCase().includes("already")) return;
      toast.error(
        "Failed to save category — it will still be used for this entry",
      );
    }
  };

  // Build display options: include current value if not already in list
  const displayCategories =
    value && !categories.includes(value) ? [...categories, value] : categories;

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleOpen();
        }}
        className="w-full h-12 px-4 flex items-center justify-between rounded-md border border-border bg-card text-base transition-colors hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
        data-ocid="scan.category_select"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {value || "Select category…"}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      {/* Portal picker — renders directly on body, above everything */}
      {open &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 2147483647, // max z-index
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              // Prevent iOS rubber-band scroll from propagating
              overscrollBehavior: "contain",
            }}
          >
            {/* Backdrop */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.55)",
              }}
              onPointerDown={(e) => {
                e.preventDefault();
                handleClose();
              }}
            />

            {/* Panel */}
            <div
              style={{
                position: "relative",
                background: "hsl(var(--background))",
                borderTopLeftRadius: "1rem",
                borderTopRightRadius: "1rem",
                boxShadow: "0 -4px 32px rgba(0,0,0,0.18)",
                display: "flex",
                flexDirection: "column",
                maxHeight: "72vh",
                // Prevent touches on panel from closing via backdrop
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              {/* Handle bar */}
              <div
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  background: "hsl(var(--muted-foreground) / 0.3)",
                  margin: "10px auto 0",
                  flexShrink: 0,
                }}
              />

              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 20px 10px",
                  borderBottom: "1px solid hsl(var(--border))",
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: "1rem",
                    color: "hsl(var(--foreground))",
                  }}
                >
                  Select Category
                </span>
                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    handleClose();
                  }}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    background: "hsl(var(--muted))",
                    color: "hsl(var(--muted-foreground))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "none",
                    cursor: "pointer",
                  }}
                  data-ocid="category.close_button"
                >
                  <X style={{ width: 16, height: 16 }} />
                </button>
              </div>

              {/* Scrollable list */}
              <div
                ref={listRef}
                style={{
                  flex: 1,
                  overflowY: "auto",
                  WebkitOverflowScrolling: "touch",
                  overscrollBehavior: "contain",
                }}
              >
                {displayCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelect(cat);
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "15px 20px",
                      fontSize: "1rem",
                      textAlign: "left",
                      background:
                        value === cat
                          ? "hsl(var(--primary) / 0.08)"
                          : "transparent",
                      border: "none",
                      borderBottom: "1px solid hsl(var(--border) / 0.35)",
                      cursor: "pointer",
                      color: "hsl(var(--foreground))",
                      touchAction: "manipulation",
                      WebkitTapHighlightColor: "transparent",
                    }}
                    data-ocid="category.item"
                  >
                    <span>{cat}</span>
                    {value === cat && (
                      <Check
                        style={{
                          width: 16,
                          height: 16,
                          color: "hsl(var(--primary))",
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </button>
                ))}
              </div>

              {/* Add new category */}
              <div
                style={{
                  padding: "12px 16px",
                  borderTop: "1px solid hsl(var(--border))",
                  flexShrink: 0,
                  // Extra padding for iPhone home indicator
                  paddingBottom: "max(12px, env(safe-area-inset-bottom))",
                }}
              >
                {showAddInput ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <Input
                      ref={addInputRef}
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      placeholder="Category name…"
                      className="h-11 bg-card flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddCategory();
                        if (e.key === "Escape") {
                          setShowAddInput(false);
                          setNewCategory("");
                        }
                      }}
                      data-ocid="category.add_input"
                    />
                    <Button
                      size="icon"
                      className="h-11 w-11 shrink-0"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        handleAddCategory();
                      }}
                      disabled={addCategory.isPending || !newCategory.trim()}
                      data-ocid="category.confirm_button"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-11 w-11 shrink-0"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        setShowAddInput(false);
                        setNewCategory("");
                      }}
                      data-ocid="category.cancel_button"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowAddInput(true);
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "12px",
                      borderRadius: 12,
                      color: "hsl(var(--primary))",
                      fontWeight: 500,
                      fontSize: "0.9rem",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      touchAction: "manipulation",
                      WebkitTapHighlightColor: "transparent",
                    }}
                    data-ocid="category.add_new_button"
                  >
                    <Plus style={{ width: 16, height: 16 }} />
                    Add new category…
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
