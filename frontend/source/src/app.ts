import {
  bindSchemaBridgeData,
  bindSettingsData,
  bindTagEditorData,
  bindTasksData,
  bindToolsData,
  bindWorkspaceData,
} from "./binders/pageBinders";
import { renderAboutPage } from "./pages/aboutPage";
import { renderAnimaFinetuneTrainPage } from "./pages/animaFinetuneTrainPage";
import { renderAnimaTrainPage } from "./pages/animaTrainPage";
import { renderDreamboothTrainPage } from "./pages/dreamboothTrainPage";
import { renderFluxControlNetTrainPage } from "./pages/fluxControlNetTrainPage";
import { renderFluxFinetuneTrainPage } from "./pages/fluxFinetuneTrainPage";
import { renderFluxTrainPage } from "./pages/fluxTrainPage";
import { renderHunyuanImageTrainPage } from "./pages/hunyuanImageTrainPage";
import { renderLuminaFinetuneTrainPage } from "./pages/luminaFinetuneTrainPage";
import { renderLuminaTrainPage } from "./pages/luminaTrainPage";
import { renderSchemaBridgePage } from "./pages/schemaBridgePage";
import { renderSd3FinetuneTrainPage } from "./pages/sd3FinetuneTrainPage";
import { renderSd3TrainPage } from "./pages/sd3TrainPage";
import { renderSdControlNetTrainPage } from "./pages/sdControlNetTrainPage";
import { renderSdTextualInversionTrainPage } from "./pages/sdTextualInversionTrainPage";
import { renderSdxlControlNetTrainPage } from "./pages/sdxlControlNetTrainPage";
import { renderSdxlLlliteTrainPage } from "./pages/sdxlLlliteTrainPage";
import { renderSdxlTextualInversionTrainPage } from "./pages/sdxlTextualInversionTrainPage";
import { renderSdxlTrainPage } from "./pages/sdxlTrainPage";
import { renderSettingsPage } from "./pages/settingsPage";
import { renderTagEditorPage } from "./pages/tagEditorPage";
import { renderTasksPage } from "./pages/tasksPage";
import { renderTensorBoardPage } from "./pages/tensorboardPage";
import { renderToolsPage } from "./pages/toolsPage";
import { renderWorkspacePage } from "./pages/workspacePage";
import { renderXtiTrainPage } from "./pages/xtiTrainPage";
import { createAppShell } from "./renderers/render";
import { appRoutes, buildLegacyHref, ensureRoute, getCurrentRoute } from "./routing/router";
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
  "sd3-finetune-train": renderSd3FinetuneTrainPage,
  "dreambooth-train": renderDreamboothTrainPage,
  "flux-finetune-train": renderFluxFinetuneTrainPage,
  "sd-controlnet-train": renderSdControlNetTrainPage,
  "sdxl-controlnet-train": renderSdxlControlNetTrainPage,
  "flux-controlnet-train": renderFluxControlNetTrainPage,
  "sdxl-lllite-train": renderSdxlLlliteTrainPage,
  "sd-ti-train": renderSdTextualInversionTrainPage,
  "xti-train": renderXtiTrainPage,
  "sdxl-ti-train": renderSdxlTextualInversionTrainPage,
  "anima-train": renderAnimaTrainPage,
  "anima-finetune-train": renderAnimaFinetuneTrainPage,
  "lumina-train": renderLuminaTrainPage,
  "lumina-finetune-train": renderLuminaFinetuneTrainPage,
  "hunyuan-image-train": renderHunyuanImageTrainPage,
};

const pageTitles: Record<string, string> = {
  overview: "LoRA 训练 | SD-reScripts",
  about: "关于 | SD-reScripts",
  settings: "训练 UI 设置 | SD-reScripts",
  tasks: "任务列表 | SD-reScripts",
  tageditor: "标签编辑器 | SD-reScripts",
  tensorboard: "TensorBoard | SD-reScripts",
  tools: "Tagger 标注工具 | SD-reScripts",
  "schema-bridge": "Schema 桥接 | SD-reScripts",
  "sdxl-train": "SDXL 训练 | SD-reScripts",
  "flux-train": "Flux 训练 | SD-reScripts",
  "sd3-train": "SD3 训练 | SD-reScripts",
  "sd3-finetune-train": "SD3 Finetune 训练 | SD-reScripts",
  "dreambooth-train": "Dreambooth 训练 | SD-reScripts",
  "flux-finetune-train": "Flux Finetune 训练 | SD-reScripts",
  "sd-controlnet-train": "SD ControlNet 训练 | SD-reScripts",
  "sdxl-controlnet-train": "SDXL ControlNet 训练 | SD-reScripts",
  "flux-controlnet-train": "Flux ControlNet 训练 | SD-reScripts",
  "sdxl-lllite-train": "SDXL LLLite 训练 | SD-reScripts",
  "sd-ti-train": "Textual Inversion 训练 | SD-reScripts",
  "xti-train": "XTI 训练 | SD-reScripts",
  "sdxl-ti-train": "SDXL Textual Inversion 训练 | SD-reScripts",
  "anima-train": "Anima 训练 | SD-reScripts",
  "anima-finetune-train": "Anima Finetune 训练 | SD-reScripts",
  "lumina-train": "Lumina 训练 | SD-reScripts",
  "lumina-finetune-train": "Lumina Finetune 训练 | SD-reScripts",
  "hunyuan-image-train": "Hunyuan Image 训练 | SD-reScripts",
};

function createSidebarHeadingLink(href: string, label: string, active = false) {
  return `
    <a class="sidebar-item sidebar-heading ${active ? "active" : ""}" href="${href}">
      ${label}
    </a>
  `;
}

function createSidebarLeaf(href: string, label: string, active = false) {
  return `
    <a class="sidebar-item sidebar-leaf ${active ? "active" : ""}" href="${href}">
      ${label}
    </a>
  `;
}

function buildNav(activeRouteHash: string, activeRouteId: string) {
  const inLoraSection = new Set([
    "overview",
    "sdxl-train",
    "flux-train",
    "sd3-train",
    "tools",
    "sd-ti-train",
    "xti-train",
    "sdxl-ti-train",
    "sd-controlnet-train",
    "sdxl-controlnet-train",
    "flux-controlnet-train",
    "sdxl-lllite-train",
    "anima-train",
    "anima-finetune-train",
    "lumina-train",
    "lumina-finetune-train",
    "hunyuan-image-train",
  ]);
  const inOtherSection = new Set(["settings", "about", "tasks"]);

  return `
    <div class="sidebar-container">
      <ul class="sidebar-items">
        <li>
          ${createSidebarHeadingLink(buildLegacyHref("/index.html"), "SD-Trainer", activeRouteId === "overview")}
        </li>
        <li>
          ${createSidebarHeadingLink(buildLegacyHref("/lora/index.html"), "LoRA 训练", inLoraSection.has(activeRouteId))}
          <ul class="sidebar-item-children">
            <li>${createSidebarLeaf(buildLegacyHref("/lora/index.html"), "总览", activeRouteId === "overview")}</li>
            <li>${createSidebarLeaf(buildLegacyHref("/lora/sdxl.html"), "SDXL", activeRouteId === "sdxl-train")}</li>
            <li>${createSidebarLeaf(buildLegacyHref("/lora/flux.html"), "Flux", activeRouteId === "flux-train")}</li>
            <li>${createSidebarLeaf(buildLegacyHref("/lora/sd3.html"), "SD3 / SD3.5", activeRouteId === "sd3-train")}</li>
            <li>${createSidebarLeaf(buildLegacyHref("/lora/tools.html"), "工具", activeRouteId === "tools")}</li>
            <li>${createSidebarLeaf(buildLegacyHref("/lora/ti.html"), "TI", activeRouteId === "sd-ti-train")}</li>
            <li>${createSidebarLeaf(buildLegacyHref("/lora/xti.html"), "XTI", activeRouteId === "xti-train")}</li>
            <li>${createSidebarLeaf(buildLegacyHref("/lora/sdxl-ti.html"), "SDXL TI", activeRouteId === "sdxl-ti-train")}</li>
          </ul>
        </li>
        <li>
          ${createSidebarHeadingLink(buildLegacyHref("/dreambooth/index.html"), "Dreambooth 训练", activeRouteId === "dreambooth-train")}
        </li>
        <li>
          ${createSidebarHeadingLink(buildLegacyHref("/tensorboard.html"), "TensorBoard", activeRouteId === "tensorboard")}
        </li>
        <li>
          ${createSidebarHeadingLink(buildLegacyHref("/tagger.html"), "Tagger 标签器", activeRouteId === "tools")}
        </li>
        <li>
          ${createSidebarHeadingLink(buildLegacyHref("/tageditor.html"), "标签编辑器", activeRouteId === "tageditor")}
        </li>
        <li>
          ${createSidebarHeadingLink(buildLegacyHref("/other/settings.html"), "其他", inOtherSection.has(activeRouteId))}
          <ul class="sidebar-item-children">
            <li>${createSidebarLeaf(buildLegacyHref("/other/settings.html"), "UI 设置", activeRouteId === "settings")}</li>
            <li>${createSidebarLeaf(buildLegacyHref("/task.html"), "任务列表", activeRouteId === "tasks")}</li>
            <li>${createSidebarLeaf(buildLegacyHref("/other/about.html"), "关于", activeRouteId === "about")}</li>
          </ul>
        </li>
      </ul>
    </div>
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

  document.title = pageTitles[route.id] ?? `SD-reScripts | ${route.label}`;
  root.innerHTML = createAppShell(route.hash, pageRenderer());

  const nav = document.querySelector<HTMLElement>("#side-nav");
  if (nav) {
    nav.innerHTML = buildNav(route.hash, route.id);
  }

  await bindRouteData(route.id);
}
