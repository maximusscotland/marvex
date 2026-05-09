import { useCallback } from "react";
import { toast } from "sonner";
import {
  exportMapAsPng,
  exportMapAsHighResPng,
  exportMapAsSvg,
  exportMapAsMarkdown,
  exportMapAsPdf,
  captureScreenRegion,
} from "@/lib/exportPng";

const safeName = (title) => (title || "mindmap").replace(/[^\w-]+/g, "_");

/**
 * useExportHandlers — wraps the toolbar's export operations with toast
 * loading/success/error UX. Pure side-effect functions; no state.
 */
export default function useExportHandlers(map) {
  const handleExportPng = useCallback(async () => {
    try {
      toast.loading("Rendering PNG…", { id: "exp-png" });
      await exportMapAsPng(map, `${safeName(map.title)}.png`, 2);
      toast.success("PNG downloaded", { id: "exp-png" });
    } catch (e) {
      toast.error(`PNG export failed: ${e.message || e}`, { id: "exp-png" });
    }
  }, [map]);

  const handleExportHighResPng = useCallback(async () => {
    try {
      toast.loading("Rendering high-res PNG (4×)…", { id: "exp-png4" });
      await exportMapAsHighResPng(map, `${safeName(map.title)}@4x.png`);
      toast.success("High-res PNG downloaded", { id: "exp-png4" });
    } catch (e) {
      toast.error(`PNG export failed: ${e.message || e}`, { id: "exp-png4" });
    }
  }, [map]);

  const handleExportSvg = useCallback(() => {
    try {
      exportMapAsSvg(map, `${safeName(map.title)}.svg`);
      toast.success("SVG downloaded");
    } catch (e) {
      toast.error(`SVG export failed: ${e.message || e}`);
    }
  }, [map]);

  const handleExportMarkdown = useCallback(() => {
    try {
      exportMapAsMarkdown(map, `${safeName(map.title)}.md`);
      toast.success("Markdown downloaded");
    } catch (e) {
      toast.error(`Markdown export failed: ${e.message || e}`);
    }
  }, [map]);

  const handleExportPdf = useCallback(async () => {
    try {
      toast.loading("Building PDF…", { id: "exp-pdf" });
      await exportMapAsPdf(map, `${safeName(map.title)}.pdf`);
      toast.success("PDF downloaded", { id: "exp-pdf" });
    } catch (e) {
      toast.error(`PDF export failed: ${e.message || e}`, { id: "exp-pdf" });
    }
  }, [map]);

  const handleScreenshot = useCallback(async () => {
    try {
      await captureScreenRegion(`${safeName(map.title)}-screenshot.png`);
      toast.success("Screenshot saved");
    } catch (e) {
      if (String(e?.name) === "NotAllowedError") {
        toast("Screenshot cancelled");
      } else {
        toast.error(`Screenshot failed: ${e.message || e}`);
      }
    }
  }, [map]);

  return {
    handleExportPng,
    handleExportHighResPng,
    handleExportSvg,
    handleExportMarkdown,
    handleExportPdf,
    handleScreenshot,
  };
}
