from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .. import models, schemas
from ..core.db import get_db
from ..services.conversation import append_user_message, generate_meal_conversation
from .deps import get_owned_family

router = APIRouter()


@router.get("/by-family/{family_id}", response_model=list[schemas.ConversationOut])
def list_conversations(
    family: models.Family = Depends(get_owned_family),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        select(models.Conversation)
        .where(models.Conversation.family_id == family.id)
        .options(selectinload(models.Conversation.messages))
        .order_by(models.Conversation.created_at.desc())
    ).scalars().all()
    return [schemas.ConversationOut.model_validate(c) for c in rows]


@router.get("/{conversation_id}", response_model=schemas.ConversationOut)
def get_conversation(conversation_id: str, db: Session = Depends(get_db)):
    conv = db.get(models.Conversation, conversation_id)
    if not conv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "not found")
    return schemas.ConversationOut.model_validate(conv)


@router.post("/by-family/{family_id}/trigger-meal", response_model=schemas.ConversationOut, status_code=201)
async def trigger_meal(
    payload: schemas.TriggerMealIn,
    family: models.Family = Depends(get_owned_family),
    db: Session = Depends(get_db),
):
    if not family.members:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "family has no members")
    conv = await generate_meal_conversation(
        db, family, meal_type=payload.meal_type, triggered_by="user"
    )
    db.commit()
    db.refresh(conv)
    return schemas.ConversationOut.model_validate(conv)


@router.post("/{conversation_id}/messages", response_model=schemas.ConversationOut)
async def post_message(
    conversation_id: str,
    payload: schemas.UserMessageIn,
    db: Session = Depends(get_db),
):
    conv = db.get(models.Conversation, conversation_id)
    if not conv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "not found")
    await append_user_message(
        db,
        conv,
        payload.content,
        speak_as_member_id=payload.speak_as_member_id,
    )
    db.commit()
    db.refresh(conv)
    return schemas.ConversationOut.model_validate(conv)


@router.delete("/{conversation_id}", status_code=204)
def delete_conversation(conversation_id: str, db: Session = Depends(get_db)):
    conv = db.get(models.Conversation, conversation_id)
    if not conv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "not found")
    db.delete(conv)
    db.commit()
