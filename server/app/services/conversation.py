from __future__ import annotations

import json
import logging
import random
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from .. import models
from .ai import get_ai

log = logging.getLogger(__name__)

MEAL_LABEL = {"breakfast": "早餐", "lunch": "午餐", "dinner": "晚餐"}


def _pick_meal_type(now: Optional[datetime] = None) -> str:
    now = now or datetime.now()
    h = now.hour
    if h < 10:
        return "breakfast"
    if h < 15:
        return "lunch"
    return "dinner"


def _member_card(m: models.FamilyMember) -> dict:
    p = m.profile
    return {
        "id": m.id,
        "name": m.name,
        "relation": m.relation,
        "personality": (p.personality if p else None),
        "speaking_style": (p.speaking_style if p else None),
        "catchphrases": (p.catchphrases if p else []) or [],
    }


async def generate_meal_conversation(
    db: Session,
    family: models.Family,
    *,
    meal_type: Optional[str] = None,
    triggered_by: str = "schedule",
    rounds: int = 3,
) -> models.Conversation:
    ai = get_ai()
    meal_type = meal_type or _pick_meal_type()
    meal_label = MEAL_LABEL.get(meal_type, "用餐")

    members = (
        db.execute(
            select(models.FamilyMember)
            .where(models.FamilyMember.family_id == family.id)
            .options(selectinload(models.FamilyMember.profile))
        )
        .scalars()
        .all()
    )
    if not members:
        raise ValueError("family has no members")

    cards = [_member_card(m) for m in members]
    speakers_desc = "\n".join(
        f"- {c['name']}（{c['relation'] or '家人'}）：性格：{c['personality'] or '未知'}；"
        f"说话风格：{c['speaking_style'] or '未知'}；口头禅：{'/'.join(c['catchphrases']) or '无'}"
        for c in cards
    )

    system = (
        f"你是一个家庭对话剧情生成器。现在是{meal_label}时间，家庭成员围坐在餐桌前。"
        "请根据每个成员的性格和说话风格，生成自然、温暖、有生活感的多人对话。"
        "对话要符合家庭日常氛围（关心、吐槽、闲聊、互动）。"
        "返回严格 JSON：{messages: [{name: string, content: string}, ...]}。"
        f"生成 {rounds * max(2, len(members))} 条消息，避免重复。"
    )
    user = f"家庭名：{family.name}\n成员：\n{speakers_desc}"

    raw = await ai.chat(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=0.85,
        json_mode=True,
        max_tokens=1500,
    )
    try:
        payload = json.loads(raw)
        msgs = payload.get("messages") or []
    except json.JSONDecodeError:
        log.warning("conversation JSON parse failed, using fallback")
        msgs = _fallback_messages(cards, meal_label)

    if not msgs:
        msgs = _fallback_messages(cards, meal_label)

    conv = models.Conversation(
        family_id=family.id,
        scene="meal",
        meal_type=meal_type,
        title=f"{meal_label}时光",
        triggered_by=triggered_by,
    )
    db.add(conv)
    db.flush()

    name_to_id = {m.name: m.id for m in members}
    for m in msgs:
        name = (m.get("name") or "").strip()
        content = (m.get("content") or "").strip()
        if not content:
            continue
        db.add(
            models.Message(
                conversation_id=conv.id,
                speaker_member_id=name_to_id.get(name),
                speaker_role="member",
                content=content,
            )
        )
    db.flush()
    return conv


def _fallback_messages(cards: list[dict], meal_label: str) -> list[dict]:
    out = []
    lines = [
        f"开饭啦，今天的{meal_label}有点丰盛～",
        "快趁热吃，凉了就不好吃了。",
        "你今天怎么样呀？",
        "我今天有点累，先吃点东西。",
        "多吃点菜，别光吃肉。",
    ]
    for i, line in enumerate(lines):
        c = cards[i % len(cards)]
        catch = (c["catchphrases"] or [""])[0]
        out.append({"name": c["name"], "content": (catch + " " + line).strip()})
    return out


async def append_user_message(
    db: Session,
    conversation: models.Conversation,
    user_content: str,
    *,
    speak_as_member_id: Optional[str] = None,
    reply_rounds: int = 2,
) -> list[models.Message]:
    """Add a user message and let one or two members reply."""
    ai = get_ai()

    user_msg = models.Message(
        conversation_id=conversation.id,
        speaker_role="user",
        speaker_member_id=speak_as_member_id,
        content=user_content,
    )
    db.add(user_msg)
    db.flush()

    members = (
        db.execute(
            select(models.FamilyMember)
            .where(models.FamilyMember.family_id == conversation.family_id)
            .options(selectinload(models.FamilyMember.profile))
        )
        .scalars()
        .all()
    )
    if not members:
        return [user_msg]

    history = [
        {"role": "user" if msg.speaker_role == "user" else "assistant", "content": msg.content}
        for msg in conversation.messages[-12:]
    ]
    cards = [_member_card(m) for m in members]
    speakers_desc = "\n".join(
        f"- {c['name']}：{c['personality'] or ''}（{c['speaking_style'] or ''}）" for c in cards
    )

    picks = random.sample(members, k=min(reply_rounds, len(members)))
    new_msgs: list[models.Message] = [user_msg]
    for member in picks:
        system = (
            f"你是 {member.name}，正在和家人一起{conversation.title or '吃饭'}。"
            f"以你的性格说话：{(member.profile.personality if member.profile else '亲切自然')}。"
            f"口头禅：{'/'.join((member.profile.catchphrases if member.profile else []) or []) or '无'}。"
            "只输出一句你的回应，不要扮演旁白，不要使用引号。"
        )
        prompt = [{"role": "system", "content": system}]
        prompt.append({"role": "system", "content": "全体家庭成员卡片：\n" + speakers_desc})
        prompt.extend(history)
        prompt.append({"role": "user", "content": user_content})
        reply = await ai.chat(prompt, temperature=0.9, max_tokens=180)
        msg = models.Message(
            conversation_id=conversation.id,
            speaker_member_id=member.id,
            speaker_role="member",
            content=reply.strip(),
        )
        db.add(msg)
        db.flush()
        new_msgs.append(msg)
        history.append({"role": "assistant", "content": reply})
    return new_msgs
