import {
  fetchGraphicCards,
  fetchPresets,
  fetchSchemaHashes,
  fetchSchemasAll,
  fetchTagEditorStatus,
  fetchTasks,
} from "../services/api";
import { setHtml, setText } from "../shared/domUtils";
import { renderSchemaBrowser, renderSchemaCoverage } from "../renderers/pageInventoryRenderers";
import { formatGpuList, formatTagEditor, formatTaskSummary } from "../shared/statusFormatters";

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
    setText("diag-schemas-title", `${schemas.length} schema hashes loaded`);
    setText("diag-schemas-detail", schemas.slice(0, 4).map((schema) => schema.name).join(", ") || "No schema names returned.");
  } else {
    setText("diag-schemas-title", "Schema hash request failed");
    setText("diag-schemas-detail", schemaResult.reason instanceof Error ? schemaResult.reason.message : "Unknown error");
  }

  if (presetResult.status === "fulfilled") {
    const presets = presetResult.value.data?.presets ?? [];
    setText("diag-presets-title", `${presets.length} presets loaded`);
    setText("diag-presets-detail", "Source migration can reuse preset grouping later.");
  } else {
    setText("diag-presets-title", "Preset request failed");
    setText("diag-presets-detail", presetResult.reason instanceof Error ? presetResult.reason.message : "Unknown error");
  }

  if (taskResult.status === "fulfilled") {
    const tasks = taskResult.value.data?.tasks ?? [];
    setText("diag-tasks-title", "Task manager reachable");
    setText("diag-tasks-detail", formatTaskSummary(tasks));
  } else {
    setText("diag-tasks-title", "Task request failed");
    setText("diag-tasks-detail", taskResult.reason instanceof Error ? taskResult.reason.message : "Unknown error");
  }

  if (gpuResult.status === "fulfilled") {
    const cards = gpuResult.value.data?.cards ?? [];
    const xformers = gpuResult.value.data?.xformers;
    const xformersSummary = xformers
      ? `xformers: ${xformers.installed ? "installed" : "missing"}, ${xformers.supported ? "supported" : "fallback"}`
      : "xformers info unavailable";
    setText("diag-gpu-title", `${cards.length} GPU entries reachable`);
    setText("diag-gpu-detail", `${formatGpuList(cards)} | ${xformersSummary}`);
  } else {
    setText("diag-gpu-title", "GPU request failed");
    setText("diag-gpu-detail", gpuResult.reason instanceof Error ? gpuResult.reason.message : "Unknown error");
  }

  if (tagEditorResult.status === "fulfilled") {
    setText("diag-tageditor-title", "Tag editor status reachable");
    setText("diag-tageditor-detail", formatTagEditor(tagEditorResult.value));
  } else {
    setText("diag-tageditor-title", "Tag editor status request failed");
    setText("diag-tageditor-detail", tagEditorResult.reason instanceof Error ? tagEditorResult.reason.message : "Unknown error");
  }

  if (schemaAllResult.status === "fulfilled") {
    const schemas = schemaAllResult.value.data?.schemas ?? [];
    renderSchemaBrowser(schemas);
    renderSchemaCoverage(schemas);
  } else {
    setHtml("schema-browser", `<p>${schemaAllResult.reason instanceof Error ? schemaAllResult.reason.message : "Schema inventory request failed."}</p>`);
  }
}
