import { createPageHero } from "../renderers/render";

export function renderSchemaBridgePage() {
  return `
    ${createPageHero(
      "schema 桥接",
      "Schema 浏览与原型表单桥",
      "这一页会直接在浏览器里解析当前 schema DSL，并把它整理成分组、字段和可编辑默认值，用来验证源码版前端与训练表单核心的桥接行为。"
    )}
    <section class="two-column">
      <article class="panel info-card">
        <p class="panel-kicker">当前 schema / schema</p>
        <h3>当前选中的 schema</h3>
        <div class="schema-bridge-toolbar">
          <label class="field-label" for="schema-select">Schema 选择</label>
          <select id="schema-select" class="field-input"></select>
          <button id="schema-reset" class="action-button" type="button">恢复默认值</button>
        </div>
        <p id="schema-summary">正在加载 schema 运行结果...</p>
      </article>
      <article class="panel info-card">
        <p class="panel-kicker">用途 / focus</p>
        <h3>这一页当前的作用</h3>
        <div>
          <p>默认会优先选中 <code>sdxl-lora</code>，因为它是目前最需要完成源码化接线的核心训练入口之一。</p>
          <p>这里会先聚焦最常见的字段类型，例如字符串、数字、布尔值、枚举和简单数组，方便持续验证桥接层是否稳定。</p>
        </div>
      </article>
    </section>
    <section class="section-head">
      <div>
        <p class="eyebrow">表单区 / sections</p>
        <h2>Schema 结构</h2>
      </div>
      <p class="section-note">这些分组来自当前 schema DSL 的运行结果，而不是额外手写的页面元数据。</p>
    </section>
    <section id="schema-sections" class="schema-sections loading">正在加载 schema 分组...</section>
    <section class="section-head">
      <div>
        <p class="eyebrow">配置预览 / preview</p>
        <h2>当前本地值快照</h2>
      </div>
      <p class="section-note">这部分目前只在本地生成，用来确认源码版前端已经可以从当前 schema DSL 还原出可用的配置模型。</p>
    </section>
    <section class="panel preview-panel">
      <pre id="schema-preview">{}</pre>
    </section>
  `;
}
