-- Add RPC function for global ranking
-- This allows the app to get all users' step data for a specific date
-- for calculating global top percentage achievements
-- Uses SECURITY DEFINER to bypass RLS

CREATE OR REPLACE FUNCTION public.get_global_step_ranking(target_date DATE)
RETURNS TABLE (
  user_id UUID,
  steps INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sd.user_id,
    sd.steps
  FROM public.step_data sd
  WHERE sd.date = target_date
    AND sd.user_id IS NOT NULL -- Only logged-in users
  ORDER BY sd.steps DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_global_step_ranking(DATE) TO authenticated;

