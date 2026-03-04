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

// Detect touch-only device (iPhone, iPad, Android)
function isTouchDevice(): boolean {
  return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}

// ─────────────────────────────────────────────────────────────────────────────
// MOBILE: Native <select> — 100% reliable on iOS Safari
// ─────────────────────────────────────────────────────────────────────────────
function MobileCategorySelect({
  categories,
  value,
  onChange,
}: CategorySelectProps) {
  const [showAddInput, setShowAddInput] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const addCategory = useAddCategory();
  const addInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showAddInput) {
      setTimeout(() => addInputRef.current?.focus(), 100);
    }
  }, [showAddInput]);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    if (selected === "__add_new__") {
      // Reset select back to current value so it doesn't show "+ Add new…"
      e.target.value = value || "";
      setShowAddInput(true);
      setNewCategory("");
    } else {
      onChange(selected);
      setShowAddInput(false);
    }
  };

  const handleSaveNewCategory = async () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    // Set the value immediately so validation passes right away
    onChange(trimmed);
    setShowAddInput(false);
    setNewCategory("");
    if (categories.includes(trimmed)) {
      return;
    }
    try {
      await addCategory.mutateAsync(trimmed);
      toast.success(`Category "${trimmed}" added`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      // "already exists" means the category is already in the backend — treat
      // it as a success since the value is already set and usable.
      if (msg.toLowerCase().includes("already")) {
        return;
      }
      toast.error(
        "Failed to save category — it will still be used for this entry",
      );
    }
  };

  // Categories to show in the select — include the current value even if it
  // isn't in the list yet (e.g. a newly typed category before the backend
  // query refreshes)
  const selectOptions =
    value && !categories.includes(value) ? [...categories, value] : categories;

  return (
    <div className="space-y-2">
      {/* Native select wrapper */}
      <div className="relative" data-ocid="scan.category_select">
        <select
          value={value || ""}
          onChange={handleSelectChange}
          style={{
            WebkitAppearance: "none",
            MozAppearance: "none",
            appearance: "none",
          }}
          className="w-full h-12 px-4 pr-10 rounded-md border border-border bg-card text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
        >
          <option value="" disabled>
            Select category…
          </option>
          {selectOptions.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
          <option value="__add_new__">+ Add new category…</option>
        </select>
        {/* Custom chevron — pointer-events: none so it doesn't block the select */}
        <ChevronDown
          className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
          aria-hidden="true"
        />
      </div>

      {/* Inline "add new" input — appears below the select when chosen */}
      {showAddInput && (
        <div
          className="flex gap-2 items-center pt-1"
          data-ocid="category.add_input"
        >
          <Input
            ref={addInputRef}
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="New category name…"
            className="h-11 bg-card flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveNewCategory();
              if (e.key === "Escape") {
                setShowAddInput(false);
                setNewCategory("");
              }
            }}
            data-ocid="category.new_input"
          />
          <Button
            type="button"
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={handleSaveNewCategory}
            disabled={addCategory.isPending || !newCategory.trim()}
            data-ocid="category.confirm_button"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            type="button"
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
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DESKTOP: Custom scrollable overlay dropdown
// ─────────────────────────────────────────────────────────────────────────────
function DesktopCategorySelect({
  categories,
  value,
  onChange,
}: CategorySelectProps) {
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [showAddInput, setShowAddInput] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const addCategory = useAddCategory();
  const addInputRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (showAddInput) {
      setTimeout(() => addInputRef.current?.focus(), 50);
    }
  }, [showAddInput]);

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
      <button
        ref={triggerRef}
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

      {overlayOpen &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 999999,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              pointerEvents: "auto",
            }}
          >
            {/* Backdrop — uses a button for keyboard accessibility */}
            <button
              type="button"
              aria-label="Close category picker"
              style={{
                position: "absolute",
                inset: 0,
                backgroundColor: "rgba(0,0,0,0.5)",
                border: "none",
                cursor: "default",
                padding: 0,
              }}
              onClick={handleClose}
            />

            {/* Panel */}
            <div
              style={{
                position: "relative",
                background: "hsl(var(--background))",
                borderTopLeftRadius: "1rem",
                borderTopRightRadius: "1rem",
                boxShadow: "0 -4px 32px rgba(0,0,0,0.15)",
                display: "flex",
                flexDirection: "column",
                maxHeight: "70vh",
              }}
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

              {/* Scrollable list */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
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
                      background:
                        value === cat
                          ? "hsl(var(--primary) / 0.08)"
                          : "transparent",
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

              {/* Add new */}
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
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC EXPORT: Route to mobile or desktop variant
// ─────────────────────────────────────────────────────────────────────────────
export function CategorySelect(props: CategorySelectProps) {
  // Detect on first render; no need to react to changes mid-session
  const [isTouch] = useState(() => isTouchDevice());

  if (isTouch) {
    return <MobileCategorySelect {...props} />;
  }

  return <DesktopCategorySelect {...props} />;
}
