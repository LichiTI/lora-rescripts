import { renderTrainingPage } from "./trainingPage";

export function renderFluxControlNetTrainPage() {
  return renderTrainingPage({
    prefix: "flux-controlnet",
    heroKicker: "flux controlnet",
    heroTitle: "Flux ControlNet source training page",
    heroLede:
      "This route reuses the same source-side training bridge for Flux ControlNet so the DiT-family conditioning workflow stays aligned with the current backend schema and payload rules.",
    runnerTitle: "Flux ControlNet source-side runner",
    startButtonLabel: "Start Flux ControlNet training",
    legacyPath: "/lora/flux-controlnet.html",
    legacyLabel: "Open current shipped Flux ControlNet page",
    renderedTitle: "Flux ControlNet form bridge",
  });
}
