import { setHtml } from "../shared/domUtils";
import type { GraphicCardRecord } from "../shared/types";
import { escapeHtml } from "../shared/textUtils";

export function renderGpuSelector(containerId: string, cards: GraphicCardRecord[]) {
  if (cards.length === 0) {
    setHtml(containerId, "<p>No GPUs reported. Training will use the backend default environment.</p>");
    return;
  }

  const items = cards
    .map((card, index) => {
      const label = card.index ?? card.id ?? index;
      const value = String(label);
      return `
        <label class="gpu-chip">
          <input type="checkbox" data-gpu-id="${escapeHtml(value)}" />
          <span>GPU ${escapeHtml(value)}: ${escapeHtml(card.name)}</span>
        </label>
      `;
    })
    .join("");

  setHtml(containerId, `<div class="gpu-chip-grid">${items}</div>`);
}

export function readSelectedGpuIds(containerId: string) {
  return [...document.querySelectorAll<HTMLInputElement>(`#${containerId} input[data-gpu-id]:checked`)]
    .map((input) => input.dataset.gpuId)
    .filter((value): value is string => Boolean(value));
}

export function applySelectedGpuIds(prefix: string, gpuIds: string[] = []) {
  const selected = new Set(gpuIds.map((entry) => String(entry)));
  document.querySelectorAll<HTMLInputElement>(`#${prefix}-gpu-selector input[data-gpu-id]`).forEach((input) => {
    const gpuId = input.dataset.gpuId ?? "";
    input.checked = selected.has(gpuId);
  });
}
