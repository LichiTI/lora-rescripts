import "./styles.css";
import { renderApp } from "./app";

const appRoot = document.querySelector("#app");

if (!(appRoot instanceof HTMLElement)) {
  throw new Error("App root not found.");
}

const rootElement: HTMLElement = appRoot;

async function boot() {
  await renderApp(rootElement);
}

window.addEventListener("hashchange", () => {
  void boot();
});

void boot();
