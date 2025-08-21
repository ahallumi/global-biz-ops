-- Create storage bucket for intake photos
INSERT INTO storage.buckets (id, name, public) VALUES ('intake-photos', 'intake-photos', true);

-- Create storage policy for intake photos - users can upload their own photos
CREATE POLICY "Users can upload intake photos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'intake-photos' AND auth.uid() IS NOT NULL);

-- Create storage policy for viewing intake photos - anyone can view
CREATE POLICY "Anyone can view intake photos" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'intake-photos');