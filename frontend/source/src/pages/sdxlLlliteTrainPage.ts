import { renderTrainingPage } from "./trainingPage";

export function renderSdxlLlliteTrainPage() {
  return renderTrainingPage({
    prefix: "sdxl-lllite",
    heroKicker: "sdxl lllite",
    heroTitle: "SDXL LLLite 训练",
    heroLede: "SDXL LLLite 训练入口已经并入源码版训练桥接层，方便保持参数生成、检查与启动流程一致。",
    runnerTitle: "SDXL LLLite 训练",
    startButtonLabel: "开始 SDXL LLLite 训练",
    legacyPath: "/lora/sdxl-lllite.html",
    legacyLabel: "打开当前随包 SDXL LLLite 页面",
    renderedTitle: "SDXL LLLite 参数表单",
  });
}
