import {
  bindSchemaBridgeData,
  bindSettingsData,
  bindTagEditorData,
  bindTasksData,
  bindToolsData,
  bindWorkspaceData,
} from "./binders/pageBinders";
import { renderAboutPage } from "./pages/aboutPage";
import { renderDreamboothTrainPage } from "./pages/dreamboothTrainPage";
import { renderFluxControlNetTrainPage } from "./pages/fluxControlNetTrainPage";
import { renderFluxTrainPage } from "./pages/fluxTrainPage";
import { renderSchemaBridgePage } from "./pages/schemaBridgePage";
import { renderSd3TrainPage } from "./pages/sd3TrainPage";
import { renderSdControlNetTrainPage } from "./pages/sdControlNetTrainPage";
import { renderSdxlControlNetTrainPage } from "./pages/sdxlControlNetTrainPage";
import { renderSdxlLlliteTrainPage } from "./pages/sdxlLlliteTrainPage";
import { renderSdxlTrainPage } from "./pages/sdxlTrainPage";
import { renderSettingsPage } from "./pages/settingsPage";
import { renderTagEditorPage } from "./pages/tagEditorPage";
import { renderTasksPage } from "./pages/tasksPage";
import { renderTensorBoardPage } from "./pages/tensorboardPage";
import { renderToolsPage } from "./pages/toolsPage";
import { renderWorkspacePage } from "./pages/workspacePage";
import { createAppShell } from "./renderers/render";
import { appRoutes, ensureRoute, getCurrentRoute } from "./routing/router";
import { type TrainingRouteConfig, trainingRouteConfigs } from "./training/trainingRouteConfig";
import { bindTrainingRoute } from "./training/trainingRouteBinder";

const pageRenderers: Record<string, () => string> = {
  overview: renderWorkspacePage,
  about: renderAboutPage,
  settings: renderSettingsPage,
  tasks: renderTasksPage,
  tageditor: renderTagEditorPage,
  tensorboard: renderTensorBoardPage,
  tools: renderToolsPage,
  "schema-bridge": renderSchemaBridgePage,
  "sdxl-train": renderSdxlTrainPage,
  "flux-train": renderFluxTrainPage,
  "sd3-train": renderSd3TrainPage,
  "dreambooth-train": renderDreamboothTrainPage,
  "sd-controlnet-train": renderSdControlNetTrainPage,
  "sdxl-controlnet-train": renderSdxlControlNetTrainPage,
  "flux-controlnet-train": renderFluxControlNetTrainPage,
  "sdxl-lllite-train": renderSdxlLlliteTrainPage,
};

function buildNav(activeRouteHash: string) {
  const grouped = {
    overview: appRoutes.filter((route) => route.section === "overview"),
    phase1: appRoutes.filter((route) => route.section === "phase1"),
    reference: appRoutes.filter((route) => route.section === "reference"),
  };

  return `
    <div class="nav-group">
      <p class="nav-heading">Workspace</p>
      ${grouped.overview.map((route) => createNavLink(route.hash, route.label, route.description, activeRouteHash)).join("")}
    </div>
    <div class="nav-group">
      <p class="nav-heading">Phase 1 Pages</p>
      ${grouped.phase1.map((route) => createNavLink(route.hash, route.label, route.description, activeRouteHash)).join("")}
    </div>
    <div class="nav-group">
      <p class="nav-heading">Core Bridge</p>
      ${grouped.reference.map((route) => createNavLink(route.hash, route.label, route.description, activeRouteHash)).join("")}
    </div>
  `;
}

function createNavLink(hash: string, label: string, description: string, activeRouteHash: string) {
  const isActive = hash === activeRouteHash;
  return `
    <a class="nav-link ${isActive ? "is-active" : ""}" href="${hash}">
      <span>${label}</span>
      <small>${description}</small>
    </a>
  `;
}

async function bindRouteData(routeId: string) {
  if (routeId === "overview") {
    await bindWorkspaceData();
  } else if (routeId === "settings") {
    await bindSettingsData();
  } else if (routeId === "tasks") {
    await bindTasksData();
  } else if (routeId === "tageditor") {
    await bindTagEditorData();
  } else if (routeId === "tools") {
    await bindToolsData();
  } else if (routeId === "schema-bridge") {
    await bindSchemaBridgeData(() => undefined);
  } else if (trainingRouteConfigs[routeId]) {
    await bindTrainingRoute(trainingRouteConfigs[routeId] as TrainingRouteConfig);
  }
}

export async function renderApp(root: HTMLElement) {
  ensureRoute();
  const route = getCurrentRoute();
  const pageRenderer = pageRenderers[route.id] ?? renderWorkspacePage;

  root.innerHTML = createAppShell(route.hash, pageRenderer());

  const nav = document.querySelector<HTMLElement>("#side-nav");
  if (nav) {
    nav.innerHTML = buildNav(route.hash);
  }

  await bindRouteData(route.id);
}
