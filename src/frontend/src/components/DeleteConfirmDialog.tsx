import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDeleteEntry } from "@/hooks/useQueries";
import type { ExpenseEntry } from "@/hooks/useQueries";
import { toast } from "sonner";

interface DeleteConfirmDialogProps {
  entry: ExpenseEntry | null;
  open: boolean;
  onClose: () => void;
}

export function DeleteConfirmDialog({
  entry,
  open,
  onClose,
}: DeleteConfirmDialogProps) {
  const deleteEntry = useDeleteEntry();

  const handleDelete = async () => {
    if (!entry) return;
    try {
      await deleteEntry.mutateAsync(entry.id);
      toast.success("Entry deleted");
      onClose();
    } catch {
      toast.error("Failed to delete entry");
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="max-w-[340px] mx-4 rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display">
            Delete Entry?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the receipt entry for{" "}
            <strong>{entry?.companyName}</strong>
            {entry?.amount ? ` ($${entry.amount.toFixed(2)})` : ""}. This action
            cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel
            className="flex-1"
            data-ocid="delete.cancel_button"
          >
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
            data-ocid="delete.confirm_button"
          >
            {deleteEntry.isPending ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
