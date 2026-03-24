import { apiInventory } from "../services/apiInventory";
import { routeInventory } from "../routing/routeInventory";

export function renderWorkspacePage() {
  const sectionLabels = {
    core: "核心",
    training: "训练",
    tools: "工具",
    system: "系统",
  } as const;

  const statusLabels = {
    "legacy-dist": "旧版保留",
    "migrate-first": "源码优先",
  } as const;

  const priorityLabels = {
    high: "高",
    medium: "中",
    low: "低",
  } as const;

  const routeCards = routeInventory
    .map(
      (route) => `
        <article class="panel route-card" data-status="${route.status}">
          <div class="panel-kicker">${sectionLabels[route.section]}</div>
          <h3>${route.title}</h3>
          <p class="route-path">${route.route}</p>
          <p>${route.notes}</p>
          ${
            route.schemaHints && route.schemaHints.length > 0
              ? `<p class="schema-linkline">Schema 提示：${route.schemaHints.map((name) => `<code>${name}</code>`).join(", ")}</p>`
              : ""
          }
          <div class="pill-row">
            <span class="pill ${route.status === "migrate-first" ? "pill-hot" : "pill-cool"}">${statusLabels[route.status]}</span>
          </div>
        </article>
      `
    )
    .join("");

  const apiRows = apiInventory
    .map(
      (api) => `
        <tr>
          <td><span class="method method-${api.method.toLowerCase()}">${api.method}</span></td>
          <td><code>${api.path}</code></td>
          <td>${api.purpose}</td>
          <td>${priorityLabels[api.migrationPriority]}</td>
        </tr>
      `
    )
    .join("");

  return `
    <article class="legacy-doc-content">
      <h1 id="lora-训练">LoRA 训练</h1>
      <p>本 LoRA 训练界面分为两种模式。</p>
      <ul>
        <li>从左侧进入当前最常用的训练入口和工具页</li>
        <li>在保持旧版使用习惯的同时，逐步接入新的源码版训练页</li>
      </ul>
      <div class="tip-box">
        <strong>提示</strong>
        <p>如果你只是正常使用训练功能，可以直接从左侧进入对应训练页和工具页；如果你在帮忙测试源码替换进度，下方状态卡会更有用。</p>
      </div>
    </article>

    <section class="section-head">
      <div>
        <p class="eyebrow">入口</p>
        <h2>常用页面</h2>
      </div>
      <p class="section-note">
        先把最常用的训练与工具入口整理成更接近旧版首页的视图。
      </p>
    </section>
    <section class="route-grid quick-entry-grid">
      <article class="panel route-card">
        <div class="panel-kicker">训练</div>
        <h3>SDXL / LoRA</h3>
        <p>当前最核心的训练入口，后续会继续和旧版表单行为对齐。</p>
        <p class="route-path">/lora/sdxl.html</p>
      </article>
      <article class="panel route-card">
        <div class="panel-kicker">训练</div>
        <h3>Flux / SD3</h3>
        <p>新模型训练入口已经接入共享训练桥，可以继续按旧版导航习惯使用。</p>
        <p class="route-path">/lora/flux.html / /lora/sd3.html</p>
      </article>
      <article class="panel route-card">
        <div class="panel-kicker">工具</div>
        <h3>工具 / Tagger</h3>
        <p>数据集分析、批量打标、批量清理和快照恢复都集中在这里。</p>
        <p class="route-path">/tagger.html / /lora/tools.html</p>
      </article>
      <article class="panel route-card">
        <div class="panel-kicker">系统</div>
        <h3>任务 / 服务页</h3>
        <p>用于查看任务队列、TensorBoard 和标签编辑器当前状态。</p>
        <p class="route-path">/task.html / /tensorboard.html / /tageditor.html</p>
      </article>
    </section>

    <section class="section-head">
      <div>
        <p class="eyebrow">运行状态</p>
        <h2>后端诊断</h2>
      </div>
      <p class="section-note">
        这些卡片会直接读取当前 FastAPI 后端，用来确认源码版首页没有脱离真实运行链路。
      </p>
    </section>
    <section class="diagnostic-grid">
      <article class="panel diagnostic-card">
        <div class="panel-kicker">schema</div>
        <h3 id="diag-schemas-title">正在读取 schema 哈希...</h3>
        <p id="diag-schemas-detail">正在检查 /api/schemas/hashes</p>
      </article>
      <article class="panel diagnostic-card">
        <div class="panel-kicker">预设</div>
        <h3 id="diag-presets-title">正在读取预设...</h3>
        <p id="diag-presets-detail">正在检查 /api/presets</p>
      </article>
      <article class="panel diagnostic-card">
        <div class="panel-kicker">任务</div>
        <h3 id="diag-tasks-title">正在读取任务管理器...</h3>
        <p id="diag-tasks-detail">正在检查 /api/tasks</p>
      </article>
      <article class="panel diagnostic-card">
        <div class="panel-kicker">显卡</div>
        <h3 id="diag-gpu-title">正在读取显卡信息...</h3>
        <p id="diag-gpu-detail">正在检查 /api/graphic_cards</p>
      </article>
      <article class="panel diagnostic-card">
        <div class="panel-kicker">标签编辑器</div>
        <h3 id="diag-tageditor-title">正在读取标签编辑器状态...</h3>
        <p id="diag-tageditor-detail">正在检查 /api/tageditor_status</p>
      </article>
    </section>

    <section class="panel callout">
      <h2>当前源码页定位</h2>
      <p>这里不再只是迁移看板，而是开始承担真实首页职责。</p>
      <p>训练表单、系统服务页和工具页会继续保留源码侧桥接能力，同时逐步把视觉结构对齐到旧版前端。</p>
    </section>

    <section class="section-head">
      <div>
        <p class="eyebrow">训练覆盖</p>
        <h2>训练入口覆盖</h2>
      </div>
      <p class="section-note">
        这里用来追踪目前哪些训练器已经在源码版里具备页面、schema 和预设接线能力。
      </p>
    </section>
    <section class="panel coverage-panel">
      <div id="training-catalog" class="coverage-list loading">正在整理训练入口清单...</div>
    </section>

    <section class="section-head">
      <div>
        <p class="eyebrow">页面清单</p>
        <h2>当前页面覆盖</h2>
      </div>
      <p class="section-note">
        这些记录仍然很有用，因为它们能告诉我们当前源码版和旧版前端分别覆盖到了哪里。
      </p>
    </section>
    <section class="route-grid">
      ${routeCards}
    </section>

    <section class="section-head">
      <div>
        <p class="eyebrow">后端接口</p>
        <h2>需要保留的后端接口</h2>
      </div>
      <p class="section-note">
        源码版前端仍然应该尽量保持 schema 驱动，而不是重新回到到处硬编码训练表单的状态。
      </p>
    </section>
    <section class="panel api-panel">
      <table>
        <thead>
          <tr>
            <th>方法</th>
            <th>路径</th>
            <th>用途</th>
            <th>优先级</th>
          </tr>
        </thead>
        <tbody>
          ${apiRows}
        </tbody>
      </table>
    </section>

    <section class="section-head">
      <div>
        <p class="eyebrow">Schema</p>
        <h2>当前表单来源清单</h2>
      </div>
      <p class="section-note">
        这些是旧版前端和当前源码桥接都要依赖的 schema 来源。
      </p>
    </section>
    <section class="panel schema-panel">
      <div id="schema-browser" class="schema-browser loading">正在读取 schema 清单...</div>
    </section>
    <section class="panel coverage-panel">
      <div class="coverage-columns">
        <div>
          <p class="panel-kicker">已映射 schema</p>
          <div id="schema-mapped" class="coverage-list loading">等待 schema 清单...</div>
        </div>
        <div>
          <p class="panel-kicker">未映射 schema</p>
          <div id="schema-unmapped" class="coverage-list loading">等待 schema 清单...</div>
        </div>
      </div>
    </section>
  `;
}
