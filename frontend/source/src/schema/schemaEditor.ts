import { setHtml, setPreText, setText } from "../shared/domUtils";
import {
  buildDefaultValues,
  extractSchemaSections,
  RuntimeSchemaNode,
  type EvaluatedSchemaRecord,
} from "./schemaRuntime";
import { attachSchemaEditorFieldListeners } from "./schemaEditorFieldListeners";
import {
  getRenderedPayload,
  getSchemaBridgeSelectableRecords,
  getVisibleSections,
  renderSchemaPreview,
  renderSchemaSections,
} from "./schemaEditorFieldRendering";
import type { SchemaBridgeState, SchemaEditorDomIds } from "./schemaEditorTypes";
import { escapeHtml } from "../shared/textUtils";

export type { SchemaBridgeState, SchemaEditorDomIds } from "./schemaEditorTypes";
export { getRenderedPayload, getSchemaBridgeSelectableRecords } from "./schemaEditorFieldRendering";

export function buildSchemaBridgeState(catalog: EvaluatedSchemaRecord[], selectedName: string): SchemaBridgeState | null {
  const record = getSchemaBridgeSelectableRecords(catalog).find((item) => item.name === selectedName);
  if (!record || !(record.runtime instanceof RuntimeSchemaNode)) {
    return null;
  }

  const sections = extractSchemaSections(record.runtime);
  return {
    catalog,
    selectedName,
    sections,
    values: buildDefaultValues(sections),
  };
}

export function mountSchemaEditorState(
  nextState: SchemaBridgeState | null,
  domIds: SchemaEditorDomIds,
  storeState: (state: SchemaBridgeState | null) => void,
  onStateChange: (state: SchemaBridgeState) => void
) {
  storeState(nextState);
  if (!nextState) {
    setText(domIds.summaryId, "Failed to build schema bridge state.");
    setHtml(domIds.sectionsId, "<p>Schema bridge failed to initialize.</p>");
    setPreText(domIds.previewId, "{}");
    return;
  }

  const selectable = getSchemaBridgeSelectableRecords(nextState.catalog);
  const selectHtml = selectable
    .map(
      (record) =>
        `<option value="${escapeHtml(record.name)}" ${record.name === nextState.selectedName ? "selected" : ""}>${escapeHtml(record.name)}</option>`
    )
    .join("");

  const visibleSections = getVisibleSections(nextState);
  setHtml(domIds.selectId, selectHtml);
  setText(
    domIds.summaryId,
    `${nextState.selectedName} · ${visibleSections.length}/${nextState.sections.length} visible sections · ${visibleSections.reduce((sum, section) => sum + section.fields.length, 0)} visible fields`
  );
  renderSchemaSections(nextState, domIds.sectionsId);
  renderSchemaPreview(nextState, domIds.previewId);

  const select = document.querySelector<HTMLSelectElement>(`#${domIds.selectId}`);
  if (select) {
    select.onchange = () => {
      const next = buildSchemaBridgeState(nextState.catalog, select.value);
      mountSchemaEditorState(next, domIds, storeState, onStateChange);
    };
  }

  const resetButton = document.querySelector<HTMLButtonElement>(`#${domIds.resetId}`);
  if (resetButton) {
    resetButton.onclick = () => {
      mountSchemaEditorState(buildSchemaBridgeState(nextState.catalog, nextState.selectedName), domIds, storeState, onStateChange);
    };
  }

  attachSchemaEditorFieldListeners(
    nextState,
    domIds,
    onStateChange,
    (state) => mountSchemaEditorState(state, domIds, storeState, onStateChange)
  );
  onStateChange(nextState);
}

export const schemaBridgeDomIds: SchemaEditorDomIds = {
  selectId: "schema-select",
  summaryId: "schema-summary",
  sectionsId: "schema-sections",
  previewId: "schema-preview",
  resetId: "schema-reset",
};

export function getTrainingDomIds(prefix: string): SchemaEditorDomIds {
  return {
    selectId: `${prefix}-schema-select`,
    summaryId: `${prefix}-summary`,
    sectionsId: `${prefix}-sections`,
    previewId: `${prefix}-preview`,
    resetId: `${prefix}-reset`,
  };
}
