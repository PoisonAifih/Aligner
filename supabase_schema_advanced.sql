ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS current_aligner_date timestamptz,
ADD COLUMN IF NOT EXISTS is_journey_active boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS public.assignments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    dentist_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    patient_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(dentist_id, patient_id)
);

ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage assignments"
    ON public.assignments
    FOR ALL
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Dentists can view assigned patients logs"
    ON public.timer_logs
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.assignments
            WHERE assignments.dentist_id = auth.uid()
            AND assignments.patient_id = timer_logs.user_id
        )
    );
