import { renderTrainingPage } from "./trainingPage";

export function renderDreamboothTrainPage() {
  return renderTrainingPage({
    prefix: "dreambooth",
    heroKicker: "dreambooth train",
    heroTitle: "Dreambooth source training page",
    heroLede:
      "This route brings the Dreambooth and SDXL full-finetune schema into the same source-side training bridge so we can migrate one of the last big non-LoRA training paths cleanly.",
    runnerTitle: "Dreambooth source-side runner",
    startButtonLabel: "Start Dreambooth training",
    legacyPath: "/dreambooth/",
    legacyLabel: "Open current shipped Dreambooth page",
    renderedTitle: "Dreambooth form bridge",
  });
}
