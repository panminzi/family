from typing import Optional

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from .. import models
from ..core.db import get_db
from ..core.security import decode_token


def get_current_user(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> models.User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    sub = decode_token(token)
    if not sub:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid token")
    user = db.get(models.User, sub)
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "user not found")
    return user


def get_owned_family(
    family_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
) -> models.Family:
    family = db.get(models.Family, family_id)
    if family is None or family.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "family not found")
    return family


def get_owned_member(
    member_id: str,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
) -> models.FamilyMember:
    member = db.get(models.FamilyMember, member_id)
    if member is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "member not found")
    family = db.get(models.Family, member.family_id)
    if family is None or family.owner_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "member not found")
    return member
