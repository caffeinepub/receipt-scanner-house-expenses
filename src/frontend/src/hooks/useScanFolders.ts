import { useCallback, useState } from "react";

export interface ScanFolderEntry {
  id: string;
  imageDataUrl: string;
  savedAt: string; // ISO date string
  receiptDate: string; // date from OCR
  companyName: string;
  amount: number;
}

export interface ScanFolder {
  id: string;
  name: string;
  entries: ScanFolderEntry[];
}

const STORAGE_KEY = "scanFolders_v1";

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadFolders(): ScanFolder[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScanFolder[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

function saveFolders(folders: ScanFolder[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(folders));
  } catch {
    // ignore quota errors
  }
}

export function useScanFolders(): {
  folders: ScanFolder[];
  createFolder: (name: string) => ScanFolder;
  addEntryToFolder: (
    folderId: string,
    entry: Omit<ScanFolderEntry, "id">,
  ) => void;
} {
  const [folders, setFolders] = useState<ScanFolder[]>(loadFolders);

  const createFolder = useCallback((name: string): ScanFolder => {
    const newFolder: ScanFolder = {
      id: generateId(),
      name: name.trim(),
      entries: [],
    };
    setFolders((prev) => {
      const updated = [...prev, newFolder];
      saveFolders(updated);
      return updated;
    });
    return newFolder;
  }, []);

  const addEntryToFolder = useCallback(
    (folderId: string, entry: Omit<ScanFolderEntry, "id">) => {
      const newEntry: ScanFolderEntry = { ...entry, id: generateId() };
      setFolders((prev) => {
        const updated = prev.map((f) =>
          f.id === folderId ? { ...f, entries: [...f.entries, newEntry] } : f,
        );
        saveFolders(updated);
        return updated;
      });
    },
    [],
  );

  return { folders, createFolder, addEntryToFolder };
}
