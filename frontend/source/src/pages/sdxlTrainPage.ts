import { renderTrainingPage } from "./trainingPage";

export function renderSdxlTrainPage() {
  return renderTrainingPage({
    prefix: "sdxl",
    heroKicker: "sdxl train",
    heroTitle: "SDXL LoRA 训练",
    heroLede: "这里会按旧版训练页的使用习惯整理 SDXL LoRA 表单、预检查、参数预览和启动流程。",
    runnerTitle: "SDXL 训练",
    startButtonLabel: "开始 SDXL 训练",
    legacyPath: "/lora/sdxl.html",
    legacyLabel: "打开当前随包 SDXL 页面",
    renderedTitle: "SDXL 参数表单",
    routeNotice: {
      kicker: "experimental",
      title: "SDXL clip_skip 当前仍属于实验性支持",
      detail:
        "当前构建已经可以把 clip_skip 传入 SDXL 训练路径，但仍建议按实验性选项看待。如果训练里启用了它，推理时也尽量保持对应的 SDXL clip_skip 行为。",
    },
  });
}
