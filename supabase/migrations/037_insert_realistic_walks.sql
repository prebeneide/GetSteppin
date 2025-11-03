-- Insert realistic short walks along streets (not through buildings)
-- These walks follow actual street patterns in Oslo area
-- This version creates shorter, more realistic routes

-- Helper function to generate realistic street-based route coordinates
CREATE OR REPLACE FUNCTION public.generate_street_route(
  start_lat DECIMAL,
  start_lng DECIMAL,
  distance_meters INTEGER,
  num_points INTEGER DEFAULT 20
) RETURNS JSONB AS $$
DECLARE
  coordinates JSONB := '[]'::JSONB;
  i INTEGER;
  lat DECIMAL;
  lng DECIMAL;
  coord_time TIMESTAMPTZ;
  -- Calculate step size based on distance
  step_lat DECIMAL;
  step_lng DECIMAL;
  -- Add some variation but keep it street-like (mostly straight lines with slight curves)
  variation DECIMAL;
BEGIN
  lat := start_lat;
  lng := start_lng;
  coord_time := NOW() - INTERVAL '2 days';
  
  -- Calculate approximate step size (simplified - assumes roughly north-south or east-west movement)
  -- Small steps for realistic walking
  step_lat := (distance_meters / num_points) / 111320.0; -- meters to degrees (latitude)
  step_lng := (distance_meters / num_points) / (111320.0 * COS(RADIANS(start_lat))); -- longitude adjustment
  
  FOR i IN 1..num_points LOOP
    -- Add small variation to simulate walking along streets (not perfectly straight)
    variation := (RANDOM() - 0.5) * 0.0002; -- ~20m variation
    
    -- Walk mostly in one direction (simulate street following)
    -- Alternate slightly between lat and lng to simulate street turns
    IF MOD(i, 5) = 0 THEN
      -- Small turn (street corner)
      lat := lat + step_lat * 0.8 + variation * 2;
      lng := lng + step_lng * 0.2 + variation;
    ELSE
      -- Continue straight (along street)
      lat := lat + step_lat + variation;
      lng := lng + step_lng + variation;
    END IF;
    
    coord_time := coord_time + INTERVAL '15 seconds';
    
    coordinates := coordinates || jsonb_build_object(
      'lat', lat,
      'lng', lng,
      'timestamp', coord_time::TEXT
    );
  END LOOP;
  
  RETURN coordinates;
END;
$$ LANGUAGE plpgsql;

-- Delete old sample walks
DELETE FROM public.posts WHERE walk_id IN (
  SELECT id FROM public.walks WHERE created_at < NOW() - INTERVAL '1 day'
);
DELETE FROM public.walks WHERE created_at < NOW() - INTERVAL '1 day';

-- Insert realistic short walks for all users
DO $$
DECLARE
  user_record RECORD;
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
  location_idx INTEGER;
  -- Realistic Oslo locations for walks (separate arrays for lat/lng)
  oslo_lats DECIMAL[] := ARRAY[59.9139, 59.9214, 59.9042, 59.9170, 59.9085];
  oslo_lngs DECIMAL[] := ARRAY[10.7522, 10.7612, 10.7534, 10.7465, 10.7601];
  -- Shorter, more realistic walks
  walk_distances INTEGER[] := ARRAY[800, 1200, 1500, 1000, 900]; -- meters (shorter walks)
  walk_durations INTEGER[] := ARRAY[10, 15, 18, 12, 11]; -- minutes
  walk_steps INTEGER[] := ARRAY[1000, 1500, 1800, 1250, 1100];
  should_share BOOLEAN[] := ARRAY[true, true, true, false, false];
  walk_contents TEXT[] := ARRAY[
    'Kort tur i nabolaget 🚶',
    'God treningstur! 💪',
    'Fin tur i solen ☀️',
    NULL,
    NULL
  ];
BEGIN
  -- Loop through all users
  FOR user_record IN SELECT id FROM public.user_profiles LOOP
    -- Create 5 realistic short walks for each user
    FOR i IN 1..5 LOOP
      -- Pick a realistic Oslo location (cycle through locations)
      location_idx := ((i - 1) % array_length(oslo_lats, 1)) + 1;
      start_lat := oslo_lats[location_idx] + (RANDOM() - 0.5) * 0.01; -- ± ~1km from location
      start_lng := oslo_lngs[location_idx] + (RANDOM() - 0.5) * 0.01;
      
      distance_m := walk_distances[i];
      duration_mins := walk_durations[i];
      steps_count := walk_steps[i];
      
      -- Calculate speeds (realistic walking speeds: 4-5 km/h average)
      avg_speed := (distance_m::DECIMAL / 1000.0) / (duration_mins::DECIMAL / 60.0);
      max_speed := avg_speed * (1.0 + RANDOM() * 0.2); -- Max is 20% faster
      
      -- Set start and end times (recent, not too old)
      start_time := NOW() - INTERVAL '2 days' + (RANDOM() * INTERVAL '2 days');
      end_time := start_time + (duration_mins || ' minutes')::INTERVAL;
      
      -- Generate realistic street-based route coordinates
      -- Use fewer points for shorter walks (20-30 points)
      coordinates := generate_street_route(start_lat, start_lng, distance_m, 20 + i * 2);
      
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
        start_time,
        start_time
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
          start_time + INTERVAL '5 minutes',
          start_time + INTERVAL '5 minutes'
        )
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;
    
    RAISE NOTICE 'Created realistic walks for user: %', user_record.id;
  END LOOP;
  
  -- Cleanup function
  DROP FUNCTION IF EXISTS generate_street_route(DECIMAL, DECIMAL, INTEGER, INTEGER);
  
  RAISE NOTICE 'Realistic walks creation completed';
END;
$$;

