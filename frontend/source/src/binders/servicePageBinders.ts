import {
  createCaptionBackup,
  listCaptionBackups,
  restoreCaptionBackup,
  applyCaptionCleanup,
  analyzeDataset,
  analyzeMaskedLossDataset,
  fetchInterrogators,
  fetchScripts,
  fetchTagEditorStatus,
  pickFile,
  previewCaptionCleanup,
  runInterrogate,
} from "../services/api";
import { setHtml, setText } from "../shared/domUtils";
import {
  renderCaptionBackupInventory,
  renderCaptionBackupRestoreReport,
  renderCaptionCleanupReport,
  renderDatasetAnalysisReport,
  renderMaskedLossAuditReport,
  renderToolsBrowser,
} from "../renderers/serviceInventoryRenderers";
import { runtimeUrl } from "../shared/runtime";
import { escapeHtml } from "../shared/textUtils";

type DatasetAnalyzerControls = {
  pathInput: HTMLInputElement;
  captionExtensionInput: HTMLInputElement;
  topTagsInput: HTMLInputElement;
  sampleLimitInput: HTMLInputElement;
  browseButton: HTMLButtonElement;
  runButton: HTMLButtonElement;
};

type BatchTaggerControls = {
  pathInput: HTMLInputElement;
  modelSelect: HTMLSelectElement;
  thresholdInput: HTMLInputElement;
  characterThresholdInput: HTMLInputElement;
  conflictSelect: HTMLSelectElement;
  additionalTagsInput: HTMLInputElement;
  backupNameInput: HTMLInputElement;
  excludeTagsInput: HTMLInputElement;
  recursiveInput: HTMLInputElement;
  replaceUnderscoreInput: HTMLInputElement;
  escapeTagInput: HTMLInputElement;
  addRatingTagInput: HTMLInputElement;
  addModelTagInput: HTMLInputElement;
  autoBackupInput: HTMLInputElement;
  browseButton: HTMLButtonElement;
  runButton: HTMLButtonElement;
};

type MaskedLossAuditControls = {
  pathInput: HTMLInputElement;
  sampleLimitInput: HTMLInputElement;
  recursiveInput: HTMLInputElement;
  browseButton: HTMLButtonElement;
  runButton: HTMLButtonElement;
};

type CaptionCleanupControls = {
  pathInput: HTMLInputElement;
  extensionInput: HTMLInputElement;
  removeTagsInput: HTMLInputElement;
  prependTagsInput: HTMLInputElement;
  appendTagsInput: HTMLInputElement;
  searchTextInput: HTMLInputElement;
  replaceTextInput: HTMLInputElement;
  backupNameInput: HTMLInputElement;
  sampleLimitInput: HTMLInputElement;
  recursiveInput: HTMLInputElement;
  collapseWhitespaceInput: HTMLInputElement;
  replaceUnderscoreInput: HTMLInputElement;
  dedupeTagsInput: HTMLInputElement;
  sortTagsInput: HTMLInputElement;
  useRegexInput: HTMLInputElement;
  autoBackupInput: HTMLInputElement;
  browseButton: HTMLButtonElement;
  previewButton: HTMLButtonElement;
  applyButton: HTMLButtonElement;
};

type CaptionBackupControls = {
  pathInput: HTMLInputElement;
  extensionInput: HTMLInputElement;
  nameInput: HTMLInputElement;
  selectInput: HTMLSelectElement;
  recursiveInput: HTMLInputElement;
  preRestoreInput: HTMLInputElement;
  browseButton: HTMLButtonElement;
  createButton: HTMLButtonElement;
  refreshButton: HTMLButtonElement;
  restoreButton: HTMLButtonElement;
};

export async function bindTagEditorData() {
  try {
    const status = await fetchTagEditorStatus();
    setText("tag-editor-status-title", `当前状态：${status.status}`);
    setHtml(
      "tag-editor-status-body",
      `
        <p>${escapeHtml(status.detail || "没有返回额外状态说明。")}</p>
        <p><a class="text-link" href="${runtimeUrl("/tageditor.html")}" target="_blank" rel="noreferrer">打开当前随包标签编辑器页面</a></p>
      `
    );
  } catch (error) {
    setText("tag-editor-status-title", "标签编辑器状态读取失败");
    setText("tag-editor-status-body", error instanceof Error ? error.message : "未知错误");
  }
}

export async function bindToolsData() {
  bindDatasetAnalyzer();
  bindMaskedLossAudit();
  await bindBatchTagger();
  bindCaptionCleanup();
  bindCaptionBackup();

  try {
    const result = await fetchScripts();
    const scripts = result.data?.scripts ?? [];
    setText("tools-summary-title", `已发现 ${scripts.length} 个可用脚本入口`);
    setHtml(
      "tools-summary-body",
      `
        <p>分类：${[...new Set(scripts.map((script) => script.category))].map((name) => `<code>${escapeHtml(name)}</code>`).join(", ")}</p>
        <p>这里已经接入数据集分析、蒙版损失检查、批量自动打标、标签清理和标签快照恢复，后面还会继续补高频流程。</p>
      `
    );
    renderToolsBrowser(scripts);
  } catch (error) {
    setText("tools-summary-title", "工具脚本列表读取失败");
    setText("tools-summary-body", error instanceof Error ? error.message : "未知错误");
    setHtml("tools-browser", "<p>工具脚本列表读取失败。</p>");
  }
}

function bindMaskedLossAudit() {
  const controls = getMaskedLossAuditControls();
  if (!controls) {
    return;
  }

  controls.browseButton.addEventListener("click", async () => {
    setText("masked-loss-audit-status", "正在打开目录选择器...");
    try {
      controls.pathInput.value = await pickFile("folder");
      setText("masked-loss-audit-status", "目录已选择，可以开始检查 alpha 蒙版。");
    } catch (error) {
      setText("masked-loss-audit-status", error instanceof Error ? error.message : "目录选择失败。");
    }
  });

  controls.runButton.addEventListener("click", () => {
    void runMaskedLossAudit(controls);
  });

  controls.pathInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    void runMaskedLossAudit(controls);
  });
}

function bindDatasetAnalyzer() {
  const controls = getDatasetAnalyzerControls();
  if (!controls) {
    return;
  }

  controls.browseButton.addEventListener("click", async () => {
    setText("dataset-analysis-status", "正在打开目录选择器...");
    try {
      controls.pathInput.value = await pickFile("folder");
      setText("dataset-analysis-status", "目录已选择，可以开始分析。");
    } catch (error) {
      setText("dataset-analysis-status", error instanceof Error ? error.message : "目录选择失败。");
    }
  });

  controls.runButton.addEventListener("click", () => {
    void runDatasetAnalysis(controls);
  });

  controls.pathInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    void runDatasetAnalysis(controls);
  });
}

async function bindBatchTagger() {
  const controls = getBatchTaggerControls();
  if (!controls) {
    return;
  }

  controls.browseButton.addEventListener("click", async () => {
    setText("batch-tagger-status", "正在打开目录选择器...");
    try {
      controls.pathInput.value = await pickFile("folder");
      setText("batch-tagger-status", "目录已选择，可以开始批量打标。");
    } catch (error) {
      setText("batch-tagger-status", error instanceof Error ? error.message : "目录选择失败。");
    }
  });

  controls.runButton.addEventListener("click", () => {
    void runBatchTagger(controls);
  });

  controls.pathInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    void runBatchTagger(controls);
  });

  try {
    const result = await fetchInterrogators();
    const interrogators = result.data?.interrogators ?? [];
    if (!interrogators.length) {
      throw new Error("没有返回任何可用打标模型。");
    }

    controls.modelSelect.innerHTML = interrogators
      .map((interrogator) => {
        const selected = interrogator.is_default || interrogator.name === result.data?.default ? " selected" : "";
        const suffix = interrogator.kind === "cl" ? "CL" : "WD";
        return `<option value="${escapeHtml(interrogator.name)}"${selected}>${escapeHtml(interrogator.name)} (${suffix})</option>`;
      })
      .join("");

    setText("batch-tagger-status", `已加载 ${interrogators.length} 个打标模型。`);
  } catch (error) {
    controls.modelSelect.innerHTML = `<option value="wd14-convnextv2-v2">wd14-convnextv2-v2 (WD)</option>`;
    setText("batch-tagger-status", error instanceof Error ? error.message : "读取打标模型列表失败。");
    setHtml(
      "batch-tagger-results",
      `<article class="dataset-analysis-block dataset-analysis-warning"><p>${escapeHtml(error instanceof Error ? error.message : "读取打标模型列表失败。")}</p></article>`
    );
  }
}

function bindCaptionCleanup() {
  const controls = getCaptionCleanupControls();
  if (!controls) {
    return;
  }

  controls.browseButton.addEventListener("click", async () => {
    setText("caption-cleanup-status", "正在打开目录选择器...");
    try {
      controls.pathInput.value = await pickFile("folder");
      setText("caption-cleanup-status", "目录已选择，可以先预览清理结果。");
    } catch (error) {
      setText("caption-cleanup-status", error instanceof Error ? error.message : "目录选择失败。");
    }
  });

  controls.previewButton.addEventListener("click", () => {
    void runCaptionCleanup(controls, "preview");
  });

  controls.applyButton.addEventListener("click", () => {
    void runCaptionCleanup(controls, "apply");
  });

  controls.pathInput.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    void runCaptionCleanup(controls, "preview");
  });
}

function bindCaptionBackup() {
  const controls = getCaptionBackupControls();
  if (!controls) {
    return;
  }

  controls.browseButton.addEventListener("click", async () => {
    setText("caption-backup-status", "正在打开目录选择器...");
    try {
      controls.pathInput.value = await pickFile("folder");
      setText("caption-backup-status", "目录已选择，正在刷新快照列表...");
      await refreshCaptionBackups(controls);
    } catch (error) {
      setText("caption-backup-status", error instanceof Error ? error.message : "目录选择失败。");
    }
  });

  controls.refreshButton.addEventListener("click", () => {
    void refreshCaptionBackups(controls);
  });

  controls.createButton.addEventListener("click", () => {
    void createCaptionBackupSnapshot(controls);
  });

  controls.restoreButton.addEventListener("click", () => {
    void restoreCaptionBackupSnapshot(controls);
  });

  controls.selectInput.addEventListener("change", () => {
    void refreshCaptionBackups(controls, controls.selectInput.value || null);
  });
}

function getDatasetAnalyzerControls(): DatasetAnalyzerControls | null {
  const pathInput = document.querySelector<HTMLInputElement>("#dataset-analysis-path");
  const captionExtensionInput = document.querySelector<HTMLInputElement>("#dataset-analysis-caption-extension");
  const topTagsInput = document.querySelector<HTMLInputElement>("#dataset-analysis-top-tags");
  const sampleLimitInput = document.querySelector<HTMLInputElement>("#dataset-analysis-sample-limit");
  const browseButton = document.querySelector<HTMLButtonElement>("#dataset-analysis-pick");
  const runButton = document.querySelector<HTMLButtonElement>("#dataset-analysis-run");

  if (!pathInput || !captionExtensionInput || !topTagsInput || !sampleLimitInput || !browseButton || !runButton) {
    return null;
  }

  return {
    pathInput,
    captionExtensionInput,
    topTagsInput,
    sampleLimitInput,
    browseButton,
    runButton,
  };
}

function getMaskedLossAuditControls(): MaskedLossAuditControls | null {
  const pathInput = document.querySelector<HTMLInputElement>("#masked-loss-audit-path");
  const sampleLimitInput = document.querySelector<HTMLInputElement>("#masked-loss-audit-sample-limit");
  const recursiveInput = document.querySelector<HTMLInputElement>("#masked-loss-audit-recursive");
  const browseButton = document.querySelector<HTMLButtonElement>("#masked-loss-audit-pick");
  const runButton = document.querySelector<HTMLButtonElement>("#masked-loss-audit-run");

  if (!pathInput || !sampleLimitInput || !recursiveInput || !browseButton || !runButton) {
    return null;
  }

  return {
    pathInput,
    sampleLimitInput,
    recursiveInput,
    browseButton,
    runButton,
  };
}

function getBatchTaggerControls(): BatchTaggerControls | null {
  const pathInput = document.querySelector<HTMLInputElement>("#batch-tagger-path");
  const modelSelect = document.querySelector<HTMLSelectElement>("#batch-tagger-model");
  const thresholdInput = document.querySelector<HTMLInputElement>("#batch-tagger-threshold");
  const characterThresholdInput = document.querySelector<HTMLInputElement>("#batch-tagger-character-threshold");
  const conflictSelect = document.querySelector<HTMLSelectElement>("#batch-tagger-conflict");
  const additionalTagsInput = document.querySelector<HTMLInputElement>("#batch-tagger-additional-tags");
  const backupNameInput = document.querySelector<HTMLInputElement>("#batch-tagger-backup-name");
  const excludeTagsInput = document.querySelector<HTMLInputElement>("#batch-tagger-exclude-tags");
  const recursiveInput = document.querySelector<HTMLInputElement>("#batch-tagger-recursive");
  const replaceUnderscoreInput = document.querySelector<HTMLInputElement>("#batch-tagger-replace-underscore");
  const escapeTagInput = document.querySelector<HTMLInputElement>("#batch-tagger-escape-tag");
  const addRatingTagInput = document.querySelector<HTMLInputElement>("#batch-tagger-add-rating-tag");
  const addModelTagInput = document.querySelector<HTMLInputElement>("#batch-tagger-add-model-tag");
  const autoBackupInput = document.querySelector<HTMLInputElement>("#batch-tagger-auto-backup");
  const browseButton = document.querySelector<HTMLButtonElement>("#batch-tagger-pick");
  const runButton = document.querySelector<HTMLButtonElement>("#batch-tagger-run");

  if (
    !pathInput ||
    !modelSelect ||
    !thresholdInput ||
    !characterThresholdInput ||
    !conflictSelect ||
    !additionalTagsInput ||
    !backupNameInput ||
    !excludeTagsInput ||
    !recursiveInput ||
    !replaceUnderscoreInput ||
    !escapeTagInput ||
    !addRatingTagInput ||
    !addModelTagInput ||
    !autoBackupInput ||
    !browseButton ||
    !runButton
  ) {
    return null;
  }

  return {
    pathInput,
    modelSelect,
    thresholdInput,
    characterThresholdInput,
    conflictSelect,
    additionalTagsInput,
    backupNameInput,
    excludeTagsInput,
    recursiveInput,
    replaceUnderscoreInput,
    escapeTagInput,
    addRatingTagInput,
    addModelTagInput,
    autoBackupInput,
    browseButton,
    runButton,
  };
}

function getCaptionCleanupControls(): CaptionCleanupControls | null {
  const pathInput = document.querySelector<HTMLInputElement>("#caption-cleanup-path");
  const extensionInput = document.querySelector<HTMLInputElement>("#caption-cleanup-extension");
  const removeTagsInput = document.querySelector<HTMLInputElement>("#caption-cleanup-remove-tags");
  const prependTagsInput = document.querySelector<HTMLInputElement>("#caption-cleanup-prepend-tags");
  const appendTagsInput = document.querySelector<HTMLInputElement>("#caption-cleanup-append-tags");
  const searchTextInput = document.querySelector<HTMLInputElement>("#caption-cleanup-search-text");
  const replaceTextInput = document.querySelector<HTMLInputElement>("#caption-cleanup-replace-text");
  const backupNameInput = document.querySelector<HTMLInputElement>("#caption-cleanup-backup-name");
  const sampleLimitInput = document.querySelector<HTMLInputElement>("#caption-cleanup-sample-limit");
  const recursiveInput = document.querySelector<HTMLInputElement>("#caption-cleanup-recursive");
  const collapseWhitespaceInput = document.querySelector<HTMLInputElement>("#caption-cleanup-collapse-whitespace");
  const replaceUnderscoreInput = document.querySelector<HTMLInputElement>("#caption-cleanup-replace-underscore");
  const dedupeTagsInput = document.querySelector<HTMLInputElement>("#caption-cleanup-dedupe-tags");
  const sortTagsInput = document.querySelector<HTMLInputElement>("#caption-cleanup-sort-tags");
  const useRegexInput = document.querySelector<HTMLInputElement>("#caption-cleanup-use-regex");
  const autoBackupInput = document.querySelector<HTMLInputElement>("#caption-cleanup-auto-backup");
  const browseButton = document.querySelector<HTMLButtonElement>("#caption-cleanup-pick");
  const previewButton = document.querySelector<HTMLButtonElement>("#caption-cleanup-preview");
  const applyButton = document.querySelector<HTMLButtonElement>("#caption-cleanup-apply");

  if (
    !pathInput ||
    !extensionInput ||
    !removeTagsInput ||
    !prependTagsInput ||
    !appendTagsInput ||
    !searchTextInput ||
    !replaceTextInput ||
    !backupNameInput ||
    !sampleLimitInput ||
    !recursiveInput ||
    !collapseWhitespaceInput ||
    !replaceUnderscoreInput ||
    !dedupeTagsInput ||
    !sortTagsInput ||
    !useRegexInput ||
    !autoBackupInput ||
    !browseButton ||
    !previewButton ||
    !applyButton
  ) {
    return null;
  }

  return {
    pathInput,
    extensionInput,
    removeTagsInput,
    prependTagsInput,
    appendTagsInput,
    searchTextInput,
    replaceTextInput,
    backupNameInput,
    sampleLimitInput,
    recursiveInput,
    collapseWhitespaceInput,
    replaceUnderscoreInput,
    dedupeTagsInput,
    sortTagsInput,
    useRegexInput,
    autoBackupInput,
    browseButton,
    previewButton,
    applyButton,
  };
}

function getCaptionBackupControls(): CaptionBackupControls | null {
  const pathInput = document.querySelector<HTMLInputElement>("#caption-backup-path");
  const extensionInput = document.querySelector<HTMLInputElement>("#caption-backup-extension");
  const nameInput = document.querySelector<HTMLInputElement>("#caption-backup-name");
  const selectInput = document.querySelector<HTMLSelectElement>("#caption-backup-select");
  const recursiveInput = document.querySelector<HTMLInputElement>("#caption-backup-recursive");
  const preRestoreInput = document.querySelector<HTMLInputElement>("#caption-backup-pre-restore");
  const browseButton = document.querySelector<HTMLButtonElement>("#caption-backup-pick");
  const createButton = document.querySelector<HTMLButtonElement>("#caption-backup-create");
  const refreshButton = document.querySelector<HTMLButtonElement>("#caption-backup-refresh");
  const restoreButton = document.querySelector<HTMLButtonElement>("#caption-backup-restore");

  if (
    !pathInput ||
    !extensionInput ||
    !nameInput ||
    !selectInput ||
    !recursiveInput ||
    !preRestoreInput ||
    !browseButton ||
    !createButton ||
    !refreshButton ||
    !restoreButton
  ) {
    return null;
  }

  return {
    pathInput,
    extensionInput,
    nameInput,
    selectInput,
    recursiveInput,
    preRestoreInput,
    browseButton,
    createButton,
    refreshButton,
    restoreButton,
  };
}

async function runDatasetAnalysis(controls: DatasetAnalyzerControls) {
  const path = controls.pathInput.value.trim();
  if (!path) {
    setText("dataset-analysis-status", "请先选择数据集目录。");
    setHtml("dataset-analysis-results", "<p class=\"dataset-analysis-empty\">当前还没有选择目录。</p>");
    return;
  }

  controls.browseButton.disabled = true;
  controls.runButton.disabled = true;
  setText("dataset-analysis-status", "正在分析数据集...");
  setHtml("dataset-analysis-results", "<p class=\"dataset-analysis-empty\">正在扫描图片、标签文件和标签内容...</p>");

  try {
    const result = await analyzeDataset({
      path,
      caption_extension: controls.captionExtensionInput.value.trim() || ".txt",
      top_tags: parsePositiveInt(controls.topTagsInput.value, 40),
      sample_limit: parsePositiveInt(controls.sampleLimitInput.value, 8),
    });

    if (result.status !== "success" || !result.data) {
      throw new Error(result.message || "数据集分析没有返回结果。");
    }

    setText(
      "dataset-analysis-status",
      `已扫描 ${result.data.summary.dataset_folder_count} 个目录，共 ${result.data.summary.image_count} 张图片。`
    );
    renderDatasetAnalysisReport(result.data);
  } catch (error) {
    setText("dataset-analysis-status", error instanceof Error ? error.message : "数据集分析失败。");
    setHtml(
      "dataset-analysis-results",
      `<article class="dataset-analysis-block dataset-analysis-warning"><p>${escapeHtml(error instanceof Error ? error.message : "数据集分析失败。")}</p></article>`
    );
  } finally {
    controls.browseButton.disabled = false;
    controls.runButton.disabled = false;
  }
}

async function runMaskedLossAudit(controls: MaskedLossAuditControls) {
  const path = controls.pathInput.value.trim();
  if (!path) {
    setText("masked-loss-audit-status", "请先选择数据集目录。");
    setHtml("masked-loss-audit-results", "<p class=\"dataset-analysis-empty\">当前还没有选择数据集目录。</p>");
    return;
  }

  controls.browseButton.disabled = true;
  controls.runButton.disabled = true;
  setText("masked-loss-audit-status", "正在检查 alpha 蒙版...");
  setHtml("masked-loss-audit-results", "<p class=\"dataset-analysis-empty\">正在读取图片并检查 alpha 通道...</p>");

  try {
    const result = await analyzeMaskedLossDataset({
      path,
      recursive: controls.recursiveInput.checked,
      sample_limit: parsePositiveInt(controls.sampleLimitInput.value, 8),
    });

    if (result.status !== "success" || !result.data) {
      throw new Error(result.message || "蒙版损失检查没有返回结果。");
    }

    setText(
      "masked-loss-audit-status",
      `已检查 ${result.data.summary.image_count} 张图片，其中 ${result.data.summary.usable_mask_image_count} 张带有可用 alpha 蒙版。`
    );
    renderMaskedLossAuditReport(result.data);
  } catch (error) {
    setText("masked-loss-audit-status", error instanceof Error ? error.message : "蒙版损失检查失败。");
    setHtml(
      "masked-loss-audit-results",
      `<article class="dataset-analysis-block dataset-analysis-warning"><p>${escapeHtml(error instanceof Error ? error.message : "蒙版损失检查失败。")}</p></article>`
    );
  } finally {
    controls.browseButton.disabled = false;
    controls.runButton.disabled = false;
  }
}

async function runBatchTagger(controls: BatchTaggerControls) {
  const path = controls.pathInput.value.trim();
  if (!path) {
    setText("batch-tagger-status", "请先选择图片目录。");
    setHtml("batch-tagger-results", "<p class=\"dataset-analysis-empty\">当前还没有选择图片目录。</p>");
    return;
  }

  controls.browseButton.disabled = true;
  controls.runButton.disabled = true;
  setText("batch-tagger-status", "正在启动批量打标...");
  setHtml("batch-tagger-results", "<p class=\"dataset-analysis-empty\">正在向后端提交打标任务...</p>");

  try {
    const threshold = parseBoundedNumber(controls.thresholdInput.value, 0.35, 0, 1);
    const characterThreshold = parseBoundedNumber(controls.characterThresholdInput.value, 0.6, 0, 1);
    const result = await runInterrogate({
      path,
      interrogator_model: controls.modelSelect.value,
      threshold,
      character_threshold: characterThreshold,
      batch_output_action_on_conflict: controls.conflictSelect.value,
      create_backup_before_write: controls.autoBackupInput.checked,
      backup_snapshot_name: controls.backupNameInput.value.trim(),
      additional_tags: controls.additionalTagsInput.value.trim(),
      exclude_tags: controls.excludeTagsInput.value.trim(),
      batch_input_recursive: controls.recursiveInput.checked,
      replace_underscore: controls.replaceUnderscoreInput.checked,
      escape_tag: controls.escapeTagInput.checked,
      add_rating_tag: controls.addRatingTagInput.checked,
      add_model_tag: controls.addModelTagInput.checked,
    });

    if (result.status !== "success") {
      throw new Error(result.message || "批量打标启动失败。");
    }

    setText("batch-tagger-status", result.message || "批量打标任务已启动。");
    setHtml(
      "batch-tagger-results",
      `
        <article class="dataset-analysis-block">
          <p class="panel-kicker">已启动</p>
          <h3>已提交批量打标任务</h3>
          <p><code>${escapeHtml(path)}</code></p>
          <p>模型：<code>${escapeHtml(controls.modelSelect.value)}</code></p>
          <p>
            阈值：<strong>${escapeHtml(String(threshold))}</strong>
            · 角色阈值：<strong>${escapeHtml(String(characterThreshold))}</strong>
            · 冲突处理：<strong>${escapeHtml(controls.conflictSelect.value)}</strong>
          </p>
          <p>
            递归：<strong>${controls.recursiveInput.checked ? "是" : "否"}</strong>
            · 下划线转空格：<strong>${controls.replaceUnderscoreInput.checked ? "是" : "否"}</strong>
            · 转义标签：<strong>${controls.escapeTagInput.checked ? "是" : "否"}</strong>
          </p>
          <p>
            自动备份：<strong>${controls.autoBackupInput.checked ? "是" : "否"}</strong>
            ${
              result.data?.backup
                ? `· 快照：<code>${escapeHtml(result.data.backup.archive_name)}</code>`
                : ""
            }
          </p>
          ${
            result.data?.warnings?.length
              ? `<p>${escapeHtml(result.data.warnings.join(" "))}</p>`
              : ""
          }
          <p>后端会在后台执行这项任务。可以查看控制台输出，并检查数据集目录里生成的 <code>.txt</code> 文件。</p>
        </article>
      `
    );
  } catch (error) {
    setText("batch-tagger-status", error instanceof Error ? error.message : "批量打标失败。");
    setHtml(
      "batch-tagger-results",
      `<article class="dataset-analysis-block dataset-analysis-warning"><p>${escapeHtml(error instanceof Error ? error.message : "批量打标失败。")}</p></article>`
    );
  } finally {
    controls.browseButton.disabled = false;
    controls.runButton.disabled = false;
  }
}

async function runCaptionCleanup(controls: CaptionCleanupControls, mode: "preview" | "apply") {
  const path = controls.pathInput.value.trim();
  if (!path) {
    setText("caption-cleanup-status", "请先选择标签目录。");
    setHtml("caption-cleanup-results", "<p class=\"dataset-analysis-empty\">当前还没有选择标签目录。</p>");
    return;
  }

  const requestPayload = {
    path,
    caption_extension: controls.extensionInput.value.trim() || ".txt",
    recursive: controls.recursiveInput.checked,
    collapse_whitespace: controls.collapseWhitespaceInput.checked,
    replace_underscore: controls.replaceUnderscoreInput.checked,
    dedupe_tags: controls.dedupeTagsInput.checked,
    sort_tags: controls.sortTagsInput.checked,
    remove_tags: controls.removeTagsInput.value.trim(),
    prepend_tags: controls.prependTagsInput.value.trim(),
    append_tags: controls.appendTagsInput.value.trim(),
    search_text: controls.searchTextInput.value,
    replace_text: controls.replaceTextInput.value,
    use_regex: controls.useRegexInput.checked,
    create_backup_before_apply: controls.autoBackupInput.checked,
    backup_snapshot_name: controls.backupNameInput.value.trim(),
    sample_limit: parsePositiveInt(controls.sampleLimitInput.value, 8),
  };

  controls.browseButton.disabled = true;
  controls.previewButton.disabled = true;
  controls.applyButton.disabled = true;
  setText("caption-cleanup-status", mode === "preview" ? "正在预览标签清理..." : "正在应用标签清理...");
  setHtml(
    "caption-cleanup-results",
    `<p class="dataset-analysis-empty">${mode === "preview" ? "正在扫描标签文件并生成样本差异..." : "正在把清理结果写回磁盘..."}</p>`
  );

  try {
    const result =
      mode === "preview"
        ? await previewCaptionCleanup(requestPayload)
        : await applyCaptionCleanup(requestPayload);

    if (result.status !== "success" || !result.data) {
      throw new Error(result.message || `标签清理${mode === "preview" ? "预览" : "应用"}失败。`);
    }

    setText(
      "caption-cleanup-status",
      result.message ||
        (mode === "preview"
          ? `已预览 ${result.data.summary.changed_file_count} 个标签文件的改动。`
          : `已对 ${result.data.summary.changed_file_count} 个标签文件应用清理。`)
    );
    renderCaptionCleanupReport(result.data);
  } catch (error) {
    setText("caption-cleanup-status", error instanceof Error ? error.message : "标签清理失败。");
    setHtml(
      "caption-cleanup-results",
      `<article class="dataset-analysis-block dataset-analysis-warning"><p>${escapeHtml(error instanceof Error ? error.message : "标签清理失败。")}</p></article>`
    );
  } finally {
    controls.browseButton.disabled = false;
    controls.previewButton.disabled = false;
    controls.applyButton.disabled = false;
  }
}

async function refreshCaptionBackups(
  controls: CaptionBackupControls,
  selectedArchiveName?: string | null,
  renderInventory = true
) {
  const path = controls.pathInput.value.trim();
  if (!path) {
    setText("caption-backup-status", "请先选择标签目录。");
    setHtml("caption-backup-results", "<p class=\"dataset-analysis-empty\">当前还没有选择标签目录。</p>");
    controls.selectInput.innerHTML = `<option value="">请先刷新该目录的快照列表</option>`;
    return;
  }

  controls.browseButton.disabled = true;
  controls.createButton.disabled = true;
  controls.refreshButton.disabled = true;
  controls.restoreButton.disabled = true;
  setText("caption-backup-status", "正在读取标签快照...");

  try {
    const result = await listCaptionBackups({ path });
    const backups = result.data?.backups ?? [];
    const fallbackSelectedValue = controls.selectInput.value || (backups[0]?.archive_name ?? "");
    const selectedValue = selectedArchiveName ?? fallbackSelectedValue;

    controls.selectInput.innerHTML = backups.length
      ? backups
          .map((backup) => {
            const selected = backup.archive_name === selectedValue ? " selected" : "";
            return `<option value="${escapeHtml(backup.archive_name)}"${selected}>${escapeHtml(backup.snapshot_name)} · ${escapeHtml(backup.archive_name)}</option>`;
          })
          .join("")
      : `<option value="">这个目录下还没有快照</option>`;

    if (backups.length && selectedValue) {
      controls.selectInput.value = selectedValue;
    }

    setText("caption-backup-status", backups.length ? `已加载 ${backups.length} 个标签快照。` : "这个目录下没有找到标签快照。");
    if (renderInventory) {
      renderCaptionBackupInventory(backups, backups.length ? selectedValue : null);
    }
  } catch (error) {
    setText("caption-backup-status", error instanceof Error ? error.message : "读取标签快照失败。");
    setHtml(
      "caption-backup-results",
      `<article class="dataset-analysis-block dataset-analysis-warning"><p>${escapeHtml(error instanceof Error ? error.message : "读取标签快照失败。")}</p></article>`
    );
  } finally {
    controls.browseButton.disabled = false;
    controls.createButton.disabled = false;
    controls.refreshButton.disabled = false;
    controls.restoreButton.disabled = false;
  }
}

async function createCaptionBackupSnapshot(controls: CaptionBackupControls) {
  const path = controls.pathInput.value.trim();
  if (!path) {
    setText("caption-backup-status", "请先选择标签目录。");
    setHtml("caption-backup-results", "<p class=\"dataset-analysis-empty\">当前还没有选择标签目录。</p>");
    return;
  }

  controls.browseButton.disabled = true;
  controls.createButton.disabled = true;
  controls.refreshButton.disabled = true;
  controls.restoreButton.disabled = true;
  setText("caption-backup-status", "正在创建标签快照...");

  try {
    const result = await createCaptionBackup({
      path,
      caption_extension: controls.extensionInput.value.trim() || ".txt",
      recursive: controls.recursiveInput.checked,
      snapshot_name: controls.nameInput.value.trim(),
    });

    if (result.status !== "success" || !result.data) {
      throw new Error(result.message || "标签快照创建失败。");
    }

    setText("caption-backup-status", result.message || `已创建 ${result.data.archive_name}`);
    controls.nameInput.value = "";
    await refreshCaptionBackups(controls, result.data.archive_name);
  } catch (error) {
    setText("caption-backup-status", error instanceof Error ? error.message : "标签快照创建失败。");
    setHtml(
      "caption-backup-results",
      `<article class="dataset-analysis-block dataset-analysis-warning"><p>${escapeHtml(error instanceof Error ? error.message : "标签快照创建失败。")}</p></article>`
    );
  } finally {
    controls.browseButton.disabled = false;
    controls.createButton.disabled = false;
    controls.refreshButton.disabled = false;
    controls.restoreButton.disabled = false;
  }
}

async function restoreCaptionBackupSnapshot(controls: CaptionBackupControls) {
  const path = controls.pathInput.value.trim();
  const archiveName = controls.selectInput.value;

  if (!path) {
    setText("caption-backup-status", "请先选择标签目录。");
    setHtml("caption-backup-results", "<p class=\"dataset-analysis-empty\">当前还没有选择标签目录。</p>");
    return;
  }

  if (!archiveName) {
    setText("caption-backup-status", "请选择要恢复的快照。");
    return;
  }

  const confirmed = window.confirm(
    `要把标签快照 ${archiveName} 恢复到这个目录吗？\n\n这会覆盖快照中对应的标签文件。`
  );
  if (!confirmed) {
    return;
  }

  controls.browseButton.disabled = true;
  controls.createButton.disabled = true;
  controls.refreshButton.disabled = true;
  controls.restoreButton.disabled = true;
  setText("caption-backup-status", "正在恢复标签快照...");
  setHtml("caption-backup-results", "<p class=\"dataset-analysis-empty\">正在把快照文件写回目录...</p>");

  try {
    const result = await restoreCaptionBackup({
      path,
      archive_name: archiveName,
      make_restore_backup: controls.preRestoreInput.checked,
    });

    if (result.status !== "success" || !result.data) {
      throw new Error(result.message || "标签快照恢复失败。");
    }

    setText("caption-backup-status", result.message || `已恢复 ${result.data.restored_file_count} 个标签文件。`);
    renderCaptionBackupRestoreReport(result.data);
    await refreshCaptionBackups(controls, archiveName, false);
  } catch (error) {
    setText("caption-backup-status", error instanceof Error ? error.message : "标签快照恢复失败。");
    setHtml(
      "caption-backup-results",
      `<article class="dataset-analysis-block dataset-analysis-warning"><p>${escapeHtml(error instanceof Error ? error.message : "标签快照恢复失败。")}</p></article>`
    );
  } finally {
    controls.browseButton.disabled = false;
    controls.createButton.disabled = false;
    controls.refreshButton.disabled = false;
    controls.restoreButton.disabled = false;
  }
}

function parsePositiveInt(value: string, fallback: number) {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function parseBoundedNumber(value: string, fallback: number, min: number, max: number) {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}
