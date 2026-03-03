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

export function CategorySelect({
  categories,
  value,
  onChange,
}: CategorySelectProps) {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [showAddInput, setShowAddInput] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const addCategory = useAddCategory();
  const addInputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Focus the add input when it appears
  useEffect(() => {
    if (showAddInput) {
      setTimeout(() => addInputRef.current?.focus(), 50);
    }
  }, [showAddInput]);

  // Prevent body scroll while overlay is open
  useEffect(() => {
    if (overlayOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [overlayOpen]);

  const handleClose = () => {
    setOverlayOpen(false);
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
    if (categories.includes(trimmed)) {
      handleSelect(trimmed);
      return;
    }
    try {
      await addCategory.mutateAsync(trimmed);
      onChange(trimmed);
      handleClose();
      toast.success(`Category "${trimmed}" added`);
    } catch {
      toast.error("Failed to add category");
    }
  };

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOverlayOpen(true)}
        className="w-full h-12 px-4 flex items-center justify-between rounded-md border border-border bg-card text-base transition-colors hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
        data-ocid="scan.category_select"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {value || "Select category…"}
        </span>
        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
      </button>

      {/* Full-screen overlay rendered via portal to escape Sheet stacking context (iOS fix) */}
      {overlayOpen &&
        createPortal(
          <div
            ref={overlayRef}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 99999,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
            }}
          >
            {/* Backdrop */}
            <div
              role="button"
              tabIndex={-1}
              aria-label="Close category picker"
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.5)",
              }}
              onClick={handleClose}
              onKeyDown={(e) => {
                if (e.key === "Escape" || e.key === "Enter") handleClose();
              }}
            />

            {/* Bottom sheet panel */}
            <div
              role="presentation"
              style={{
                position: "relative",
                background: "hsl(var(--background))",
                borderTopLeftRadius: "1rem",
                borderTopRightRadius: "1rem",
                boxShadow: "0 -4px 32px rgba(0,0,0,0.15)",
                display: "flex",
                flexDirection: "column",
                maxHeight: "70dvh",
              }}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px 20px 12px",
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
                  }}
                  data-ocid="category.close_button"
                >
                  <X style={{ width: 16, height: 16 }} />
                </button>
              </div>

              {/* Category list */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  WebkitOverflowScrolling: "touch",
                }}
              >
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => handleSelect(cat)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 20px",
                      fontSize: "1rem",
                      textAlign: "left",
                      background: "transparent",
                      border: "none",
                      borderBottom: "1px solid hsl(var(--border) / 0.4)",
                      cursor: "pointer",
                      color: "hsl(var(--foreground))",
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
                      fontSize: "0.875rem",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                    data-ocid="category.add_new_button"
                  >
                    <Plus style={{ width: 16, height: 16 }} />
                    Add new category…
                  </button>
                )}
              </div>

              {/* Safe area spacer */}
              <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
