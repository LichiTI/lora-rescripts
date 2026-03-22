import type { SchemaBridgeState } from "../schema/schemaEditor";
import type { TrainingRouteConfig } from "./trainingRouteConfig";
import { wireTrainingStartControl, wireTrainingStopControl } from "./trainingRouteActions";
import { saveCurrentSnapshotToHistory, wireTrainingConfigFileControls, wireTrainingHistoryFileImportControl } from "./trainingRouteFiles";
import { applySelectedGpuIds, setTrainingUtilityNote } from "./trainingUi";
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
  openHistoryPanel: () => void;
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
    openHistoryPanel,
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
    setTrainingUtilityNote(config.prefix, "Reset to schema defaults.", "warning");
  });

  document.querySelector<HTMLButtonElement>(`#${config.prefix}-save-params`)?.addEventListener("click", () => {
    const currentState = getCurrentState();
    if (!currentState) {
      return;
    }

    saveCurrentSnapshotToHistory(config, currentState, bindHistoryPanel);
    setTrainingUtilityNote(config.prefix, "Current parameters saved to history.", "success");
  });

  document.querySelector<HTMLButtonElement>(`#${config.prefix}-read-params`)?.addEventListener("click", () => {
    openHistoryPanel();
  });

  document.querySelector<HTMLButtonElement>(`#${config.prefix}-load-presets`)?.addEventListener("click", () => {
    void openPresetPanel();
  });

  wireTrainingConfigFileControls(config, getCurrentState, buildPreparedTrainingPayload, applyEditableRecord);
  wireTrainingHistoryFileImportControl(config, openHistoryPanel);
  wireTrainingStopControl(config);
  wireTrainingStartControl(config, getCurrentState, buildPreparedTrainingPayload);
}
