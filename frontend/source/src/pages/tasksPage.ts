import { runtimeUrl } from "../shared/runtime";

export function renderTasksPage() {
  return `
    <section class="panel prose-panel legacy-doc-panel">
      <h1>任务列表</h1>
      <p>这里用于查看当前后端任务队列与运行状态。</p>
    </section>
    <section class="panel task-panel legacy-service-panel">
      <div class="task-toolbar">
        <button id="refresh-tasks" class="action-button" type="button">刷新任务</button>
        <a class="text-link task-legacy-link" href="${runtimeUrl("/task.html")}" target="_blank" rel="noreferrer">打开当前随包旧版 task 页面</a>
      </div>
      <div id="task-table-container" class="task-table-container loading">正在读取任务列表...</div>
    </section>
  `;
}
