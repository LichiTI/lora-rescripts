import { createPageHero } from "../renderers/render";
import { runtimeUrl } from "../shared/runtime";

export type TrainingPageConfig = {
  prefix: string;
  heroKicker: string;
  heroTitle: string;
  heroLede: string;
  runnerTitle: string;
  startButtonLabel: string;
  legacyPath: string;
  legacyLabel: string;
  renderedTitle: string;
};

export function renderTrainingPage(config: TrainingPageConfig) {
  return `
    ${createPageHero(config.heroKicker, config.heroTitle, config.heroLede)}
    <section class="two-column">
      <article class="panel info-card">
        <p class="panel-kicker">schema target</p>
        <h3>${config.runnerTitle}</h3>
        <div class="schema-bridge-toolbar">
          <label class="field-label" for="${config.prefix}-schema-select">Schema</label>
          <select id="${config.prefix}-schema-select" class="field-input"></select>
          <button id="${config.prefix}-reset" class="action-button" type="button">Reset defaults</button>
        </div>
        <p id="${config.prefix}-summary">Loading ${config.heroTitle} schema...</p>
      </article>
      <article class="panel info-card">
        <p class="panel-kicker">runtime</p>
        <h3 id="${config.prefix}-runtime-title">Loading GPU runtime...</h3>
        <div id="${config.prefix}-runtime-body">Checking /api/graphic_cards</div>
      </article>
    </section>

    <section class="panel train-actions-panel">
      <div class="train-actions-grid">
        <div>
          <p class="panel-kicker">gpu selection</p>
          <div id="${config.prefix}-gpu-selector" class="gpu-selector loading">Loading GPU list...</div>
        </div>
        <div>
          <p class="panel-kicker">launch</p>
          <div class="launch-column">
            <button id="${config.prefix}-start-train" class="action-button action-button-large" type="button">${config.startButtonLabel}</button>
            <p class="section-note">
              This submits the current local config snapshot to <code>/api/run</code>.
            </p>
            <p><a class="text-link" href="${runtimeUrl(config.legacyPath)}" target="_blank" rel="noreferrer">${config.legacyLabel}</a></p>
          </div>
        </div>
      </div>
      <div class="train-status-grid">
        <div id="${config.prefix}-submit-status" class="submit-status">Waiting for schema and backend data.</div>
        <div id="${config.prefix}-validation-status" class="submit-status">Checking payload compatibility...</div>
      </div>
    </section>

    <section class="panel training-utility-panel">
      <div class="training-toolbar">
        <button id="${config.prefix}-reset-all" class="action-button action-button-ghost" type="button">Reset all</button>
        <button id="${config.prefix}-save-params" class="action-button action-button-ghost" type="button">Save params</button>
        <button id="${config.prefix}-read-params" class="action-button action-button-ghost" type="button">Read params</button>
        <button id="${config.prefix}-download-config" class="action-button action-button-ghost" type="button">Download config</button>
        <button id="${config.prefix}-import-config" class="action-button action-button-ghost" type="button">Import config</button>
        <button id="${config.prefix}-load-presets" class="action-button action-button-ghost" type="button">Load presets</button>
        <button id="${config.prefix}-stop-train" class="action-button action-button-ghost" type="button">Stop train</button>
      </div>
      <p id="${config.prefix}-utility-note" class="section-note">Autosave is enabled for this source route.</p>
      <input id="${config.prefix}-config-file-input" type="file" accept=".toml" hidden />
      <input id="${config.prefix}-history-file-input" type="file" accept=".json" hidden />
      <section id="${config.prefix}-history-panel" class="training-side-panel" hidden></section>
      <section id="${config.prefix}-presets-panel" class="training-side-panel" hidden></section>
    </section>

    <section class="section-head">
      <div>
        <p class="eyebrow">Rendered sections</p>
        <h2>${config.renderedTitle}</h2>
      </div>
      <p class="section-note">The fields below come from evaluating the current training schema DSL, not from hand-written JSON.</p>
    </section>
    <section id="${config.prefix}-sections" class="schema-sections loading">Loading ${config.heroTitle} sections...</section>

    <section class="section-head">
      <div>
        <p class="eyebrow">Payload preview</p>
        <h2>Request body preview</h2>
      </div>
      <p class="section-note">This mirrors the normalized object that will be sent to <code>/api/run</code>.</p>
    </section>
    <section class="panel preview-panel">
      <pre id="${config.prefix}-preview">{}</pre>
    </section>
  `;
}
