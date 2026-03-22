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
    purpose: "Fetch all schema definitions used to render training forms.",
    migrationPriority: "high",
  },
  {
    method: "GET",
    path: "/api/schemas/hashes",
    purpose: "Hot-reload check for schema changes.",
    migrationPriority: "medium",
  },
  {
    method: "GET",
    path: "/api/presets",
    purpose: "Fetch preset configs for pages and tools.",
    migrationPriority: "high",
  },
  {
    method: "GET",
    path: "/api/config/saved_params",
    purpose: "Load stored UI parameter choices.",
    migrationPriority: "medium",
  },
  {
    method: "GET",
    path: "/api/config/summary",
    purpose: "Read app config summary for the rebuilt settings page.",
    migrationPriority: "medium",
  },
  {
    method: "GET",
    path: "/api/graphic_cards",
    purpose: "List GPUs plus xformers support state.",
    migrationPriority: "high",
  },
  {
    method: "POST",
    path: "/api/run",
    purpose: "Start schema-driven training jobs.",
    migrationPriority: "high",
  },
  {
    method: "POST",
    path: "/api/run_script",
    purpose: "Run utility scripts from the tools page.",
    migrationPriority: "high",
  },
  {
    method: "POST",
    path: "/api/interrogate",
    purpose: "Run the built-in tagger/interrogator flow.",
    migrationPriority: "high",
  },
  {
    method: "GET",
    path: "/api/pick_file",
    purpose: "Open native file/folder pickers where supported.",
    migrationPriority: "medium",
  },
  {
    method: "GET",
    path: "/api/get_files",
    purpose: "List model, output or train directories for file pickers.",
    migrationPriority: "high",
  },
  {
    method: "GET",
    path: "/api/tasks",
    purpose: "Fetch active and historical task state.",
    migrationPriority: "high",
  },
  {
    method: "GET",
    path: "/api/tasks/terminate/{task_id}",
    purpose: "Terminate a running task.",
    migrationPriority: "high",
  },
  {
    method: "GET",
    path: "/api/tageditor_status",
    purpose: "Poll tag-editor startup/proxy status.",
    migrationPriority: "medium",
  },
  {
    method: "GET",
    path: "/api/scripts",
    purpose: "List backend-approved utility scripts and positional args for the rebuilt tools page.",
    migrationPriority: "high",
  },
];
