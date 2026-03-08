import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// GET - Fetch images for a specific dataset
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const datasetId = params.id;

    const { data: images, error } = await supabase
      .from('dataset_images')
      .select('*')
      .eq('dataset_id', datasetId)
      .order('created_at', { ascending: false });

    if (error) throw error;

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

    return NextResponse.json(imagesWithUrls);
  } catch (error) {
    console.error('Error fetching dataset images:', error);
    return NextResponse.json({ error: 'Failed to fetch images' }, { status: 500 });
  }
}

// POST - Upload images to a dataset
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const datasetId = params.id;
    const formData = await request.formData();
    
    const files = formData.getAll('files') as File[];
    
    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    // Validate file types
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    const validFiles = files.filter(file => allowedTypes.includes(file.type));
    
    if (validFiles.length === 0) {
      return NextResponse.json({ error: 'Only JPG, JPEG, and PNG files are allowed' }, { status: 400 });
    }

    const uploadedImages = [];
    const errors: string[] = [];

    for (const file of validFiles) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = new Uint8Array(arrayBuffer);
        
        // Create unique filename: datasetId/timestamp-originalname
        const timestamp = Date.now();
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `${datasetId}/${timestamp}-${sanitizedName}`;

        // Upload to Supabase Storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('dataset-images')
          .upload(storagePath, buffer, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          errors.push(`Failed to upload ${file.name}: ${uploadError.message}`);
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('dataset-images')
          .getPublicUrl(storagePath);

        // Save to database
        const { data: imageRecord, error: dbError } = await supabase
          .from('dataset_images')
          .insert([{
            dataset_id: datasetId,
            filename: file.name,
            storage_path: storagePath,
            file_size: file.size,
          }])
          .select()
          .single();

        if (dbError) {
          console.error('Database error:', dbError);
          errors.push(`Failed to save ${file.name}: ${dbError.message}`);
          continue;
        }

        uploadedImages.push({
          ...imageRecord,
          url: urlData.publicUrl,
        });
      } catch (fileError) {
        console.error('Error processing file:', file.name, fileError);
        errors.push(`Error processing ${file.name}`);
      }
    }

    // Update dataset image count
    const { count } = await supabase
      .from('dataset_images')
      .select('*', { count: 'exact', head: true })
      .eq('dataset_id', datasetId);

    await supabase
      .from('datasets')
      .update({ image_count: count || 0, updated_at: new Date().toISOString() })
      .eq('id', datasetId);

    // Return success with any errors that occurred
    if (uploadedImages.length === 0 && errors.length > 0) {
      return NextResponse.json({ 
        error: errors.join(', '), 
        uploadedImages: [] 
      }, { status: 400 });
    }

    if (errors.length > 0) {
      return NextResponse.json({ 
        message: `${uploadedImages.length} uploaded, ${errors.length} failed`,
        errors,
        uploadedImages 
      }, { status: 207 }); // 207 Multi-Status
    }

    // Return uploadedImages in a consistent object format
    return NextResponse.json({ 
      uploadedImages 
    }, { status: 201 });
  } catch (error) {
    console.error('Error uploading images:', error);
    return NextResponse.json({ error: 'Failed to upload images' }, { status: 500 });
  }
}

// DELETE - Delete an image from a dataset
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get('imageId');
    const datasetId = params.id;

    if (!imageId) {
      return NextResponse.json({ error: 'Image ID is required' }, { status: 400 });
    }

    // Get image details
    const { data: image, error: fetchError } = await supabase
      .from('dataset_images')
      .select('storage_path')
      .eq('id', imageId)
      .single();

    if (fetchError) throw fetchError;

    // Delete from storage
    await supabase.storage
      .from('dataset-images')
      .remove([image.storage_path]);

    // Delete from database
    const { error: deleteError } = await supabase
      .from('dataset_images')
      .delete()
      .eq('id', imageId);

    if (deleteError) throw deleteError;

    // Update dataset image count
    const { count } = await supabase
      .from('dataset_images')
      .select('*', { count: 'exact', head: true })
      .eq('dataset_id', datasetId);

    await supabase
      .from('datasets')
      .update({ image_count: count || 0, updated_at: new Date().toISOString() })
      .eq('id', datasetId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting image:', error);
    return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 });
  }
}
