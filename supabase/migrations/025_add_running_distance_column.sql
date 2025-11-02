-- Add running_distance_meters column to step_data
-- This tracks distance covered at running/jogging speed (>= 8 km/h) separately from total distance

ALTER TABLE public.step_data 
ADD COLUMN IF NOT EXISTS running_distance_meters INTEGER DEFAULT 0;

-- Add index for queries filtering by running distance
CREATE INDEX IF NOT EXISTS idx_step_data_running_distance ON public.step_data(running_distance_meters);

-- Comment explaining the column
COMMENT ON COLUMN public.step_data.running_distance_meters IS 'Accumulated distance covered at running/jogging speed (>= 8 km/h) for this day. Only updated when app is active.';

