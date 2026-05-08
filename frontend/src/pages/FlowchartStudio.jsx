import React from "react";
import Studio from "@/pages/Studio";

/**
 * Flowchart Studio is a thin wrapper around the existing Studio page.
 * The whole canvas, toolbar, AI flows, share / save / export pipeline,
 * undo stacks, etc., are 100% reused — Studio simply switches into
 * "flowchart mode" when given the prop, which:
 *
 *   1. Seeds new files with a Start → I/O → Process → Decision → End
 *      flowchart instead of the standard Marvex concept-graph.
 *   2. Replaces the per-node + menu's "Add child" button with a 9-shape
 *      flowchart palette (Process, Decision, Start/End, I/O, Subprocess,
 *      Document, Database, Connector, Note).
 *   3. Filters the Library so flowchart-flagged maps don't pollute the
 *      Marvex Studio recents (and vice versa).
 *
 * Why one component instead of two? Studio.jsx is 2200 lines of carefully
 * tuned interaction logic — duplicating it would create two slow-drifting
 * codebases. A single mode flag keeps both products in lock-step for
 * future improvements (auto-save, sync, AI compile, etc.).
 */
export default function FlowchartStudio() {
  return <Studio mode="flowchart" />;
}
