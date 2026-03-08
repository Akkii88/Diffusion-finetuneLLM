# DiffusionLab — Stitch AI Redesign Prompts

## Project Overview
DiffusionLab is a **research-grade AI image generation platform** for LoRA fine-tuning Stable Diffusion models. It has 5 pages inside a persistent Sidebar + Navbar shell. The tech stack is **Next.js 14 (App Router)** with React Query for data fetching. All data comes from a FastAPI backend.

---

## Global Layout & Design System (paste this first)

```
Design a premium, dark-mode AI research dashboard called "DiffusionLab — Research Edition".

Global shell:
- Persistent LEFT SIDEBAR (240px wide, dark #0a0a0f background) with:
  - Logo at top: "DiffusionLab" in bold Space Grotesk font with a purple spark icon, subtitle "Research Edition" in small muted text below
  - Navigation links (each with an icon + label, active state has purple left border + purple text):
    1. Home (lightning bolt icon) — route "/"
    2. Generate (sparkles/wand icon) — route "/generate"
    3. Gallery (grid icon) — route "/gallery"
    4. Training (chart/activity icon) — route "/training"
    5. Evaluation (beaker/flask icon) — route "/evaluation"
  - Footer at bottom of sidebar: "Master's Research Project" and "Generative AI • 2024" in muted small text

- TOP NAVBAR (spans right side, fixed at top):
  - Left: Current page title (dynamic, e.g. "Training Dashboard")
  - Right: "API Docs" button (external link icon) + a bell/notification icon

- MAIN CONTENT area: right of sidebar, below navbar, with 24px padding

Color palette:
- Background: #0a0a0f (near black)
- Surface/cards: rgba(255,255,255,0.04) with 1px border rgba(255,255,255,0.08) — glass morphism effect
- Primary accent: #7c3aed (vivid purple)
- Secondary accent: #06b6d4 (cyan)
- Tertiary accent: #a855f7 (lighter purple)
- Text primary: #f8fafc
- Text muted: #94a3b8
- Text dimmed: #64748b

Typography: Inter for body, Space Grotesk for headings and metric numbers.

Glassmorphism cards: semi-transparent dark background, subtle white border, hover lift effect (translate-y -4px).
```

---

## PAGE 1 — Home / Dashboard (route: `/`)

```
Design the HOME page for DiffusionLab (dark AI research dashboard, purple/cyan accent).

Layout: Single centered column, max-width 900px, centered.

SECTION 1 — Hero (centered, padding 64px top):
- Small pill badge at top: purple border, "✦ Master's Research Project — Generative AI" in small caps, purple text
- H1 headline (3.5rem, Space Grotesk, 800 weight): "Generate Art. Fine-Tuned for Your Domain." — the word "Fine-Tuned" should be a purple-to-cyan gradient text
- Subtitle paragraph (1.1rem, muted #94a3b8, max-width 560px, centered): "A research-grade platform for LoRA fine-tuning Stable Diffusion on domain-specific images, with FID/CLIP evaluation, Supabase-backed gallery, and a two-layer safety system."
- Two CTA buttons side-by-side:
  1. "Try the Generator →" — filled purple glowing button (primary)
  2. "View Gallery" — ghost/outline button

SECTION 2 — Live Stats Bar (below hero, glass card):
- 3-column grid, pill-shaped glass card, 20px padding:
  - Col 1: Large gradient number "—" (will be filled from API: `metrics.total_generated`), label "Images Generated"
  - Col 2: Large gradient number "—" (from `metrics.fid_score`), label "FID Score"
  - Col 3: Large gradient number "—" (from `metrics.avg_clip_score`), label "Avg CLIP Score"
- Dividers between columns. Numbers use purple-to-cyan gradient. Labels in small muted text.

SECTION 3 — Feature Cards (3-column grid, gap 16px):
Card 1 — "LoRA Fine-Tuning":
  - Icon: purple lightning bolt in a small purple-tinted rounded square
  - Title in white
  - Desc: "Efficient parameter-efficient training with rank decomposition on your domain images."

Card 2 — "FID Evaluation":
  - Icon: cyan bar chart in a cyan-tinted rounded square
  - Title in white
  - Desc: "Quantitative quality assessment using Fréchet Inception Distance against real datasets."

Card 3 — "Safety Filters":
  - Icon: purple shield in a purple-tinted rounded square
  - Title in white
  - Desc: "Two-layer protection: keyword blocklist + HuggingFace toxicity classification + image safety checker."

Each card: glassmorphism surface, 1px border, hover lifts card 4px and slightly scales up.
```

---

## PAGE 2 — Generate (route: `/generate`)

```
Design the IMAGE GENERATION PAGE for DiffusionLab (dark AI research dashboard, purple/cyan accents).

Layout: 2-column grid, left column (2/5 width) for controls, right column (3/5 width) for image output. Max-width 1100px.

LEFT COLUMN — Control Panel (stacked vertical cards, gap 16px):

CARD 1 — Prompt Input:
  - Label "PROMPT" in small caps, muted color
  - Large dark textarea (min-height 100px, rounded, subtle border) for the main image generation prompt
  - Below textarea: left side shows "Add negative prompt" toggle link in muted text; right side shows character counter "0/300"
  - When "Add negative prompt" is clicked: animate-in a second smaller textarea below labeled "Negative Prompt" (placeholder: "blurry, low quality, distorted, watermark...")

CARD 2 — Advanced Controls (collapsible):
  - Toggle header: "ADVANCED CONTROLS ▼" in small caps — clicking expands/collapses
  - When expanded (animate slide-down), shows:
    - STEPS slider (1-150, default 20): label + live value in purple on right
    - CFG SCALE slider (1.0-30.0, step 0.5, default 7.5): label + live value
    - SEED row: label left, "Fixed" checkbox right; below that: number input + random dice button
    - SCHEDULER selector: 3 pill toggle buttons side by side — "ddim" | "ddpm" | "dpp++" — selected one has purple outline + purple text

CARD 3 — Prompt Guide (collapsible):
  - Toggle header "PROMPT GUIDE ✦" in small caps
  - When expanded: shows a 3x2 grid of small example prompt chips/tags (e.g. "Cinematic portrait", "Watercolor landscape") that when clicked, fill the prompt textarea

GENERATE BUTTON (full width):
  - Large glowing purple button "✦ Generate Image" at bottom of left panel
  - While loading: shows spinning loader + "Generating..." text, button is disabled

RIGHT COLUMN — Output Canvas (tall glass card):

State 1 — Empty:
  - Dashed border card, centered content: purple sparkle icon in a circle, "Your generated image will appear here", below "Enter a prompt and click Generate" in dimmed text

State 2 — Loading:
  - Animated shimmer/skeleton placeholder filling the canvas area, centered spinner + "Generating your image..." text

State 3 — Result:
  - Generated image fills the card (rounded 12px corners)
  - Below image: 3 metric pills in a row:
    - "CLIP Score: 0.287" in a purple-tinted pill
    - "Time: 4320ms" in a cyan-tinted pill
    - "Seed: 42838293" in a slate pill
  - Action buttons row (3 equal buttons):
    - "↓ Download" — outline button
    - "⎘ Copy Prompt" — outline button
    - "↻ Regenerate" — outline button
```

---

## PAGE 3 — Gallery (route: `/gallery`)

```
Design the IMAGE GALLERY PAGE for DiffusionLab (dark AI research dashboard).

Layout: Full width, max-width 1200px.

SECTION 1 — Filter Bar (horizontal, marginBottom 24px):
  - "Sort by:" label in muted small caps
  - 3 pill/chip toggle buttons:
    1. "Newest" (sorts by created_at)
    2. "CLIP Score" (sorts by clip_score)
    3. "Top Rated" (sorts by human_rating)
  - Active sort: purple background + purple border + white text
  - Inactive: dark ghost, muted text
  - Right side: total count label e.g. "24 images" in dimmed text

SECTION 2 — Masonry Image Grid:
  - 3-column masonry layout (2 columns on tablet, 1 on mobile)
  - Each IMAGE CARD:
    - Lazy-loaded image with rounded 12px corners
    - On hover: dark gradient overlay slides up from bottom showing:
      - Prompt text (2 lines max, white, small)
      - Bottom row: CLIP score badge (purple pill, "CLIP: 0.287") on left; thumbs-up 👍 (green) and thumbs-down 👎 (red) icon buttons on right
    - Entire card is clickable to open lightbox

  - Loading state: skeleton shimmer placeholder cards (same masonry layout)

SECTION 3 — Load More Button:
  - Centered "Load More" outline button below grid
  - Shows "Loading..." when fetching next page

SECTION 4 — Image Lightbox (modal overlay):
  - Triggered by clicking an image card
  - Full-screen dark overlay with blur backdrop
  - Centered glass card (max-width 700px) containing:
    - X close button (top right)
    - Full-resolution image (rounded 12px)
    - Below image: prompt text in white
    - Metadata chips row: "CLIP: 0.287" (purple tag), "Seed: 42838293" (cyan tag), "Steps: 20" (slate tag)
    - "↓ Download PNG" glowing purple button
```

---

## PAGE 4 — Training Dashboard (route: `/training`)

```
Design the TRAINING DASHBOARD PAGE for DiffusionLab (dark AI research dashboard, purple/cyan accents).

Layout: Single column, max-width 1200px.

SECTION 1 — Status Banner (full-width glass card, horizontal):
  - Left side: colored status dot (green pulsing = running, purple = completed, grey = idle) + status label ("Fine-tuning In Progress" / "Fine-tuning Complete" / "No Active Training")
  - Right side of status label: "Run: run_abc123" in muted text
  - Far right: "⚙ Configure & Start" purple button (only visible when not training)

SECTION 2 — Training Configuration Panel (animated slide-in, shown when "Configure & Start" is clicked):
  Glass card with:
  - Title "⚙ Training Configuration" (Space Grotesk)
  - 3-column form grid with labeled inputs:
    - "Run Name" — text input (placeholder: "my-lora-training")
    - "Dataset Path" — text input (default: "./data/domain_images")
    - "LoRA Rank" — number input (default: 8)
    - "Learning Rate" — number input (step 0.0001, default: 0.0001)
    - "Max Training Steps" — number input (default: 3000)
    - "Batch Size" — number input (default: 2)
  - Button row: "▶ Start Training" (filled purple), "Cancel" (ghost)
  - Error message area below buttons (red text, only shown if API error)

SECTION 3 — Progress Bar (only visible while training):
  - Thin gradient bar (purple-to-cyan) showing completion percentage, animated fill

SECTION 4 — Metrics Grid (4-column grid of stat cards):
  - Card 1 "Steps": current_step / total_steps (e.g. "120 / 3000"), blue icon
  - Card 2 "Current Loss": final_loss value (4 decimal places) or "—", purple icon
  - Card 3 "Learning Rate": learning_rate in scientific notation (e.g. "1.0e-4") or "—", cyan icon
  - Card 4 "LoRA Rank": lora_rank value or "—", green icon
  Each card: glassmorphism, icon with colored tint, metric in large Space Grotesk font

SECTION 5 — Two-column layout (2fr + 1fr):
  LEFT — Training Loss Curve chart (glass card):
    - Title "Training Loss Curve"
    - Recharts LineChart, dark background, gridlines, axes with muted labels
    - Purple line for train_loss, dashed cyan line for val_loss (if available)
    - X axis = step number, Y axis = loss value (auto domain)
    - Empty state: dashed border box, "No training logs available"

  RIGHT — Stacked cards:
    CARD A — Hyperparameters:
      - Title "Hyperparameters"
      - List of key/value rows from config object:
        e.g. "max_train_steps: 3000", "learning_rate: 0.0001", "lora_rank: 8", "batch_size: 2"
        Key in muted, value in monospace white, bottom border separator

    CARD B — Live Log Terminal:
      - Dark terminal-style card with green monospace font
      - Header: "$ tail -f training.log" in purple
      - Shows last 10 log lines: "[HH:MM:SS] Step 120 — Loss: 0.04521" format
      - Blinking cursor block (green) when training is running
      - "Waiting for logs..." in muted when no data
```

---

## PAGE 5 — Evaluation (route: `/evaluation`)

```
Design the MODEL EVALUATION PAGE for DiffusionLab (dark AI research dashboard).

Layout: Single column, max-width 900px.

SECTION 1 — Page Header:
  - H1: "Model Evaluation" (Space Grotesk, 2rem, bold)
  - Subtitle paragraph: "Quantitative metrics and visual comparisons between the base model and fine-tuned LoRA."

SECTION 2 — Quantitative Metrics (2-column grid, equal width):
  CARD 1 — FID Score:
    - Purple icon (activity/wave chart) in a purple-tinted rounded square
    - Label "FID SCORE" in small caps, muted
    - Large number (2.5rem, Space Grotesk): shows fid_score from API, "—" if null
    - Description: "Fréchet Inception Distance measures distribution similarity between generated and real validation images. Lower is better."

  CARD 2 — Avg CLIP Score:
    - Cyan icon (percent/target) in a cyan-tinted rounded square
    - Label "AVG CLIP SCORE" in small caps, muted
    - Large number: shows avg_clip_score from API (3 decimal places), "—" if null
    - Description: "Measures alignment between text prompt and generated image. Higher indicates better prompt adherence."

SECTION 3 — Visual Comparison (title + description):
  - H2 "Visual Comparison" (1.4rem, Space Grotesk)
  - Subtitle: "Drag the slider over generated outputs to compare the base stable diffusion model against your custom domain fine-tune."

  3 COMPARISON CARDS (stacked vertically, each is a glass card):
    Each card shows:
    - Prompt label above: "Prompt: Cinematic portrait, dramatic lighting" (purple bold "Prompt:", then text)
    - Interactive side-by-side slider comparison widget (360px height):
      * LEFT half: BASE MODEL image (background-image, cover), "Base Model" label top-right
      * RIGHT half: FINE-TUNED (LoRA) image with clip-path revealing based on mouse drag, "Fine-Tuned (LoRA)" label top-left in purple
      * Vertical white divider line with a circular handle (white circle, ← → arrows icon) at center, draggable
      * Mouse move/touch move updates divider position
    The 3 prompts are:
      1. "Cinematic portrait, dramatic lighting" — images: /eval/base_01.png, /eval/ft_01.png
      2. "Watercolor landscape, dreamy soft colors" — images: /eval/base_02.png, /eval/ft_02.png
      3. "Digital art concept, sci-fi city" — images: /eval/base_03.png, /eval/ft_03.png

SECTION 4 — Evaluation Note (glass card, dashed border, centered):
  - "* Evaluation images are populated after running the 03_evaluate.ipynb notebook." in muted small text
  - "03_evaluate.ipynb" in monospace code styling

```

---

## API Data Contracts (tell Stitch what data to expect)

```
When building this app, the following API endpoints power the data:

GET /metrics → returns:
  { status, run_name, total_steps, current_step, final_loss, learning_rate, lora_rank,
    fid_score, clip_score, avg_clip_score, total_generated, training_log: [{step, train_loss, val_loss}],
    config: {key: value pairs} }

GET /training/status → returns:
  { status: "not_started"|"starting"|"running"|"completed"|"failed"|"unknown", run_name, message }

POST /training/start → body: { run_name, dataset_path, lora_rank, learning_rate, max_train_steps, train_batch_size }
  → returns: { run_id, status, message }

GET /gallery → params: ?page=1&page_size=24&sort_by=created_at|clip_score|human_rating
  → returns: { items: [{id, prompt, negative_prompt, image_url, clip_score, seed, num_steps, guidance_scale, scheduler, generation_time_ms, human_rating, created_at}], total, page, page_size }

PATCH /gallery/{generation_id}/rating → body: { rating: -1|0|1 }

POST /generate → body: { prompt, negative_prompt, num_steps, guidance_scale, seed, scheduler }
  → returns: { image_url, clip_score, seed_used, generation_time_ms }

The Next.js frontend uses `/api/` prefix for all calls (proxied to FastAPI at port 8000).
API utility functions live in frontend/lib/api.ts — import from "@/lib/api".
State management uses @tanstack/react-query (useQuery, useMutation, useInfiniteQuery).
```

---

## Implementation Notes for Integration

After exporting from Stitch, do the following in the Next.js project:
1. Place page files in `frontend/app/{page}/page.tsx`
2. Place components in `frontend/components/`
3. Sidebar component: `frontend/components/layout/Sidebar.tsx`
4. Navbar component: `frontend/components/layout/Navbar.tsx`
5. API calls must use functions from `frontend/lib/api.ts`:
   - `fetchMetrics()`, `fetchGallery()`, `generateImage()`, `startTraining()`, `getTrainingStatus()`, `updateRating()`
6. Add `"use client"` directive to any page/component that uses hooks or browser APIs
7. Global CSS goes to `frontend/app/globals.css`
8. All pages wrapped in `Providers` component (React Query + toast context)
