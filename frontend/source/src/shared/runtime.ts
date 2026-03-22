const explicitRuntimeBase = (import.meta.env.VITE_RUNTIME_BASE_URL || "").replace(/\/$/, "");

export const runtimeBaseUrl = explicitRuntimeBase || (import.meta.env.DEV ? "http://127.0.0.1:28000" : "");

export function runtimeUrl(path: string) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  if (!path.startsWith("/")) {
    path = `/${path}`;
  }

  return `${runtimeBaseUrl}${path}`;
}
