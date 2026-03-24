import type { SchemaBridgeState } from "../schema/schemaEditor";
import type { TrainingRouteConfig } from "./trainingRouteConfig";
import { wireTrainingStartControl, wireTrainingStopControl } from "./trainingRouteActions";
import { saveCurrentSnapshotToHistory, saveCurrentTrainingRecipe, wireTrainingConfigFileControls, wireTrainingHistoryFileImportControl, wireTrainingRecipeFileImportControl } from "./trainingRouteFiles";
import { wireTrainingSamplePromptWorkspace } from "./trainingPromptWorkspace";
import { clearTrainingAutosave } from "./trainingStorage";
import { applySelectedGpuIds, renderTrainingAutosaveStatus, setTrainingUtilityNote } from "./trainingUi";
import type { EditableRecordMode, PreparedTrainingPayload } from "./trainingRouteState";

type ApplyEditableRecord = (
  record: Record<string, unknown>,
  gpuIds?: string[],
  mode?: EditableRecordMode
) => void;

type TrainingRouteControlsOptions = {
  config: TrainingRouteConfig;
  createDefaultState: () => SchemaBridgeState;
  getCurrentState: () => SchemaBridgeState | null;
  mountTrainingState: (nextState: SchemaBridgeState | null) => void;
  onStateChange: (state: SchemaBridgeState) => void;
  applyEditableRecord: ApplyEditableRecord;
  buildPreparedTrainingPayload: (state: SchemaBridgeState) => PreparedTrainingPayload;
  bindHistoryPanel: () => void;
  bindRecipePanel: () => void;
  openHistoryPanel: () => void;
  openRecipePanel: () => void;
  openPresetPanel: () => Promise<void>;
};

export function wireTrainingRouteControls(options: TrainingRouteControlsOptions) {
  const {
    config,
    createDefaultState,
    getCurrentState,
    mountTrainingState,
    onStateChange,
    applyEditableRecord,
    buildPreparedTrainingPayload,
    bindHistoryPanel,
    bindRecipePanel,
    openHistoryPanel,
    openRecipePanel,
    openPresetPanel,
  } = options;

  document.querySelectorAll<HTMLInputElement>(`#${config.prefix}-gpu-selector input[data-gpu-id]`).forEach((input) => {
    input.addEventListener("change", () => {
      const currentState = getCurrentState();
      if (currentState) {
        onStateChange(currentState);
      }
    });
  });

  document.querySelector<HTMLButtonElement>(`#${config.prefix}-reset-all`)?.addEventListener("click", () => {
    const nextState = createDefaultState();
    applySelectedGpuIds(config.prefix, []);
    mountTrainingState(nextState);
    setTrainingUtilityNote(config.prefix, "已恢复为 schema 默认值。", "warning");
  });

  document.querySelector<HTMLButtonElement>(`#${config.prefix}-save-params`)?.addEventListener("click", () => {
    const currentState = getCurrentState();
    if (!currentState) {
      return;
    }

    saveCurrentSnapshotToHistory(config, currentState, bindHistoryPanel);
    setTrainingUtilityNote(config.prefix, "当前参数已保存到历史记录。", "success");
  });

  document.querySelector<HTMLButtonElement>(`#${config.prefix}-read-params`)?.addEventListener("click", () => {
    openHistoryPanel();
  });

  document.querySelector<HTMLButtonElement>(`#${config.prefix}-clear-autosave`)?.addEventListener("click", () => {
    if (!window.confirm("要清空这个训练路线的本地自动保存吗？")) {
      return;
    }

    clearTrainingAutosave(config.routeId);
    renderTrainingAutosaveStatus(config.prefix, null);
    setTrainingUtilityNote(config.prefix, "这个训练路线的本地自动保存已清空。", "warning");
  });

  document.querySelector<HTMLButtonElement>(`#${config.prefix}-save-recipe`)?.addEventListener("click", () => {
    const currentState = getCurrentState();
    if (!currentState) {
      return;
    }

    const prepared = buildPreparedTrainingPayload(currentState);
    const saved = saveCurrentTrainingRecipe(config, currentState, prepared, bindRecipePanel);
    if (saved) {
      setTrainingUtilityNote(config.prefix, "当前配置已保存到本地配方库。", "success");
    }
  });

  document.querySelector<HTMLButtonElement>(`#${config.prefix}-read-recipes`)?.addEventListener("click", () => {
    openRecipePanel();
  });

  document.querySelector<HTMLButtonElement>(`#${config.prefix}-import-recipe`)?.addEventListener("click", () => {
    document.querySelector<HTMLInputElement>(`#${config.prefix}-recipe-file-input`)?.click();
  });

  document.querySelector<HTMLButtonElement>(`#${config.prefix}-load-presets`)?.addEventListener("click", () => {
    void openPresetPanel();
  });

  wireTrainingConfigFileControls(config, getCurrentState, buildPreparedTrainingPayload, applyEditableRecord);
  wireTrainingHistoryFileImportControl(config, openHistoryPanel);
  wireTrainingRecipeFileImportControl(config, bindRecipePanel, openRecipePanel);
  wireTrainingSamplePromptWorkspace({
    config,
    getCurrentState,
    buildPreparedTrainingPayload,
    applyEditableRecord,
  });
  wireTrainingStopControl(config);
  wireTrainingStartControl(config, getCurrentState, buildPreparedTrainingPayload);
}
