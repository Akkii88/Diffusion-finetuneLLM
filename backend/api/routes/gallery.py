"""GET /gallery endpoint — paginated image gallery from Supabase."""
from __future__ import annotations

import os
from typing import List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel
from supabase import create_client

router = APIRouter()


class GalleryItem(BaseModel):
    id: str
    prompt: str
    negative_prompt: Optional[str] = ""
    image_url: str
    clip_score: Optional[float] = None
    seed: Optional[int] = None
    num_steps: Optional[int] = None
    guidance_scale: Optional[float] = None
    scheduler: Optional[str] = None
    generation_time_ms: Optional[int] = None
    human_rating: Optional[int] = None
    created_at: str


class GalleryResponse(BaseModel):
    items: List[GalleryItem]
    total: int
    page: int
    page_size: int


def _get_supabase():
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])


@router.get("", response_model=GalleryResponse)
async def get_gallery(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=24, ge=1, le=100),
    sort_by: str = Query(default="created_at", regex="^(created_at|clip_score|human_rating)$"),
    order: str = Query(default="desc", regex="^(asc|desc)$"),
    human_approved: Optional[bool] = Query(default=None),
) -> GalleryResponse:
    """Return paginated gallery of generated images."""
    supabase = _get_supabase()

    try:
        query = supabase.table("generations").select("*", count="exact")

        if human_approved is True:
            query = query.eq("human_rating", 1)
        elif human_approved is False:
            query = query.eq("human_rating", -1)

        offset = (page - 1) * page_size
        query = (
            query
            .order(sort_by, desc=(order == "desc"))
            .range(offset, offset + page_size - 1)
        )

        res = query.execute()
        total = res.count if res.count else 0

        return GalleryResponse(
            items=[GalleryItem(**row) for row in (res.data or [])],
            total=total,
            page=page,
            page_size=page_size,
        )
    except Exception as e:
        print(f"Connection error while fetching gallery: {e}")
        return GalleryResponse(
            items=[],
            total=0,
            page=page,
            page_size=page_size,
        )


@router.patch("/{generation_id}/rating")
async def update_rating(generation_id: str, rating: int) -> dict:
    """Update human rating (-1, 0, 1) for a generation."""
    if rating not in (-1, 0, 1):
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail="rating must be -1, 0, or 1")
    supabase = _get_supabase()
    supabase.table("generations").update({"human_rating": rating}).eq("id", generation_id).execute()
    return {"status": "updated"}
