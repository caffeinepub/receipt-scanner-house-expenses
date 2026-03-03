import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useState } from "react";

interface CompanySelectProps {
  value: string;
  onChange: (value: string) => void;
  existingCompanies: string[];
  ocrConfidence?: number;
}

function looksGarbled(text: string): boolean {
  if (!text || text.trim().length === 0) return true;

  const trimmed = text.trim();

  // More than 40% non-letter/non-space characters
  const nonLetterNonSpace = (trimmed.match(/[^a-zA-Z\s]/g) ?? []).length;
  if (nonLetterNonSpace / trimmed.length > 0.4) return true;

  // Longest run of letters without a space is > 12 chars and there are no spaces
  if (!trimmed.includes(" ") && trimmed.replace(/[^a-zA-Z]/g, "").length > 12)
    return true;

  // Contains 3+ consecutive digits
  if (/\d{3,}/.test(trimmed)) return true;

  return false;
}

export function CompanySelect({
  value,
  onChange,
  existingCompanies,
  ocrConfidence,
}: CompanySelectProps) {
  const [isFocused, setIsFocused] = useState(false);

  const showDropdown =
    existingCompanies.length > 0 &&
    (looksGarbled(value) ||
      (ocrConfidence !== undefined && ocrConfidence < 60));

  return (
    <div className="relative space-y-1">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => {
          // Delay to allow click on dropdown items to register
          setTimeout(() => setIsFocused(false), 200);
        }}
        placeholder="Vendor / store name"
        className="h-12 bg-card"
        data-ocid="scan.company_input"
      />

      {showDropdown && isFocused && existingCompanies.length > 0 && (
        <div
          className={cn(
            "absolute z-50 top-full left-0 right-0 mt-1",
            "rounded-xl border border-border bg-card shadow-md",
            "max-h-[45vh] overflow-y-auto",
          )}
          data-ocid="scan.company_select"
        >
          <p className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
            Select existing company
          </p>
          {existingCompanies.map((company) => (
            <button
              key={company}
              type="button"
              onMouseDown={(e) => {
                // Prevent blur before click fires
                e.preventDefault();
                onChange(company);
              }}
              className="py-2.5 px-4 text-left w-full hover:bg-muted text-sm transition-colors"
            >
              {company}
            </button>
          ))}
        </div>
      )}

      {showDropdown && !isFocused && (
        <div
          className={cn(
            "rounded-xl border border-border bg-card shadow-md",
            "max-h-[45vh] overflow-y-auto",
          )}
          data-ocid="scan.company_select"
        >
          <p className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
            Select existing company
          </p>
          {existingCompanies.map((company) => (
            <button
              key={company}
              type="button"
              onClick={() => onChange(company)}
              className="py-2.5 px-4 text-left w-full hover:bg-muted text-sm transition-colors"
            >
              {company}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
