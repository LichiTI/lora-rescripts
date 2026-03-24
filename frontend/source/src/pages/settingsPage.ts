import { runtimeUrl } from "../shared/runtime";

export function renderSettingsPage() {
  return `
    <section class="example-container settings-example-container">
      <section class="schema-container settings-left-pane">
        <article class="panel info-card">
          <p class="panel-kicker">配置摘要 / config summary</p>
          <h3 id="settings-summary-title">正在读取配置摘要...</h3>
          <div id="settings-summary-body">正在检查 /api/config/summary</div>
        </article>
        <article class="panel info-card">
          <p class="panel-kicker">已保存参数 / saved params</p>
          <h3 id="settings-params-title">正在读取已保存参数...</h3>
          <div id="settings-params-body">正在检查 /api/config/saved_params</div>
        </article>
        <article class="panel info-card">
          <p class="panel-kicker">运行时依赖 / runtime packages</p>
          <h3 id="settings-runtime-title">正在读取运行时依赖状态...</h3>
          <div id="settings-runtime-body">正在检查 /api/graphic_cards</div>
        </article>
      </section>
      <div class="right-container">
        <section class="panel prose-panel legacy-doc-panel">
          <h1>训练 UI 设置</h1>
          <p>不熟悉这些参数的话，尽量不要乱动。</p>
          <p>这一页会尽量保留旧版 settings 页的定位，同时补上源码版新增的优化器、调度器显示控制和运行时摘要。</p>
          <p>外部调度器会自动桥接到 <code>lr_scheduler_type</code>；外部优化器仍然需要当前 Python 环境里存在对应依赖。</p>
        </section>
        <section class="panel legacy-output-panel">
          <header>输出</header>
          <div class="settings-option-sections legacy-output-main">
            <article class="panel info-card">
              <p class="panel-kicker">优化器列表 / optimizer catalog</p>
              <h3 id="settings-optimizer-title">正在整理优化器显示列表...</h3>
              <div id="settings-optimizer-body">正在整理优化器清单</div>
            </article>
            <article class="panel info-card">
              <p class="panel-kicker">调度器列表 / scheduler catalog</p>
              <h3 id="settings-scheduler-title">正在整理调度器显示列表...</h3>
              <div id="settings-scheduler-body">正在整理调度器清单</div>
            </article>
          </div>
        </section>
        <div class="legacy-action-row">
          <a class="action-button action-button-ghost" href="${runtimeUrl("/other/settings.html")}" target="_blank" rel="noreferrer">打开当前随包旧版设置页</a>
        </div>
      </div>
    </section>
  `;
}
