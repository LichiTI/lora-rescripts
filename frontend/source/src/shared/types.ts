export type ApiEnvelope<T> = {
  status: string;
  message?: string;
  data?: T;
};

export type SchemaHashRecord = {
  name: string;
  hash: string;
};

export type SchemaRecord = {
  name: string;
  hash: string;
  schema: string;
};

export type PresetRecord = {
  name?: string;
  group?: string;
  metadata?: Record<string, unknown>;
  data?: Record<string, unknown>;
  [key: string]: unknown;
};

export type ConfigSummary = {
  last_path: string;
  saved_param_keys: string[];
  saved_param_count: number;
  config_path: string;
};

export type TaskRecord = {
  id?: string;
  task_id?: string;
  status?: string;
  message?: string;
  progress?: number;
  [key: string]: unknown;
};

export type GraphicCardRecord = {
  index?: number;
  id?: number;
  name: string;
  memory_total?: string | number;
  memory_free?: string | number;
  memory_used?: string | number;
  [key: string]: unknown;
};

export type XformersStatus = {
  installed: boolean;
  supported: boolean;
  reason: string;
};

export type TagEditorStatus = {
  status: string;
  detail?: string;
};

export type ScriptRecord = {
  name: string;
  positional_args: string[];
  category: string;
};
