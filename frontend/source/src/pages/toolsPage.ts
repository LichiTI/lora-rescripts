import { runtimeUrl } from "../shared/runtime";

export function renderToolsPage() {
  return `
    <article class="legacy-doc-content">
      <h1>Tagger 标注工具</h1>
      <p>后端基于 wd14-tagger 开发。</p>
      <p>训练包内默认带离线模型；如果切换到其他模型，可能需要额外连接 HuggingFace 进行下载。</p>
      <p>已更新 v3、large 和 CL 系列 Tagger 模型。</p>
      <h3>推荐参数</h3>
      <p>阈值大于 0.35。</p>
    </article>
    <div class="legacy-action-row">
      <a class="action-button action-button-ghost" href="${runtimeUrl("/tageditor.html")}" target="_blank" rel="noreferrer">打开当前随包标签编辑器页面</a>
      <a class="action-button action-button-ghost" href="${runtimeUrl("/lora/tools.html")}" target="_blank" rel="noreferrer">打开当前随包旧版工具页</a>
    </div>
    <section class="two-column">
      <article class="panel info-card">
        <p class="panel-kicker">脚本 / scripts</p>
        <h3 id="tools-summary-title">正在读取工具脚本列表...</h3>
        <div id="tools-summary-body">正在检查 /api/scripts</div>
      </article>
      <article class="panel info-card">
        <p class="panel-kicker">入口 / launcher</p>
        <h3>当前后端启动方式</h3>
        <div>
          <p>工具脚本通过 <code>POST /api/run_script</code> 启动。</p>
          <p>后端会校验脚本名，并从 <code>scripts/stable</code> 或 <code>scripts/dev</code> 解析对应入口。</p>
        </div>
      </article>
    </section>
    <section class="panel tools-panel">
      <div class="section-head">
        <div>
          <p class="panel-kicker">数据集 / dataset</p>
          <h2>数据集分析 / Dataset Analyzer</h2>
          <p class="section-note">在训练前扫描数据集目录，提前看到缺失标签、目录覆盖率、常见标签、分辨率分布和可用于蒙版损失的透明图候选。</p>
        </div>
      </div>
      <div class="tool-form-grid">
        <label class="tool-field tool-field-wide">
          <span>数据集目录</span>
          <div class="tool-inline-actions">
            <input id="dataset-analysis-path" class="field-input" type="text" placeholder="选择要分析的数据集目录" />
            <button id="dataset-analysis-pick" class="action-button action-button-ghost" type="button">浏览</button>
            <button id="dataset-analysis-run" class="action-button" type="button">分析</button>
          </div>
        </label>
        <label class="tool-field">
          <span>标签扩展名</span>
          <input id="dataset-analysis-caption-extension" class="field-input" type="text" value=".txt" />
        </label>
        <label class="tool-field">
          <span>高频标签数</span>
          <input id="dataset-analysis-top-tags" class="field-input" type="number" value="40" min="1" max="200" step="1" />
        </label>
        <label class="tool-field">
          <span>样本路径数</span>
          <input id="dataset-analysis-sample-limit" class="field-input" type="number" value="8" min="1" max="50" step="1" />
        </label>
      </div>
      <p id="dataset-analysis-status" class="section-note">准备扫描训练目录。</p>
      <div id="dataset-analysis-results" class="dataset-analysis-empty">
        选择目录后，这里会显示图片数量、标签覆盖率、重复权重后的有效数量、常见标签、透明图候选和一些问题样本。
      </div>
    </section>
    <section class="panel tools-panel">
      <div class="section-head">
        <div>
          <p class="panel-kicker">蒙版 / alpha</p>
          <h2>蒙版损失助手 / Masked Loss</h2>
          <p class="section-note">检查数据集里是否真的有可用的 alpha 蒙版，并辅助判断什么时候该启用 <code>alpha_mask</code> 或 <code>masked_loss</code>。</p>
        </div>
      </div>
      <div class="tool-form-grid">
        <label class="tool-field tool-field-wide">
          <span>数据集目录</span>
          <div class="tool-inline-actions">
            <input id="masked-loss-audit-path" class="field-input" type="text" placeholder="选择要检查 alpha 蒙版的数据集目录" />
            <button id="masked-loss-audit-pick" class="action-button action-button-ghost" type="button">浏览</button>
            <button id="masked-loss-audit-run" class="action-button" type="button">检查</button>
          </div>
        </label>
        <label class="tool-field">
          <span>样本路径数</span>
          <input id="masked-loss-audit-sample-limit" class="field-input" type="number" value="8" min="1" max="50" step="1" />
        </label>
      </div>
      <div class="tool-toggle-grid">
        <label class="tool-toggle"><input id="masked-loss-audit-recursive" type="checkbox" checked /> 递归扫描子目录</label>
      </div>
      <p id="masked-loss-audit-status" class="section-note">检查这个数据集里的透明通道图片是否真的能用于蒙版损失训练。</p>
      <div id="masked-loss-audit-results" class="dataset-analysis-empty">
        这个检查不会只看文件扩展名，而会真正读取 alpha 通道内容，判断是不是只有全不透明假透明。
      </div>
    </section>
    <section class="panel tools-panel">
      <div class="section-head">
        <div>
          <p class="panel-kicker">打标 / tagger</p>
          <h2>批量自动打标 / Batch Tagging</h2>
          <p class="section-note">直接从这里调用内置 WD / CL 打标器，先快速生成一轮标签，再去完整标签编辑器里精修。</p>
        </div>
      </div>
      <div class="tool-form-grid">
        <label class="tool-field tool-field-wide">
          <span>图片目录</span>
          <div class="tool-inline-actions">
            <input id="batch-tagger-path" class="field-input" type="text" placeholder="选择要批量打标的图片目录" />
            <button id="batch-tagger-pick" class="action-button action-button-ghost" type="button">浏览</button>
            <button id="batch-tagger-run" class="action-button" type="button">开始打标</button>
          </div>
        </label>
        <label class="tool-field">
          <span>模型</span>
          <select id="batch-tagger-model" class="field-input">
            <option>正在读取模型...</option>
          </select>
        </label>
        <label class="tool-field">
          <span>阈值</span>
          <input id="batch-tagger-threshold" class="field-input" type="number" value="0.35" min="0" max="1" step="0.01" />
        </label>
        <label class="tool-field">
          <span>角色阈值</span>
          <input id="batch-tagger-character-threshold" class="field-input" type="number" value="0.6" min="0" max="1" step="0.01" />
        </label>
        <label class="tool-field">
          <span>已有标签文件</span>
          <select id="batch-tagger-conflict" class="field-input">
            <option value="ignore" selected>忽略已有</option>
            <option value="copy">覆盖写入</option>
            <option value="prepend">前置追加</option>
          </select>
        </label>
        <label class="tool-field">
          <span>附加标签</span>
          <input id="batch-tagger-additional-tags" class="field-input" type="text" placeholder="使用逗号分隔多个标签" />
        </label>
        <label class="tool-field">
          <span>自动备份快照名</span>
          <input id="batch-tagger-backup-name" class="field-input" type="text" placeholder="例如：pre-batch-tagger" />
        </label>
        <label class="tool-field tool-field-wide">
          <span>排除标签</span>
          <input id="batch-tagger-exclude-tags" class="field-input" type="text" placeholder="这些标签会从输出结果中移除" />
        </label>
      </div>
      <div class="tool-toggle-grid">
        <label class="tool-toggle"><input id="batch-tagger-recursive" type="checkbox" /> 递归扫描子目录</label>
        <label class="tool-toggle"><input id="batch-tagger-replace-underscore" type="checkbox" checked /> 下划线替换为空格</label>
        <label class="tool-toggle"><input id="batch-tagger-escape-tag" type="checkbox" checked /> 转义输出标签中的括号</label>
        <label class="tool-toggle"><input id="batch-tagger-add-rating-tag" type="checkbox" /> 保留评级标签</label>
        <label class="tool-toggle"><input id="batch-tagger-add-model-tag" type="checkbox" /> 保留模型标签</label>
        <label class="tool-toggle"><input id="batch-tagger-auto-backup" type="checkbox" checked /> 修改已有标签前自动创建快照</label>
      </div>
      <p id="batch-tagger-status" class="section-note">正在读取可用打标模型...</p>
      <div id="batch-tagger-results" class="dataset-analysis-empty">
        选择目录和模型后会在后台启动批量打标；如果还要精修标签文本，建议再进入完整标签编辑器处理。
      </div>
    </section>
    <section class="panel tools-panel">
      <div class="section-head">
        <div>
          <p class="panel-kicker">标签文本 / caption</p>
          <h2>批量标签清理 / Caption Cleanup</h2>
          <p class="section-note">在训练前先预览并批量清理标签文本，不必为了简单的统一化工作专门打开完整标签编辑器。</p>
        </div>
      </div>
      <div class="tool-form-grid">
        <label class="tool-field tool-field-wide">
          <span>标签目录</span>
          <div class="tool-inline-actions">
            <input id="caption-cleanup-path" class="field-input" type="text" placeholder="选择包含标签文件的目录" />
            <button id="caption-cleanup-pick" class="action-button action-button-ghost" type="button">浏览</button>
            <button id="caption-cleanup-preview" class="action-button" type="button">预览</button>
            <button id="caption-cleanup-apply" class="action-button action-button-ghost" type="button">应用</button>
          </div>
        </label>
        <label class="tool-field">
          <span>标签扩展名</span>
          <input id="caption-cleanup-extension" class="field-input" type="text" value=".txt" />
        </label>
        <label class="tool-field">
          <span>精确移除标签</span>
          <input id="caption-cleanup-remove-tags" class="field-input" type="text" placeholder="lowres, text, signature" />
        </label>
        <label class="tool-field">
          <span>前置标签</span>
          <input id="caption-cleanup-prepend-tags" class="field-input" type="text" placeholder="masterpiece, best quality" />
        </label>
        <label class="tool-field">
          <span>后置标签</span>
          <input id="caption-cleanup-append-tags" class="field-input" type="text" placeholder="solo, white background" />
        </label>
        <label class="tool-field">
          <span>查找文本</span>
          <input id="caption-cleanup-search-text" class="field-input" type="text" placeholder="blue_hair" />
        </label>
        <label class="tool-field">
          <span>替换文本</span>
          <input id="caption-cleanup-replace-text" class="field-input" type="text" placeholder="blue hair" />
        </label>
        <label class="tool-field">
          <span>样本差异数</span>
          <input id="caption-cleanup-sample-limit" class="field-input" type="number" value="8" min="1" max="50" step="1" />
        </label>
        <label class="tool-field">
          <span>自动备份快照名</span>
          <input id="caption-cleanup-backup-name" class="field-input" type="text" placeholder="例如：pre-caption-cleanup" />
        </label>
      </div>
      <div class="tool-toggle-grid">
        <label class="tool-toggle"><input id="caption-cleanup-recursive" type="checkbox" checked /> 递归扫描子目录</label>
        <label class="tool-toggle"><input id="caption-cleanup-collapse-whitespace" type="checkbox" checked /> 规范重复空白字符</label>
        <label class="tool-toggle"><input id="caption-cleanup-replace-underscore" type="checkbox" /> 下划线替换为空格</label>
        <label class="tool-toggle"><input id="caption-cleanup-dedupe-tags" type="checkbox" checked /> 移除重复标签</label>
        <label class="tool-toggle"><input id="caption-cleanup-sort-tags" type="checkbox" /> 按字母排序标签</label>
        <label class="tool-toggle"><input id="caption-cleanup-use-regex" type="checkbox" /> 使用正则进行查找替换</label>
        <label class="tool-toggle"><input id="caption-cleanup-auto-backup" type="checkbox" checked /> 应用前自动创建快照</label>
      </div>
      <p id="caption-cleanup-status" class="section-note">先配置清理规则并预览差异，再决定是否真正写回。</p>
      <div id="caption-cleanup-results" class="dataset-analysis-empty">
        建议先预览。这里会展示部分样本文件的前后对比，避免错误规则直接写进数据集。
      </div>
    </section>
    <section class="panel tools-panel">
      <div class="section-head">
        <div>
          <p class="panel-kicker">快照 / backup</p>
          <h2>标签快照恢复 / Snapshot Restore</h2>
          <p class="section-note">在大范围修改标签文本前先做快照；如果自动打标或清理规则翻车了，可以再把快照恢复回来。</p>
        </div>
      </div>
      <div class="tool-form-grid">
        <label class="tool-field tool-field-wide">
          <span>标签目录</span>
          <div class="tool-inline-actions">
            <input id="caption-backup-path" class="field-input" type="text" placeholder="选择包含标签文件的目录" />
            <button id="caption-backup-pick" class="action-button action-button-ghost" type="button">浏览</button>
            <button id="caption-backup-create" class="action-button" type="button">创建快照</button>
            <button id="caption-backup-refresh" class="action-button action-button-ghost" type="button">刷新列表</button>
          </div>
        </label>
        <label class="tool-field">
          <span>标签扩展名</span>
          <input id="caption-backup-extension" class="field-input" type="text" value=".txt" />
        </label>
        <label class="tool-field">
          <span>快照名称</span>
          <input id="caption-backup-name" class="field-input" type="text" placeholder="例如：before-cleanup, before-tagging" />
        </label>
        <label class="tool-field">
          <span>可用快照</span>
          <select id="caption-backup-select" class="field-input">
            <option value="">刷新后显示该目录的快照</option>
          </select>
        </label>
      </div>
      <div class="tool-toggle-grid">
        <label class="tool-toggle"><input id="caption-backup-recursive" type="checkbox" checked /> 创建快照时包含子目录</label>
        <label class="tool-toggle"><input id="caption-backup-pre-restore" type="checkbox" checked /> 恢复前再备份当前标签</label>
      </div>
      <div class="tool-inline-actions">
        <button id="caption-backup-restore" class="action-button" type="button">恢复所选快照</button>
      </div>
      <p id="caption-backup-status" class="section-note">选择目录后可以先刷新已有快照，也可以在批量修改前先新建一个。</p>
      <div id="caption-backup-results" class="dataset-analysis-empty">
        恢复快照时会覆盖对应标签文件，但不会删除后来新增的额外文件。默认还会在恢复前再做一次安全备份。
      </div>
    </section>
    <section class="panel tools-panel">
      <div class="section-head">
        <div>
          <p class="panel-kicker">脚本 / scripts</p>
          <h2>脚本清单 / Script Inventory</h2>
          <p class="section-note">一些边缘场景还是要直接看原始脚本入口，所以完整脚本清单仍然保留在这里。</p>
        </div>
      </div>
      <div id="tools-browser" class="tools-browser loading">正在读取可用脚本...</div>
    </section>
  `;
}
