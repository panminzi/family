from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from .. import models, schemas
from ..core.db import get_db
from ..core.security import create_access_token, hash_password, verify_password
from .deps import get_current_user

router = APIRouter()


@router.post("/register", response_model=schemas.TokenOut, status_code=201)
def register(payload: schemas.UserCreate, db: Session = Depends(get_db)):
    existing = db.execute(
        select(models.User).where(models.User.email == payload.email)
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "email already registered")

    user = models.User(
        email=payload.email,
        password_hash=hash_password(payload.password),
        nickname=payload.nickname,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return schemas.TokenOut(access_token=create_access_token(user.id), user=schemas.UserOut.model_validate(user))


@router.post("/login", response_model=schemas.TokenOut)
def login(payload: schemas.UserLogin, db: Session = Depends(get_db)):
    user = db.execute(
        select(models.User).where(models.User.email == payload.email)
    ).scalar_one_or_none()
    if user is None or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid credentials")
    return schemas.TokenOut(access_token=create_access_token(user.id), user=schemas.UserOut.model_validate(user))


@router.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(get_current_user)):
    return schemas.UserOut.model_validate(user)
