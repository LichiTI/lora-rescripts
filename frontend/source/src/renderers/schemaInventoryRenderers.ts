import { setHtml } from "../shared/domUtils";
import { routeInventory } from "../routing/routeInventory";
import type { SchemaRecord } from "../shared/types";
import { escapeHtml } from "../shared/textUtils";

export function renderSchemaBrowser(schemas: SchemaRecord[]) {
  if (schemas.length === 0) {
    setHtml("schema-browser", "<p>No schemas returned.</p>");
    return;
  }

  const items = schemas
    .map((schema) => {
      const preview = schema.schema.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() || "No preview available.";
      return `
        <article class="schema-card">
          <div class="schema-head">
            <h3>${escapeHtml(schema.name)}</h3>
            <span class="schema-hash">${escapeHtml(schema.hash.slice(0, 8))}</span>
          </div>
          <p>${escapeHtml(preview)}</p>
        </article>
      `;
    })
    .join("");

  setHtml("schema-browser", items);
}

export function renderSchemaCoverage(schemas: SchemaRecord[]) {
  const hintedNames = new Set(routeInventory.flatMap((route) => route.schemaHints ?? []));
  const presentNames = new Set(schemas.map((schema) => schema.name));
  const mapped = [...hintedNames].filter((name) => presentNames.has(name)).sort();
  const unmapped = schemas.map((schema) => schema.name).filter((name) => !hintedNames.has(name)).sort();

  setHtml(
    "schema-mapped",
    mapped.length ? mapped.map((name) => `<span class="coverage-pill">${escapeHtml(name)}</span>`).join("") : "<p>No mapped schema hints yet.</p>"
  );
  setHtml(
    "schema-unmapped",
    unmapped.length ? unmapped.map((name) => `<span class="coverage-pill coverage-pill-muted">${escapeHtml(name)}</span>`).join("") : "<p>All schemas are represented in the current route hints.</p>"
  );
}
