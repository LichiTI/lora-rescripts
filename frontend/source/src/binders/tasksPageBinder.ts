import { fetchTasks, terminateTask } from "../services/api";
import { setHtml } from "../shared/domUtils";
import { renderTaskTable } from "../renderers/pageInventoryRenderers";
import { escapeHtml } from "../shared/textUtils";

async function loadTasksPage() {
  try {
    const result = await fetchTasks();
    renderTaskTable(result.data?.tasks ?? []);

    document.querySelectorAll<HTMLElement>("[data-task-terminate]").forEach((button) => {
      button.addEventListener("click", async () => {
        const taskId = button.dataset.taskTerminate;
        if (!taskId) {
          return;
        }
        button.setAttribute("disabled", "true");
        try {
          await terminateTask(taskId);
        } finally {
          await loadTasksPage();
        }
      });
    });
  } catch (error) {
    setHtml("task-table-container", `<p>${error instanceof Error ? escapeHtml(error.message) : "Task request failed."}</p>`);
  }
}

export async function bindTasksData() {
  const refreshButton = document.querySelector<HTMLButtonElement>("#refresh-tasks");
  refreshButton?.addEventListener("click", () => {
    void loadTasksPage();
  });
  await loadTasksPage();
}
