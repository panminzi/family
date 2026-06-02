from __future__ import annotations

import json
import logging
from typing import Optional

from sqlalchemy.orm import Session

from .. import models
from .ai import get_ai

log = logging.getLogger(__name__)


def _gather_member_corpus(db: Session, member: models.FamilyMember) -> str:
    parts: list[str] = []
    if member.relation:
        parts.append(f"家庭关系：{member.relation}")
    if member.age is not None:
        parts.append(f"年龄：{member.age}")
    if member.gender:
        parts.append(f"性别：{member.gender}")
    for u in member.uploads:
        if u.kind in ("text", "dialog") and u.content:
            parts.append(u.content)
    return "\n---\n".join(parts).strip()


async def extract_profile(db: Session, member: models.FamilyMember) -> models.MemberProfile:
    ai = get_ai()
    corpus = _gather_member_corpus(db, member) or f"姓名：{member.name}"

    system = (
        "你是一个家庭人物画像建模助手。根据用户提供的家庭成员资料，"
        "抽象出该成员的性格、说话风格、情绪倾向和口头禅。"
        "只返回严格的 JSON，字段：personality (string), speaking_style (string), "
        "mood_tendency (string), catchphrases (array of strings), raw_traits (object)。"
    )
    user = f"成员姓名：{member.name}\n资料：\n{corpus}"

    raw = await ai.chat(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=0.4,
        json_mode=True,
    )
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        log.warning("AI profile JSON parse failed, falling back to defaults: %s", raw[:200])
        data = {}

    profile = member.profile or models.MemberProfile(member_id=member.id)
    profile.personality = data.get("personality") or profile.personality or "性格平和、关心家人"
    profile.speaking_style = data.get("speaking_style") or profile.speaking_style or "亲切自然"
    profile.mood_tendency = data.get("mood_tendency") or profile.mood_tendency or "平稳"
    profile.catchphrases = data.get("catchphrases") or profile.catchphrases or []
    profile.raw_traits = data.get("raw_traits") or profile.raw_traits or {}

    if member.profile is None:
        db.add(profile)
        member.profile = profile
    db.flush()
    return profile


async def build_cartoon_prompt(member: models.FamilyMember) -> str:
    ai = get_ai()
    profile = member.profile
    desc = []
    if profile:
        if profile.personality:
            desc.append(f"性格：{profile.personality}")
        if profile.speaking_style:
            desc.append(f"风格：{profile.speaking_style}")
    desc.append(f"姓名：{member.name}")
    if member.relation:
        desc.append(f"关系：{member.relation}")
    if member.age is not None:
        desc.append(f"年龄：{member.age}")

    system = (
        "你是一个卡通角色提示词生成器。根据家庭成员特征，输出一段适合 AI 绘图的英文提示词，"
        "要求：可爱、温暖、家庭风、扁平卡通风格、headshot、高分辨率。只返回提示词，不要解释。"
    )
    return await ai.chat(
        [
            {"role": "system", "content": system},
            {"role": "user", "content": " / ".join(desc)},
        ],
        temperature=0.6,
        max_tokens=200,
    )
