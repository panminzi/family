from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..core.db import get_db
from ..services.personality import build_cartoon_prompt, extract_profile
from .deps import get_owned_family, get_owned_member

router = APIRouter()


@router.get("/by-family/{family_id}", response_model=list[schemas.MemberOut])
def list_members(
    family: models.Family = Depends(get_owned_family),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        select(models.FamilyMember).where(models.FamilyMember.family_id == family.id)
    ).scalars().all()
    return [schemas.MemberOut.model_validate(m) for m in rows]


@router.post("/by-family/{family_id}", response_model=schemas.MemberOut, status_code=201)
def create_member(
    payload: schemas.MemberCreate,
    family: models.Family = Depends(get_owned_family),
    db: Session = Depends(get_db),
):
    m = models.FamilyMember(
        family_id=family.id,
        name=payload.name,
        relation=payload.relation,
        age=payload.age,
        gender=payload.gender,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return schemas.MemberOut.model_validate(m)


@router.get("/{member_id}", response_model=schemas.MemberOut)
def get_member(member: models.FamilyMember = Depends(get_owned_member)):
    return schemas.MemberOut.model_validate(member)


@router.patch("/{member_id}", response_model=schemas.MemberOut)
def update_member(
    payload: schemas.MemberUpdate,
    member: models.FamilyMember = Depends(get_owned_member),
    db: Session = Depends(get_db),
):
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(member, k, v)
    db.commit()
    db.refresh(member)
    return schemas.MemberOut.model_validate(member)


@router.delete("/{member_id}", status_code=204)
def delete_member(
    member: models.FamilyMember = Depends(get_owned_member),
    db: Session = Depends(get_db),
):
    db.delete(member)
    db.commit()


@router.post("/{member_id}/build-profile", response_model=schemas.MemberOut)
async def build_profile(
    member: models.FamilyMember = Depends(get_owned_member),
    db: Session = Depends(get_db),
):
    await extract_profile(db, member)
    db.commit()
    db.refresh(member)
    return schemas.MemberOut.model_validate(member)


@router.post("/{member_id}/build-cartoon-prompt", response_model=schemas.MemberOut)
async def build_cartoon(
    member: models.FamilyMember = Depends(get_owned_member),
    db: Session = Depends(get_db),
):
    prompt = await build_cartoon_prompt(member)
    member.cartoon_prompt = prompt
    db.commit()
    db.refresh(member)
    return schemas.MemberOut.model_validate(member)
