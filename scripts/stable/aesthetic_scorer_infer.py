import argparse
import logging
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from scripts.stable.lulynx.aesthetic_fusion.inference import (
    TARGETS,
    build_summary,
    collect_images,
    infer_records,
    load_runtime,
    organize_images,
    write_outputs,
    write_summary,
)


def _parse_boolish(value, default: bool = False) -> bool:
    if value is None:
        return bool(default)
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    normalized = str(value).strip().lower()
    if not normalized:
        return bool(default)
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return bool(value)


def _parse_dimensions(raw: str | None) -> list[str]:
    if raw is None or str(raw).strip() == "":
        return list(TARGETS)
    values = [
        item.strip().lower()
        for item in str(raw).replace("\r\n", "\n").replace("\r", "\n").replace("\n", ",").split(",")
        if item.strip()
    ]
    invalid = [item for item in values if item not in TARGETS]
    if invalid:
        raise ValueError(f"organize_dimensions contains invalid items: {invalid}")
    deduped: list[str] = []
    seen = set()
    for item in values:
        if item not in seen:
            deduped.append(item)
            seen.add(item)
    return deduped or list(TARGETS)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Aesthetic scorer batch inference")
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--input_dir", type=Path, required=True)
    parser.add_argument("--output_dir", type=Path, required=True)
    parser.add_argument("--device", type=str, default=None)
    parser.add_argument("--batch_size", type=int, default=8)
    parser.add_argument("--recursive", type=str, default="true")
    parser.add_argument("--image_extensions", type=str, default=".jpg,.jpeg,.png,.webp,.bmp,.gif")
    parser.add_argument("--special_threshold", type=float, default=0.5)
    parser.add_argument("--save_jsonl", type=str, default="true")
    parser.add_argument("--save_csv", type=str, default="true")
    parser.add_argument("--jsonl_name", type=str, default="predictions.jsonl")
    parser.add_argument("--csv_name", type=str, default="predictions.csv")
    parser.add_argument("--organize_enabled", type=str, default="false")
    parser.add_argument("--organize_root_dir", type=Path, default=None)
    parser.add_argument("--organize_mode", type=str, default="copy")
    parser.add_argument("--organize_include_special_group", type=str, default="true")
    parser.add_argument("--organize_dimensions", type=str, default="aesthetic,composition,color,sexual")
    parser.add_argument("--organize_bucket_strategy", type=str, default="nearest_int")
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="[%(asctime)s] %(levelname)s: %(message)s")

    checkpoint = args.checkpoint.expanduser().resolve()
    input_dir = args.input_dir.expanduser().resolve()
    output_dir = args.output_dir.expanduser().resolve()

    if not checkpoint.exists() or not checkpoint.is_file():
        raise FileNotFoundError(f"checkpoint not found: {checkpoint}")

    image_extensions = [item.strip() for item in str(args.image_extensions).split(",") if item.strip()]
    recursive = _parse_boolish(args.recursive, True)
    save_jsonl = _parse_boolish(args.save_jsonl, True)
    save_csv = _parse_boolish(args.save_csv, True)
    organize_enabled = _parse_boolish(args.organize_enabled, False)
    organize_include_special_group = _parse_boolish(args.organize_include_special_group, True)
    organize_dimensions = _parse_dimensions(args.organize_dimensions)
    organize_root_dir = (
        args.organize_root_dir.expanduser().resolve()
        if args.organize_root_dir is not None
        else (output_dir / "organized").resolve()
    )

    images = collect_images(input_dir, recursive=recursive, exts=image_extensions)
    if not images:
        raise RuntimeError(f"No images found in input_dir={input_dir}")

    runtime = load_runtime(checkpoint, args.device)
    logging.info("checkpoint=%s", checkpoint)
    logging.info("device=%s", runtime["device"])
    logging.info("input_dir=%s", input_dir)
    logging.info("images=%d", len(images))
    logging.info("has_cls_head=%s", runtime["has_cls_head"])
    logging.info("special_threshold=%.4f", args.special_threshold)

    records = infer_records(
        images,
        input_dir=input_dir,
        runtime=runtime,
        batch_size=max(1, int(args.batch_size)),
        special_threshold=float(args.special_threshold),
    )
    output_files = write_outputs(
        records,
        output_dir=output_dir,
        save_jsonl=save_jsonl,
        save_csv=save_csv,
        jsonl_name=str(args.jsonl_name),
        csv_name=str(args.csv_name),
    )
    organize_stats = organize_images(
        records,
        input_dir=input_dir,
        enabled=organize_enabled,
        root_dir=organize_root_dir,
        mode=str(args.organize_mode),
        include_special_group=organize_include_special_group,
        dimensions=organize_dimensions,
        bucket_strategy=str(args.organize_bucket_strategy),
    )
    summary = build_summary(
        checkpoint=checkpoint,
        input_dir=input_dir,
        output_dir=output_dir,
        runtime=runtime,
        records=records,
        output_files=output_files,
        organize_stats=organize_stats,
        special_threshold=float(args.special_threshold),
    )
    summary_path = write_summary(output_dir, summary)
    logging.info("summary=%s", summary_path)
    for key, path in output_files.items():
        logging.info("%s=%s", key, path)
    logging.info("organize=%s", organize_stats)


if __name__ == "__main__":
    main()
