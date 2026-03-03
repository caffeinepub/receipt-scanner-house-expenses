export interface OcrResult {
  date: string;
  companyName: string;
  amount: number;
  rawText: string;
  confidence: number;
}

type TesseractWorker = {
  recognize(image: string | Blob | File): Promise<{
    data: { text: string; confidence: number };
  }>;
  terminate(): Promise<void>;
};

type TesseractLib = {
  createWorker(lang: string): Promise<TesseractWorker>;
};

type WindowWithTesseract = Window &
  typeof globalThis & { Tesseract?: TesseractLib };

let tesseractLoading: Promise<TesseractLib> | null = null;

async function getTesseract(): Promise<TesseractLib> {
  const win = window as WindowWithTesseract;
  if (win.Tesseract) return win.Tesseract;

  if (!tesseractLoading) {
    tesseractLoading = new Promise<TesseractLib>((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
      script.onload = () => {
        const lib = (window as WindowWithTesseract).Tesseract;
        if (lib) {
          resolve(lib);
        } else {
          reject(new Error("Tesseract did not attach to window"));
        }
      };
      script.onerror = () =>
        reject(new Error("Failed to load Tesseract from CDN"));
      document.head.appendChild(script);
    });
  }

  return tesseractLoading;
}

/**
 * Parse a date string from OCR text.
 * Tries common receipt date formats.
 */
function parseDate(text: string): string {
  const today = new Date().toISOString().split("T")[0];

  const patterns = [
    // MM/DD/YYYY or M/D/YYYY
    /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/,
    // MM-DD-YYYY
    /\b(\d{1,2})-(\d{1,2})-(\d{4})\b/,
    // YYYY-MM-DD
    /\b(\d{4})-(\d{2})-(\d{2})\b/,
    // Month DD, YYYY (e.g. January 15, 2024)
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b/i,
    // DD Month YYYY
    /\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b/i,
  ];

  const monthMap: Record<string, string> = {
    jan: "01",
    feb: "02",
    mar: "03",
    apr: "04",
    may: "05",
    jun: "06",
    jul: "07",
    aug: "08",
    sep: "09",
    oct: "10",
    nov: "11",
    dec: "12",
  };

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;

    try {
      // YYYY-MM-DD
      if (/^\d{4}/.test(match[1])) {
        return `${match[1]}-${match[2]}-${match[3]}`;
      }

      // Month DD YYYY (named month first)
      if (/[a-z]/i.test(match[1])) {
        const month = monthMap[match[1].toLowerCase().slice(0, 3)];
        if (month) {
          const day = match[2].padStart(2, "0");
          return `${match[3]}-${month}-${day}`;
        }
      }

      // DD Month YYYY (number first, named month second)
      if (/[a-z]/i.test(match[2])) {
        const month = monthMap[match[2].toLowerCase().slice(0, 3)];
        if (month) {
          const day = match[1].padStart(2, "0");
          return `${match[3]}-${month}-${day}`;
        }
      }

      // MM/DD/YYYY or MM-DD-YYYY
      const month = match[1].padStart(2, "0");
      const day = match[2].padStart(2, "0");
      return `${match[3]}-${month}-${day}`;
    } catch {
      // skip this pattern and try the next one
    }
  }

  return today;
}

/**
 * Extract total amount from OCR text.
 * Looks for TOTAL, GRAND TOTAL, AMOUNT DUE, BALANCE DUE keywords.
 */
function parseAmount(text: string): number {
  const lines = text.split("\n");

  // Priority keywords — higher = check first
  const totalKeywords = [
    /grand\s*total/i,
    /balance\s*due/i,
    /amount\s*due/i,
    /total\s*due/i,
    /total\s*amount/i,
    /^total[\s:$]*/i,
    /\btotal\b/i,
  ];

  for (const keyword of totalKeywords) {
    for (const line of lines) {
      if (keyword.test(line)) {
        // Look for a dollar amount in this line
        const amountMatch = line.match(/\$?\s*(\d{1,6}[.,]\d{2})\b/);
        if (amountMatch) {
          const cleaned = amountMatch[1].replace(",", ".");
          return Number.parseFloat(cleaned);
        }
        // Look in next line too
        const idx = lines.indexOf(line);
        if (idx < lines.length - 1) {
          const nextLine = lines[idx + 1];
          const nextMatch = nextLine.match(/\$?\s*(\d{1,6}[.,]\d{2})\b/);
          if (nextMatch) {
            const cleaned = nextMatch[1].replace(",", ".");
            return Number.parseFloat(cleaned);
          }
        }
      }
    }
  }

  // Fallback: find the largest dollar amount on the receipt
  const allAmounts: number[] = [];
  const amountRegex = /\$\s*(\d{1,6}[.,]\d{2})\b/g;
  let m: RegExpExecArray | null;
  // biome-ignore lint/suspicious/noAssignInExpressions: standard regex loop
  while ((m = amountRegex.exec(text)) !== null) {
    allAmounts.push(Number.parseFloat(m[1].replace(",", ".")));
  }

  if (allAmounts.length > 0) {
    return Math.max(...allAmounts);
  }

  return 0;
}

/**
 * Extract company/vendor name from the receipt.
 * Usually appears in the first few non-empty lines.
 */
function parseCompanyName(text: string): string {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 1);

  // Skip lines that look like addresses, dates, or receipt headers
  const skipPatterns = [
    /^\d+\s+\w+/, // street address
    /\d{3}[-.\s]\d{3}[-.\s]\d{4}/, // phone number
    /www\./i,
    /receipt|invoice|order|ticket|bill/i,
    /^\d{1,2}\/\d{1,2}\/\d{2,4}$/, // just a date
    /thank\s*you/i,
    /welcome/i,
    /^[\W\d]+$/, // only symbols/numbers
  ];

  for (const line of lines.slice(0, 6)) {
    const shouldSkip = skipPatterns.some((p) => p.test(line));
    if (!shouldSkip && line.length >= 3 && line.length <= 60) {
      // Clean up noise
      return line
        .replace(/[*#@!{}[\]\\|<>]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }
  }

  // Return first non-empty line as fallback
  return lines[0]?.slice(0, 50) ?? "Unknown Vendor";
}

/**
 * Run OCR on an image file or blob and extract receipt fields.
 */
export async function runOcr(imageSource: File | Blob): Promise<OcrResult> {
  const Tesseract = await getTesseract();
  const worker = await Tesseract.createWorker("eng");

  try {
    const imageUrl = URL.createObjectURL(imageSource);
    const result = await worker.recognize(imageUrl);
    URL.revokeObjectURL(imageUrl);

    const rawText = result.data.text;
    const confidence = result.data.confidence;

    return {
      date: parseDate(rawText),
      companyName: parseCompanyName(rawText),
      amount: parseAmount(rawText),
      rawText,
      confidence,
    };
  } finally {
    await worker.terminate();
  }
}
