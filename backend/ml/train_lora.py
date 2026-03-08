"""Full LoRA fine-tuning script for Stable Diffusion using PEFT + diffusers."""
from __future__ import annotations

import json
import logging
import math
import os
import random
import time
from pathlib import Path
from typing import Optional

import torch
import torch.nn.functional as F
from accelerate import Accelerator
from accelerate.logging import get_logger
from accelerate.utils import ProjectConfiguration, set_seed
from diffusers import (
    AutoencoderKL,
    DDPMScheduler,
    StableDiffusionPipeline,
    UNet2DConditionModel,
)
from diffusers.optimization import get_scheduler
from omegaconf import OmegaConf
from peft import LoraConfig, get_peft_model
from torch.utils.data import DataLoader
from tqdm.auto import tqdm
from transformers import CLIPTextModel, CLIPTokenizer

from ml.dataset import DomainDataset

logger = get_logger(__name__, log_level="INFO")


# ---------------------------------------------------------------------------
# Training entry point
# ---------------------------------------------------------------------------

def train(config_path: str = "configs/training_config.yaml") -> None:
    """Main LoRA fine-tuning function."""
    cfg = OmegaConf.load(config_path)
    model_cfg = cfg.model
    lora_cfg = cfg.lora
    train_cfg = cfg.training
    ds_cfg = cfg.dataset

    logging.basicConfig(
        format="%(asctime)s - %(levelname)s - %(name)s - %(message)s",
        datefmt="%m/%d/%Y %H:%M:%S",
        level=logging.INFO,
    )

    output_dir = Path(train_cfg.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    log_dir = Path(train_cfg.logging_dir)
    log_dir.mkdir(parents=True, exist_ok=True)

    mixed_precision = train_cfg.mixed_precision
    if torch.backends.mps.is_available():
        mixed_precision = "no"

    accelerator_config = ProjectConfiguration(
        project_dir=str(output_dir),
        logging_dir=str(log_dir),
    )
    accelerator = Accelerator(
        gradient_accumulation_steps=train_cfg.gradient_accumulation_steps,
        mixed_precision=mixed_precision,
        log_with=train_cfg.report_to,
        project_config=accelerator_config,
    )

    logger = get_logger(__name__, log_level="INFO")

    if torch.backends.mps.is_available():
        logger.info("MPS (Apple Silicon) detected. Disabling mixed precision to avoid autocast errors.")

    if train_cfg.seed is not None:
        set_seed(train_cfg.seed)

    # Set up Supabase to push live training progress
    _supabase = None
    _run_id = os.environ.get("TRAINING_RUN_ID")
    try:
        from supabase import create_client as _create_client
        _supabase = _create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    except Exception:
        pass  # Supabase optional; training will still work without it

    def _push_step(step: int, loss: float) -> None:
        """Push current step and loss to Supabase (best-effort)."""
        if _supabase and _run_id:
            try:
                _supabase.table("training_runs").update({
                    "current_step": step,
                    "final_loss": round(loss, 6),
                }).eq("id", _run_id).execute()
            except Exception:
                pass  # Never crash training due to network issues

    # -----------------------------------------------------------------------
    # Load models
    # -----------------------------------------------------------------------
    logger.info("Loading base model components...")

    tokenizer = CLIPTokenizer.from_pretrained(
        model_cfg.base_model, subfolder="tokenizer"
    )
    text_encoder = CLIPTextModel.from_pretrained(
        model_cfg.base_model, subfolder="text_encoder"
    )
    vae = AutoencoderKL.from_pretrained(
        model_cfg.base_model, subfolder="vae"
    )
    unet = UNet2DConditionModel.from_pretrained(
        model_cfg.base_model, subfolder="unet"
    )
    noise_scheduler = DDPMScheduler.from_pretrained(
        model_cfg.base_model, subfolder="scheduler"
    )

    # Freeze VAE and text encoder
    vae.requires_grad_(False)
    text_encoder.requires_grad_(False)

    # -----------------------------------------------------------------------
    # Wrap UNet with LoRA via PEFT
    # -----------------------------------------------------------------------
    logger.info(f"Applying LoRA with rank={lora_cfg.rank}, alpha={lora_cfg.alpha}")

    lora_config = LoraConfig(
        r=lora_cfg.rank,
        lora_alpha=lora_cfg.alpha,
        target_modules=list(lora_cfg.target_modules),
        lora_dropout=lora_cfg.dropout,
        bias="none",
    )
    unet = get_peft_model(unet, lora_config)
    unet.print_trainable_parameters()

    if train_cfg.gradient_checkpointing:
        unet.enable_gradient_checkpointing()

    if train_cfg.use_xformers:
        try:
            unet.enable_xformers_memory_efficient_attention()
        except Exception as e:
            logger.warning(f"xformers not available: {e}")

    # -----------------------------------------------------------------------
    # Dataset + DataLoader
    # -----------------------------------------------------------------------
    logger.info(f"Loading dataset from {ds_cfg.dataset_path}")

    train_dataset = DomainDataset(
        image_dir=ds_cfg.dataset_path,
        tokenizer=tokenizer,
        resolution=ds_cfg.resolution,
        center_crop=ds_cfg.center_crop,
        random_flip=ds_cfg.random_flip,
    )

    train_dataloader = DataLoader(
        train_dataset,
        batch_size=train_cfg.train_batch_size,
        shuffle=True,
        num_workers=2,
        pin_memory=True,
    )

    # -----------------------------------------------------------------------
    # Optimizer + LR scheduler
    # -----------------------------------------------------------------------
    optimizer = torch.optim.AdamW(
        unet.parameters(),
        lr=train_cfg.learning_rate,
        betas=(train_cfg.adam_beta1, train_cfg.adam_beta2),
        eps=train_cfg.adam_epsilon,
        weight_decay=train_cfg.adam_weight_decay,
    )

    num_update_steps_per_epoch = math.ceil(
        len(train_dataloader) / train_cfg.gradient_accumulation_steps
    )
    num_train_epochs = math.ceil(train_cfg.max_train_steps / num_update_steps_per_epoch)

    lr_scheduler = get_scheduler(
        name=train_cfg.lr_scheduler,
        optimizer=optimizer,
        num_warmup_steps=train_cfg.lr_warmup_steps * train_cfg.gradient_accumulation_steps,
        num_training_steps=train_cfg.max_train_steps * train_cfg.gradient_accumulation_steps,
    )

    # -----------------------------------------------------------------------
    # Prepare with Accelerator
    # -----------------------------------------------------------------------
    unet, optimizer, train_dataloader, lr_scheduler = accelerator.prepare(
        unet, optimizer, train_dataloader, lr_scheduler
    )

    weight_dtype = torch.float32
    if accelerator.mixed_precision == "fp16":
        weight_dtype = torch.float16
    elif accelerator.mixed_precision == "bf16":
        weight_dtype = torch.bfloat16

    vae.to(accelerator.device, dtype=weight_dtype)
    text_encoder.to(accelerator.device, dtype=weight_dtype)

    # -----------------------------------------------------------------------
    # Training loop
    # -----------------------------------------------------------------------
    # Adaptive log frequency: ensure at least ~20 data points for the chart
    configured_log_freq = getattr(train_cfg, 'log_every_n_steps', 10)
    if train_cfg.max_train_steps <= 100:
        effective_log_freq = 1  # Log every step for short runs
    else:
        # At least 20 points on the chart
        effective_log_freq = min(configured_log_freq, max(1, train_cfg.max_train_steps // 20))
    logger.info(f"Starting training — max_steps={train_cfg.max_train_steps}, log_every={effective_log_freq}")
    training_log: list[dict] = []
    global_step = 0
    progress_bar = tqdm(
        range(train_cfg.max_train_steps),
        desc="Training steps",
        disable=not accelerator.is_local_main_process,
    )

    for epoch in range(num_train_epochs):
        unet.train()
        epoch_loss = 0.0
        ema_loss = None  # Exponential moving average for smoothed curve
        _step_start = time.monotonic()

        for step, batch in enumerate(train_dataloader):
            with accelerator.accumulate(unet):
                # Encode images to latent space
                latents = vae.encode(
                    batch["pixel_values"].to(weight_dtype)
                ).latent_dist.sample()
                latents = latents * vae.config.scaling_factor

                # Sample noise + timesteps
                noise = torch.randn_like(latents)
                bsz = latents.shape[0]
                timesteps = torch.randint(
                    0,
                    noise_scheduler.config.num_train_timesteps,
                    (bsz,),
                    device=latents.device,
                ).long()

                # Forward diffusion — add noise to latents
                noisy_latents = noise_scheduler.add_noise(latents, noise, timesteps)

                # Encode text
                encoder_hidden_states = text_encoder(batch["input_ids"])[0]

                # UNet forward pass
                noise_pred = unet(noisy_latents, timesteps, encoder_hidden_states).sample

                # MSE loss
                loss = F.mse_loss(noise_pred.float(), noise.float(), reduction="mean")
                epoch_loss += loss.detach().item()

                accelerator.backward(loss)
                if accelerator.sync_gradients:
                    accelerator.clip_grad_norm_(unet.parameters(), train_cfg.max_grad_norm)
                    # Compute gradient norm BEFORE optimizer step and zero_grad
                    grad_norm = 0.0
                    for p in unet.parameters():
                        if p.grad is not None:
                            grad_norm += p.grad.data.norm(2).item() ** 2
                    grad_norm = grad_norm ** 0.5
                else:
                    grad_norm = 0.0

                optimizer.step()
                lr_scheduler.step()
                optimizer.zero_grad()

            if accelerator.sync_gradients:
                progress_bar.update(1)
                global_step += 1
                step_elapsed = time.monotonic() - _step_start

                # Log at adaptive frequency, and always the first step
                is_first_step = (global_step == 1)
                is_log_step = (global_step % effective_log_freq == 0)
                is_last_step = (global_step >= train_cfg.max_train_steps)
                if is_first_step or is_log_step or is_last_step:
                    avg_loss = epoch_loss / (step + 1)
                    # Compute EMA loss (smoothing factor 0.9)
                    if ema_loss is None:
                        ema_loss = avg_loss
                    else:
                        ema_loss = 0.9 * ema_loss + 0.1 * avg_loss

                    current_lr = lr_scheduler.get_last_lr()[0] if hasattr(lr_scheduler, 'get_last_lr') else train_cfg.learning_rate

                    log_entry = {
                        "step": global_step,
                        "train_loss": round(avg_loss, 6),
                        "smoothed_loss": round(ema_loss, 6),
                        "learning_rate": round(current_lr, 10),
                        "grad_norm": round(grad_norm, 6),
                        "step_time_ms": round(step_elapsed * 1000, 1),
                        "epoch": epoch + 1,
                    }
                    training_log.append(log_entry)
                    logger.info(f"Step {global_step}: loss={avg_loss:.6f} lr={current_lr:.2e} grad_norm={grad_norm:.4f} time={step_elapsed*1000:.0f}ms")
                    _push_step(global_step, avg_loss)

                    # Save training log incrementally
                    log_path = output_dir / "training_log.json"
                    with open(log_path, "w") as f:
                        json.dump(training_log, f, indent=2)

                _step_start = time.monotonic()

                # Save checkpoint
                if global_step % train_cfg.save_steps == 0:
                    _save_checkpoint(accelerator, unet, output_dir, global_step, train_cfg)
                    _generate_validation_images(
                        accelerator, unet, vae, text_encoder, tokenizer,
                        noise_scheduler, train_cfg, global_step, weight_dtype,
                    )

                if global_step >= train_cfg.max_train_steps:
                    break

    # -----------------------------------------------------------------------
    # Save final model
    # -----------------------------------------------------------------------
    accelerator.wait_for_everyone()
    if accelerator.is_main_process:
        unwrapped_unet = accelerator.unwrap_model(unet)
        unwrapped_unet.save_pretrained(str(output_dir))
        logger.info(f"Saved LoRA weights to {output_dir}")

        # Save training log
        log_path = output_dir / "training_log.json"
        with open(log_path, "w") as f:
            json.dump(training_log, f, indent=2)
        logger.info(f"Saved training log to {log_path}")

    accelerator.end_training()


def _save_checkpoint(
    accelerator, unet, output_dir: Path, global_step: int, train_cfg
) -> None:
    """Save LoRA checkpoint."""
    checkpoint_path = output_dir / f"checkpoint-{global_step}"
    checkpoint_path.mkdir(parents=True, exist_ok=True)
    accelerator.unwrap_model(unet).save_pretrained(str(checkpoint_path))
    logger.info(f"Saved checkpoint at step {global_step}")


@torch.no_grad()
def _generate_validation_images(
    accelerator, unet, vae, text_encoder, tokenizer,
    noise_scheduler, train_cfg, global_step: int, weight_dtype,
) -> None:
    """Generate and save validation images."""
    from diffusers import DDIMScheduler, StableDiffusionPipeline  # noqa: PLC0415

    if not accelerator.is_main_process:
        return

    logger.info(f"Generating {train_cfg.num_validation_images} validation images...")
    pipeline = StableDiffusionPipeline(
        unet=accelerator.unwrap_model(unet),
        vae=vae,
        text_encoder=text_encoder,
        tokenizer=tokenizer,
        scheduler=DDIMScheduler.from_config(noise_scheduler.config),
        safety_checker=None,
        feature_extractor=None,
    )
    pipeline = pipeline.to(accelerator.device)
    pipeline.set_progress_bar_config(disable=True)

    val_dir = Path(train_cfg.output_dir) / "validation" / f"step-{global_step}"
    val_dir.mkdir(parents=True, exist_ok=True)

    generator = torch.Generator(device=accelerator.device).manual_seed(42)
    for i in range(train_cfg.num_validation_images):
        image = pipeline(
            train_cfg.validation_prompt,
            negative_prompt=train_cfg.validation_negative_prompt,
            num_inference_steps=30,
            guidance_scale=7.5,
            generator=generator,
        ).images[0]
        image.save(val_dir / f"val_{i:02d}.png")

    del pipeline
    torch.cuda.empty_cache()


if __name__ == "__main__":
    train()
