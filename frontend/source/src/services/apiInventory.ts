export type ApiRecord = {
  method: "GET" | "POST";
  path: string;
  purpose: string;
  migrationPriority: "high" | "medium" | "low";
};

export const apiInventory: ApiRecord[] = [
  {
    method: "GET",
    path: "/api/schemas/all",
    purpose: "读取用于渲染训练表单的全部 schema 定义。",
    migrationPriority: "high",
  },
  {
    method: "GET",
    path: "/api/schemas/hashes",
    purpose: "检查 schema 是否变更，用于热更新提示。",
    migrationPriority: "medium",
  },
  {
    method: "GET",
    path: "/api/presets",
    purpose: "读取页面和工具页可复用的预设配置。",
    migrationPriority: "high",
  },
  {
    method: "GET",
    path: "/api/config/saved_params",
    purpose: "读取 UI 已保存的参数选择。",
    migrationPriority: "medium",
  },
  {
    method: "GET",
    path: "/api/config/summary",
    purpose: "为源码版 settings 页面读取配置摘要。",
    migrationPriority: "medium",
  },
  {
    method: "GET",
    path: "/api/graphic_cards",
    purpose: "列出 GPU，以及运行时依赖和 xformers 支持状态。",
    migrationPriority: "high",
  },
  {
    method: "POST",
    path: "/api/run",
    purpose: "启动 schema 驱动的训练任务。",
    migrationPriority: "high",
  },
  {
    method: "POST",
    path: "/api/train/preflight",
    purpose: "在启动前执行后端感知的训练检查。",
    migrationPriority: "high",
  },
  {
    method: "POST",
    path: "/api/train/sample_prompt",
    purpose: "在不启动训练的前提下解析并预览示例提示词。",
    migrationPriority: "high",
  },
  {
    method: "POST",
    path: "/api/dataset/masked_loss_audit",
    purpose: "检查蒙版损失训练所需的 alpha 蒙版可用性。",
    migrationPriority: "high",
  },
  {
    method: "POST",
    path: "/api/run_script",
    purpose: "从工具页启动后端工具脚本。",
    migrationPriority: "high",
  },
  {
    method: "POST",
    path: "/api/interrogate",
    purpose: "执行内置 tagger / interrogator 流程。",
    migrationPriority: "high",
  },
  {
    method: "GET",
    path: "/api/interrogators",
    purpose: "列出工具页可用的批量打标模型。",
    migrationPriority: "high",
  },
  {
    method: "POST",
    path: "/api/captions/cleanup/preview",
    purpose: "在真正修改文件前预览批量标签清理规则。",
    migrationPriority: "high",
  },
  {
    method: "POST",
    path: "/api/captions/cleanup/apply",
    purpose: "将批量标签清理规则应用到标签文件。",
    migrationPriority: "high",
  },
  {
    method: "POST",
    path: "/api/captions/backups/create",
    purpose: "创建标签文件快照，供之后恢复使用。",
    migrationPriority: "high",
  },
  {
    method: "POST",
    path: "/api/captions/backups/list",
    purpose: "列出某个目录对应的标签快照。",
    migrationPriority: "high",
  },
  {
    method: "POST",
    path: "/api/captions/backups/restore",
    purpose: "从已保存快照里恢复标签文件。",
    migrationPriority: "high",
  },
  {
    method: "GET",
    path: "/api/pick_file",
    purpose: "在支持的平台上打开原生文件或目录选择器。",
    migrationPriority: "medium",
  },
  {
    method: "GET",
    path: "/api/get_files",
    purpose: "为文件选择器列出模型、输出或训练目录。",
    migrationPriority: "high",
  },
  {
    method: "GET",
    path: "/api/tasks",
    purpose: "读取当前和历史任务状态。",
    migrationPriority: "high",
  },
  {
    method: "GET",
    path: "/api/tasks/terminate/{task_id}",
    purpose: "终止正在运行的任务。",
    migrationPriority: "high",
  },
  {
    method: "GET",
    path: "/api/tageditor_status",
    purpose: "轮询标签编辑器启动或代理状态。",
    migrationPriority: "medium",
  },
  {
    method: "GET",
    path: "/api/scripts",
    purpose: "列出工具页允许调用的脚本及其位置参数。",
    migrationPriority: "high",
  },
];
