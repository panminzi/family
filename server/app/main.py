import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api import api_router
from .core.config import get_settings
from .core.db import Base, engine
from .tasks.scheduler import shutdown_scheduler, start_scheduler

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # bootstrap schema for first-time runs; production should use alembic
    Base.metadata.create_all(bind=engine)
    start_scheduler()
    log.info("application started")
    try:
        yield
    finally:
        shutdown_scheduler()
        log.info("application stopped")


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(
        title="Cartoon Family API",
        version="0.1.0",
        description="线上卡通家庭智能互动系统 - 后端服务",
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health", tags=["meta"])
    def health():
        return {"status": "ok", "env": s.app_env}

    app.include_router(api_router, prefix="/api")
    return app


app = create_app()
