// supabase/functions/_shared/utils/networkUtils.ts
import { supabase } from '../supabaseClient.ts';
import { USER_AGENT, REQUEST_TIMEOUT } from '../types.ts';

/*
 * Downloads an image from a URL using Deno's native fetch.
 * @param imageUrl The URL of the image to download.
 * @returns An ArrayBuffer containing the image data, or null if download fails.
 */
export async function downloadImage(imageUrl: string): Promise<ArrayBuffer | null> {
  if (!imageUrl) return null;
  try {
    const response = await fetch(imageUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT * 1000), // Deno-native timeout
    });

    if (response.ok && response.body) {
      return await response.arrayBuffer();
    } else {
      console.warn(`WARN (networkUtils): Failed to download image (status ${response.status}): ${imageUrl}`);
      return null;
    }
  } catch (error) {
    console.warn(`WARN (networkUtils): Exception downloading image ${imageUrl}:`, error);
    return null;
  }
}

/*
 * Uploads an image buffer to Supabase Storage.
 * @param imageBuffer The ArrayBuffer of the image.
 * @param recipeId The ID of the recipe, used for the storage path.
 * @param originalUrl The original URL for inferring the file extension.
 * @returns The public URL of the uploaded image, or the original URL as a fallback.
 */
export async function uploadImageToSupabase(
  imageBuffer: ArrayBuffer,
  recipeId: string,
  originalUrl: string
): Promise<string> {
  if (!supabase) {
    console.error('ERROR (networkUtils): Supabase client not initialized. Cannot upload.');
    return originalUrl; // Fallback
  }

  const urlPath = new URL(originalUrl).pathname;
  const extension = urlPath.substring(urlPath.lastIndexOf('.')).toLowerCase() || '.jpg';
  const mimeType = `image/${extension.slice(1)}`;
  const filePath = `${recipeId}/image${extension}`;

  try {
    const { error } = await supabase.storage
      .from('recipe_images')
      .upload(filePath, imageBuffer, {
        contentType: mimeType,
        upsert: true,
      });

    if (error) {
      console.error(`ERROR (networkUtils): Failed to upload image to Supabase: ${error.message}`);
      return originalUrl; // Fallback
    }

    const { data } = supabase.storage.from('recipe_images').getPublicUrl(filePath);
    console.log(`INFO (networkUtils): Successfully uploaded image to: ${data.publicUrl}`);
    return data.publicUrl;
  } catch (e) {
    console.error(`CRITICAL (networkUtils): Exception during Supabase upload:`, e);
    return originalUrl;
  }
}