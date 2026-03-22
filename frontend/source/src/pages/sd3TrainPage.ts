import { renderTrainingPage } from "./trainingPage";

export function renderSd3TrainPage() {
  return renderTrainingPage({
    prefix: "sd3",
    heroKicker: "sd3 train",
    heroTitle: "SD3 LoRA source training page",
    heroLede:
      "This route extends the same source-side training bridge to SD3 so we can keep the fast-moving schema-driven trainer paths on one shared foundation.",
    runnerTitle: "SD3 source-side runner",
    startButtonLabel: "Start SD3 training",
    legacyPath: "/lora/sd3.html",
    legacyLabel: "Open current shipped SD3 page",
    renderedTitle: "SD3 form bridge",
  });
}
