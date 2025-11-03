# Kartvisning Setup Guide

## Anbefaling: Mapbox

Vi anbefaler **Mapbox** for kartvisning i appen din:

### Hvorfor Mapbox?
- ✅ **50,000 gratis requests per måned** (vs Google's 28,000)
- ✅ **Utmerket tilpasning av farger og stil** - enkelt å matche appens design
- ✅ **Høy kvalitet** kart
- ✅ **Enklere API** enn Google Maps

### Setup Instruksjoner

#### 1. Opprett Mapbox-konto (gratis)
1. Gå til [mapbox.com](https://www.mapbox.com)
2. Klikk "Sign Up" og opprett en gratis konto
3. Bekreft e-postadressen din

#### 2. Få Access Token
1. Gå til [Account Tokens](https://account.mapbox.com/access-tokens/)
2. Du vil se et **Default Public Token** - dette er det du trenger!
3. Kopier tokenet (starter gjerne med `pk.ey...`)

#### 3. Legg til i appen
1. Opprett en `.env` fil i prosjektets rot (hvis den ikke finnes)
2. Legg til:
   ```
   EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.din_mapbox_token_her
   ```
3. Restart Expo server: `npm start`

#### 4. Test
- Åpne appen og se en post med en tur
- Kartet skal nå vises med ekte kartbakgrunn!
- Ruten vises i appens farger (#1ED760 - grønn)

---

## Alternativ: Google Maps

Hvis du foretrekker Google Maps:

### Setup
1. Gå til [Google Cloud Console](https://console.cloud.google.com/)
2. Opprett et prosjekt (eller bruk eksisterende)
3. Aktiver **Maps Static API**
4. Opprett en **API Key**
5. Legg til i `.env`:
   ```
   EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=ditt_google_api_key_her
   ```

### Begrensninger
- **28,000 gratis requests per måned** (mindre enn Mapbox)
- **Mindre fleksibel styling** - begrenset mulighet for fargetilpasning

---

## Farge-tilpasning

Alle kartfarger er definert i `lib/mapConfig.ts`:

```typescript
export const APP_COLORS = {
  primary: '#1ED760',      // Appens hovedfarge
  startMarker: '#1ED760',   // Start markør (grønn)
  endMarker: '#F44336',    // Slutt markør (rød)
  routePath: '#1ED760',    // Rute linje
  // ... flere farger
};
```

Du kan endre disse fargene for å matche appens design perfekt!

---

## Fallback (uten API-nøkkel)

Hvis ingen API-nøkler er satt opp, vil appen automatisk bruke en **SVG fallback**:
- Viser ruten som en grønn linje
- Markører for start/slutt
- Fungerer helt uten nettverk!

Dette gir en smooth opplevelse selv uten API-nøkler.

---

## Priser (2024)

### Mapbox (Anbefalt)
- **Gratis**: 50,000 requests/måned
- **Etter det**: $0.50 per 1,000 requests
- Perfekt for små/medium apper!

### Google Maps
- **Gratis**: 28,000 requests/måned  
- **Etter det**: $2 per 1,000 requests
- Dyrere, men kjent merkevare

---

## Tips

1. **Start med Mapbox** - bedre gratis tier og fleksibilitet
2. **Bruk SVG fallback** for testing uten API-nøkler
3. **Overvåk bruk** i Mapbox dashboard for å unngå overraskelser
4. **Cache kartbilder** i produksjon for å redusere API-kall

---

## Hjelp?

Hvis du støter på problemer:
1. Sjekk at `.env` filen er i prosjektets rot
2. Sjekk at token/key starter med `EXPO_PUBLIC_`
3. Restart Expo server etter å ha lagt til environment variabler
4. Sjekk console for feilmeldinger

