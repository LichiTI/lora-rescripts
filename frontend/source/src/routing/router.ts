export type AppRoute = {
  id: string;
  label: string;
  section: "overview" | "phase1" | "reference";
  hash: string;
  description: string;
};

const defaultRouteHash = "#/workspace";

export const appRoutes: AppRoute[] = [
  {
    id: "overview",
    label: "Workspace",
    section: "overview",
    hash: defaultRouteHash,
    description: "Source migration dashboard and live backend diagnostics.",
  },
  {
    id: "about",
    label: "About",
    section: "phase1",
    hash: "#/about",
    description: "Rebuild branding and release notes in source form.",
  },
  {
    id: "settings",
    label: "Settings",
    section: "phase1",
    hash: "#/settings",
    description: "Read config summary and saved parameter state from the backend.",
  },
  {
    id: "tasks",
    label: "Tasks",
    section: "phase1",
    hash: "#/tasks",
    description: "Inspect and manage task execution state.",
  },
  {
    id: "tageditor",
    label: "Tag Editor",
    section: "phase1",
    hash: "#/tageditor",
    description: "Track startup status and future proxy behavior.",
  },
  {
    id: "tensorboard",
    label: "TensorBoard",
    section: "phase1",
    hash: "#/tensorboard",
    description: "Prepare a cleaner source-side wrapper for TensorBoard access.",
  },
  {
    id: "tools",
    label: "Tools",
    section: "phase1",
    hash: "#/tools",
    description: "Migrate script-launch and utility entry points from the legacy tools page.",
  },
  {
    id: "schema-bridge",
    label: "Schema Bridge",
    section: "reference",
    hash: "#/schema-bridge",
    description: "Evaluate current schema DSL into a source-side explorer and prototype form renderer.",
  },
  {
    id: "sdxl-train",
    label: "SDXL Train",
    section: "reference",
    hash: "#/sdxl-train",
    description: "First source-side training page powered by the schema bridge and current `/api/run` backend.",
  },
  {
    id: "flux-train",
    label: "Flux Train",
    section: "reference",
    hash: "#/flux-train",
    description: "Source-side Flux LoRA training route built on the shared schema bridge and launch pipeline.",
  },
  {
    id: "sd3-train",
    label: "SD3 Train",
    section: "reference",
    hash: "#/sd3-train",
    description: "Source-side SD3 LoRA training route using the same normalized payload workflow.",
  },
  {
    id: "dreambooth-train",
    label: "Dreambooth",
    section: "reference",
    hash: "#/dreambooth-train",
    description: "Source-side Dreambooth and SDXL full-finetune route on the shared schema bridge.",
  },
  {
    id: "sd-controlnet-train",
    label: "SD ControlNet",
    section: "reference",
    hash: "#/sd-controlnet-train",
    description: "Source-side SD ControlNet training route using the shared launch flow.",
  },
  {
    id: "sdxl-controlnet-train",
    label: "SDXL ControlNet",
    section: "reference",
    hash: "#/sdxl-controlnet-train",
    description: "Source-side SDXL ControlNet training route using the shared launch flow.",
  },
  {
    id: "flux-controlnet-train",
    label: "Flux ControlNet",
    section: "reference",
    hash: "#/flux-controlnet-train",
    description: "Source-side Flux ControlNet training route using the shared launch flow.",
  },
  {
    id: "sdxl-lllite-train",
    label: "SDXL LLLite",
    section: "reference",
    hash: "#/sdxl-lllite-train",
    description: "Source-side SDXL ControlNet-LLLite training route on the shared training bridge.",
  },
];

const validRouteHashes = new Set(appRoutes.map((route) => route.hash));

const legacyPathAliasMap: Record<string, string> = {
  "/index.html": defaultRouteHash,
  "/index.md": defaultRouteHash,
  "/404.html": defaultRouteHash,
  "/404.md": defaultRouteHash,
  "/task.html": "#/tasks",
  "/task.md": "#/tasks",
  "/tageditor.html": "#/tageditor",
  "/tageditor.md": "#/tageditor",
  "/tagger.html": "#/tageditor",
  "/tagger.md": "#/tageditor",
  "/tensorboard.html": "#/tensorboard",
  "/tensorboard.md": "#/tensorboard",
  "/other/about.html": "#/about",
  "/other/about.md": "#/about",
  "/other/settings.html": "#/settings",
  "/other/settings.md": "#/settings",
  "/dreambooth/index.html": "#/dreambooth-train",
  "/dreambooth/index.md": "#/dreambooth-train",
  "/lora/index.html": "#/sdxl-train",
  "/lora/index.md": "#/sdxl-train",
};

const legacyPathAliases = Object.keys(legacyPathAliasMap).sort((left, right) => right.length - left.length);

type LegacyRouteMatch = {
  hash: string;
  canonicalRootPath: string;
};

function canonicalizeRootPath(pathname: string) {
  const trimmed = pathname.replace(/\/+$/, "");
  return trimmed.length > 0 ? `${trimmed}/` : "/";
}

function inferLegacyLoraHash(pageName: string) {
  switch (pageName) {
    case "flux":
    case "flux-finetune":
      return "#/flux-train";
    case "sd3":
    case "sd3-finetune":
      return "#/sd3-train";
    case "controlnet":
      return "#/sd-controlnet-train";
    case "sdxl-controlnet":
      return "#/sdxl-controlnet-train";
    case "flux-controlnet":
      return "#/flux-controlnet-train";
    case "sdxl-lllite":
      return "#/sdxl-lllite-train";
    case "tools":
      return "#/tools";
    case "basic":
    case "master":
    case "params":
    case "sdxl":
    case "sdxl-ti":
    case "ti":
    case "xti":
    case "anima":
    case "anima-finetune":
    case "hunyuan":
    case "lumina":
    case "lumina-finetune":
      return "#/sdxl-train";
    default:
      return null;
  }
}

function resolveLegacyLoraRoute(pathname: string): LegacyRouteMatch | null {
  const match = pathname.match(/^(.*)\/lora\/([^/]+)\.(?:html|md)$/i);
  if (!match) {
    return null;
  }

  const [, basePath, rawPageName] = match;
  const hash = inferLegacyLoraHash(rawPageName.toLowerCase());
  if (!hash) {
    return null;
  }

  return {
    hash,
    canonicalRootPath: canonicalizeRootPath(basePath),
  };
}

function resolveLegacyRoute(pathname: string): LegacyRouteMatch | null {
  const normalizedPath = pathname.toLowerCase();
  for (const suffix of legacyPathAliases) {
    if (!normalizedPath.endsWith(suffix)) {
      continue;
    }

    return {
      hash: legacyPathAliasMap[suffix],
      canonicalRootPath: canonicalizeRootPath(pathname.slice(0, pathname.length - suffix.length)),
    };
  }

  return resolveLegacyLoraRoute(pathname);
}

function replaceRoute(rootPath: string, hash: string) {
  const nextRelativeUrl = `${rootPath}${window.location.search}${hash}`;
  const currentRelativeUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (nextRelativeUrl !== currentRelativeUrl) {
    window.history.replaceState(null, "", nextRelativeUrl);
  }
}

export function getCurrentRoute(): AppRoute {
  const hash = validRouteHashes.has(window.location.hash) ? window.location.hash : defaultRouteHash;
  return appRoutes.find((route) => route.hash === hash) ?? appRoutes[0];
}

export function ensureRoute() {
  if (validRouteHashes.has(window.location.hash)) {
    return;
  }

  const legacyRoute = resolveLegacyRoute(window.location.pathname);
  if (legacyRoute) {
    replaceRoute(legacyRoute.canonicalRootPath, legacyRoute.hash);
    return;
  }

  replaceRoute(canonicalizeRootPath(window.location.pathname || "/"), defaultRouteHash);
}
