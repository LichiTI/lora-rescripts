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
import type { TrainingRouteConfig } from "./trainingRouteConfig";
import { renderGpuSelector, renderTrainSubmitStatus } from "./trainingUi";
import { escapeHtml } from "../shared/textUtils";

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
    renderGpuSelector(`${config.prefix}-gpu-selector`, cards);
    setText(`${config.prefix}-runtime-title`, `${cards.length} GPU entries reachable`);
    setHtml(
      `${config.prefix}-runtime-body`,
      `
        <p>${escapeHtml(formatGpuList(cards))}</p>
        <p>${escapeHtml(
          xformers
            ? `xformers: ${xformers.installed ? "installed" : "missing"}, ${xformers.supported ? "supported" : "fallback"} (${xformers.reason})`
            : "xformers info unavailable"
        )}</p>
      `
    );
  } else {
    setText(`${config.prefix}-runtime-title`, "GPU runtime request failed");
    setText(`${config.prefix}-runtime-body`, gpuResult.reason instanceof Error ? gpuResult.reason.message : "Unknown error");
  }

  if (schemaResult.status !== "fulfilled") {
    setText(domIds.summaryId, `${config.modelLabel} schema request failed`);
    setHtml(domIds.sectionsId, `<p>${schemaResult.reason instanceof Error ? escapeHtml(schemaResult.reason.message) : "Unknown error"}</p>`);
    setPreText(domIds.previewId, "{}");
    renderTrainSubmitStatus(config.prefix, "Schema unavailable", `The ${config.modelLabel} training bridge could not load the backend schema.`, "error");
    return null;
  }

  const records = schemaResult.value.data?.schemas ?? [];
  const catalog = evaluateSchemaCatalog(records);
  const preferred = getSchemaBridgeSelectableRecords(catalog).find((record) => record.name === config.schemaName)?.name;

  if (!preferred) {
    setText(domIds.summaryId, `No ${config.schemaName} schema was returned.`);
    setHtml(domIds.sectionsId, `<p>The backend did not expose ${escapeHtml(config.schemaName)}.</p>`);
    renderTrainSubmitStatus(config.prefix, "Schema missing", `The backend did not expose the ${config.schemaName} schema.`, "error");
    return null;
  }

  return {
    domIds,
    createDefaultState: () => buildSchemaBridgeState(catalog, preferred)!,
  };
}
