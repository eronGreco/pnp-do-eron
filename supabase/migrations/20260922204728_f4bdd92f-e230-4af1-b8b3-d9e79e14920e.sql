CREATE POLICY "Somente backend gerencia diagnosticos Cricut"
ON public.cricut_alignment_diagnostics
FOR ALL
USING (false)
WITH CHECK (false);