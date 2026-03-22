import { setHtml } from "../shared/domUtils";
import type { TrainingCheckResult } from "./trainingPayload";
import type { UtilityTone } from "./trainingUiTypes";
import { escapeHtml } from "../shared/textUtils";

export function renderTrainSubmitStatus(
  prefix: string,
  title: string,
  detail: string,
  tone: UtilityTone = "idle"
) {
  setHtml(
    `${prefix}-submit-status`,
    `
      <div class="submit-status-box submit-status-${tone}">
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(detail)}</p>
      </div>
    `
  );
}

export function renderTrainValidationStatus(prefix: string, checks: TrainingCheckResult, preparationError?: string) {
  if (preparationError) {
    setHtml(
      `${prefix}-validation-status`,
      `
        <div class="submit-status-box submit-status-error">
          <strong>Payload preparation failed</strong>
          <p>${escapeHtml(preparationError)}</p>
        </div>
      `
    );
    return;
  }

  const rows = [
    checks.errors.length > 0
      ? `
          <div>
            <strong>Errors</strong>
            <ul class="status-list">
              ${checks.errors.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </div>
        `
      : "",
    checks.warnings.length > 0
      ? `
          <div>
            <strong>Warnings</strong>
            <ul class="status-list">
              ${checks.warnings.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </div>
        `
      : "",
  ]
    .filter(Boolean)
    .join("");

  if (!rows) {
    setHtml(
      `${prefix}-validation-status`,
      `
        <div class="submit-status-box submit-status-success">
          <strong>Compatibility checks passed</strong>
          <p>No obvious parameter conflicts were detected in the current payload.</p>
        </div>
      `
    );
    return;
  }

  setHtml(
    `${prefix}-validation-status`,
    `
      <div class="submit-status-box ${checks.errors.length > 0 ? "submit-status-error" : "submit-status-warning"}">
        <strong>${checks.errors.length > 0 ? "Action needed before launch" : "Review before launch"}</strong>
        ${rows}
      </div>
    `
  );
}

export function setTrainingUtilityNote(prefix: string, message: string, tone: UtilityTone = "idle") {
  const element = document.querySelector<HTMLElement>(`#${prefix}-utility-note`);
  if (!element) {
    return;
  }

  element.textContent = message;
  element.classList.remove("utility-note-success", "utility-note-warning", "utility-note-error");
  if (tone === "success") {
    element.classList.add("utility-note-success");
  } else if (tone === "warning") {
    element.classList.add("utility-note-warning");
  } else if (tone === "error") {
    element.classList.add("utility-note-error");
  }
}
