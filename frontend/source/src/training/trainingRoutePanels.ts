import { fetchPresets } from "../services/api";
import {
  downloadTextFile,
  loadTrainingHistory,
  loadTrainingRecipes,
  saveTrainingHistory,
  saveTrainingRecipes,
  trimTrainingRecipeEntries,
} from "./trainingStorage";
import type { TrainingRouteConfig } from "./trainingRouteConfig";
import {
  filterPresetsForRoute,
  getPresetCompatibility,
  getRecipeCompatibility,
  renderHistoryPanel,
  renderPresetPanel,
  renderRecipePanel,
  setTrainingUtilityNote,
  toggleTrainingPanel,
} from "./trainingUi";
import type { EditableRecordMode } from "./trainingRouteState";
import { formatTimestampForFile } from "../shared/textUtils";
import type { PresetRecord } from "../shared/types";
import { stringifyLooseTomlObject } from "./trainingPayload";

type ApplyEditableRecord = (
  record: Record<string, unknown>,
  gpuIds?: string[],
  mode?: EditableRecordMode
) => void;

export function createTrainingPanels(config: TrainingRouteConfig, applyEditableRecord: ApplyEditableRecord) {
  let presetsCache: PresetRecord[] | null = null;

  const confirmCompatibilityUse = (kind: "preset" | "recipe", name: string, detail: string) =>
    window.confirm(
      `要把${kind === "preset" ? "预设" : "配方"}“${name}”应用到 ${config.modelLabel} 吗？\n\n${detail}\n\n你仍然可以继续，但之后可能还需要手动检查部分路线专属字段。`
    );

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
        setTrainingUtilityNote(config.prefix, "历史记录已导出。", "success");
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
        setTrainingUtilityNote(config.prefix, `已应用快照：${entry.name || "未命名快照"}。`, "success");
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

        const nextName = window.prompt("重命名快照", entry.name || "");
        if (!nextName) {
          return;
        }

        entry.name = nextName.trim();
        saveTrainingHistory(config.routeId, entries);
        bindHistoryPanel();
        setTrainingUtilityNote(config.prefix, "快照已重命名。", "success");
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

        if (!window.confirm(`要删除快照“${entry.name || "未命名快照"}”吗？`)) {
          return;
        }

        entries.splice(index, 1);
        saveTrainingHistory(config.routeId, entries);
        bindHistoryPanel();
        setTrainingUtilityNote(config.prefix, "快照已删除。", "success");
      });
    });
  };

  const openHistoryPanel = () => {
    bindHistoryPanel();
    toggleTrainingPanel(config.prefix, "history", true);
  };

  const bindRecipePanel = () => {
    const recipeEntries = loadTrainingRecipes(config.routeId);
    renderRecipePanel(config.prefix, recipeEntries, config);

    document.querySelectorAll<HTMLButtonElement>(`#${config.prefix}-recipes-panel [data-recipe-close]`).forEach((button) => {
      button.addEventListener("click", () => toggleTrainingPanel(config.prefix, "recipes", false));
    });

    document.querySelectorAll<HTMLButtonElement>(`#${config.prefix}-recipes-panel [data-recipe-export-all]`).forEach((button) => {
      button.addEventListener("click", () => {
        downloadTextFile(
          `${config.prefix}-recipes-${formatTimestampForFile()}.json`,
          JSON.stringify(loadTrainingRecipes(config.routeId), null, 2),
          "application/json;charset=utf-8"
        );
        setTrainingUtilityNote(config.prefix, "配方库已导出。", "success");
      });
    });

    document.querySelectorAll<HTMLButtonElement>(`#${config.prefix}-recipes-panel [data-recipe-import]`).forEach((button) => {
      button.addEventListener("click", () => {
        document.querySelector<HTMLInputElement>(`#${config.prefix}-recipe-file-input`)?.click();
      });
    });

    document.querySelectorAll<HTMLButtonElement>(`#${config.prefix}-recipes-panel [data-recipe-merge]`).forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.recipeMerge ?? "-1");
        const recipe = loadTrainingRecipes(config.routeId)[index];
        if (!recipe) {
          return;
        }
        const compatibility = getRecipeCompatibility(config, recipe);
        if (!compatibility.compatible && !confirmCompatibilityUse("recipe", recipe.name, compatibility.detail)) {
          return;
        }
        applyEditableRecord(recipe.value, undefined, "merge");
        toggleTrainingPanel(config.prefix, "recipes", false);
        setTrainingUtilityNote(config.prefix, `已合并配方：${recipe.name}。`, "success");
      });
    });

    document.querySelectorAll<HTMLButtonElement>(`#${config.prefix}-recipes-panel [data-recipe-replace]`).forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.recipeReplace ?? "-1");
        const recipe = loadTrainingRecipes(config.routeId)[index];
        if (!recipe) {
          return;
        }
        const compatibility = getRecipeCompatibility(config, recipe);
        if (!compatibility.compatible && !confirmCompatibilityUse("recipe", recipe.name, compatibility.detail)) {
          return;
        }
        applyEditableRecord(recipe.value, undefined, "replace");
        toggleTrainingPanel(config.prefix, "recipes", false);
        setTrainingUtilityNote(config.prefix, `当前表单值已被配方替换：${recipe.name}。`, "success");
      });
    });

    document.querySelectorAll<HTMLButtonElement>(`#${config.prefix}-recipes-panel [data-recipe-export]`).forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.recipeExport ?? "-1");
        const recipe = loadTrainingRecipes(config.routeId)[index];
        if (!recipe) {
          return;
        }
        downloadTextFile(
          `${recipe.name.replace(/[^0-9A-Za-z._-]+/g, "-") || "recipe"}-preset.toml`,
          stringifyLooseTomlObject({
            metadata: {
              name: recipe.name,
              version: "1.0",
              author: "SD-reScripts 本地配方",
              train_type: recipe.train_type || config.schemaName,
              description: recipe.description || `从 ${config.modelLabel} 导出的配方。`,
            },
            data: recipe.value,
          })
        );
        setTrainingUtilityNote(config.prefix, `配方已导出：${recipe.name}。`, "success");
      });
    });

    document.querySelectorAll<HTMLButtonElement>(`#${config.prefix}-recipes-panel [data-recipe-rename]`).forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.recipeRename ?? "-1");
        const entries = loadTrainingRecipes(config.routeId);
        const recipe = entries[index];
        if (!recipe) {
          return;
        }
        const nextName = window.prompt("重命名配方", recipe.name);
        if (!nextName || !nextName.trim()) {
          return;
        }
        recipe.name = nextName.trim();
        saveTrainingRecipes(config.routeId, entries);
        bindRecipePanel();
        setTrainingUtilityNote(config.prefix, "配方已重命名。", "success");
      });
    });

    document.querySelectorAll<HTMLButtonElement>(`#${config.prefix}-recipes-panel [data-recipe-delete]`).forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.recipeDelete ?? "-1");
        const entries = loadTrainingRecipes(config.routeId);
        const recipe = entries[index];
        if (!recipe) {
          return;
        }
        if (!window.confirm(`要删除配方“${recipe.name}”吗？`)) {
          return;
        }
        entries.splice(index, 1);
        saveTrainingRecipes(config.routeId, entries);
        bindRecipePanel();
        setTrainingUtilityNote(config.prefix, "配方已删除。", "success");
      });
    });
  };

  const openRecipePanel = () => {
    bindRecipePanel();
    toggleTrainingPanel(config.prefix, "recipes", true);
  };

  const bindPresetPanel = () => {
    renderPresetPanel(config.prefix, presetsCache ?? [], config);

    document.querySelectorAll<HTMLButtonElement>(`#${config.prefix}-presets-panel [data-preset-close]`).forEach((button) => {
      button.addEventListener("click", () => toggleTrainingPanel(config.prefix, "presets", false));
    });

    document.querySelectorAll<HTMLButtonElement>(`#${config.prefix}-presets-panel [data-preset-merge]`).forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.presetMerge ?? "-1");
        const preset = presetsCache?.[index];
        if (!preset) {
          return;
        }

        const compatibility = getPresetCompatibility(config, preset);
        const presetName = String(((preset.metadata ?? {}) as Record<string, unknown>).name || preset.name || "预设");
        if (!compatibility.compatible && !confirmCompatibilityUse("preset", presetName, compatibility.detail)) {
          return;
        }
        const presetData = ((preset.data ?? {}) as Record<string, unknown>);
        applyEditableRecord(presetData, undefined, "merge");
        toggleTrainingPanel(config.prefix, "presets", false);
        setTrainingUtilityNote(
          config.prefix,
          `已合并预设：${presetName}。`,
          "success"
        );
      });
    });

    document.querySelectorAll<HTMLButtonElement>(`#${config.prefix}-presets-panel [data-preset-save-recipe]`).forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.presetSaveRecipe ?? "-1");
        const preset = presetsCache?.[index];
        if (!preset) {
          return;
        }

        const metadata = (preset.metadata ?? {}) as Record<string, unknown>;
        const presetData = ((preset.data ?? {}) as Record<string, unknown>);
        const entries = loadTrainingRecipes(config.routeId);
        entries.unshift({
          created_at: new Date().toLocaleString(),
          name: String(metadata.name || preset.name || "导入的预设配方"),
          description: typeof metadata.description === "string" ? metadata.description : undefined,
          train_type: typeof metadata.train_type === "string" ? metadata.train_type : config.schemaName,
          route_id: config.routeId,
          value: JSON.parse(JSON.stringify(presetData)) as Record<string, unknown>,
        });
        saveTrainingRecipes(config.routeId, trimTrainingRecipeEntries(entries));
        if (!document.querySelector<HTMLElement>(`#${config.prefix}-recipes-panel`)?.hidden) {
          bindRecipePanel();
        }
        setTrainingUtilityNote(
          config.prefix,
          `预设已保存到本地配方库：${String(metadata.name || preset.name || "预设")}。`,
          "success"
        );
      });
    });

    document.querySelectorAll<HTMLButtonElement>(`#${config.prefix}-presets-panel [data-preset-replace]`).forEach((button) => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.presetReplace ?? "-1");
        const preset = presetsCache?.[index];
        if (!preset) {
          return;
        }

        const compatibility = getPresetCompatibility(config, preset);
        const presetName = String(((preset.metadata ?? {}) as Record<string, unknown>).name || preset.name || "预设");
        if (!compatibility.compatible && !confirmCompatibilityUse("preset", presetName, compatibility.detail)) {
          return;
        }
        const presetData = ((preset.data ?? {}) as Record<string, unknown>);
        applyEditableRecord(presetData, undefined, "replace");
        toggleTrainingPanel(config.prefix, "presets", false);
        setTrainingUtilityNote(
          config.prefix,
          `当前表单值已被预设替换：${presetName}。`,
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
        setTrainingUtilityNote(config.prefix, error instanceof Error ? error.message : "读取预设失败。", "error");
        return;
      }
    }

    bindPresetPanel();
    toggleTrainingPanel(config.prefix, "presets", true);
  };

  return {
    bindHistoryPanel,
    bindRecipePanel,
    openHistoryPanel,
    openRecipePanel,
    openPresetPanel,
  };
}
