CREATE TABLE IF NOT EXISTS public.college_master (
  college_code text PRIMARY KEY,
  college_name text NOT NULL,
  district text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.college_master TO anon, authenticated;
GRANT ALL ON public.college_master TO service_role;

ALTER TABLE public.college_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "College master: public read"
  ON public.college_master FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS college_master_name_idx ON public.college_master USING gin (to_tsvector('simple', college_name));

-- Seed / refresh from kcet_cutoffs (best district guess: leave NULL; app maps from name)
INSERT INTO public.college_master (college_code, college_name)
SELECT DISTINCT ON (college_code) college_code, college_name
FROM public.kcet_cutoffs
WHERE college_code IS NOT NULL AND college_name IS NOT NULL
ORDER BY college_code, college_name
ON CONFLICT (college_code) DO UPDATE SET college_name = EXCLUDED.college_name, updated_at = now();