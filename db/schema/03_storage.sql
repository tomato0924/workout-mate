-- Supabase Storage Configuration
-- Create storage buckets and set up access policies

-- =====================================================
-- Create storage bucket for workout images
-- =====================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('workout-images', 'workout-images', true)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- Storage policies for workout-images bucket
-- =====================================================

-- Anyone can view images (since bucket is public)
CREATE POLICY "Anyone can view workout images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'workout-images');

-- Authenticated users can upload images
CREATE POLICY "Authenticated users can upload workout images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'workout-images' AND
    auth.role() = 'authenticated'
  );

-- Users can update their own images
CREATE POLICY "Users can update own workout images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'workout-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can delete their own images
CREATE POLICY "Users can delete own workout images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'workout-images' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );
