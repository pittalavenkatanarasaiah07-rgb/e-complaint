CREATE POLICY "Users can delete their own complaints"
ON public.complaints
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);