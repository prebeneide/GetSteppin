# Development Build Guide - GPS Tracking

## Problemet med Expo Go

**Expo Go** er en app for testing, men den har begrensninger:
- ❌ Kan ikke lese alle iOS-permissions fra `app.json` automatisk
- ❌ Har begrensede muligheter for bakgrunnstjenester
- ❌ Støtter ikke alle native funksjoner

For å få **full støtte for GPS-sporing** (inkludert bakgrunnstjenester), må du bygge en **development build**.

## Hva er en Development Build?

En development build er en egenbygd versjon av appen din som:
- ✅ Støtter alle native funksjoner
- ✅ Leser alle permissions fra `app.json`
- ✅ Kan kjøre i bakgrunnen
- ✅ Fungerer nesten som en produksjonsapp, men med debugging

## Hvordan bygge en Development Build

### Metode 1: EAS Build (Anbefalt - Enklest)

1. **Installer EAS CLI:**
   ```bash
   npm install -g eas-cli
   ```

2. **Logg inn på Expo:**
   ```bash
   eas login
   ```

3. **Konfigurer EAS (første gang):**
   ```bash
   eas build:configure
   ```

4. **Bygg for iOS (simulator eller fysisk enhet):**
   ```bash
   # For iOS simulator (raskt, gratis)
   eas build --profile development --platform ios

   # For fysisk iOS-enhet (krever Apple Developer-konto)
   eas build --profile development --platform ios
   ```

5. **Installer på telefonen:**
   - EAS vil gi deg en QR-kode eller link
   - Skann QR-koden med kameraet på telefonen
   - Installer appen

6. **Start development server:**
   ```bash
   npx expo start --dev-client
   ```

### Metode 2: Lokal build (Krever Mac + Xcode)

1. **Installer Expo Dev Client:**
   ```bash
   npx expo install expo-dev-client
   ```

2. **Bygg lokalt:**
   ```bash
   # For iOS simulator
   npx expo run:ios

   # For fysisk enhet
   npx expo run:ios --device
   ```

## Hvorfor fungerer ikke Expo Go?

Expo Go er en **generisk app** som ikke kjenner til dine spesifikke `app.json`-innstillinger. Den har hardkodede permissions som ikke inkluderer alle funksjonene din app trenger.

## Forskjell mellom Expo Go og Development Build

| Funksjon | Expo Go | Development Build |
|----------|---------|-------------------|
| Rask testing | ✅ | ⚠️ (krever bygging) |
| GPS i bakgrunnen | ❌ | ✅ |
| Alle permissions | ❌ | ✅ |
| Native funksjoner | ⚠️ Begrenset | ✅ Fullt |
| Debugging | ✅ | ✅ |

## Alternativ: Test uten bakgrunnstjenester

Hvis du bare vil teste funksjonaliteten nå, kan du:
- ✅ Holde appen åpen mens du går (foreground tracking fungerer i Expo Go)
- ✅ Teste at turer registreres
- ⚠️ Men: Bakgrunnstjenester vil ikke fungere

## Neste steg

1. **For testing nå:** Bruk Expo Go, men hold appen åpen mens du går
2. **For produksjon:** Bygg en development build eller production build

---

## Hvordan fungerer utvikling etter å ha bygget?

### ✅ Du kan fortsette å endre kode som normalt!

**JavaScript/TypeScript endringer:**
- ✅ Fungerer akkurat som Expo Go
- ✅ Fast Refresh / Hot Reload fungerer umiddelbart
- ✅ Ingen ny bygging nødvendig
- ✅ Se endringene med en gang

**Eksempler på endringer som fungerer umiddelbart:**
- ✅ Endre komponenter (React/React Native)
- ✅ Endre styling
- ✅ Endre logikk i hooks
- ✅ Endre services og utils
- ✅ Legge til/fjerne skjermer
- ✅ Endre navigasjon

**Når må du bygge på nytt?**
- ⚠️ Endre `app.json` (permissions, config, osv.)
- ⚠️ Legge til nye native pakker (som krever native kode)
- ⚠️ Endre native konfigurasjon
- ⚠️ Oppdatere Expo SDK

**Eksempler på endringer som krever ny bygging:**
- ⚠️ Legge til ny permission i `app.json`
- ⚠️ Installere ny native pakke (f.eks. `expo-camera` hvis du ikke allerede har den)
- ⚠️ Endre `bundleIdentifier` eller `package`

### Praktisk eksempel:

```bash
# 1. Bygg development build (kun første gang)
eas build --profile development --platform ios
# Vent 15-30 minutter, installer appen

# 2. Start development server
npx expo start --dev-client

# 3. Gjør kodeendringer (fungerer umiddelbart!)
# - Endre HomeScreen.tsx ✅
# - Endre SettingsScreen.tsx ✅
# - Legge til ny komponent ✅
# - Endre styling ✅

# 4. Når du trenger å endre native config (sjeldent):
# - Endre app.json ⚠️
# - Legge til ny native pakke ⚠️
# Da må du bygge på nytt (kun da!)
```

### Sammenligning med Expo Go:

| Type endring | Expo Go | Development Build |
|--------------|---------|-------------------|
| JavaScript/TypeScript | ✅ Umiddelbart | ✅ Umiddelbart |
| React-komponenter | ✅ Umiddelbart | ✅ Umiddelbart |
| Styling | ✅ Umiddelbart | ✅ Umiddelbart |
| Native config (app.json) | ❌ Fungerer ikke | ⚠️ Krever ny bygging |
| Nye native pakker | ❌ Fungerer ikke | ⚠️ Krever ny bygging |

**Konklusjon:** Du kan fortsette å utvikle akkurat som før! Du bygger kun på nytt når du endrer native konfigurasjon (som er sjeldent).

---

**Notat:** For å teste GPS-sporing i Expo Go kan du holde appen åpen, men for full funksjonalitet (inkludert bakgrunnstjenester) må du bygge en development build.

