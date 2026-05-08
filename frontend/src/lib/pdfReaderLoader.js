/**
 * Shared pdfjs-dist loader for the PDF Reader + intake OCR.
 * Lazy imports the library so the landing/studio bundles don't pay for it.
 */
let _pdfjs = null;

export const loadPdfJs = async () => {
  if (_pdfjs) return _pdfjs;
  _pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  try {
    const workerModule = await import("pdfjs-dist/legacy/build/pdf.worker.mjs?url");
    if (workerModule?.default) {
      _pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;
    }
  } catch {
    // Fallback: let pdf.js use its CDN default.
  }
  return _pdfjs;
};
