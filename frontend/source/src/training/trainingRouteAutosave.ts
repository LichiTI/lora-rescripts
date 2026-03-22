import type { SchemaBridgeState } from "../schema/schemaEditor";
import { expandTrainingPayloadToEditableValues } from "./trainingPayload";
import { buildTrainingStateWithImportedValues } from "./trainingRouteState";
import { loadTrainingAutosave, saveTrainingAutosave } from "./trainingStorage";
import type { TrainingRouteConfig } from "./trainingRouteConfig";
import {
  applySelectedGpuIds,
  getSnapshotName,
  readSelectedGpuIds,
  setTrainingUtilityNote,
} from "./trainingUi";
import { cloneJson } from "../shared/textUtils";

type CreateDefaultState = () => SchemaBridgeState;

type RestoreTrainingAutosaveOptions = {
  config: TrainingRouteConfig;
  createDefaultState: CreateDefaultState;
  mountTrainingState: (nextState: SchemaBridgeState | null) => void;
};

export function persistTrainingAutosave(config: TrainingRouteConfig, state: SchemaBridgeState) {
  saveTrainingAutosave(config.routeId, {
    time: new Date().toLocaleString(),
    name: getSnapshotName(config, state),
    value: cloneJson(state.values),
    gpu_ids: readSelectedGpuIds(`${config.prefix}-gpu-selector`),
  });
}

export function restoreTrainingAutosave(options: RestoreTrainingAutosaveOptions) {
  const {
    config,
    createDefaultState,
    mountTrainingState,
  } = options;

  const autosaveRecord = loadTrainingAutosave(config.routeId);
  const initialState = autosaveRecord?.value
    ? buildTrainingStateWithImportedValues(createDefaultState(), expandTrainingPayloadToEditableValues(autosaveRecord.value))
    : createDefaultState();

  if (autosaveRecord?.gpu_ids !== undefined) {
    applySelectedGpuIds(config.prefix, autosaveRecord.gpu_ids);
  }

  mountTrainingState(initialState);

  if (!autosaveRecord?.value) {
    return;
  }

  setTrainingUtilityNote(config.prefix, "Restored autosaved parameters for this route.", "success");
}
