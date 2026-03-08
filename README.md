# Diffusion Fine-tuning Platform

<p align="center">
  <img src="https://img.shields.io/badge/Stable%20Diffusion-LoRA-blue" alt="Stable Diffusion LoRA">
  <img src="https://img.shields.io/badge/FastAPI-Backend-green" alt="FastAPI">
  <img src="https://img.shields.io/badge/Next.js-Frontend-black" alt="Next.js">
  <img src="https://img.shields.io/badge/Supabase-Database-orange" alt="Supabase">
</p>

A research-grade, full-stack platform for parameter-efficient fine-tuning (LoRA) and deployment of Stable Diffusion models on custom domain datasets.

---

## Features

### Training Pipeline
- **LoRA Fine-tuning**: Parameter-efficient fine-tuning using PEFT
- **Custom Dataset Support**: Upload and manage domain-specific image datasets
- **Real-time Progress**: Live training progress tracking via Supabase
- **Checkpoint Saving**: Automatic checkpoint creation during training
- **Validation Images**: Generate validation images at configurable intervals

### Generation
- **Text-to-Image**: Generate images from text prompts
- **Negative Prompts**: Exclude unwanted elements from generation
- **Guidance Scale**: Control prompt adherence vs. creativity
- **Custom Schedulers**: Multiple scheduler options (DDPM, DDIM, etc.)
- **Seed Control**: Reproducible generations

### Evaluation
- **CLIP Score**: Automatic quality assessment using CLIP
- **Human Rating**: Gallery with user ratings
- **Side-by-Side Comparison**: Compare base model vs. fine-tuned outputs

### Gallery
- **Image Storage**: Supabase-powered image storage
- **Rating System**: Community-driven quality feedback
- **Metadata Tracking**: Full generation parameters stored

### Dataset Management
- **Upload Images**: Batch upload training images
- **Image Processing**: Automatic resizing and preprocessing
- **Dataset Versioning**: Track different dataset versions

---

## System Architecture

```
USER INTERFACE (Next.js)
  ├── Home
  ├── Training
  ├── Generate
  ├── Gallery
  └── Datasets
         │
         ▼
   Next.js API (Port 3000)
         │
    ┌────┴────┐
    │         │
Generate   Training
    │         │
    └────┬────┘
         │
   FastAPI Backend (Port 8000)
    ┌────┼────┐
    │    │    │
Inference LoRA  Safety
Trainer Filter  │
    │    │    │
    └────┼────┘
         │
   Supabase Database
  - generations
  - training_runs
  - datasets
```

---

## Theory: How LoRA Works

### What is LoRA?

**Low-Rank Adaptation (LoRA)** is a parameter-efficient fine-tuning technique that adds small trainable rank-decomposition matrices to pretrained model weights while keeping the original weights frozen.

### Mathematical Background

Given a pretrained weight matrix W₀ ∈ ℝᵈˣᵏ, LoRA represents the update as:

**W = W₀ + ΔW = W₀ + BA**

Where:
- B ∈ ℝᵈˣʳ
- A ∈ ℝʳˣᵏ
- r << min(d,k) (the rank, typically 4-32)

### Why LoRA?

| Aspect | Full Fine-tuning | LoRA |
|--------|-----------------|------|
| Parameters Updated | 100% | ~0.5-2% |
| GPU Memory | High | Low |
| Training Speed | Slow | Fast |
| Model Size | Full model | ~100MB |
| Catastrophic Forgetting | High risk | Minimal |

### Training Process

1. **Input**: Sample images from domain dataset
2. **Encode**: Convert images to latent space using VAE
3. **Add Noise**: Apply forward diffusion process
4. **Predict**: UNet predicts noise (with LoRA adapters)
5. **Compute Loss**: MSE between predicted and actual noise
6. **Backprop**: Only update LoRA parameters
7. **Repeat**: For N training steps

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14, React, Tailwind CSS |
| Backend | FastAPI, Python 3.10+ |
| ML Framework | PyTorch, Diffusers, PEFT |
| Database | Supabase (PostgreSQL) |
| Storage | Supabase Storage |
| Deployment | Docker, Docker Compose |

---

## Quick Start

### Prerequisites

- Python 3.10+
- Node.js 18+
- CUDA-capable GPU (recommended for training)
- Supabase account

### Option 1: Run Locally

```bash
# Clone and navigate to project
cd diffusion-finetune

# Install Python dependencies
cd backend
pip install -r requirements.txt

# Install Node dependencies
cd ../frontend
npm install

# Start both services
cd ..
./start.sh
```

The platform will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000

### Option 2: Docker Compose

```bash
# Configure environment variables
cp .env.local .env
# Edit .env with your Supabase credentials

# Start all services
docker-compose up --build
```

---

## Project Structure

```
diffusion-finetune/
├── backend/                     # FastAPI backend
│   ├── api/
│   │   ├── main.py             # App entry point
│   │   ├── routes/
│   │   │   ├── generate.py    # Image generation endpoints
│   │   │   ├── training.py    # Training control endpoints
│   │   │   ├── gallery.py     # Gallery management
│   │   │   ├── metrics.py     # Evaluation metrics
│   │   │   └── evaluation.py  # Model evaluation
│   │   └── middleware/
│   │       └── safety.py      # NSFW content filtering
│   ├── ml/
│   │   ├── train_lora.py      # LoRA training script
│   │   ├── inference.py       # Image generation pipeline
│   │   ├── dataset.py         # Dataset loading
│   │   └── evaluate.py        # Evaluation metrics
│   ├── models/
│   │   └── lora_weights/      # Saved LoRA adapters
│   └── configs/
│       └── training_config.yaml
├── frontend/                    # Next.js frontend
│   ├── app/
│   │   ├── page.tsx           # Home/Dashboard
│   │   ├── training/          # Training UI
│   │   ├── generate/         # Generation UI
│   │   ├── gallery/           # Image gallery
│   │   ├── datasets/          # Dataset management
│   │   └── evaluation/        # Model evaluation
│   ├── components/            # Reusable UI components
│   └── lib/                   # API utilities
├── supabase_schema.sql         # Database schema
├── docker-compose.yml          # Docker orchestration
└── start.sh                   # Quick start script
```

---

## API Endpoints

### Generation
| Endpoint | Method | Description |
|----------|--------|-------------|
| /generate | POST | Generate image from prompt |
| /generate/batch | POST | Generate multiple images |

### Training
| Endpoint | Method | Description |
|----------|--------|-------------|
| /training/start | POST | Start training run |
| /training/stop | POST | Stop running training |
| /training/stream-logs | GET | SSE for live logs |
| /training/status/{id} | GET | Get training status |

### Gallery
| Endpoint | Method | Description |
|----------|--------|-------------|
| /gallery | GET | List all generations |
| /gallery/{id} | GET | Get generation details |
| /gallery/{id}/rate | POST | Rate a generation |

### Datasets
| Endpoint | Method | Description |
|----------|--------|-------------|
| /datasets | GET | List datasets |
| /datasets | POST | Create new dataset |
| /datasets/{id}/images | POST | Upload images |
| /datasets/{id} | DELETE | Delete dataset |

---

## Database Schema

### Tables

```sql
-- Generated images
generations (
  id, prompt, negative_prompt, image_url,
  clip_score, seed, num_steps, guidance_scale,
  human_rating, created_at
)

-- Training runs
training_runs (
  id, run_name, status, total_steps, current_step,
  final_loss, learning_rate, lora_rank,
  fid_score, clip_score, config, training_log
)

-- Datasets
datasets (
  id, name, description, image_count, created_at
)

dataset_images (
  id, dataset_id, filename, storage_path,
  file_size, width, height
)
```

---

## License

MIT License

---

## Acknowledgments

- Hugging Face Diffusers
- PEFT Library
- Stable Diffusion
