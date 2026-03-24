import { renderTrainingPage } from "./trainingPage";

export function renderFluxControlNetTrainPage() {
  return renderTrainingPage({
    prefix: "flux-controlnet",
    heroKicker: "flux controlnet",
    heroTitle: "Flux ControlNet 训练",
    heroLede: "Flux ControlNet 训练入口也走同一套桥接层，方便统一管理参数、预检查和后端提交。",
    runnerTitle: "Flux ControlNet 训练",
    startButtonLabel: "开始 Flux ControlNet 训练",
    legacyPath: "/lora/flux-controlnet.html",
    legacyLabel: "打开当前随包 Flux ControlNet 页面",
    renderedTitle: "Flux ControlNet 参数表单",
  });
}
