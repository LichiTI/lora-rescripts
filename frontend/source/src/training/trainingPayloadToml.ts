export {};

function splitTomlArray(inner: string) {
  const items: string[] = [];
  let current = "";
  let quote: "'" | '"' | null = null;
  let bracketDepth = 0;

  for (let index = 0; index < inner.length; index += 1) {
    const char = inner[index];
    const previous = index > 0 ? inner[index - 1] : "";

    if (quote) {
      current += char;
      if (char === quote && previous !== "\\") {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      current += char;
      continue;
    }

    if (char === "[") {
      bracketDepth += 1;
      current += char;
      continue;
    }

    if (char === "]") {
      bracketDepth -= 1;
      current += char;
      continue;
    }

    if (char === "," && bracketDepth === 0) {
      items.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim().length > 0) {
    items.push(current.trim());
  }

  return items;
}

function stripTomlComment(line: string) {
  let quote: "'" | '"' | null = null;
  let escaped = false;
  let result = "";

  for (const char of line) {
    if (quote) {
      result += char;
      if (quote === '"' && char === "\\" && !escaped) {
        escaped = true;
        continue;
      }
      if (char === quote && !escaped) {
        quote = null;
      }
      escaped = false;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      result += char;
      continue;
    }

    if (char === "#") {
      break;
    }

    result += char;
  }

  return result.trim();
}

function parseTomlString(rawValue: string) {
  if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
    return rawValue
      .slice(1, -1)
      .replaceAll('\\"', '"')
      .replaceAll("\\n", "\n")
      .replaceAll("\\t", "\t")
      .replaceAll("\\\\", "\\");
  }

  if (rawValue.startsWith("'") && rawValue.endsWith("'")) {
    return rawValue.slice(1, -1);
  }

  return rawValue;
}

function parseTomlValue(rawValue: string): unknown {
  const value = rawValue.trim();

  if (value.length === 0) {
    return "";
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return parseTomlString(value);
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  if (value.startsWith("[") && value.endsWith("]")) {
    return splitTomlArray(value.slice(1, -1)).map((item) => parseTomlValue(item));
  }

  if (/^[+-]?\d[\d_]*(\.\d[\d_]*)?([eE][+-]?\d+)?$/.test(value)) {
    return Number(value.replaceAll("_", ""));
  }

  return value;
}

function splitTomlKeyPath(keySource: string) {
  return keySource
    .split(".")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => parseTomlString(part));
}

function assignNestedValue(target: Record<string, unknown>, path: string[], value: unknown) {
  let cursor: Record<string, unknown> = target;

  for (let index = 0; index < path.length - 1; index += 1) {
    const segment = path[index];
    const current = cursor[segment];
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  }

  cursor[path[path.length - 1]] = value;
}

export function parseLooseTomlObject(source: string) {
  const result: Record<string, unknown> = {};
  let currentTablePath: string[] = [];

  for (const rawLine of source.split(/\r?\n/)) {
    const line = stripTomlComment(rawLine);
    if (!line) {
      continue;
    }

    if (line.startsWith("[[") && line.endsWith("]]")) {
      throw new Error("Array-of-table syntax is not supported in custom params yet.");
    }

    if (line.startsWith("[") && line.endsWith("]")) {
      currentTablePath = splitTomlKeyPath(line.slice(1, -1));
      continue;
    }

    const equalIndex = line.indexOf("=");
    if (equalIndex === -1) {
      throw new Error(`Invalid TOML line: ${rawLine}`);
    }

    const keyPath = splitTomlKeyPath(line.slice(0, equalIndex));
    if (keyPath.length === 0) {
      throw new Error(`Invalid TOML key: ${rawLine}`);
    }

    assignNestedValue(result, [...currentTablePath, ...keyPath], parseTomlValue(line.slice(equalIndex + 1)));
  }

  return result;
}

function stringifyTomlString(value: string) {
  return JSON.stringify(value);
}

function stringifyTomlValue(value: unknown): string {
  if (typeof value === "string") {
    return stringifyTomlString(value);
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : stringifyTomlString(String(value));
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stringifyTomlValue(entry)).join(", ")}]`;
  }

  return stringifyTomlString(JSON.stringify(value));
}

function collectTomlSections(
  source: Record<string, unknown>,
  path: string[] = [],
  buckets: { path: string[]; values: [string, unknown][] }[] = []
) {
  const scalars: [string, unknown][] = [];

  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      collectTomlSections(value as Record<string, unknown>, [...path, key], buckets);
      continue;
    }

    scalars.push([key, value]);
  }

  buckets.push({ path, values: scalars });
  return buckets;
}

export function stringifyLooseTomlObject(source: Record<string, unknown>) {
  const sections = collectTomlSections(source)
    .filter((section) => section.values.length > 0)
    .sort((left, right) => left.path.join(".").localeCompare(right.path.join(".")));

  const chunks: string[] = [];

  for (const section of sections) {
    if (section.path.length > 0) {
      if (chunks.length > 0) {
        chunks.push("");
      }
      chunks.push(`[${section.path.join(".")}]`);
    }

    for (const [key, value] of section.values.sort(([left], [right]) => left.localeCompare(right))) {
      chunks.push(`${key} = ${stringifyTomlValue(value)}`);
    }
  }

  return chunks.join("\n");
}
