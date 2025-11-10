# iOS Fysisk Enhet Setup - Komplett Guide

## Problemet
For å installere en development build på en fysisk iPhone, trenger du enten:
1. **Apple Developer-konto** ($99/år) - Enklest og mest pålitelig
2. **Gratis Apple ID** - Mulig, men mer komplisert

---

## Løsning 1: Apple Developer-konto (Anbefalt)

### Hva er det?
- Koster $99/år (eller gratis for studenter)
- Gir full tilgang til alle iOS-utviklingsverktøy
- Enklest å sette opp
- Ingen begrensninger

### Hvordan sette opp:
1. Gå til https://developer.apple.com/programs/
2. Registrer deg for Apple Developer Program
3. Betal $99/år (eller søk om studentrabatt)
4. Vent på godkjenning (kan ta 1-2 dager)

### Bygg med Developer-konto:
```bash
npm run build:ios:dev
```

Når EAS spør om credentials:
- Velg "Set up credentials automatically"
- Logg inn med Apple Developer-kontoen din
- EAS håndterer resten!

---

## Løsning 2: Gratis Apple ID (Begrenset)

### Hva er det?
- Gratis Apple ID (samme som du bruker til App Store)
- Begrenset funksjonalitet
- Appen utløper etter 7 dager (må reinstalleres)
- Kan være vanskeligere å sette opp

### Hvordan sette opp:
1. Sørg for at du har en Apple ID (samme som App Store)
2. Bygg appen:
   ```bash
   npm run build:ios:dev
   ```
3. Når EAS spør om credentials:
   - Velg "Set up credentials automatically"
   - Logg inn med gratis Apple ID
   - EAS vil prøve å sette opp automatisk

### Begrensninger:
- ⚠️ Appen utløper etter 7 dager (må bygge på nytt)
- ⚠️ Maks 3 apper installert samtidig
- ⚠️ Kan ha problemer med noen funksjoner

---

## Løsning 3: iOS Simulator (Gratis, men krever Mac)

### Hva er det?
- Simulerer iPhone på Mac
- Gratis
- Fungerer utmerket for testing
- Men: Du kan ikke teste GPS-sporing ordentlig (simulator har ikke GPS)

### Hvordan sette opp:
1. Installer Xcode fra App Store (gratis, men stor fil - ca. 10GB)
2. Bygg for simulator:
   ```bash
   npx eas-cli build --profile development --platform ios --local
   ```
   Eller endre `eas.json` tilbake til `"simulator": true`

---

## Hva jeg har gjort

Jeg har oppdatert `eas.json` til å bygge for fysisk enhet (`"simulator": false`).

---

## Anbefaling

**For testing av GPS-sporing:**
1. **Best løsning:** Apple Developer-konto ($99/år)
   - Enklest å sette opp
   - Ingen begrensninger
   - Fungerer perfekt

2. **Alternativ:** Prøv gratis Apple ID først
   - Bygg appen på nytt
   - Se om det fungerer
   - Hvis det ikke fungerer, vurder Developer-konto

3. **Hvis du har Mac:** Bruk simulator for å teste UI, men ikke GPS

---

## Neste steg

### Hvis du vil prøve gratis Apple ID først:
1. Bygg appen på nytt:
   ```bash
   npm run build:ios:dev
   ```
2. Når EAS spør om credentials, velg "Set up credentials automatically"
3. Logg inn med din gratis Apple ID
4. Se om bygget fungerer

### Hvis du vil ha Apple Developer-konto:
1. Gå til https://developer.apple.com/programs/
2. Registrer deg
3. Vent på godkjenning
4. Bygg appen på nytt med Developer-konto

---

## Spørsmål?

- Apple Developer Program: https://developer.apple.com/programs/
- EAS Credentials Guide: https://docs.expo.dev/app-signing/managed-credentials/

