export type TrainingRouteConfig = {
  routeId: string;
  schemaName: string;
  prefix: string;
  modelLabel: string;
  presetTrainTypes: string[];
};

export const trainingRouteConfigs: Record<string, TrainingRouteConfig> = {
  "sdxl-train": {
    routeId: "sdxl-train",
    schemaName: "sdxl-lora",
    prefix: "sdxl",
    modelLabel: "SDXL",
    presetTrainTypes: ["sdxl-lora"],
  },
  "flux-train": {
    routeId: "flux-train",
    schemaName: "flux-lora",
    prefix: "flux",
    modelLabel: "Flux",
    presetTrainTypes: ["flux-lora"],
  },
  "sd3-train": {
    routeId: "sd3-train",
    schemaName: "sd3-lora",
    prefix: "sd3",
    modelLabel: "SD3",
    presetTrainTypes: ["sd3-lora"],
  },
  "dreambooth-train": {
    routeId: "dreambooth-train",
    schemaName: "dreambooth",
    prefix: "dreambooth",
    modelLabel: "Dreambooth",
    presetTrainTypes: ["dreambooth", "sd-dreambooth", "sdxl-finetune"],
  },
  "sd-controlnet-train": {
    routeId: "sd-controlnet-train",
    schemaName: "sd-controlnet",
    prefix: "sd-controlnet",
    modelLabel: "SD ControlNet",
    presetTrainTypes: ["sd-controlnet"],
  },
  "sdxl-controlnet-train": {
    routeId: "sdxl-controlnet-train",
    schemaName: "sdxl-controlnet",
    prefix: "sdxl-controlnet",
    modelLabel: "SDXL ControlNet",
    presetTrainTypes: ["sdxl-controlnet"],
  },
  "flux-controlnet-train": {
    routeId: "flux-controlnet-train",
    schemaName: "flux-controlnet",
    prefix: "flux-controlnet",
    modelLabel: "Flux ControlNet",
    presetTrainTypes: ["flux-controlnet"],
  },
  "sdxl-lllite-train": {
    routeId: "sdxl-lllite-train",
    schemaName: "sdxl-controlnet-lllite",
    prefix: "sdxl-lllite",
    modelLabel: "SDXL LLLite",
    presetTrainTypes: ["sdxl-controlnet-lllite"],
  },
};
