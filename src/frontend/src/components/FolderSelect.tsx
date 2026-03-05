import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ScanFolder } from "@/hooks/useScanFolders";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, FolderPlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface FolderSelectProps {
  folders: ScanFolder[];
  value: string; // selected folder id, or ""
  onChange: (folderId: string) => void;
  onCreateFolder: (name: string) => ScanFolder;
  /** Called when the folder picker opens (true) or fully closes (false).
   *  Parents can use this to hide their Radix Sheet so the scroll-lock
   *  layer doesn't intercept touch events on the overlay. */
  onOpenChange?: (open: boolean) => void;
}

export function FolderSelect({
  folders,
  value,
  onChange,
  onCreateFolder,
  onOpenChange,
}: FolderSelectProps) {
  const [open, setOpen] = useState(false);
  const [showNewInput, setShowNewInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedFolder = folders.find((f) => f.id === value);

  useEffect(() => {
    if (showNewInput && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [showNewInput]);

  const handleSelect = (folderId: string) => {
    onChange(folderId);
    setOpen(false);
    setShowNewInput(false);
    setTimeout(() => onOpenChange?.(false), 50);
  };

  const handleCreateFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    const created = onCreateFolder(name);
    onChange(created.id);
    setNewFolderName("");
    setShowNewInput(false);
    setOpen(false);
    setTimeout(() => onOpenChange?.(false), 50);
  };

  const closeOverlay = () => {
    setOpen(false);
    setShowNewInput(false);
    setNewFolderName("");
    setTimeout(() => onOpenChange?.(false), 50);
  };

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => {
          onOpenChange?.(true);
          // Brief delay so parent Sheet can dismiss its scroll-lock before
          // the overlay renders — prevents iOS touch-event interception.
          setTimeout(() => setOpen(true), 60);
        }}
        className={cn(
          "w-full h-12 px-4 flex items-center justify-between gap-2",
          "rounded-xl border border-border bg-card text-sm",
          "transition-colors hover:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30",
          value ? "text-foreground" : "text-muted-foreground",
        )}
        data-ocid="scan.folder_select"
      >
        <span className="truncate flex items-center gap-2">
          <FolderPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
          {selectedFolder ? selectedFolder.name : "Select a folder… (optional)"}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="p-0.5 rounded hover:bg-muted transition-colors"
              aria-label="Clear folder selection"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          )}
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </span>
      </button>

      {/* Custom fixed overlay — avoids Radix portal issues inside Sheet */}
      {open && (
        <div className="fixed inset-0 z-[200] flex items-end">
          {/* Backdrop */}
          <button
            type="button"
            className="absolute inset-0 bg-black/40 cursor-default"
            aria-label="Close folder picker"
            onClick={closeOverlay}
          />

          {/* Bottom sheet panel */}
          <div className="relative w-full bg-card rounded-t-2xl max-h-[70vh] flex flex-col overflow-hidden shadow-xl">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border shrink-0">
              <span className="font-semibold text-base text-foreground">
                Save to Folder
              </span>
              <button
                type="button"
                onClick={closeOverlay}
                className="p-1.5 rounded-full hover:bg-muted transition-colors"
                aria-label="Close folder picker"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Folder list */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              {folders.length === 0 && !showNewInput && (
                <div className="px-5 py-8 text-center text-muted-foreground text-sm">
                  No folders yet — create one below
                </div>
              )}

              {folders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => handleSelect(folder.id)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-muted transition-colors text-left"
                >
                  <span className="text-sm font-medium text-foreground">
                    {folder.name}
                  </span>
                  <span className="text-xs text-muted-foreground mr-2 shrink-0">
                    {folder.entries.length} receipt
                    {folder.entries.length !== 1 ? "s" : ""}
                  </span>
                  {value === folder.id && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>

            {/* New folder input (inline) */}
            {showNewInput && (
              <div className="px-4 py-3 border-t border-border bg-muted/30 shrink-0">
                <div className="flex gap-2">
                  <Input
                    ref={inputRef}
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Folder name…"
                    className="h-11 bg-card text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateFolder();
                      if (e.key === "Escape") {
                        setShowNewInput(false);
                        setNewFolderName("");
                      }
                    }}
                    data-ocid="scan.folder_name_input"
                  />
                  <Button
                    size="sm"
                    className="h-11 px-4 shrink-0"
                    onClick={handleCreateFolder}
                    disabled={!newFolderName.trim()}
                    data-ocid="scan.folder_create_button"
                  >
                    Create
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewInput(false);
                      setNewFolderName("");
                    }}
                    className="h-11 w-11 flex items-center justify-center rounded-lg border border-border hover:bg-muted transition-colors shrink-0"
                    aria-label="Cancel"
                  >
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              </div>
            )}

            {/* Footer with create button */}
            {!showNewInput && (
              <div className="px-4 py-3 border-t border-border shrink-0">
                <button
                  type="button"
                  onClick={() => setShowNewInput(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-muted/40 transition-colors text-sm font-medium text-primary"
                >
                  <FolderPlus className="h-4 w-4" />
                  Create new folder…
                </button>
              </div>
            )}

            {/* iOS safe area bottom */}
            <div style={{ height: "env(safe-area-inset-bottom, 0px)" }} />
          </div>
        </div>
      )}
    </>
  );
}
