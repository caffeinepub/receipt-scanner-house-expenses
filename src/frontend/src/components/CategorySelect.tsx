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
  /** Called when the picker opens (true) or fully closes (false).
   *  Parents can use this to hide their Radix Sheet so the scroll-lock
   *  layer doesn't intercept touch events on the portal overlay. */
  onOpenChange?: (open: boolean) => void;
}

export function CategorySelect({
  categories,
  value,
  onChange,
  onOpenChange,
}: CategorySelectProps) {
  const [open, setOpen] = useState(false);
  const [showAddInput, setShowAddInput] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const addCategory = useAddCategory();
  const addInputRef = useRef<HTMLInputElement>(null);

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
    // Tell parent to hide its Sheet FIRST, then open the picker after a brief
    // pause so Radix has time to remove its scroll-lock layer before the portal
    // renders.  This is the only reliable way to receive touch events on iOS
    // Safari when the picker is portalled above a Radix Sheet.
    onOpenChange?.(true);
    setTimeout(() => {
      setOpen(true);
      setShowAddInput(false);
      setNewCategory("");
    }, 60);
  };

  const handleClose = () => {
    setOpen(false);
    setShowAddInput(false);
    setNewCategory("");
    // Notify parent AFTER local state is cleared so the Sheet doesn't reappear
    // before the picker has fully dismissed.
    setTimeout(() => onOpenChange?.(false), 50);
  };

  const handleSelect = (cat: string) => {
    onChange(cat);
    handleClose();
  };

  const handleAddCategory = async () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
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

  const displayCategories =
    value && !categories.includes(value) ? [...categories, value] : categories;

  const itemStyle: React.CSSProperties = {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    fontSize: "1rem",
    textAlign: "left",
    background: "transparent",
    border: "none",
    borderBottom: "1px solid hsl(var(--border) / 0.35)",
    cursor: "pointer",
    color: "hsl(var(--foreground))",
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
    userSelect: "none",
    WebkitUserSelect: "none",
    pointerEvents: "auto",
    minHeight: "56px",
    boxSizing: "border-box",
  };

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleOpen}
        style={{
          width: "100%",
          height: 48,
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderRadius: 6,
          border: "1px solid hsl(var(--border))",
          background: "hsl(var(--card))",
          fontSize: "1rem",
          cursor: "pointer",
          touchAction: "manipulation",
          WebkitTapHighlightColor: "transparent",
          pointerEvents: "auto",
        }}
        data-ocid="scan.category_select"
      >
        <span
          style={{
            color: value
              ? "hsl(var(--foreground))"
              : "hsl(var(--muted-foreground))",
          }}
        >
          {value || "Select category…"}
        </span>
        <ChevronDown
          style={{
            width: 16,
            height: 16,
            color: "hsl(var(--muted-foreground))",
            flexShrink: 0,
          }}
        />
      </button>

      {/* Portal picker */}
      {open &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 2147483647,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              overscrollBehavior: "contain",
              pointerEvents: "auto",
              touchAction: "none",
            }}
            role="presentation"
            onClick={(e) => {
              // Close if clicking the backdrop (not the panel)
              if (e.target === e.currentTarget) handleClose();
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape") handleClose();
            }}
          >
            {/* Semi-transparent backdrop */}
            <div
              role="presentation"
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.55)",
                pointerEvents: "auto",
              }}
              onClick={handleClose}
              onKeyDown={(e) => {
                if (e.key === "Escape") handleClose();
              }}
            />

            {/* Panel */}
            <div
              role="presentation"
              style={{
                position: "relative",
                background: "hsl(var(--background))",
                borderTopLeftRadius: "1rem",
                borderTopRightRadius: "1rem",
                boxShadow: "0 -4px 32px rgba(0,0,0,0.18)",
                display: "flex",
                flexDirection: "column",
                maxHeight: "72vh",
                pointerEvents: "auto",
                touchAction: "auto",
                userSelect: "none",
                WebkitUserSelect: "none",
              }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
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
                  onClick={handleClose}
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
                    touchAction: "manipulation",
                    WebkitTapHighlightColor: "transparent",
                    pointerEvents: "auto",
                  }}
                  data-ocid="category.close_button"
                >
                  <X style={{ width: 16, height: 16 }} />
                </button>
              </div>

              {/* Scrollable list */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  WebkitOverflowScrolling: "touch",
                  overscrollBehavior: "contain",
                  pointerEvents: "auto",
                }}
              >
                {displayCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleSelect(cat)}
                    style={{
                      ...itemStyle,
                      background:
                        value === cat
                          ? "hsl(var(--primary) / 0.08)"
                          : "transparent",
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
                  paddingBottom: "max(12px, env(safe-area-inset-bottom))",
                  pointerEvents: "auto",
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
                      onClick={handleAddCategory}
                      disabled={addCategory.isPending || !newCategory.trim()}
                      data-ocid="category.confirm_button"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-11 w-11 shrink-0"
                      onClick={() => {
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
                    onClick={() => setShowAddInput(true)}
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
                      pointerEvents: "auto",
                      minHeight: "48px",
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
