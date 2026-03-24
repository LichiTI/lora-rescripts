import type { SchemaBridgeState } from "../schema/schemaEditor";
import { parseLooseTomlObject, stringifyLooseTomlObject } from "./trainingPayload";
import {
  downloadTextFile,
  loadTrainingHistory,
  loadTrainingRecipes,
  saveTrainingHistory,
  saveTrainingRecipes,
  trimTrainingHistoryEntries,
  trimTrainingRecipeEntries,
  type TrainingRecipeRecord,
} from "./trainingStorage";
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

function sanitizePresetFileStem(value: string) {
  const normalized = value.trim().replace(/[^0-9A-Za-z._-]+/g, "-").replace(/-+/g, "-");
  return normalized.replace(/^[-_.]+|[-_.]+$/g, "") || "training-preset";
}

function buildPresetExportDocument(config: TrainingRouteConfig, currentState: SchemaBridgeState, prepared: PreparedTrainingPayload) {
  const presetName = getSnapshotName(config, currentState);
  const trainType = String(prepared.payload.model_train_type ?? "");
  return {
    metadata: {
      name: presetName,
      version: "1.0",
      author: "SD-reScripts 本地导出",
      train_type: trainType || config.schemaName,
      description: `${new Date().toLocaleString()} 从 ${config.modelLabel} 源码训练页导出。`,
    },
    data: prepared.payload,
  };
}

export function saveCurrentTrainingRecipe(
  config: TrainingRouteConfig,
  currentState: SchemaBridgeState,
  prepared: PreparedTrainingPayload,
  refreshRecipePanel: () => void
) {
  const suggestedName = getSnapshotName(config, currentState);
  const name = window.prompt("配方名称", suggestedName);
  if (!name || !name.trim()) {
    return false;
  }

  const description = window.prompt("配方说明（可选）", "") ?? "";
  const entries = loadTrainingRecipes(config.routeId);
  entries.unshift({
    created_at: new Date().toLocaleString(),
    name: name.trim(),
    description: description.trim() || undefined,
    train_type: String(prepared.payload.model_train_type ?? config.schemaName),
    route_id: config.routeId,
    value: cloneJson(prepared.payload),
  });
  saveTrainingRecipes(config.routeId, trimTrainingRecipeEntries(entries));
  refreshRecipePanel();
  return true;
}

function normalizeImportedRecipeRecord(
  config: TrainingRouteConfig,
  imported: Record<string, unknown>,
  fallbackName: string
): TrainingRecipeRecord | null {
  const payload = imported.data && typeof imported.data === "object" && !Array.isArray(imported.data)
    ? (imported.data as Record<string, unknown>)
    : imported.value && typeof imported.value === "object" && !Array.isArray(imported.value)
      ? (imported.value as Record<string, unknown>)
      : imported;

  if (!payload || typeof payload !== "object" || Array.isArray(payload) || Object.keys(payload).length === 0) {
    return null;
  }

  const metadata = imported.metadata && typeof imported.metadata === "object" && !Array.isArray(imported.metadata)
    ? (imported.metadata as Record<string, unknown>)
    : {};

  const name = String(metadata.name || imported.name || fallbackName || "导入的配方").trim();
  return {
    created_at: String(imported.created_at || new Date().toLocaleString()),
    name: name || "导入的配方",
    description: typeof metadata.description === "string" ? metadata.description : typeof imported.description === "string" ? imported.description : undefined,
    train_type: typeof metadata.train_type === "string"
      ? metadata.train_type
      : typeof imported.train_type === "string"
        ? imported.train_type
        : typeof payload.model_train_type === "string"
          ? payload.model_train_type
          : config.schemaName,
    route_id: typeof imported.route_id === "string" ? imported.route_id : config.routeId,
    value: cloneJson(payload),
  };
}

function importRecipesFromText(
  config: TrainingRouteConfig,
  fileName: string,
  content: string
) {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("配方文件是空的。");
  }

  const imported = fileName.toLowerCase().endsWith(".json")
    ? JSON.parse(trimmed) as unknown
    : parseLooseTomlObject(trimmed);

  const records: TrainingRecipeRecord[] = [];

  if (Array.isArray(imported)) {
    imported.forEach((entry, index) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        return;
      }
      const normalized = normalizeImportedRecipeRecord(config, entry as Record<string, unknown>, `导入的配方 ${index + 1}`);
      if (normalized) {
        records.push(normalized);
      }
    });
  } else if (imported && typeof imported === "object") {
    const normalized = normalizeImportedRecipeRecord(config, imported as Record<string, unknown>, fileName.replace(/\.[^.]+$/, ""));
    if (normalized) {
      records.push(normalized);
    }
  }

  if (records.length === 0) {
    throw new Error("这个文件里没有找到有效的配方记录。");
  }

  return records;
}

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
  saveTrainingHistory(config.routeId, trimTrainingHistoryEntries(entries));

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
    setTrainingUtilityNote(config.prefix, "当前配置已导出为 TOML。", "success");
  });

  document.querySelector<HTMLButtonElement>(`#${config.prefix}-export-preset`)?.addEventListener("click", () => {
    const currentState = getCurrentState();
    if (!currentState) {
      return;
    }

    const prepared = buildPreparedTrainingPayload(currentState);
    const document = buildPresetExportDocument(config, currentState, prepared);
    const fileStem = sanitizePresetFileStem(getSnapshotName(config, currentState) || config.prefix);
    downloadTextFile(
      `${fileStem}-preset.toml`,
      stringifyLooseTomlObject(document)
    );
    setTrainingUtilityNote(config.prefix, "当前配置已导出为可复用的预设 TOML。", "success");
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
        const importPayload = parsed.data && typeof parsed.data === "object" && !Array.isArray(parsed.data)
          ? (parsed.data as Record<string, unknown>)
          : parsed;
        applyEditableRecord(importPayload);
        setTrainingUtilityNote(
          config.prefix,
          parsed.data && typeof parsed.data === "object" ? `已导入预设：${file.name}。` : `已导入配置：${file.name}。`,
          "success"
        );
      } catch (error) {
        setTrainingUtilityNote(config.prefix, error instanceof Error ? error.message : "导入配置失败。", "error");
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
          throw new Error("历史记录文件必须是一个数组。");
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
          throw new Error("历史记录文件里没有有效条目。");
        }

        const merged = trimTrainingHistoryEntries([...loadTrainingHistory(config.routeId), ...nextEntries]);
        saveTrainingHistory(config.routeId, merged);
        openHistoryPanel();
        setTrainingUtilityNote(config.prefix, `已导入 ${nextEntries.length} 条历史记录。`, "success");
      } catch (error) {
        setTrainingUtilityNote(config.prefix, error instanceof Error ? error.message : "导入历史记录失败。", "error");
      } finally {
        input.value = "";
      }
    };
    reader.readAsText(file);
  });
}

export function wireTrainingRecipeFileImportControl(
  config: TrainingRouteConfig,
  bindRecipePanel: () => void,
  openRecipePanel: () => void
) {
  document.querySelector<HTMLInputElement>(`#${config.prefix}-recipe-file-input`)?.addEventListener("change", (event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const nextEntries = importRecipesFromText(config, file.name, String(reader.result ?? ""));
        const merged = trimTrainingRecipeEntries([...nextEntries, ...loadTrainingRecipes(config.routeId)]);
        saveTrainingRecipes(config.routeId, merged);
        bindRecipePanel();
        openRecipePanel();
        setTrainingUtilityNote(config.prefix, `已导入 ${nextEntries.length} 条配方记录。`, "success");
      } catch (error) {
        setTrainingUtilityNote(config.prefix, error instanceof Error ? error.message : "导入配方失败。", "error");
      } finally {
        input.value = "";
      }
    };
    reader.readAsText(file);
  });
}
