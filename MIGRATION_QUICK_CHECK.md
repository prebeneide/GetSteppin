# Rask sjekk av migreringer

## Enkleste metode: Sjekk de 3 siste migreringene

De 3 siste migreringene vi nettopp har laget må kjøres:

1. **054_add_activity_notifications.sql**
2. **055_add_activity_notification_settings.sql**
3. **056_create_push_notification_tokens.sql**

### Hvordan sjekke om de mangler:

#### Sjekk 054 (Activity Notifications):
Kjør i SQL Editor:
```sql
-- Sjekk om notifications tabell har metadata kolonne
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'notifications' 
AND column_name = 'metadata';
```
Hvis ingen rad returneres → **054 mangler**

#### Sjekk 055 (Activity Notification Settings):
Kjør i SQL Editor:
```sql
-- Sjekk om user_profiles har activity_notifications_enabled
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND column_name = 'activity_notifications_enabled';
```
Hvis ingen rad returneres → **055 mangler**

#### Sjekk 056 (Push Notification Tokens):
Kjør i SQL Editor:
```sql
-- Sjekk om push_notification_tokens tabell eksisterer
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'push_notification_tokens';
```
Hvis ingen rad returneres → **056 mangler**

---

## Komplett sjekk: Kjør CHECK_MIGRATIONS.sql

1. Åpne `supabase/migrations/CHECK_MIGRATIONS.sql`
2. Kopier hele innholdet
3. Lim inn i Supabase SQL Editor
4. Kjør spørringen
5. Se resultatene - ✅ betyr eksisterer, ❌ betyr mangler

---

## Alle migreringer i rekkefølge (56 totalt)

Se `MIGRATION_CHECKLIST.md` for komplett liste med alle 56 migreringer.

