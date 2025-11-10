# Splash Screen Guide

## Oversikt
Appen bruker Expo's innebygde splash screen med kontrollert visning via `expo-splash-screen`.

## Konfigurasjon

### app.json
Splash screen er konfigurert i `app.json`:
```json
"splash": {
  "image": "./assets/splash-icon.png",
  "resizeMode": "contain",
  "backgroundColor": "#1ED760"
}
```

### App.tsx
Splash screen logikken er implementert i `App.tsx`:
- Splash screenen holdes synlig mens appen initialiserer
- Den skjules automatisk når appen er klar
- Det er en 1 sekund delay for en jevn overgang

## Hvordan det fungerer

1. **Ved oppstart**: `SplashScreen.preventAutoHideAsync()` forhindrer at splash screenen forsvinner automatisk
2. **Initialisering**: Appen initialiserer (migrasjoner, storage, etc.)
3. **Klar**: Når alt er klart, settes `appIsReady` til `true`
4. **Skjul**: `SplashScreen.hideAsync()` kalles når appen er ferdig rendret

## Tilpasning

### Endre splash screen bilde
1. Erstatt `./assets/splash-icon.png` med ditt eget bilde
2. Anbefalte størrelser:
   - iOS: 2048x2048px (for alle enheter)
   - Android: 2048x2048px (for alle enheter)

### Endre bakgrunnsfarge
Endre `backgroundColor` i `app.json`:
```json
"backgroundColor": "#1ED760"  // Appens grønne farge
```

### Endre resize mode
- `"contain"`: Bilde skal være fullstendig synlig (anbefalt)
- `"cover"`: Bilde fyller hele skjermen (kan kutte av deler)
- `"native"`: Bruker native oppførsel

### Endre delay
Endre delay i `App.tsx`:
```typescript
await new Promise(resolve => setTimeout(resolve, 1000)); // 1 sekund
```

## Testing

### Expo Go
Splash screen vises ikke i Expo Go, men fungerer i development builds og produksjonsbygger.

### Development Build
1. Bygg en development build: `eas build --profile development`
2. Installer på enhet
3. Start appen - splash screen skal vises

### Produksjon
1. Bygg produksjonsversjon: `eas build --profile production`
2. Installer på enhet
3. Start appen - splash screen skal vises

## Feilsøking

### Splash screen vises ikke
- Sjekk at `splash-icon.png` eksisterer i `./assets/`
- Sjekk at `app.json` har riktig konfigurasjon
- Rebuild appen (splash screen er del av native kode)

### Splash screen forblir synlig
- Sjekk at `SplashScreen.hideAsync()` kalles
- Sjekk at `appIsReady` settes til `true`
- Sjekk console for feilmeldinger

### Splash screen forsvinner for raskt
- Øk delay i `App.tsx`
- Sjekk at initialisering tar nok tid

## Best Practices

1. **Bilde størrelse**: Bruk høy oppløsning (2048x2048px) for best kvalitet
2. **Bakgrunnsfarge**: Bruk appens primærfarge (#1ED760)
3. **Resize mode**: Bruk `"contain"` for å unngå at bildet kuttes av
4. **Delay**: 1 sekund er vanligvis nok for en jevn overgang
5. **Testing**: Test på faktiske enheter, ikke bare i Expo Go

