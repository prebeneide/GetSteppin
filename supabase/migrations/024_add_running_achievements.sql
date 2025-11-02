-- Add Running Achievements
-- Distance-based running achievements (requires running/jogging speed >= 8 km/h)

INSERT INTO public.achievement_types (emoji, name, description, category, requirement_value) VALUES
-- Running achievements (distance-based, requires running/jogging)
('🏃', '5 km løpt', 'Løpt/jogget 5 km på én dag', 'distance', 5000),
('🏃‍♀️', '10 km løpt', 'Løpt/jogget 10 km på én dag', 'distance', 10000),
('🏁', 'Halvmaraton løpt', 'Løpt halvmaraton (21,1 km) på én dag', 'distance', 21100),
('🏃‍♂️', 'Maraton løpt', 'Løpt maraton (42,2 km) på én dag', 'distance', 42200)
ON CONFLICT DO NOTHING;

