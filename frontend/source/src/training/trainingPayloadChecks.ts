import { CONFLICT_PARAMS } from "./trainingPayloadConstants";
import {
  hasOwn,
  toNumber,
  toStringValue,
  valueIsTruthy,
} from "./trainingPayloadHelpers";
import type { TrainingCheckResult } from "./trainingPayloadTypes";

export function checkTrainingPayload(payload: Record<string, unknown>): TrainingCheckResult {
  const warnings: string[] = [];
  const errors: string[] = [];

  const optimizerType = toStringValue(payload.optimizer_type);
  const optimizerTypeLower = optimizerType.toLowerCase();
  const modelTrainType = toStringValue(payload.model_train_type);
  const sd3Finetune = modelTrainType === "sd3-finetune";
  const animaTraining = modelTrainType === "anima-lora" || modelTrainType === "anima-finetune";

  if (optimizerType.startsWith("DAdapt") && payload.lr_scheduler !== "constant") {
    warnings.push("DAdaptation works best with lr_scheduler set to constant.");
  }

  if (
    optimizerTypeLower.startsWith("prodigy") &&
    (hasOwn(payload, "unet_lr") || hasOwn(payload, "text_encoder_lr")) &&
    (toNumber(payload.unet_lr, 1) !== 1 || toNumber(payload.text_encoder_lr, 1) !== 1)
  ) {
    warnings.push("Prodigy usually expects unet_lr and text_encoder_lr to stay at 1.");
  }

  if (payload.network_module === "networks.oft" && modelTrainType !== "sdxl-lora") {
    errors.push("OFT is currently only supported for SDXL LoRA.");
  }

  if (
    sd3Finetune &&
    valueIsTruthy(payload.train_text_encoder) &&
    valueIsTruthy(payload.cache_text_encoder_outputs) &&
    !valueIsTruthy(payload.use_t5xxl_cache_only)
  ) {
    errors.push("SD3 full finetune cannot train text encoders while cache_text_encoder_outputs is enabled.");
  }

  if (sd3Finetune && valueIsTruthy(payload.train_t5xxl) && !valueIsTruthy(payload.train_text_encoder)) {
    errors.push("train_t5xxl requires train_text_encoder to be enabled first.");
  }

  if (sd3Finetune && valueIsTruthy(payload.train_t5xxl) && valueIsTruthy(payload.cache_text_encoder_outputs)) {
    errors.push("train_t5xxl cannot be combined with cache_text_encoder_outputs.");
  }

  if (
    animaTraining &&
    valueIsTruthy(payload.unsloth_offload_checkpointing) &&
    valueIsTruthy(payload.cpu_offload_checkpointing)
  ) {
    errors.push("unsloth_offload_checkpointing cannot be combined with cpu_offload_checkpointing.");
  }

  if (
    animaTraining &&
    valueIsTruthy(payload.unsloth_offload_checkpointing) &&
    valueIsTruthy(payload.blocks_to_swap)
  ) {
    errors.push("unsloth_offload_checkpointing cannot be combined with blocks_to_swap.");
  }

  for (const [left, right] of CONFLICT_PARAMS) {
    if (valueIsTruthy(payload[left]) && valueIsTruthy(payload[right])) {
      errors.push(`Parameters ${left} and ${right} conflict. Please enable only one of them.`);
    }
  }

  return { warnings, errors };
}
