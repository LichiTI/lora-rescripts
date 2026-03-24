import { renderTrainingPage } from "./trainingPage";

export function renderDreamboothTrainPage() {
  return renderTrainingPage({
    prefix: "dreambooth",
    heroKicker: "dreambooth train",
    heroTitle: "Dreambooth 训练",
    heroLede: "这里承接 Dreambooth 和 SDXL 全量微调相关表单，尽量保持原有工作流，同时整理成更可维护的源码结构。",
    runnerTitle: "Dreambooth 训练",
    startButtonLabel: "开始 Dreambooth 训练",
    legacyPath: "/dreambooth/index.html",
    legacyLabel: "打开当前随包 Dreambooth 页面",
    renderedTitle: "Dreambooth 参数表单",
  });
}
