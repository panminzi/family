from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..core.db import get_db
from .deps import get_current_user, get_owned_family

router = APIRouter()


@router.get("", response_model=list[schemas.FamilyOut])
def list_families(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    rows = db.execute(
        select(models.Family).where(models.Family.owner_id == user.id)
    ).scalars().all()
    return [schemas.FamilyOut.model_validate(r) for r in rows]


@router.post("", response_model=schemas.FamilyOut, status_code=201)
def create_family(
    payload: schemas.FamilyCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    family = models.Family(owner_id=user.id, name=payload.name, description=payload.description)
    db.add(family)
    db.commit()
    db.refresh(family)
    return schemas.FamilyOut.model_validate(family)


@router.get("/{family_id}", response_model=schemas.FamilyOut)
def get_family(family: models.Family = Depends(get_owned_family)):
    return schemas.FamilyOut.model_validate(family)


@router.delete("/{family_id}", status_code=204)
def delete_family(
    family: models.Family = Depends(get_owned_family),
    db: Session = Depends(get_db),
):
    db.delete(family)
    db.commit()
