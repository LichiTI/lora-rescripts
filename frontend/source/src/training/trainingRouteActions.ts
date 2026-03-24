import { fetchTasks, runTrainingPreflight, startTraining, terminateTask } from "../services/api";
import type { SchemaBridgeState } from "../schema/schemaEditor";
import type { TrainingRouteConfig } from "./trainingRouteConfig";
import type { PreparedTrainingPayload } from "./trainingRouteState";
import {
  renderTrainSubmitStatus,
  renderTrainValidationStatus,
  renderTrainingPreflightReport,
  setTrainingUtilityNote,
} from "./trainingUi";

type BuildPreparedTrainingPayload = (state: SchemaBridgeState) => PreparedTrainingPayload;

async function performTrainingPreflight(
  config: TrainingRouteConfig,
  payload: Record<string, unknown>
) {
  try {
    const result = await runTrainingPreflight(payload);
    if (result.status !== "success") {
      throw new Error(result.message || "训练预检查失败。");
    }
    renderTrainingPreflightReport(config.prefix, result.data ?? null);
    return result.data ?? null;
  } catch (error) {
    renderTrainingPreflightReport(
      config.prefix,
      null,
      error instanceof Error ? error.message : "训练预检查失败。"
    );
    throw error;
  }
}

export function wireTrainingStopControl(config: TrainingRouteConfig) {
  document.querySelector<HTMLButtonElement>(`#${config.prefix}-stop-train`)?.addEventListener("click", async () => {
    try {
      const result = await fetchTasks();
      const runningTask = (result.data?.tasks ?? []).find((task) => String(task.status).toUpperCase() === "RUNNING");
      if (!runningTask) {
        setTrainingUtilityNote(config.prefix, "当前没有找到正在运行中的训练任务。", "warning");
        return;
      }

      const taskId = String(runningTask.id ?? runningTask.task_id ?? "");
      if (!taskId) {
        setTrainingUtilityNote(config.prefix, "这个运行中的任务没有暴露可用的 id。", "error");
        return;
      }

      if (!window.confirm(`要停止正在运行的任务 ${taskId} 吗？`)) {
        return;
      }

      await terminateTask(taskId);
      renderTrainSubmitStatus(config.prefix, "已请求停止训练", `已经向任务 ${taskId} 发送终止请求。`, "warning");
      setTrainingUtilityNote(config.prefix, `已向任务 ${taskId} 发送终止请求。`, "warning");
    } catch (error) {
      setTrainingUtilityNote(config.prefix, error instanceof Error ? error.message : "停止训练失败。", "error");
    }
  });
}

export function wireTrainingStartControl(
  config: TrainingRouteConfig,
  getCurrentState: () => SchemaBridgeState | null,
  buildPreparedTrainingPayload: BuildPreparedTrainingPayload
) {
  document.querySelector<HTMLButtonElement>(`#${config.prefix}-run-preflight`)?.addEventListener("click", async () => {
    const currentState = getCurrentState();
    if (!currentState) {
      renderTrainSubmitStatus(config.prefix, "编辑器尚未就绪", `${config.modelLabel} 的 schema 编辑器状态还没有初始化完成。`, "error");
      return;
    }

    try {
      const prepared = buildPreparedTrainingPayload(currentState);
      renderTrainValidationStatus(config.prefix, prepared.checks);
      await performTrainingPreflight(config, prepared.payload);
      setTrainingUtilityNote(config.prefix, "训练预检查已完成。", "success");
    } catch (error) {
      setTrainingUtilityNote(config.prefix, error instanceof Error ? error.message : "训练预检查失败。", "error");
    }
  });

  const startButton = document.querySelector<HTMLButtonElement>(`#${config.prefix}-start-train`);
  startButton?.addEventListener("click", async () => {
    const currentState = getCurrentState();
    if (!currentState) {
      renderTrainSubmitStatus(config.prefix, "编辑器尚未就绪", `${config.modelLabel} 的 schema 编辑器状态还没有初始化完成。`, "error");
      return;
    }

    startButton.setAttribute("disabled", "true");
    renderTrainSubmitStatus(config.prefix, "正在提交训练任务...", "正在把当前请求体发送到 /api/run。", "idle");
    try {
      const prepared = buildPreparedTrainingPayload(currentState);

      if (prepared.checks.errors.length > 0) {
        renderTrainSubmitStatus(config.prefix, "请先修正参数冲突", prepared.checks.errors.join(" "), "error");
        renderTrainValidationStatus(config.prefix, prepared.checks);
        return;
      }

      const preflight = await performTrainingPreflight(config, prepared.payload);
      if (preflight && !preflight.can_start) {
        renderTrainSubmitStatus(
          config.prefix,
          "请先解决预检查错误",
          preflight.errors.join(" "),
          "error"
        );
        return;
      }

      const result = await startTraining(prepared.payload);
      if (result.status === "success") {
        const warningParts = [...prepared.checks.warnings, ...(preflight?.warnings ?? []), ...(result.data?.warnings ?? [])];
        const warnings = warningParts.join(" ");
        renderTrainSubmitStatus(
          config.prefix,
          "训练请求已受理",
          `${result.message || "训练已启动。"}${warnings ? ` ${warnings}` : ""}`,
          warnings ? "warning" : "success"
        );
      } else {
        renderTrainSubmitStatus(config.prefix, "训练请求失败", result.message || "后端返回了未知错误。", "error");
      }
    } catch (error) {
      renderTrainSubmitStatus(config.prefix, "训练请求失败", error instanceof Error ? error.message : "发生了未知网络错误。", "error");
    } finally {
      startButton.removeAttribute("disabled");
    }
  });
}
