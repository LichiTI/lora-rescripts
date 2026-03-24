import { renderTrainingPage } from "./trainingPage";

export function renderLuminaFinetuneTrainPage() {
  return renderTrainingPage({
    prefix: "lumina-finetune",
    heroKicker: "lumina finetune",
    heroTitle: "Lumina Finetune 训练",
    heroLede: "Lumina 全量微调页也继续走统一桥接层，方便把配置、预检查和启动流程保持一致。",
    runnerTitle: "Lumina Finetune 训练",
    startButtonLabel: "开始 Lumina Finetune",
    legacyPath: "/lora/lumina-finetune.html",
    legacyLabel: "打开当前随包 Lumina Finetune 页面",
    renderedTitle: "Lumina Finetune 参数表单",
  });
}
