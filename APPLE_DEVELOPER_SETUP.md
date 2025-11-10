# Apple Developer-konto Setup - Komplett Steg-for-Steg Guide

## Oversikt
Denne guiden tar deg gjennom hele prosessen med å registrere deg for Apple Developer Program ($99/år) og sette opp appen din for testing på fysisk iPhone.

---

## Steg 1: Registrer deg for Apple Developer Program

### 1.1 Gå til Apple Developer-nettsiden
1. Åpne nettleseren og gå til: **https://developer.apple.com/programs/**
2. Eller søk etter "Apple Developer Program" i Google

### 1.2 Start registreringen
1. Trykk på **"Enroll"** eller **"Start Your Enrollment"** knappen
2. Du vil bli bedt om å logge inn med din Apple ID
   - Hvis du ikke har Apple ID: Opprett en på https://appleid.apple.com
   - Bruk samme Apple ID som du bruker til App Store

### 1.3 Fyll ut registreringsskjemaet
Du må fylle ut:
- **Personlig informasjon:**
  - Fornavn og etternavn
  - E-postadresse
  - Telefonnummer
  - Adresse

- **Organisasjonstype:**
  - Velg **"Individual"** (enkeltperson) hvis du er privatperson
  - Eller **"Organization"** hvis du representerer et selskap

- **Betalingsinformasjon:**
  - Kortnummer
  - Utløpsdato
  - CVV-kode
  - Faktureringsadresse

### 1.4 Godkjenn vilkårene
1. Les gjennom Apple Developer Program License Agreement
2. Godkjenn vilkårene
3. Bekreft at informasjonen er korrekt

### 1.5 Betal
1. Betal $99 USD (eller tilsvarende i din valuta)
2. Du får en kvittering på e-post

### 1.6 Vent på godkjenning
- **Tid:** Vanligvis 24-48 timer (kan ta opptil 1 uke)
- Du får e-post når kontoen er godkjent
- Sjekk e-posten din regelmessig

---

## Steg 2: Verifiser at kontoen er aktiv

### 2.1 Logg inn på Apple Developer
1. Gå til: **https://developer.apple.com/account/**
2. Logg inn med din Apple ID
3. Du skal nå se "Apple Developer Program - Active" eller lignende

### 2.2 Sjekk at alt er klart
- Du skal se en dashboard med utviklerverktøy
- Kontoen skal være aktiv og klar til bruk

---

## Steg 3: Bygg appen på nytt med Developer-konto

### 3.1 Sørg for at du er logget inn på EAS
```bash
npx eas-cli login
```

### 3.2 Bygg appen for fysisk enhet
```bash
npm run build:ios:dev
```

Eller:
```bash
npx eas-cli build --profile development --platform ios
```

### 3.3 Når EAS spør om credentials

**Første gang:**
1. EAS vil spørre: "How would you like to upload your credentials?"
2. Velg: **"Set up credentials automatically"** (anbefalt)
3. EAS vil spørre om Apple ID
4. Skriv inn Apple ID-en din (samme som Developer-kontoen)
5. EAS vil automatisk:
   - Opprette nødvendige certificates
   - Sette opp provisioning profiles
   - Signere appen riktig

**Hvis EAS spør om Apple Developer-konto:**
- Bekreft at du har Apple Developer-konto
- EAS vil bruke Developer-kontoen din automatisk

### 3.4 Vent på bygget
- Bygget tar ca. 15-30 minutter
- Du får en link eller QR-kode når det er ferdig

---

## Steg 4: Installer appen på iPhone

### 4.1 Last ned appen
1. Åpne linken på iPhone (eller skann QR-koden)
2. Trykk på **"Install"** eller **"Last ned"**
3. Appen installeres på telefonen

### 4.2 Tillat appen (første gang)
1. Gå til **Innstillinger** → **Generelt** → **VPN og enhetsadministrasjon**
2. Under **"Developer App"**, trykk på profilen
3. Trykk **"Tillat"** (Trust)
4. Bekreft ved å trykke **"Tillat"** igjen

### 4.3 Åpne appen
1. Gå til hjem-skjermen
2. Trykk på appen
3. Appen skal nå åpnes!

---

## Steg 5: Start Development Server

### 5.1 Start serveren
```bash
npm run start:dev
```

Eller:
```bash
npx expo start --dev-client
```

### 5.2 Koble appen til serveren
- Appen skal automatisk koble seg til
- Eller skann QR-koden som vises i terminalen
- Appen skal nå laste inn!

---

## Steg 6: Test GPS-sporing

1. Åpne appen på telefonen
2. Gå til **Innstillinger** → **Aktiver GPS-sporing**
3. Gi tillatelse når iOS spør
4. Gå utenfor hjemområdet ditt
5. Gå en tur (du kan lukke appen - den skal fortsatt spore!)
6. Sjekk **"Mine turer"** for å se om turen er registrert

---

## Troubleshooting

### "Apple Developer-konto ikke funnet"
- Sjekk at du er logget inn med riktig Apple ID
- Sjekk at kontoen er godkjent (kan ta 24-48 timer)
- Prøv å logge ut og inn igjen på developer.apple.com

### "Credentials setup failed"
- Sjekk at du har Apple Developer-konto (ikke bare gratis Apple ID)
- Prøv å sette opp credentials manuelt:
  ```bash
  npx eas-cli credentials
  ```

### "App kan ikke åpnes"
- Sjekk at du har tillatt appen i iOS-innstillinger
- Prøv å slette og installere appen på nytt
- Restart telefonen

### "Appen utløper"
- Med Apple Developer-konto skal appen ikke utløpe
- Hvis den gjør det, bygg på nytt med Developer-konto

---

## Kostnader - Oversikt

### Engangsbetaling:
- **Ingen** - Alt er inkludert i $99/år

### Årlig kostnad:
- **$99 USD/år** for Apple Developer Program
- Dette inkluderer:
  - Testing på fysiske enheter
  - Legge ut apper på App Store
  - Oppdatere apper
  - TestFlight for beta-testing
  - Full tilgang til utviklerverktøy

### EAS Build:
- **Development builds:** Gratis (uendelig)
- **Production builds:** Gratis hvis du bygger lokalt, eller betalt via EAS

---

## Neste steg etter oppsett

1. ✅ Test GPS-sporing på telefonen
2. ✅ Se om turer registreres korrekt
3. ✅ Fortsett å utvikle - endringer i kode fungerer umiddelbart!
4. ✅ Når appen er klar: Bygg production build og legg ut på App Store

---

## Nyttige lenker

- Apple Developer Program: https://developer.apple.com/programs/
- Apple Developer Account: https://developer.apple.com/account/
- EAS Build Dashboard: https://expo.dev/builds
- EAS Credentials: https://docs.expo.dev/app-signing/managed-credentials/

---

## Spørsmål?

Hvis du støter på problemer:
1. Sjekk at Apple Developer-kontoen er aktiv
2. Sjekk at du er logget inn med riktig Apple ID i EAS
3. Se EAS Build logs for feilmeldinger
4. Sjekk iOS-innstillinger på telefonen

