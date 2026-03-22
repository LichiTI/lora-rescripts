import type { SchemaSection } from "./schemaRuntimeTypes";

export function buildDefaultValues(sections: SchemaSection[]) {
  const values: Record<string, unknown> = {};
  for (const section of sections) {
    if (!section.conditional) {
      Object.assign(values, section.constants);
    }
    for (const field of section.fields) {
      if (field.schema.defaultValue !== undefined) {
        values[field.path] = field.schema.defaultValue;
      } else if (field.schema.kind === "boolean") {
        values[field.path] = false;
      } else {
        values[field.path] = "";
      }
    }
  }
  return values;
}

export function isSectionActive(section: SchemaSection, values: Record<string, unknown>) {
  if (!section.conditional) {
    return true;
  }

  return Object.entries(section.constants).every(([name, expected]) => values[name] === expected);
}

export function buildPayloadFromSections(sections: SchemaSection[], values: Record<string, unknown>) {
  const payload = { ...values };

  for (const section of sections) {
    if (isSectionActive(section, values)) {
      Object.assign(payload, section.constants);
      continue;
    }

    for (const field of section.fields) {
      delete payload[field.path];
    }
  }

  return payload;
}
