import {
  fetchConfigSummary,
  fetchSavedParams,
} from "../services/api";
import { setHtml, setText } from "../shared/domUtils";
import { escapeHtml } from "../shared/textUtils";

export async function bindSettingsData() {
  const [summaryResult, paramsResult] = await Promise.allSettled([fetchConfigSummary(), fetchSavedParams()]);

  if (summaryResult.status === "fulfilled") {
    const data = summaryResult.value.data;
    setText("settings-summary-title", `${data?.saved_param_count ?? 0} remembered param groups`);
    setHtml(
      "settings-summary-body",
      `
        <p><strong>Config file:</strong> <code>${escapeHtml(data?.config_path ?? "unknown")}</code></p>
        <p><strong>Last path:</strong> <code>${escapeHtml(data?.last_path || "(empty)")}</code></p>
        <p><strong>Saved keys:</strong> ${(data?.saved_param_keys ?? []).map((key) => `<code>${escapeHtml(key)}</code>`).join(", ") || "none"}</p>
      `
    );
  } else {
    setText("settings-summary-title", "Config summary request failed");
    setText("settings-summary-body", summaryResult.reason instanceof Error ? summaryResult.reason.message : "Unknown error");
  }

  if (paramsResult.status === "fulfilled") {
    const data = paramsResult.value.data ?? {};
    const keys = Object.keys(data);
    setText("settings-params-title", `${keys.length} saved param entries`);
    setHtml(
      "settings-params-body",
      keys.length
        ? `<div class="coverage-list">${keys.map((key) => `<span class="coverage-pill coverage-pill-muted">${escapeHtml(key)}</span>`).join("")}</div>`
        : "<p>No saved params returned.</p>"
    );
  } else {
    setText("settings-params-title", "Saved params request failed");
    setText("settings-params-body", paramsResult.reason instanceof Error ? paramsResult.reason.message : "Unknown error");
  }
}
