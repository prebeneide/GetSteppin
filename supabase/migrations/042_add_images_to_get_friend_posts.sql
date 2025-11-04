-- Update get_friend_posts function to include images and primary_image_index

-- Drop existing function first (required when changing return type)
DROP FUNCTION IF EXISTS public.get_friend_posts(UUID, INTEGER, INTEGER);

-- Create updated function with images and primary_image_index
CREATE OR REPLACE FUNCTION public.get_friend_posts(
  user_id_param UUID,
  limit_param INTEGER DEFAULT 20,
  offset_param INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  walk_id UUID,
  content TEXT,
  image_url TEXT,
  images JSONB,
  primary_image_index INTEGER,
  map_position INTEGER,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  username TEXT,
  avatar_url TEXT,
  walk JSONB,
  likes_count BIGINT,
  comments_count BIGINT,
  is_liked BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH friend_posts AS (
    SELECT DISTINCT p.*
    FROM public.posts p
    INNER JOIN public.friendships f ON (
      (f.requester_id = user_id_param AND f.addressee_id = p.user_id AND f.status = 'accepted') OR
      (f.addressee_id = user_id_param AND f.requester_id = p.user_id AND f.status = 'accepted')
    )
    ORDER BY p.created_at DESC
    LIMIT limit_param
    OFFSET offset_param
  )
  SELECT 
    fp.id,
    fp.user_id,
    fp.walk_id,
    fp.content,
    fp.image_url,
    fp.images,
    fp.primary_image_index,
    fp.map_position,
    fp.created_at,
    fp.updated_at,
    COALESCE(up.username, 'Ukjent') AS username,
    up.avatar_url,
    CASE 
      WHEN fp.walk_id IS NOT NULL THEN (
        SELECT jsonb_build_object(
          'id', w.id,
          'user_id', w.user_id,
          'device_id', w.device_id,
          'start_time', w.start_time,
          'end_time', w.end_time,
          'duration_minutes', w.duration_minutes,
          'distance_meters', w.distance_meters,
          'steps', w.steps,
          'average_speed_kmh', w.average_speed_kmh,
          'max_speed_kmh', w.max_speed_kmh,
          'route_coordinates', w.route_coordinates,
          'start_location_lat', w.start_location_lat,
          'start_location_lng', w.start_location_lng,
          'end_location_lat', w.end_location_lat,
          'end_location_lng', w.end_location_lng,
          'is_shared', w.is_shared,
          'created_at', w.created_at,
          'updated_at', w.updated_at
        )
        FROM public.walks w
        WHERE w.id = fp.walk_id
      )
      ELSE NULL
    END AS walk,
    COALESCE(
      (SELECT COUNT(*) FROM public.post_likes pl WHERE pl.post_id = fp.id),
      0
    ) AS likes_count,
    COALESCE(
      (SELECT COUNT(*) FROM public.post_comments pc WHERE pc.post_id = fp.id),
      0
    ) AS comments_count,
    EXISTS(
      SELECT 1 FROM public.post_likes pl 
      WHERE pl.post_id = fp.id AND pl.user_id = user_id_param
    ) AS is_liked
  FROM friend_posts fp
  LEFT JOIN public.user_profiles up ON up.id = fp.user_id
  ORDER BY fp.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_friend_posts(UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_friend_posts(UUID, INTEGER, INTEGER) TO anon;

