import { renderTrainingPage } from "./trainingPage";

export function renderSdxlTextualInversionTrainPage() {
  return renderTrainingPage({
    prefix: "sdxl-ti",
    heroKicker: "sdxl textual inversion",
    heroTitle: "SDXL Textual Inversion 训练",
    heroLede: "SDXL Textual Inversion 训练页也已接入统一桥接层，方便持续整理参数和运行流程。",
    runnerTitle: "SDXL Textual Inversion 训练",
    startButtonLabel: "开始 SDXL Textual Inversion",
    legacyPath: "/lora/sdxl-ti.html",
    legacyLabel: "打开当前随包 SDXL Textual Inversion 页面",
    renderedTitle: "SDXL Textual Inversion 参数表单",
  });
}
