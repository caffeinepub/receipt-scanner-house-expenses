import { ScanModal } from "@/components/ScanModal";
import { SheetView } from "@/components/SheetView";
import { Toaster } from "@/components/ui/sonner";
import { useCategories } from "@/hooks/useQueries";
import type { SheetName } from "@/hooks/useQueries";
import { SHEETS } from "@/hooks/useQueries";
import { cn } from "@/lib/utils";
import { Camera, Home } from "lucide-react";
import { useState } from "react";

const HOUSE_COLORS: Record<SheetName, string> = {
  Cabin: "text-emerald-600",
  Milton: "text-blue-600",
  Fife: "text-amber-600",
  Tacoma: "text-violet-600",
};

const HOUSE_BG: Record<SheetName, string> = {
  Cabin: "bg-emerald-50",
  Milton: "bg-blue-50",
  Fife: "bg-amber-50",
  Tacoma: "bg-violet-50",
};

const NAV_IDS: Record<SheetName, string> = {
  Cabin: "nav.cabin_tab",
  Milton: "nav.milton_tab",
  Fife: "nav.fife_tab",
  Tacoma: "nav.tacoma_tab",
};

export default function App() {
  const [activeSheet, setActiveSheet] = useState<SheetName>("Cabin");
  const [scanOpen, setScanOpen] = useState(false);
  const { data: categories = [] } = useCategories();

  return (
    <div className="flex flex-col w-full max-w-[430px] mx-auto min-h-dvh bg-background relative overflow-hidden">
      {/* ── Status bar spacer (iOS safe area) ── */}
      <div
        className="h-safe-top"
        style={{ height: "env(safe-area-inset-top, 0px)" }}
      />

      {/* ── Header ── */}
      <header className="px-5 pt-4 pb-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-9 h-9 rounded-xl flex items-center justify-center",
              HOUSE_BG[activeSheet],
            )}
          >
            <Home className={cn("h-5 w-5", HOUSE_COLORS[activeSheet])} />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg leading-tight text-foreground">
              {activeSheet}
            </h1>
            <p className="text-xs text-muted-foreground">House Expenses</p>
          </div>
        </div>
        <div className="text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
          {new Date().getFullYear()}
        </div>
      </header>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-hidden flex flex-col safe-pb">
        <SheetView sheet={activeSheet} categories={categories} />
      </main>

      {/* ── Bottom Navigation ── */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-card/95 backdrop-blur-md border-t border-border bottom-nav z-50">
        <div className="flex items-end px-2 pt-2">
          {SHEETS.slice(0, 2).map((sheet) => (
            <NavTab
              key={sheet}
              label={sheet}
              active={activeSheet === sheet}
              onClick={() => setActiveSheet(sheet)}
              ocid={NAV_IDS[sheet]}
              color={HOUSE_COLORS[sheet]}
            />
          ))}

          {/* Center Scan Button */}
          <div className="flex flex-col items-center flex-1 -mt-5">
            <button
              type="button"
              onClick={() => setScanOpen(true)}
              className="w-16 h-16 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center transition-transform active:scale-95 tap-highlight-none"
              data-ocid="nav.scan_button"
              aria-label="Scan receipt"
            >
              <Camera className="h-7 w-7" />
            </button>
            <span className="text-[10px] font-medium text-primary mt-1 mb-1">
              Scan
            </span>
          </div>

          {SHEETS.slice(2, 4).map((sheet) => (
            <NavTab
              key={sheet}
              label={sheet}
              active={activeSheet === sheet}
              onClick={() => setActiveSheet(sheet)}
              ocid={NAV_IDS[sheet]}
              color={HOUSE_COLORS[sheet]}
            />
          ))}
        </div>
      </nav>

      {/* ── Scan Modal ── */}
      <ScanModal
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        onSaved={(sheet) => {
          setActiveSheet(sheet);
          setScanOpen(false);
        }}
        categories={categories}
        defaultSheet={activeSheet}
      />

      <Toaster position="top-center" richColors />

      {/* Footer attribution (hidden in mobile chrome) */}
      <div className="hidden">
        <p>
          © {new Date().getFullYear()}. Built with love using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(typeof window !== "undefined" ? window.location.hostname : "")}`}
            rel="noopener noreferrer"
            target="_blank"
          >
            caffeine.ai
          </a>
        </p>
      </div>
    </div>
  );
}

interface NavTabProps {
  label: string;
  active: boolean;
  onClick: () => void;
  ocid: string;
  color: string;
}

function NavTab({ label, active, onClick, ocid, color }: NavTabProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex-1 flex flex-col items-center gap-0.5 py-2 px-1 tap-highlight-none transition-colors",
        active ? "opacity-100" : "opacity-50",
      )}
      data-ocid={ocid}
      aria-pressed={active}
    >
      <div
        className={cn(
          "w-10 h-1 rounded-full mb-1 transition-opacity",
          active ? "opacity-100" : "opacity-0",
          color.replace("text-", "bg-"),
        )}
      />
      <Home
        className={cn(
          "h-5 w-5 transition-colors",
          active ? color : "text-muted-foreground",
        )}
      />
      <span
        className={cn(
          "text-[10px] font-medium",
          active ? color : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </button>
  );
}
