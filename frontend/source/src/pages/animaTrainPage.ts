import { renderTrainingPage } from "./trainingPage";

export function renderAnimaTrainPage() {
  return renderTrainingPage({
    prefix: "anima",
    heroKicker: "anima train",
    heroTitle: "Anima LoRA 训练",
    heroLede: "Anima LoRA 路线已经接入统一桥接层，用来持续整理参数结构、兼容检查和启动逻辑。",
    runnerTitle: "Anima LoRA 训练",
    startButtonLabel: "开始 Anima LoRA 训练",
    legacyPath: "/lora/anima.html",
    legacyLabel: "打开当前随包 Anima LoRA 页面",
    renderedTitle: "Anima LoRA 参数表单",
  });
}
