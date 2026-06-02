from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..core.config import get_settings
from ..core.db import get_db
from ..services.storage import delete_file, save_file, storage_root
from .deps import get_owned_family, get_owned_member

router = APIRouter()


@router.get("/by-family/{family_id}", response_model=list[schemas.UploadOut])
def list_uploads(
    family: models.Family = Depends(get_owned_family),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        select(models.Upload).where(models.Upload.family_id == family.id)
    ).scalars().all()
    return [schemas.UploadOut.model_validate(u) for u in rows]


@router.post("/photo/{member_id}", response_model=schemas.UploadOut, status_code=201)
async def upload_photo(
    file: UploadFile = File(...),
    member: models.FamilyMember = Depends(get_owned_member),
    db: Session = Depends(get_db),
):
    s = get_settings()
    raw = await file.read()
    if len(raw) > s.max_upload_mb * 1024 * 1024:
        raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, "file too large")
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "expected an image")

    import io

    rel, size = save_file(member.family_id, io.BytesIO(raw), file.filename or "photo")
    up = models.Upload(
        family_id=member.family_id,
        member_id=member.id,
        kind="photo",
        filename=file.filename,
        storage_path=rel,
        mime_type=file.content_type,
        size_bytes=size,
    )
    db.add(up)
    if not member.avatar_url:
        member.avatar_url = f"/api/uploads/file/{up.id}"  # set after id is known
    db.flush()
    member.avatar_url = f"/api/uploads/file/{up.id}"
    db.commit()
    db.refresh(up)
    return schemas.UploadOut.model_validate(up)


@router.post("/text/{family_id}", response_model=schemas.UploadOut, status_code=201)
def upload_text(
    payload: schemas.TextUploadIn,
    family: models.Family = Depends(get_owned_family),
    db: Session = Depends(get_db),
):
    if payload.member_id:
        m = db.get(models.FamilyMember, payload.member_id)
        if not m or m.family_id != family.id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "member not found")

    up = models.Upload(
        family_id=family.id,
        member_id=payload.member_id,
        kind=payload.kind,
        content=payload.content,
    )
    db.add(up)
    db.commit()
    db.refresh(up)
    return schemas.UploadOut.model_validate(up)


@router.get("/file/{upload_id}")
def get_file(upload_id: str, db: Session = Depends(get_db)):
    up = db.get(models.Upload, upload_id)
    if not up or not up.storage_path:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "not found")
    full = storage_root() / up.storage_path
    if not full.exists():
        raise HTTPException(status.HTTP_404_NOT_FOUND, "missing file")
    return FileResponse(full, media_type=up.mime_type or "application/octet-stream")


@router.delete("/{upload_id}", status_code=204)
def delete_upload(upload_id: str, db: Session = Depends(get_db)):
    up = db.get(models.Upload, upload_id)
    if not up:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "not found")
    delete_file(up.storage_path)
    db.delete(up)
    db.commit()
