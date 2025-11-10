# Push Notifications Setup Guide

## Oversikt

Push notifications er nå implementert for aktivitetsnotifikasjoner. Dette gjør at brukere kan motta notifikasjoner på telefonen selv når appen ikke er åpen.

## Hva er implementert

### 1. Database
- **`push_notification_tokens` tabell**: Lagrer push notification tokens for hver bruker
- **RLS policies**: Sikrer at brukere kun kan se/endre sine egne tokens

### 2. Push Notification Service
- **`pushNotificationService.ts`**: Håndterer:
  - Registrering av push tokens
  - Sending av push notifications via Expo Push Notification API
  - Formatering av notifikasjonsmeldinger basert på type og språk

### 3. Push Notification Handler
- **`PushNotificationHandler.tsx`**: Komponent som:
  - Registrerer push token når bruker logger inn
  - Setter opp listeners for notifikasjoner
  - Håndterer navigasjon når bruker trykker på notifikasjon

### 4. Integrering
- **Automatisk sending**: Når aktivitetsnotifikasjoner opprettes, sendes push notifications automatisk
- **Språkstøtte**: Notifikasjoner sendes på brukerens foretrukne språk

## Hvordan det fungerer

### 1. Token Registrering
Når bruker logger inn:
1. Appen ber om notification permissions
2. Henter Expo Push Token
3. Lagrer token i `push_notification_tokens` tabell

### 2. Sending av Notifikasjoner
Når aktivitetsnotifikasjon opprettes:
1. Notifikasjon lagres i `notifications` tabell
2. Henter brukerens push tokens
3. Formaterer melding basert på type og språk
4. Sender via Expo Push Notification API til alle brukerens enheter

### 3. Mottak av Notifikasjoner
- **Appen er åpen**: Notifikasjon vises automatisk (konfigurert i `setNotificationHandler`)
- **Appen er lukket**: Notifikasjon vises i notification center
- **Trykk på notifikasjon**: Navigerer til riktig skjerm (PostDetail eller Notifications)

## Testing

### I Expo Go
Push notifications fungerer **ikke** i Expo Go. Du må bygge en development build for å teste.

### I Development Build
1. Bygg appen med EAS Build
2. Installer på telefonen
3. Logg inn
4. Gi notification permissions når appen spør
5. Vent på at aktivitetsnotifikasjoner opprettes (eller trigger manuelt)
6. Notifikasjoner skal vises på telefonen

## Konfigurasjon

### app.json
- **iOS**: `expo-notifications` plugin er konfigurert
- **Android**: Permissions er lagt til (`RECEIVE_BOOT_COMPLETED`, `VIBRATE`)

### Expo Push Notification API
- Bruker Expo's gratis Push Notification API
- Ingen ekstra konfigurasjon nødvendig
- Fungerer for både iOS og Android

## Begrensninger

1. **Expo Go**: Push notifications fungerer ikke i Expo Go
2. **Permissions**: Brukeren må gi notification permissions
3. **Internet**: Krever internettforbindelse for å sende notifikasjoner

## Fremtidige forbedringer

1. **Supabase Edge Function**: For automatisk sending av notifikasjoner (cron job)
2. **Local Notifications**: For notifikasjoner som ikke krever server
3. **Notification Scheduling**: For å planlegge notifikasjoner (f.eks. ukentlig oppsummering mandag morgen)

## Troubleshooting

### Notifikasjoner vises ikke
1. Sjekk at notification permissions er gitt
2. Sjekk at push token er registrert (se i database)
3. Sjekk console logs for feilmeldinger
4. Verifiser at appen er bygget (ikke Expo Go)

### Token registreres ikke
1. Sjekk at notification permissions er gitt
2. Sjekk console logs for feilmeldinger
3. Verifiser at `projectId` i `getPushNotificationToken` matcher `app.json`

### Notifikasjoner sendes ikke
1. Sjekk at bruker har push tokens i databasen
2. Sjekk console logs for feilmeldinger fra Expo API
3. Verifiser at notifikasjonen faktisk ble opprettet i `notifications` tabell

