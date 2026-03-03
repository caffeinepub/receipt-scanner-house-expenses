import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import type { ExpenseEntry } from "../backend.d";
import { useActor } from "./useActor";

export type { ExpenseEntry };

export const SHEETS = ["Cabin", "Milton", "Fife", "Tacoma"] as const;
export type SheetName = (typeof SHEETS)[number];

export const DEFAULT_CATEGORIES = [
  "Advertising",
  "Association Dues",
  "Auto and Travel",
  "Cleaning and Maintenance",
  "Commissions",
  "Gardening",
  "Insurance",
  "Legal and Professional Fees",
  "Licenses and Permits",
  "Management Fees",
  "Miscellaneous",
  "Mortgage Interest",
  "Excess Mortgage Interest",
  "Other Interest (not entered elsewhere)",
  "Painting and Decorating",
  "Pest Control",
  "Plumbing and Electrical",
  "Repairs",
  "Supplies",
  "Taxes - Real Estate",
  "Taxes - Other (not entered elsewhere)",
  "Telephone",
  "Wages and Salaries",
  "Other",
];

// ── Categories ──────────────────────────────────────────────────
export function useCategories() {
  const { actor, isFetching } = useActor();
  return useQuery<string[]>({
    queryKey: ["categories"],
    queryFn: async () => {
      if (!actor) return DEFAULT_CATEGORIES;
      const cats = await actor.getAllCategories();
      // Always use DEFAULT_CATEGORIES as the base list.
      // Append any user-added custom categories from the backend
      // that are not already in the default list.
      const customExtras = cats.filter((c) => !DEFAULT_CATEGORIES.includes(c));
      return [...DEFAULT_CATEGORIES, ...customExtras];
    },
    enabled: !!actor && !isFetching,
    staleTime: 1000 * 60 * 5,
  });
}

export function useAddCategory() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (category: string) => {
      if (!actor) throw new Error("No actor");
      await actor.addCategory(category);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

// ── Entries ──────────────────────────────────────────────────────
export function useAllEntries() {
  const { actor, isFetching } = useActor();
  return useQuery<ExpenseEntry[]>({
    queryKey: ["entries"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllEntries();
    },
    enabled: !!actor && !isFetching,
    staleTime: 1000 * 30,
  });
}

export function useSheetEntries(sheet: string) {
  const { actor, isFetching } = useActor();
  return useQuery<ExpenseEntry[]>({
    queryKey: ["entries", sheet],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getEntriesForSheet(sheet);
    },
    enabled: !!actor && !isFetching,
    staleTime: 1000 * 30,
  });
}

export function useAddEntry() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      sheet: string;
      date: string;
      companyName: string;
      category: string;
      amount: number;
      notes: string;
    }) => {
      if (!actor) throw new Error("No actor");
      const createdAt = BigInt(Date.now());
      return actor.addExpenseEntry(
        data.sheet,
        data.date,
        data.companyName,
        data.category,
        data.amount,
        data.notes,
        createdAt,
      );
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["entries"] });
      qc.invalidateQueries({ queryKey: ["entries", vars.sheet] });
    },
  });
}

export function useUpdateEntry() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      id: bigint;
      sheet: string;
      date: string;
      companyName: string;
      category: string;
      amount: number;
      notes: string;
      createdAt: bigint;
    }) => {
      if (!actor) throw new Error("No actor");
      await actor.updateExpenseEntry(
        data.id,
        data.sheet,
        data.date,
        data.companyName,
        data.category,
        data.amount,
        data.notes,
        data.createdAt,
      );
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["entries"] });
      qc.invalidateQueries({ queryKey: ["entries", vars.sheet] });
    },
  });
}

export function useAllCompanyNames() {
  const { data: entries = [] } = useAllEntries();
  return useMemo(() => {
    const names = entries
      .map((e) => e.companyName?.trim())
      .filter((n): n is string => !!n && n.length > 0);
    return [...new Set(names)].sort((a, b) => a.localeCompare(b));
  }, [entries]);
}

export function useDeleteEntry() {
  const { actor } = useActor();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("No actor");
      await actor.deleteExpenseEntry(id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["entries"] });
    },
  });
}
