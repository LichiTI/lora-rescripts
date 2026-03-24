import { renderTrainingPage } from "./trainingPage";

export function renderFluxTrainPage() {
  return renderTrainingPage({
    prefix: "flux",
    heroKicker: "flux train",
    heroTitle: "Flux LoRA 训练",
    heroLede: "Flux 路线沿用同一套源码版训练桥接层，方便把参数生成、兼容检查和启动行为统一整理下来。",
    runnerTitle: "Flux 训练",
    startButtonLabel: "开始 Flux 训练",
    legacyPath: "/lora/flux.html",
    legacyLabel: "打开当前随包 Flux 页面",
    renderedTitle: "Flux 参数表单",
  });
}
