import { type TrainingRouteConfig } from "./trainingRouteConfig";
import { wireTrainingRouteControls } from "./trainingRouteControls";
import { createTrainingPanels } from "./trainingRoutePanels";
import { initializeTrainingRouteRuntime } from "./trainingRouteRuntime";
import { createTrainingRouteSession } from "./trainingRouteSession";
import {
  renderTrainSubmitStatus,
  renderTrainValidationStatus,
  toggleTrainingPanel,
} from "./trainingUi";

export async function bindTrainingRoute(config: TrainingRouteConfig) {
  const runtime = await initializeTrainingRouteRuntime(config);
  if (!runtime) {
    return;
  }

  const session = createTrainingRouteSession(config, runtime.domIds, runtime.createDefaultState);
  const panels = createTrainingPanels(config, session.applyEditableRecord);

  session.restoreAutosave();

  wireTrainingRouteControls({
    config,
    createDefaultState: runtime.createDefaultState,
    getCurrentState: session.getCurrentState,
    mountTrainingState: session.mountTrainingState,
    onStateChange: session.onStateChange,
    applyEditableRecord: session.applyEditableRecord,
    buildPreparedTrainingPayload: session.prepareTrainingPayload,
    bindHistoryPanel: panels.bindHistoryPanel,
    bindRecipePanel: panels.bindRecipePanel,
    openHistoryPanel: panels.openHistoryPanel,
    openRecipePanel: panels.openRecipePanel,
    openPresetPanel: panels.openPresetPanel,
  });

  renderTrainSubmitStatus(
    config.prefix,
    `${config.modelLabel} 页面已准备就绪`,
    "现在可以先检查生成后的 payload，再把当前配置提交到 /api/run。",
    "success"
  );
  toggleTrainingPanel(config.prefix, "history", false);
  toggleTrainingPanel(config.prefix, "recipes", false);
  toggleTrainingPanel(config.prefix, "presets", false);
}
