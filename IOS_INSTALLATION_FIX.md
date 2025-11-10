# iOS Installation Fix - App kan ikke åpnes

## Problemet
Appen er installert, men iOS blokkerer den fordi den ikke er signert med en betalt Apple Developer-konto.

## Løsning: Tillat appen i iOS-innstillinger

### Steg 1: Gå til iOS-innstillinger
1. Åpne **Innstillinger** (Settings) på iPhone
2. Gå til **Generelt** (General)
3. Scroll ned til **VPN og enhetsadministrasjon** (VPN & Device Management)
   - Eller **Enhetsadministrasjon** (Device Management) på eldre iOS-versjoner
   - Eller **Profiler og enhetsadministrasjon** (Profiles & Device Management)

### Steg 2: Tillat utvikleren
1. Under **"Developer App"** eller **"Enterprise App"** sektionen
2. Du skal se en profil med navnet på din Expo-konto eller "Expo Development Client"
3. Trykk på profilen
4. Trykk på **"Tillat"** (Trust) eller **"Stol på"** (Trust)
5. Bekreft ved å trykke **"Tillat"** igjen i popup-vinduet

### Steg 3: Åpne appen
1. Gå tilbake til hjem-skjermen
2. Trykk på appen (den hvite ikonet)
3. Appen skal nå åpnes!

---

## Alternativ: Bruk iOS Simulator (Hvis du har Mac)

Hvis du har en Mac, kan du installere appen i iOS Simulator i stedet:

### Steg 1: Installer Xcode (hvis ikke allerede installert)
1. Åpne App Store på Mac
2. Søk etter "Xcode"
3. Installer Xcode (gratis, men stor fil - ca. 10GB)

### Steg 2: Installer i Simulator
Når EAS spør om du vil installere i simulator:
- Svar **"Yes"**
- Xcode vil åpne automatisk
- Appen installeres i simulator

### Steg 3: Start Development Server
```bash
npm run start:dev
```

---

## Hvis appen fortsatt ikke åpnes

### Sjekk at appen er riktig installert:
1. Sjekk at appen faktisk er på hjem-skjermen
2. Prøv å slette og installere på nytt
3. Restart telefonen

### Sjekk iOS-versjon:
- Development builds krever iOS 13 eller nyere
- Sjekk iOS-versjon: Innstillinger → Generelt → Om

### Prøv å bygge på nytt:
Hvis ingenting fungerer, kan du prøve å bygge på nytt:
```bash
npm run build:ios:dev
```

---

## Neste steg etter at appen åpnes

1. **Start Development Server:**
   ```bash
   npm run start:dev
   ```

2. **Koble appen til serveren:**
   - Appen skal automatisk koble seg til development serveren
   - Hvis ikke, trykk på "Connect to Dev Server" i appen
   - Skann QR-koden som vises i terminalen

3. **Test GPS-sporing:**
   - Gå til Innstillinger i appen
   - Aktiver GPS-sporing
   - Gå en tur og se om den registreres!

---

## Troubleshooting

### "Appen kan ikke åpnes" etter å ha tillatt
- Prøv å slette appen og installere på nytt
- Sjekk at du faktisk trykket "Tillat" i innstillinger
- Restart telefonen

### Appen åpnes men viser feilmelding
- Sjekk at development serveren kjører (`npm run start:dev`)
- Sjekk at telefonen og datamaskinen er på samme WiFi
- Prøv å restarte development serveren

### Appen kobler ikke til development server
- Sjekk WiFi-tilkobling
- Prøv å skann QR-koden på nytt
- Sjekk at port 8081 ikke er blokkert av firewall

