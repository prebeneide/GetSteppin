# Internasjonaliseringsforslag for GetSteppin

## Oversikt
Dette dokumentet beskriver forslaget for å gjøre GetSteppin tilgjengelig for brukere over hele verden med støtte for flere språk, formater og enheter.

---

## 1. Språkstøtte (i18n)

### 1.1 Støttede språk
- **Norsk** (norsk bokmål) - Standard
- **Engelsk** (US/UK) - Minimum krav

### 1.2 Implementering
- Bruk `react-i18next` eller `expo-localization` for språkstøtte
- Lagre alle tekster i oversettelsesfiler (JSON/YAML)
- Struktur: `locales/nb/translations.json`, `locales/en/translations.json`
- Automatisk detektering av enhetsspråk ved første oppstart
- Mulighet til å endre språk i innstillinger

### 1.3 Tekster som må oversettes
- Alle UI-tekster (knapper, labels, meldinger)
- Feilmeldinger
- Notifikasjoner
- Achievement-beskrivelser
- Innstillinger og beskrivelser

---

## 2. Distanse-enheter

### 2.1 Støttede enheter
- **Kilometer (km)** - Standard (Norge, Europa, etc.)
- **Miles (mi)** - USA, UK
- **Meter (m)** - For korte distanser (< 1000m)

### 2.2 Implementering
- Lagre brukerpreferanse i `user_profiles` tabell: `distance_unit` (ENUM: 'km', 'mi')
- Konvertering mellom enheter:
  - 1 mile = 1.60934 km
  - 1 km = 0.621371 miles
- Automatisk konvertering basert på brukerens landvalg (valgfritt)
- Visning:
  - `formatDistance(meters, unit)` - formaterer distanse med riktig enhet
  - Eksempel: 5000m → "5.00 km" eller "3.11 mi"

### 2.3 Hvor det brukes
- Walk distance display (feed, profile, detail pages)
- Walk statistics (total distance, average, etc.)
- Achievement descriptions
- Settings (home area radius, min walk distance)
- Map display (hvis relevant)

---

## 3. Dato og klokkeslett-format

### 3.1 Støttede formater
- **Norsk format**: DD.MM.YYYY, HH:mm (24-timers)
- **Engelsk format**: MM/DD/YYYY eller DD/MM/YYYY (avhengig av region), HH:mm (12-timers eller 24-timers)
- **ISO format**: YYYY-MM-DD (valgfritt)

### 3.2 Implementering
- Bruk `date-fns` eller `Intl.DateTimeFormat` for formatering
- Lagre brukerpreferanse: `date_format` og `time_format`
- Automatisk detektering basert på enhetsspråk/region
- Støttede formater:
  - `date_format`: 'DD.MM.YYYY' | 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD'
  - `time_format`: '24h' | '12h'
  - `timezone`: Brukerens tidssone (automatisk fra enhet)

### 3.3 Hvor det brukes
- Walk start/end times
- Post creation dates
- Comment timestamps
- Notification timestamps
- Achievement dates
- Profile creation date

---

## 4. Tidssone

### 4.1 Implementering
- Automatisk detektering av brukerens tidssone fra enheten
- Lagre i `user_profiles`: `timezone` (TEXT, f.eks. "Europe/Oslo", "America/New_York")
- Bruk `date-fns-tz` eller `luxon` for tidssone-håndtering
- Alle tidsstempler i databasen lagres i UTC (TIMESTAMPTZ)
- Konvertering til brukerens tidssone ved visning

### 4.2 Eksempler
- Walk start time: Lagret som UTC, vises i brukerens tidssone
- Notifikasjoner: Vises i brukerens lokale tid

---

## 5. Telefonnummer-registrering

### 5.1 Implementering
- Legg til telefonnummer-felt i `user_profiles`: `phone_number` (TEXT)
- Landskode-valg ved registrering:
  - Dropdown med land og flagg
  - Automatisk landskode basert på brukerens lokasjon (valgfritt)
  - Eksempel: "+47" (Norge), "+1" (USA), "+44" (UK)
- Validering av telefonnummer-format
- Lagre fullstendig nummer med landskode: `+4712345678`

### 5.2 Søk etter brukere
- Søk etter brukernavn (eksisterende)
- Søk etter telefonnummer (ny funksjonalitet)
- Søk etter e-post (eksisterende)
- Søk kan kombinere disse metodene

### 5.3 Database-endringer
```sql
ALTER TABLE user_profiles
ADD COLUMN phone_number TEXT,
ADD COLUMN country_code TEXT; -- ISO 3166-1 alpha-2 (f.eks. "NO", "US", "GB")
```

---

## 6. Onboarding og innstillinger

### 6.1 Onboarding-flyt (ny bruker)
1. **Velkommen** - Velg språk
2. **Profil** - Opprett bruker (brukernavn, e-post, passord)
3. **Telefonnummer** - Legg til telefonnummer med landskode
4. **Land/Region** - Velg land (for automatisk innstillinger)
5. **Enheter** - Bekreft eller endre:
   - Distanse-enhet (km/mi)
   - Dato-format
   - Klokkeslett-format
   - Tidssone
6. **Ferdig** - Start appen

### 6.2 Innstillinger-skjerm
- Ny seksjon: "Språk og region"
- Språkvalg (dropdown)
- Distanse-enhet (radio buttons eller dropdown)
- Dato-format (dropdown)
- Klokkeslett-format (toggle: 12h/24h)
- Tidssone (automatisk, men kan endres)
- Telefonnummer (kan endres)
- Land (kan endres)

---

## 7. Database-endringer

### 7.1 User Profiles
```sql
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'nb', -- 'nb' | 'en'
ADD COLUMN IF NOT EXISTS distance_unit TEXT DEFAULT 'km', -- 'km' | 'mi'
ADD COLUMN IF NOT EXISTS date_format TEXT DEFAULT 'DD.MM.YYYY', -- Format-string
ADD COLUMN IF NOT EXISTS time_format TEXT DEFAULT '24h', -- '24h' | '12h'
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Oslo', -- Timezone string
ADD COLUMN IF NOT EXISTS phone_number TEXT, -- Full phone number with country code
ADD COLUMN IF NOT EXISTS country_code TEXT; -- ISO 3166-1 alpha-2
```

### 7.2 Device Settings (for anonyme brukere)
```sql
ALTER TABLE device_settings
ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'nb',
ADD COLUMN IF NOT EXISTS distance_unit TEXT DEFAULT 'km',
ADD COLUMN IF NOT EXISTS date_format TEXT DEFAULT 'DD.MM.YYYY',
ADD COLUMN IF NOT EXISTS time_format TEXT DEFAULT '24h',
ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Oslo';
```

---

## 8. Kode-struktur

### 8.1 Nye filer/komponenter
```
lib/
  i18n.ts                    # i18n konfigurasjon
  formatters.ts              # Formatering av distanse, dato, tid
  phoneNumber.ts             # Telefonnummer validering og formatering

locales/
  nb/
    translations.json        # Norske tekster
  en/
    translations.json        # Engelske tekster

components/
  LanguageSelector.tsx        # Språkvelger
  DistanceUnitSelector.tsx   # Distanse-enhet velger
  DateFormatSelector.tsx     # Dato-format velger
  PhoneNumberInput.tsx       # Telefonnummer input med landskode
  CountrySelector.tsx        # Land-velger med flagg

screens/
  OnboardingScreen.tsx       # Oppdatert onboarding
  SettingsScreen.tsx         # Oppdatert med nye innstillinger
  PhoneNumberScreen.tsx      # Ny skjerm for telefonnummer (onboarding)
  PreferencesScreen.tsx      # Ny skjerm for enheter/formater (onboarding)
```

### 8.2 Utility-funksjoner

#### `formatDistance(meters, unit)`
```typescript
// Konverterer meter til km eller miles og formaterer
formatDistance(5000, 'km') → "5.00 km"
formatDistance(5000, 'mi') → "3.11 mi"
```

#### `formatDate(date, format, locale)`
```typescript
// Formaterer dato basert på brukerpreferanse
formatDate(new Date(), 'DD.MM.YYYY', 'nb') → "15.12.2024"
formatDate(new Date(), 'MM/DD/YYYY', 'en') → "12/15/2024"
```

#### `formatTime(date, format, locale)`
```typescript
// Formaterer klokkeslett
formatTime(new Date(), '24h', 'nb') → "17:30"
formatTime(new Date(), '12h', 'en') → "5:30 PM"
```

#### `formatPhoneNumber(phoneNumber, countryCode)`
```typescript
// Formaterer telefonnummer for visning
formatPhoneNumber('+4712345678', 'NO') → "+47 12 34 56 78"
formatPhoneNumber('+11234567890', 'US') → "+1 (123) 456-7890"
```

---

## 9. Telefonnummer-søk

### 9.1 Implementering
- Oppdater `friendService.ts` med ny søkefunksjon
- Søk etter telefonnummer (med eller uten landskode)
- Søk etter brukernavn (eksisterende)
- Søk etter e-post (eksisterende)
- Kombinert søk (alle tre)

### 9.2 Database-query
```sql
-- Søk etter bruker basert på telefonnummer, brukernavn eller e-post
SELECT * FROM user_profiles
WHERE 
  phone_number = $1 
  OR username = $2 
  OR email = $3;
```

---

## 10. Migrasjonsstrategi

### 10.1 Fase 1: Database-endringer
1. Legg til nye kolonner i `user_profiles` og `device_settings`
2. Sett standardverdier for eksisterende brukere basert på:
   - Enhetsspråk (norsk/engelsk)
   - Enhetens tidssone
   - Standard enheter (km for norske brukere)

### 10.2 Fase 2: Backend-utvidelser
1. Oppdater alle service-funksjoner for å støtte formatering
2. Legg til telefonnummer i brukerregistrering
3. Oppdater søkefunksjoner

### 10.3 Fase 3: Frontend-implementering
1. Legg til i18n-bibliotek og oversettelser
2. Oppdater alle skjermer til å bruke formatering
3. Legg til onboarding-steg for telefonnummer og preferanser
4. Oppdater innstillinger-skjerm

### 10.4 Fase 4: Testing
1. Test alle formater med forskjellige enheter
2. Test telefonnummer-validering
3. Test søk etter telefonnummer
4. Test oversettelser

---

## 11. Eksempel på bruk

### 11.1 Distanse-visning
```typescript
// Før (hardkodet):
<Text>{distance} km</Text>

// Etter (dynamisk):
<Text>{formatDistance(distance, user.preferences.distance_unit)}</Text>
```

### 11.2 Dato-visning
```typescript
// Før:
<Text>{new Date(walk.start_time).toLocaleDateString('nb-NO')}</Text>

// Etter:
<Text>{formatDate(walk.start_time, user.preferences.date_format, user.preferences.language)}</Text>
```

### 11.3 Telefonnummer-input
```tsx
<PhoneNumberInput
  value={phoneNumber}
  onChange={setPhoneNumber}
  countryCode={countryCode}
  onCountryChange={setCountryCode}
/>
```

---

## 12. Ytelseshensyn

- Cache brukerpreferanser lokalt for rask tilgang
- Lazy load oversettelsesfiler (kun last inn valgt språk)
- Bruk memoization for formatering (hvis nødvendig)
- Index på `phone_number` for rask søk

---

## 13. Fremtidig utvidelse

- Flere språk (tysk, fransk, spansk, etc.)
- Flere distanse-enheter (yards, feet for spesielle tilfeller)
- Flere dato-formater
- Flere tidssoner per bruker (for reisende)
- Automatisk validering av telefonnummer via SMS (valgfritt)

---

## 14. Anbefalte biblioteker

- **i18n**: `react-i18next` eller `expo-localization`
- **Dato/tid**: `date-fns` + `date-fns-tz` eller `luxon`
- **Telefonnummer**: `libphonenumber-js` (validering og formatering)
- **Land/flag**: `country-flag-icons` eller `react-native-country-picker-modal`

---

## 15. Prioritert implementeringsrekkefølge

1. **Database-endringer** - Legg til kolonner og migrasjoner
2. **Telefonnummer-registrering** - Legg til i onboarding og profil
3. **Distanse-enheter** - Implementer km/mi konvertering og visning
4. **Språkstøtte** - Legg til engelsk oversettelse
5. **Dato/tid-formater** - Implementer formatering
6. **Telefonnummer-søk** - Legg til søkefunksjonalitet
7. **Innstillinger** - Oppdater settings-skjerm
8. **Testing og finpussing**

---

Dette forslaget gir en grundig plan for internasjonalisering av GetSteppin. La meg vite hvis du vil justere noe eller har spørsmål!

