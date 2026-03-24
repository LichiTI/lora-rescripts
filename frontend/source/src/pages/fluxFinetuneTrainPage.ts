import { renderTrainingPage } from "./trainingPage";

export function renderFluxFinetuneTrainPage() {
  return renderTrainingPage({
    prefix: "flux-finetune",
    heroKicker: "flux finetune",
    heroTitle: "Flux Finetune 训练",
    heroLede: "Flux 全量微调页和 LoRA 路线共用同一套桥接逻辑，方便保持配方处理、预检查和启动行为一致。",
    runnerTitle: "Flux Finetune 训练",
    startButtonLabel: "开始 Flux Finetune",
    legacyPath: "/lora/flux-finetune.html",
    legacyLabel: "打开当前随包 Flux Finetune 页面",
    renderedTitle: "Flux Finetune 参数表单",
  });
}
