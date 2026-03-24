import {
  fetchConfigSummary,
  fetchGraphicCards,
  fetchSavedParams,
} from "../services/api";
import { setHtml, setText } from "../shared/domUtils";
import { escapeHtml } from "../shared/textUtils";
import type { RuntimePackageRecord } from "../shared/types";
import {
  getTrainingOptionEntries,
  getTrainingOptionVisibilitySettings,
  resetTrainingOptionVisibility,
  setAllTrainingOptionVisibility,
  setBuiltInTrainingOptionVisibility,
  setTrainingOptionVisibility,
  type TrainingOptionEntry,
  type TrainingOptionKind,
} from "../training/trainingOptionRegistry";

const TRACKED_OPTION_PACKAGES = [
  "pytorch_optimizer",
  "schedulefree",
  "bitsandbytes",
  "prodigyplus",
  "prodigyopt",
  "lion_pytorch",
  "dadaptation",
  "transformers",
];

function formatOptionSourceLabel(sourceLabel: string) {
  switch (sourceLabel) {
    case "bridge built-in":
      return "桥接内置";
    case "torch.optim":
      return "torch.optim";
    case "torch lr_scheduler":
      return "torch 调度器";
    case "bitsandbytes":
      return "bitsandbytes";
    case "schedulefree":
      return "schedulefree";
    case "transformers":
      return "transformers";
    case "diffusers":
      return "diffusers";
    case "pytorch-optimizer":
      return "pytorch-optimizer";
    case "prodigyplus":
      return "prodigyplus";
    default:
      return sourceLabel;
  }
}

function formatTrainingOptionDescription(kind: TrainingOptionKind, entry: TrainingOptionEntry) {
  const itemLabel = kind === "optimizer" ? "优化器" : "调度器";

  if (entry.source === "bridge") {
    return `项目桥接层已接入的${itemLabel}条目，可直接沿用现有训练流程。`;
  }

  if (entry.source === "bitsandbytes") {
    return `来自 bitsandbytes 的 ${itemLabel} 条目，通常用于更省显存的训练场景。`;
  }

  if (entry.source === "schedulefree") {
    return `来自 schedulefree 的 ${itemLabel} 条目，适合想减少额外学习率调度依赖时使用。`;
  }

  if (entry.source === "transformers") {
    return `来自 transformers 的 ${itemLabel} 条目，启用前需要当前运行环境可导入对应依赖。`;
  }

  if (entry.source === "diffusers") {
    return `diffusers 内置的 ${itemLabel} 条目，也是当前项目默认最优先暴露的一组。`;
  }

  if (entry.source === "torch") {
    return `PyTorch 自带的 ${itemLabel} 条目，适合希望继续使用标准训练组件的场景。`;
  }

  if (entry.source === "pytorch-optimizer") {
    return `来自 pytorch-optimizer 扩展库的 ${itemLabel} 条目，属于额外可选能力。`;
  }

  if (entry.source === "prodigyplus") {
    return "来自 ProdigyPlus 扩展的优化器条目，通常用于更激进的训练配方。";
  }

  return entry.description || `${entry.label} ${itemLabel}。`;
}

function renderSourceCoverage(entries: TrainingOptionEntry[], visibleValues: Set<string>) {
  const counts = new Map<string, { total: number; visible: number }>();

  for (const entry of entries) {
    const record = counts.get(entry.sourceLabel) ?? { total: 0, visible: 0 };
    record.total += 1;
    if (visibleValues.has(entry.value)) {
      record.visible += 1;
    }
    counts.set(entry.sourceLabel, record);
  }

  return [...counts.entries()]
    .map(
      ([sourceLabel, record]) =>
        `<span class="coverage-pill ${record.visible > 0 ? "" : "coverage-pill-muted"}">${escapeHtml(formatOptionSourceLabel(sourceLabel))} <strong>${record.visible}/${record.total}</strong></span>`
    )
    .join("");
}

function renderPackageStatePill(record?: RuntimePackageRecord | null) {
  if (!record) {
    return "";
  }

  if (record.importable) {
    return `<span class="coverage-pill">${escapeHtml(record.version ? `${record.display_name} ${record.version}` : `${record.display_name} 可用`)}</span>`;
  }

  if (record.installed) {
    return `<span class="coverage-pill coverage-pill-warning">${escapeHtml(`${record.display_name} 导入失败`)}</span>`;
  }

  return `<span class="coverage-pill coverage-pill-muted">${escapeHtml(`${record.display_name} 缺失`)}</span>`;
}

function renderOptionCard(
  kind: TrainingOptionKind,
  entry: TrainingOptionEntry,
  enabled: boolean,
  runtimePackages?: Record<string, RuntimePackageRecord>
) {
  const valueLabel = entry.schedulerTypePath
    ? `<strong>桥接字段：</strong> <code>${escapeHtml(entry.schedulerTypePath)}</code>`
    : `<strong>值：</strong> <code>${escapeHtml(entry.value)}</code>`;
  const runtimePackage = entry.packageName ? runtimePackages?.[entry.packageName] : undefined;
  const pills = [
    `<span class="coverage-pill ${enabled ? "" : "coverage-pill-muted"}">${enabled ? "显示" : "隐藏"}</span>`,
    `<span class="coverage-pill coverage-pill-muted">${escapeHtml(formatOptionSourceLabel(entry.sourceLabel))}</span>`,
    entry.defaultVisible ? `<span class="coverage-pill">默认</span>` : `<span class="coverage-pill coverage-pill-muted">扩展</span>`,
    entry.packageName ? `<span class="coverage-pill coverage-pill-muted">${escapeHtml(entry.packageName)}</span>` : "",
    renderPackageStatePill(runtimePackage),
  ]
    .filter(Boolean)
    .join("");

  const runtimeNote = runtimePackage && !runtimePackage.importable
    ? `<p class="settings-option-runtime-note">${escapeHtml(runtimePackage.reason || "当前运行时中无法导入这个依赖。")}</p>`
    : "";

  return `
    <label class="settings-option-card ${enabled ? "is-enabled" : "is-disabled"}">
      <div class="settings-option-card-head">
        <div class="settings-option-check">
          <input
            type="checkbox"
            data-training-option-toggle="${kind}"
            value="${escapeHtml(entry.value)}"
            ${enabled ? "checked" : ""}
          />
          <div>
            <strong>${escapeHtml(entry.label)}</strong>
            <p class="settings-option-meta">${valueLabel}</p>
          </div>
        </div>
        <div class="coverage-list">${pills}</div>
      </div>
      <p class="settings-option-description">${escapeHtml(formatTrainingOptionDescription(kind, entry))}</p>
      ${runtimeNote}
    </label>
  `;
}

function renderRuntimeSummary(runtimeLabel: string, runtimePackages?: Record<string, RuntimePackageRecord>) {
  setText("settings-runtime-title", runtimeLabel);

  if (!runtimePackages) {
    setText("settings-runtime-body", "没有返回运行时依赖信息。");
    return;
  }

  const trackedRecords = TRACKED_OPTION_PACKAGES
    .map((name) => runtimePackages[name])
    .filter((record): record is RuntimePackageRecord => Boolean(record));
  if (trackedRecords.length === 0) {
    setHtml("settings-runtime-body", "<p>没有返回被跟踪的运行时依赖记录。</p>");
    return;
  }
  const readyCount = trackedRecords.filter((record) => record.importable).length;

  setHtml(
      "settings-runtime-body",
    `
      <p>${escapeHtml(`当前运行时中有 ${readyCount}/${trackedRecords.length} 个被跟踪训练依赖可正常导入。`)}</p>
      <div class="coverage-list">
        ${trackedRecords
          .map((record) => renderPackageStatePill(record))
          .join("")}
      </div>
      <div class="settings-runtime-grid">
        ${trackedRecords
          .map(
            (record) => `
              <article class="settings-runtime-card">
                <strong>${escapeHtml(record.display_name)}</strong>
                <p class="settings-option-meta"><code>${escapeHtml(record.module_name)}</code></p>
                <p class="settings-option-description">
                  ${escapeHtml(
                    record.importable
                      ? `可用${record.version ? ` (${record.version})` : ""}`
                      : record.reason || "当前运行时中无法导入该依赖。"
                  )}
                </p>
              </article>
            `
          )
          .join("")}
      </div>
    `
  );
}

function renderVisibilityPanel(kind: TrainingOptionKind, runtimePackages?: Record<string, RuntimePackageRecord>) {
  const entries = getTrainingOptionEntries(kind);
  const visibleValues = new Set(getTrainingOptionVisibilitySettings()[kind]);
  const titleId = `settings-${kind}-title`;
  const bodyId = `settings-${kind}-body`;
  const visibleCount = entries.filter((entry) => visibleValues.has(entry.value)).length;
  const helperText =
    kind === "optimizer"
      ? "这里控制源码版训练页里 optimizer_type 默认显示哪些条目。"
      : "这里控制源码版训练页里调度器显示哪些条目，外部调度器会在启动时自动桥接到 lr_scheduler_type。";

  setText(titleId, `${visibleCount}/${entries.length} 个${kind === "optimizer" ? "优化器" : "调度器"}显示中`);
  setHtml(
    bodyId,
    `
      <p>${escapeHtml(helperText)}</p>
      <div class="settings-option-toolbar">
        <button class="action-button action-button-ghost action-button-small" data-training-option-action="${kind}:defaults" type="button">恢复默认</button>
        <button class="action-button action-button-ghost action-button-small" data-training-option-action="${kind}:builtins" type="button">仅显示内置</button>
        <button class="action-button action-button-ghost action-button-small" data-training-option-action="${kind}:all" type="button">全部显示</button>
      </div>
      <div class="coverage-list settings-option-coverage">
        <span class="coverage-pill">当前启用 ${visibleCount} 项</span>
        ${renderSourceCoverage(entries, visibleValues)}
      </div>
      <div class="settings-option-grid">
        ${entries.map((entry) => renderOptionCard(kind, entry, visibleValues.has(entry.value), runtimePackages)).join("")}
      </div>
    `
  );
}

function bindVisibilityPanel(kind: TrainingOptionKind, runtimePackages?: Record<string, RuntimePackageRecord>) {
  const body = document.querySelector<HTMLElement>(`#settings-${kind}-body`);
  if (!body) {
    return;
  }

  body.querySelectorAll<HTMLInputElement>(`[data-training-option-toggle="${kind}"]`).forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const nextVisible = body.querySelectorAll<HTMLInputElement>(`[data-training-option-toggle="${kind}"]:checked`);
      setTrainingOptionVisibility(
        kind,
        [...nextVisible].map((input) => input.value)
      );
      renderVisibilityPanel(kind, runtimePackages);
      bindVisibilityPanel(kind, runtimePackages);
    });
  });

  body.querySelectorAll<HTMLButtonElement>(`[data-training-option-action^="${kind}:"]`).forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.trainingOptionAction?.split(":")[1];
      if (action === "defaults") {
        resetTrainingOptionVisibility(kind);
      } else if (action === "builtins") {
        setBuiltInTrainingOptionVisibility(kind);
      } else if (action === "all") {
        setAllTrainingOptionVisibility(kind, true);
      }

      renderVisibilityPanel(kind, runtimePackages);
      bindVisibilityPanel(kind, runtimePackages);
    });
  });
}

function renderTrainingOptionPanels(runtimePackages?: Record<string, RuntimePackageRecord>) {
  renderVisibilityPanel("optimizer", runtimePackages);
  renderVisibilityPanel("scheduler", runtimePackages);
  bindVisibilityPanel("optimizer", runtimePackages);
  bindVisibilityPanel("scheduler", runtimePackages);
}

export async function bindSettingsData() {
  const [summaryResult, paramsResult, runtimeResult] = await Promise.allSettled([
    fetchConfigSummary(),
    fetchSavedParams(),
    fetchGraphicCards(),
  ]);

  if (summaryResult.status === "fulfilled") {
    const data = summaryResult.value.data;
    setText("settings-summary-title", `已记录 ${data?.saved_param_count ?? 0} 组参数`);
    setHtml(
      "settings-summary-body",
      `
        <p><strong>配置文件：</strong> <code>${escapeHtml(data?.config_path ?? "未知")}</code></p>
        <p><strong>最近路径：</strong> <code>${escapeHtml(data?.last_path || "（空）")}</code></p>
        <p><strong>已保存键名：</strong> ${(data?.saved_param_keys ?? []).map((key) => `<code>${escapeHtml(key)}</code>`).join(", ") || "无"}</p>
      `
    );
  } else {
    setText("settings-summary-title", "配置摘要读取失败");
    setText("settings-summary-body", summaryResult.reason instanceof Error ? summaryResult.reason.message : "未知错误");
  }

  if (paramsResult.status === "fulfilled") {
    const data = paramsResult.value.data ?? {};
    const keys = Object.keys(data);
    setText("settings-params-title", `已保存 ${keys.length} 项参数`);
    setHtml(
      "settings-params-body",
      keys.length
        ? `<div class="coverage-list">${keys.map((key) => `<span class="coverage-pill coverage-pill-muted">${escapeHtml(key)}</span>`).join("")}</div>`
        : "<p>没有返回已保存参数。</p>"
    );
  } else {
    setText("settings-params-title", "已保存参数读取失败");
    setText("settings-params-body", paramsResult.reason instanceof Error ? paramsResult.reason.message : "未知错误");
  }

  if (runtimeResult.status === "fulfilled") {
    const runtime = runtimeResult.value.data?.runtime;
    renderRuntimeSummary(
      runtime
        ? `${runtime.environment} 运行时 · Python ${runtime.python_version}`
        : "运行时依赖状态不可用",
      runtime?.packages
    );
    renderTrainingOptionPanels(runtime?.packages);
    return;
  }

  setText("settings-runtime-title", "运行时依赖状态读取失败");
  setText("settings-runtime-body", runtimeResult.reason instanceof Error ? runtimeResult.reason.message : "未知错误");
  renderTrainingOptionPanels();
}
