# Forslag til Løp-prestasjoner

## Konsept

Løp-prestasjoner skal tildeles basert på **distanse oppnådd gjennom løp/jogging** (ikke gange).

## Prestasjoner

- **5 km løpt**: 5 km løpt/jogget i løpet av en dag
- **10 km løpt**: 10 km løpt/jogget i løpet av en dag
- **Halvmaraton (21,1 km) løpt**: 21,1 km (2,1 mil) løpt i løpet av en dag
- **Maraton (42,2 km) løpt**: 42,2 km (4,2 mil) løpt i løpet av en dag

## Utfordringer og løsninger

### Utfordring 1: Hvordan spore løpt distanse?

**Problem:** Vi har kun total distanse og totalt antall skritt. Vi vet ikke hvilken del som ble løpt vs gått.

**Løsninger:**

#### Alternativ A: Beregn basert på aktivitetstype (anbefalt)
- Vi har allerede aktivitetstype-deteksjon basert på hastighet
- Spor hastighet for hver oppdatering av skritt-data
- Hvis hastighet indikerer løp/jogging (>8 km/t) → tell denne distansen som løpt
- Akkumuler løpt distanse gjennom dagen

#### Alternativ B: Spor i step_data tabellen
- Legg til kolonner: `running_distance_meters`, `jogging_distance_meters`, `walking_distance_meters`
- Beregn og oppdater hver gang skritt-data lagres
- Mer komplekst, men mer nøyaktig

#### Alternativ C: Bruk minimums-hastighet over tid
- For å få løp-prestasjon må brukeren ha hatt minimum X km/t i minst Y minutter
- Mer komplekst å beregne

### Utfordring 2: Visning

**Problem:** Vil ikke dette forvirre brukere som går samme strekning?

**Løsning:**
- Prestasjonene er tydelig merket som "løpt" (ikke bare "gått")
- De får ikke prestasjonen hvis de går
- Det er helt greit - det gir ekstra utfordring for de som løper

## Implementeringsforslag

### Fase 1: Enkel versjon (anbefalt for start)

1. **Beregn løpt distanse ved oppdatering:**
   - Hver gang skritt-data oppdateres, sjekk hastighet
   - Hvis hastighet >= 8 km/t → tell distanse-endring som løpt
   - Lagre akkumulert løpt distanse for dagen i metadata eller separat tabell

2. **Sjekk prestasjoner:**
   - Sjekk akkumulert løpt distanse ved dagens slutt (eller kontinuerlig)
   - Gi prestasjon når milepæl nås (5km, 10km, 21,1km, 42,2km)

3. **Emoji-forslag:**
   - 🏃 5 km løpt
   - 🏃‍♀️ 10 km løpt (eller samme 🏃)
   - 🏁 Halvmaraton løpt (21,1 km) - Checkered flag
   - 🏃‍♂️ Maraton løpt (42,2 km) - eller 🏁

### Fase 2: Mer nøyaktig versjon

1. **Lagre aktivitetstype-data:**
   - Lag ny tabell: `activity_segments` eller legg til i `step_data`
   - Spor: start_tid, slutt_tid, hastighet, distanse, aktivitetstype
   - Mer komplekst, men gir bedre tracking

## Emoji-forslag

### Alternativ 1: Løper-tema (anbefalt)
- 🏃 **5 km løpt**
- 🏃‍♀️ **10 km løpt**
- 🏁 **Halvmaraton løpt** (21,1 km) - Checkered flag
- 🏃‍♂️ **Maraton løpt** (42,2 km)

### Alternativ 2: Variasjon
- 🏃 **5 km løpt**
- ⚡ **10 km løpt** (lyn - fart)
- 🏁 **Halvmaraton løpt** (checkered flag)
- 💨 **Maraton løpt** (vind - fart)

### Alternativ 3: Enkel
- 🏃 **5 km løpt**
- 🏃 **10 km løpt** (samme emoji)
- 🏃 **Halvmaraton løpt**
- 🏃 **Maraton løpt**

**Min anbefaling:** Alternativ 1 eller 3 (avhengig av om vi vil ha variasjon)

## Tekniske detaljer

### Hvordan beregne løpt distanse?

```typescript
// Pseudokode
const calculateRunningDistance = async (userId: string, date: string) => {
  // Hent alle oppdateringer for dagen
  const updates = await getStepDataUpdates(userId, date);
  
  let runningDistance = 0;
  
  for (let i = 1; i < updates.length; i++) {
    const prev = updates[i-1];
    const curr = updates[i];
    
    const timeDiff = curr.updated_at - prev.updated_at;
    const distanceDiff = curr.distance_meters - prev.distance_meters;
    
    if (timeDiff > 0 && distanceDiff > 0) {
      const speedKmh = (distanceDiff / 1000) / (timeDiff / 3600000);
      
      // Hvis hastighet >= 8 km/t (jogging eller løping)
      if (speedKmh >= 8) {
        runningDistance += distanceDiff;
      }
    }
  }
  
  return runningDistance;
};
```

## ⚠️ VIKTIG UTfordring: Appen må være åpen

### Problem:
- **Når appen er åpen:** Vi får kontinuerlige oppdateringer via `Pedometer.watchStepCount()`, kan beregne hastighet
- **Når appen er lukket:** Vi får kun totalt antall skritt når appen åpnes igjen (ingen historikk)
- **Vi kan ikke beregne hastighet** for perioden appen var lukket

### Eksempel:
- Bruker løper 10 km mens appen er lukket
- Åpner appen senere → vi ser 10 km total distanse, men vet ikke om det ble løpt eller gått
- **Vi kan ikke gi løp-prestasjon uten historikk**

## Løsninger

### Alternativ 1: Aksepter begrensningen (enklest)
- **Kun gi løp-prestasjoner hvis appen var åpen under løpet**
- Prestasjoner gis basert på hastighet beregnet fra oppdateringer mens appen var aktiv
- Brukere som har appen åpen under løping vil få prestasjoner
- Brukere som løper med appen lukket får ikke prestasjoner

**Fordeler:**
- Enklest å implementere
- Ingen endringer i databasen
- Bruker eksisterende hastighetsberegning

**Ulemper:**
- Brukere må ha appen åpen for å få prestasjoner
- Noen løpeturer vil ikke registreres

### Alternativ 2: Lagre historikk (mer kompleks)
- Lag ny tabell: `step_data_history` eller lignende
- Lagre hver oppdatering (ikke bare siste) med timestamp
- Når appen åpnes igjen, sammenlign med forrige oppdatering
- Beregn hastighet basert på tidsspenn (mindre nøyaktig)

**Fordeler:**
- Fungerer også når appen har vært lukket
- Mer nøyaktig tracking

**Ulemper:**
- Mer kompleks implementering
- Må endre database-struktur
- Beregning ved gjenåpning er mindre nøyaktig (kan være timer/dager mellom oppdateringer)

### Alternativ 3: Kombinert (hybrid)
- Spore løpt distanse kontinuerlig når appen er åpen
- Når appen åpnes igjen, sammenlign med forrige lagrede verdi
- Hvis tidsforskjell er kort (< 1 time) og distanse-endring er stor → anta løp
- Mindre nøyaktig, men bedre enn ingenting

**Fordeler:**
- Fungerer delvis når appen har vært lukket
- Bedre enn alternativ 1

**Ulemper:**
- Mindre nøyaktig for perioder appen var lukket
- Kan gi feilaktige prestasjoner

## Min anbefaling

**Alternativ 1 (Aksepter begrensningen)** er best for start:
- Enklest å implementere
- Mer nøyaktig (kun prestasjoner for løp når appen var åpen)
- Brukere som vil ha løp-prestasjoner vil ha appen åpen uansett

**Alternativ 2 (Lagre historikk)** er best hvis vi vil ha full dekning:
- Mer kompleks, men gir best brukeropplevelse
- Krever database-endringer

## Spørsmål

1. **Hvilken løsning foretrekker du?**
   - [ ] Alternativ 1: Kun prestasjoner når appen er åpen (enklest)
   - [ ] Alternativ 2: Lagre historikk (mer kompleks, men fungerer alltid)
   - [ ] Alternativ 3: Hybrid (kombinert)

2. **Minimumshastighet for "løpt"?**
   - [ ] >= 8 km/t (jogging + løping)
   - [ ] >= 10 km/t (bare løping)
   - [ ] >= 12 km/t (bare løping)

3. **Skal vi ha separate prestasjoner for jogging vs løping?**
   - [ ] Ja, separate prestasjoner
   - [ ] Nei, kombinert (løp/jogging)

4. **Emoji-valg:**
   - [ ] Alternativ 1: 🏃 🏃‍♀️ 🏁 🏃‍♂️
   - [ ] Alternativ 2: 🏃 ⚡ 🏁 💨
   - [ ] Alternativ 3: 🏃 🏃 🏃 🏃

5. **Frekvens:**
   - [ ] Kun én gang per dag (per milepæl)
   - [ ] Kan fåes flere ganger (hvis man løper 2x 10km samme dag)

## Anbefaling

Jeg anbefaler:
- **Kontinuerlig sjekk** (prestasjon vises når milepæl nås)
- **Minimum 8 km/t** (inkluderer både jogging og løping)
- **Kombinert prestasjon** (ikke skille mellom jogging og løping)
- **Emoji: Alternativ 1** (🏃 🏃‍♀️ 🏁 🏃‍♂️) eller **Alternativ 3** (alle 🏃) hvis vi vil holde det enkelt
- **Kun én gang per milepæl per dag** (samme som andre prestasjoner)

Hva tenker du?

