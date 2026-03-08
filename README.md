# Scaffolding Diffusion Platform

A research-grade, full-stack platform for parameter-efficient fine-tuning (LoRA) and deployment of Stable Diffusion models on custom domain datasets.

## 🚀 Quick Start

To easily run the entire platform (Frontend, Backend APIs, etc.) concurrently without Docker, simply run the `start.sh` script from your terminal:

```bash
./start.sh
```

**What this does:**
- Activates your python virtual environment.
- Launches the FastAPI backend on `http://localhost:8000`.
- Launches the Next.js frontend on `http://localhost:3000`.
- Gives you a clean output and handles shutting down both services when you press `Ctrl+C`.
