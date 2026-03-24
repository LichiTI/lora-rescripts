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
      setText("schema-summary", "后端没有返回可用的 schema。");
      setHtml("schema-sections", "<p>当前没有可用的 schema 运行结果。</p>");
      return;
    }

    mountSchemaEditorState(
      buildSchemaBridgeState(catalog, preferred),
      schemaBridgeDomIds,
      storeState,
      () => undefined
    );
  } catch (error) {
    setText("schema-summary", "schema 桥接请求失败");
    setHtml("schema-sections", `<p>${error instanceof Error ? escapeHtml(error.message) : "未知错误"}</p>`);
    setPreText("schema-preview", "{}");
  }
}
