# Forslag til "Topp 5%" Prestasjon

## Konsept

"Topp 5%" skal være en **global prestasjon** basert på din ranking blant **ALLE brukere i appen**, ikke bare venner.

## Forslag til implementering

### 1. Prestasjonstyper

Vi kan ha "Topp 5%" prestasjoner for ulike perioder:
- **🌍 Topp 5% - Dag**: Blant topp 5% av alle brukere i dag
- **🌍 Topp 5% - Uke**: Blant topp 5% av alle brukere denne uken
- **🌍 Topp 5% - Måned**: Blant topp 5% av alle brukere denne måneden
- **🌍 Topp 5% - År**: Blant topp 5% av alle brukere dette året

**Alternativt emoji-utvalg:**
- ⭐ Topp 5% (allerede i bruk, kan forvirrende)
- 🌍 Topp 5% (jordglobus - global)
- 🏅 Topp 5% (medalje)
- 💎 Topp 5% (diamant - eksklusivt)
- 👑 Topp 5% (allerede brukt for månedens vinner)
- 🥇 Topp 5% (allerede brukt for daglig gull)
- 🎖️ Topp 5% (militær medalje)

### 2. Beregning

**Hvordan sjekke om bruker er i topp 5%:**

1. **Hent totalt antall aktive brukere** i perioden
   - Brukere som har lagt inn skritt-data i perioden
   
2. **Hent brukerens totale skritt** i perioden
   - Sum skritt for dagen/uken/måneden/året

3. **Hent ranking** blant alle brukere
   - Sorter alle brukere etter totale skritt (høyest først)
   - Finn brukerens posisjon (rank)

4. **Regn ut prosentandel**
   - `rank / totalt_antall_brukere * 100`
   - Hvis resultat <= 5% → gi prestasjon

**Eksempel:**
- Totalt 1000 aktive brukere i dag
- Topp 5% = 50 brukere
- Hvis du er på posisjon 1-50 → du er i topp 5%

### 3. Utfordringer og løsninger

#### Utfordring 1: Ytelse
**Problem:** Å hente alle brukere og sjekke ranking kan være tungt for databasen.

**Løsninger:**
- **Caching**: Beregn topp 5% én gang per time og lagre i cache
- **Async job**: Kjør beregning i bakgrunnen (ikke real-time)
- **Sjekk kun ved dagens slutt**: Kun sjekk for i går (permanent prestasjon)
- **Batch processing**: Prosesser alle brukere i batches

#### Utfordring 2: Minimum antall brukere
**Problem:** Hva hvis det bare er 10 brukere? Topp 5% = 0.5 brukere.

**Løsning:** Sett minimum grense
- Minimum 100 aktive brukere for at prestasjonen skal utdeles
- Eller minimum 20 aktive brukere (topp 5% = 1 bruker minimum)

#### Utfordring 3: Anonymous users
**Problem:** Skal anonyme brukere telles med?

**Løsning:** 
- Kun inkluder innloggede brukere (med user_id)
- Eller inkluder både anonyme og innloggede (mer inkluderende)

### 4. Implementeringsforslag

#### A. Forenklet versjon (anbefalt for start)
- **Kun daglig "Topp 5%"** (permanent)
- Sjekk **i går** når appen starter i dag
- Minimum 100 aktive brukere forrige dag
- Emoji: 🌍 eller 💎

#### B. Full versjon
- Alle perioder (dag, uke, måned, år)
- Både foreløpige og permanente
- Real-time oppdatering (hver time)
- Emoji: 🌍

#### C. Hybrid versjon
- **Daglig**: Sjekk i går (permanent)
- **Uke/Måned/År**: Foreløpig visning basert på nåværende ranking
- **Permanent**: Sjekk ved periodens slutt

### 5. Database-spørringer (pseudokode)

```sql
-- Hent totalt antall aktive brukere i perioden
SELECT COUNT(DISTINCT user_id) 
FROM step_data 
WHERE date >= start_date AND date <= end_date
AND user_id IS NOT NULL;

-- Hent alle brukeres totale skritt i perioden (sortert)
SELECT 
  user_id,
  SUM(steps) as total_steps,
  ROW_NUMBER() OVER (ORDER BY SUM(steps) DESC) as rank
FROM step_data
WHERE date >= start_date AND date <= end_date
AND user_id IS NOT NULL
GROUP BY user_id;

-- Finn om bruker er i topp 5%
-- rank <= (total_users * 0.05)
```

### 6. Foreslått emoji og navn

**Hovedforslag:**
- 🌍 **"Topp 5%"** - Jordglobus symboliserer global ranking

**Alternativer:**
- 💎 **"Topp 5%"** - Diamant symboliserer eksklusivitet
- 🏅 **"Topp 5%"** - Medalje for prestasjon
- 🎖️ **"Topp 5%"** - Militær medalje

### 7. Visning i appen

**Foreløpige prestasjoner:**
- Vises med "Foreløpig" badge
- Oppdateres hver time eller hver gang brukeren åpner appen

**Permanente prestasjoner:**
- Lagres i databasen ved periodens slutt
- Vises uten "Foreløpig" badge

## Spørsmål til deg:

1. **Hvilken emoji foretrekker du?** 🌍 💎 🏅 🎖️ (eller annet?)

2. **Hvilke perioder vil du ha?**
   - [ ] Daglig
   - [ ] Ukentlig  
   - [ ] Månedlig
   - [ ] Årlig

3. **Skal det være både foreløpige og permanente?**
   - [ ] Ja, begge
   - [ ] Nei, bare permanente

4. **Minimum antall brukere?**
   - [ ] 100 aktive brukere
   - [ ] 50 aktive brukere
   - [ ] 20 aktive brukere

5. **Hvor ofte skal det sjekkes?**
   - [ ] Hver time (real-time)
   - [ ] Hver gang appen åpnes
   - [ ] Kun ved periodens slutt (permanent)
   - [ ] Kombinasjon (foreløpig ved åpning, permanent ved periodens slutt)

6. **Skal anonyme brukere telles med?**
   - [ ] Ja, både anonyme og innloggede
   - [ ] Nei, kun innloggede brukere

