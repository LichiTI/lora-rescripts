import json
import random
from pathlib import Path
from typing import Any, Optional


ANIMA_JSON_CAPTION_PREFIX = "__mikazuki_anima_json__:"


def _coerce_string(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def _coerce_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [item.strip() for item in value.split(",") if item.strip()]
    if isinstance(value, (list, tuple, set)):
        result: list[str] = []
        for item in value:
            result.extend(_coerce_list(item))
        return result
    coerced = _coerce_string(value)
    return [coerced] if coerced else []


def dedupe_list(tags: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for tag in tags:
        normalized = tag.lower().strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        result.append(tag.strip())
    return result


def load_caption_json(json_path: Path | str) -> Optional[dict]:
    path = Path(json_path)
    if not path.exists():
        return None
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except Exception:
        return None


def _extract_character(value: Any) -> str:
    if isinstance(value, dict):
        full = _coerce_string(value.get("full"))
        if full:
            return full
        name = _coerce_string(value.get("name"))
        variant = _coerce_string(value.get("variant"))
        if name and variant:
            return f"{name}, {variant}"
        return name or variant
    return _coerce_string(value)


def normalize_caption_json(raw_json: dict) -> dict:
    if not isinstance(raw_json, dict):
        return {
            "quality": [],
            "count": "",
            "character": "",
            "series": "",
            "artist": "",
            "appearance": [],
            "tags": [],
            "environment": [],
            "nl": "",
        }

    if isinstance(raw_json.get("tags"), dict):
        tags_dict = raw_json.get("tags", {})
        return {
            "quality": _coerce_list(tags_dict.get("quality")),
            "count": _coerce_string(tags_dict.get("count")),
            "character": _extract_character(tags_dict.get("character")),
            "series": _coerce_string(tags_dict.get("series")),
            "artist": _coerce_string(tags_dict.get("artist")),
            "appearance": dedupe_list(_coerce_list(tags_dict.get("appearance"))),
            "tags": dedupe_list(_coerce_list(tags_dict.get("tags"))),
            "environment": dedupe_list(_coerce_list(tags_dict.get("environment"))),
            "nl": _coerce_string(tags_dict.get("nl")),
        }

    fixed = raw_json.get("fixed", {}) if isinstance(raw_json.get("fixed"), dict) else {}
    from_path = raw_json.get("from_path", {}) if isinstance(raw_json.get("from_path"), dict) else {}
    ai_output = raw_json.get("ai_output", {}) if isinstance(raw_json.get("ai_output"), dict) else {}

    quality = _coerce_list(fixed.get("quality") if fixed else raw_json.get("quality"))
    count = _coerce_string(ai_output.get("count") if ai_output else raw_json.get("count"))
    character = _extract_character(raw_json.get("character"))
    series = _coerce_string(fixed.get("series") if fixed else raw_json.get("series"))
    artist = _coerce_string(fixed.get("artist") if fixed else raw_json.get("artist"))

    appearance = dedupe_list(
        _coerce_list(ai_output.get("appearance"))
        + _coerce_list(from_path.get("appearance"))
        + _coerce_list(from_path.get("extra_appearance"))
        + _coerce_list(raw_json.get("appearance"))
    )
    tags = dedupe_list(
        _coerce_list(ai_output.get("tags"))
        + _coerce_list(from_path.get("tags"))
        + _coerce_list(from_path.get("extra_tags"))
        + _coerce_list(raw_json.get("tags"))
    )
    environment = dedupe_list(
        _coerce_list(ai_output.get("environment"))
        + _coerce_list(raw_json.get("environment"))
    )
    nl = _coerce_string(ai_output.get("nl") if ai_output else raw_json.get("nl"))

    return {
        "quality": quality,
        "count": count,
        "character": character,
        "series": series,
        "artist": artist,
        "appearance": appearance,
        "tags": tags,
        "environment": environment,
        "nl": nl,
    }


def encode_special_caption_payload(payload: dict) -> str:
    return f"{ANIMA_JSON_CAPTION_PREFIX}{json.dumps(payload, ensure_ascii=False, separators=(',', ':'))}"


def decode_special_caption_payload(caption: Any) -> Optional[dict]:
    if not isinstance(caption, str) or not caption.startswith(ANIMA_JSON_CAPTION_PREFIX):
        return None
    try:
        decoded = json.loads(caption[len(ANIMA_JSON_CAPTION_PREFIX) :])
    except Exception:
        return None
    if not isinstance(decoded, dict):
        return None
    return normalize_caption_json(decoded)


def load_special_caption_from_json_path(json_path: Path | str) -> Optional[str]:
    raw_json = load_caption_json(json_path)
    if raw_json is None:
        return None
    return encode_special_caption_payload(normalize_caption_json(raw_json))


def _process_tag_list(tag_list: list[str], shuffle: bool, tag_dropout: float) -> list[str]:
    if not tag_list:
        return []

    result = list(tag_list)
    if shuffle:
        random.shuffle(result)

    if tag_dropout > 0:
        kept = [tag for tag in result if random.random() > tag_dropout]
        if not kept:
            kept = [random.choice(result)]
        result = kept

    return result


def build_caption_from_payload(
    payload: dict,
    *,
    shuffle_appearance: bool = True,
    shuffle_tags: bool = True,
    shuffle_environment: bool = True,
    tag_dropout: float = 0.0,
) -> str:
    normalized = normalize_caption_json(payload)

    parts: list[str] = []
    parts.extend(_coerce_list(normalized.get("quality")))

    for key in ("count", "character", "series", "artist"):
        value = _coerce_string(normalized.get(key))
        if value:
            parts.append(value)

    parts.extend(_process_tag_list(normalized.get("appearance", []), shuffle_appearance, tag_dropout))
    parts.extend(_process_tag_list(normalized.get("tags", []), shuffle_tags, tag_dropout))
    parts.extend(_process_tag_list(normalized.get("environment", []), shuffle_environment, tag_dropout))

    parts = dedupe_list(parts)
    caption = ", ".join(parts)

    nl = _coerce_string(normalized.get("nl"))
    if nl:
        caption = f"{caption}. {nl}" if caption else nl

    return caption
