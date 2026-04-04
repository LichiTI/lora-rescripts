const POLL_INTERVAL_MS = 1200;
const LOG_LIMIT = 1200;

const state = {
  runtime: null,
  status: null,
  results: null,
  lastLogId: 0,
  logLines: [],
  outputDir: "",
  pollTimer: null,
  currentPage: 1,
};

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function apiGet(url) {
  const response = await fetch(url, { cache: "no-store" });
  return response.json();
}

async function apiPost(url, body = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json();
}

function normalizePathSeparator(path) {
  return String(path || "").includes("\\") ? "\\" : "/";
}

function guessOutputDirFromCheckpoint(checkpoint) {
  const value = String(checkpoint || "").trim();
  if (!value) {
    return "";
  }
  const separator = normalizePathSeparator(value);
  const index = Math.max(value.lastIndexOf("\\"), value.lastIndexOf("/"));
  if (index < 0) {
    return "";
  }
  return `${value.slice(0, index)}${separator}infer_run`;
}

function guessOrganizeRootDir(outputDir) {
  const value = String(outputDir || "").trim();
  if (!value) {
    return "";
  }
  const separator = normalizePathSeparator(value);
  return value.endsWith(separator) ? `${value}organized` : `${value}${separator}organized`;
}

function serializeForm() {
  return {
    checkpoint: $("checkpoint").value.trim(),
    input_dir: $("input-dir").value.trim(),
    output_dir: $("output-dir").value.trim(),
    device: $("device").value,
    batch_size: Number($("batch-size").value || 8),
    special_threshold: Number($("special-threshold").value || 0.5),
    recursive: $("recursive").checked,
    save_jsonl: $("save-jsonl").checked,
    save_csv: $("save-csv").checked,
    organize_enabled: $("organize-enabled").checked,
    organize_root_dir: $("organize-root-dir").value.trim(),
    organize_mode: $("organize-mode").value,
    organize_include_special_group: $("organize-include-special-group").checked,
    organize_dimensions: $("organize-dimensions").value.trim(),
    image_extensions: $("image-extensions").value.trim(),
  };
}

function applyTaskParams(params) {
  if (!params) {
    return;
  }
  $("checkpoint").value = params.checkpoint || $("checkpoint").value;
  $("input-dir").value = params.input_dir || $("input-dir").value;
  $("output-dir").value = params.output_dir || $("output-dir").value;
  $("device").value = params.device || "";
  $("batch-size").value = params.batch_size ?? $("batch-size").value;
  $("special-threshold").value = params.special_threshold ?? $("special-threshold").value;
  $("recursive").checked = Boolean(params.recursive);
  $("save-jsonl").checked = Boolean(params.save_jsonl);
  $("save-csv").checked = Boolean(params.save_csv);
  $("organize-enabled").checked = Boolean(params.organize_enabled);
  $("organize-root-dir").value = params.organize_root_dir || $("organize-root-dir").value;
  $("organize-mode").value = params.organize_mode || $("organize-mode").value;
  $("organize-include-special-group").checked = Boolean(params.organize_include_special_group);
  $("organize-dimensions").value = Array.isArray(params.organize_dimensions)
    ? params.organize_dimensions.join(",")
    : (params.organize_dimensions || $("organize-dimensions").value);
  $("image-extensions").value = Array.isArray(params.image_extensions)
    ? params.image_extensions.join(",")
    : (params.image_extensions || $("image-extensions").value);
}

function updateActionState() {
  const dependenciesReady = Boolean(state.runtime?.dependencies?.ready);
  const running = Boolean(state.status?.running);
  $("start-button").disabled = !dependenciesReady || running;
  $("stop-button").disabled = !running;
}

function renderRuntimeStatus(payload) {
  state.runtime = payload || {};
  const box = $("runtime-status");
  const dependencies = state.runtime.dependencies || {};
  const missing = Array.isArray(dependencies.missing) ? dependencies.missing : [];
  const task = state.runtime.task || null;
  const lines = [];
  if (dependencies.ready) {
    box.classList.remove("warn");
    lines.push("美学推理依赖: 已就绪");
  } else {
    box.classList.add("warn");
    lines.push("美学推理依赖: 缺失");
    lines.push(`缺失项: ${missing.map((item) => item.display_name || item.module_name).join(", ")}`);
  }
  if (task) {
    lines.push(`最近任务状态: ${task.status || "unknown"}`);
  }
  lines.push("支持功能: 批量推理、结果浏览、按分数整理目录");
  box.textContent = lines.join("\n");
  updateActionState();
}

function renderTaskStatus(payload) {
  state.status = payload || {};
  const task = state.status.task || null;
  const box = $("task-status");
  if (!task) {
    box.textContent = "当前没有运行中的任务。";
    updateActionState();
    return;
  }

  applyTaskParams(task.params);
  state.outputDir = task?.params?.output_dir || state.outputDir;
  const lines = [
    `任务 ID: ${task.task_id || ""}`,
    `状态: ${task.status || "unknown"}`,
    `PID: ${task.pid || "-"}`,
    `输出目录: ${task?.params?.output_dir || "-"}`,
    `开始时间: ${task.started_at || "-"}`,
    `结束时间: ${task.finished_at || "-"}`,
    `返回码: ${task.return_code ?? "-"}`,
  ];
  if (task.summary_path) {
    lines.push(`summary.json: ${task.summary_path}`);
  }
  box.textContent = lines.join("\n");
  updateActionState();
}

function appendLogs(items) {
  if (!Array.isArray(items) || items.length === 0) {
    return;
  }
  for (const item of items) {
    const text = `[${item.time}] ${item.text}`;
    state.logLines.push(text);
  }
  if (state.logLines.length > LOG_LIMIT) {
    state.logLines = state.logLines.slice(-LOG_LIMIT);
  }
  $("task-logs").textContent = state.logLines.length > 0 ? state.logLines.join("\n") : "等待日志输出...";
  $("task-logs").scrollTop = $("task-logs").scrollHeight;
}

function clearLogsView() {
  state.logLines = [];
  $("task-logs").textContent = "等待日志输出...";
}

function renderResultsSummary(data) {
  const summary = data.summary || {};
  const html = `
    <div class="summary-grid">
      <div class="summary-item">
        <div class="label">总记录数</div>
        <div class="value">${escapeHtml(summary.total_records ?? data.records_count ?? 0)}</div>
      </div>
      <div class="summary-item">
        <div class="label">成功推理</div>
        <div class="value">${escapeHtml(summary.inferred_records ?? 0)}</div>
      </div>
      <div class="summary-item">
        <div class="label">特殊样本</div>
        <div class="value">${escapeHtml(summary.special_records ?? data.special_count ?? 0)}</div>
      </div>
      <div class="summary-item">
        <div class="label">分类头</div>
        <div class="value">${summary.has_cls_head ? "已启用" : "缺失"}</div>
      </div>
    </div>
    <div class="status-box">输出目录: ${escapeHtml(data.output_dir || "-")}
预测文件: ${escapeHtml(data.prediction_file || "-")}
分页: 第 ${escapeHtml(data.page || 0)} / ${escapeHtml(data.pages || 0)} 页，共 ${escapeHtml(data.total || 0)} 条匹配结果</div>
  `;
  $("results-summary").className = "status-box";
  $("results-summary").innerHTML = html;
  $("download-actions").style.display = "flex";
}

function renderGallery(items) {
  const gallery = $("result-gallery");
  if (!Array.isArray(items) || items.length === 0) {
    gallery.innerHTML = '<div class="empty-block" style="grid-column: 1 / -1;">当前筛选条件下没有结果。</div>';
    return;
  }

  gallery.innerHTML = items
    .map((item) => {
      const badges = [];
      if (Number(item.special_tag || 0) === 1) {
        badges.push('<span class="badge special">special</span>');
      } else {
        badges.push('<span class="badge ok">in_domain</span>');
      }
      if (item.in_domain_prob != null) {
        badges.push(`<span class="badge">域内概率 ${Number(item.in_domain_prob).toFixed(3)}</span>`);
      }

      const scoreRows = Array.isArray(item.score_heads)
        ? item.score_heads
            .map((scoreHead) => {
              const score = scoreHead.score == null ? "-" : Number(scoreHead.score).toFixed(3);
              const bucket = scoreHead.bucket == null ? "-" : scoreHead.bucket;
              return `<div class="score-row"><span>${escapeHtml(scoreHead.name)}</span><span>${score} / 桶 ${escapeHtml(bucket)}</span></div>`;
            })
            .join("")
        : "";

      const image = item.error
        ? '<div class="gallery-empty">图片读取失败</div>'
        : `<img src="${escapeHtml(item.image_url || "")}" loading="lazy" alt="${escapeHtml(item.relative_path || item.image_path || "")}">`;

      return `
        <article class="gallery-card">
          <div class="gallery-image-wrap">${image}</div>
          <div class="gallery-body">
            <div class="path-line">${escapeHtml(item.relative_path || item.image_path || "")}</div>
            <div class="badge-row">${badges.join("")}</div>
            <div class="score-list">${scoreRows}</div>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderResults(data) {
  state.results = data || null;
  if (!data) {
    $("results-summary").className = "empty-block";
    $("results-summary").textContent = "当前还没有可读取的结果。";
    $("download-actions").style.display = "none";
    $("result-gallery").innerHTML = "";
    $("page-indicator").textContent = "第 0 / 0 页";
    return;
  }

  renderResultsSummary(data);
  renderGallery(data.items || []);
  $("page-indicator").textContent = `第 ${data.page || 0} / ${data.pages || 0} 页`;
}

async function refreshRuntime() {
  const response = await apiGet("/api/aesthetic_infer/runtime_status");
  if (response.status !== "success") {
    throw new Error(response.message || "读取运行状态失败。");
  }
  renderRuntimeStatus(response.data || {});
}

async function refreshStatus() {
  const response = await apiGet("/api/aesthetic_infer/status");
  if (response.status !== "success") {
    throw new Error(response.message || "读取任务状态失败。");
  }
  renderTaskStatus(response.data || {});
}

async function refreshLogs() {
  const response = await apiGet(`/api/aesthetic_infer/logs?since_id=${encodeURIComponent(state.lastLogId)}&limit=300`);
  if (response.status !== "success") {
    throw new Error(response.message || "读取日志失败。");
  }
  const data = response.data || {};
  appendLogs(data.items || []);
  state.lastLogId = Number(data.last_id || state.lastLogId || 0);
}

async function loadResults(page = state.currentPage || 1) {
  const outputDir = $("output-dir").value.trim() || state.outputDir;
  if (!outputDir) {
    renderResults(null);
    return;
  }
  state.outputDir = outputDir;
  state.currentPage = Math.max(1, Number(page || 1));
  const params = new URLSearchParams({
    output_dir: outputDir,
    page: String(state.currentPage),
    page_size: "24",
    q: $("result-keyword").value.trim(),
    special_filter: $("result-special-filter").value,
    sort_by: $("result-sort-by").value,
    sort_order: $("result-sort-order").value,
  });
  const response = await apiGet(`/api/aesthetic_infer/results?${params.toString()}`);
  if (response.status !== "success") {
    renderResults(null);
    $("results-summary").className = "empty-block";
    $("results-summary").textContent = response.message || "读取结果失败。";
    return;
  }
  renderResults(response.data || {});
}

async function pickPath(type) {
  const response = await apiGet(`/api/pick_file?picker_type=${encodeURIComponent(type)}`);
  if (response.status === "success") {
    return response.data?.path || "";
  }
  if (response.message === "用户取消选择") {
    return "";
  }
  throw new Error(response.message || "路径选择失败。");
}

async function handleStart() {
  const payload = serializeForm();
  if (!payload.output_dir && payload.checkpoint) {
    payload.output_dir = guessOutputDirFromCheckpoint(payload.checkpoint);
    $("output-dir").value = payload.output_dir;
  }
  if (!payload.organize_root_dir && payload.output_dir) {
    payload.organize_root_dir = guessOrganizeRootDir(payload.output_dir);
    $("organize-root-dir").value = payload.organize_root_dir;
  }

  const response = await apiPost("/api/aesthetic_infer/start", payload);
  if (response.status !== "success") {
    throw new Error(response.message || "启动推理失败。");
  }
  state.lastLogId = 0;
  clearLogsView();
  state.outputDir = response.data?.params?.output_dir || payload.output_dir || state.outputDir;
  await refreshStatus();
}

async function handleStop() {
  const response = await apiPost("/api/aesthetic_infer/stop", {});
  if (response.status !== "success") {
    throw new Error(response.message || "停止推理失败。");
  }
  await refreshStatus();
}

function openResultFile(kind) {
  const outputDir = $("output-dir").value.trim() || state.outputDir;
  if (!outputDir) {
    window.alert("当前没有可用的输出目录。");
    return;
  }
  const url = `/api/aesthetic_infer/file?output_dir=${encodeURIComponent(outputDir)}&kind=${encodeURIComponent(kind)}`;
  window.open(url, "_blank", "noopener");
}

async function refreshAll() {
  await refreshRuntime();
  await refreshStatus();
  await refreshLogs();
  const running = Boolean(state.status?.running);
  if (!running) {
    await loadResults(state.currentPage || 1);
  }
}

async function pollLoop() {
  window.clearTimeout(state.pollTimer);
  try {
    await refreshAll();
  } catch (error) {
    window.console.error(error);
  } finally {
    state.pollTimer = window.setTimeout(pollLoop, POLL_INTERVAL_MS);
  }
}

function bindEvents() {
  $("browse-checkpoint").addEventListener("click", async () => {
    const path = await pickPath("model-file");
    if (!path) {
      return;
    }
    $("checkpoint").value = path;
    if (!$("output-dir").value.trim()) {
      $("output-dir").value = guessOutputDirFromCheckpoint(path);
    }
  });

  $("browse-input-dir").addEventListener("click", async () => {
    const path = await pickPath("folder");
    if (path) {
      $("input-dir").value = path;
    }
  });

  $("browse-output-dir").addEventListener("click", async () => {
    const path = await pickPath("folder");
    if (path) {
      $("output-dir").value = path;
      if (!$("organize-root-dir").value.trim()) {
        $("organize-root-dir").value = guessOrganizeRootDir(path);
      }
    }
  });

  $("browse-organize-root-dir").addEventListener("click", async () => {
    const path = await pickPath("folder");
    if (path) {
      $("organize-root-dir").value = path;
    }
  });

  $("start-button").addEventListener("click", async () => {
    try {
      await handleStart();
    } catch (error) {
      window.alert(String(error?.message || error));
    }
  });

  $("stop-button").addEventListener("click", async () => {
    try {
      await handleStop();
    } catch (error) {
      window.alert(String(error?.message || error));
    }
  });

  $("refresh-button").addEventListener("click", async () => {
    try {
      await refreshAll();
    } catch (error) {
      window.alert(String(error?.message || error));
    }
  });

  $("load-results-button").addEventListener("click", async () => {
    state.currentPage = 1;
    await loadResults(1);
  });

  $("search-results-button").addEventListener("click", async () => {
    state.currentPage = 1;
    await loadResults(1);
  });

  $("prev-page-button").addEventListener("click", async () => {
    const current = Number(state.results?.page || state.currentPage || 1);
    if (current <= 1) {
      return;
    }
    await loadResults(current - 1);
  });

  $("next-page-button").addEventListener("click", async () => {
    const current = Number(state.results?.page || state.currentPage || 1);
    const pages = Number(state.results?.pages || 0);
    if (pages === 0 || current >= pages) {
      return;
    }
    await loadResults(current + 1);
  });

  $("clear-logs-button").addEventListener("click", () => {
    clearLogsView();
  });

  $("download-summary").addEventListener("click", () => openResultFile("summary"));
  $("download-jsonl").addEventListener("click", () => openResultFile("jsonl"));
  $("download-csv").addEventListener("click", () => openResultFile("csv"));
}

async function boot() {
  bindEvents();
  updateActionState();
  await refreshAll();
  pollLoop();
}

boot().catch((error) => {
  window.console.error(error);
  $("runtime-status").classList.add("warn");
  $("runtime-status").textContent = String(error?.message || error);
});
