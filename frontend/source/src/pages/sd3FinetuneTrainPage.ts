import { renderTrainingPage } from "./trainingPage";

export function renderSd3FinetuneTrainPage() {
  return renderTrainingPage({
    prefix: "sd3-finetune",
    heroKicker: "sd3 finetune",
    heroTitle: "SD3 Finetune 训练",
    heroLede: "SD3 全量微调页继续走同一套桥接层，方便保持参数构造、预检查和提交流程一致。",
    runnerTitle: "SD3 Finetune 训练",
    startButtonLabel: "开始 SD3 Finetune",
    legacyPath: "/lora/sd3-finetune.html",
    legacyLabel: "打开当前随包 SD3 Finetune 页面",
    renderedTitle: "SD3 Finetune 参数表单",
  });
}
