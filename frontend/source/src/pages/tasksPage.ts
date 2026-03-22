import { createPageHero } from "../renderers/render";
import { runtimeUrl } from "../shared/runtime";

export function renderTasksPage() {
  return `
    ${createPageHero(
      "tasks",
      "Task monitor migration page",
      "This route is already talking to the real backend task manager, so it is a strong candidate for early source migration."
    )}
    <section class="panel task-panel">
      <div class="task-toolbar">
        <button id="refresh-tasks" class="action-button" type="button">Refresh tasks</button>
        <a class="text-link task-legacy-link" href="${runtimeUrl("/task.html")}" target="_blank" rel="noreferrer">Open current shipped task page</a>
      </div>
      <div id="task-table-container" class="task-table-container loading">Loading tasks...</div>
    </section>
  `;
}
