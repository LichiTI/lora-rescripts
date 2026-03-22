export type RuntimeSchemaKind =
  | "string"
  | "number"
  | "boolean"
  | "const"
  | "union"
  | "intersect"
  | "object"
  | "array";

export class RuntimeSchemaNode {
  kind: RuntimeSchemaKind;
  descriptionText?: string;
  defaultValue?: unknown;
  roleName?: string;
  roleConfig?: unknown;
  minValue?: number;
  maxValue?: number;
  stepValue?: number;
  disabledFlag = false;
  requiredFlag = false;
  literalValue?: unknown;
  options: RuntimeSchemaNode[] = [];
  fields: Record<string, RuntimeSchemaNode> = {};
  itemType?: RuntimeSchemaNode;

  constructor(kind: RuntimeSchemaKind) {
    this.kind = kind;
  }

  description(text: string) {
    this.descriptionText = text;
    return this;
  }

  default(value: unknown) {
    this.defaultValue = value;
    return this;
  }

  role(role: unknown, config?: unknown) {
    this.roleName = typeof role === "string" ? role : "custom";
    this.roleConfig = config ?? role;
    return this;
  }

  min(value: number) {
    this.minValue = value;
    return this;
  }

  max(value: number) {
    this.maxValue = value;
    return this;
  }

  step(value: number) {
    this.stepValue = value;
    return this;
  }

  required() {
    this.requiredFlag = true;
    return this;
  }

  disabled() {
    this.disabledFlag = true;
    return this;
  }
}

export type EvaluatedSchemaRecord = {
  name: string;
  hash: string;
  source: string;
  runtime: RuntimeSchemaNode | Record<string, unknown>;
};

export type SchemaSection = {
  id: string;
  title: string;
  fields: SchemaField[];
  conditional?: boolean;
  conditions: string[];
  constants: Record<string, unknown>;
};

export type SchemaField = {
  name: string;
  path: string;
  schema: RuntimeSchemaNode;
};
