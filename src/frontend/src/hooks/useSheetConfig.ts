import {
  Briefcase,
  Building2,
  Car,
  DollarSign,
  Flame,
  Home,
  Landmark,
  Laptop,
  Package,
  Receipt,
  ShieldCheck,
  Stethoscope,
  Store,
  TreePine,
  Wrench,
  Zap,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";

export type IconName =
  | "Home"
  | "Building2"
  | "Car"
  | "Store"
  | "Briefcase"
  | "Wrench"
  | "Stethoscope"
  | "Receipt"
  | "Landmark"
  | "TreePine"
  | "Flame"
  | "Zap"
  | "ShieldCheck"
  | "Laptop"
  | "Package"
  | "DollarSign";

export const ICON_MAP: Record<IconName, React.ElementType> = {
  Home,
  Building2,
  Car,
  Store,
  Briefcase,
  Wrench,
  Stethoscope,
  Receipt,
  Landmark,
  TreePine,
  Flame,
  Zap,
  ShieldCheck,
  Laptop,
  Package,
  DollarSign,
};

export const ICON_LABELS: Record<IconName, string> = {
  Home: "Home",
  Building2: "Office",
  Car: "Car",
  Store: "Store",
  Briefcase: "Business",
  Wrench: "Repairs",
  Stethoscope: "Medical",
  Receipt: "Receipts",
  Landmark: "Mortgage",
  TreePine: "Yard",
  Flame: "Utilities",
  Zap: "Electric",
  ShieldCheck: "Insurance",
  Laptop: "Computer",
  Package: "Supplies",
  DollarSign: "Finance",
};

export const ICON_NAMES = Object.keys(ICON_MAP) as IconName[];

export interface SheetConfig {
  label: string;
  icon: IconName;
}

export type SheetConfigMap = Record<string, SheetConfig>;

const STORAGE_KEY = "sheetConfigs";

const DEFAULT_CONFIGS: SheetConfigMap = {
  Cabin: { label: "Cabin", icon: "Home" },
  Milton: { label: "Milton", icon: "Home" },
  Fife: { label: "Fife", icon: "Home" },
  Tacoma: { label: "Tacoma", icon: "Home" },
};

function loadFromStorage(): SheetConfigMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIGS;
    const parsed = JSON.parse(raw) as SheetConfigMap;
    // Merge with defaults so new sheet keys always have a config
    return { ...DEFAULT_CONFIGS, ...parsed };
  } catch {
    return DEFAULT_CONFIGS;
  }
}

export function useSheetConfig() {
  const [sheetConfigs, setSheetConfigs] =
    useState<SheetConfigMap>(loadFromStorage);

  // Sync to localStorage whenever configs change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sheetConfigs));
    } catch {
      // ignore quota errors
    }
  }, [sheetConfigs]);

  const updateSheetConfig = useCallback((key: string, config: SheetConfig) => {
    setSheetConfigs((prev) => ({ ...prev, [key]: config }));
  }, []);

  return { sheetConfigs, updateSheetConfig };
}
