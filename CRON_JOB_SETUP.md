# Cron Job Setup for Activity Notifications

## Nåværende løsning

Aktivitetsnotifikasjoner opprettes automatisk når:
- ✅ Brukeren åpner appen
- ✅ Appen sjekker for nye notifikasjoner
- ✅ Push notifications sendes automatisk

**Dette fungerer godt for de fleste brukere!**

---

## Hvorfor automatisk cron job?

En automatisk cron job kan være nyttig for:
- **Ukentlig oppsummering**: Sende notifikasjon mandag morgen kl. 08:00
- **Topp % notifikasjoner**: Sende notifikasjon hver morgen for i går
- **Brukere som ikke åpner appen ofte**: Sørge for at de får notifikasjoner

---

## Alternativer for automatisk sending

### Alternativ 1: pg_cron (Enklest)

**Hva det er:** PostgreSQL-utvidelse som kjører SQL-funksjoner på bestemte tidspunkter.

**Hvordan sette opp:**

1. **Aktiver pg_cron:**
   - Gå til Supabase Dashboard
   - Database → Extensions
   - Søk etter "pg_cron"
   - Klikk "Enable"

2. **Kjør migrasjon 057:**
   - Kjør `057_create_activity_notifications_cron.sql` i SQL Editor

3. **Schedule cron job (valgfritt):**
   ```sql
   SELECT cron.schedule(
     'trigger-activity-notifications',
     '0 8 * * *', -- Every day at 8:00 AM UTC
     $$
     SELECT public.trigger_activity_notifications_check();
     $$
   );
   ```

**Begrensning:** Denne funksjonen er kun en placeholder. Den faktiske logikken er i TypeScript og kan ikke kjøres direkte fra SQL.

---

### Alternativ 2: Supabase Edge Function + External Cron

**Hva det er:** En Edge Function som kan kalles av en ekstern cron-tjeneste.

**Hvordan sette opp:**

1. **Deploy Edge Function:**
   ```bash
   # Install Supabase CLI
   npm install -g supabase
   
   # Login
   supabase login
   
   # Link project
   supabase link --project-ref YOUR_PROJECT_REF
   
   # Deploy function
   supabase functions deploy check-activity-notifications
   ```

2. **Set opp ekstern cron:**
   - Bruk en tjeneste som [cron-job.org](https://cron-job.org) eller [EasyCron](https://www.easycron.com)
   - Sett opp HTTP request til: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/check-activity-notifications`
   - Legg til header: `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`
   - Schedule: Hver dag kl. 08:00 UTC

**Fordel:** Kan bruke full TypeScript-logikk fra `activityNotificationService.ts`

---

### Alternativ 3: Behold nåværende løsning (Anbefalt)

**Hvorfor:**
- ✅ Fungerer allerede
- ✅ Ingen ekstra oppsett
- ✅ Notifikasjoner opprettes når brukeren åpner appen
- ✅ Push notifications sendes automatisk

**Når å vurdere cron job:**
- Hvis du vil sende notifikasjoner på bestemte tidspunkter (f.eks. mandag morgen)
- Hvis du har mange brukere som ikke åpner appen ofte
- Hvis du vil ha mer kontroll over når notifikasjoner sendes

---

## Anbefaling

**For nå:** Behold app-basert sjekk. Den fungerer godt og dekker de fleste use cases.

**Fremtidig:** Hvis du trenger automatisk sending på bestemte tidspunkter, sett opp Edge Function + ekstern cron (Alternativ 2).

---

## Testing

For å teste at notifikasjoner fungerer:

1. **Åpne appen** - Notifikasjoner skal sjekkes automatisk
2. **Sjekk NotificationsScreen** - Se om nye notifikasjoner vises
3. **Sjekk push notifications** - Lukk appen og vent på push notification

---

## Troubleshooting

### Notifikasjoner opprettes ikke
- Sjekk at migreringer 054, 055 er kjørt
- Sjekk at bruker har aktivitetsnotifikasjoner aktivert i innstillinger
- Sjekk console logs for feilmeldinger

### Push notifications sendes ikke
- Sjekk at migrering 056 er kjørt
- Sjekk at push token er registrert (se i `push_notification_tokens` tabell)
- Sjekk at notification permissions er gitt
- Verifiser at appen er bygget (ikke Expo Go)
