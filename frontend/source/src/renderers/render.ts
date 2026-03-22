export function createAppShell(activeRouteHash: string, pageContent: string) {
  return `
    <div class="app-shell">
      <aside class="app-sidebar">
        <div class="brand-lockup">
          <p class="eyebrow">SD-reScripts</p>
          <h1>Frontend Source</h1>
          <p class="sidebar-copy">
            A migration workspace that lets us rebuild the UI near the core logic without touching the shipped dist yet.
          </p>
        </div>
        <nav id="side-nav" class="side-nav" aria-label="Source workspace routes"></nav>
      </aside>
      <main class="app-main">
        ${pageContent}
      </main>
    </div>
  `;
}

export function createPageHero(kicker: string, title: string, lede: string) {
  return `
    <section class="page-hero panel">
      <p class="eyebrow">${kicker}</p>
      <h2>${title}</h2>
      <p class="lede">${lede}</p>
    </section>
  `;
}

export function createInfoCard(title: string, body: string, kicker = "module") {
  return `
    <article class="panel info-card">
      <p class="panel-kicker">${kicker}</p>
      <h3>${title}</h3>
      <div>${body}</div>
    </article>
  `;
}
