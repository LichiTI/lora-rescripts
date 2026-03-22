import { fetchSchemasAll } from "../services/api";
import { setHtml, setPreText, setText } from "../shared/domUtils";
import { evaluateSchemaCatalog } from "../schema/schemaRuntime";
import {
  buildSchemaBridgeState,
  getSchemaBridgeSelectableRecords,
  mountSchemaEditorState,
  schemaBridgeDomIds,
  type SchemaBridgeState,
} from "../schema/schemaEditor";
import { escapeHtml } from "../shared/textUtils";

export async function bindSchemaBridgeData(
  storeState: (state: SchemaBridgeState | null) => void
) {
  try {
    const result = await fetchSchemasAll();
    const records = result.data?.schemas ?? [];
    const catalog = evaluateSchemaCatalog(records);
    const selectable = getSchemaBridgeSelectableRecords(catalog);
    const preferred = selectable.find((record) => record.name === "sdxl-lora")?.name ?? selectable[0]?.name;

    if (!preferred) {
      setText("schema-summary", "No selectable schemas were returned.");
      setHtml("schema-sections", "<p>No schema runtime available.</p>");
      return;
    }

    mountSchemaEditorState(
      buildSchemaBridgeState(catalog, preferred),
      schemaBridgeDomIds,
      storeState,
      () => undefined
    );
  } catch (error) {
    setText("schema-summary", "Schema bridge request failed");
    setHtml("schema-sections", `<p>${error instanceof Error ? escapeHtml(error.message) : "Unknown error"}</p>`);
    setPreText("schema-preview", "{}");
  }
}
