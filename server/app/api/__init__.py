from fastapi import APIRouter

from . import auth, families, members, uploads, conversations

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(families.router, prefix="/families", tags=["families"])
api_router.include_router(members.router, prefix="/members", tags=["members"])
api_router.include_router(uploads.router, prefix="/uploads", tags=["uploads"])
api_router.include_router(conversations.router, prefix="/conversations", tags=["conversations"])
