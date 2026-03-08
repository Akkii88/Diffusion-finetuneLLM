"""POST /generate endpoint — text-to-image with LoRA fine-tuned model."""
from __future__ import annotations

import io
import os
import time
import uuid
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field, field_validator
from supabase import create_client

router = APIRouter()


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------

class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=300)
    negative_prompt: str = Field(default="")
    num_steps: int = Field(default=20, ge=1, le=150)
    guidance_scale: float = Field(default=7.5, ge=1.0, le=30.0)
    seed: int = Field(default=-1)  # -1 = random
    scheduler: str = Field(default="ddim")

    @field_validator("scheduler")
    @classmethod
    def validate_scheduler(cls, v: str) -> str:
        allowed = {"ddpm", "ddim", "dpm++"}
        if v not in allowed:
            raise ValueError(f"scheduler must be one of {allowed}")
        return v


class GenerateResponse(BaseModel):
    image_url: str
    clip_score: float
    seed_used: int
    generation_time_ms: int
    generation_id: str


# ---------------------------------------------------------------------------
# Supabase client (lazy-loaded per request so env vars are resolved)
# ---------------------------------------------------------------------------

def _get_supabase():
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    return create_client(url, key)


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("", response_model=GenerateResponse)
async def generate_image(body: GenerateRequest, request: Request) -> GenerateResponse:
    """Generate an image from a prompt using the fine-tuned diffusion model."""
    from api.middleware.safety import SafetyFilter  # noqa: PLC0415

    safety = SafetyFilter()

    # 1. Prompt-level safety check
    is_safe, reason = await safety.check_prompt(body.prompt)
    if not is_safe:
        try:
            supabase = _get_supabase()
            supabase.table("safety_logs").insert({
                "prompt": body.prompt,
                "filter_type": "prompt",
                "reason": reason,
            }).execute()
        except Exception:
            pass  # Table may not exist
        raise HTTPException(status_code=400, detail=f"Prompt flagged: {reason}")

    # 2. Retrieve pipeline from app state
    pipeline = request.app.state.pipeline
    
    if pipeline is None:
        raise HTTPException(
            status_code=503,
            detail="ML pipeline not loaded. Backend requires GPU and ML libraries."
        )

    # 3. Generate image
    t0 = time.perf_counter()
    result = pipeline.generate(
        prompt=body.prompt,
        negative_prompt=body.negative_prompt,
        num_inference_steps=body.num_steps,
        guidance_scale=body.guidance_scale,
        seed=body.seed,
        scheduler=body.scheduler,
    )
    generation_time_ms = int((time.perf_counter() - t0) * 1000)

    pil_image = result["image"]
    seed_used = result["seed_used"]

    # 4. Image-level NSFW check
    is_image_safe, img_reason = await safety.check_image(pil_image)
    if not is_image_safe:
        try:
            supabase = _get_supabase()
            supabase.table("safety_logs").insert({
                "prompt": body.prompt,
                "filter_type": "image",
                "reason": img_reason,
            }).execute()
        except Exception:
            pass  # Table may not exist
        raise HTTPException(status_code=400, detail="Generated image flagged by safety filter.")

    # 5. Compute CLIP score
    from ml.evaluate import compute_clip_score  # noqa: PLC0415
    clip_score = compute_clip_score(pil_image, body.prompt)

    # 6. Upload to Supabase Storage
    img_bytes = io.BytesIO()
    pil_image.save(img_bytes, format="PNG")
    img_bytes.seek(0)

    generation_id = str(uuid.uuid4())
    storage_path = f"generated/{generation_id}.png"
    supabase = _get_supabase()

    supabase.storage.from_("generated-images").upload(
        path=storage_path,
        file=img_bytes.read(),
        file_options={"content-type": "image/png"},
    )

    public_url = supabase.storage.from_("generated-images").get_public_url(storage_path)

    # 7. Save metadata to DB
    supabase.table("generations").insert({
        "id": generation_id,
        "prompt": body.prompt,
        "negative_prompt": body.negative_prompt,
        "image_url": public_url,
        "clip_score": clip_score,
        "seed": seed_used,
        "num_steps": body.num_steps,
        "guidance_scale": body.guidance_scale,
        "scheduler": body.scheduler,
        "generation_time_ms": generation_time_ms,
    }).execute()

    return GenerateResponse(
        image_url=public_url,
        clip_score=round(clip_score, 4),
        seed_used=seed_used,
        generation_time_ms=generation_time_ms,
        generation_id=generation_id,
    )
