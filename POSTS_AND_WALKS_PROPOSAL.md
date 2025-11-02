# Innlegg og Turoppdeling - Forslag

## Overordnet konsept

Legge til et sosialt innlegg-system hvor brukere kan dele og diskutere turer de har gått/løpt. Dette vil gjøre brukerne mer investert i appen ved å legge til et sosialt element.

## Funksjonalitet

### 1. Automatisk Turoppdeling

**Teknisk løsning:**
- Legge til GPS-tracking via `expo-location` (må installeres)
- Spore brukerens posisjon når de går/løper
- Automatisk detektere turer basert på:
  - Kontinuerlig bevegelse i minst 5 minutter
  - Distanse >= 1 km
  - Start/stop deteksjon basert på hastighet (0 km/h → >3 km/h → 0 km/h)

**Data som lagres:**
- `walks` tabell:
  - `id`, `user_id`, `device_id`
  - `start_time`, `end_time`, `duration_minutes`
  - `distance_meters`, `average_speed_kmh`, `max_speed_kmh`
  - `steps` (fra step counter)
  - `route_coordinates` (JSONB array med lat/lng punkter)
  - `start_location` (lat, lng), `end_location` (lat, lng)
  - `created_at`, `updated_at`

**Forslag til oppføring:**
- Vis turer automatisk i en "Mine turer" seksjon
- Brukere kan velge å dele en tur som innlegg
- Vis kart med rute

### 2. Innlegg-system

**Tabell-struktur:**
```sql
posts (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES user_profiles(id),
  walk_id UUID REFERENCES walks(id), -- NULL hvis ikke relatert til tur
  content TEXT, -- Brukerens beskrivelse
  image_url TEXT, -- Valgfritt bilde
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)

post_likes (
  id UUID PRIMARY KEY,
  post_id UUID REFERENCES posts(id),
  user_id UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ,
  UNIQUE(post_id, user_id)
)

post_comments (
  id UUID PRIMARY KEY,
  post_id UUID REFERENCES posts(id),
  user_id UUID REFERENCES user_profiles(id),
  content TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**UI-funksjoner:**
- Feed med innlegg fra venner + populære innlegg
- Hver innlegg viser:
  - Profilbilde og brukernavn
  - Tittel (hvis det er en tur: "5.2 km tur", ellers custom)
  - Kart-visning (hvis det er en tur)
  - Bilde (hvis lastet opp)
  - Tekst-beskrivelse
  - Like-knapp (med antall)
  - Kommentar-knapp (med antall)
  - Del-knapp
- Mulighet til å:
  - Like/Unlike
  - Kommentere
  - Dele sine egne turer
  - Se detaljer om en tur (kart, statistikk)

### 3. Turoppdeling Flow

**Automatisk oppdeling:**
1. Bruker starter å gå/løpe (app må være åpen)
2. GPS starter å spore posisjon
3. Når bruker stopper (hastighet < 1 km/h i 30 sekunder):
   - Sjekk om distanse >= 1 km
   - Hvis ja, lagre tur
   - Vis melding: "Du har fullført en tur på X.X km! Vil du dele den?"

**Manuell deling:**
1. Gå til "Mine turer"
2. Velg en tur
3. Trykk "Del som innlegg"
4. Legg til bilde (valgfritt)
5. Legg til beskrivelse
6. Publiser

### 4. Kart-visning

**Teknologi:**
- Bruk `react-native-maps` eller `expo-maps` (anbefaler expo-maps)
- Vis rute som polylinje på kartet
- Markører for start (grønn) og slutt (rød)
- Zoom til å vise hele ruten

**Statistikk på turen:**
- Distanse
- Varighet
- Gjennomsnittlig hastighet
- Maks hastighet
- Antall skritt
- Kalorier (estimert)

## Implementasjonsplan

### Fase 1: GPS-tracking og tur-datastruktur
1. Installer `expo-location`
2. Legg til GPS-tracking i appen
3. Implementer tur-deteksjon
4. Opprett database-tabeller (`walks`, `walk_coordinates`)
5. Lagre turer automatisk

### Fase 2: Vis turer
1. "Mine turer" skjerm
2. Kart-visning av tur
3. Tur-statistikk

### Fase 3: Innlegg-system
1. Database-tabeller (`posts`, `post_likes`, `post_comments`)
2. Feed-skjerm
3. Like/kommentar-funksjonalitet
4. Deling av turer

### Fase 4: Sosiale funksjoner
1. Feed med venner + populære
2. Notifikasjoner for likes/kommentarer
3. Deling og sosial interaksjon

## Spørsmål til diskusjon

1. **GPS-tracking:** Skal turer kun spore når appen er åpen, eller i bakgrunnen også?
   - **Anbefaling:** Kun når appen er åpen (enklere, bedre batteri)
   - Alternativ: Bakgrunns-tracking (krever mer tillatelser)

2. **Minimums-distanse:** 1 km som foreslått, eller noe annet?

3. **Privatliv:** Skal alle kunne se turene dine, eller bare venner?
   - **Anbefaling:** Standard: bare venner, men kan gjøres offentlig

4. **Bilde-opplasting:** Skal alle innlegg kunne ha bilder, eller kun turer?

5. **Feed-sortering:** Hva skal vises først?
   - Venner først
   - Nyeste først
   - Populære (mest likes)
   - Hybrid (foreslått)

## Tekniske detaljer

### Pakker som trengs:
- `expo-location` - GPS-tracking
- `react-native-maps` eller `expo-maps` - Kart-visning
- Mulig `expo-background-location` hvis bakgrunns-tracking ønskes

### Batteri-hensyn:
- GPS bruker mye batteri
- Foreslått løsning: Kun tracke når brukeren aktivt går (hastighet > 3 km/h)
- Stopp tracking etter 5 minutter uten bevegelse
- Oppdater posisjon hvert 10. sekund (ikke kontinuerlig)

### Privatliv og tillatelser:
- Be om location-tillatelse ved første bruk
- Forklar hvorfor (for å spore turer)
- Gi mulighet til å skru av GPS-tracking i innstillinger

## Alternativer

### Alternativ 1: Kun manuell opplasting
- Ingen automatisk GPS-tracking
- Brukere kan manuelt opplaste innlegg med bilder
- Enklere å implementere, men mindre automatisk

### Alternativ 2: Hybrid
- Automatisk deteksjon basert på skritt (uten GPS)
- Når bruker går > 1 km, foreslå å opplaste innlegg
- Manuell bilde-opplasting og beskrivelse
- Ingen kart, men kan ha generisk "tur"-badge

### Alternativ 3: Full automatisk (foreslått)
- GPS-tracking med automatisk tur-deteksjon
- Kart-visning
- Automatisk oppslag når tur er fullført
- Mest engasjerende, men mer kompleks

## Anbefaling

Jeg anbefaler **Alternativ 3** (full automatisk) fordi:
- Høyest brukerengasjement
- Unik funksjonalitet (automatisk turoppdeling)
- Sosialt element med kart-deling
- Mest "wow-factor"

Men vi kan starte enklere og bygge ut gradvis!

## Neste steg

Hvis dette høres bra ut, kan jeg:
1. Starte med Fase 1 (GPS-tracking og tur-datastruktur)
2. Implementere et enklere system først og bygge ut
3. Lage et mer detaljert teknisk spesifikasjon før implementering

Hva tenker du? Hvilken tilnærming ønsker du?

