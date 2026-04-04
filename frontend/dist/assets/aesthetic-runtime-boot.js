import { mountAestheticRuntimeWidget } from "/assets/aesthetic-runtime-widget.js";

const TARGET_PATH_RE = /\/other-models\/aesthetic-scorer(?:\.html)?\/?$/;
const ROUTE_EVENT = "lulynx:aesthetic-runtime-route-change";

let cleanupCurrentMount = null;
let routeTimer = null;
let hooksInstalled = false;

function normalizePath(pathname) {
  return String(pathname || "").replace(/\/+$/, "");
}

function isTargetRoute() {
  return TARGET_PATH_RE.test(normalizePath(window.location.pathname));
}

function clearMountedWidget() {
  if (typeof cleanupCurrentMount === "function") {
    cleanupCurrentMount();
  }
  cleanupCurrentMount = null;
}

function syncRoute() {
  if (!isTargetRoute()) {
    clearMountedWidget();
    return;
  }

  if (cleanupCurrentMount) {
    return;
  }

  cleanupCurrentMount = mountAestheticRuntimeWidget();
}

function queueSync() {
  if (routeTimer) {
    clearTimeout(routeTimer);
  }
  routeTimer = window.setTimeout(syncRoute, 60);
}

function emitRouteEvent() {
  window.dispatchEvent(new Event(ROUTE_EVENT));
}

function patchHistoryMethod(methodName) {
  const original = window.history[methodName];
  if (typeof original !== "function") {
    return;
  }

  window.history[methodName] = function patchedHistoryMethod(...args) {
    const result = original.apply(this, args);
    emitRouteEvent();
    return result;
  };
}

function installRouteHooks() {
  if (hooksInstalled) {
    return;
  }
  hooksInstalled = true;

  patchHistoryMethod("pushState");
  patchHistoryMethod("replaceState");

  window.addEventListener("popstate", queueSync);
  window.addEventListener(ROUTE_EVENT, queueSync);
  window.addEventListener("pageshow", queueSync);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      queueSync();
    }
  });
}

installRouteHooks();
queueSync();
