import { setHtml } from "../shared/domUtils";
import { escapeHtml } from "../shared/textUtils";

export type TrainingCatalogRecord = {
  routeId: string;
  title: string;
  routeHash: string;
  schemaName: string;
  modelLabel: string;
  family: string;
  presetCount: number;
  localHistoryCount: number;
  localRecipeCount: number;
  autosaveReady: boolean;
  schemaAvailable: boolean;
  capabilities: string[];
};

export function renderTrainingCatalog(records: TrainingCatalogRecord[]) {
  if (!records.length) {
    setHtml("training-catalog", "<p>当前没有注册任何训练入口。</p>");
    return;
  }

  const totalRoutes = records.length;
  const schemaBacked = records.filter((record) => record.schemaAvailable).length;
  const presetCovered = records.filter((record) => record.presetCount > 0).length;
  const historyCovered = records.filter((record) => record.localHistoryCount > 0).length;
  const recipeCovered = records.filter((record) => record.localRecipeCount > 0).length;
  const autosaveCovered = records.filter((record) => record.autosaveReady).length;
  const familyCounts = new Map<string, number>();
  const capabilityCounts = new Map<string, number>();
  for (const record of records) {
    familyCounts.set(record.family, (familyCounts.get(record.family) ?? 0) + 1);
    for (const capability of record.capabilities) {
      capabilityCounts.set(capability, (capabilityCounts.get(capability) ?? 0) + 1);
    }
  }

  const summary = `
    <section class="dataset-analysis-grid training-catalog-summary">
      <article class="dataset-analysis-stat">
        <span class="metric-label">训练入口</span>
        <strong class="dataset-analysis-stat-value">${totalRoutes}</strong>
      </article>
      <article class="dataset-analysis-stat">
        <span class="metric-label">已接 schema</span>
        <strong class="dataset-analysis-stat-value">${schemaBacked}</strong>
      </article>
      <article class="dataset-analysis-stat">
        <span class="metric-label">带预设</span>
        <strong class="dataset-analysis-stat-value">${presetCovered}</strong>
      </article>
      <article class="dataset-analysis-stat">
        <span class="metric-label">带配方</span>
        <strong class="dataset-analysis-stat-value">${recipeCovered}</strong>
      </article>
      <article class="dataset-analysis-stat">
        <span class="metric-label">带历史</span>
        <strong class="dataset-analysis-stat-value">${historyCovered}</strong>
      </article>
      <article class="dataset-analysis-stat">
        <span class="metric-label">自动保存</span>
        <strong class="dataset-analysis-stat-value">${autosaveCovered}</strong>
      </article>
      <article class="dataset-analysis-stat">
        <span class="metric-label">训练家族</span>
        <strong class="dataset-analysis-stat-value">${familyCounts.size}</strong>
      </article>
    </section>
    <div class="coverage-list training-catalog-capabilities">
      ${[...capabilityCounts.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .map(([capability, count]) => `<span class="coverage-pill">${escapeHtml(capability)} <strong>${count}</strong></span>`)
        .join("")}
    </div>
  `;

  const cards = records
    .map(
      (record) => `
        <article class="training-catalog-card" data-family="${escapeHtml(record.family)}">
          <div class="training-catalog-head">
            <div>
              <p class="panel-kicker">${escapeHtml(record.family)}</p>
              <h3>${escapeHtml(record.title)}</h3>
            </div>
            <a class="text-link" href="${escapeHtml(record.routeHash)}">打开</a>
          </div>
          <p class="training-catalog-route"><code>${escapeHtml(record.routeHash)}</code></p>
          <p class="training-catalog-meta">
            Schema：<code>${escapeHtml(record.schemaName)}</code>
            · 模型：<strong>${escapeHtml(record.modelLabel)}</strong>
          </p>
          <div class="coverage-list">
            <span class="coverage-pill ${record.schemaAvailable ? "" : "coverage-pill-muted"}">${record.schemaAvailable ? "schema 已接入" : "schema 缺失"}</span>
            <span class="coverage-pill ${record.presetCount > 0 ? "" : "coverage-pill-muted"}">${record.presetCount} 个预设</span>
            <span class="coverage-pill ${record.localHistoryCount > 0 ? "" : "coverage-pill-muted"}">${record.localHistoryCount} 条历史</span>
            <span class="coverage-pill ${record.localRecipeCount > 0 ? "" : "coverage-pill-muted"}">${record.localRecipeCount} 个配方</span>
            <span class="coverage-pill ${record.autosaveReady ? "" : "coverage-pill-muted"}">${record.autosaveReady ? "自动保存就绪" : "无自动保存"}</span>
          </div>
          <div class="coverage-list training-catalog-capability-row">
            ${record.capabilities.map((capability) => `<span class="coverage-pill coverage-pill-muted">${escapeHtml(capability)}</span>`).join("")}
          </div>
        </article>
      `
    )
    .join("");

  setHtml(
    "training-catalog",
    `
      ${summary}
      <div class="training-catalog-grid">${cards}</div>
    `
  );
}
