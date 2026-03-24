import type { GraphicCardEntry, GraphicCardRecord, TagEditorStatus, TaskRecord } from "./types";

function isGraphicCardRecord(card: GraphicCardEntry): card is GraphicCardRecord {
  return typeof card === "object" && card !== null;
}

export function formatGpuList(cards: GraphicCardEntry[]) {
  if (cards.length === 0) {
    return "当前没有返回显卡记录。";
  }

  return cards
    .map((card, index) => {
      if (!isGraphicCardRecord(card)) {
        return card;
      }
      const label = card.index ?? card.id ?? index;
      return `GPU ${label}: ${card.name}`;
    })
    .join(" | ");
}

export function formatTaskSummary(tasks: TaskRecord[]) {
  if (tasks.length === 0) {
    return "当前没有正在跟踪的任务。";
  }

  const active = tasks.filter((task) => task.status && !["FINISHED", "TERMINATED", "FAILED"].includes(String(task.status))).length;
  return `共 ${tasks.length} 个任务，其中 ${active} 个仍在运行中`;
}

export function formatTagEditor(status: TagEditorStatus) {
  const detail = status.detail?.trim();
  return detail ? `${status.status} - ${detail}` : status.status;
}
