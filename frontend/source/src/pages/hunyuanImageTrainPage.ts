import { renderTrainingPage } from "./trainingPage";

export function renderHunyuanImageTrainPage() {
  return renderTrainingPage({
    prefix: "hunyuan-image",
    heroKicker: "hunyuan image train",
    heroTitle: "Hunyuan Image LoRA 训练",
    heroLede: "Hunyuan Image 训练路线已经接入源码版桥接层，用来统一参数表单、检查和启动行为。",
    runnerTitle: "Hunyuan Image 训练",
    startButtonLabel: "开始 Hunyuan Image 训练",
    legacyPath: "/lora/hunyuan.html",
    legacyLabel: "打开当前随包 Hunyuan Image 页面",
    renderedTitle: "Hunyuan Image 参数表单",
  });
}
