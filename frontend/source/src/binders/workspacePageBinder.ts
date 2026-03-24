import {
  fetchGraphicCards,
  fetchPresets,
  fetchSchemaHashes,
  fetchSchemasAll,
  fetchTagEditorStatus,
  fetchTasks,
} from "../services/api";
import { setHtml, setText } from "../shared/domUtils";
import { renderSchemaBrowser, renderSchemaCoverage, renderTrainingCatalog } from "../renderers/pageInventoryRenderers";
import { formatGpuList, formatTagEditor, formatTaskSummary } from "../shared/statusFormatters";
import type { RuntimePackageRecord } from "../shared/types";
import { appRoutes } from "../routing/router";
import { trainingRouteConfigs } from "../training/trainingRouteConfig";
import { loadTrainingAutosave, loadTrainingHistory, loadTrainingRecipes } from "../training/trainingStorage";

const WORKSPACE_RUNTIME_PACKAGES = [
  "pytorch_optimizer",
  "schedulefree",
  "bitsandbytes",
  "prodigyplus",
];

function formatRuntimePackages(packages?: Record<string, RuntimePackageRecord>) {
  if (!packages) {
    return "运行时依赖信息不可用";
  }

  const tracked = WORKSPACE_RUNTIME_PACKAGES
    .map((name) => packages[name])
    .filter((record): record is RuntimePackageRecord => Boolean(record));
  if (tracked.length === 0) {
    return "运行时依赖信息不可用";
  }

  return tracked
    .map((record) => `${record.display_name}:${record.importable ? "可用" : record.installed ? "异常" : "缺失"}`)
    .join(" | ");
}

export async function bindWorkspaceData() {
  const results = await Promise.allSettled([
    fetchSchemaHashes(),
    fetchPresets(),
    fetchTasks(),
    fetchGraphicCards(),
    fetchTagEditorStatus(),
    fetchSchemasAll(),
  ]);

  const [schemaResult, presetResult, taskResult, gpuResult, tagEditorResult, schemaAllResult] = results;

  if (schemaResult.status === "fulfilled") {
    const schemas = schemaResult.value.data?.schemas ?? [];
    setText("diag-schemas-title", `已读取 ${schemas.length} 个 schema 哈希`);
    setText("diag-schemas-detail", schemas.slice(0, 4).map((schema) => schema.name).join(", ") || "没有返回 schema 名称。");
  } else {
    setText("diag-schemas-title", "schema 哈希读取失败");
    setText("diag-schemas-detail", schemaResult.reason instanceof Error ? schemaResult.reason.message : "未知错误");
  }

  if (presetResult.status === "fulfilled") {
    const presets = presetResult.value.data?.presets ?? [];
    setText("diag-presets-title", `已读取 ${presets.length} 个预设`);
    setText("diag-presets-detail", "这些预设后续可以继续复用到源码版训练页。");
  } else {
    setText("diag-presets-title", "预设读取失败");
    setText("diag-presets-detail", presetResult.reason instanceof Error ? presetResult.reason.message : "未知错误");
  }

  if (taskResult.status === "fulfilled") {
    const tasks = taskResult.value.data?.tasks ?? [];
    setText("diag-tasks-title", "任务管理器可访问");
    setText("diag-tasks-detail", formatTaskSummary(tasks));
  } else {
    setText("diag-tasks-title", "任务状态读取失败");
    setText("diag-tasks-detail", taskResult.reason instanceof Error ? taskResult.reason.message : "未知错误");
  }

  if (gpuResult.status === "fulfilled") {
    const cards = gpuResult.value.data?.cards ?? [];
    const xformers = gpuResult.value.data?.xformers;
    const runtime = gpuResult.value.data?.runtime;
    const xformersSummary = xformers
      ? `xformers: ${xformers.installed ? "已安装" : "缺失"}，${xformers.supported ? "可用" : "回退"}`
      : "xformers 信息不可用";
    const runtimeSummary = runtime
      ? `${runtime.environment} 运行时 · Python ${runtime.python_version} | ${formatRuntimePackages(runtime.packages)}`
      : "运行时依赖状态不可用";
    setText("diag-gpu-title", `可访问 ${cards.length} 条 GPU 记录`);
    setText("diag-gpu-detail", `${formatGpuList(cards)} | ${xformersSummary} | ${runtimeSummary}`);
  } else {
    setText("diag-gpu-title", "GPU 状态读取失败");
    setText("diag-gpu-detail", gpuResult.reason instanceof Error ? gpuResult.reason.message : "未知错误");
  }

  if (tagEditorResult.status === "fulfilled") {
    setText("diag-tageditor-title", "标签编辑器状态可访问");
    setText("diag-tageditor-detail", formatTagEditor(tagEditorResult.value));
  } else {
    setText("diag-tageditor-title", "标签编辑器状态读取失败");
    setText("diag-tageditor-detail", tagEditorResult.reason instanceof Error ? tagEditorResult.reason.message : "未知错误");
  }

  if (schemaAllResult.status === "fulfilled") {
    const schemas = schemaAllResult.value.data?.schemas ?? [];
    renderSchemaBrowser(schemas);
    renderSchemaCoverage(schemas);
    renderTrainingRouteCatalog(schemas, presetResult.status === "fulfilled" ? presetResult.value.data?.presets ?? [] : []);
  } else {
    setHtml("schema-browser", `<p>${schemaAllResult.reason instanceof Error ? schemaAllResult.reason.message : "schema 清单读取失败。"}</p>`);
    renderTrainingRouteCatalog([], presetResult.status === "fulfilled" ? presetResult.value.data?.presets ?? [] : []);
  }
}

function inferTrainingFamily(schemaName: string) {
  if (schemaName.includes("controlnet")) {
    return "ControlNet";
  }
  if (schemaName.includes("textual-inversion") || schemaName.includes("xti")) {
    return "Textual Inversion";
  }
  if (schemaName.includes("finetune") || schemaName === "dreambooth") {
    return "Finetune";
  }
  return "LoRA";
}

function inferRouteCapabilities(config: { routeId: string; schemaName: string }, schemaSource: string, family: string) {
  const capabilities: string[] = ["启动前检查", "提示词工作区", "历史记录", "本地配方"];

  if (schemaSource.includes("resume:")) {
    capabilities.push("续训");
  }
  if (schemaSource.includes("prompt_file") || schemaSource.includes("positive_prompts")) {
    capabilities.push("示例提示词");
  }
  if (schemaSource.includes("validation_split")) {
    capabilities.push("验证集");
  }
  if (schemaSource.includes("masked_loss")) {
    capabilities.push("蒙版损失");
  }
  if (schemaSource.includes("save_state")) {
    capabilities.push("保存状态");
  }
  if (schemaSource.includes("conditioning_data_dir")) {
    capabilities.push("条件图");
  }
  if (family === "Textual Inversion") {
    capabilities.push("Embedding");
  }
  if (family === "ControlNet") {
    capabilities.push("controlnet");
  }
  if (config.routeId.startsWith("sdxl")) {
    capabilities.push("实验性 clip_skip");
  }

  return [...new Set(capabilities)];
}

function renderTrainingRouteCatalog(
  schemas: Array<{ name: string; schema?: string }>,
  presets: Array<Record<string, unknown>>
) {
  const schemaMap = new Map(schemas.map((schema) => [schema.name, String(schema.schema ?? "")]));

  const records = Object.values(trainingRouteConfigs)
    .map((config) => {
      const route = appRoutes.find((entry) => entry.id === config.routeId);
      const family = inferTrainingFamily(config.schemaName);
      const schemaSource = schemaMap.get(config.schemaName) ?? "";
      const presetCount = presets.filter((preset) => {
        const metadata = (preset.metadata ?? {}) as Record<string, unknown>;
        const trainType = metadata.train_type;
        if (typeof trainType !== "string" || trainType.trim().length === 0) {
          return false;
        }
        return config.presetTrainTypes.includes(trainType);
      }).length;
      const localHistoryCount = loadTrainingHistory(config.routeId).length;
      const localRecipeCount = loadTrainingRecipes(config.routeId).length;
      const autosaveReady = Boolean(loadTrainingAutosave(config.routeId)?.value);

      return {
        routeId: config.routeId,
        title: route?.label ?? config.modelLabel,
        routeHash: route?.hash ?? "#/workspace",
        schemaName: config.schemaName,
        modelLabel: config.modelLabel,
        family,
        presetCount,
        localHistoryCount,
        localRecipeCount,
        autosaveReady,
        schemaAvailable: schemaMap.has(config.schemaName),
        capabilities: inferRouteCapabilities(config, schemaSource, family),
      };
    })
    .sort((left, right) => left.family.localeCompare(right.family) || left.title.localeCompare(right.title));

  renderTrainingCatalog(records);
}
