import csv
import json
import logging
import os
import re
import shutil
from pathlib import Path
from typing import Any, Iterable

import torch
from PIL import Image
from tqdm import tqdm

ROOT = Path(__file__).resolve().parents[4]
TARGETS = ("aesthetic", "composition", "color", "sexual")
DEFAULT_IMAGE_EXTENSIONS = (".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif")
_ABS_PATH_RE = re.compile(r"^[A-Za-z]:[\\/]")


def _batched(items: list[Path], batch_size: int) -> Iterable[list[Path]]:
    for index in range(0, len(items), batch_size):
        yield items[index : index + batch_size]


def collect_images(input_dir: Path, recursive: bool = True, exts: Iterable[str] | None = None) -> list[Path]:
    if not input_dir.exists():
        raise FileNotFoundError(f"input_dir not found: {input_dir}")
    if not input_dir.is_dir():
        raise NotADirectoryError(f"input_dir must be a directory: {input_dir}")

    ext_list = list(exts or DEFAULT_IMAGE_EXTENSIONS)
    ext_set = {item.lower() if str(item).startswith(".") else f".{str(item).lower()}" for item in ext_list}
    pattern = "**/*" if recursive else "*"
    results: list[Path] = []
    for path in input_dir.glob(pattern):
        if path.is_file() and path.suffix.lower() in ext_set:
            results.append(path.resolve())
    results.sort()
    return results


def score_bucket(value: float, strategy: str = "nearest_int") -> int:
    normalized = str(strategy or "nearest_int").strip().lower()
    if normalized == "floor":
        bucket = int(value // 1)
    elif normalized == "ceil":
        bucket = int(-(-value // 1))
    else:
        bucket = int(round(value))
    return max(1, min(5, bucket))


def _next_available_path(path: Path) -> Path:
    if not path.exists():
        return path
    stem = path.stem
    suffix = path.suffix
    parent = path.parent
    index = 1
    while True:
        candidate = parent / f"{stem}__{index}{suffix}"
        if not candidate.exists():
            return candidate
        index += 1


def _place_file(src: Path, dst: Path, mode: str) -> Path:
    dst.parent.mkdir(parents=True, exist_ok=True)
    dst = _next_available_path(dst)
    normalized = str(mode or "copy").strip().lower()
    if normalized == "copy":
        shutil.copy2(src, dst)
    elif normalized == "move":
        shutil.move(str(src), str(dst))
    elif normalized == "hardlink":
        os.link(src, dst)
    elif normalized == "symlink":
        dst.symlink_to(src.resolve())
    else:
        raise ValueError(f"Unsupported organize_mode: {mode}")
    return dst


def load_checkpoint(path: Path) -> dict[str, Any]:
    if path.suffix.lower() != ".safetensors":
        loaded = torch.load(path, map_location="cpu")
        if not isinstance(loaded, dict):
            raise ValueError(f"Unsupported checkpoint payload: {type(loaded)!r}")
        return loaded

    from safetensors import safe_open
    from safetensors.torch import load_file as load_safetensors_file

    state = load_safetensors_file(str(path), device="cpu")
    with safe_open(str(path), framework="pt", device="cpu") as handle:
        metadata = handle.metadata() or {}

    config_json = metadata.get("config_json")
    if not config_json:
        raise ValueError(f"safetensors checkpoint missing required metadata: config_json ({path})")

    hidden_dims_raw = metadata.get("hidden_dims_json")
    hidden_dims = json.loads(hidden_dims_raw) if hidden_dims_raw else json.loads(metadata.get("hidden_dims", "[]"))

    return {
        "input_dim": int(metadata.get("input_dim", 0)),
        "hidden_dims": list(hidden_dims),
        "dropout": float(metadata.get("dropout", 0.2)),
        "fusion_head": state,
        "config": json.loads(config_json),
    }


def _resolve_waifu_head_path(raw_path: object, checkpoint: Path) -> str | None:
    def _norm(value: object) -> str | None:
        if value is None:
            return None
        normalized = str(value).strip()
        if not normalized or normalized.lower() in {"none", "null", "off", "false", "0"}:
            return None
        return normalized

    preferred = _norm(raw_path)
    env_override = _norm(os.getenv("FUSION_WAIFU_V3_HEAD_PATH"))

    candidates: list[Path] = []

    def _add(path_like: str | None) -> None:
        if not path_like:
            return
        candidate = Path(path_like).expanduser()
        if candidate.is_absolute():
            candidates.append(candidate)
        else:
            candidates.append((ROOT / candidate).resolve())
            candidates.append((checkpoint.parent / candidate).resolve())

    cache_root = _norm(os.getenv("FUSION_MODEL_CACHE_ROOT"))
    default_local = (
        (Path(cache_root).expanduser() / "waifu-scorer-v3" / "model.safetensors").resolve()
        if cache_root
        else (ROOT / "model" / "_models" / "waifu-scorer-v3" / "model.safetensors").resolve()
    )

    if cache_root:
        candidates.append((Path(cache_root).expanduser() / "waifu-scorer-v3" / "model.safetensors").resolve())
    candidates.append((ROOT / "model" / "_models" / "waifu-scorer-v3" / "model.safetensors").resolve())
    candidates.append((ROOT / "_models" / "waifu-scorer-v3" / "model.safetensors").resolve())
    candidates.append((checkpoint.parent / "waifu-scorer-v3" / "model.safetensors").resolve())
    candidates.append((checkpoint.parent / "_models" / "waifu-scorer-v3" / "model.safetensors").resolve())
    _add(env_override)
    _add(preferred)

    seen: set[str] = set()
    for candidate in candidates:
        key = str(candidate).lower()
        if key in seen:
            continue
        seen.add(key)
        if candidate.exists() and candidate.is_file():
            if preferred and str(candidate).lower() != str(Path(preferred).expanduser()).lower():
                logging.warning("waifu_v3_head_path not found in checkpoint config, auto-resolved to: %s", candidate)
            return str(candidate)

    if preferred:
        logging.warning(
            "waifu_v3_head_path from checkpoint/env is unavailable (%s). Will use local default path for diagnostics: %s",
            preferred,
            default_local,
        )
    return str(default_local)


def _resolve_model_ref(
    raw_value: object,
    *,
    default_value: str,
    checkpoint: Path,
    allow_none: bool = False,
) -> str | None:
    raw = "" if raw_value is None else str(raw_value).strip()
    if not raw:
        return None if allow_none else default_value
    lowered = raw.lower()
    if allow_none and lowered in {"none", "null", "off", "false", "0"}:
        return None

    is_path_like = (
        raw.startswith(".")
        or raw.startswith("/")
        or raw.startswith("\\")
        or ("\\" in raw)
        or bool(_ABS_PATH_RE.match(raw))
    )
    if not is_path_like:
        return raw

    candidate = Path(raw).expanduser()
    candidates: list[Path] = []
    if candidate.is_absolute():
        candidates.append(candidate)
    else:
        candidates.append((ROOT / candidate).resolve())
        candidates.append((checkpoint.parent / candidate).resolve())

    for path in candidates:
        if path.exists():
            return str(path)

    logging.warning(
        "Ignoring unavailable local model path from checkpoint: %s ; fallback to %s",
        raw,
        "none" if (allow_none and default_value == "none") else default_value,
    )
    if allow_none and default_value == "none":
        return None
    return default_value


def load_runtime(checkpoint: Path, device_override: str | None = None) -> dict[str, Any]:
    from .extractors import JTP3FeatureExtractor, WaifuV3ClipFeatureExtractor
    from .model import FusionMultiTaskHead

    checkpoint_payload = load_checkpoint(checkpoint)
    config = checkpoint_payload.get("config") or {}
    runtime_device = device_override or ("cuda" if torch.cuda.is_available() else "cpu")
    models = config.get("models") or {}
    expected_input_dim = int(checkpoint_payload["input_dim"])

    configured_model_id = _resolve_model_ref(
        os.getenv("FUSION_JTP3_MODEL_ID") or models.get("jtp3_model_id", "RedRocket/JTP-3"),
        default_value="RedRocket/JTP-3",
        checkpoint=checkpoint,
        allow_none=False,
    )
    configured_fallback = _resolve_model_ref(
        os.getenv("FUSION_JTP3_FALLBACK_MODEL_ID")
        if os.getenv("FUSION_JTP3_FALLBACK_MODEL_ID") is not None
        else models.get("jtp3_fallback_model_id", "google/siglip2-so400m-patch16-naflex"),
        default_value="google/siglip2-so400m-patch16-naflex",
        checkpoint=checkpoint,
        allow_none=True,
    )
    hf_token_env = models.get("hf_token_env", "HF_TOKEN")
    resolved_waifu_head = _resolve_waifu_head_path(models.get("waifu_v3_head_path"), checkpoint)

    waifu = WaifuV3ClipFeatureExtractor(
        clip_model_name=models.get("waifu_clip_model_name", "ViT-L-14"),
        clip_pretrained=models.get("waifu_clip_pretrained", "openai"),
        waifu_head_path=resolved_waifu_head,
        device=runtime_device,
        freeze=True,
        include_waifu_score=bool(models.get("include_waifu_score", True)),
    )

    probe_images = [Image.new("RGB", (224, 224), (0, 0, 0))]
    with torch.no_grad():
        waifu_dim = int(waifu(probe_images).shape[-1])

    def _build_jtp(model_id: str, fallback_model_id: str | None):
        return JTP3FeatureExtractor(
            model_id=model_id,
            device=runtime_device,
            hf_token_env=hf_token_env,
            freeze=True,
            fallback_model_id=fallback_model_id,
        )

    def _probe_jtp_dim(jtp_extractor) -> int:
        with torch.no_grad():
            return int(jtp_extractor(probe_images).shape[-1])

    attempts: list[str] = []
    jtp = _build_jtp(str(configured_model_id), configured_fallback)
    jtp_dim = _probe_jtp_dim(jtp)
    fused_dim = jtp_dim + waifu_dim
    attempts.append(
        f"{configured_model_id} => loaded={getattr(jtp, 'loaded_model_id', configured_model_id)} "
        f"(fallback={configured_fallback}) -> fused_dim={fused_dim}"
    )

    if fused_dim != expected_input_dim:
        logging.warning(
            "Feature dim mismatch for checkpoint=%s: expected=%s, got=%s. Auto-trying fallback model ids.",
            checkpoint,
            expected_input_dim,
            fused_dim,
        )
        candidates: list[tuple[str, str | None]] = []
        if configured_fallback and str(configured_fallback).strip() and str(configured_fallback) != configured_model_id:
            candidates.append((str(configured_fallback), None))
        default_fallback = "google/siglip2-so400m-patch16-naflex"
        if default_fallback not in {str(configured_model_id), str(configured_fallback)}:
            candidates.append((default_fallback, None))

        matched = False
        for candidate_model_id, candidate_fallback in candidates:
            try:
                candidate_jtp = _build_jtp(candidate_model_id, candidate_fallback)
                candidate_jtp_dim = _probe_jtp_dim(candidate_jtp)
                candidate_fused_dim = candidate_jtp_dim + waifu_dim
                attempts.append(
                    f"{candidate_model_id} => loaded={getattr(candidate_jtp, 'loaded_model_id', candidate_model_id)} "
                    f"(fallback={candidate_fallback}) -> fused_dim={candidate_fused_dim}"
                )
                if candidate_fused_dim == expected_input_dim:
                    logging.warning(
                        "Auto-switched JTP extractor to '%s' for dimension compatibility (fused_dim=%s).",
                        candidate_model_id,
                        candidate_fused_dim,
                    )
                    jtp = candidate_jtp
                    jtp_dim = candidate_jtp_dim
                    fused_dim = candidate_fused_dim
                    matched = True
                    break
            except Exception as exc:
                attempts.append(f"{candidate_model_id} (fallback={candidate_fallback}) -> error={exc}")

        if not matched:
            raise RuntimeError(
                "Checkpoint/extractor feature dimension mismatch. "
                f"checkpoint_input_dim={expected_input_dim}, current_fused_dim={fused_dim}, "
                f"waifu_dim={waifu_dim}, jtp_dim={jtp_dim}. Tried: {' | '.join(attempts)}"
            )

    head = FusionMultiTaskHead(
        input_dim=expected_input_dim,
        hidden_dims=list(checkpoint_payload["hidden_dims"]),
        dropout=float(checkpoint_payload["dropout"]),
    ).to(runtime_device)

    state = dict(checkpoint_payload["fusion_head"])
    if any(key.startswith("heads.") for key in state.keys()) and not any(
        key.startswith("reg_heads.") for key in state.keys()
    ):
        mapped: dict[str, Any] = {}
        for key, value in state.items():
            if key.startswith("heads."):
                mapped["reg_heads." + key[len("heads.") :]] = value
            else:
                mapped[key] = value
        state = mapped
    has_cls_head = any(key.startswith("cls_head.") for key in state.keys())
    head.load_state_dict(state, strict=False)
    head.eval()

    return {
        "checkpoint": checkpoint,
        "config": config,
        "device": runtime_device,
        "jtp": jtp,
        "waifu": waifu,
        "head": head,
        "has_cls_head": bool(has_cls_head),
    }


def infer_records(
    image_paths: list[Path],
    *,
    input_dir: Path,
    runtime: dict[str, Any],
    batch_size: int,
    special_threshold: float,
) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    jtp = runtime["jtp"]
    waifu = runtime["waifu"]
    head = runtime["head"]
    has_cls_head = bool(runtime["has_cls_head"])

    total_batches = (len(image_paths) + batch_size - 1) // batch_size
    for batch in tqdm(_batched(image_paths, batch_size), total=total_batches, desc="infer", unit="batch"):
        valid_paths: list[Path] = []
        images: list[Image.Image] = []
        for path in batch:
            try:
                with Image.open(path) as image:
                    images.append(image.convert("RGB"))
                valid_paths.append(path)
            except Exception as exc:
                records.append(
                    {
                        "image_path": str(path),
                        "relative_path": str(path.relative_to(input_dir)) if path.is_relative_to(input_dir) else path.name,
                        "aesthetic": None,
                        "composition": None,
                        "color": None,
                        "sexual": None,
                        "in_domain_prob": None,
                        "in_domain_pred": None,
                        "special_tag": None,
                        "special_reason": "",
                        "error": f"image_load_failed: {exc}",
                    }
                )

        if not valid_paths:
            continue

        with torch.no_grad():
            features_jtp = jtp(images)
            features_waifu = waifu(images)
            reg_pred, cls_logit = head(torch.cat([features_jtp, features_waifu], dim=-1))
            reg_list = reg_pred.cpu().tolist()
            cls_probs = torch.sigmoid(cls_logit).cpu().tolist() if has_cls_head else [None] * len(valid_paths)

        for path, reg_row, cls_prob in zip(valid_paths, reg_list, cls_probs):
            scores = [float(item) for item in reg_row]
            if cls_prob is None:
                in_domain_prob = None
                in_domain_pred = 1
                special_tag = 0
                special_reason = "no_cls_head"
            else:
                in_domain_prob = float(cls_prob)
                in_domain_pred = 1 if in_domain_prob >= special_threshold else 0
                special_tag = 0 if in_domain_pred == 1 else 1
                special_reason = "prob_below_threshold" if special_tag == 1 else ""

            relative_path = str(path.relative_to(input_dir)) if path.is_relative_to(input_dir) else path.name
            records.append(
                {
                    "image_path": str(path),
                    "relative_path": relative_path,
                    "aesthetic": scores[0],
                    "composition": scores[1],
                    "color": scores[2],
                    "sexual": scores[3],
                    "in_domain_prob": in_domain_prob,
                    "in_domain_pred": in_domain_pred,
                    "special_tag": special_tag,
                    "special_reason": special_reason,
                    "error": "",
                }
            )
    return records


def write_outputs(
    records: list[dict[str, Any]],
    *,
    output_dir: Path,
    save_jsonl: bool = True,
    save_csv: bool = True,
    jsonl_name: str = "predictions.jsonl",
    csv_name: str = "predictions.csv",
) -> dict[str, Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    output_files: dict[str, Path] = {}
    if save_jsonl:
        jsonl_path = output_dir / jsonl_name
        with jsonl_path.open("w", encoding="utf-8") as handle:
            for row in records:
                handle.write(json.dumps(row, ensure_ascii=False) + "\n")
        output_files["jsonl"] = jsonl_path

    if save_csv:
        csv_path = output_dir / csv_name
        fieldnames = [
            "image_path",
            "relative_path",
            "aesthetic",
            "composition",
            "color",
            "sexual",
            "in_domain_prob",
            "in_domain_pred",
            "special_tag",
            "special_reason",
            "error",
        ]
        with csv_path.open("w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=fieldnames)
            writer.writeheader()
            for row in records:
                writer.writerow(row)
        output_files["csv"] = csv_path
    return output_files


def organize_images(
    records: list[dict[str, Any]],
    *,
    input_dir: Path,
    enabled: bool = False,
    root_dir: Path | None = None,
    mode: str = "copy",
    include_special_group: bool = True,
    dimensions: Iterable[str] | None = None,
    bucket_strategy: str = "nearest_int",
) -> dict[str, int]:
    if not enabled:
        return {"organized": 0, "failed": 0}

    if root_dir is None:
        raise ValueError("organize root_dir is required when organize is enabled")

    selected_dimensions = [item for item in (dimensions or TARGETS) if item in TARGETS]
    if not selected_dimensions:
        raise ValueError("organize dimensions must contain at least one valid dimension")

    normalized_mode = str(mode or "copy").strip().lower()
    if normalized_mode == "move" and len(selected_dimensions) > 1:
        logging.warning("organize_mode=move with multiple dimensions is not safe. Fallback to copy.")
        normalized_mode = "copy"

    organized = 0
    failed = 0
    for row in tqdm(records, desc="organize", unit="img"):
        if row.get("error"):
            continue
        src = Path(str(row["image_path"]))
        if not src.exists():
            failed += 1
            continue

        group_name = "special" if int(row.get("special_tag") or 0) == 1 else "in_domain"
        for dimension in selected_dimensions:
            score = row.get(dimension)
            if score is None:
                continue
            bucket = score_bucket(float(score), bucket_strategy)
            base_dir = root_dir / group_name if include_special_group else root_dir
            dst_dir = base_dir / dimension / f"score_{bucket}"
            try:
                relative_path = src.relative_to(input_dir) if src.is_relative_to(input_dir) else Path(src.name)
                _place_file(src, dst_dir / relative_path, normalized_mode)
                organized += 1
            except Exception:
                failed += 1
    return {"organized": organized, "failed": failed}


def build_summary(
    *,
    checkpoint: Path,
    input_dir: Path,
    output_dir: Path,
    runtime: dict[str, Any],
    records: list[dict[str, Any]],
    output_files: dict[str, Path],
    organize_stats: dict[str, int],
    special_threshold: float,
) -> dict[str, Any]:
    total_records = len(records)
    inferred_records = sum(1 for row in records if not row.get("error"))
    special_records = sum(1 for row in records if int(row.get("special_tag") or 0) == 1)
    return {
        "checkpoint": str(checkpoint),
        "input_dir": str(input_dir),
        "output_dir": str(output_dir),
        "total_records": total_records,
        "inferred_records": inferred_records,
        "special_records": special_records,
        "has_cls_head": bool(runtime["has_cls_head"]),
        "special_threshold": float(special_threshold),
        "output_files": {key: str(value) for key, value in output_files.items()},
        "organize": organize_stats,
    }


def write_summary(output_dir: Path, summary: dict[str, Any]) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    summary_path = output_dir / "summary.json"
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")
    return summary_path
