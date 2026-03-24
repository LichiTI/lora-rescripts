import { renderTrainingPage } from "./trainingPage";

export function renderXtiTrainPage() {
  return renderTrainingPage({
    prefix: "xti",
    heroKicker: "sd xti",
    heroTitle: "SD XTI 训练",
    heroLede: "XTI 训练页已经并入统一训练桥接层，方便继续保持和其它训练路线一致的表单与启动行为。",
    runnerTitle: "SD XTI 训练",
    startButtonLabel: "开始 SD XTI 训练",
    legacyPath: "/lora/xti.html",
    legacyLabel: "打开当前随包 SD XTI 页面",
    renderedTitle: "SD XTI 参数表单",
  });
}
