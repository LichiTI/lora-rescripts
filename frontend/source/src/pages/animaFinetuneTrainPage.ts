import { renderTrainingPage } from "./trainingPage";

export function renderAnimaFinetuneTrainPage() {
  return renderTrainingPage({
    prefix: "anima-finetune",
    heroKicker: "anima finetune",
    heroTitle: "Anima Finetune 训练",
    heroLede: "Anima 全量微调页和其它训练页共用同一套桥接逻辑，方便继续统一行为和排查问题。",
    runnerTitle: "Anima Finetune 训练",
    startButtonLabel: "开始 Anima Finetune",
    legacyPath: "/lora/anima-finetune.html",
    legacyLabel: "打开当前随包 Anima Finetune 页面",
    renderedTitle: "Anima Finetune 参数表单",
  });
}
