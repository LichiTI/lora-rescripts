import type { EvaluatedSchemaRecord, SchemaSection } from "./schemaRuntime";

export type SchemaBridgeState = {
  catalog: EvaluatedSchemaRecord[];
  selectedName: string;
  sections: SchemaSection[];
  values: Record<string, unknown>;
};

export type SchemaEditorDomIds = {
  selectId: string;
  summaryId: string;
  sectionsId: string;
  previewId: string;
  resetId: string;
};
