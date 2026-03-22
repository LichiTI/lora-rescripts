import { RuntimeSchemaNode, type EvaluatedSchemaRecord } from "./schemaRuntimeTypes";

function normalizeSchema(value: unknown): RuntimeSchemaNode {
  if (value instanceof RuntimeSchemaNode) {
    return value;
  }

  if (value === String) {
    return new RuntimeSchemaNode("string");
  }

  if (value === Number) {
    return new RuntimeSchemaNode("number");
  }

  if (value === Boolean) {
    return new RuntimeSchemaNode("boolean");
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const node = new RuntimeSchemaNode("const");
    node.literalValue = value;
    node.defaultValue = value;
    return node;
  }

  if (Array.isArray(value)) {
    const node = new RuntimeSchemaNode("union");
    node.options = value.map((item) => normalizeSchema(item));
    return node;
  }

  if (value && typeof value === "object") {
    const node = new RuntimeSchemaNode("object");
    node.fields = Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, schema]) => [key, normalizeSchema(schema)])
    );
    return node;
  }

  return new RuntimeSchemaNode("string");
}

function createSchemaDsl() {
  return {
    string() {
      return new RuntimeSchemaNode("string");
    },
    number() {
      return new RuntimeSchemaNode("number");
    },
    boolean() {
      return new RuntimeSchemaNode("boolean");
    },
    const(value: unknown) {
      const node = new RuntimeSchemaNode("const");
      node.literalValue = value;
      node.defaultValue = value;
      return node;
    },
    union(items: unknown[]) {
      const node = new RuntimeSchemaNode("union");
      node.options = items.map((item) => normalizeSchema(item));
      return node;
    },
    intersect(items: unknown[]) {
      const node = new RuntimeSchemaNode("intersect");
      node.options = items.map((item) => normalizeSchema(item));
      return node;
    },
    object(fields: Record<string, unknown>) {
      const node = new RuntimeSchemaNode("object");
      node.fields = Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, normalizeSchema(value)]));
      return node;
    },
    array(itemType: unknown) {
      const node = new RuntimeSchemaNode("array");
      node.itemType = normalizeSchema(itemType);
      return node;
    },
  };
}

function updateSchema(
  base: Record<string, RuntimeSchemaNode>,
  patch: Record<string, RuntimeSchemaNode>,
  remove?: string[]
) {
  const merged = { ...base, ...patch };
  for (const key of remove ?? []) {
    delete merged[key];
  }
  return merged;
}

function evaluateSchemaExpression(
  source: string,
  sharedSchemas: Record<string, unknown> | null
): RuntimeSchemaNode | Record<string, unknown> {
  const Schema = createSchemaDsl();
  const factory = new Function(
    "Schema",
    "UpdateSchema",
    "SHARED_SCHEMAS",
    "String",
    "Number",
    "Boolean",
    "source",
    `"use strict"; return eval(source);`
  );

  return factory(Schema, updateSchema, sharedSchemas ?? {}, String, Number, Boolean, source) as
    | RuntimeSchemaNode
    | Record<string, unknown>;
}

export function evaluateSchemaCatalog(records: { name: string; hash: string; schema: string }[]): EvaluatedSchemaRecord[] {
  const sharedRecord = records.find((record) => record.name === "shared");
  const sharedRuntime = sharedRecord ? evaluateSchemaExpression(sharedRecord.schema, null) : {};
  const sharedSchemas = (sharedRuntime || {}) as Record<string, unknown>;

  return records.map((record) => ({
    name: record.name,
    hash: record.hash,
    source: record.schema,
    runtime:
      record.name === "shared"
        ? sharedSchemas
        : evaluateSchemaExpression(record.schema, sharedSchemas),
  }));
}
