import { renderTrainingPage } from "./trainingPage";

export function renderLuminaTrainPage() {
  return renderTrainingPage({
    prefix: "lumina",
    heroKicker: "lumina train",
    heroTitle: "Lumina LoRA 训练",
    heroLede: "Lumina LoRA 训练入口已经并入统一桥接层，方便后续继续整理参数与可维护性。",
    runnerTitle: "Lumina LoRA 训练",
    startButtonLabel: "开始 Lumina LoRA 训练",
    legacyPath: "/lora/lumina.html",
    legacyLabel: "打开当前随包 Lumina LoRA 页面",
    renderedTitle: "Lumina LoRA 参数表单",
  });
}
