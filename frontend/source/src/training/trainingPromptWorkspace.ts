import type { SchemaBridgeState } from "../schema/schemaEditor";
import { previewTrainingSamplePrompt, pickFile } from "../services/api";
import type { TrainingSamplePromptRecord } from "../shared/types";
import { setHtml } from "../shared/domUtils";
import { escapeHtml } from "../shared/textUtils";
import { downloadTextFile } from "./trainingStorage";
import { setTrainingUtilityNote } from "./trainingStatusUi";
import type { TrainingRouteConfig } from "./trainingRouteConfig";
import type { EditableRecordMode, PreparedTrainingPayload } from "./trainingRouteState";

type BuildPreparedTrainingPayload = (state: SchemaBridgeState) => PreparedTrainingPayload;

type ApplyEditableRecord = (
  record: Record<string, unknown>,
  gpuIds?: string[],
  mode?: EditableRecordMode
) => void;

function renderSamplePromptPlaceholder(prefix: string, title: string, detail: string) {
  setHtml(
    `${prefix}-sample-prompt-workspace`,
    `
      <div class="submit-status-box">
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(detail)}</p>
      </div>
    `
  );
}

function formatPromptSource(source: string) {
  switch (source) {
    case "prompt_file":
      return "提示词文件";
    case "generated":
      return "由当前字段生成";
    case "random_dataset_prompt_preview":
      return "随机数据集提示词预览";
    case "legacy_sample_prompts_file":
      return "旧版 sample_prompts 文件";
    case "legacy_sample_prompts_inline":
      return "旧版 sample_prompts 文本";
    default:
      return source;
  }
}

export function invalidateTrainingSamplePromptWorkspace(prefix: string) {
  renderSamplePromptPlaceholder(
    prefix,
    "采样提示词工作区等待刷新",
    "可以先自由修改提示词相关字段，再点击“刷新预览”查看训练真正会使用的文本。"
  );
}

export function renderTrainingSamplePromptWorkspace(
  prefix: string,
  record?: TrainingSamplePromptRecord | null,
  errorMessage?: string
) {
  if (errorMessage) {
    setHtml(
      `${prefix}-sample-prompt-workspace`,
      `
        <div class="submit-status-box submit-status-error">
          <strong>采样提示词预览失败</strong>
          <p>${escapeHtml(errorMessage)}</p>
        </div>
      `
    );
    return;
  }

  if (!record) {
    invalidateTrainingSamplePromptWorkspace(prefix);
    return;
  }

  const lists = [
    record.warnings.length
      ? `
          <div>
            <strong>警告</strong>
            <ul class="status-list">
              ${record.warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </div>
        `
      : "",
    record.notes.length
      ? `
          <div>
            <strong>说明</strong>
            <ul class="status-list">
              ${record.notes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </div>
        `
      : "",
  ]
    .filter(Boolean)
    .join("");

  const toneClass = record.warnings.length > 0 || !record.enabled ? "submit-status-warning" : "submit-status-success";
  const previewHint = record.line_count > 3
    ? `当前显示前 3 行非空内容，总共 ${record.line_count} 行。`
    : `当前检测到 ${record.line_count || 0} 行非空内容。`;

  setHtml(
    `${prefix}-sample-prompt-workspace`,
    `
      <div class="submit-status-box ${toneClass}">
        <strong>${record.enabled ? "采样提示词已解析" : "采样提示词已解析，但预览当前被禁用"}</strong>
        <p class="training-preflight-meta">${escapeHtml(formatPromptSource(record.source))}${record.detail ? ` · ${escapeHtml(record.detail)}` : ""}</p>
        <p class="training-preflight-meta">${escapeHtml(previewHint)} 下载时将使用 ${escapeHtml(record.suggested_file_name)}。</p>
        ${lists}
        <pre class="preset-preview">${escapeHtml(record.preview)}</pre>
      </div>
    `
  );
}

async function resolvePromptRecord(
  config: TrainingRouteConfig,
  getCurrentState: () => SchemaBridgeState | null,
  buildPreparedTrainingPayload: BuildPreparedTrainingPayload
) {
  const currentState = getCurrentState();
  if (!currentState) {
    throw new Error(`${config.modelLabel} 编辑器还没有准备完成。`);
  }

  const prepared = buildPreparedTrainingPayload(currentState);
  const result = await previewTrainingSamplePrompt(prepared.payload);
  if (result.status !== "success" || !result.data) {
    throw new Error(result.message || "采样提示词预览失败。");
  }

  return result.data;
}

export function wireTrainingSamplePromptWorkspace(options: {
  config: TrainingRouteConfig;
  getCurrentState: () => SchemaBridgeState | null;
  buildPreparedTrainingPayload: BuildPreparedTrainingPayload;
  applyEditableRecord: ApplyEditableRecord;
}) {
  const { config, getCurrentState, buildPreparedTrainingPayload, applyEditableRecord } = options;

  document.querySelector<HTMLButtonElement>(`#${config.prefix}-refresh-sample-prompt`)?.addEventListener("click", async () => {
    try {
      const record = await resolvePromptRecord(config, getCurrentState, buildPreparedTrainingPayload);
      renderTrainingSamplePromptWorkspace(config.prefix, record);
      setTrainingUtilityNote(config.prefix, "采样提示词预览已刷新。", "success");
    } catch (error) {
      renderTrainingSamplePromptWorkspace(
        config.prefix,
        null,
        error instanceof Error ? error.message : "采样提示词预览失败。"
      );
      setTrainingUtilityNote(
        config.prefix,
        error instanceof Error ? error.message : "采样提示词预览失败。",
        "error"
      );
    }
  });

  document.querySelector<HTMLButtonElement>(`#${config.prefix}-download-sample-prompt`)?.addEventListener("click", async () => {
    try {
      const record = await resolvePromptRecord(config, getCurrentState, buildPreparedTrainingPayload);
      renderTrainingSamplePromptWorkspace(config.prefix, record);
      downloadTextFile(record.suggested_file_name || "sample-prompts.txt", record.content || "");
      setTrainingUtilityNote(config.prefix, `采样提示词已导出为 ${record.suggested_file_name}。`, "success");
    } catch (error) {
      renderTrainingSamplePromptWorkspace(
        config.prefix,
        null,
        error instanceof Error ? error.message : "采样提示词导出失败。"
      );
      setTrainingUtilityNote(
        config.prefix,
        error instanceof Error ? error.message : "采样提示词导出失败。",
        "error"
      );
    }
  });

  document.querySelector<HTMLButtonElement>(`#${config.prefix}-pick-prompt-file`)?.addEventListener("click", async () => {
    try {
      const path = await pickFile("text-file");
      applyEditableRecord({ prompt_file: path }, undefined, "merge");
      invalidateTrainingSamplePromptWorkspace(config.prefix);
      setTrainingUtilityNote(config.prefix, "提示词文件路径已经写入当前表单。", "success");
    } catch (error) {
      setTrainingUtilityNote(config.prefix, error instanceof Error ? error.message : "提示词文件选择失败。", "error");
    }
  });

  document.querySelector<HTMLButtonElement>(`#${config.prefix}-clear-prompt-file`)?.addEventListener("click", () => {
    applyEditableRecord({ prompt_file: "" }, undefined, "merge");
    invalidateTrainingSamplePromptWorkspace(config.prefix);
    setTrainingUtilityNote(config.prefix, "当前表单里的 prompt_file 已清空。", "warning");
  });
}
