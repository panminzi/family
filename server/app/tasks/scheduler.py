from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select

from ..core.config import get_settings
from ..core.db import session_scope
from .. import models
from ..services.conversation import generate_meal_conversation

log = logging.getLogger(__name__)
_scheduler: Optional[AsyncIOScheduler] = None

_MEAL_TYPES = ["breakfast", "lunch", "dinner"]


def _meal_type_for(idx: int) -> str:
    return _MEAL_TYPES[idx] if idx < len(_MEAL_TYPES) else "meal"


async def fire_meal_for_all_families(meal_type: str) -> None:
    log.info("scheduler firing meal=%s at %s", meal_type, datetime.now().isoformat())
    with session_scope() as db:
        families = db.execute(select(models.Family)).scalars().all()
        for family in families:
            try:
                await generate_meal_conversation(
                    db, family, meal_type=meal_type, triggered_by="schedule"
                )
            except Exception as e:
                log.exception("meal generation failed for family=%s: %s", family.id, e)


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        s = get_settings()
        _scheduler = AsyncIOScheduler(timezone=s.scheduler_timezone)
    return _scheduler


def start_scheduler() -> None:
    s = get_settings()
    sched = get_scheduler()
    if sched.running:
        return

    for idx, hhmm in enumerate(s.meal_time_list):
        try:
            hh, mm = hhmm.split(":")
            meal = _meal_type_for(idx)
            sched.add_job(
                fire_meal_for_all_families,
                CronTrigger(hour=int(hh), minute=int(mm)),
                kwargs={"meal_type": meal},
                id=f"meal-{meal}",
                replace_existing=True,
            )
            log.info("scheduled %s at %s", meal, hhmm)
        except ValueError:
            log.warning("invalid meal time entry: %s", hhmm)

    sched.start()


def shutdown_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
    _scheduler = None
