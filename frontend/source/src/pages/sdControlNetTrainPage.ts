import { renderTrainingPage } from "./trainingPage";

export function renderSdControlNetTrainPage() {
  return renderTrainingPage({
    prefix: "sd-controlnet",
    heroKicker: "sd controlnet",
    heroTitle: "SD ControlNet source training page",
    heroLede:
      "This route extends the shared source-side training bridge to the SD1.x / SD2.x ControlNet workflow so conditioning-dataset training can migrate without another bespoke form stack.",
    runnerTitle: "SD ControlNet source-side runner",
    startButtonLabel: "Start SD ControlNet training",
    legacyPath: "/lora/controlnet.html",
    legacyLabel: "Open current shipped SD ControlNet page",
    renderedTitle: "SD ControlNet form bridge",
  });
}
