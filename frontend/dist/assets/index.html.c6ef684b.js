import { _ as p, o as e, c, a as s, b as n, e as r } from "./app.547295de.js";

var t = "/assets/icon.65fd68ba.webp";

const B = {};
const i = { align: "center" };
const y = s(
  "h1",
  { id: "sd-rescripts", tabindex: "-1" },
  [
    s("a", { class: "header-anchor", href: "#sd-rescripts", "aria-hidden": "true" }, "#"),
    n(" SD-reScripts"),
  ],
  -1
);
const C = s(
  "img",
  {
    src: t,
    width: "200",
    height: "200",
    alt: "SD-reScripts",
    style: { margin: "20px", "border-radius": "25px" },
  },
  null,
  -1
);
const E = s("p", null, "v1.3.8", -1);
const h = r(
  `<p align="center"><strong>Fork from</strong> 秋葉 <a href="https://github.com/Akegarasu/lora-scripts" target="_blank" rel="noopener noreferrer">aaaki/lora-scripts</a></p><p align="center"><strong>Modify By</strong> <a href="https://github.com/WhitecrowAurora/lora-rescripts" target="_blank" rel="noopener noreferrer">Lulynx</a></p><h3 id="更新日志" tabindex="-1"><a class="header-anchor" href="#更新日志" aria-hidden="true">#</a> 更新日志</h3><h4 id="v1-3-8" tabindex="-1"><a class="header-anchor" href="#v1-3-8" aria-hidden="true">#</a> v1.3.8</h4><ul><li>新增 update.bat 与 update_cn.bat，就地更新仓库时可分别走 GitHub 直连与中国大陆友好的镜像路线。</li><li>新增 Auto SafeMode，以及 FlashAttention / SageAttention 系列的 SafeMode 启动脚本。</li><li>修复多处 Windows PowerShell 5 编码兼容问题，提升部分机器上的启动稳定性。</li><li>新增 Newbie 运行时支持安装器，可检测已有运行时、补装共享依赖、预取 Jina 动态模块并写入支持标记。</li><li>改进 FlashAttention 安装流程，支持本地 wheel 缓存与 GitHub 镜像自动回退。</li><li>继续对齐 Lulynx Newbie 与上游训练器，补齐更多官方兼容默认值、配置别名与运行时行为。</li><li>调整 Newbie 常规高显存训练路径，优先采用更接近官方的 runtime path，减少不必要的显存开销。</li><li>完成基于 FlashAttention 的 Newbie cache / train 端到端链路验证。</li></ul>`,
  5
);

function F(u, g) {
  return e(), c("div", null, [s("div", i, [y, C, E]), h]);
}

var b = p(B, [["render", F], ["__file", "index.html.vue"]]);

export { b as default };
