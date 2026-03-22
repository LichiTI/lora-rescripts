import { fetchPresets } from "../services/api";
import { downloadTextFile, loadTrainingHistory, saveTrainingHistory } from "./trainingStorage";
import type { TrainingRouteConfig } from "./trainingRouteConfig";
import { filterPresetsForRoute, renderHistoryPanel, renderPresetPanel, setTrainingUtilityNote, toggleTrainingPanel } from "./trainingUi";
import type { EditableRecordMode } from "./trainingRouteState";
import { formatTimestampForFile } from "../shared/textUtils";
import type { PresetRecord } from "../shared/types";

type ApplyEditableRecord = (
  record: Record<string, unknown>,
  gpuIds?: string[],
  mode?: EditableRecordMode
) => void;

export function createTrainingPanels(config: TrainingRouteConfig, applyEditableRecord: ApplyEditableRecord) {
  let presetsCache: PresetRecord[] | null = null;

  const bindHistoryPanel = () => {
    const historyEntries = loadTrainingHistory(config.routeId);
    renderHistoryPanel(config.prefix, historyEntries);

    document.querySelectorAll<HTMLButtonElement>(`#${config.prefix}-history-panel [data-history-close]`).forEach((button) => {
      button.addEventListener("click", () => toggleTrainingPanel(config.prefix, "history", false));
    });

    document.querySelectorAll<HTMLButtonElement>(`#${config.prefix}-history-panel [data-history-export]`).forEach((button) => {
      button.addEventListener("click", () => {
        downloadTextFile(
          `${config.prefix}-history-${formatTimestampForFile()}.json`,
          JSON.stringify(loadTrainingHistory(config.routeId), null, 2),
          "application/json;charset=utf-8"
        );
        setTrainingUtilityNote(config.prefix, "History exported.", "success");
      });
    });

    document.querySelectorAll<HTMLButtonElement>(`#${config.prefix}-history-panel [data-history-import]`).forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelector<HTMLInputElement>(`#${config.prefix}-history-file-input`)?.click();
      });
    });

    document.querySelectorAll<HTMLButtonElement>(`#${config.prefix}-history-panel [data-history-apply]`).forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.historyApply ?? "-1");
        const entry = loadTrainingHistory(config.routeId)[index];
        if (!entry) {
          return;
        }
        applyEditableRecord(entry.value, entry.gpu_ids, "replace");
        toggleTrainingPanel(config.prefix, "history", false);
        setTrainingUtilityNote(config.prefix, `Applied snapshot: ${entry.name || "Unnamed snapshot"}.`, "success");
      });
    });

    document.querySelectorAll<HTMLButtonElement>(`#${config.prefix}-history-panel [data-history-rename]`).forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.historyRename ?? "-1");
        const entries = loadTrainingHistory(config.routeId);
        const entry = entries[index];
        if (!entry) {
          return;
        }

        const nextName = window.prompt("Rename snapshot", entry.name || "");
        if (!nextName) {
          return;
        }

        entry.name = nextName.trim();
        saveTrainingHistory(config.routeId, entries);
        bindHistoryPanel();
        setTrainingUtilityNote(config.prefix, "Snapshot renamed.", "success");
      });
    });

    document.querySelectorAll<HTMLButtonElement>(`#${config.prefix}-history-panel [data-history-delete]`).forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.historyDelete ?? "-1");
        const entries = loadTrainingHistory(config.routeId);
        const entry = entries[index];
        if (!entry) {
          return;
        }

        if (!window.confirm(`Delete snapshot "${entry.name || "Unnamed snapshot"}"?`)) {
          return;
        }

        entries.splice(index, 1);
        saveTrainingHistory(config.routeId, entries);
        bindHistoryPanel();
        setTrainingUtilityNote(config.prefix, "Snapshot deleted.", "success");
      });
    });
  };

  const openHistoryPanel = () => {
    bindHistoryPanel();
    toggleTrainingPanel(config.prefix, "history", true);
  };

  const bindPresetPanel = () => {
    renderPresetPanel(config.prefix, presetsCache ?? []);

    document.querySelectorAll<HTMLButtonElement>(`#${config.prefix}-presets-panel [data-preset-close]`).forEach((button) => {
      button.addEventListener("click", () => toggleTrainingPanel(config.prefix, "presets", false));
    });

    document.querySelectorAll<HTMLButtonElement>(`#${config.prefix}-presets-panel [data-preset-apply]`).forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.presetApply ?? "-1");
        const preset = presetsCache?.[index];
        if (!preset) {
          return;
        }

        const presetData = ((preset.data ?? {}) as Record<string, unknown>);
        applyEditableRecord(presetData, undefined, "merge");
        toggleTrainingPanel(config.prefix, "presets", false);
        setTrainingUtilityNote(
          config.prefix,
          `Applied preset: ${String(((preset.metadata ?? {}) as Record<string, unknown>).name || preset.name || "preset")}.`,
          "success"
        );
      });
    });
  };

  const openPresetPanel = async () => {
    if (!presetsCache) {
      try {
        const result = await fetchPresets();
        presetsCache = filterPresetsForRoute(config, result.data?.presets ?? []);
      } catch (error) {
        setTrainingUtilityNote(config.prefix, error instanceof Error ? error.message : "Failed to load presets.", "error");
        return;
      }
    }

    bindPresetPanel();
    toggleTrainingPanel(config.prefix, "presets", true);
  };

  return {
    bindHistoryPanel,
    openHistoryPanel,
    openPresetPanel,
  };
}
