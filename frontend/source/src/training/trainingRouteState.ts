import { getRenderedPayload, type SchemaBridgeState } from "../schema/schemaEditor";
import type { TrainingCheckResult } from "./trainingPayload";
import { checkTrainingPayload, normalizeTrainingPayload } from "./trainingPayload";
import { readSelectedGpuIds } from "./trainingUi";

export type EditableRecordMode = "replace" | "merge";

export type PreparedTrainingPayload = {
  payload: Record<string, unknown>;
  checks: TrainingCheckResult;
};

export const trainingRouteStates: Record<string, SchemaBridgeState | null> = {};

export function buildPreparedTrainingPayload(prefix: string, state: SchemaBridgeState): PreparedTrainingPayload {
  const payload = getRenderedPayload(state);
  const gpuIds = readSelectedGpuIds(`${prefix}-gpu-selector`);
  if (gpuIds.length > 0) {
    payload.gpu_ids = gpuIds;
  }

  const normalized = normalizeTrainingPayload(payload);
  return {
    payload: normalized,
    checks: checkTrainingPayload(normalized),
  };
}

export function getEditableFieldPathSet(state: SchemaBridgeState) {
  return new Set(state.sections.flatMap((section) => section.fields.map((field) => field.path)));
}

export function buildTrainingStateWithImportedValues(baseState: SchemaBridgeState, importedValues: Record<string, unknown>) {
  const allowed = getEditableFieldPathSet(baseState);
  const nextValues = { ...baseState.values };

  for (const [key, value] of Object.entries(importedValues)) {
    if (allowed.has(key)) {
      nextValues[key] = value;
    }
  }

  return {
    ...baseState,
    values: nextValues,
  };
}

export function mergeTrainingStateWithImportedValues(baseState: SchemaBridgeState, importedValues: Record<string, unknown>) {
  return {
    ...baseState,
    values: {
      ...baseState.values,
      ...Object.fromEntries(Object.entries(importedValues).filter(([key]) => getEditableFieldPathSet(baseState).has(key))),
    },
  };
}

export function resolveImportedGpuIds(record: Record<string, unknown>, snapshotGpuIds?: string[]) {
  if (snapshotGpuIds && snapshotGpuIds.length > 0) {
    return snapshotGpuIds.map((entry) => String(entry));
  }
  if (Array.isArray(record.gpu_ids)) {
    return record.gpu_ids.map((entry) => String(entry));
  }
  return [];
}
