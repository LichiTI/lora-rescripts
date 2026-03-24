export function createAppShell(activeRouteHash: string, pageContent: string) {
  return `
    <div class="theme-container no-navbar route-shell" data-route="${activeRouteHash}">
      <div class="sidebar-mask"></div>
      <aside class="sidebar">
        <div class="sidebar-scroll">
          <div class="brand-lockup">
            <p class="brand-title">SD-reScripts</p>
            <p class="brand-subtitle">Stable Diffusion 训练界面</p>
            <p class="sidebar-copy">
              基于秋葉 aaaki / lora-scripts 分支继续维护
            </p>
          </div>
          <nav id="side-nav" class="side-nav" aria-label="主导航"></nav>
          <div class="sidebar-bottom">
            <a class="sidebar-meta-link" href="https://github.com/WhitecrowAurora/lora-rescripts" target="_blank" rel="noreferrer">
              GitHub / WhitecrowAurora
            </a>
            <p class="sidebar-meta-note">
              修改维护
              <a class="sidebar-meta-link inline" href="https://github.com/WhitecrowAurora/lora-rescripts" target="_blank" rel="noreferrer">
                Lulynx
              </a>
            </p>
          </div>
        </div>
      </aside>
      <main class="page">
        <div class="theme-default-content">
          ${pageContent}
        </div>
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

export function createInfoCard(title: string, body: string, kicker = "模块") {
  return `
    <article class="panel info-card">
      <p class="panel-kicker">${kicker}</p>
      <h3>${title}</h3>
      <div>${body}</div>
    </article>
  `;
}
