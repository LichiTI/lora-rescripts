import { renderTrainingPage } from "./trainingPage";

export function renderSd3TrainPage() {
  return renderTrainingPage({
    prefix: "sd3",
    heroKicker: "sd3 train",
    heroTitle: "SD3 / SD3.5 LoRA 训练",
    heroLede: "SD3 路线也接到了同一套训练桥接层上，方便统一处理 schema 表单、配置预览和训练启动流程。",
    runnerTitle: "SD3 训练",
    startButtonLabel: "开始 SD3 训练",
    legacyPath: "/lora/sd3.html",
    legacyLabel: "打开当前随包 SD3 页面",
    renderedTitle: "SD3 参数表单",
  });
}
