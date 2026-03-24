import { RuntimeSchemaNode, type SchemaSection } from "./schemaRuntimeTypes";

function fieldEntries(fields: Record<string, RuntimeSchemaNode>, parentPath = "") {
  return Object.entries(fields)
    .map(([name, schema]) => ({
      name,
      path: parentPath ? `${parentPath}.${name}` : name,
      schema,
    }))
    .filter((field) => field.schema.kind !== "const" || !field.schema.requiredFlag);
}

function branchConditions(fields: Record<string, RuntimeSchemaNode>) {
  return Object.entries(fields)
    .filter(([, schema]) => schema.kind === "const" && schema.requiredFlag)
    .map(([name, schema]) => `${name} = ${String(schema.literalValue)}`);
}

function branchConstants(fields: Record<string, RuntimeSchemaNode>) {
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([, schema]) => schema.kind === "const" && schema.requiredFlag)
      .map(([name, schema]) => [name, schema.literalValue])
  );
}

function extractSectionsFromNode(node: RuntimeSchemaNode, seed: string, sections: SchemaSection[]) {
  if (node.kind === "intersect") {
    node.options.forEach((child, index) => extractSectionsFromNode(child, `${seed}-i${index}`, sections));
    return;
  }

  if (node.kind === "object") {
    const fields = fieldEntries(node.fields);
    if (fields.length > 0) {
      sections.push({
        id: seed,
        title: node.descriptionText || "未命名分组",
        fields,
        conditions: branchConditions(node.fields),
        constants: branchConstants(node.fields),
      });
    }
    return;
  }

  if (node.kind === "union") {
    node.options.forEach((child, index) => {
      if (child.kind === "object") {
        const fields = fieldEntries(child.fields);
        if (fields.length > 0) {
          sections.push({
            id: `${seed}-u${index}`,
            title: child.descriptionText || node.descriptionText || `条件分支 ${index + 1}`,
            fields,
            conditional: true,
            conditions: branchConditions(child.fields),
            constants: branchConstants(child.fields),
          });
        }
      } else {
        extractSectionsFromNode(child, `${seed}-u${index}`, sections);
      }
    });
  }
}

export function extractSchemaSections(schema: RuntimeSchemaNode) {
  const sections: SchemaSection[] = [];
  extractSectionsFromNode(schema, "section", sections);
  return sections;
}
