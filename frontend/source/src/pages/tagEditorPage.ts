import { runtimeUrl } from "../shared/runtime";

export function renderTagEditorPage() {
  return `
    <section class="panel prose-panel legacy-doc-panel">
      <h1>标签编辑器</h1>
      <p>这里主要显示标签编辑器服务状态，并在可用时引导你进入实际包装页。</p>
    </section>
    <section class="panel legacy-service-panel">
      <p class="panel-kicker">状态 / status</p>
      <h3 id="tag-editor-status-title">正在读取标签编辑器状态...</h3>
      <div id="tag-editor-status-body">正在检查 /api/tageditor_status</div>
      <div class="legacy-action-row">
        <a class="action-button action-button-ghost" href="${runtimeUrl("/tageditor.html")}" target="_blank" rel="noreferrer">打开当前随包标签编辑器页面</a>
      </div>
    </section>
  `;
}
