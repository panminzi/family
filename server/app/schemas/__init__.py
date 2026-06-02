from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    nickname: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(ORMModel):
    id: str
    email: EmailStr
    nickname: Optional[str] = None
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class FamilyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: Optional[str] = None


class FamilyOut(ORMModel):
    id: str
    name: str
    description: Optional[str] = None
    created_at: datetime


class MemberCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    relation: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None


class MemberUpdate(BaseModel):
    name: Optional[str] = None
    relation: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    cartoon_prompt: Optional[str] = None
    avatar_url: Optional[str] = None


class MemberProfileOut(ORMModel):
    personality: Optional[str] = None
    speaking_style: Optional[str] = None
    mood_tendency: Optional[str] = None
    catchphrases: Optional[list] = None
    raw_traits: Optional[dict] = None


class MemberOut(ORMModel):
    id: str
    family_id: str
    name: str
    relation: Optional[str] = None
    age: Optional[int] = None
    gender: Optional[str] = None
    avatar_url: Optional[str] = None
    cartoon_prompt: Optional[str] = None
    profile: Optional[MemberProfileOut] = None


class UploadOut(ORMModel):
    id: str
    family_id: str
    member_id: Optional[str] = None
    kind: str
    filename: Optional[str] = None
    mime_type: Optional[str] = None
    size_bytes: Optional[int] = None
    content: Optional[str] = None
    created_at: datetime


class TextUploadIn(BaseModel):
    member_id: Optional[str] = None
    kind: str = Field(pattern="^(text|dialog)$")
    content: str


class MessageOut(ORMModel):
    id: str
    speaker_role: str
    speaker_member_id: Optional[str] = None
    content: str
    created_at: datetime


class ConversationOut(ORMModel):
    id: str
    scene: str
    meal_type: Optional[str] = None
    title: Optional[str] = None
    triggered_by: str
    created_at: datetime
    messages: list[MessageOut] = []


class UserMessageIn(BaseModel):
    content: str
    speak_as_member_id: Optional[str] = None


class TriggerMealIn(BaseModel):
    meal_type: Optional[str] = None  # breakfast|lunch|dinner; auto-pick if None
