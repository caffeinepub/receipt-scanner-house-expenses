import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface ExpenseEntry {
    id: bigint;
    date: string;
    createdAt: bigint;
    sheet: string;
    notes: string;
    companyName: string;
    category: string;
    amount: number;
}
export interface backendInterface {
    addCategory(category: string): Promise<void>;
    addExpenseEntry(sheet: string, date: string, companyName: string, category: string, amount: number, notes: string, createdAt: bigint): Promise<ExpenseEntry>;
    deleteExpenseEntry(id: bigint): Promise<void>;
    getAllCategories(): Promise<Array<string>>;
    getAllEntries(): Promise<Array<ExpenseEntry>>;
    getEntriesForSheet(sheet: string): Promise<Array<ExpenseEntry>>;
    updateExpenseEntry(id: bigint, sheet: string, date: string, companyName: string, category: string, amount: number, notes: string, createdAt: bigint): Promise<void>;
}
