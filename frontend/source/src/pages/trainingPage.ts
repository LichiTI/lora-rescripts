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
  routeNotice?: {
    kicker: string;
    title: string;
    detail: string;
  };
};

export function renderTrainingPage(config: TrainingPageConfig) {
  return `
    ${createPageHero(config.heroKicker, config.heroTitle, config.heroLede)}
    <section class="training-workbench">
      <section class="panel training-form-pane">
        <div class="training-form-pane-head">
          <div>
            <p class="panel-kicker">当前 schema / schema</p>
            <h3>${config.runnerTitle}</h3>
            <p id="${config.prefix}-summary" class="training-pane-summary">正在加载 ${config.heroTitle} 对应表单...</p>
          </div>
          <div class="training-pane-toolbar">
            <label class="field-label" for="${config.prefix}-schema-select">Schema 选择</label>
            <select id="${config.prefix}-schema-select" class="field-input"></select>
            <button id="${config.prefix}-reset" class="action-button action-button-ghost" type="button">恢复默认值</button>
          </div>
        </div>
        ${
          config.routeNotice
            ? `
              <section class="training-route-notice">
                <p class="panel-kicker">${config.routeNotice.kicker}</p>
                <h3>${config.routeNotice.title}</h3>
                <p>${config.routeNotice.detail}</p>
              </section>
            `
            : ""
        }
        <section class="training-runtime-strip">
          <article class="training-runtime-card">
            <p class="panel-kicker">运行环境 / runtime</p>
            <h3 id="${config.prefix}-runtime-title">正在检测显卡运行环境...</h3>
            <div id="${config.prefix}-runtime-body">正在检查 /api/graphic_cards</div>
          </article>
          <article class="training-runtime-card">
            <p class="panel-kicker">显卡选择 / gpu</p>
            <div id="${config.prefix}-gpu-selector" class="gpu-selector loading">正在加载 GPU 列表...</div>
          </article>
        </section>
        <section class="section-head training-section-head">
          <div>
            <p class="eyebrow">表单区 / sections</p>
            <h2>${config.renderedTitle}</h2>
          </div>
          <p class="section-note">下面的字段来自当前训练 schema 运行结果，而不是手写静态表单。</p>
        </section>
        <section id="${config.prefix}-sections" class="schema-sections loading">正在加载 ${config.heroTitle} 表单分组...</section>
      </section>

      <aside class="training-side-stack">
        <section class="panel preview-panel training-preview-panel">
          <div class="section-head training-side-head">
            <div>
              <p class="eyebrow">请求体预览 / payload</p>
              <h2>请求体预览</h2>
            </div>
            <p class="section-note">这里会实时显示即将发送到 <code>/api/run</code> 的标准化请求体。</p>
          </div>
          <pre id="${config.prefix}-preview">{}</pre>
        </section>

        <section class="panel train-actions-panel">
          <div class="training-launch-head">
            <div>
              <p class="panel-kicker">启动 / launch</p>
              <h3>训练启动与检查</h3>
            </div>
            <p><a class="text-link" href="${runtimeUrl(config.legacyPath)}" target="_blank" rel="noreferrer">${config.legacyLabel}</a></p>
          </div>
          <div class="train-actions-grid">
            <button id="${config.prefix}-run-preflight" class="action-button action-button-ghost" type="button">运行预检查</button>
            <button id="${config.prefix}-start-train" class="action-button action-button-large" type="button">${config.startButtonLabel}</button>
            <button id="${config.prefix}-stop-train" class="action-button action-button-ghost" type="button">终止训练</button>
          </div>
          <p class="section-note">
            预检查会先做后端感知的配置验证；确认后再把当前配置快照提交到 <code>/api/run</code>。
          </p>
          <div class="train-status-grid">
            <div id="${config.prefix}-submit-status" class="submit-status">正在等待 schema 和后端状态...</div>
            <div id="${config.prefix}-validation-status" class="submit-status">正在检查 payload 兼容性...</div>
          </div>
          <div id="${config.prefix}-preflight-report" class="submit-status">尚未运行训练预检查。</div>
        </section>

        <section class="panel training-utility-panel">
          <div class="training-toolbar">
            <button id="${config.prefix}-reset-all" class="action-button action-button-ghost" type="button">全部重置</button>
            <button id="${config.prefix}-save-params" class="action-button action-button-ghost" type="button">保存参数</button>
            <button id="${config.prefix}-read-params" class="action-button action-button-ghost" type="button">读取参数</button>
            <button id="${config.prefix}-clear-autosave" class="action-button action-button-ghost" type="button">清空自动保存</button>
            <button id="${config.prefix}-save-recipe" class="action-button action-button-ghost" type="button">保存配方</button>
            <button id="${config.prefix}-read-recipes" class="action-button action-button-ghost" type="button">读取配方</button>
            <button id="${config.prefix}-import-recipe" class="action-button action-button-ghost" type="button">导入配方</button>
            <button id="${config.prefix}-download-config" class="action-button action-button-ghost" type="button">下载配置</button>
            <button id="${config.prefix}-export-preset" class="action-button action-button-ghost" type="button">导出预设</button>
            <button id="${config.prefix}-import-config" class="action-button action-button-ghost" type="button">导入配置</button>
            <button id="${config.prefix}-load-presets" class="action-button action-button-ghost" type="button">加载预设</button>
          </div>
          <p id="${config.prefix}-utility-note" class="section-note">自动保存和本地配方会保存在当前浏览器，用于这个源码版训练页。</p>
          <div id="${config.prefix}-autosave-status" class="training-autosave-status"></div>
          <input id="${config.prefix}-config-file-input" type="file" accept=".toml" hidden />
          <input id="${config.prefix}-history-file-input" type="file" accept=".json" hidden />
          <input id="${config.prefix}-recipe-file-input" type="file" accept=".json,.toml" hidden />
          <section class="training-side-panel training-inline-workspace">
            <div class="training-side-panel-head">
              <div>
                <p class="panel-kicker">采样提示词 / prompt</p>
                <h3>采样提示词工作区</h3>
              </div>
              <div class="history-toolbar">
                <button id="${config.prefix}-pick-prompt-file" class="action-button action-button-ghost action-button-small" type="button">选择提示词文件</button>
                <button id="${config.prefix}-clear-prompt-file" class="action-button action-button-ghost action-button-small" type="button">清空提示词文件</button>
                <button id="${config.prefix}-refresh-sample-prompt" class="action-button action-button-ghost action-button-small" type="button">刷新预览</button>
                <button id="${config.prefix}-download-sample-prompt" class="action-button action-button-ghost action-button-small" type="button">下载 txt</button>
              </div>
            </div>
            <p class="section-note">
              不启动训练也可以先检查最终采样提示词。这里会解析 <code>prompt_file</code>、表单里的提示词字段，以及导入的旧版
              <code>sample_prompts</code> 内容。
            </p>
            <div id="${config.prefix}-sample-prompt-workspace" class="submit-status">
              <div class="submit-status-box">
                <strong>采样提示词工作区正在等待刷新</strong>
                <p>可以先自由修改相关字段，再点击“刷新预览”查看训练实际会使用的文本。</p>
              </div>
            </div>
          </section>
          <section id="${config.prefix}-history-panel" class="training-side-panel" hidden></section>
          <section id="${config.prefix}-recipes-panel" class="training-side-panel" hidden></section>
          <section id="${config.prefix}-presets-panel" class="training-side-panel" hidden></section>
        </section>
      </aside>
    </section>
  `;
}
