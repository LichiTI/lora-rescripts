import {
  fetchScripts,
  fetchTagEditorStatus,
} from "../services/api";
import { setHtml, setText } from "../shared/domUtils";
import { renderToolsBrowser } from "../renderers/pageInventoryRenderers";
import { runtimeUrl } from "../shared/runtime";
import { escapeHtml } from "../shared/textUtils";

export async function bindTagEditorData() {
  try {
    const status = await fetchTagEditorStatus();
    setText("tag-editor-status-title", `Current status: ${status.status}`);
    setHtml(
      "tag-editor-status-body",
      `
        <p>${escapeHtml(status.detail || "No extra detail returned.")}</p>
        <p><a class="text-link" href="${runtimeUrl("/tageditor.html")}" target="_blank" rel="noreferrer">Open current shipped wrapper page</a></p>
      `
    );
  } catch (error) {
    setText("tag-editor-status-title", "Tag editor status request failed");
    setText("tag-editor-status-body", error instanceof Error ? error.message : "Unknown error");
  }
}

export async function bindToolsData() {
  try {
    const result = await fetchScripts();
    const scripts = result.data?.scripts ?? [];
    setText("tools-summary-title", `${scripts.length} launcher scripts available`);
    setHtml(
      "tools-summary-body",
      `
        <p>Categories: ${[...new Set(scripts.map((script) => script.category))].map((name) => `<code>${escapeHtml(name)}</code>`).join(", ")}</p>
        <p>The next step here is adding curated forms for the most important tool flows instead of raw script lists.</p>
      `
    );
    renderToolsBrowser(scripts);
  } catch (error) {
    setText("tools-summary-title", "Script inventory request failed");
    setText("tools-summary-body", error instanceof Error ? error.message : "Unknown error");
    setHtml("tools-browser", "<p>Tool inventory failed to load.</p>");
  }
}
