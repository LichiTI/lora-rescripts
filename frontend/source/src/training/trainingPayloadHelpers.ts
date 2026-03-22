export function cloneValues(values: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(values ?? {})) as Record<string, unknown>;
}

export function normalizeLineList(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => String(entry ?? "").trim())
      .filter(Boolean);
  }

  return String(value ?? "")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function hasOwn(payload: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(payload, key);
}

export function isSdxlModel(payload: Record<string, unknown>) {
  return String(payload.model_train_type ?? "").startsWith("sdxl");
}

export function isSd3Finetune(payload: Record<string, unknown>) {
  return String(payload.model_train_type ?? "") === "sd3-finetune";
}

export function toStringValue(value: unknown) {
  return value === undefined || value === null ? "" : String(value);
}

export function normalizePath(value: unknown) {
  return toStringValue(value).replaceAll("\\", "/");
}

export function toNumber(value: unknown, fallback = 0) {
  const parsed = Number.parseFloat(toStringValue(value));
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function valueIsTruthy(value: unknown) {
  return Boolean(value);
}

export function splitArgPair(source: string) {
  const separatorIndex = source.indexOf("=");
  if (separatorIndex === -1) {
    return {
      key: source.trim(),
      value: "",
      hasValue: false,
    };
  }

  return {
    key: source.slice(0, separatorIndex).trim(),
    value: source.slice(separatorIndex + 1).trim(),
    hasValue: true,
  };
}

export function parseBooleanish(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = toStringValue(value).toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}
