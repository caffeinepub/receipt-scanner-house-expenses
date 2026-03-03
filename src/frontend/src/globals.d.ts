// Ambient module declarations for packages loaded at runtime via CDN
// or bundled as externals.

declare module "tesseract.js" {
  export interface RecognizeResult {
    data: {
      text: string;
      confidence: number;
    };
  }

  export interface Worker {
    recognize(image: string | Blob | File): Promise<RecognizeResult>;
    terminate(): Promise<void>;
  }

  export function createWorker(lang: string): Promise<Worker>;
}
