import { setHtml } from "../shared/domUtils";
import type {
  CaptionBackupRecord,
  CaptionBackupRestoreRecord,
  CaptionCleanupRecord,
  DatasetAnalysisRecord,
  MaskedLossAuditRecord,
  NamedCountRecord,
  ScriptRecord,
  TaskRecord,
} from "../shared/types";
import { escapeHtml } from "../shared/textUtils";

export function renderTaskTable(tasks: TaskRecord[]) {
  if (tasks.length === 0) {
    setHtml("task-table-container", "<p>当前没有正在跟踪的任务。</p>");
    return;
  }

  const rows = tasks
    .map(
      (task) => `
        <tr>
          <td><code>${escapeHtml(task.id ?? task.task_id ?? "未知")}</code></td>
          <td>${escapeHtml(task.status ?? "未知")}</td>
          <td>
            <button class="action-button action-button-small" data-task-terminate="${escapeHtml(task.id ?? task.task_id ?? "")}" type="button">
              终止
            </button>
          </td>
        </tr>
      `
    )
    .join("");

  setHtml(
    "task-table-container",
    `
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `
  );
}

export function renderToolsBrowser(scripts: ScriptRecord[]) {
  if (scripts.length === 0) {
    setHtml("tools-browser", "<p>没有返回任何脚本。</p>");
    return;
  }

  const items = scripts
    .map(
      (script) => `
        <article class="tool-card">
          <div class="tool-card-head">
            <h3>${escapeHtml(script.name)}</h3>
            <span class="coverage-pill ${script.category === "networks" ? "" : "coverage-pill-muted"}">${escapeHtml(formatScriptCategory(script.category))}</span>
          </div>
          <p>${
            script.positional_args.length > 0
              ? `位置参数：${script.positional_args.map((arg) => `<code>${escapeHtml(arg)}</code>`).join(", ")}`
              : "不需要位置参数。"
          }</p>
        </article>
      `
    )
    .join("");

  setHtml("tools-browser", items);
}

export function renderDatasetAnalysisReport(report: DatasetAnalysisRecord) {
  const stats = [
    { label: "图片数", value: report.summary.image_count },
    { label: "有效图片数", value: report.summary.effective_image_count },
    { label: "透明图候选", value: report.summary.alpha_capable_image_count },
    { label: "标签覆盖率", value: formatPercent(report.summary.caption_coverage) },
    { label: "去重标签数", value: report.summary.unique_tag_count },
    { label: "标签文件数", value: report.summary.caption_file_count },
    { label: "平均每条标签数", value: report.summary.average_tags_per_caption.toFixed(2) },
  ];

  const warningBlock = report.warnings.length
    ? `
      <article class="dataset-analysis-block dataset-analysis-warning">
        <p class="panel-kicker">警告</p>
        <ul class="dataset-analysis-list-plain">
          ${report.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}
        </ul>
      </article>
    `
    : "";

  const folders = report.folders.length
    ? report.folders
        .map(
          (folder) => `
            <article class="dataset-analysis-block">
              <div class="tool-card-head">
                <h3>${escapeHtml(folder.name)}</h3>
                <span class="coverage-pill ${folder.caption_coverage >= 1 ? "" : "coverage-pill-muted"}">
                  ${formatPercent(folder.caption_coverage)}
                </span>
              </div>
              <p><code>${escapeHtml(folder.path)}</code></p>
              <p>
                图片数：<strong>${folder.image_count}</strong>
                · 有效图片：<strong>${folder.effective_image_count}</strong>
                · 重复次数：<strong>${folder.repeats ?? 1}</strong>
              </p>
              <p>透明图候选：<strong>${folder.alpha_capable_image_count}</strong></p>
              <p>
                缺失标签：<strong>${folder.missing_caption_count}</strong>
                · 孤立标签：<strong>${folder.orphan_caption_count}</strong>
                · 空标签：<strong>${folder.empty_caption_count}</strong>
              </p>
            </article>
          `
        )
        .join("")
    : "<p>没有返回任何数据集目录摘要。</p>";

  setHtml(
    "dataset-analysis-results",
    `
      ${warningBlock}
      <section class="dataset-analysis-grid">
        ${stats
          .map(
            (stat) => `
              <article class="dataset-analysis-stat">
                <span class="metric-label">${escapeHtml(stat.label)}</span>
                <strong class="dataset-analysis-stat-value">${escapeHtml(stat.value)}</strong>
              </article>
            `
          )
          .join("")}
      </section>
      <section class="dataset-analysis-columns">
        <article class="dataset-analysis-block">
          <p class="panel-kicker">扫描</p>
          <h3>数据集摘要</h3>
          <p><code>${escapeHtml(report.root_path)}</code></p>
          <p>模式：<code>${escapeHtml(report.scan_mode)}</code></p>
          <p>标签扩展名：<code>${escapeHtml(report.caption_extension)}</code></p>
          <p>数据集子目录：<strong>${report.summary.dataset_folder_count}</strong></p>
          <p>透明图候选：<strong>${report.summary.alpha_capable_image_count}</strong></p>
          <p>无标签图片：<strong>${report.summary.images_without_caption_count}</strong></p>
          <p>损坏图片：<strong>${report.summary.broken_image_count}</strong></p>
        </article>
        <article class="dataset-analysis-block">
          <p class="panel-kicker">标签</p>
          <h3>高频标签</h3>
          ${renderNamedCountPills(report.top_tags, "当前还没有统计到标签。")}
        </article>
        <article class="dataset-analysis-block">
          <p class="panel-kicker">图片</p>
          <h3>高频分辨率</h3>
          ${renderNamedCountList(report.top_resolutions, "当前没有分辨率统计数据。")}
        </article>
        <article class="dataset-analysis-block">
          <p class="panel-kicker">分布</p>
          <h3>方向与格式</h3>
          <div>${renderNamedCountList(report.orientation_counts, "当前没有方向统计数据。")}</div>
          <div class="dataset-analysis-sublist">${renderNamedCountList(report.image_extensions, "当前没有图片扩展名统计数据。")}</div>
        </article>
      </section>
      <section class="dataset-analysis-columns">
        <article class="dataset-analysis-block">
          <p class="panel-kicker">目录</p>
          <h3>分目录覆盖情况</h3>
          <div class="dataset-analysis-stack">${folders}</div>
        </article>
        <article class="dataset-analysis-block">
          <p class="panel-kicker">样本</p>
          <h3>路径样本</h3>
          <div class="dataset-analysis-sublist">
            <h4>缺失标签</h4>
            ${renderPathList(report.samples.images_without_caption, "没有缺失标签样本。")}
          </div>
          <div class="dataset-analysis-sublist">
            <h4>孤立标签</h4>
            ${renderPathList(report.samples.orphan_captions, "没有孤立标签样本。")}
          </div>
          <div class="dataset-analysis-sublist">
            <h4>损坏图片</h4>
            ${renderPathList(report.samples.broken_images, "没有损坏图片样本。")}
          </div>
        </article>
      </section>
    `
  );
}

export function renderMaskedLossAuditReport(report: MaskedLossAuditRecord, targetId = "masked-loss-audit-results") {
  const stats = [
    { label: "图片数", value: report.summary.image_count },
    { label: "含 alpha 通道图片", value: report.summary.alpha_channel_image_count },
    { label: "可用蒙版", value: report.summary.usable_mask_image_count },
    { label: "柔性 alpha 蒙版", value: report.summary.soft_alpha_image_count },
    { label: "二值 alpha 蒙版", value: report.summary.binary_alpha_image_count },
    { label: "平均蒙版面积", value: formatPercent(report.summary.average_mask_coverage) },
    { label: "平均 alpha 权重", value: formatPercent(report.summary.average_alpha_weight) },
  ];

  const warningBlock = report.warnings.length
    ? `
      <article class="dataset-analysis-block dataset-analysis-warning">
        <p class="panel-kicker">警告</p>
        <ul class="dataset-analysis-list-plain">
          ${report.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}
        </ul>
      </article>
    `
    : "";

  setHtml(
    targetId,
    `
      ${warningBlock}
      <section class="dataset-analysis-grid">
        ${stats
          .map(
            (stat) => `
              <article class="dataset-analysis-stat">
                <span class="metric-label">${escapeHtml(stat.label)}</span>
                <strong class="dataset-analysis-stat-value">${escapeHtml(stat.value)}</strong>
              </article>
            `
          )
          .join("")}
      </section>
      <section class="dataset-analysis-columns">
        <article class="dataset-analysis-block">
          <p class="panel-kicker">数据集</p>
          <h3>Alpha 蒙版就绪情况</h3>
          <p><code>${escapeHtml(report.root_path)}</code></p>
          <p>递归扫描：<strong>${formatYesNo(report.recursive)}</strong></p>
          <p>无 alpha 通道：<strong>${report.summary.no_alpha_image_count}</strong></p>
          <p>完全不透明 alpha：<strong>${report.summary.fully_opaque_alpha_image_count}</strong></p>
          <p>完全透明图片：<strong>${report.summary.fully_transparent_image_count}</strong></p>
          <p>损坏图片：<strong>${report.summary.broken_image_count}</strong></p>
        </article>
        <article class="dataset-analysis-block">
          <p class="panel-kicker">建议</p>
          <h3>训练建议</h3>
          <ul class="dataset-analysis-list-plain">
            ${report.guidance.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
          </ul>
        </article>
      </section>
      <section class="dataset-analysis-columns">
        <article class="dataset-analysis-block">
          <p class="panel-kicker">样本</p>
          <h3>可用蒙版样本</h3>
          ${renderPathList(report.samples.usable_masks, "没有找到可用的 alpha 蒙版样本。")}
        </article>
        <article class="dataset-analysis-block">
          <p class="panel-kicker">样本</p>
          <h3>柔性 alpha 样本</h3>
          ${renderPathList(report.samples.soft_alpha_masks, "没有找到柔性 alpha 蒙版样本。")}
        </article>
        <article class="dataset-analysis-block">
          <p class="panel-kicker">样本</p>
          <h3>全不透明 alpha 样本</h3>
          ${renderPathList(report.samples.fully_opaque_alpha, "没有找到全不透明 alpha 样本。")}
        </article>
        <article class="dataset-analysis-block">
          <p class="panel-kicker">样本</p>
          <h3>无 alpha 通道样本</h3>
          ${renderPathList(report.samples.no_alpha, "没有采集到无 alpha 通道样本。")}
        </article>
      </section>
    `
  );
}

export function renderCaptionCleanupReport(report: CaptionCleanupRecord, targetId = "caption-cleanup-results") {
  const stats = [
    { label: "标签文件数", value: report.summary.file_count },
    { label: "已变更", value: report.summary.changed_file_count },
    { label: "未变更", value: report.summary.unchanged_file_count },
    { label: "移除标签次数", value: report.summary.removed_tag_instances },
    { label: "新增标签次数", value: report.summary.added_tag_instances },
    { label: "清理后为空", value: report.summary.empty_result_count },
  ];

  const warningBlock = report.warnings.length
    ? `
      <article class="dataset-analysis-block dataset-analysis-warning">
        <p class="panel-kicker">警告</p>
        <ul class="dataset-analysis-list-plain">
          ${report.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}
        </ul>
      </article>
    `
    : "";

  const sampleBlock = report.samples.length
    ? report.samples
        .map(
          (sample) => `
            <article class="dataset-analysis-block">
              <div class="tool-card-head">
                <h3>${escapeHtml(sample.path)}</h3>
                <span class="coverage-pill ${sample.before !== sample.after ? "" : "coverage-pill-muted"}">
                  ${sample.before_count} -> ${sample.after_count}
                </span>
              </div>
              <div class="dataset-cleanup-diff">
                <div>
                  <p class="panel-kicker">清理前</p>
                  <pre>${escapeHtml(sample.before || "（空）")}</pre>
                </div>
                <div>
                  <p class="panel-kicker">清理后</p>
                  <pre>${escapeHtml(sample.after || "（空）")}</pre>
                </div>
              </div>
              <div class="dataset-analysis-sublist">
                <h4>移除标签</h4>
                ${renderPathList(sample.removed_tags, "这个样本里没有明确移除的标签。")}
              </div>
              <div class="dataset-analysis-sublist">
                <h4>新增标签</h4>
                ${renderPathList(sample.added_tags, "这个样本里没有新增标签。")}
              </div>
            </article>
          `
        )
        .join("")
    : "<p>没有采集到样本标签变更。</p>";

  setHtml(
    targetId,
    `
      ${warningBlock}
      <section class="dataset-analysis-grid">
        ${stats
          .map(
            (stat) => `
              <article class="dataset-analysis-stat">
                <span class="metric-label">${escapeHtml(stat.label)}</span>
                <strong class="dataset-analysis-stat-value">${escapeHtml(stat.value)}</strong>
              </article>
            `
          )
          .join("")}
      </section>
      <section class="dataset-analysis-columns">
        <article class="dataset-analysis-block">
          <p class="panel-kicker">${escapeHtml(formatCleanupMode(report.mode))}</p>
          <h3>清理范围</h3>
          <p><code>${escapeHtml(report.root_path)}</code></p>
          <p>标签扩展名：<code>${escapeHtml(report.caption_extension)}</code></p>
          <p>递归扫描：<strong>${formatYesNo(report.recursive)}</strong></p>
          <p>空白规范化：<strong>${formatYesNo(report.options.collapse_whitespace)}</strong></p>
          <p>下划线转空格：<strong>${formatYesNo(report.options.replace_underscore)}</strong></p>
          ${
            report.backup
              ? `<p>自动备份：<code>${escapeHtml(report.backup.archive_name)}</code></p>`
              : ""
          }
        </article>
        <article class="dataset-analysis-block">
          <p class="panel-kicker">规则</p>
          <h3>规则摘要</h3>
          ${renderNamedCountPills(
            [
              report.options.dedupe_tags ? { name: "标签去重", count: 1 } : null,
              report.options.sort_tags ? { name: "标签排序", count: 1 } : null,
              report.options.use_regex ? { name: "正则替换", count: 1 } : null,
            ].filter(Boolean) as NamedCountRecord[],
            "没有启用额外的布尔清理选项。"
          )}
          <div class="dataset-analysis-sublist">
            <h4>移除标签</h4>
            ${renderPathList(report.options.remove_tags, "没有配置要精确移除的标签。")}
          </div>
          <div class="dataset-analysis-sublist">
            <h4>前置标签</h4>
            ${renderPathList(report.options.prepend_tags, "没有配置前置标签。")}
          </div>
          <div class="dataset-analysis-sublist">
            <h4>后置标签</h4>
            ${renderPathList(report.options.append_tags, "没有配置后置标签。")}
          </div>
        </article>
        <article class="dataset-analysis-block">
          <p class="panel-kicker">替换</p>
          <h3>查找与替换</h3>
          <p>查找：<code>${escapeHtml(report.options.search_text || "（无）")}</code></p>
          <p>替换为：<code>${escapeHtml(report.options.replace_text || "（空）")}</code></p>
          <p>模式：<strong>${report.options.use_regex ? "正则" : "字面量"}</strong></p>
          <p>总标签数：<strong>${report.summary.total_tags_before}</strong> -> <strong>${report.summary.total_tags_after}</strong></p>
        </article>
      </section>
      <section class="dataset-analysis-columns">
        <article class="dataset-analysis-block">
          <p class="panel-kicker">样本</p>
          <h3>标签差异预览</h3>
          <div class="dataset-analysis-stack">${sampleBlock}</div>
        </article>
      </section>
    `
  );
}

export function renderCaptionBackupInventory(
  backups: CaptionBackupRecord[],
  selectedArchiveName: string | null,
  targetId = "caption-backup-results"
) {
  if (!backups.length) {
    setHtml(
      targetId,
      `
        <article class="dataset-analysis-block">
          <p class="panel-kicker">快照</p>
          <h3>没有找到标签快照</h3>
          <p>可以先为这个目录创建第一个快照，作为批量清理或打标前的恢复点。</p>
        </article>
      `
    );
    return;
  }

  const items = backups
    .map(
      (backup) => `
        <article class="dataset-analysis-block ${backup.archive_name === selectedArchiveName ? "dataset-analysis-selected" : ""}">
          <div class="tool-card-head">
            <h3>${escapeHtml(backup.snapshot_name)}</h3>
            <span class="coverage-pill ${backup.archive_name === selectedArchiveName ? "" : "coverage-pill-muted"}">
              ${escapeHtml(backup.archive_name)}
            </span>
          </div>
          <p><code>${escapeHtml(backup.source_root)}</code></p>
          <p>创建时间：<strong>${escapeHtml(backup.created_at || "未知")}</strong></p>
          <p>标签文件数：<strong>${backup.file_count}</strong> · 压缩包大小：<strong>${formatBytes(backup.archive_size)}</strong></p>
          <p>扩展名：<code>${escapeHtml(backup.caption_extension || ".txt")}</code> · 递归：<strong>${formatYesNo(backup.recursive)}</strong></p>
        </article>
      `
    )
    .join("");

  setHtml(targetId, `<div class="dataset-analysis-stack">${items}</div>`);
}

export function renderCaptionBackupRestoreReport(
  report: CaptionBackupRestoreRecord,
  targetId = "caption-backup-results"
) {
  const warningBlock = report.warnings.length
    ? `
      <article class="dataset-analysis-block dataset-analysis-warning">
        <p class="panel-kicker">警告</p>
        <ul class="dataset-analysis-list-plain">
          ${report.warnings.map((warning) => `<li>${escapeHtml(warning)}</li>`).join("")}
        </ul>
      </article>
    `
    : "";

  setHtml(
    targetId,
    `
      ${warningBlock}
      <section class="dataset-analysis-grid">
        <article class="dataset-analysis-stat">
          <span class="metric-label">已恢复文件</span>
          <strong class="dataset-analysis-stat-value">${report.restored_file_count}</strong>
        </article>
        <article class="dataset-analysis-stat">
          <span class="metric-label">已覆盖</span>
          <strong class="dataset-analysis-stat-value">${report.overwritten_file_count}</strong>
        </article>
        <article class="dataset-analysis-stat">
          <span class="metric-label">新建</span>
          <strong class="dataset-analysis-stat-value">${report.created_file_count}</strong>
        </article>
      </section>
      <section class="dataset-analysis-columns">
        <article class="dataset-analysis-block">
          <p class="panel-kicker">恢复</p>
          <h3>${escapeHtml(report.snapshot_name)}</h3>
          <p><code>${escapeHtml(report.source_root)}</code></p>
          <p>压缩包：<code>${escapeHtml(report.archive_name)}</code></p>
        </article>
        <article class="dataset-analysis-block">
          <p class="panel-kicker">安全备份</p>
          <h3>恢复前备份</h3>
          ${
            report.pre_restore_backup
              ? `<p>已在恢复前创建 <code>${escapeHtml(report.pre_restore_backup.archive_name)}</code>。</p>`
              : "<p>这次恢复操作没有创建恢复前备份。</p>"
          }
        </article>
      </section>
    `
  );
}

function renderNamedCountPills(items: NamedCountRecord[], emptyText: string) {
  if (!items.length) {
    return `<p>${escapeHtml(emptyText)}</p>`;
  }

  return `
    <div class="coverage-list">
      ${items
        .map((item) => `<span class="coverage-pill">${escapeHtml(item.name)} <strong>${item.count}</strong></span>`)
        .join("")}
    </div>
  `;
}

function renderNamedCountList(items: NamedCountRecord[], emptyText: string) {
  if (!items.length) {
    return `<p>${escapeHtml(emptyText)}</p>`;
  }

  return `
    <ul class="dataset-analysis-list-plain">
      ${items
        .map((item) => `<li><code>${escapeHtml(item.name)}</code> <strong>${item.count}</strong></li>`)
        .join("")}
    </ul>
  `;
}

function renderPathList(items: string[], emptyText: string) {
  if (!items.length) {
    return `<p>${escapeHtml(emptyText)}</p>`;
  }

  return `
    <ul class="dataset-analysis-list-plain">
      ${items.map((item) => `<li><code>${escapeHtml(item)}</code></li>`).join("")}
    </ul>
  `;
}

function formatPercent(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function formatYesNo(value: boolean) {
  return value ? "是" : "否";
}

function formatCleanupMode(value: string) {
  if (value === "preview") {
    return "预览";
  }
  if (value === "apply") {
    return "应用";
  }
  return value;
}

function formatScriptCategory(value: string) {
  const labels: Record<string, string> = {
    networks: "训练",
    tagging: "打标",
    tagger: "打标",
    tools: "工具",
    utility: "工具",
    dataset: "数据集",
    captions: "标签文本",
    caption: "标签文本",
    preprocess: "预处理",
  };

  return labels[value] ?? value;
}

function formatBytes(value: number) {
  if (value < 1024) {
    return `${value} B`;
  }
  if (value < 1024 ** 2) {
    return `${(value / 1024).toFixed(1)} KB`;
  }
  if (value < 1024 ** 3) {
    return `${(value / 1024 ** 2).toFixed(1)} MB`;
  }
  return `${(value / 1024 ** 3).toFixed(2)} GB`;
}
