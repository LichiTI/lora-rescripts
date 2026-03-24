import { fetchGraphicCards, fetchSchemasAll } from "../services/api";
import { setHtml, setPreText, setText } from "../shared/domUtils";
import { evaluateSchemaCatalog } from "../schema/schemaRuntime";
import {
  buildSchemaBridgeState,
  getSchemaBridgeSelectableRecords,
  getTrainingDomIds,
  type SchemaBridgeState,
  type SchemaEditorDomIds,
} from "../schema/schemaEditor";
import { formatGpuList } from "../shared/statusFormatters";
import type { RuntimePackageRecord } from "../shared/types";
import type { TrainingRouteConfig } from "./trainingRouteConfig";
import { renderGpuSelector, renderTrainSubmitStatus } from "./trainingUi";
import { escapeHtml } from "../shared/textUtils";

const TRACKED_RUNTIME_PACKAGES = [
  "pytorch_optimizer",
  "schedulefree",
  "bitsandbytes",
  "prodigyplus",
  "prodigyopt",
  "lion_pytorch",
  "dadaptation",
  "transformers",
];

function formatRuntimePackageSummary(packages?: Record<string, RuntimePackageRecord>) {
  if (!packages) {
    return "运行时依赖状态不可用";
  }

  const tracked = TRACKED_RUNTIME_PACKAGES
    .map((name) => packages[name])
    .filter((record): record is RuntimePackageRecord => Boolean(record));

  if (tracked.length === 0) {
    return "运行时依赖状态不可用";
  }

  return tracked
    .map((record) => `${record.display_name}:${record.importable ? "可用" : record.installed ? "异常" : "缺失"}`)
    .join(" | ");
}

export type TrainingRouteRuntimeContext = {
  domIds: SchemaEditorDomIds;
  createDefaultState: () => SchemaBridgeState;
};

export async function initializeTrainingRouteRuntime(config: TrainingRouteConfig): Promise<TrainingRouteRuntimeContext | null> {
  const domIds = getTrainingDomIds(config.prefix);
  const [schemaResult, gpuResult] = await Promise.allSettled([fetchSchemasAll(), fetchGraphicCards()]);

  if (gpuResult.status === "fulfilled") {
    const cards = gpuResult.value.data?.cards ?? [];
    const xformers = gpuResult.value.data?.xformers;
    const runtime = gpuResult.value.data?.runtime;
    renderGpuSelector(`${config.prefix}-gpu-selector`, cards);
    setText(
      `${config.prefix}-runtime-title`,
      `已读取 ${cards.length} 条 GPU 记录${runtime ? ` · ${runtime.environment} Python ${runtime.python_version}` : ""}`
    );
    setHtml(
      `${config.prefix}-runtime-body`,
      `
        <p>${escapeHtml(formatGpuList(cards))}</p>
        <p>${escapeHtml(
          xformers
            ? `xformers：${xformers.installed ? "已安装" : "缺失"}，${xformers.supported ? "可用" : "回退"}${xformers.reason ? `（${xformers.reason}）` : ""}`
            : "xformers 信息不可用"
        )}</p>
        <p>${escapeHtml(formatRuntimePackageSummary(runtime?.packages))}</p>
      `
    );
  } else {
    setText(`${config.prefix}-runtime-title`, "GPU 运行时请求失败");
    setText(`${config.prefix}-runtime-body`, gpuResult.reason instanceof Error ? gpuResult.reason.message : "未知错误");
  }

  if (schemaResult.status !== "fulfilled") {
    setText(domIds.summaryId, `${config.modelLabel} 的 schema 请求失败`);
    setHtml(domIds.sectionsId, `<p>${schemaResult.reason instanceof Error ? escapeHtml(schemaResult.reason.message) : "未知错误"}</p>`);
    setPreText(domIds.previewId, "{}");
    renderTrainSubmitStatus(config.prefix, "schema 不可用", `${config.modelLabel} 训练页未能读取后端 schema。`, "error");
    return null;
  }

  const records = schemaResult.value.data?.schemas ?? [];
  const catalog = evaluateSchemaCatalog(records);
  const preferred = getSchemaBridgeSelectableRecords(catalog).find((record) => record.name === config.schemaName)?.name;

  if (!preferred) {
    setText(domIds.summaryId, `后端没有返回 ${config.schemaName} schema。`);
    setHtml(domIds.sectionsId, `<p>后端没有暴露 ${escapeHtml(config.schemaName)}。</p>`);
    renderTrainSubmitStatus(config.prefix, "schema 缺失", `后端没有暴露 ${config.schemaName} schema。`, "error");
    return null;
  }

  return {
    domIds,
    createDefaultState: () => buildSchemaBridgeState(catalog, preferred)!,
  };
}
