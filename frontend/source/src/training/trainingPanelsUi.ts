import { setHtml } from "../shared/domUtils";
import { normalizeTrainingPayload } from "./trainingPayload";
import type { TrainingRecipeRecord, TrainingSnapshotRecord } from "./trainingStorage";
import type { TrainingRouteConfig } from "./trainingRouteConfig";
import type { PanelName, TrainingStateLike } from "./trainingUiTypes";
import type { PresetRecord } from "../shared/types";
import { cloneJson, escapeHtml } from "../shared/textUtils";

function renderPanelSummary(countLabel: string, detail: string) {
  return `
    <div class="training-library-meta">
      <span class="coverage-pill coverage-pill-muted">${escapeHtml(countLabel)}</span>
    </div>
    <p class="training-library-note">${escapeHtml(detail)}</p>
  `;
}

type LibraryCompatibility = {
  compatible: boolean;
  label: string;
  detail: string;
  tone: "default" | "muted" | "warning";
};

function getTrainTypeLabel(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export function getPresetCompatibility(config: TrainingRouteConfig, preset: PresetRecord): LibraryCompatibility {
  const metadata = (preset.metadata ?? {}) as Record<string, unknown>;
  const trainType = getTrainTypeLabel(metadata.train_type);
  if (!trainType) {
    return {
      compatible: true,
      label: "通用预设",
      detail: "这个预设没有声明 train_type，应用前请再确认一次当前训练页的专属字段。",
      tone: "muted",
    };
  }

  if (config.presetTrainTypes.includes(trainType)) {
    return {
      compatible: true,
      label: "当前路线预设",
      detail: `这个预设的 train_type = ${trainType}，和当前训练路线匹配。`,
      tone: "default",
    };
  }

  return {
    compatible: false,
    label: "跨路线预设",
    detail: `这个预设面向 ${trainType}，与当前的 ${config.schemaName} 不一致。`,
    tone: "warning",
  };
}

export function getRecipeCompatibility(config: TrainingRouteConfig, recipe: TrainingRecipeRecord): LibraryCompatibility {
  const routeId = getTrainTypeLabel(recipe.route_id);
  const trainType = getTrainTypeLabel(recipe.train_type);

  if (routeId === config.routeId) {
    return {
      compatible: true,
      label: "当前路线配方",
      detail: "这个配方就是从当前源码训练页保存下来的。",
      tone: "default",
    };
  }

  if (trainType && config.presetTrainTypes.includes(trainType)) {
    return {
      compatible: true,
      label: "同族配方",
      detail: `这个配方的 train_type = ${trainType}，和当前训练路线家族匹配。`,
      tone: "default",
    };
  }

  if (!routeId && !trainType) {
    return {
      compatible: true,
      label: "通用配方",
      detail: "这个配方没有记录路线元数据，应用前请手动确认当前训练页的专属字段。",
      tone: "muted",
    };
  }

  if (routeId) {
    return {
      compatible: false,
      label: "跨路线配方",
      detail: `这个配方记录的来源路线是 ${routeId}，并不是当前的 ${config.routeId}。`,
      tone: "warning",
    };
  }

  return {
    compatible: false,
    label: "不同训练类型",
    detail: `这个配方面向 ${trainType}，与当前的 ${config.schemaName} 不一致。`,
    tone: "warning",
  };
}

export function getSnapshotName(config: TrainingRouteConfig, state: TrainingStateLike) {
  const outputName = state.values.output_name;
  if (typeof outputName === "string" && outputName.trim().length > 0) {
    return outputName.trim();
  }
  return `${config.modelLabel} 参数快照`;
}

export function getTrainingHistoryPreview(snapshot: TrainingSnapshotRecord) {
  try {
    return JSON.stringify(normalizeTrainingPayload(cloneJson(snapshot.value)), null, 2);
  } catch (error) {
    return error instanceof Error ? error.message : "暂时无法预览这个快照。";
  }
}

export function renderHistoryPanel(prefix: string, entries: TrainingSnapshotRecord[]) {
  if (entries.length === 0) {
    setHtml(
      `${prefix}-history-panel`,
      `
        <div class="training-side-panel-head">
          <div>
            <p class="panel-kicker">历史 / history</p>
            <h3>参数历史</h3>
          </div>
          <div class="history-toolbar">
            <button class="action-button action-button-ghost action-button-small" data-history-export="${prefix}" type="button">导出</button>
            <button class="action-button action-button-ghost action-button-small" data-history-import="${prefix}" type="button">导入</button>
            <button class="action-button action-button-ghost action-button-small" data-history-close="${prefix}" type="button">关闭</button>
          </div>
        </div>
        ${renderPanelSummary("0 个快照", "参数快照会保存在当前浏览器里，可用于恢复表单值和所选 GPU。")}
        <p>当前还没有保存过参数快照。</p>
      `
    );
    return;
  }

  const items = entries
    .map(
      (entry, index) => `
        <article class="history-card">
          <div class="history-card-head">
            <div>
              <h4>${escapeHtml(entry.name || "未命名快照")}</h4>
              <p class="history-card-meta">${escapeHtml(entry.time)}</p>
            </div>
            <span class="coverage-pill coverage-pill-muted">${escapeHtml((entry.gpu_ids ?? []).join(", ") || "默认 GPU")}</span>
          </div>
          <pre class="history-preview">${escapeHtml(getTrainingHistoryPreview(entry))}</pre>
          <div class="history-card-actions">
            <button class="action-button action-button-ghost action-button-small" data-history-apply="${index}" type="button">应用</button>
            <button class="action-button action-button-ghost action-button-small" data-history-rename="${index}" type="button">重命名</button>
            <button class="action-button action-button-ghost action-button-small" data-history-delete="${index}" type="button">删除</button>
          </div>
        </article>
      `
    )
    .join("");

  setHtml(
    `${prefix}-history-panel`,
    `
      <div class="training-side-panel-head">
        <div>
          <p class="panel-kicker">历史 / history</p>
          <h3>参数历史</h3>
        </div>
        <div class="history-toolbar">
          <button class="action-button action-button-ghost action-button-small" data-history-export="${prefix}" type="button">导出</button>
          <button class="action-button action-button-ghost action-button-small" data-history-import="${prefix}" type="button">导入</button>
          <button class="action-button action-button-ghost action-button-small" data-history-close="${prefix}" type="button">关闭</button>
        </div>
      </div>
      ${renderPanelSummary(`${entries.length} 个快照`, "参数快照会保存在当前浏览器里，可用于恢复表单值和所选 GPU。")}
      <div class="history-list">${items}</div>
    `
  );
}

export function renderPresetPanel(prefix: string, presets: PresetRecord[], config: TrainingRouteConfig) {
  if (presets.length === 0) {
    setHtml(
      `${prefix}-presets-panel`,
      `
        <div class="training-side-panel-head">
          <div>
            <p class="panel-kicker">预设 / presets</p>
            <h3>训练预设</h3>
          </div>
          <button class="action-button action-button-ghost action-button-small" data-preset-close="${prefix}" type="button">关闭</button>
        </div>
        ${renderPanelSummary("0 个预设", "后端预设是共享的只读模板；如果要改动，建议先另存为本地配方。")}
        <p>当前没有匹配这个训练路线的预设。</p>
      `
    );
    return;
  }

  const items = presets
    .map((preset, index) => {
      const metadata = (preset.metadata ?? {}) as Record<string, unknown>;
      const data = (preset.data ?? {}) as Record<string, unknown>;
      const compatibility = getPresetCompatibility(config, preset);
      const compatibilityClass = compatibility.tone === "warning" ? "coverage-pill-warning" : compatibility.tone === "muted" ? "coverage-pill-muted" : "";
      const trainType = getTrainTypeLabel(metadata.train_type);
      return `
        <article class="preset-card">
          <div class="preset-card-head">
            <div>
              <h4>${escapeHtml(metadata.name || preset.name || `预设 ${index + 1}`)}</h4>
              <p class="preset-card-meta">
                ${escapeHtml(String(metadata.version || "未知版本"))}
                · ${escapeHtml(String(metadata.author || "未知作者"))}
              </p>
            </div>
            <span class="coverage-pill coverage-pill-muted">${escapeHtml(String(metadata.train_type || "共享"))}</span>
          </div>
          <p>${escapeHtml(String(metadata.description || "暂无说明"))}</p>
          <div class="coverage-list training-card-compatibility">
            <span class="coverage-pill ${compatibilityClass}">${escapeHtml(compatibility.label)}</span>
            ${trainType ? `<span class="coverage-pill coverage-pill-muted">${escapeHtml(trainType)}</span>` : ""}
          </div>
          <p class="training-card-note">${escapeHtml(compatibility.detail)}</p>
          <pre class="preset-preview">${escapeHtml(JSON.stringify(data, null, 2))}</pre>
          <div class="preset-card-actions">
            <button class="action-button action-button-ghost action-button-small" data-preset-save-recipe="${index}" type="button">保存为配方</button>
            <button class="action-button action-button-ghost action-button-small" data-preset-merge="${index}" type="button">合并</button>
            <button class="action-button action-button-ghost action-button-small" data-preset-replace="${index}" type="button">替换</button>
          </div>
        </article>
      `;
    })
    .join("");

  setHtml(
    `${prefix}-presets-panel`,
    `
      <div class="training-side-panel-head">
        <div>
          <p class="panel-kicker">预设 / presets</p>
          <h3>训练预设</h3>
        </div>
        <button class="action-button action-button-ghost action-button-small" data-preset-close="${prefix}" type="button">关闭</button>
      </div>
      ${renderPanelSummary(`${presets.length} 个预设`, "后端预设是共享的只读模板；如果要改动，建议先另存为本地配方。")}
      <div class="preset-list">${items}</div>
    `
  );
}

export function renderRecipePanel(prefix: string, recipes: TrainingRecipeRecord[], config: TrainingRouteConfig) {
  if (recipes.length === 0) {
    setHtml(
      `${prefix}-recipes-panel`,
      `
        <div class="training-side-panel-head">
          <div>
            <p class="panel-kicker">配方 / recipes</p>
            <h3>本地配方库</h3>
          </div>
          <div class="history-toolbar">
            <button class="action-button action-button-ghost action-button-small" data-recipe-export-all="${prefix}" type="button">导出</button>
            <button class="action-button action-button-ghost action-button-small" data-recipe-import="${prefix}" type="button">导入</button>
            <button class="action-button action-button-ghost action-button-small" data-recipe-close="${prefix}" type="button">关闭</button>
          </div>
        </div>
        ${renderPanelSummary("0 个配方", "配方是按训练路线保存在当前浏览器里的可编辑副本；导入会合并 JSON 或 TOML，导出则会写出预设 TOML。")}
        <p>这个训练路线当前还没有保存过配方。</p>
      `
    );
    return;
  }

  const items = recipes
    .map(
      (recipe, index) => {
        const compatibility = getRecipeCompatibility(config, recipe);
        const compatibilityClass = compatibility.tone === "warning" ? "coverage-pill-warning" : compatibility.tone === "muted" ? "coverage-pill-muted" : "";
        return `
        <article class="preset-card">
          <div class="preset-card-head">
            <div>
              <h4>${escapeHtml(recipe.name)}</h4>
              <p class="preset-card-meta">
                ${escapeHtml(recipe.created_at)}
                ${recipe.train_type ? ` · ${escapeHtml(recipe.train_type)}` : ""}
              </p>
            </div>
            <span class="coverage-pill coverage-pill-muted">${escapeHtml(recipe.route_id || "本地")}</span>
          </div>
          <p>${escapeHtml(recipe.description || "暂无说明")}</p>
          <div class="coverage-list training-card-compatibility">
            <span class="coverage-pill ${compatibilityClass}">${escapeHtml(compatibility.label)}</span>
            ${recipe.train_type ? `<span class="coverage-pill coverage-pill-muted">${escapeHtml(recipe.train_type)}</span>` : ""}
          </div>
          <p class="training-card-note">${escapeHtml(compatibility.detail)}</p>
          <pre class="preset-preview">${escapeHtml(JSON.stringify(normalizeTrainingPayload(cloneJson(recipe.value)), null, 2))}</pre>
          <div class="preset-card-actions">
            <button class="action-button action-button-ghost action-button-small" data-recipe-merge="${index}" type="button">合并</button>
            <button class="action-button action-button-ghost action-button-small" data-recipe-replace="${index}" type="button">替换</button>
            <button class="action-button action-button-ghost action-button-small" data-recipe-export="${index}" type="button">导出</button>
            <button class="action-button action-button-ghost action-button-small" data-recipe-rename="${index}" type="button">重命名</button>
            <button class="action-button action-button-ghost action-button-small" data-recipe-delete="${index}" type="button">删除</button>
          </div>
        </article>
      `;
      }
    )
    .join("");

  setHtml(
    `${prefix}-recipes-panel`,
    `
      <div class="training-side-panel-head">
        <div>
          <p class="panel-kicker">配方 / recipes</p>
          <h3>本地配方库</h3>
        </div>
        <div class="history-toolbar">
          <button class="action-button action-button-ghost action-button-small" data-recipe-export-all="${prefix}" type="button">导出</button>
          <button class="action-button action-button-ghost action-button-small" data-recipe-import="${prefix}" type="button">导入</button>
          <button class="action-button action-button-ghost action-button-small" data-recipe-close="${prefix}" type="button">关闭</button>
        </div>
      </div>
      ${renderPanelSummary(`${recipes.length} 个配方`, "配方是按训练路线保存在当前浏览器里的可编辑副本；导入会合并 JSON 或 TOML，导出则会写出预设 TOML。")}
      <div class="preset-list">${items}</div>
    `
  );
}

export function filterPresetsForRoute(config: TrainingRouteConfig, presets: PresetRecord[]) {
  const allowed = new Set(config.presetTrainTypes);
  return presets.filter((preset) => {
    const metadata = (preset.metadata ?? {}) as Record<string, unknown>;
    const trainType = metadata.train_type;
    if (typeof trainType !== "string" || trainType.trim().length === 0) {
      return true;
    }
    return allowed.has(trainType);
  });
}

export function toggleTrainingPanel(prefix: string, panel: PanelName, open: boolean) {
  const historyPanel = document.querySelector<HTMLElement>(`#${prefix}-history-panel`);
  const recipesPanel = document.querySelector<HTMLElement>(`#${prefix}-recipes-panel`);
  const presetsPanel = document.querySelector<HTMLElement>(`#${prefix}-presets-panel`);

  if (historyPanel) {
    historyPanel.hidden = panel === "history" ? !open : true;
  }

  if (recipesPanel) {
    recipesPanel.hidden = panel === "recipes" ? !open : true;
  }

  if (presetsPanel) {
    presetsPanel.hidden = panel === "presets" ? !open : true;
  }
}
