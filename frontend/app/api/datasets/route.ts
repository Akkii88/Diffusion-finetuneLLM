import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET - Fetch all datasets
export async function GET() {
  try {
    const { data: datasets, error } = await supabase
      .from('datasets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Get image counts for each dataset
    const datasetsWithCounts = await Promise.all(
      (datasets || []).map(async (dataset) => {
        const { count } = await supabase
          .from('dataset_images')
          .select('*', { count: 'exact', head: true })
          .eq('dataset_id', dataset.id);

        return {
          ...dataset,
          image_count: count || 0,
        };
      })
    );

    return NextResponse.json(datasetsWithCounts);
  } catch (error) {
    console.error('Error fetching datasets:', error);
    return NextResponse.json({ error: 'Failed to fetch datasets' }, { status: 500 });
  }
}

// POST - Create a new dataset
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ error: 'Dataset name is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('datasets')
      .insert([{ name, description, image_count: 0 }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error creating dataset:', error);
    // Provide more specific error message
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
      return NextResponse.json({ error: 'Database tables not set up. Please run the SQL from supabase_schema.sql in your Supabase dashboard.' }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to create dataset' }, { status: 500 });
  }
}

// DELETE - Delete a dataset
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Dataset ID is required' }, { status: 400 });
    }

    // First, get all images for this dataset to delete from storage
    const { data: images } = await supabase
      .from('dataset_images')
      .select('storage_path')
      .eq('dataset_id', id);

    // Delete images from storage
    if (images && images.length > 0) {
      const paths = images.map(img => img.storage_path);
      await supabase.storage.from('dataset-images').remove(paths);
    }

    // Delete from database (cascade will handle dataset_images)
    const { error } = await supabase
      .from('datasets')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting dataset:', error);
    return NextResponse.json({ error: 'Failed to delete dataset' }, { status: 500 });
  }
}
