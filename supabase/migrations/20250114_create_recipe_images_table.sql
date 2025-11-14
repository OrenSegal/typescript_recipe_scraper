-- ============================================
-- Recipe Images Storage Metadata Table
-- ============================================
-- Stores metadata for images uploaded to cloud storage
-- (Cloudflare R2, Supabase Storage, or Firebase)
-- ============================================

-- Create recipe_images table
CREATE TABLE IF NOT EXISTS recipe_images (
  -- Primary key
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Foreign keys
  recipe_id UUID REFERENCES recipes(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Image URLs
  original_url TEXT NOT NULL,
  webp_url TEXT,
  thumbnail_small_url TEXT,
  thumbnail_medium_url TEXT,
  thumbnail_large_url TEXT,

  -- CDN URLs (cached versions)
  cdn_original_url TEXT,
  cdn_webp_url TEXT,

  -- Image metadata
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  file_size INTEGER NOT NULL, -- bytes
  format VARCHAR(20) NOT NULL, -- jpeg, png, webp, etc.
  mime_type VARCHAR(50) NOT NULL,

  -- Storage info
  storage_provider VARCHAR(50) NOT NULL, -- cloudflare-r2, supabase, firebase
  storage_bucket VARCHAR(255) NOT NULL,
  storage_key TEXT NOT NULL, -- S3/R2 key or storage path

  -- Processing metadata
  processing_time_ms INTEGER,
  webp_savings_bytes INTEGER, -- how much space saved by WebP conversion
  quality INTEGER DEFAULT 80,

  -- Optional metadata
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Indexes for Performance
-- ============================================

-- Index on recipe_id (most common query)
CREATE INDEX idx_recipe_images_recipe_id ON recipe_images(recipe_id);

-- Index on user_id
CREATE INDEX idx_recipe_images_user_id ON recipe_images(user_id);

-- Index on storage_provider for analytics
CREATE INDEX idx_recipe_images_storage_provider ON recipe_images(storage_provider);

-- Index on created_at for time-based queries
CREATE INDEX idx_recipe_images_created_at ON recipe_images(created_at DESC);

-- Composite index for recipe + created_at
CREATE INDEX idx_recipe_images_recipe_created ON recipe_images(recipe_id, created_at DESC);

-- ============================================
-- Triggers
-- ============================================

-- Update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_recipe_images_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_recipe_images_updated_at
  BEFORE UPDATE ON recipe_images
  FOR EACH ROW
  EXECUTE FUNCTION update_recipe_images_updated_at();

-- ============================================
-- Row Level Security (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE recipe_images ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read images
CREATE POLICY "Allow public read access"
  ON recipe_images
  FOR SELECT
  TO public
  USING (true);

-- Policy: Authenticated users can insert their own images
CREATE POLICY "Allow authenticated users to insert"
  ON recipe_images
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
  );

-- Policy: Users can update their own images
CREATE POLICY "Allow users to update own images"
  ON recipe_images
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own images
CREATE POLICY "Allow users to delete own images"
  ON recipe_images
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Service role can do everything
CREATE POLICY "Allow service role full access"
  ON recipe_images
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================
-- Storage Statistics View
-- ============================================

CREATE OR REPLACE VIEW storage_statistics AS
SELECT
  storage_provider,
  COUNT(*) as total_images,
  SUM(file_size) as total_size_bytes,
  ROUND(AVG(file_size)) as avg_size_bytes,
  SUM(webp_savings_bytes) as total_webp_savings_bytes,
  COUNT(CASE WHEN webp_url IS NOT NULL THEN 1 END) as webp_conversions,
  ROUND(AVG(processing_time_ms)) as avg_processing_time_ms,
  MIN(created_at) as first_upload,
  MAX(created_at) as last_upload
FROM recipe_images
GROUP BY storage_provider;

-- Grant access to view
GRANT SELECT ON storage_statistics TO authenticated;
GRANT SELECT ON storage_statistics TO service_role;

-- ============================================
-- Helper Functions
-- ============================================

-- Function to get all images for a recipe
CREATE OR REPLACE FUNCTION get_recipe_images(p_recipe_id UUID)
RETURNS TABLE (
  id UUID,
  original_url TEXT,
  webp_url TEXT,
  thumbnails JSONB,
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ri.id,
    ri.original_url,
    ri.webp_url,
    jsonb_build_object(
      'small', ri.thumbnail_small_url,
      'medium', ri.thumbnail_medium_url,
      'large', ri.thumbnail_large_url
    ) as thumbnails,
    ri.width,
    ri.height,
    ri.file_size,
    ri.created_at
  FROM recipe_images ri
  WHERE ri.recipe_id = p_recipe_id
  ORDER BY ri.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate storage savings
CREATE OR REPLACE FUNCTION calculate_storage_savings()
RETURNS TABLE (
  provider VARCHAR,
  original_size_gb NUMERIC,
  webp_size_gb NUMERIC,
  savings_gb NUMERIC,
  savings_percentage NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    storage_provider::VARCHAR,
    ROUND((SUM(file_size) + COALESCE(SUM(webp_savings_bytes), 0))::NUMERIC / 1073741824, 2) as original_size_gb,
    ROUND(SUM(file_size)::NUMERIC / 1073741824, 2) as webp_size_gb,
    ROUND(COALESCE(SUM(webp_savings_bytes), 0)::NUMERIC / 1073741824, 2) as savings_gb,
    ROUND(
      (COALESCE(SUM(webp_savings_bytes), 0)::NUMERIC /
      NULLIF(SUM(file_size) + COALESCE(SUM(webp_savings_bytes), 0), 0)) * 100,
      2
    ) as savings_percentage
  FROM recipe_images
  GROUP BY storage_provider;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Comments for Documentation
-- ============================================

COMMENT ON TABLE recipe_images IS 'Stores metadata for recipe images uploaded to cloud storage (R2, Supabase, Firebase)';
COMMENT ON COLUMN recipe_images.original_url IS 'URL of the original uploaded image';
COMMENT ON COLUMN recipe_images.webp_url IS 'URL of the WebP-converted version';
COMMENT ON COLUMN recipe_images.storage_key IS 'S3/R2 object key or storage path';
COMMENT ON COLUMN recipe_images.webp_savings_bytes IS 'Bytes saved by WebP conversion (original_size - webp_size)';

-- ============================================
-- Sample Query Examples (for testing)
-- ============================================

-- Get storage statistics
-- SELECT * FROM storage_statistics;

-- Get all images for a recipe
-- SELECT * FROM get_recipe_images('recipe-uuid-here');

-- Calculate storage savings
-- SELECT * FROM calculate_storage_savings();

-- Find largest images
-- SELECT recipe_id, original_url, file_size, width, height
-- FROM recipe_images
-- ORDER BY file_size DESC
-- LIMIT 10;

-- Find images uploaded today
-- SELECT COUNT(*), storage_provider
-- FROM recipe_images
-- WHERE created_at >= CURRENT_DATE
-- GROUP BY storage_provider;
