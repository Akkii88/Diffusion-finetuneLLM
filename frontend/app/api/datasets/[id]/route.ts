import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET - Fetch a single dataset with its images
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const datasetId = params.id;

    // Fetch dataset
    const { data: dataset, error: datasetError } = await supabase
      .from('datasets')
      .select('*')
      .eq('id', datasetId)
      .single();

    if (datasetError) throw datasetError;

    // Fetch images
    const { data: images, error: imagesError } = await supabase
      .from('dataset_images')
      .select('*')
      .eq('dataset_id', datasetId)
      .order('created_at', { ascending: false });

    if (imagesError) throw imagesError;

    // Get public URLs for each image
    const imagesWithUrls = await Promise.all(
      (images || []).map(async (image) => {
        const { data: urlData } = supabase.storage
          .from('dataset-images')
          .getPublicUrl(image.storage_path);

        return {
          ...image,
          url: urlData.publicUrl,
        };
      })
    );

    return NextResponse.json({
      ...dataset,
      images: imagesWithUrls,
    });
  } catch (error) {
    console.error('Error fetching dataset:', error);
    return NextResponse.json({ error: 'Failed to fetch dataset' }, { status: 500 });
  }
}
