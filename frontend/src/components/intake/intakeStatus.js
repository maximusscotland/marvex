/**
 * Shared status constants for the PDF intake queue.
 * Kept in a tiny standalone module so both IntakeStudio and IntakeCard can
 * import them without circular references.
 */
export const STATUS = {
  QUEUED: "queued",
  PARSING: "parsing",
  PREVIEW: "preview",
  DONE: "done",
  FAILED: "failed",
};

export const statusLabel = {
  [STATUS.QUEUED]: "Queued",
  [STATUS.PARSING]: "Extracting…",
  [STATUS.PREVIEW]: "Ready to review",
  [STATUS.DONE]: "Map created",
  [STATUS.FAILED]: "Needs OCR",
};
