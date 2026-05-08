import React from "react";
import { Check, Loader2 } from "lucide-react";
import { STATUS } from "./intakeStatus";

/**
 * Pipeline progress bar — shows where a card is in the Parse → Map → Enrich →
 * Deep Research → Done pipeline. Steps adapt to the user's Enrich / Auto-deepen
 * toggles so a non-Pro card shows a leaner 3-step flow.
 *
 * Visual states:
 *   pending → hollow dot, muted text
 *   active  → animated cyan spinner
 *   done    → emerald check
 */
export default function IntakeProgress({ status, enrich, autoDeepen, runningAction }) {
  // Hide the bar entirely before parsing starts — queued+parsing already have
  // their own progress UI in the card header.
  if (status === STATUS.QUEUED || status === STATUS.FAILED) return null;

  const steps = buildSteps({ status, enrich, autoDeepen, runningAction });

  return (
    <div
      data-testid="intake-pipeline-progress"
      className="flex items-center gap-1.5 mt-2.5 pl-1 overflow-x-auto"
      aria-label="Pipeline progress"
    >
      {steps.map((step, i) => (
        <React.Fragment key={step.key}>
          <Pill step={step} />
          {i < steps.length - 1 && (
            <div
              className={`h-px w-5 shrink-0 ${
                steps[i + 1].state === "pending" ? "bg-white/10" : "bg-cyan-400/40"
              }`}
              aria-hidden
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function Pill({ step }) {
  const { state, label } = step;
  const toneClass =
    state === "done"
      ? "bg-emerald-400/15 border-emerald-400/40 text-emerald-200"
      : state === "active"
      ? "bg-cyan-400/15 border-cyan-400/50 text-cyan-100"
      : "bg-white/[0.02] border-white/10 text-[#566187]";
  return (
    <div
      data-testid={`intake-pipeline-step-${step.key}`}
      data-state={state}
      className={`mono text-[9px] uppercase tracking-[0.18em] flex items-center gap-1 px-2 py-1 rounded-full border shrink-0 ${toneClass}`}
      title={`${label} · ${state}`}
    >
      {state === "done" && <Check size={9} />}
      {state === "active" && <Loader2 size={9} className="animate-spin" />}
      {state === "pending" && <span className="w-1 h-1 rounded-full bg-current opacity-60" aria-hidden />}
      <span>{label}</span>
    </div>
  );
}

/**
 * Decide the state (pending / active / done) of each step from status +
 * toggles + the current running action. Steps are returned in pipeline order.
 */
function buildSteps({ status, enrich, autoDeepen, runningAction }) {
  const reachedPreview = status === STATUS.PREVIEW || status === STATUS.DONE;
  const reachedDone = status === STATUS.DONE;

  const steps = [
    {
      key: "parse",
      label: "Parse",
      state:
        status === STATUS.PARSING
          ? "active"
          : reachedPreview
          ? "done"
          : "pending",
    },
    {
      key: "map",
      label: "Map",
      state:
        runningAction === "mapping"
          ? "active"
          : reachedDone
          ? "done"
          : "pending",
    },
  ];

  if (enrich) {
    steps.push({
      key: "enrich",
      label: "Enrich",
      state:
        runningAction === "enriching"
          ? "active"
          : reachedDone
          ? "done"
          : "pending",
    });
  }

  if (autoDeepen) {
    steps.push({
      key: "deepen",
      label: "Deepen",
      state:
        runningAction === "deepening"
          ? "active"
          : reachedDone && runningAction !== "deepening"
          ? "done"
          : "pending",
    });
  }

  steps.push({
    key: "done",
    label: "Done",
    state: reachedDone && !runningAction ? "done" : "pending",
  });

  return steps;
}
