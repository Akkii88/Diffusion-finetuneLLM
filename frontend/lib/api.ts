import { z } from "zod";

const API_URL = "/api";
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const GenerateResponseSchema = z.object({
    image_url: z.string().url(),
    clip_score: z.number(),
    seed_used: z.number(),
    generation_time_ms: z.number(),
    generation_id: z.string(),
});
export type GenerateResponse = z.infer<typeof GenerateResponseSchema>;

export const GalleryItemSchema = z.object({
    id: z.string(),
    prompt: z.string(),
    negative_prompt: z.string().optional(),
    image_url: z.string(),
    clip_score: z.number().nullable().optional(),
    seed: z.number().nullable().optional(),
    num_steps: z.number().nullable().optional(),
    guidance_scale: z.number().nullable().optional(),
    scheduler: z.string().nullable().optional(),
    generation_time_ms: z.number().nullable().optional(),
    human_rating: z.number().nullable().optional(),
    created_at: z.string(),
});
export type GalleryItem = z.infer<typeof GalleryItemSchema>;

export const GalleryResponseSchema = z.object({
    items: z.array(GalleryItemSchema),
    total: z.number(),
    page: z.number(),
    page_size: z.number(),
});

export const MetricsResponseSchema = z.object({
    run_name: z.string().nullable().optional(),
    status: z.string().default("not_started"),
    total_steps: z.number().nullable().optional(),
    current_step: z.number().nullable().optional(),
    final_loss: z.number().nullable().optional(),
    learning_rate: z.number().nullable().optional(),
    lora_rank: z.number().nullable().optional(),
    fid_score: z.number().nullable().optional(),
    clip_score: z.number().nullable().optional(),
    config: z.record(z.string(), z.unknown()).nullable().optional(),
    total_generated: z.number().default(0),
    avg_clip_score: z.number().nullable().optional(),
    avg_generation_time_ms: z.number().nullable().optional(),
    human_approved_count: z.number().default(0),
    training_log: z
        .array(z.object({
            step: z.number(),
            train_loss: z.number(),
            val_loss: z.number().nullable().optional(),
            smoothed_loss: z.number().nullable().optional(),
            learning_rate: z.number().nullable().optional(),
            grad_norm: z.number().nullable().optional(),
            step_time_ms: z.number().nullable().optional(),
            epoch: z.number().nullable().optional(),
        }))
        .default([]),
});
export type MetricsResponse = z.infer<typeof MetricsResponseSchema>;

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

async function apiFetch<T>(
    path: string,
    schema: z.ZodSchema<T>,
    options?: RequestInit,
    baseUrl: string = API_URL
): Promise<T> {
    const res = await fetch(`${baseUrl}${path}`, {
        headers: { "Content-Type": "application/json" },
        ...options,
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail ?? "API error");
    }
    const data = await res.json();
    return schema.parse(data);
}

export async function generateImage(params: {
    prompt: string;
    negative_prompt?: string;
    num_steps?: number;
    guidance_scale?: number;
    seed?: number;
    scheduler?: string;
}): Promise<GenerateResponse> {
    return apiFetch("/generate", GenerateResponseSchema, {
        method: "POST",
        body: JSON.stringify(params),
    });
}

export async function fetchGallery(options?: {
    page?: number;
    page_size?: number;
    sort_by?: string;
    order?: string;
    human_approved?: boolean;
}) {
    const params = new URLSearchParams();
    if (options?.page) params.set("page", String(options.page));
    if (options?.page_size) params.set("page_size", String(options.page_size));
    if (options?.sort_by) params.set("sort_by", options.sort_by);
    if (options?.order) params.set("order", options.order);
    if (options?.human_approved !== undefined) params.set("human_approved", String(options.human_approved));
    return apiFetch(`/gallery?${params}`, GalleryResponseSchema);
}

export async function saveToGallery(params: {
    image_url: string;
    prompt: string;
    negative_prompt?: string;
    seed?: number;
    num_steps?: number;
    guidance_scale?: number;
    scheduler?: string;
    clip_score?: number;
    generation_time_ms?: number;
}): Promise<GalleryItem> {
    return apiFetch("/gallery", GalleryItemSchema, {
        method: "POST",
        body: JSON.stringify(params),
    });
}

export async function deleteGalleryItem(id: string): Promise<void> {
    await fetch(`${API_URL}/gallery/${id}`, { method: "DELETE" });
}

export async function fetchMetrics(): Promise<MetricsResponse> {
    return apiFetch("/metrics", MetricsResponseSchema, {}, API_URL);
}

export async function fetchTrainingHistory(): Promise<{runs: any[]}> {
    const res = await fetch(`${API_URL}/metrics/history`, {
        cache: 'no-store',
    });
    return res.json();
}

export async function updateRating(id: string, rating: -1 | 0 | 1): Promise<void> {
    await fetch(`${API_URL}/gallery/${id}/rating?rating=${rating}`, { method: "PATCH" });
}

export const TrainingStatusSchema = z.object({
    status: z.string(),
    run_name: z.string().nullable().optional(),
    message: z.string().nullable().optional(),
});
export type TrainingStatus = z.infer<typeof TrainingStatusSchema>;

export const TrainingStartResponseSchema = z.object({
    run_id: z.string(),
    status: z.string(),
    message: z.string(),
});
export type TrainingStartResponse = z.infer<typeof TrainingStartResponseSchema>;

export async function startTraining(params?: {
    run_name?: string;
    dataset_id?: string;  // NEW: Supabase dataset ID
    dataset_path?: string;
    lora_rank?: number;
    learning_rate?: number;
    max_train_steps?: number;
    train_batch_size?: number;
}): Promise<TrainingStartResponse> {
    return apiFetch("/training", TrainingStartResponseSchema, {
        method: "POST",
        body: JSON.stringify(params ?? {}),
    }, API_URL);
}

export async function getTrainingStatus(): Promise<TrainingStatus> {
    return apiFetch("/training", TrainingStatusSchema, {}, API_URL);
}

export async function stopTraining(): Promise<TrainingStatus> {
    return apiFetch("/training?stop=true", TrainingStatusSchema, {
        method: "POST",
    }, API_URL);
}

// Training logs response schema
export const TrainingLogsSchema = z.object({
    lines: z.array(z.string()),
    active: z.boolean(),
});
export type TrainingLogs = z.infer<typeof TrainingLogsSchema>;

/**
 * Fetch training logs (polling fallback for SSE).
 */
export async function fetchTrainingLogs(): Promise<TrainingLogs> {
    const res = await fetch(`${API_URL}/training/logs`, {
        headers: { Accept: "application/json" },
    });
    if (!res.ok) {
        throw new Error("Failed to fetch training logs");
    }
    return TrainingLogsSchema.parse(await res.json());
}
