# Receipt Scanner - House Expenses

## Current State
- ScanModal has a "Company (Column B)" field that is a plain text Input. OCR fills it in, but it may produce garbled text.
- CategorySelect uses a shadcn Select with a scrollable list of categories.
- The ScanModal's capture step renders a camera button (green "Open Camera" Button) inside a `flex-1` container. The bottom nav bar is `fixed bottom-0` and overlaps the bottom of the Sheet content, obscuring the button.
- All dropdowns (category, house selector) render inside `SelectContent` which uses a `max-h` CSS variable but may not be explicitly capped for small phone screens.

## Requested Changes (Diff)

### Add
- A `CompanySelect` component (similar to `CategorySelect`) that:
  - Shows a text Input pre-filled with OCR value.
  - If OCR text does not look like valid English words (heuristic: contains non-alphabetic/non-common characters, or confidence < 60%, or text has no recognizable word pattern), automatically show a dropdown alongside/below the input allowing the user to pick from the full list of existing company names already stored across all four sheets (Cabin, Milton, Fife, Tacoma).
  - The dropdown must be scrollable and capped in height so it fits on a phone screen.
  - User can still type manually or pick from the dropdown.
- A `useAllCompanyNames` hook in `useQueries.ts` that collects all unique, non-empty `companyName` values from all entries across all sheets, sorted alphabetically, deduplicated.

### Modify
- **ScanModal capture step**: Add bottom padding / safe-area spacing to the capture step container so the "Open Camera" button is not hidden behind the fixed bottom nav bar. The capture container should use `pb-safe` or explicit bottom padding (`pb-28` or similar) to push content above the nav.
- **Company field in ScanModal review step**: Replace the plain `<Input>` for company name with the new `<CompanySelect>` component.
- **CategorySelect dropdown**: Ensure `SelectContent` has an explicit `max-h` (e.g. `max-h-[50vh]`) and `overflow-y-auto` so the list is always scrollable on small screens.
- **House selector**: Already uses inline buttons, no change needed.

### Remove
- Nothing removed.

## Implementation Plan
1. Add `useAllCompanyNames` hook to `useQueries.ts` — queries all entries and extracts unique company names.
2. Create `src/components/CompanySelect.tsx` — combines text input + conditional dropdown of known companies. Show dropdown when OCR confidence is low OR text looks garbled (helper: `looksLikeGarbled(text)` — returns true if the string has mostly non-letter chars, all-caps run > 8 chars with no spaces, or matches no common word pattern).
3. Update `ScanModal.tsx`:
   - Capture step: add `pb-28` (or `pb-[calc(7rem+env(safe-area-inset-bottom))]`) to the outer flex container so the camera button clears the fixed nav.
   - Review step: swap `<Input>` for company with `<CompanySelect>`, passing `ocrResult?.confidence` and `existingCompanies` from the new hook.
4. Update `CategorySelect.tsx`: add `className="max-h-[50vh] overflow-y-auto"` to `<SelectContent>`.
