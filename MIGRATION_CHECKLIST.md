# Migration Checklist

## Komplett liste over alle migreringer

Dette er en komplett liste over alle migrasjonsfiler i rekkefølge. Sjekk hvilke som mangler i din Supabase-database.

### Grunnleggende tabeller (001-005)
- [ ] **001_create_user_profiles.sql** - Oppretter brukerprofiler
- [ ] **002_create_friendships.sql** - Oppretter vennskapstabell
- [ ] **003_create_step_data.sql** - Oppretter skrittdatatabell
- [ ] **004_create_achievements.sql** - Oppretter achievement-tabeller
- [ ] **005_insert_achievement_types.sql** - Legger inn alle emoji-achievements

### Email og brukernavn (006-008)
- [ ] **006_add_email_to_user_profiles.sql** - Legger til email-kolonne
- [ ] **007_fix_user_profiles_rls_for_username_lookup.sql** - Fikser RLS for brukernavn
- [ ] **008_create_get_email_by_username_function.sql** - Oppretter funksjon for email-oppslag

### Device settings og anonyme brukere (009-011)
- [ ] **009_create_device_settings.sql** - Oppretter device_settings tabell
- [ ] **010_add_device_id_to_step_data.sql** - Legger til device_id til step_data
- [ ] **011_add_device_id_to_achievements.sql** - Legger til device_id til achievements

### Achievements og prestasjoner (012-013)
- [ ] **012_fix_achievements_rls_policies.sql** - Fikser RLS policies for achievements
- [ ] **013_update_achievement_descriptions_to_steps.sql** - Oppdaterer achievement-beskrivelser

### Avatar og bilder (014-017)
- [ ] **014_add_avatar_url_to_user_profiles.sql** - Legger til avatar_url til user_profiles
- [ ] **015_add_avatar_url_to_device_settings.sql** - Legger til avatar_url til device_settings
- [ ] **016_create_avatars_storage_bucket.sql** - Oppretter storage bucket for avatarer
- [ ] **017_auto_setup_storage.sql** - Auto-setup for storage

### Auto-setup (018)
- [ ] **018_auto_setup_all.sql** - Auto-setup for alle storage buckets

### Meldinger (019)
- [ ] **019_create_messages.sql** - Oppretter messages tabell

### Achievements - konkurranse og topp % (020-023)
- [ ] **020_add_competition_achievements.sql** - Legger til konkurranse-achievements
- [ ] **021_update_dagens_maal_emoji.sql** - Oppdaterer emoji for dagens mål
- [ ] **022_add_top_percentage_achievements.sql** - Legger til topp % achievements
- [ ] **023_add_global_ranking_rpc.sql** - Oppretter RPC for global ranking

### Running achievements (024-025)
- [ ] **024_add_running_achievements.sql** - Legger til løpe-achievements
- [ ] **025_add_running_distance_column.sql** - Legger til running_distance kolonne

### Brukerhåndtering (026-027)
- [ ] **026_delete_user_with_email_username.sql** - Oppretter funksjon for å slette bruker
- [ ] **027_add_bio_to_user_profiles.sql** - Legger til bio-kolonne

### Walk tracking og turer (028-032)
- [ ] **028_add_walk_tracking_columns.sql** - Legger til walk tracking kolonner
- [ ] **029_create_walks_table.sql** - Oppretter walks tabell
- [ ] **030_create_posts_table.sql** - Oppretter posts tabell
- [ ] **031_create_post_likes_table.sql** - Oppretter post_likes tabell
- [ ] **032_create_post_comments_table.sql** - Oppretter post_comments tabell

### Posts og feed (033-035)
- [ ] **033_create_get_friend_posts_function.sql** - Oppretter RPC for å hente venne-innlegg
- [ ] **034_insert_sample_walks.sql** - Eksempeldata for turer (valgfritt)
- [ ] **035_fix_get_friend_posts_function.sql** - Fikser get_friend_posts funksjon

### Eksempeldata (036-039)
- [ ] **036_insert_new_sample_walks.sql** - Ny eksempeldata (valgfritt)
- [ ] **037_insert_realistic_walks.sql** - Realistisk eksempeldata (valgfritt)
- [ ] **038_cleanup_test_running_achievements.sql** - Rydder opp test-data (valgfritt)
- [ ] **039_force_remove_all_running_achievements.sql** - Fjerner alle løpe-achievements (valgfritt)

### Bilder og kart (040-043)
- [ ] **040_add_multiple_images_to_posts.sql** - Legger til støtte for flere bilder
- [ ] **041_create_posts_storage_bucket.sql** - Oppretter storage bucket for bilder
- [ ] **042_add_images_to_get_friend_posts.sql** - Legger til bilder i get_friend_posts
- [ ] **043_add_map_position_to_posts.sql** - Legger til map_position kolonne

### Display settings (044)
- [ ] **044_add_post_display_settings.sql** - Legger til display_settings kolonne

### Walk tracking - avanserte innstillinger (045-047)
- [ ] **045_add_home_area_settings.sql** - Legger til hjemområde-innstillinger
- [ ] **046_add_walk_viewed_status.sql** - Legger til is_viewed kolonne
- [ ] **047_add_advanced_walk_tracking_settings.sql** - Legger til avanserte tracking-innstillinger

### Notifikasjoner (048-052)
- [ ] **048_create_notifications_table.sql** - Oppretter notifications tabell
- [ ] **049_add_parent_comment_id.sql** - Legger til parent_comment_id
- [ ] **050_add_reply_notifications.sql** - Legger til reply notifikasjoner
- [ ] **051_create_comment_likes_table.sql** - Oppretter comment_likes tabell
- [ ] **052_add_comment_like_notifications.sql** - Legger til comment_like notifikasjoner

### Internationalization (053)
- [ ] **053_add_basic_i18n_columns.sql** - Legger til språk og distanse-enhet kolonner

### Aktivitetsnotifikasjoner (054-056)
- [ ] **054_add_activity_notifications.sql** - Legger til aktivitetsnotifikasjoner
- [ ] **055_add_activity_notification_settings.sql** - Legger til innstillinger for aktivitetsnotifikasjoner
- [ ] **056_create_push_notification_tokens.sql** - Oppretter push_notification_tokens tabell

---

## Hvordan sjekke hvilke migreringer som mangler

### Metode 1: Sjekk tabeller i Supabase Dashboard

1. Gå til Supabase Dashboard → **Table Editor**
2. Sjekk om følgende tabeller eksisterer:

**Grunnleggende tabeller:**
- `user_profiles`
- `friendships`
- `step_data`
- `achievement_types`
- `user_achievements`
- `achievement_log`
- `device_settings`

**Walk tracking:**
- `walks`

**Posts og sosialt:**
- `posts`
- `post_likes`
- `post_comments`
- `comment_likes`

**Meldinger:**
- `messages`

**Notifikasjoner:**
- `notifications`
- `push_notification_tokens`

### Metode 2: Sjekk kolonner i eksisterende tabeller

Åpne SQL Editor i Supabase og kjør:

```sql
-- Sjekk user_profiles kolonner
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
ORDER BY ordinal_position;
```

Sjekk om følgende kolonner finnes i `user_profiles`:
- `email` (006)
- `avatar_url` (014)
- `bio` (027)
- `enable_walk_tracking` (028)
- `auto_share_walks` (028)
- `home_area_radius_meters` (045)
- `home_latitude` (045)
- `home_longitude` (045)
- `min_walk_distance_meters` (047)
- `min_walk_speed_kmh` (047)
- `max_walk_speed_kmh` (047)
- `pause_tolerance_minutes` (047)
- `pause_radius_meters` (047)
- `language` (053)
- `distance_unit` (053)
- `phone_number` (053)
- `country_code` (053)
- `activity_notifications_enabled` (055)
- `weekly_average_notifications_enabled` (055)
- `top_percentage_notifications_enabled` (055)
- `goal_streak_notifications_enabled` (055)
- `weekly_goal_notifications_enabled` (055)

Sjekk om følgende kolonner finnes i `posts`:
- `images` (040)
- `primary_image_index` (040)
- `map_position` (043)
- `display_settings` (044)

Sjekk om følgende kolonner finnes i `notifications`:
- `comment_id` (049)
- `metadata` (054)
- Type constraint inkluderer: `weekly_average`, `top_percentage`, `goal_streak`, `weekly_goal` (054)

Sjekk om følgende kolonner finnes i `post_comments`:
- `parent_comment_id` (049)

Sjekk om følgende kolonner finnes i `walks`:
- `is_viewed` (046)

Sjekk om følgende kolonner finnes i `step_data`:
- `device_id` (010)
- `running_distance_meters` (025)

### Metode 3: Sjekk funksjoner

```sql
-- Sjekk om funksjoner eksisterer
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_type = 'FUNCTION';
```

Sjekk om følgende funksjoner finnes:
- `get_email_by_username` (008)
- `get_global_step_ranking` (023)
- `get_friend_posts` (033)

### Metode 4: Sjekk storage buckets

1. Gå til Supabase Dashboard → **Storage**
2. Sjekk om følgende buckets eksisterer:
- `avatars` (016)
- `posts` (041)

---

## Rask sjekk: Kjør denne SQL-spørringen

Kjør denne i SQL Editor for å se alle tabeller:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

Sammenlign med listen over forventede tabeller over.

---

## Nye migreringer som må kjøres (siste 3)

Basert på det vi nettopp har implementert, må du kjøre:

1. **054_add_activity_notifications.sql** - Utvider notifications tabell
2. **055_add_activity_notification_settings.sql** - Legger til innstillinger
3. **056_create_push_notification_tokens.sql** - Oppretter push tokens tabell

---

## Tips

- Kjør migreringene i rekkefølge (nummerert)
- Hvis en migrering feiler, sjekk feilmeldingen og fikse problemet før du fortsetter
- Noen migreringer (034, 036, 037, 038, 039) er valgfritt eksempeldata - du kan hoppe over disse hvis du vil
- Bruk `IF NOT EXISTS` i migreringene - de skal være trygge å kjøre flere ganger

