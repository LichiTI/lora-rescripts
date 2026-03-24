import { renderTrainingPage } from "./trainingPage";

export function renderSdControlNetTrainPage() {
  return renderTrainingPage({
    prefix: "sd-controlnet",
    heroKicker: "sd controlnet",
    heroTitle: "SD ControlNet 训练",
    heroLede: "SD ControlNet 页继续沿用统一训练桥接层，方便和其它训练页保持相同的启动与检查体验。",
    runnerTitle: "SD ControlNet 训练",
    startButtonLabel: "开始 SD ControlNet 训练",
    legacyPath: "/lora/controlnet.html",
    legacyLabel: "打开当前随包 SD ControlNet 页面",
    renderedTitle: "SD ControlNet 参数表单",
  });
}
