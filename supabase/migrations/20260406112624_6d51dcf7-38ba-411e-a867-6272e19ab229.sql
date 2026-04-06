
-- Create storage bucket for complaint evidence
INSERT INTO storage.buckets (id, name, public) VALUES ('complaint-evidence', 'complaint-evidence', false);

-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload evidence" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'complaint-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to view their own files
CREATE POLICY "Users can view own evidence" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'complaint-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);
