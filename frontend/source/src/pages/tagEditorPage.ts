import { createPageHero } from "../renderers/render";
import { runtimeUrl } from "../shared/runtime";

export function renderTagEditorPage() {
  return `
    ${createPageHero(
      "tag editor",
      "Tag editor wrapper migration page",
      "The current shipped page is mostly a wrapper around startup state and proxy behavior. That makes it a good low-risk source-side rewrite."
    )}
    <section class="two-column">
      <article class="panel info-card">
        <p class="panel-kicker">status</p>
        <h3 id="tag-editor-status-title">Loading tag editor status...</h3>
        <div id="tag-editor-status-body">Checking /api/tageditor_status</div>
      </article>
      <article class="panel info-card">
        <p class="panel-kicker">next step</p>
        <h3>Future migration target</h3>
        <div>
          <p>This source page should eventually replace the current startup/progress wrapper and keep the bilingual guidance in readable source form.</p>
          <p>Once we wire routing into FastAPI, it can hand off to the real tag editor service or show clean failure states.</p>
          <p><a class="text-link" href="${runtimeUrl("/tageditor.html")}" target="_blank" rel="noreferrer">Open current shipped tag editor wrapper</a></p>
        </div>
      </article>
    </section>
  `;
}
