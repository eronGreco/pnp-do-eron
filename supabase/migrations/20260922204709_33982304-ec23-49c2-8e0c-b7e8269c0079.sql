CREATE TABLE public.cricut_alignment_diagnostics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  operator_note text NOT NULL,
  issue_type text NOT NULL DEFAULT 'outro',
  current_settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  diagnosis text NOT NULL,
  recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_status text NOT NULL DEFAULT 'ok',
  ai_error text
);

GRANT ALL ON public.cricut_alignment_diagnostics TO service_role;

ALTER TABLE public.cricut_alignment_diagnostics ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_cricut_alignment_diagnostics_updated_at
BEFORE UPDATE ON public.cricut_alignment_diagnostics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();