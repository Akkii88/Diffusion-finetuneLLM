"""FastAPI main application entry point."""
from __future__ import annotations

import os
import time
from contextlib import asynccontextmanager
from typing import AsyncGenerator

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

load_dotenv(".env.backend")

# ---------------------------------------------------------------------------
# Lifespan — load diffusion pipeline once at startup
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Load ML pipeline on startup, release on shutdown."""
    try:
        from ml.inference import InferencePipeline  # noqa: PLC0415

        pipeline = InferencePipeline(
            model_path=os.getenv("MODEL_PATH", "./models/lora_weights"),
            base_model=os.getenv("BASE_MODEL", "runwayml/stable-diffusion-v1-5"),
            device=os.getenv("DEVICE", "cuda"),
        )
        pipeline.load()
        app.state.pipeline = pipeline
        print("✅ Diffusion pipeline loaded and ready.")
    except Exception as e:
        print(f"⚠️  Could not load diffusion pipeline: {e}")
        print("   Generation endpoints will return errors.")
        app.state.pipeline = None
    yield
    if hasattr(app.state, 'pipeline') and app.state.pipeline:
        print("🛑 Shutting down — releasing pipeline.")
        del app.state.pipeline


# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Domain-Specific Image Generator API",
    description="FastAPI backend for LoRA fine-tuned Stable Diffusion inference.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Request timing middleware
# ---------------------------------------------------------------------------

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    elapsed = round((time.perf_counter() - start) * 1000, 2)
    response.headers["X-Process-Time-Ms"] = str(elapsed)
    return response


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

from api.routes import generate, gallery, metrics, training  # noqa: E402, PLC0415

app.include_router(generate.router, prefix="/generate", tags=["generate"])
app.include_router(gallery.router, prefix="/gallery", tags=["gallery"])
app.include_router(metrics.router, prefix="/metrics", tags=["metrics"])
app.include_router(training.router, prefix="/training", tags=["training"])


@app.get("/health", tags=["health"])
async def health_check() -> dict:
    return {"status": "ok", "version": "1.0.0"}


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {str(exc)}"},
    )
