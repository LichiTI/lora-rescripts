import { renderTrainingPage } from "./trainingPage";

export function renderSdTextualInversionTrainPage() {
  return renderTrainingPage({
    prefix: "sd-ti",
    heroKicker: "sd textual inversion",
    heroTitle: "SD Textual Inversion 训练",
    heroLede: "经典 SD Textual Inversion 训练页也被整理到统一桥接层里，方便继续维护和补全功能。",
    runnerTitle: "SD Textual Inversion 训练",
    startButtonLabel: "开始 SD Textual Inversion",
    legacyPath: "/lora/ti.html",
    legacyLabel: "打开当前随包 SD Textual Inversion 页面",
    renderedTitle: "SD Textual Inversion 参数表单",
  });
}
