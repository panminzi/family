import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.db import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class User(Base, TimestampMixin):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    nickname: Mapped[Optional[str]] = mapped_column(String(64))

    families: Mapped[list["Family"]] = relationship(back_populates="owner", cascade="all, delete-orphan")


class Family(Base, TimestampMixin):
    __tablename__ = "families"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    owner: Mapped[User] = relationship(back_populates="families")
    members: Mapped[list["FamilyMember"]] = relationship(
        back_populates="family", cascade="all, delete-orphan"
    )
    conversations: Mapped[list["Conversation"]] = relationship(
        back_populates="family", cascade="all, delete-orphan"
    )


class FamilyMember(Base, TimestampMixin):
    __tablename__ = "family_members"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    family_id: Mapped[str] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(80), nullable=False)
    relation: Mapped[Optional[str]] = mapped_column(String(40))
    age: Mapped[Optional[int]] = mapped_column()
    gender: Mapped[Optional[str]] = mapped_column(String(20))
    avatar_url: Mapped[Optional[str]] = mapped_column(String(500))
    cartoon_prompt: Mapped[Optional[str]] = mapped_column(Text)

    family: Mapped[Family] = relationship(back_populates="members")
    profile: Mapped[Optional["MemberProfile"]] = relationship(
        back_populates="member", cascade="all, delete-orphan", uselist=False
    )
    uploads: Mapped[list["Upload"]] = relationship(
        back_populates="member", cascade="all, delete-orphan"
    )


class MemberProfile(Base, TimestampMixin):
    __tablename__ = "member_profiles"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    member_id: Mapped[str] = mapped_column(
        ForeignKey("family_members.id", ondelete="CASCADE"), unique=True
    )
    personality: Mapped[Optional[str]] = mapped_column(Text)
    speaking_style: Mapped[Optional[str]] = mapped_column(Text)
    mood_tendency: Mapped[Optional[str]] = mapped_column(String(120))
    catchphrases: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    raw_traits: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)

    member: Mapped[FamilyMember] = relationship(back_populates="profile")


class Upload(Base, TimestampMixin):
    __tablename__ = "uploads"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    family_id: Mapped[str] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"), index=True)
    member_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("family_members.id", ondelete="CASCADE"), index=True
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False)  # photo|text|dialog
    filename: Mapped[Optional[str]] = mapped_column(String(255))
    storage_path: Mapped[Optional[str]] = mapped_column(String(500))
    content: Mapped[Optional[str]] = mapped_column(Text)
    mime_type: Mapped[Optional[str]] = mapped_column(String(100))
    size_bytes: Mapped[Optional[int]] = mapped_column()

    member: Mapped[Optional[FamilyMember]] = relationship(back_populates="uploads")


class Conversation(Base, TimestampMixin):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    family_id: Mapped[str] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"), index=True)
    scene: Mapped[str] = mapped_column(String(40), default="meal")
    meal_type: Mapped[Optional[str]] = mapped_column(String(20))  # breakfast|lunch|dinner
    title: Mapped[Optional[str]] = mapped_column(String(200))
    triggered_by: Mapped[str] = mapped_column(String(20), default="schedule")  # schedule|user

    family: Mapped[Family] = relationship(back_populates="conversations")
    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )


class Message(Base, TimestampMixin):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), index=True
    )
    speaker_member_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("family_members.id", ondelete="SET NULL")
    )
    speaker_role: Mapped[str] = mapped_column(String(20), default="member")  # member|user|system
    content: Mapped[str] = mapped_column(Text, nullable=False)

    conversation: Mapped[Conversation] = relationship(back_populates="messages")


class ScheduledJob(Base, TimestampMixin):
    __tablename__ = "scheduled_jobs"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    family_id: Mapped[str] = mapped_column(ForeignKey("families.id", ondelete="CASCADE"), index=True)
    cron: Mapped[str] = mapped_column(String(60), nullable=False)
    scene: Mapped[str] = mapped_column(String(40), default="meal")
    meal_type: Mapped[str] = mapped_column(String(20))
    enabled: Mapped[bool] = mapped_column(default=True)
    last_run_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
