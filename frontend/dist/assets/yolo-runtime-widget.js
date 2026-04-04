const STYLE_ID = "yolo-runtime-widget-style";
const ROOT_ID = "yolo-runtime-widget-root";
const OVERLAY_ID = "yolo-runtime-restart-overlay";
const POLL_INTERVAL_MS = 1200;

let cleanupCurrentWidget = null;

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
#${ROOT_ID} {
  margin: 0 20px 16px 20px;
  border: 1px solid #d9e3f0;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 10px 28px rgba(64, 158, 255, 0.08);
}
#${ROOT_ID} .yolo-runtime-card {
  padding: 16px;
}
#${ROOT_ID} .yolo-runtime-title {
  font-size: 16px;
  font-weight: 600;
  color: #213547;
  margin-bottom: 6px;
}
#${ROOT_ID} .yolo-runtime-desc {
  font-size: 13px;
  color: #5f6b7a;
  margin-bottom: 12px;
  line-height: 1.6;
}
#${ROOT_ID} .yolo-runtime-summary {
  font-size: 13px;
  color: #213547;
  white-space: pre-wrap;
  line-height: 1.6;
  margin-bottom: 12px;
}
#${ROOT_ID} .yolo-runtime-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
#${ROOT_ID} .yolo-runtime-actions button {
  border: 1px solid #409eff;
  background: #409eff;
  color: #ffffff;
  border-radius: 8px;
  padding: 8px 14px;
  font-size: 13px;
  cursor: pointer;
}
#${ROOT_ID} .yolo-runtime-actions button.secondary {
  background: #ffffff;
  color: #409eff;
}
#${ROOT_ID} .yolo-runtime-actions button[disabled] {
  opacity: 0.55;
  cursor: not-allowed;
}
#${ROOT_ID} .yolo-runtime-log {
  background: #0f172a;
  color: #cbd5e1;
  border-radius: 10px;
  padding: 12px;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  max-height: 240px;
  overflow: auto;
  margin: 0;
}
#${OVERLAY_ID} {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.76);
  z-index: 99999;
  display: grid;
  place-items: center;
  padding: 24px;
}
#${OVERLAY_ID} .yolo-runtime-overlay-card {
  width: min(520px, 100%);
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid #d9e3f0;
  box-shadow: 0 14px 40px rgba(15, 23, 42, 0.2);
  padding: 24px;
}
#${OVERLAY_ID} .yolo-runtime-overlay-title {
  font-size: 22px;
  font-weight: 600;
  color: #213547;
  margin-bottom: 10px;
}
#${OVERLAY_ID} .yolo-runtime-overlay-desc {
  font-size: 14px;
  color: #5f6b7a;
  line-height: 1.7;
  white-space: pre-wrap;
}
`;
  document.head.appendChild(style);
}

function apiGet(url) {
  return fetch(url, { cache: "no-store" }).then((res) => res.json());
}

function apiPost(url, body = {}) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((res) => res.json());
}

function findMountTarget() {
  const rightContainer = document.querySelector(".example-container .right-container");
  if (!rightContainer) {
    return null;
  }

  const outputSection = rightContainer.querySelector(".params-section");
  return outputSection || rightContainer.firstElementChild || rightContainer;
}

function removeOverlay() {
  const overlay = document.getElementById(OVERLAY_ID);
  if (overlay) {
    overlay.remove();
  }
}

function showRestartOverlay(initialText) {
  removeOverlay();

  const overlay = document.createElement("div");
  overlay.id = OVERLAY_ID;
  overlay.innerHTML = `
    <div class="yolo-runtime-overlay-card">
      <div class="yolo-runtime-overlay-title">后端重启中</div>
      <div class="yolo-runtime-overlay-desc">${initialText || "正在请求重启后端，请稍候。"}</div>
    </div>
  `;
  document.body.appendChild(overlay);
  return overlay;
}

function formatSummary(payload) {
  const lines = [];
  const dependencies = payload?.dependencies || {};
  const install = payload?.install || {};
  const missing = Array.isArray(dependencies.missing) ? dependencies.missing : [];
  const repoExists = Boolean(payload?.repo_exists);

  lines.push(`本地 Ultralytics 仓库: ${repoExists ? "已检测到" : "缺失"}`);
  if (missing.length === 0) {
    lines.push("运行依赖状态: 已就绪");
  } else {
    lines.push("运行依赖状态: 缺失");
    lines.push(`缺失依赖: ${missing.map((item) => item.display_name).join(", ")}`);
  }

  if (install.detail) {
    lines.push(`当前状态: ${install.detail}`);
  }

  return lines.join("\n");
}

function formatLogs(payload) {
  const logs = Array.isArray(payload?.install?.logs) ? payload.install.logs : [];
  if (logs.length === 0) {
    return "当前还没有安装日志。";
  }
  return logs.join("\n");
}

function renderWidgetState(root, payload, actions) {
  const install = payload?.install || {};
  const dependencies = payload?.dependencies || {};
  const missing = Array.isArray(dependencies.missing) ? dependencies.missing : [];
  const missingRequirements = Array.isArray(payload?.missing_requirements) ? payload.missing_requirements : [];
  const running = install.status === "running";
  const ready = Boolean(dependencies.ready);
  const allowInstall = !ready && !running && missingRequirements.length > 0;
  const allowRestart = Boolean(install.restart_required);

  root.querySelector(".yolo-runtime-summary").textContent = formatSummary(payload);
  root.querySelector(".yolo-runtime-log").textContent = formatLogs(payload);

  const installButton = root.querySelector("[data-role='install']");
  const restartButton = root.querySelector("[data-role='restart']");
  const refreshButton = root.querySelector("[data-role='refresh']");

  installButton.disabled = !allowInstall;
  installButton.textContent = running ? "依赖安装中..." : ready ? "依赖已就绪" : "安装依赖";

  restartButton.disabled = !allowRestart;
  restartButton.style.display = allowRestart ? "inline-block" : "none";

  refreshButton.disabled = running;

  installButton.onclick = actions.install;
  restartButton.onclick = actions.restart;
  refreshButton.onclick = actions.refresh;
}

function createWidgetShell() {
  const root = document.createElement("section");
  root.id = ROOT_ID;
  root.innerHTML = `
    <div class="yolo-runtime-card">
      <div class="yolo-runtime-title">YOLO 运行依赖</div>
      <div class="yolo-runtime-desc">这里可以直接安装当前运行环境缺失的 YOLO 依赖。安装完成后，重启后端以重新加载新模块。</div>
      <div class="yolo-runtime-summary">正在读取 YOLO 运行状态...</div>
      <div class="yolo-runtime-actions">
        <button type="button" data-role="install">安装依赖</button>
        <button type="button" class="secondary" data-role="restart" style="display:none;">重启后端</button>
        <button type="button" class="secondary" data-role="refresh">刷新状态</button>
      </div>
      <pre class="yolo-runtime-log">正在读取安装日志...</pre>
    </div>
  `;
  return root;
}

export function mountYoloRuntimeWidget(options = {}) {
  if (cleanupCurrentWidget) {
    cleanupCurrentWidget();
    cleanupCurrentWidget = null;
  }

  ensureStyle();
  removeOverlay();

  let disposed = false;
  let pollTimer = null;
  let attachTimer = null;
  let root = null;

  const stopPolling = () => {
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
  };

  const stopAttachTimer = () => {
    if (attachTimer) {
      clearInterval(attachTimer);
      attachTimer = null;
    }
  };

  const fetchRuntimeStatus = async () => {
    const response = await apiGet("/api/yolo/runtime_status");
    if (response.status !== "success") {
      throw new Error(response.message || "读取 YOLO 运行状态失败。");
    }
    return response.data || {};
  };

  const schedulePoll = () => {
    stopPolling();
    if (!disposed) {
      pollTimer = setTimeout(refreshWidget, POLL_INTERVAL_MS);
    }
  };

  const refreshWidget = async () => {
    if (disposed || !root) {
      return;
    }

    try {
      const payload = await fetchRuntimeStatus();
      renderWidgetState(root, payload, {
        install: handleInstall,
        restart: handleRestart,
        refresh: refreshWidget,
      });
    } catch (error) {
      root.querySelector(".yolo-runtime-summary").textContent = String(error);
    } finally {
      schedulePoll();
    }
  };

  const handleInstall = async () => {
    try {
      const response = await apiPost("/api/yolo/install_dependencies");
      if (response.status !== "success") {
        throw new Error(response.message || "YOLO 依赖安装任务启动失败。");
      }
      await refreshWidget();
    } catch (error) {
      window.console.error(error);
      alert(String(error?.message || error));
    }
  };

  const waitForBackendReady = async (overlay) => {
    if (disposed) {
      return;
    }

    try {
      const response = await apiGet("/api/backend/status");
      if (response.status === "success") {
        const payload = response.data || {};
        const detailNode = overlay.querySelector(".yolo-runtime-overlay-desc");
        if (detailNode) {
          detailNode.textContent = payload.detail || "正在等待后端重启完成。";
        }
        if (payload.status === "ready") {
          window.location.reload();
          return;
        }
      }
    } catch (_error) {
      const detailNode = overlay.querySelector(".yolo-runtime-overlay-desc");
      if (detailNode) {
        detailNode.textContent = "正在等待后端重新上线...";
      }
    }

    window.setTimeout(() => {
      waitForBackendReady(overlay);
    }, POLL_INTERVAL_MS);
  };

  const handleRestart = async () => {
    const overlay = showRestartOverlay("正在请求重启后端，请稍候。");
    try {
      const response = await apiPost("/api/backend/restart");
      if (response.status !== "success") {
        throw new Error(response.message || "后端重启请求失败。");
      }
      const detailNode = overlay.querySelector(".yolo-runtime-overlay-desc");
      if (detailNode) {
        detailNode.textContent = "后端已收到重启请求，正在等待服务重新上线...";
      }
      waitForBackendReady(overlay);
    } catch (error) {
      removeOverlay();
      window.console.error(error);
      alert(String(error?.message || error));
    }
  };

  const tryAttach = () => {
    if (disposed) {
      return true;
    }

    const target = findMountTarget();
    if (!target) {
      return false;
    }

    root = createWidgetShell();
    target.parentNode.insertBefore(root, target);
    refreshWidget();
    return true;
  };

  if (!tryAttach()) {
    attachTimer = setInterval(() => {
      if (tryAttach()) {
        stopAttachTimer();
      }
    }, 300);
  }

  cleanupCurrentWidget = () => {
    disposed = true;
    stopPolling();
    stopAttachTimer();
    removeOverlay();
    if (root && root.parentNode) {
      root.parentNode.removeChild(root);
    }
    root = null;
  };

  return cleanupCurrentWidget;
}
