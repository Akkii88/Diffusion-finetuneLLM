-- Store generated image metadata
CREATE TABLE generations (
    id UUID PRIMARY KEY,
    prompt TEXT NOT NULL,
    negative_prompt TEXT,
    image_url TEXT NOT NULL,
    clip_score FLOAT,
    seed BIGINT,
    num_steps INT,
    guidance_scale FLOAT,
    scheduler VARCHAR(20),
    generation_time_ms INT,
    human_rating INT DEFAULT 0, -- -1 (bad), 0 (neutral), 1 (good)
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

-- Store safety check logs
CREATE TABLE safety_logs (
    id UUID PRIMARY KEY,
    prompt TEXT NOT NULL,
    filter_type VARCHAR(50),
    reason TEXT,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

-- Store training run metrics and history
CREATE TABLE training_runs (
    id UUID PRIMARY KEY,
    run_name VARCHAR(255),
    status VARCHAR(50) DEFAULT 'running', -- 'running', 'completed', 'failed'
    total_steps INT,
    current_step INT,
    final_loss FLOAT,
    learning_rate FLOAT,
    lora_rank INT,
    fid_score FLOAT,
    clip_score FLOAT,
    config JSONB,
    training_log JSONB, -- Array of {step, train_loss, val_loss}
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;

ALTER TABLE training_runs ENABLE ROW LEVEL SECURITY;

-- Create policy allowing open read access (since gallery is public)
CREATE POLICY "Allow public read access to generations" ON generations FOR
SELECT TO public USING (true);

CREATE POLICY "Allow public update access to generations for rating" ON generations FOR
UPDATE TO public USING (true)
WITH
    CHECK (true);

-- Training runs are typically read by backend, but if needed:
CREATE POLICY "Allow public read access to training_runs" ON training_runs FOR
SELECT TO public USING (true);

-- ===== Dataset Management Tables =====

-- Store training datasets
CREATE TABLE datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    image_count INT DEFAULT 0,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

-- Store dataset images
CREATE TABLE dataset_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid (),
    dataset_id UUID NOT NULL REFERENCES datasets (id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    storage_path TEXT NOT NULL,
    file_size BIGINT,
    width INT,
    height INT,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE datasets ENABLE ROW LEVEL SECURITY;

ALTER TABLE dataset_images ENABLE ROW LEVEL SECURITY;

-- Policies for datasets
CREATE POLICY "Allow public read access to datasets" ON datasets FOR
SELECT TO public USING (true);

CREATE POLICY "Allow public insert access to datasets" ON datasets FOR
INSERT
    TO public
WITH
    CHECK (true);

CREATE POLICY "Allow public update access to datasets" ON datasets FOR
UPDATE TO public USING (true)
WITH
    CHECK (true);

CREATE POLICY "Allow public delete access to datasets" ON datasets FOR DELETE TO public USING (true);

-- Policies for dataset_images
CREATE POLICY "Allow public read access to dataset_images" ON dataset_images FOR
SELECT TO public USING (true);

CREATE POLICY "Allow public insert access to dataset_images" ON dataset_images FOR
INSERT
    TO public
WITH
    CHECK (true);

CREATE POLICY "Allow public delete access to dataset_images" ON dataset_images FOR DELETE TO public USING (true);

-- ===== Storage Bucket Setup =====
-- Run these commands in Supabase SQL Editor:

-- 1. Create storage bucket for dataset images (if not exists)
INSERT INTO
    storage.buckets (id, name, public)
SELECT 'dataset-images', 'dataset-images', true
WHERE
    NOT EXISTS (
        SELECT 1
        FROM storage.buckets
        WHERE
            id = 'dataset-images'
    );

-- 2. Storage policies - use unique names for dataset-images bucket
DROP POLICY IF EXISTS "dataset-images-public-read" ON storage.objects;

CREATE POLICY "dataset-images-public-read" ON storage.objects FOR
SELECT TO public USING (bucket_id = 'dataset-images');

-- NOTE: Changed from `authenticated` to `public` so Next.js API routes
-- using the anon key can upload files to Supabase Storage.
DROP POLICY IF EXISTS "dataset-images-upload" ON storage.objects;

CREATE POLICY "dataset-images-upload" ON storage.objects FOR
INSERT
    TO public
WITH
    CHECK (bucket_id = 'dataset-images');

DROP POLICY IF EXISTS "dataset-images-delete" ON storage.objects;

CREATE POLICY "dataset-images-delete" ON storage.objects FOR DELETE TO public USING (bucket_id = 'dataset-images');