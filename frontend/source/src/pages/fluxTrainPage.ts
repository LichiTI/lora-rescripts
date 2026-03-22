import { renderTrainingPage } from "./trainingPage";

export function renderFluxTrainPage() {
  return renderTrainingPage({
    prefix: "flux",
    heroKicker: "flux train",
    heroTitle: "Flux LoRA source training page",
    heroLede:
      "This route reuses the source-side training bridge for Flux so we can keep payload shaping, compatibility checks and launch behavior aligned with the current backend.",
    runnerTitle: "Flux source-side runner",
    startButtonLabel: "Start Flux training",
    legacyPath: "/lora/flux.html",
    legacyLabel: "Open current shipped Flux page",
    renderedTitle: "Flux form bridge",
  });
}
