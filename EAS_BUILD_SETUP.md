# EAS Build Setup Guide - Komplett Veiledning

## Oversikt
Denne guiden tar deg gjennom hele prosessen med å sette opp og bygge en development build av appen din. Dette er nødvendig for å teste GPS-sporing og andre native funksjoner som ikke fungerer i Expo Go.

---

## Steg 1: Installer EAS CLI (Ferdig ✅)

EAS CLI er allerede installert i prosjektet ditt.

---

## Steg 2: Logg inn på Expo

Du må ha en Expo-konto. Hvis du ikke har en, kan du opprette en gratis konto.

```bash
npx eas-cli login
```

Dette vil:
- Åpne en nettleser for å logge inn
- Eller be deg om å skrive inn e-post og passord

**Hvis du ikke har konto:**
- Gå til https://expo.dev og opprett en gratis konto
- Deretter kjør `npx eas-cli login` igjen

---

## Steg 3: Koble prosjektet til Expo

```bash
npx eas-cli init
```

Dette vil:
- Spørre om du vil koble prosjektet til et eksisterende Expo-prosjekt eller opprette et nytt
- Følge instruksjonene på skjermen

---

## Steg 4: Bygg Development Build for iOS

### For iOS Simulator (Anbefalt for første test - raskt og gratis)

```bash
npx eas-cli build --profile development --platform ios
```

Dette vil:
- Bygge appen i skyen (tar ca. 15-30 minutter)
- Gi deg en QR-kode eller link når bygget er ferdig
- Være gratis for simulator builds

### For Fysisk iOS-enhet (Krever Apple Developer-konto)

Hvis du vil teste på en fysisk iPhone:

1. **Du trenger:**
   - Apple Developer-konto ($99/år, eller gratis hvis du er student)
   - Se `APPLE_DEVELOPER_SETUP.md` for komplett guide

2. **Bygg:**
   ```bash
   npm run build:ios:dev
   ```
   Eller:
   ```bash
   npx eas-cli build --profile development --platform ios
   ```

3. **Når du blir spurt om credentials:**
   - Velg "Set up credentials automatically" (anbefalt)
   - Logg inn med din Apple Developer-konto
   - EAS håndterer resten automatisk

---

## Steg 5: Installer appen på telefonen

### For Simulator:
1. Når bygget er ferdig, får du en link
2. Åpne linken i Safari på Mac
3. Appen installeres automatisk i simulator

### For Fysisk Enhet:
1. Når bygget er ferdig, får du en QR-kode eller link
2. Åpne linken på iPhone (eller skann QR-koden)
3. Følg instruksjonene for å installere appen
4. **VIKTIG: Etter installasjon må du tillate appen i iOS-innstillinger:**
   - Gå til **Innstillinger** → **Generelt** → **VPN og enhetsadministrasjon** (eller **Enhetsadministrasjon**)
   - Under **"Developer App"** eller **"Enterprise App"**, trykk på profilen
   - Trykk **"Tillat"** (Trust) og bekreft
   - Nå kan du åpne appen!

---

## Steg 6: Start Development Server

Etter at appen er installert:

```bash
npx expo start --dev-client
```

Dette starter development serveren som appen kobler seg til.

---

## Steg 7: Test GPS-sporing

1. Åpne appen på telefonen
2. Gå til Innstillinger → Aktiver GPS-sporing
3. Gå utenfor hjemområdet ditt
4. Gå en tur (hold appen åpen eller lukk den - begge skal fungere!)
5. Sjekk "Mine turer" for å se om turen er registrert

---

## Hva skjer etter bygging?

### ✅ Du kan fortsette å endre kode normalt!

**Fungerer umiddelbart (ingen ny bygging nødvendig):**
- ✅ Endre React-komponenter
- ✅ Endre styling
- ✅ Endre logikk i hooks og services
- ✅ Legge til/fjerne skjermer
- ✅ Endre navigasjon
- ✅ Endre JavaScript/TypeScript kode

**Krever ny bygging (sjeldent):**
- ⚠️ Endre `app.json` (permissions, config)
- ⚠️ Legge til nye native pakker
- ⚠️ Endre native konfigurasjon

### Eksempel:

```bash
# 1. Bygg development build (kun første gang - tar 15-30 min)
npx eas-cli build --profile development --platform ios

# 2. Installer appen på telefonen

# 3. Start development server
npx expo start --dev-client

# 4. Gjør kodeendringer (fungerer umiddelbart!)
# - Endre HomeScreen.tsx ✅
# - Endre SettingsScreen.tsx ✅
# - Legge til ny komponent ✅
# - Endre styling ✅

# 5. Se endringene umiddelbart i appen!
```

---

## Troubleshooting

### "EAS CLI not found"
```bash
npm install --save-dev eas-cli
```

### "Not logged in"
```bash
npx eas-cli login
```

### "No project linked"
```bash
npx eas-cli init
```

### Build feiler
- Sjekk at alle dependencies er installert: `npm install`
- Sjekk at `app.json` er korrekt konfigurert
- Sjekk build logs i Expo Dashboard

### Appen kobler ikke til development server
- Sjekk at telefonen og datamaskinen er på samme WiFi
- Prøv å restarte development serveren
- Sjekk at port 8081 ikke er blokkert av firewall

---

## Kostnader

- **iOS Simulator Build:** Gratis
- **iOS Device Build:** Gratis (med gratis Apple ID) eller $99/år (med Apple Developer-konto)
- **Android Build:** Gratis
- **EAS Build Service:** Gratis for development builds, betalt for production builds (men du kan bygge lokalt)

---

## Neste steg

1. Følg stegene over for å bygge development build
2. Test GPS-sporing på telefonen
3. Se om turer registreres korrekt
4. Fortsett å utvikle som normalt - endringer i kode fungerer umiddelbart!

---

## Spørsmål?

- EAS Dokumentasjon: https://docs.expo.dev/build/introduction/
- EAS Build Status: https://expo.dev/accounts/[your-account]/builds

