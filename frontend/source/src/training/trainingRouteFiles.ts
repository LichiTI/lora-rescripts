import type { SchemaBridgeState } from "../schema/schemaEditor";
import { parseLooseTomlObject, stringifyLooseTomlObject } from "./trainingPayload";
import { downloadTextFile, loadTrainingHistory, saveTrainingHistory } from "./trainingStorage";
import type { TrainingRouteConfig } from "./trainingRouteConfig";
import type { EditableRecordMode, PreparedTrainingPayload } from "./trainingRouteState";
import { getSnapshotName, readSelectedGpuIds, setTrainingUtilityNote } from "./trainingUi";
import { cloneJson, formatTimestampForFile } from "../shared/textUtils";

type ApplyEditableRecord = (
  record: Record<string, unknown>,
  gpuIds?: string[],
  mode?: EditableRecordMode
) => void;

type BuildPreparedTrainingPayload = (state: SchemaBridgeState) => PreparedTrainingPayload;

export function saveCurrentSnapshotToHistory(
  config: TrainingRouteConfig,
  currentState: SchemaBridgeState,
  bindHistoryPanel: () => void
) {
  const entries = loadTrainingHistory(config.routeId);
  entries.unshift({
    time: new Date().toLocaleString(),
    name: getSnapshotName(config, currentState),
    value: cloneJson(currentState.values),
    gpu_ids: readSelectedGpuIds(`${config.prefix}-gpu-selector`),
  });
  saveTrainingHistory(config.routeId, entries.slice(0, 40));

  if (!document.querySelector<HTMLElement>(`#${config.prefix}-history-panel`)?.hidden) {
    bindHistoryPanel();
  }
}

export function wireTrainingConfigFileControls(
  config: TrainingRouteConfig,
  getCurrentState: () => SchemaBridgeState | null,
  buildPreparedTrainingPayload: BuildPreparedTrainingPayload,
  applyEditableRecord: ApplyEditableRecord
) {
  document.querySelector<HTMLButtonElement>(`#${config.prefix}-download-config`)?.addEventListener("click", () => {
    const currentState = getCurrentState();
    if (!currentState) {
      return;
    }

    const prepared = buildPreparedTrainingPayload(currentState);
    downloadTextFile(
      `${config.prefix}-${formatTimestampForFile()}.toml`,
      stringifyLooseTomlObject(prepared.payload)
    );
    setTrainingUtilityNote(config.prefix, "Exported current config as TOML.", "success");
  });

  document.querySelector<HTMLButtonElement>(`#${config.prefix}-import-config`)?.addEventListener("click", () => {
    document.querySelector<HTMLInputElement>(`#${config.prefix}-config-file-input`)?.click();
  });

  document.querySelector<HTMLInputElement>(`#${config.prefix}-config-file-input`)?.addEventListener("change", (event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseLooseTomlObject(String(reader.result ?? ""));
        applyEditableRecord(parsed);
        setTrainingUtilityNote(config.prefix, `Imported config: ${file.name}.`, "success");
      } catch (error) {
        setTrainingUtilityNote(config.prefix, error instanceof Error ? error.message : "Failed to import config.", "error");
      } finally {
        input.value = "";
      }
    };
    reader.readAsText(file);
  });
}

export function wireTrainingHistoryFileImportControl(
  config: TrainingRouteConfig,
  openHistoryPanel: () => void
) {
  document.querySelector<HTMLInputElement>(`#${config.prefix}-history-file-input`)?.addEventListener("change", (event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result ?? ""));
        if (!Array.isArray(imported)) {
          throw new Error("History file must contain an array.");
        }

        const nextEntries = imported
          .filter((entry) => entry && typeof entry === "object" && entry.value && typeof entry.value === "object")
          .map((entry) => ({
            time: String(entry.time || new Date().toLocaleString()),
            name: entry.name ? String(entry.name) : undefined,
            value: cloneJson(entry.value as Record<string, unknown>),
            gpu_ids: Array.isArray(entry.gpu_ids) ? entry.gpu_ids.map((gpuId: unknown) => String(gpuId)) : [],
          }));

        if (nextEntries.length === 0) {
          throw new Error("History file did not contain valid entries.");
        }

        const merged = [...loadTrainingHistory(config.routeId), ...nextEntries].slice(0, 80);
        saveTrainingHistory(config.routeId, merged);
        openHistoryPanel();
        setTrainingUtilityNote(config.prefix, `Imported ${nextEntries.length} history entries.`, "success");
      } catch (error) {
        setTrainingUtilityNote(config.prefix, error instanceof Error ? error.message : "Failed to import history.", "error");
      } finally {
        input.value = "";
      }
    };
    reader.readAsText(file);
  });
}
