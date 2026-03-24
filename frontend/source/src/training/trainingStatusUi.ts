import { setHtml } from "../shared/domUtils";
import type { TrainingCheckResult } from "./trainingPayload";
import type { UtilityTone } from "./trainingUiTypes";
import type { TrainingPreflightRecord } from "../shared/types";
import { escapeHtml } from "../shared/textUtils";
import type { TrainingSnapshotRecord } from "./trainingStorage";

function formatPromptSourceLabel(source: string) {
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

function formatDependencyStatus(report: TrainingPreflightRecord["dependencies"]) {
  if (!report || report.required.length === 0) {
    return "";
  }

  return `
    <div>
      <strong>运行时依赖</strong>
      <ul class="status-list">
        ${report.required
          .map((dependency) => {
            const requirement = dependency.required_for.join(", ");
            const status = dependency.importable
              ? `${dependency.display_name} 可用${dependency.version ? ` (${dependency.version})` : ""}`
              : `${dependency.display_name} 不可用${dependency.reason ? `：${dependency.reason}` : ""}`;
            return `<li>${escapeHtml(`${status} · ${requirement}`)}</li>`;
          })
          .join("")}
      </ul>
    </div>
  `;
}

export function renderTrainSubmitStatus(
  prefix: string,
  title: string,
  detail: string,
  tone: UtilityTone = "idle"
) {
  setHtml(
    `${prefix}-submit-status`,
    `
      <div class="submit-status-box submit-status-${tone}">
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(detail)}</p>
      </div>
    `
  );
}

export function renderTrainValidationStatus(prefix: string, checks: TrainingCheckResult, preparationError?: string) {
  if (preparationError) {
    setHtml(
      `${prefix}-validation-status`,
      `
        <div class="submit-status-box submit-status-error">
          <strong>请求体准备失败</strong>
          <p>${escapeHtml(preparationError)}</p>
        </div>
      `
    );
    return;
  }

  const rows = [
    checks.errors.length > 0
      ? `
          <div>
            <strong>错误</strong>
            <ul class="status-list">
              ${checks.errors.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </div>
        `
      : "",
    checks.warnings.length > 0
      ? `
          <div>
            <strong>警告</strong>
            <ul class="status-list">
              ${checks.warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </div>
        `
      : "",
  ]
    .filter(Boolean)
    .join("");

  if (!rows) {
    setHtml(
      `${prefix}-validation-status`,
      `
        <div class="submit-status-box submit-status-success">
          <strong>兼容性检查通过</strong>
          <p>当前请求体里没有发现明显的参数冲突。</p>
        </div>
      `
    );
    return;
  }

  setHtml(
      `${prefix}-validation-status`,
      `
        <div class="submit-status-box ${checks.errors.length > 0 ? "submit-status-error" : "submit-status-warning"}">
        <strong>${checks.errors.length > 0 ? "启动前需要处理" : "启动前请确认"}</strong>
        ${rows}
      </div>
    `
  );
}

export function setTrainingUtilityNote(prefix: string, message: string, tone: UtilityTone = "idle") {
  const element = document.querySelector<HTMLElement>(`#${prefix}-utility-note`);
  if (!element) {
    return;
  }

  element.textContent = message;
  element.classList.remove("utility-note-success", "utility-note-warning", "utility-note-error");
  if (tone === "success") {
    element.classList.add("utility-note-success");
  } else if (tone === "warning") {
    element.classList.add("utility-note-warning");
  } else if (tone === "error") {
    element.classList.add("utility-note-error");
  }
}

export function renderTrainingAutosaveStatus(prefix: string, autosaveRecord?: TrainingSnapshotRecord | null) {
  if (!autosaveRecord?.value) {
    setHtml(
      `${prefix}-autosave-status`,
      `
        <div class="coverage-list">
          <span class="coverage-pill coverage-pill-muted">当前还没有本地自动保存</span>
        </div>
      `
    );
    return;
  }

  const selectedGpuCount = Array.isArray(autosaveRecord.gpu_ids) ? autosaveRecord.gpu_ids.length : 0;
  setHtml(
      `${prefix}-autosave-status`,
      `
      <div class="coverage-list">
        <span class="coverage-pill">自动保存可用</span>
        <span class="coverage-pill coverage-pill-muted">${escapeHtml(autosaveRecord.time)}</span>
        <span class="coverage-pill coverage-pill-muted">${selectedGpuCount > 0 ? `已选 ${selectedGpuCount} 张 GPU` : "使用默认 GPU 选择"}</span>
      </div>
      <p class="training-autosave-note">${escapeHtml(autosaveRecord.name || "未命名自动保存快照")}</p>
    `
  );
}

export function renderTrainingPreflightReport(prefix: string, report?: TrainingPreflightRecord | null, errorMessage?: string) {
  if (errorMessage) {
    setHtml(
      `${prefix}-preflight-report`,
      `
        <div class="submit-status-box submit-status-error">
          <strong>预检查请求失败</strong>
          <p>${escapeHtml(errorMessage)}</p>
        </div>
      `
    );
    return;
  }

  if (!report) {
    setHtml(
      `${prefix}-preflight-report`,
      `
        <div class="submit-status-box">
          <strong>训练预检查尚未运行</strong>
          <p>可以先运行预检查，确认数据集、模型、续训路径、采样提示词，以及运行时回退预期是否正常。</p>
        </div>
      `
    );
    return;
  }

  const sections = [
    report.errors.length
      ? `
          <div>
            <strong>错误</strong>
            <ul class="status-list">
              ${report.errors.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </div>
        `
      : "",
    report.warnings.length
      ? `
          <div>
            <strong>警告</strong>
            <ul class="status-list">
              ${report.warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </div>
        `
      : "",
    report.notes.length
      ? `
          <div>
            <strong>说明</strong>
            <ul class="status-list">
              ${report.notes.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </div>
        `
      : "",
    formatDependencyStatus(report.dependencies),
    report.dataset
      ? `
          <div>
            <strong>训练数据集</strong>
            <ul class="status-list">
              <li>${escapeHtml(report.dataset.path)}</li>
              <li>${report.dataset.image_count} 张图片 · 有效图片 ${report.dataset.effective_image_count} 张</li>
              <li>可用作 alpha 蒙版候选：${report.dataset.alpha_capable_image_count} 张</li>
              <li>标签覆盖率 ${(report.dataset.caption_coverage * 100).toFixed(1)}%</li>
              <li>无标签图片 ${report.dataset.images_without_caption_count} 张 · 损坏图片 ${report.dataset.broken_image_count} 张</li>
            </ul>
          </div>
        `
      : "",
    report.conditioning_dataset
      ? `
          <div>
            <strong>条件数据集</strong>
            <ul class="status-list">
              <li>${escapeHtml(report.conditioning_dataset.path)}</li>
              <li>${report.conditioning_dataset.image_count} 张图片 · 标签覆盖率 ${(report.conditioning_dataset.caption_coverage * 100).toFixed(1)}%</li>
            </ul>
          </div>
        `
      : "",
    report.sample_prompt
      ? `
          <div>
            <strong>采样提示词预览</strong>
            <p class="training-preflight-meta">${escapeHtml(formatPromptSourceLabel(report.sample_prompt.source))}${report.sample_prompt.detail ? ` · ${escapeHtml(report.sample_prompt.detail)}` : ""}</p>
            <pre class="preset-preview">${escapeHtml(report.sample_prompt.preview)}</pre>
          </div>
        `
      : "",
  ]
    .filter(Boolean)
    .join("");

  setHtml(
      `${prefix}-preflight-report`,
      `
      <div class="submit-status-box ${report.errors.length > 0 ? "submit-status-error" : report.can_start ? "submit-status-success" : "submit-status-warning"}">
        <strong>${report.can_start ? "后端预检查通过" : "后端预检查发现了启动阻塞项"}</strong>
        <p>训练类型：${escapeHtml(report.training_type)}</p>
        ${sections}
      </div>
    `
  );
}
