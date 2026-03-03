import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAddCategory } from "@/hooks/useQueries";
import { Check, Plus } from "lucide-react";
import { useState } from "react";
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
  const [showAddInput, setShowAddInput] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [selectOpen, setSelectOpen] = useState(false);
  const addCategory = useAddCategory();

  const handleAddCategory = async () => {
    const trimmed = newCategory.trim();
    if (!trimmed) return;
    if (categories.includes(trimmed)) {
      onChange(trimmed);
      setShowAddInput(false);
      setNewCategory("");
      return;
    }

    try {
      await addCategory.mutateAsync(trimmed);
      onChange(trimmed);
      setShowAddInput(false);
      setNewCategory("");
      toast.success(`Category "${trimmed}" added`);
    } catch {
      toast.error("Failed to add category");
    }
  };

  return (
    <div className="space-y-2">
      <Select
        value={value}
        onValueChange={(v) => {
          if (v === "__add_new__") {
            setShowAddInput(true);
            setSelectOpen(false);
          } else {
            onChange(v);
            setShowAddInput(false);
          }
        }}
        open={selectOpen}
        onOpenChange={setSelectOpen}
      >
        <SelectTrigger
          className="h-12 text-base bg-card border-border"
          data-ocid="scan.category_select"
        >
          <SelectValue placeholder="Select category…" />
        </SelectTrigger>
        <SelectContent className="max-h-[50vh] overflow-y-auto">
          {categories.map((cat) => (
            <SelectItem key={cat} value={cat} className="text-base py-3">
              {cat}
            </SelectItem>
          ))}
          <SelectSeparator />
          <SelectItem
            value="__add_new__"
            className="text-primary font-medium py-3"
          >
            <div className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add new category…
            </div>
          </SelectItem>
        </SelectContent>
      </Select>

      {showAddInput && (
        <div className="flex gap-2">
          <Input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Category name…"
            className="h-11 bg-card"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddCategory();
              if (e.key === "Escape") {
                setShowAddInput(false);
                setNewCategory("");
              }
            }}
            autoFocus
            data-ocid="scan.add_category_input"
          />
          <Button
            size="icon"
            className="h-11 w-11 shrink-0"
            onClick={handleAddCategory}
            disabled={addCategory.isPending || !newCategory.trim()}
          >
            <Check className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
