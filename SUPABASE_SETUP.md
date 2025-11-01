# Supabase Setup

## Steg 1: Opprett Supabase-prosjekt

1. Gå til [supabase.com](https://supabase.com)
2. Opprett en gratis konto eller logg inn
3. Klikk "New Project"
4. Fyll inn:
   - Project name: `steppin` (eller valgfritt navn)
   - Database Password: (lag et sikkert passord)
   - Region: Velg nærmeste region (f.eks. `West US (N. California)`)
5. Klikk "Create new project"

## Steg 2: Hent API-nøkler

1. Når prosjektet er opprettet, gå til "Settings" (innstillinger)
2. Gå til "API" i menyen til venstre
3. Du trenger:
   - **Project URL** (f.eks. `https://xxxxx.supabase.co`)
   - **anon/public key** (starter med `eyJ...`)

## Steg 3: Opprett .env fil

1. Kopier `.env.example` til `.env` (hvis den eksisterer)
2. Eller opprett en ny fil kalt `.env` i rotmappen
3. Legg inn:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJ...din_key_her
```

## Steg 4: Restart Expo

Etter at du har opprettet `.env` filen, må du:
1. Stopp Expo (Ctrl+C)
2. Start på nytt med `npm start`

**Viktig:** `.env` filen er allerede i `.gitignore` og vil ikke bli lastet opp til GitHub.

