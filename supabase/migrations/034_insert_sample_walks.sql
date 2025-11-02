-- Insert sample walks for all existing users
-- This creates example walks to showcase the walk tracking UI

-- Function to generate sample route coordinates
-- Creates a route starting in Oslo area and walking around
CREATE OR REPLACE FUNCTION generate_sample_route(
  start_lat DECIMAL,
  start_lng DECIMAL,
  num_points INTEGER DEFAULT 30
) RETURNS JSONB AS $$
DECLARE
  coordinates JSONB := '[]'::JSONB;
  i INTEGER;
  lat DECIMAL;
  lng DECIMAL;
  coord_time TIMESTAMPTZ;
BEGIN
  lat := start_lat;
  lng := start_lng;
  coord_time := NOW() - INTERVAL '7 days';
  
  FOR i IN 1..num_points LOOP
    -- Walk in a roughly circular/meandering pattern
    lat := lat + (RANDOM() - 0.5) * 0.002; -- ~200m variation
    lng := lng + (RANDOM() - 0.5) * 0.003; -- ~300m variation
    coord_time := coord_time + INTERVAL '30 seconds';
    
    coordinates := coordinates || jsonb_build_object(
      'lat', lat,
      'lng', lng,
      'timestamp', coord_time::TEXT
    );
  END LOOP;
  
  RETURN coordinates;
END;
$$ LANGUAGE plpgsql;

-- Insert sample walks for all users
-- Using DO block to loop through users
DO $$
DECLARE
  user_record RECORD;
  walk_record RECORD;
  walk_id UUID;
  start_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
  duration_mins INTEGER;
  distance_m INTEGER;
  avg_speed DECIMAL;
  max_speed DECIMAL;
  steps_count INTEGER;
  start_lat DECIMAL;
  start_lng DECIMAL;
  coordinates JSONB;
  i INTEGER;
  walk_dates DATE[] := ARRAY[
    NOW()::DATE - INTERVAL '1 day',
    NOW()::DATE - INTERVAL '3 days',
    NOW()::DATE - INTERVAL '5 days',
    NOW()::DATE - INTERVAL '7 days',
    NOW()::DATE - INTERVAL '10 days'
  ];
  walk_distances INTEGER[] := ARRAY[1200, 2500, 1800, 3200, 1500]; -- meters
  walk_durations INTEGER[] := ARRAY[15, 28, 22, 35, 18]; -- minutes
  walk_steps INTEGER[] := ARRAY[1500, 3100, 2200, 4000, 1900];
  should_share BOOLEAN[] := ARRAY[true, true, false, true, false];
  walk_contents TEXT[] := ARRAY[
    'Fin tur i solen! ☀️',
    'God treningstur 🏃',
    NULL,
    'Lenger tur i dag, bra tempo! 💪',
    NULL
  ];
BEGIN
  -- Loop through all users
  FOR user_record IN SELECT id FROM public.user_profiles LOOP
    -- Create 5 sample walks for each user
    FOR i IN 1..5 LOOP
      -- Calculate walk details
      start_lat := 59.9139 + (RANDOM() - 0.5) * 0.1; -- Oslo area ± ~10km
      start_lng := 10.7522 + (RANDOM() - 0.5) * 0.1;
      
      distance_m := walk_distances[i];
      duration_mins := walk_durations[i];
      steps_count := walk_steps[i];
      
      -- Calculate speeds (realistic walking speeds: 4-6 km/h average)
      avg_speed := (distance_m::DECIMAL / 1000.0) / (duration_mins::DECIMAL / 60.0);
      max_speed := avg_speed * (1.0 + RANDOM() * 0.3); -- Max is 30% faster
      
      -- Set start and end times
      start_time := walk_dates[i]::TIMESTAMPTZ + INTERVAL '14 hours' + (RANDOM() * INTERVAL '4 hours');
      end_time := start_time + (duration_mins || ' minutes')::INTERVAL;
      
      -- Generate route coordinates
      coordinates := generate_sample_route(start_lat, start_lng, 25 + (i * 5));
      
      -- Insert walk
      INSERT INTO public.walks (
        user_id,
        device_id,
        start_time,
        end_time,
        duration_minutes,
        distance_meters,
        steps,
        average_speed_kmh,
        max_speed_kmh,
        route_coordinates,
        start_location_lat,
        start_location_lng,
        end_location_lat,
        end_location_lng,
        is_shared,
        created_at,
        updated_at
      ) VALUES (
        user_record.id,
        NULL,
        start_time,
        end_time,
        duration_mins,
        distance_m,
        steps_count,
        ROUND(avg_speed, 2),
        ROUND(max_speed, 2),
        coordinates,
        (coordinates->0->>'lat')::DECIMAL,
        (coordinates->0->>'lng')::DECIMAL,
        (coordinates->-1->>'lat')::DECIMAL,
        (coordinates->-1->>'lng')::DECIMAL,
        should_share[i],
        walk_dates[i]::TIMESTAMPTZ,
        walk_dates[i]::TIMESTAMPTZ
      )
      RETURNING id INTO walk_id;
      
      -- Create post if walk should be shared and has content
      IF should_share[i] AND walk_contents[i] IS NOT NULL THEN
        INSERT INTO public.posts (
          user_id,
          walk_id,
          content,
          image_url,
          created_at,
          updated_at
        ) VALUES (
          user_record.id,
          walk_id,
          walk_contents[i],
          NULL,
          walk_dates[i]::TIMESTAMPTZ + INTERVAL '5 minutes',
          walk_dates[i]::TIMESTAMPTZ + INTERVAL '5 minutes'
        );
      END IF;
    END LOOP;
    
    RAISE NOTICE 'Created 5 sample walks for user %', user_record.id;
  END LOOP;
  
  RAISE NOTICE 'Finished inserting sample walks';
END $$;

-- Cleanup function
DROP FUNCTION IF EXISTS generate_sample_route(DECIMAL, DECIMAL, INTEGER);

