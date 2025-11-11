import { createClient } from '@supabase/supabase-js';
import { config } from '../config.js';

const supabase = createClient(config.supabaseUrl!, config.supabaseServiceKey!);
// Default to 'public' bucket which is created by default in Supabase projects
const DEFAULT_BUCKET_NAME = 'public';

/*
 * Check if a storage bucket exists and return the first available bucket or create one
 */
async function getAvailableBucket(): Promise<string> {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.warn(`[Image] Error listing buckets: ${error.message}. Attempting to create bucket.`);
    } else if (buckets && buckets.length > 0) {
      console.log(`[Image] Using available bucket: ${buckets[0].name}`);
      return buckets[0].name;
    } else {
      console.log(`[Image] No buckets found, will attempt to create one.`);
    }
    
    // Try to create a new bucket
    console.log(`[Image] Attempting to create bucket: ${DEFAULT_BUCKET_NAME}`);
    const { data: newBucket, error: createError } = await supabase.storage.createBucket(DEFAULT_BUCKET_NAME, {
      public: true // Make the bucket publicly accessible
    });
    
    if (createError) {
      console.warn(`[Image] Failed to create bucket: ${createError.message}. Will continue with default name.`);
    } else {
      console.log(`[Image] Successfully created bucket: ${DEFAULT_BUCKET_NAME}`);
    }
    
    return DEFAULT_BUCKET_NAME;
  } catch (e) {
    console.warn(`[Image] Exception handling buckets: ${e}. Using default bucket.`);
    return DEFAULT_BUCKET_NAME;
  }
}

/*
 * Check if a URL is directly accessible as an image resource.
 * @param url The URL to check.
 * @returns True if the URL is directly accessible as an image.
 */
async function isDirectlyAccessibleImage(url: string): Promise<boolean> {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  try {
    const response = await fetch(url, { method: 'HEAD' });
    if (!response.ok) return false;
    
    // Check if content-type indicates an image
    const contentType = response.headers.get('content-type');
    return !!contentType && contentType.startsWith('image/');
  } catch (error) {
    // Connection errors, CORS issues, etc.
    return false;
  }
}

/*
 * Processes an image URL by either using it directly (if accessible) or uploading to Supabase Storage.
 * @param imageUrl The original public URL of the image.
 * @param recipeId The UUID of the recipe, used for naming the image file.
 * @returns The usable public URL of the image, either original or Supabase Storage, or null if failed.
 */
export async function processAndUploadImage(imageUrl: string, recipeId: string): Promise<string | null> {
  if (!imageUrl) {
    console.log('[Image] No image URL provided, skipping.');
    return null;
  }
  
  // Check if the URL is an object and handle it gracefully
  if (typeof imageUrl !== 'string') {
    console.log(`[Image] Invalid image URL type: ${typeof imageUrl}, trying to extract URL property`);
    // If it's an object with a url property, use that
    const imgObj = imageUrl as any; // Type assertion to avoid TS errors
    if (typeof imgObj === 'object' && imgObj !== null && 'url' in imgObj && typeof imgObj.url === 'string') {
      imageUrl = imgObj.url;
    } else {
      console.error(`[Image] Failed to extract valid URL from ${JSON.stringify(imageUrl)}`);
      return null;
    }
  }
  
  // First, try to use the original URL directly
  console.log(`[Image] Checking if URL is directly accessible: ${imageUrl}`);
  const isDirectAccess = await isDirectlyAccessibleImage(imageUrl);
  
  if (isDirectAccess) {
    console.log(`[Image] URL is directly accessible, using original: ${imageUrl}`);
    return imageUrl;
  }
  
  console.log(`[Image] URL is not directly accessible, will download and upload to Supabase: ${imageUrl}`);

  try {
    console.log(`[Image] Downloading from: ${imageUrl}`);
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.statusText}`);
    }
    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const fileExtension = contentType.split('/')[1] || 'jpg';
    
    // Get an available bucket
    const bucketName = await getAvailableBucket();
    
    // Use the recipeId as a unique, stable filename.
    // Avoid nesting in 'public' folder if the bucket is already named 'public'
    const filePath = bucketName === 'public' 
      ? `${recipeId}.${fileExtension}`
      : `public/${recipeId}.${fileExtension}`;

    console.log(`[Image] Uploading to Supabase Storage bucket '${bucketName}' at path: ${filePath}`);
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, imageBuffer, {
        contentType,
        upsert: true, // Overwrite if an image for this recipe already exists
      });

    if (uploadError) {
      throw new Error(`Supabase upload failed: ${uploadError.message}`);
    }

    // Get the public URL for the newly uploaded file.
    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    console.log(`[Image] Successfully uploaded. Public URL: ${publicUrlData.publicUrl}`);
    return publicUrlData.publicUrl;

  } catch (error) {
    if (error instanceof Error) {
        console.error(`[Image] Failed to process image from ${imageUrl}:`, error.message);
    }
    return null;
  }
}