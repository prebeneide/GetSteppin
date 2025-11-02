# Forslag til ny prestasjonssystem

## Nåværende problemer:
1. Dagens bronse blir gitt 2 ganger i dag (må bare gis én gang per dag)
2. Prestasjoner skal kun utdeles når perioden slutter (kl. 24:00 for dag)
3. Hvis noen går forbi deg, skal du miste prestasjonen (men den skal fortsatt vises hvis du har den)
4. Det er 2 prestasjoner som viser 1. plass - må differensieres bedre

## Løsningsforslag:

### 1. Prestasjons-emoji fordeling:
- **🥇 Gullmedalje**: 1. plass blant venner **den dagen** (daily rank 1)
- **🥈 Sølvmedalje**: 2. plass blant venner **den dagen** (daily rank 2)  
- **🥉 Bronse**: 3. plass blant venner **den dagen** (daily rank 3)
- **👑 Krone**: 1. plass blant venner **den uken** (weekly rank 1)
- **🏆 Pokal**: 1. plass blant venner **den måneden** (monthly rank 1)
- **🍒 Kirsebær**: For hver 1000 skritt (fungerer allerede riktig)

### 2. Foreløpige vs. permanente prestasjoner:

#### A. Foreløpige prestasjoner (vises i løpet av dagen):
- **Visning**: Vises basert på nåværende ranking
  - Hvis brukeren har 1. plass nå → vis 🥇 (foreløpig)
  - Hvis brukeren har 2. plass nå → vis 🥈 (foreløpig)
  - Hvis brukeren har 3. plass nå → vis 🥉 (foreløpig)
- **Oppdatering**: Oppdateres kontinuerlig når ranking endres
  - Hvis noen går forbi brukeren → fjern foreløpig prestasjon
  - Hvis brukeren går forbi noen → vis ny foreløpig prestasjon
- **Lagring**: IKKE lagret i databasen - kun visning

#### B. Permanente prestasjoner (lagres ved periodens slutt):
- **Når lagres**: Kun når perioden er avsluttet (kl. 24:00 for dag)
- **Hvem får**: Kun den som faktisk har ledelsen ved kl. 24:00
- **Hvordan**: 
  - Ved periodens slutt (kl. 24:00) sjekk endelig ranking
  - Gi prestasjon til den som faktisk leder
  - Lagre i `user_achievements` og `achievement_log`
  - Kun én prestasjon per periode per bruker

#### C. Uke-/månedsprestasjoner (👑🏆):
- **Foreløpig**: Vises basert på nåværende ranking i uken/måneden
- **Permanent**: Lagres kun når perioden er avsluttet
  - Uke: Søndag kl. 23:59:59
  - Måned: Siste dag i måneden kl. 23:59:59

### 3. Teknisk implementering:

#### A. Foreløpige prestasjoner (visning):
```typescript
// Ny funksjon: getPreliminaryAchievements(userId, period)
// - Hent nåværende ranking for perioden
// - Returner emoji basert på rank (🥇🥈🥉 for dag, 👑 for uke, 🏆 for måned)
// - Ikke lagre i database - kun returner for visning
// - Kalles kontinuerlig når data oppdateres
```

#### B. Permanente prestasjoner (lagring):
```typescript
// Endre checkCompetitionAchievements:
// 1. Sjekk om perioden er avsluttet (for dag: i går, for uke/måned: forrige periode)
// 2. Sjekk om det allerede er gitt prestasjon for denne perioden
// 3. Hvis perioden er avsluttet og ingen prestasjon:
//    - Hent endelig ranking for perioden
//    - Gi prestasjon basert på endelig ranking
//    - Lagre i user_achievements og achievement_log
```

#### C. Nye funksjoner:
```typescript
// 1. getPreliminaryAchievements(userId, period)
//    - Returnerer foreløpig prestasjon basert på nåværende ranking
//    - Brukes i UI for å vise prestasjoner i løpet av dagen

// 2. checkPeriodEndAchievements(userId, period)
//    - Sjekker om perioden er avsluttet
//    - Sjekker om prestasjon allerede er gitt
//    - Gir permanent prestasjon basert på endelig ranking
//    - Kjøres ved app-oppstart eller via bakgrunns-job
```

#### D. Metadata i achievement_log:
- `period`: "day_2024-01-15", "week_2024-01-15", "month_2024-01"
- `final_rank`: Den endelige rangeringen ved periodens slutt
- `period_end_date`: Når perioden sluttet
- `is_preliminary`: false (kun permanente prestasjoner lagres)

### 4. Visning av prestasjoner:

#### A. I løpet av dagen (foreløpig):
- `AchievementsView` skal vise:
  - Alle permanente prestasjoner brukeren har fått (fra database)
  - PLUS foreløpige prestasjoner basert på nåværende ranking
  - Foreløpige prestasjoner kan markeres visuelt (f.eks. semi-transparent eller med "foreløpig" badge)

#### B. Ved periodens slutt (permanent):
- Kun de som faktisk ender på 1./2./3. plass får prestasjonen lagret
- Prestasjonene vises i `AchievementsView` som vanlige prestasjoner

### 5. Spesielle regler:
- **Kirsebær (🍒)**: Får man for hver 1000 skritt, uansett. Fungerer allerede riktig.
- **Daglige prestasjoner**: Kun én per dag, basert på rank ved dagens slutt
- **Uke-/månedsprestasjoner**: Kun én per periode, basert på endelig ranking

## Løsning med foreløpige prestasjoner:

### Fordeler:
- ✅ Brukere ser umiddelbart om de leder (bedre brukeropplevelse)
- ✅ Prestasjoner oppdateres automatisk når ranking endres
- ✅ Kun de som faktisk ender på toppen får prestasjonen permanent
- ✅ Ingenting lagres før perioden er avsluttet (korrekt data)

### Implementering:
1. **Foreløpige prestasjoner (visning)**:
   - Ny funksjon `getPreliminaryAchievements()` som returnerer emoji basert på nåværende rank
   - Kalles kontinuerlig når ranking oppdateres
   - Vises i `AchievementsView` med visuell markering (f.eks. semi-transparent)

2. **Permanente prestasjoner (lagring)**:
   - Endre `checkCompetitionAchievements()` til å kun sjekke avsluttede perioder
   - Sjekk om perioden er avsluttet (for dag: i går, for uke/måned: forrige periode)
   - Gi prestasjon basert på endelig ranking
   - Kjøres ved app-oppstart eller via bakgrunns-job

## Spørsmål:
1. Skal daglige prestasjoner sjekkes automatisk kl. 24:00 eller ved første oppstart neste dag?
2. Skal foreløpige prestasjoner markeres visuelt (f.eks. semi-transparent eller med "foreløpig" tekst)?
3. Skal vi ha prestasjoner for 2. og 3. plass for uke og måned også?
4. Hvordan skal vi håndtere at flere brukere kan ha samme antall skritt og samme rank?

## Implementeringsplan:
1. Oppdater emoji-fordeling (🥇 for dag, 👑 for uke, 🏆 for måned)
2. Endre `checkCompetitionAchievements` til å kun sjekke ved periodens slutt
3. Legg til logikk for å sjekke om perioden er avsluttet
4. Oppdater databasestruktur/metadata for å lagre endelig ranking
5. Test at prestasjoner kun gis én gang per periode
6. Test at kirsebær fortsatt gis for hver 1000 skritt

