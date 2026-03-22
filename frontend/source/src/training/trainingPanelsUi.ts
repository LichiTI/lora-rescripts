import { setHtml } from "../shared/domUtils";
import { normalizeTrainingPayload } from "./trainingPayload";
import type { TrainingSnapshotRecord } from "./trainingStorage";
import type { TrainingRouteConfig } from "./trainingRouteConfig";
import type { PanelName, TrainingStateLike } from "./trainingUiTypes";
import type { PresetRecord } from "../shared/types";
import { cloneJson, escapeHtml } from "../shared/textUtils";

export function getSnapshotName(config: TrainingRouteConfig, state: TrainingStateLike) {
  const outputName = state.values.output_name;
  if (typeof outputName === "string" && outputName.trim().length > 0) {
    return outputName.trim();
  }
  return `${config.modelLabel} snapshot`;
}

export function getTrainingHistoryPreview(snapshot: TrainingSnapshotRecord) {
  try {
    return JSON.stringify(normalizeTrainingPayload(cloneJson(snapshot.value)), null, 2);
  } catch (error) {
    return error instanceof Error ? error.message : "Unable to preview this snapshot.";
  }
}

export function renderHistoryPanel(prefix: string, entries: TrainingSnapshotRecord[]) {
  if (entries.length === 0) {
    setHtml(
      `${prefix}-history-panel`,
      `
        <div class="training-side-panel-head">
          <div>
            <p class="panel-kicker">history</p>
            <h3>History parameters</h3>
          </div>
          <div class="history-toolbar">
            <button class="action-button action-button-ghost action-button-small" data-history-export="${prefix}" type="button">Export</button>
            <button class="action-button action-button-ghost action-button-small" data-history-import="${prefix}" type="button">Import</button>
            <button class="action-button action-button-ghost action-button-small" data-history-close="${prefix}" type="button">Close</button>
          </div>
        </div>
        <p>No saved parameter snapshots yet.</p>
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
              <h4>${escapeHtml(entry.name || "Unnamed snapshot")}</h4>
              <p class="history-card-meta">${escapeHtml(entry.time)}</p>
            </div>
            <span class="coverage-pill coverage-pill-muted">${escapeHtml((entry.gpu_ids ?? []).join(", ") || "default GPU")}</span>
          </div>
          <pre class="history-preview">${escapeHtml(getTrainingHistoryPreview(entry))}</pre>
          <div class="history-card-actions">
            <button class="action-button action-button-ghost action-button-small" data-history-apply="${index}" type="button">Apply</button>
            <button class="action-button action-button-ghost action-button-small" data-history-rename="${index}" type="button">Rename</button>
            <button class="action-button action-button-ghost action-button-small" data-history-delete="${index}" type="button">Delete</button>
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
          <p class="panel-kicker">history</p>
          <h3>History parameters</h3>
        </div>
        <div class="history-toolbar">
          <button class="action-button action-button-ghost action-button-small" data-history-export="${prefix}" type="button">Export</button>
          <button class="action-button action-button-ghost action-button-small" data-history-import="${prefix}" type="button">Import</button>
          <button class="action-button action-button-ghost action-button-small" data-history-close="${prefix}" type="button">Close</button>
        </div>
      </div>
      <div class="history-list">${items}</div>
    `
  );
}

export function renderPresetPanel(prefix: string, presets: PresetRecord[]) {
  if (presets.length === 0) {
    setHtml(
      `${prefix}-presets-panel`,
      `
        <div class="training-side-panel-head">
          <div>
            <p class="panel-kicker">presets</p>
            <h3>Training presets</h3>
          </div>
          <button class="action-button action-button-ghost action-button-small" data-preset-close="${prefix}" type="button">Close</button>
        </div>
        <p>No presets matched this training route.</p>
      `
    );
    return;
  }

  const items = presets
    .map((preset, index) => {
      const metadata = (preset.metadata ?? {}) as Record<string, unknown>;
      const data = (preset.data ?? {}) as Record<string, unknown>;
      return `
        <article class="preset-card">
          <div class="preset-card-head">
            <div>
              <h4>${escapeHtml(metadata.name || preset.name || `Preset ${index + 1}`)}</h4>
              <p class="preset-card-meta">
                ${escapeHtml(String(metadata.version || "unknown"))}
                · ${escapeHtml(String(metadata.author || "unknown author"))}
              </p>
            </div>
            <span class="coverage-pill coverage-pill-muted">${escapeHtml(String(metadata.train_type || "shared"))}</span>
          </div>
          <p>${escapeHtml(String(metadata.description || "No description"))}</p>
          <pre class="preset-preview">${escapeHtml(JSON.stringify(data, null, 2))}</pre>
          <div class="preset-card-actions">
            <button class="action-button action-button-ghost action-button-small" data-preset-apply="${index}" type="button">Apply</button>
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
          <p class="panel-kicker">presets</p>
          <h3>Training presets</h3>
        </div>
        <button class="action-button action-button-ghost action-button-small" data-preset-close="${prefix}" type="button">Close</button>
      </div>
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
  const presetsPanel = document.querySelector<HTMLElement>(`#${prefix}-presets-panel`);

  if (historyPanel) {
    historyPanel.hidden = panel === "history" ? !open : true;
  }

  if (presetsPanel) {
    presetsPanel.hidden = panel === "presets" ? !open : true;
  }
}
