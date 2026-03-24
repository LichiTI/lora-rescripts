import { renderTrainingPage } from "./trainingPage";

export function renderSdxlControlNetTrainPage() {
  return renderTrainingPage({
    prefix: "sdxl-controlnet",
    heroKicker: "sdxl controlnet",
    heroTitle: "SDXL ControlNet 训练",
    heroLede: "SDXL ControlNet 表单已经接入源码版训练桥接层，用来统一参数处理、兼容性检查和启动逻辑。",
    runnerTitle: "SDXL ControlNet 训练",
    startButtonLabel: "开始 SDXL ControlNet 训练",
    legacyPath: "/lora/sdxl-controlnet.html",
    legacyLabel: "打开当前随包 SDXL ControlNet 页面",
    renderedTitle: "SDXL ControlNet 参数表单",
    routeNotice: {
      kicker: "experimental",
      title: "SDXL ControlNet 路线里的 clip_skip 也仍属实验性支持",
      detail:
        "ControlNet 仍然共享 SDXL 文本编码路径。如果你在这条路线里启用了 clip_skip，推理侧也尽量保持相同的 SDXL clip_skip 行为。",
    },
  });
}
