import logging
import os
from functools import lru_cache
from io import BytesIO
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import FileResponse, Response
from PIL import Image
from pydantic import BaseModel, Field

from mikazuki.aesthetic_labeling.service import LabelingService
from mikazuki.launch_utils import base_dir_path

router = APIRouter()
log = logging.getLogger("mikazuki.aesthetic_labeling")


def _resolve_config_path() -> Path:
    env_path = str(os.environ.get("MIKAZUKI_AESTHETIC_LABELING_CONFIG", "")).strip()
    if env_path:
        path = Path(env_path).expanduser()
        if not path.is_absolute():
            path = (base_dir_path() / path).resolve()
        else:
            path = path.resolve()
        return path
    return (base_dir_path() / "config" / "aesthetic-labeling.yaml").resolve()


@lru_cache(maxsize=1)
def get_labeling_service() -> LabelingService:
    return LabelingService(config_path=_resolve_config_path())


class NextRequest(BaseModel):
    weights: dict[str, float] | None = None
    avoid_sample_ids: list[int] | None = None
    after_sample_id: int | None = Field(default=None, ge=1)


class AnnotateRequest(BaseModel):
    sample_id: int
    aesthetic: int | None = Field(default=None, ge=1, le=5)
    composition: int | None = Field(default=None, ge=1, le=5)
    color: int | None = Field(default=None, ge=1, le=5)
    sexual: int | None = Field(default=None, ge=1, le=5)
    in_domain: int = Field(default=1, ge=0, le=1)
    content_type: str | None = "anime_illust"
    exclude_from_score_train: int = Field(default=0, ge=0, le=1)
    exclude_from_cls_train: int = Field(default=0, ge=0, le=1)
    exclude_reason: str | None = None
    note: str | None = None


class SkipRequest(BaseModel):
    sample_id: int
    in_domain: int = Field(default=1, ge=0, le=1)
    content_type: str | None = "anime_illust"
    exclude_from_score_train: int = Field(default=0, ge=0, le=1)
    exclude_from_cls_train: int = Field(default=0, ge=0, le=1)
    exclude_reason: str | None = None
    note: str | None = None


class AnnotateDimRequest(BaseModel):
    sample_id: int
    dim: str
    score: int | None = Field(default=None, ge=1, le=5)
    in_domain: int = Field(default=1, ge=0, le=1)
    content_type: str | None = "anime_illust"
    exclude_from_score_train: int = Field(default=0, ge=0, le=1)
    exclude_from_cls_train: int = Field(default=0, ge=0, le=1)
    exclude_reason: str | None = None
    note: str | None = None


class SettingsSaveRequest(BaseModel):
    config: dict


def _resample_filter():
    return getattr(getattr(Image, "Resampling", Image), "LANCZOS")


@lru_cache(maxsize=4096)
def _load_thumbnail_bytes(path_str: str, mtime_ns: int, file_size: int, max_side: int) -> bytes:
    _ = (mtime_ns, file_size)
    with Image.open(path_str) as image:
        rgb = image.convert("RGB")
        rgb.thumbnail((max_side, max_side), _resample_filter())
        buffer = BytesIO()
        rgb.save(buffer, format="WEBP", quality=82, method=4)
        return buffer.getvalue()


def _require_localhost(request: Request) -> None:
    host = (request.client.host if request.client else "").strip().lower()
    if host in {"127.0.0.1", "::1", "localhost"}:
        return
    raise HTTPException(status_code=403, detail="settings endpoints are only available from localhost")


@router.get("/aesthetic_labeling/health")
async def health():
    return {"ok": True, "mode": "aesthetic_labeling"}


@router.get("/aesthetic_labeling/config")
async def config():
    return get_labeling_service().get_public_config()


@router.get("/aesthetic_labeling/settings")
async def settings(request: Request):
    _require_localhost(request)
    return get_labeling_service().get_full_config(redact_secrets=True)


@router.post("/aesthetic_labeling/settings/save")
async def settings_save(req: SettingsSaveRequest, request: Request):
    _require_localhost(request)
    try:
        output = get_labeling_service().save_and_apply_config(req.config)
        log.info("美学标注配置已通过 WebUI 更新")
        return output
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/aesthetic_labeling/stats")
async def stats():
    return get_labeling_service().stats()


@router.get("/aesthetic_labeling/source-health")
async def source_health(refresh: int = Query(default=0, ge=0, le=1)):
    try:
        return get_labeling_service().get_source_health(refresh=bool(refresh))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/aesthetic_labeling/reindex-local")
async def reindex_local():
    try:
        output = get_labeling_service().reindex_local()
        log.info("美学标注本地索引已通过 WebUI 重建")
        return output
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/aesthetic_labeling/next")
async def next_sample(req: NextRequest):
    try:
        return get_labeling_service().next_sample(
            override_weights=req.weights,
            avoid_sample_ids=req.avoid_sample_ids,
            after_sample_id=req.after_sample_id,
        )
    except Exception as exc:
        log.warning("获取下一标注样本失败: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/aesthetic_labeling/sample/{sample_id}")
async def sample_by_id(sample_id: int):
    try:
        return get_labeling_service().get_sample(sample_id)
    except Exception as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/aesthetic_labeling/sample/{sample_id}")
async def sample_delete(sample_id: int, delete_image: bool = Query(default=True)):
    try:
        output = get_labeling_service().delete_sample(sample_id=sample_id, delete_image=delete_image)
        log.info("美学标注样本已删除。id=%s", sample_id)
        return output
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/aesthetic_labeling/last-reviewed")
async def last_reviewed(status: str | None = Query(default=None)):
    try:
        sample = get_labeling_service().get_last_reviewed_sample(status=status)
        if sample is None:
            return {"sample": None}
        return {"sample": sample}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/aesthetic_labeling/sources")
async def sources():
    try:
        return get_labeling_service().list_sources()
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/aesthetic_labeling/samples")
async def samples(
    page: int = Query(default=1, ge=1),
    size: int = Query(default=30, ge=1, le=200),
    status: str = Query(default="all"),
    source: str | None = Query(default=None),
    order: str = Query(default="desc"),
    in_domain: int | None = Query(default=None, ge=0, le=1),
    content_type: str | None = Query(default=None),
    score_dim: str | None = Query(default=None),
    score_value: int | None = Query(default=None, ge=1, le=5),
    after_id: int | None = Query(default=None, ge=1),
):
    try:
        return get_labeling_service().list_samples(
            page=page,
            size=size,
            status=status,
            source=source,
            order=order,
            in_domain=in_domain,
            content_type=content_type,
            score_dim=score_dim,
            score_value=score_value,
            after_id=after_id,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/aesthetic_labeling/annotate")
async def annotate(req: AnnotateRequest):
    try:
        get_labeling_service().annotate(
            sample_id=req.sample_id,
            aesthetic=req.aesthetic,
            composition=req.composition,
            color=req.color,
            sexual=req.sexual,
            in_domain=req.in_domain,
            content_type=req.content_type,
            exclude_from_score_train=req.exclude_from_score_train,
            exclude_from_cls_train=req.exclude_from_cls_train,
            exclude_reason=req.exclude_reason,
            note=req.note,
        )
        return {"ok": True}
    except Exception as exc:
        log.warning("提交美学标注失败: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/aesthetic_labeling/annotate-dim")
async def annotate_dim(req: AnnotateDimRequest):
    try:
        get_labeling_service().annotate_dim(
            sample_id=req.sample_id,
            dim=req.dim,
            score=req.score,
            in_domain=req.in_domain,
            content_type=req.content_type,
            exclude_from_score_train=req.exclude_from_score_train,
            exclude_from_cls_train=req.exclude_from_cls_train,
            exclude_reason=req.exclude_reason,
            note=req.note,
        )
        return {"ok": True}
    except Exception as exc:
        log.warning("提交美学单维标注失败: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/aesthetic_labeling/skip")
async def skip(req: SkipRequest):
    try:
        get_labeling_service().skip(
            sample_id=req.sample_id,
            in_domain=req.in_domain,
            content_type=req.content_type,
            exclude_from_score_train=req.exclude_from_score_train,
            exclude_from_cls_train=req.exclude_from_cls_train,
            exclude_reason=req.exclude_reason,
            note=req.note,
        )
        return {"ok": True}
    except Exception as exc:
        log.warning("跳过美学标注样本失败: %s", exc)
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/aesthetic_labeling/image/{filename}")
async def image(
    filename: str,
    thumb: int = Query(default=0, ge=0, le=1),
    thumb_size: int = Query(default=480, ge=96, le=1280),
):
    try:
        path = get_labeling_service().image_path(filename)
        if thumb:
            stat = path.stat()
            data = _load_thumbnail_bytes(
                str(path),
                int(stat.st_mtime_ns),
                int(stat.st_size),
                int(thumb_size),
            )
            return Response(
                content=data,
                media_type="image/webp",
                headers={"Cache-Control": "public, max-age=31536000, immutable"},
            )
        return FileResponse(
            str(path),
            headers={"Cache-Control": "public, max-age=31536000, immutable"},
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
