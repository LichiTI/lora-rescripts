import { runtimeUrl } from "../shared/runtime";

export function renderTensorBoardPage() {
  return `
    <section class="panel prose-panel legacy-doc-panel">
      <h1>Tensorboard</h1>
      <p>当前运行时通过 <code>/proxy/tensorboard/</code> 代理 TensorBoard。</p>
      <p>源码版这里先保留旧版服务包装页的轻量结构。</p>
    </section>
    <section class="panel legacy-service-panel">
      <p class="panel-kicker">代理 / proxy</p>
      <h3 id="tensorboard-status-title">默认认为后端代理可用</h3>
      <div id="tensorboard-status-body">
        <p>FastAPI 在 <code>mikazuki/app/proxy.py</code> 里挂载了 TensorBoard 反向代理。</p>
      </div>
      <div class="legacy-action-row">
        <a class="action-button action-button-ghost" href="${runtimeUrl("/proxy/tensorboard/")}" target="_blank" rel="noreferrer">打开当前 TensorBoard 页面</a>
      </div>
    </section>
  `;
}
