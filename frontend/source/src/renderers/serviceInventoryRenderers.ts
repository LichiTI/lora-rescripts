import { setHtml } from "../shared/domUtils";
import type { ScriptRecord, TaskRecord } from "../shared/types";
import { escapeHtml } from "../shared/textUtils";

export function renderTaskTable(tasks: TaskRecord[]) {
  if (tasks.length === 0) {
    setHtml("task-table-container", "<p>No tasks currently tracked.</p>");
    return;
  }

  const rows = tasks
    .map(
      (task) => `
        <tr>
          <td><code>${escapeHtml(task.id ?? task.task_id ?? "unknown")}</code></td>
          <td>${escapeHtml(task.status ?? "unknown")}</td>
          <td>
            <button class="action-button action-button-small" data-task-terminate="${escapeHtml(task.id ?? task.task_id ?? "")}" type="button">
              Terminate
            </button>
          </td>
        </tr>
      `
    )
    .join("");

  setHtml(
    "task-table-container",
    `
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `
  );
}

export function renderToolsBrowser(scripts: ScriptRecord[]) {
  if (scripts.length === 0) {
    setHtml("tools-browser", "<p>No scripts returned.</p>");
    return;
  }

  const items = scripts
    .map(
      (script) => `
        <article class="tool-card">
          <div class="tool-card-head">
            <h3>${escapeHtml(script.name)}</h3>
            <span class="coverage-pill ${script.category === "networks" ? "" : "coverage-pill-muted"}">${escapeHtml(script.category)}</span>
          </div>
          <p>${
            script.positional_args.length > 0
              ? `Positional args: ${script.positional_args.map((arg) => `<code>${escapeHtml(arg)}</code>`).join(", ")}`
              : "No positional args required."
          }</p>
        </article>
      `
    )
    .join("");

  setHtml("tools-browser", items);
}
